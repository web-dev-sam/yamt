import type { HostEvent, RunId, ServerCommand, ServerHost, StartReply } from "../../ipc";
import { Connection, parseWith, type Answer, type Timers } from "../../jsonrpc";
import { answer, type AnswerContext } from "./answers";
import type { LogLine } from "./log";
import { pushProblems } from "./problems";
import { MESSAGE_PARAMS } from "./protocol";
import type { ServerDocs } from "./serverDocs";

const SHUTDOWN_TIMEOUT_MS = 2000;

const SERVER_MESSAGES: Readonly<Record<string, true>> = {
  "window/logMessage": true,
  "window/showMessage": true,
};

export type AttemptEvents = {
  readonly log: (source: LogLine["source"], text: string) => void;
  readonly exited: (code: number | null) => void;
  readonly docs: () => ServerDocs | null;
};

export type AttemptSetup = {
  readonly host: ServerHost;
  readonly timers: Timers;
  readonly answers: AnswerContext;
  readonly events: AttemptEvents;
};

export class Attempt {
  readonly connection: Connection;
  readonly #host: ServerHost;
  readonly #answers: AnswerContext;
  readonly #events: AttemptEvents;
  readonly #started: Promise<RunId | null>;
  readonly #exited: Promise<void>;
  #resolveStarted: (run: RunId | null) => void = () => undefined;
  #resolveExited: () => void = () => undefined;
  #run: RunId | null = null;
  #hasExited = false;

  constructor(setup: AttemptSetup) {
    this.#host = setup.host;
    this.#answers = setup.answers;
    this.#events = setup.events;
    this.#started = new Promise((resolve) => {
      this.#resolveStarted = resolve;
    });
    this.#exited = new Promise((resolve) => {
      this.#resolveExited = resolve;
    });
    this.connection = new Connection(
      {
        send: (text) => this.#send(text),
        request: (method, params) => this.#answer(method, params),
        notification: (method, params) => this.#notified(method, params),
        log: (text) => this.#events.log("yamt", text),
      },
      setup.timers,
      { cancelNotification: "$/cancelRequest" },
    );
  }

  async start(command: ServerCommand): Promise<StartReply> {
    const reply = await this.#spawn(command);
    this.#run = reply.kind === "Started" ? reply.run : null;
    this.#resolveStarted(this.#run);
    return reply;
  }

  async stop(shutdown: boolean): Promise<void> {
    const run = await this.#started;
    if (shutdown && !this.#hasExited) {
      await this.connection.request("shutdown", undefined, SHUTDOWN_TIMEOUT_MS);
      this.connection.notify("exit", undefined);
    }
    if (run !== null && !this.#hasExited) {
      await this.#host.stop(run).catch((error: unknown) => {
        this.#events.log("yamt", `Could not stop the server: ${String(error)}`);
      });
    }
    if (run !== null) {
      await this.#exited;
    }
  }

  async #spawn(command: ServerCommand): Promise<StartReply> {
    try {
      return await this.#host.start(command, (event) => this.#onEvent(event));
    } catch (error) {
      return { kind: "SpawnFailed", program: command.program, message: String(error) };
    }
  }

  #send(text: string): void {
    if (this.#run !== null) {
      this.#host.send(this.#run, text);
    }
  }

  #answer(method: string, params: unknown): Answer {
    if (method === "workspace/diagnostic/refresh") {
      queueMicrotask(() => this.#events.docs()?.pullAll());
    }
    return answer(method, params, this.#answers);
  }

  #notified(method: string, params: unknown): void {
    if (method === "textDocument/publishDiagnostics") {
      const docs = this.#events.docs();
      if (docs !== null) {
        pushProblems(params, docs.problems(), (text) => this.#events.log("yamt", text));
      }
    } else if (Object.hasOwn(SERVER_MESSAGES, method)) {
      const parsed = parseWith(MESSAGE_PARAMS, params);
      this.#events.log("server", parsed.ok ? parsed.value.message : `${method}: ${parsed.reason}`);
    }
  }

  #onEvent(event: HostEvent): void {
    switch (event.kind) {
      case "Message":
        this.connection.receive(event.text);
        return;
      case "Log":
        this.#events.log("stderr", event.line);
        return;
      case "Exited":
        this.#ended(event.code);
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }

  #ended(code: number | null): void {
    this.#events.log("yamt", code === null ? "Exited without a code" : `Exited with code ${code}`);
    this.#hasExited = true;
    this.connection.close();
    this.#resolveExited();
    this.#events.exited(code);
  }
}
