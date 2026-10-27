import {
  log,
  type AgentCommand,
  type AgentRun,
  type AgentSource,
  type CheckoutFolder,
  type HostEvent,
} from "../../ipc";
import { Connection, parseWith, type Answer, type Reply, type Timers } from "../../jsonrpc";
import { answerRequest } from "./answers";
import { loadFailure, requestFailure, startFailure, type AgentFailure, type Exit } from "./failure";
import { INITIALIZE_RESULT, parseUpdate, PROTOCOL_VERSION } from "./protocol";
import type { AgentSessionId } from "./session";
import type { Refusal, TurnUpdate } from "./turn";

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: AgentFailure };

export type Listener = {
  readonly update: (update: TurnUpdate) => void;
  readonly refuse: (refusal: Refusal) => void;
};

export type ProcessStart = {
  readonly source: AgentSource;
  readonly command: AgentCommand;
  readonly folder: CheckoutFolder;
  readonly timers: Timers;
  readonly exited: () => void;
};

const INITIALIZE_PARAMS = {
  protocolVersion: PROTOCOL_VERSION,
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
  clientInfo: { name: "yamt" },
};

/** One `omp acp` process: its connection, the sessions it has loaded, updates routed by session. */
export class AgentProcess {
  readonly folder: CheckoutFolder;
  readonly #source: AgentSource;
  readonly #connection: Connection;
  readonly #exited: () => void;
  readonly #listeners = new Map<AgentSessionId, Listener>();
  readonly #loads = new Map<AgentSessionId, Promise<AgentFailure | null>>();
  #run: AgentRun | null = null;
  #lastLog: string | null = null;
  #exit: Exit | null = null;
  #stopping = false;

  private constructor(start: ProcessStart) {
    this.folder = start.folder;
    this.#source = start.source;
    this.#exited = start.exited;
    this.#connection = new Connection(
      {
        send: (text) => this.#send(text),
        request: (method, params) => this.#answer(method, params),
        notification: (method, params) => this.#notified(method, params),
        log: (text) => log.info("agent.connection", { text }),
      },
      start.timers,
      { cancelNotification: null },
    );
  }

  static async start(start: ProcessStart): Promise<Outcome<AgentProcess>> {
    const agent = new AgentProcess(start);
    const spawned = await agent.#spawn(start.command);
    if (!spawned.ok) {
      return spawned;
    }
    agent.#run = spawned.value;
    const failure = await agent.#initialize();
    return failure === null ? { ok: true, value: agent } : { ok: false, failure };
  }

  get exit(): Exit | null {
    return this.#exit;
  }

  request(method: string, params: unknown): Promise<Reply> {
    return this.#connection.requestUntilAnswered(method, params);
  }

  cancel(session: AgentSessionId): void {
    this.#connection.notify("session/cancel", { sessionId: session });
  }

  listen(session: AgentSessionId, listener: Listener): () => void {
    this.#listeners.set(session, listener);
    return () => {
      if (this.#listeners.get(session) === listener) {
        this.#listeners.delete(session);
      }
    };
  }

  created(session: AgentSessionId): void {
    this.#loads.set(session, Promise.resolve(null));
  }

  /** Loads the session once per process before a prompt (joining a load in flight); no one hears its replay. */
  load(session: AgentSessionId): Promise<AgentFailure | null> {
    return this.#loads.get(session) ?? this.#sendLoad(session);
  }

  /** Loads the session and hands back its replay; a `load` meanwhile joins this one. */
  async replay(session: AgentSessionId): Promise<Outcome<TurnUpdate[]>> {
    const updates: TurnUpdate[] = [];
    const unlisten = this.listen(session, {
      update: (update) => updates.push(update),
      refuse: () => undefined,
    });
    const failure = await this.#sendLoad(session);
    unlisten();
    return failure === null ? { ok: true, value: updates } : { ok: false, failure };
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#run !== null && this.#exit === null) {
      await this.#source.stopAgent(this.#run);
    }
  }

  async #spawn(command: AgentCommand): Promise<Outcome<AgentRun>> {
    const { program } = command;
    try {
      const reply = await this.#source.startAgent(command, (event) => this.#onEvent(event));
      if (!reply.ok) {
        return { ok: false, failure: { kind: "app", failure: reply.failure } };
      }
      const started = reply.value;
      return started.kind === "Started"
        ? { ok: true, value: started.run }
        : { ok: false, failure: startFailure(started) };
    } catch (error) {
      return { ok: false, failure: { kind: "spawnFailed", program, message: String(error) } };
    }
  }

  #sendLoad(session: AgentSessionId): Promise<AgentFailure | null> {
    const params = { sessionId: session, cwd: this.folder, mcpServers: [] };
    const loading = this.request("session/load", params).then((reply) => {
      if (reply.kind === "result") {
        return null;
      }
      if (this.#loads.get(session) === loading) {
        this.#loads.delete(session);
      }
      return loadFailure(reply, this.#exit);
    });
    this.#loads.set(session, loading);
    return loading;
  }

  async #initialize(): Promise<AgentFailure | null> {
    const reply = await this.request("initialize", INITIALIZE_PARAMS);
    if (reply.kind !== "result") {
      return requestFailure("initialize", reply, this.#exit);
    }
    const parsed = parseWith(INITIALIZE_RESULT, reply.value);
    if (parsed.ok && parsed.value.protocolVersion === PROTOCOL_VERSION) {
      return null;
    }
    void this.stop();
    const found = parsed.ok ? `protocol version ${parsed.value.protocolVersion}` : parsed.reason;
    return {
      kind: "refused",
      method: "initialize",
      message: `${found}; yamt speaks ${PROTOCOL_VERSION}`,
    };
  }

  #send(text: string): void {
    if (this.#run !== null) {
      this.#source.sendToAgent(this.#run, text);
    }
  }

  #answer(method: string, params: unknown): Answer {
    const { answer, refused } = answerRequest(method, params, this.folder);
    if (refused !== null) {
      this.#listeners.get(refused.session)?.refuse(refused.refusal);
    }
    return answer;
  }

  #notified(method: string, params: unknown): void {
    if (method !== "session/update") {
      return;
    }
    const parsed = parseUpdate(params, this.folder);
    if (!parsed.ok) {
      log.warn("agent.update_dropped", { reason: parsed.reason });
    } else if (parsed.value.update !== null) {
      this.#listeners.get(parsed.value.session)?.update(parsed.value.update);
    }
  }

  #onEvent(event: HostEvent): void {
    switch (event.kind) {
      case "Message":
        this.#connection.receive(event.text);
        return;
      case "Log":
        this.#lastLog = event.line;
        log.debug("agent.stderr", { line: event.line });
        return;
      case "Exited":
        this.#exit = { code: event.code, lastLog: this.#lastLog };
        log.info("agent.exited", { code: event.code ?? "none", stopping: this.#stopping });
        this.#connection.close();
        this.#exited();
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }
}
