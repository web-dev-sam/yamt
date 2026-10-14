import type { HostEvent, ServerHost, StartReply } from "../../ipc";
import { answer, type Answer } from "./answers";
import { Attempt } from "./attempt";
import { Connection } from "./connection";
import type { DocEntry } from "./documents";
import {
  capabilitiesOf,
  initializeParams,
  INITIALIZE_TIMEOUT_MS,
  projectFolder,
  type HostContext,
  type ReadyContext,
} from "./handshake";
import type { LogLine } from "./log";
import { parseWith } from "./messages";
import { MESSAGE_PARAMS } from "./protocol";
import { ServerDocs } from "./serverDocs";
import { serves, type ServerSpec } from "./spec";
import { failText, stateAtRest, startFailure, type ServerState, type StartFailure } from "./state";
import type { Timers } from "./timers";
import { fileUri } from "./uri";

const SHUTDOWN_TIMEOUT_MS = 2000;

export type ServerEnv = {
  readonly host: ServerHost | null;
  readonly timers: Timers;
  readonly context: (host: ServerHost) => Promise<HostContext>;
  readonly documents: () => readonly DocEntry[];
  readonly log: (name: string, source: LogLine["source"], text: string) => void;
  readonly changed: () => void;
};

const SERVER_MESSAGES: Readonly<Record<string, true>> = {
  "window/logMessage": true,
  "window/showMessage": true,
};

export class Server {
  readonly spec: ServerSpec;
  userStopped: boolean;
  readonly #env: ServerEnv;
  #state: ServerState;
  #attempt: Attempt | null = null;
  #halting: Promise<void> | null = null;
  #settled: (() => void)[] = [];

  constructor(spec: ServerSpec, env: ServerEnv, userStopped: boolean) {
    this.spec = spec;
    this.userStopped = userStopped;
    this.#env = env;
    this.#state = stateAtRest(spec, env.host !== null);
  }

  get state(): ServerState {
    return this.#state;
  }

  get docs(): ServerDocs | null {
    return this.#attempt?.docs ?? null;
  }

  serves(path: string): boolean {
    return serves(this.spec, path);
  }

