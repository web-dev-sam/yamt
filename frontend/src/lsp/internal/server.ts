import type { ServerHost } from "../../ipc";
import { Attempt } from "./attempt";
import type { DocEntry } from "./documents";
import {
  capabilitiesOf,
  initializeParams,
  INITIALIZE_TIMEOUT_MS,
  projectFolder,
  type HostContext,
  type ReadyContext,
} from "./handshake";
import { sameValue } from "./json";
import type { LogLine } from "./log";
import { stateOf, STOPPED, type Halting, type Run, type Running } from "./run";
import { ServerDocs } from "./serverDocs";
import { serves, type ServerSpec } from "./spec";
import { failText, stateAtRest, startFailure, type ServerState, type StartFailure } from "./state";
import type { Timers } from "./timers";
import { fileUri } from "./uri";

export type ServerEnv = {
  readonly host: ServerHost | null;
  readonly timers: Timers;
  readonly context: (host: ServerHost) => Promise<HostContext>;
  readonly documents: () => readonly DocEntry[];
  readonly log: (name: string, source: LogLine["source"], text: string) => void;
  readonly changed: () => void;
};

const DISPLAY_ONLY: Pick<ServerSpec, "help" | "notes"> = { help: null, notes: [] };

export class Server {
  userStopped: boolean;
  readonly #env: ServerEnv;
  #spec: ServerSpec;
  #run: Run;
  #settled: (() => void)[] = [];

  constructor(spec: ServerSpec, env: ServerEnv, userStopped: boolean) {
    this.#spec = spec;
    this.userStopped = userStopped;
    this.#env = env;
    this.#run = { kind: "idle", attempt: null, state: stateAtRest(spec, env.host !== null) };
  }

  get spec(): ServerSpec {
    return this.#spec;
  }

  runsAs(spec: ServerSpec): boolean {
    return sameValue({ ...this.#spec, ...DISPLAY_ONLY }, { ...spec, ...DISPLAY_ONLY });
  }

  takeDisplay({ help, notes }: ServerSpec): void {
    this.#spec = { ...this.#spec, help, notes };
  }

  get state(): ServerState {
    return stateOf(this.#run);
  }

  get running(): Running | null {
    return this.#run.kind === "running" ? this.#run : null;
  }

  serves(path: string): boolean {
    return serves(this.spec, path);
  }

  settled(): Promise<void> {
    if (this.state.kind !== "starting") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#settled.push(resolve);
    });
  }

  start(): void {
    this.userStopped = false;
    this.#startWhenIdle();
  }

  stop(): Promise<void> {
    this.userStopped = true;
    return this.halt();
  }

  restart(): void {
    this.userStopped = false;
    void this.halt();
    this.#startWhenIdle();
  }

  halt(): Promise<void> {
    const run = this.#run;
    switch (run.kind) {
      case "idle":
        return Promise.resolve();
      case "launching":
        this.#setRun(STOPPED);
        return Promise.resolve();
      case "starting":
        return this.#halt(run.attempt, null);
      case "running":
        return this.#halt(run.attempt, run.docs);
      case "halting":
        run.startAfter = false;
        return run.done;
      default: {
        const _exhaustive: never = run;
        return _exhaustive;
      }
    }
  }

  #halt(attempt: Attempt, docs: ServerDocs | null): Promise<void> {
    docs?.closeAll();
    const stopped = attempt.stop(docs !== null);
    const halting: Halting = {
      kind: "halting",
      attempt: null,
      done: stopped.then(() => this.#halted(halting)),
      startAfter: false,
    };
    this.#setRun(halting);
    return halting.done;
  }

  #halted(halting: Halting): void {
    this.#setRun(STOPPED);
    if (halting.startAfter) {
      this.#startWhenIdle();
    }
  }

