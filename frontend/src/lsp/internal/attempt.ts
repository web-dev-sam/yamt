import type { RunId, ServerHost } from "../../ipc";
import type { WorkspaceFolder } from "./answers";
import type { Connection } from "./connection";
import type { ServerDocs } from "./serverDocs";

export class Attempt {
  readonly host: ServerHost;
  readonly connection: Connection;
  readonly started: Promise<RunId | null>;
  readonly exited: Promise<void>;
  run: RunId | null = null;
  hasExited = false;
  docs: ServerDocs | null = null;
  folder: WorkspaceFolder | null = null;
  #resolveStarted: (run: RunId | null) => void = () => undefined;
  #resolveExited: () => void = () => undefined;

  constructor(host: ServerHost, connect: (attempt: Attempt) => Connection) {
    this.host = host;
    this.started = new Promise((resolve) => {
      this.#resolveStarted = resolve;
    });
    this.exited = new Promise((resolve) => {
      this.#resolveExited = resolve;
    });
    this.connection = connect(this);
  }

  send(text: string): void {
    if (this.run !== null) {
      this.host.send(this.run, text);
    }
  }

  markStarted(run: RunId | null): void {
    this.run = run;
    this.#resolveStarted(run);
  }

  markExited(): void {
    this.hasExited = true;
    this.#resolveExited();
  }
}