  settled(): Promise<void> {
    if (this.#state.kind !== "starting") {
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
    const attempt = this.#attempt;
    if (attempt === null) {
      return this.#halting ?? Promise.resolve();
    }
    this.#attempt = null;
    this.#setState({ kind: "stopping" });
    const halting = this.#release(attempt).then(() => {
      this.#halting = null;
      this.#setState({ kind: "stopped" });
    });
    this.#halting = halting;
    return halting;
  }

  #startWhenIdle(): void {
    const host = this.#env.host;
    if (this.#halting !== null) {
      void this.#halting.then(() => this.#startWhenIdle());
    } else if (this.#attempt === null && host !== null && this.spec.install === null) {
      void this.#launch(host);
    }
  }

  async #launch(host: ServerHost): Promise<void> {
    const attempt = new Attempt(host, (self) => this.#connect(self));
    this.#attempt = attempt;
    this.#setState({ kind: "starting" });
    const { program, args } = this.spec.command;
    const where = this.spec.project === "" ? "the repository root" : this.spec.project;
    this.#log("yamt", `Starting ${[program, ...args].join(" ")} in ${where}`);
    const context = await this.#env.context(host);
    if (this.#attempt !== attempt) {
      attempt.markStarted(null);
      return;
    }
    if (context.kind !== "ready") {
      attempt.markStarted(null);
      this.#fail(attempt, { kind: "initializeFailed", message: context.message });
      return;
    }
    attempt.folder = projectFolder(this.spec, context.root);
    const reply = await this.#spawn(attempt);
    attempt.markStarted(reply.kind === "Started" ? reply.run : null);
    if (this.#attempt !== attempt) {
      return;
    }
    if (reply.kind === "Started") {
      await this.#initialize(attempt, context);
    } else {
      this.#fail(attempt, startFailure(reply));
    }
  }

  async #spawn(attempt: Attempt): Promise<StartReply> {
    const { program, args } = this.spec.command;
    try {
      return await attempt.host.start({ program, args, project: this.spec.project }, (event) =>
        this.#onEvent(attempt, event),
      );
    } catch (error) {
      return { kind: "SpawnFailed", program, message: String(error) };
    }
  }

  async #initialize(attempt: Attempt, context: ReadyContext): Promise<void> {
    const params = initializeParams(this.spec, context);
    const reply = await attempt.connection.request("initialize", params, INITIALIZE_TIMEOUT_MS);
    if (this.#attempt !== attempt || reply.kind === "closed") {
      return;
    }
    if (reply.kind !== "result") {
      const message = reply.kind === "error" ? reply.message : null;
      this.#fail(
        attempt,
        message === null ? { kind: "timedOut" } : { kind: "initializeFailed", message },
      );
      return;
    }
    const capabilities = capabilitiesOf(reply.value);
    if (!capabilities.ok) {
      this.#fail(attempt, { kind: "initializeFailed", message: capabilities.reason });
      return;
    }
    attempt.connection.notify("initialized", {});
    attempt.connection.notify("workspace/didChangeConfiguration", { settings: this.spec.settings });
    const docs = new ServerDocs({
      name: this.spec.name,
      connection: attempt.connection,
      capabilities: capabilities.value,
      uriOf: (path) => fileUri(context.root, path),
      log: (text) => this.#log("yamt", text),
    });
    attempt.docs = docs;
    this.#setState({ kind: "running" });
    this.#env
      .documents()
      .filter((entry) => this.serves(entry.doc.path))
      .forEach((entry) => docs.open(entry));
  }

  #connect(attempt: Attempt): Connection {
    return new Connection(
      {
        send: (text) => attempt.send(text),
        request: (method, params) => this.#answer(attempt, method, params),
        notification: (method, params) => this.#notified(attempt, method, params),
        log: (text) => this.#log("yamt", text),
      },
      this.#env.timers,
    );
  }

  #answer(attempt: Attempt, method: string, params: unknown): Answer {
    if (method === "workspace/diagnostic/refresh") {
      queueMicrotask(() => attempt.docs?.pullAll());
    }
    return answer(method, params, { settings: this.spec.settings, folder: attempt.folder });
  }

  #notified(attempt: Attempt, method: string, params: unknown): void {
    if (method === "textDocument/publishDiagnostics") {
      attempt.docs?.push(params);
    } else if (Object.hasOwn(SERVER_MESSAGES, method)) {
      const parsed = parseWith(MESSAGE_PARAMS, params);
      this.#log("server", parsed.ok ? parsed.value.message : `${method}: ${parsed.reason}`);
    }
  }

  #onEvent(attempt: Attempt, event: HostEvent): void {
    switch (event.kind) {
      case "Message":
        attempt.connection.receive(event.text);
        return;
      case "Log":
        this.#log("stderr", event.line);
        return;
      case "Exited":
        this.#exited(attempt, event.code);
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  #exited(attempt: Attempt, code: number | null): void {
    this.#log("yamt", code === null ? "Exited without a code" : `Exited with code ${code}`);
    attempt.markExited();
    if (this.#attempt === attempt) {
      this.#attempt = null;
      attempt.connection.close();
      attempt.docs?.closeAll();
      this.#setState({ kind: "crashed", code });
    }
  }

  #fail(attempt: Attempt, reason: StartFailure): void {
    this.#log("yamt", failText(reason, INITIALIZE_TIMEOUT_MS));
    this.#attempt = null;
    this.#setState({ kind: "failed", reason });
    void this.#release(attempt);
  }

  async #release(attempt: Attempt): Promise<void> {
    const docs = attempt.docs;
    docs?.closeAll();
    const run = await attempt.started;
    if (docs !== null && !attempt.hasExited) {
      await attempt.connection.request("shutdown", undefined, SHUTDOWN_TIMEOUT_MS);
      attempt.connection.notify("exit", undefined);
    }
    if (run !== null && !attempt.hasExited) {
      await attempt.host.stop(run).catch((error: unknown) => {
        this.#log("yamt", `Could not stop the server: ${String(error)}`);
      });
    }
    if (run !== null) {
      await attempt.exited;
    }
    attempt.connection.close();
  }

  #setState(state: ServerState): void {
    this.#state = state;
    const waiting = this.#settled;
    this.#settled = [];
    waiting.forEach((resolve) => resolve());
    this.#env.changed();
  }

  #log(source: LogLine["source"], text: string): void {
    this.#env.log(this.spec.name, source, text);
  }
}
