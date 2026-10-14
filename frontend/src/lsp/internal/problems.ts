import type { Connection, Reply } from "./connection";
import { parseWith } from "./messages";
import { DIAGNOSTIC_REPORT, PUBLISH_DIAGNOSTICS, type Diagnostic } from "./protocol";
import { sameFile } from "./uri";
import { isDocVersion, type DocVersion } from "./version";

export type ProblemSeverity = "error" | "warning" | "info" | "hint";

export type LinePosition = { readonly line: number; readonly character: number };

export type ServerProblem = {
  readonly from: LinePosition;
  readonly to: LinePosition;
  readonly severity: ProblemSeverity;
  readonly message: string;
  readonly source: string | null;
  readonly code: string | null;
};

export type ProblemsContext = {
  readonly show: (version: DocVersion, problems: readonly ServerProblem[]) => void;
  readonly uri: string;
  readonly connection: Connection;
  readonly pulls: boolean;
  readonly log: (text: string) => void;
};

const SEVERITIES: readonly ProblemSeverity[] = ["error", "warning", "info", "hint"];

const PULL_TIMEOUT_MS = 30_000;

function toProblem(diagnostic: Diagnostic): ServerProblem {
  return {
    from: diagnostic.range.start,
    to: diagnostic.range.end,
    severity: SEVERITIES[Number(diagnostic.severity) - 1] ?? "error",
    message: diagnostic.message,
    source: diagnostic.source ?? null,
    code: diagnostic.code === undefined ? null : String(diagnostic.code),
  };
}

export class DocProblems {
  readonly #context: ProblemsContext;
  #version: DocVersion;
  #resultId: string | null = null;
  #items: readonly ServerProblem[] = [];
  #shown: DocVersion | null = null;
  #pulling = false;
  #again = false;
  #open = true;

  constructor(context: ProblemsContext, version: DocVersion) {
    this.#context = context;
    this.#version = version;
  }

  get uri(): string {
    return this.#context.uri;
  }

  sent(version: DocVersion): void {
    this.#version = version;
  }

  push(version: number | null | undefined, diagnostics: readonly Diagnostic[]): void {
    const shown = version ?? this.#version;
    if (!isDocVersion(shown) || shown > this.#version) {
      this.#context.log(`Dropped problems for a version yamt never sent: ${shown}`);
      return;
    }
    this.#show(shown, diagnostics.map(toProblem));
  }

  async pull(): Promise<void> {
    if (!this.#context.pulls) {
      return;
    }
    if (this.#pulling) {
      this.#again = true;
      return;
    }
    this.#pulling = true;
    const version = this.#version;
    const reply = await this.#context.connection.request(
      "textDocument/diagnostic",
      {
        textDocument: { uri: this.#context.uri },
        ...(this.#resultId === null ? {} : { previousResultId: this.#resultId }),
      },
      PULL_TIMEOUT_MS,
    );
    this.#pulling = false;
    if (this.#open) {
      this.#pulled(version, reply);
      this.#pullIfAsked();
    }
  }

  clear(): void {
    this.#show(this.#version, []);
  }

  close(): void {
    this.#open = false;
  }

  #pullIfAsked(): void {
    const again = this.#again;
    this.#again = false;
    if (again) {
      void this.pull();
    }
  }

  #show(version: DocVersion, problems: readonly ServerProblem[]): void {
    if (this.#shown !== null && version < this.#shown) {
      this.#context.log(`Dropped problems for version ${version}: version ${this.#shown} is shown`);
      return;
    }
    this.#shown = version;
    this.#context.show(version, problems);
  }

  #pulled(version: DocVersion, reply: Reply): void {
    if (reply.kind === "error") {
      this.#context.log(`textDocument/diagnostic failed: ${reply.message}`);
    }
    if (reply.kind !== "result") {
      return;
    }
    const parsed = parseWith(DIAGNOSTIC_REPORT, reply.value);
    if (!parsed.ok) {
      this.#context.log(`Dropped malformed problems from the server: ${parsed.reason}`);
      return;
    }
    const report = parsed.value;
    this.#resultId = report.resultId ?? null;
    if (report.kind === "full") {
      this.#items = report.items.map(toProblem);
    }
    this.#show(version, this.#items);
  }
}

export function pushProblems(
  params: unknown,
  docs: readonly DocProblems[],
  log: (text: string) => void,
): void {
  const parsed = parseWith(PUBLISH_DIAGNOSTICS, params);
  if (!parsed.ok) {
    log(`Dropped malformed problems from the server: ${parsed.reason}`);
    return;
  }
  const { uri, version, diagnostics } = parsed.value;
  docs.find((doc) => sameFile(doc.uri, uri))?.push(version, diagnostics);
}
