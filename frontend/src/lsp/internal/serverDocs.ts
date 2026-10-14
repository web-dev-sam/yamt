import type { Connection } from "./connection";
import type { DocEntry, Sent } from "./documents";
import { languageId } from "./languageIds";
import { DocProblems } from "./problems";

export type ServerDocsContext = {
  readonly name: string;
  readonly connection: Connection;
  readonly pulls: boolean;
  readonly uriOf: (path: string) => string;
  readonly log: (text: string) => void;
};

export class ServerDocs {
  readonly #context: ServerDocsContext;
  readonly #docs = new Map<DocEntry, DocProblems>();

  constructor(context: ServerDocsContext) {
    this.#context = context;
  }

  has(entry: DocEntry): boolean {
    return this.#docs.has(entry);
  }

  uriOf(entry: DocEntry): string | null {
    return this.#docs.get(entry)?.uri ?? null;
  }

  problems(): readonly DocProblems[] {
    return [...this.#docs.values()];
  }

  open(entry: DocEntry): void {
    const { name, connection, pulls, log } = this.#context;
    const sent = entry.current();
    const uri = this.#context.uriOf(entry.doc.path);
    const problems = new DocProblems(
      {
        show: (version, items) => entry.doc.showProblems(name, version, items),
        uri,
        connection,
        pulls,
        log,
      },
      sent.version,
    );
    this.#docs.set(entry, problems);
    connection.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: languageId(entry.doc.path),
        version: sent.version,
        text: sent.text,
      },
    });
    this.pullAll();
  }

  change(entry: DocEntry, sent: Sent): void {
    const problems = this.#docs.get(entry);
    if (problems === undefined) {
      return;
    }
    problems.sent(sent.version);
    this.#context.connection.notify("textDocument/didChange", {
      textDocument: { uri: problems.uri, version: sent.version },
      contentChanges: [{ text: sent.text }],
    });
    this.pullAll();
  }

  close(entry: DocEntry): void {
    const problems = this.#docs.get(entry);
    if (problems !== undefined) {
      problems.close();
      this.#docs.delete(entry);
      this.#context.connection.notify("textDocument/didClose", {
        textDocument: { uri: problems.uri },
      });
    }
  }

  closeAll(): void {
    for (const [entry, problems] of this.#docs) {
      problems.clear();
      this.close(entry);
    }
  }

  pullAll(): void {
    for (const problems of this.#docs.values()) {
      void problems.pull();
    }
  }
}