  #startWhenIdle(): void {
    const run = this.#run;
    const host = this.#env.host;
    if (run.kind === "halting") {
      run.startAfter = true;
    } else if (run.kind === "idle" && host !== null && this.spec.install === null) {
      void this.#launch(host);
    }
  }

  async #launch(host: ServerHost): Promise<void> {
    const launching: Run = { kind: "launching", attempt: null };
    this.#setRun(launching);
    const { program, args } = this.spec.command;
    const where = this.spec.project === "" ? "the repository root" : this.spec.project;
    this.#log("yamt", `Starting ${[program, ...args].join(" ")} in ${where}`);
    const context = await this.#env.context(host);
    if (this.#run !== launching) {
      return;
    }
    if (context.kind !== "ready") {
      this.#fail({ kind: "initializeFailed", message: context.message }, null);
      return;
    }
    await this.#startAttempt(host, context);
  }

  async #startAttempt(host: ServerHost, context: ReadyContext): Promise<void> {
    const attempt = this.#createAttempt(host, context);
    this.#setRun({ kind: "starting", attempt });
    const { program, args } = this.spec.command;
    const { project, folders } = this.spec;
    const reply = await attempt.start({ program, args, project, folders });
    if (this.#run.attempt !== attempt) {
      return;
    }
    if (reply.kind === "Started") {
      await this.#initialize(attempt, context);
    } else {
      this.#fail(startFailure(reply), attempt);
    }
  }

  #createAttempt(host: ServerHost, context: ReadyContext): Attempt {
    const attempt: Attempt = new Attempt({
      host,
      timers: this.#env.timers,
      answers: { settings: this.spec.settings, folder: projectFolder(this.spec, context.root) },
      events: {
        log: (source, text) => this.#log(source, text),
        exited: (code) => this.#exited(attempt, code),
        docs: () => {
          const running = this.running;
          return running?.attempt === attempt ? running.docs : null;
        },
      },
    });
    return attempt;
  }

  async #initialize(attempt: Attempt, context: ReadyContext): Promise<void> {
    const params = initializeParams(this.spec, context);
    const reply = await attempt.connection.request("initialize", params, INITIALIZE_TIMEOUT_MS);
    if (this.#run.attempt !== attempt) {
      return;
    }
    if (reply.kind !== "result") {
      const failure: StartFailure =
        reply.kind === "error"
          ? { kind: "initializeFailed", message: reply.message }
          : { kind: "timedOut" };
      this.#fail(failure, attempt);
      return;
    }
    const capabilities = capabilitiesOf(reply.value);
    if (!capabilities.ok) {
      this.#fail({ kind: "initializeFailed", message: capabilities.reason }, attempt);
      return;
    }
    attempt.connection.notify("initialized", {});
    attempt.connection.notify("workspace/didChangeConfiguration", { settings: this.spec.settings });
    const docs = new ServerDocs({
      name: this.spec.name,
      connection: attempt.connection,
      pulls: capabilities.value.pulls,
      uriOf: (path) => fileUri(context.root, path),
      log: (text) => this.#log("yamt", text),
    });
    this.#env
      .documents()
      .filter((entry) => this.serves(entry.doc.path))
      .forEach((entry) => docs.open(entry));
    this.#setRun({ kind: "running", attempt, docs, capabilities: capabilities.value });
  }

  #exited(attempt: Attempt, code: number | null): void {
    if (this.#run.attempt === attempt) {
      this.running?.docs.closeAll();
      this.#setRun({ kind: "idle", attempt: null, state: { kind: "crashed", code } });
    }
  }

  #fail(reason: StartFailure, attempt: Attempt | null): void {
    this.#log("yamt", failText(reason));
    this.#setRun({ kind: "idle", attempt: null, state: { kind: "failed", reason } });
    void attempt?.stop(false);
  }

  #setRun(run: Run): void {
    this.#run = run;
    if (this.state.kind !== "starting") {
      const waiting = this.#settled;
      this.#settled = [];
      waiting.forEach((resolve) => resolve());
    }
    this.#env.changed();
  }

  #log(source: LogLine["source"], text: string): void {
    this.#env.log(this.spec.name, source, text);
  }
}
