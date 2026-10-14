import type { Connection, Reply } from "./connection";
import type { DocEntry, Sent } from "./documents";
import { languageId } from "./languageIds";
import { parseWith } from "./messages";
import { toProblem, type ServerProblem } from "./problems";
import { DIAGNOSTIC_REPORT, PUBLISH_DIAGNOSTICS } from "./protocol";
import { sameFile } from "./uri";
import { isDocVersion, type DocVersion } from "./version";

export type Capabilities = { readonly pulls: boolean; readonly formats: boolean };

export type ServerDocsContext = {
  readonly name: string;
  readonly connection: Connection;
  readonly capabilities: Capabilities;
  readonly uriOf: (path: string) => string;
  readonly log: (text: string) => void;
};

type OnServer = {
  readonly entry: DocEntry;
  readonly uri: string;
  version: DocVersion;
  resultId: string | null;
  items: readonly ServerProblem[];
  pulling: boolean;
  again: boolean;
};

const PULL_TIMEOUT_MS = 30_000;

export class ServerDocs {
  readonly #context: ServerDocsContext;
  readonly #docs = new Map<DocEntry, OnServer>();

  constructor(context: ServerDocsContext) {
    this.#context = context;
  }

  get capabilities(): Capabilities {
    return this.#context.capabilities;
  }

  has(entry: DocEntry): boolean {
    return this.#docs.has(entry);
  }

  open(entry: DocEntry): void {
    const sent = entry.current();
    const on: OnServer = {
      entry,
      uri: this.#context.uriOf(entry.doc.path),
      version: sent.version,
      resultId: null,
      items: [],
      pulling: false,
      again: false,
    };
    this.#docs.set(entry, on);
    this.#context.connection.notify("textDocument/didOpen", {
      textDocument: {
        uri: on.uri,
        languageId: languageId(entry.doc.path),
        version: sent.version,
        text: sent.text,
      },
    });
    this.pullAll();
  }

  change(entry: DocEntry, sent: Sent): void {
    const on = this.#docs.get(entry);
    if (on === undefined) {
      return;
    }
    on.version = sent.version;
    this.#context.connection.notify("textDocument/didChange", {
      textDocument: { uri: on.uri, version: sent.version },
      contentChanges: [{ text: sent.text }],
    });
    this.pullAll();
  }

  close(entry: DocEntry): void {
    const on = this.#docs.get(entry);
    if (on !== undefined) {
      this.#docs.delete(entry);
      this.#context.connection.notify("textDocument/didClose", { textDocument: { uri: on.uri } });
    }
  }

  closeAll(): void {
    for (const on of this.#docs.values()) {
      on.entry.doc.showProblems(this.#context.name, on.version, []);
      this.close(on.entry);
    }
  }

  formatting(entry: DocEntry, options: unknown, timeoutMs: number): Promise<Reply> {
    return this.#context.connection.request(
      "textDocument/formatting",
      { textDocument: { uri: this.#context.uriOf(entry.doc.path) }, options },
      timeoutMs,
    );
  }

  push(params: unknown): void {
    const parsed = parseWith(PUBLISH_DIAGNOSTICS, params);
    if (!parsed.ok) {
      this.#context.log(`Dropped malformed problems from the server: ${parsed.reason}`);
      return;
    }
    const { uri, version, diagnostics } = parsed.value;
    const on = [...this.#docs.values()].find((candidate) => sameFile(candidate.uri, uri));
    if (on === undefined) {
      return;
    }
    const shown = version ?? on.version;
    if (!isDocVersion(shown) || shown > on.version) {
      this.#context.log(`Dropped problems for a version yamt never sent: ${shown}`);
      return;
    }
    this.#show(on, shown, diagnostics.map(toProblem));
  }

  pullAll(): void {
    if (this.#context.capabilities.pulls) {
      for (const on of this.#docs.values()) {
        void this.#pull(on);
      }
    }
  }

  async #pull(on: OnServer): Promise<void> {
    if (on.pulling) {
      on.again = true;
      return;
    }
    on.pulling = true;
    const version = on.version;
    const reply = await this.#context.connection.request(
      "textDocument/diagnostic",
      {
        textDocument: { uri: on.uri },
        ...(on.resultId === null ? {} : { previousResultId: on.resultId }),
      },
      PULL_TIMEOUT_MS,
    );
    on.pulling = false;
    if (this.#docs.get(on.entry) === on) {
      this.#pulled(on, version, reply);
      this.#pullIfAsked(on);
    }
  }

  #pullIfAsked(on: OnServer): void {
    const again = on.again;
    on.again = false;
    if (again) {
      void this.#pull(on);
    }
  }

  #pulled(on: OnServer, version: DocVersion, reply: Reply): void {
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
    on.resultId = report.resultId ?? null;
    if (report.kind === "full") {
      on.items = report.items.map(toProblem);
    }
    this.#show(on, version, on.items);
  }

  #show(on: OnServer, version: DocVersion, problems: readonly ServerProblem[]): void {
    on.entry.doc.showProblems(this.#context.name, version, problems);
  }
}
