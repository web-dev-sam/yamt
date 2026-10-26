import type { AgentSource, CheckoutFolder, Difference } from "../ipc";
import { parseWith, SYSTEM_TIMERS, type Reply, type Timers } from "../jsonrpc";
import { agentCommand } from "./internal/command";
import { replayTurns } from "./internal/conversation";
import { requestFailure, sourceText, type AgentFailure } from "./internal/failure";
import { AgentProcess, type Outcome } from "./internal/process";
import { NEW_SESSION_RESULT, PROMPT_RESULT } from "./internal/protocol";
import {
  agentSessionId,
  stopEnding,
  TurnRun,
  type AgentSessionId,
  type Ending,
  type TurnEnd,
  type TurnEvents,
} from "./internal/session";
import type { FileEdit, TurnView } from "./internal/turn";

export type { AgentFailure } from "./internal/failure";
export type { AgentSessionId, TurnEnd, TurnEvents } from "./internal/session";
export type {
  FileEdit,
  Step,
  StepKind,
  StepOutput,
  StepStatus,
  TurnEntry,
  TurnView,
} from "./internal/turn";
export { agentSessionId } from "./internal/session";
export {
  DEFAULT_FIRST_MESSAGE,
  firstMessage,
  PLACEHOLDERS,
  unknownPlaceholders,
  type Placeholder,
} from "./internal/firstMessage";
export { DEFAULT_AGENT_COMMAND } from "./internal/command";

export type AskRequest = { readonly session: AgentSessionId | null; readonly text: string };

export interface RunningTurn {
  readonly ended: Promise<TurnEnd>;
  /** Sends `session/cancel` once the prompt is out; before that, the turn ends without prompting. */
  stop(): void;
}

export type ConversationLoad =
  | { readonly kind: "loaded"; readonly turns: readonly TurnView[] }
  | { readonly kind: "failed"; readonly failure: AgentFailure };

export type EditDiff =
  | { readonly kind: "differences"; readonly differences: readonly Difference[] }
  | { readonly kind: "tooLarge"; readonly limit: number }
  | { readonly kind: "failed"; readonly message: string };

export type AgentSetup = {
  readonly source: AgentSource;
  readonly command: () => readonly string[];
  readonly timers?: Timers;
};

type Asking = {
  stopped: boolean;
  prompted: { readonly agent: AgentProcess; readonly session: AgentSessionId } | null;
};

/** The window's one agent: the checkout made and the process started at the first ask. */
export class AgentClient {
  readonly #source: AgentSource;
  readonly #command: () => readonly string[];
  readonly #timers: Timers;
  readonly #running = new Set<TurnRun>();
  readonly #bySession = new Map<AgentSessionId, TurnRun>();
  #checkout: Promise<Outcome<CheckoutFolder>> | null = null;
  #agent: Promise<Outcome<AgentProcess>> | null = null;
  #destroyed = false;

  constructor(setup: AgentSetup) {
    this.#source = setup.source;
    this.#command = setup.command;
    this.#timers = setup.timers ?? SYSTEM_TIMERS;
  }

  ask(request: AskRequest, events: TurnEvents): RunningTurn {
    const run = new TurnRun(events, this.#timers);
    const { session } = request;
    if (session !== null && this.#bySession.has(session)) {
      run.end({ kind: "failed", failure: { kind: "busy" } });
      return { ended: run.ended, stop: () => undefined };
    }
    if (this.#destroyed) {
      run.end({ kind: "stopped" });
      return { ended: run.ended, stop: () => undefined };
    }
    const asking: Asking = { stopped: false, prompted: null };
    this.#running.add(run);
    if (session !== null) {
      this.#bySession.set(session, run);
    }
    void this.#turn(run, request, asking).finally(() => this.#forget(run));
    return {
      ended: run.ended,
      stop: () => {
        asking.stopped = true;
        asking.prompted?.agent.cancel(asking.prompted.session);
      },
    };
  }

  async loadConversation(session: AgentSessionId): Promise<ConversationLoad> {
    if (this.#bySession.has(session)) {
      return { kind: "failed", failure: { kind: "busy" } };
    }
    const agent = await this.#ready();
    if (!agent.ok) {
      return { kind: "failed", failure: agent.failure };
    }
    const replay = await agent.value.replay(session);
    return replay.ok
      ? { kind: "loaded", turns: replayTurns(replay.value) }
      : { kind: "failed", failure: replay.failure };
  }

  async editDiff(edit: FileEdit): Promise<EditDiff> {
    try {
      const result = await this.#source.diffTexts(edit.oldText ?? "", edit.newText);
      if (result.ok) {
        return { kind: "differences", differences: result.value };
      }
      const { failure } = result;
      return failure.kind === "ColumnTooLarge"
        ? { kind: "tooLarge", limit: failure.limit }
        : { kind: "failed", message: sourceText(failure) };
    } catch (error) {
      return { kind: "failed", message: String(error) };
    }
  }

  /** Whether any turn is running. */
  isRunning(): boolean {
    return this.#running.size > 0;
  }

  /** Stops the process; running turns end stopped. */
  destroy(): void {
    this.#destroyed = true;
    void this.#agent?.then((agent) => (agent.ok ? agent.value.stop() : undefined));
  }

  async #turn(run: TurnRun, request: AskRequest, asking: Asking): Promise<void> {
    const agent = await this.#ready();
    if (!agent.ok) {
      run.end(this.#failed(agent.failure));
      return;
    }
    const session = await this.#session(agent.value, request.session, run);
    if (!session.ok) {
      run.end(this.#failed(session.failure));
      return;
    }
    const unlisten = agent.value.listen(session.value, run);
    if (asking.stopped || this.#destroyed) {
      unlisten();
      run.end({ kind: "stopped" });
      return;
    }
    asking.prompted = { agent: agent.value, session: session.value };
    const prompt = [{ type: "text", text: request.text }];
    const reply = await agent.value.request("session/prompt", { sessionId: session.value, prompt });
    unlisten();
    run.end(this.#promptEnding(agent.value, reply));
  }

  async #session(
    agent: AgentProcess,
    session: AgentSessionId | null,
    run: TurnRun,
  ): Promise<Outcome<AgentSessionId>> {
    if (session !== null) {
      const failure = await agent.load(session);
      return failure === null ? { ok: true, value: session } : { ok: false, failure };
    }
    const reply = await agent.request("session/new", { cwd: agent.folder, mcpServers: [] });
    if (reply.kind !== "result") {
      return { ok: false, failure: requestFailure("session/new", reply, agent.exit) };
    }
    const parsed = parseWith(NEW_SESSION_RESULT, reply.value);
    const created = parsed.ok ? agentSessionId(parsed.value.sessionId) : null;
    if (created === null) {
      const message = parsed.ok ? "an empty session id" : parsed.reason;
      return { ok: false, failure: { kind: "refused", method: "session/new", message } };
    }
    agent.created(created);
    this.#bySession.set(created, run);
    run.session(created);
    return { ok: true, value: created };
  }

  #promptEnding(agent: AgentProcess, reply: Reply): Ending {
    if (reply.kind === "result") {
      const parsed = parseWith(PROMPT_RESULT, reply.value);
      return parsed.ok
        ? stopEnding(parsed.value.stopReason)
        : this.#failed({ kind: "refused", method: "session/prompt", message: parsed.reason });
    }
    if (reply.kind === "closed" && agent.isStopping) {
      return { kind: "stopped" };
    }
    return this.#failed(requestFailure("session/prompt", reply, agent.exit));
  }

  #failed(failure: AgentFailure): Ending {
    return this.#destroyed ? { kind: "stopped" } : { kind: "failed", failure };
  }

  #forget(run: TurnRun): void {
    this.#running.delete(run);
    for (const [session, each] of this.#bySession) {
      if (each === run) {
        this.#bySession.delete(session);
      }
    }
  }

  async #ready(): Promise<Outcome<AgentProcess>> {
    const folder = await this.#folder();
    if (!folder.ok) {
      return folder;
    }
    const starting = this.#agent ?? this.#start(folder.value);
    this.#agent = starting;
    const started = await starting;
    if (!started.ok && this.#agent === starting) {
      this.#agent = null;
      if (started.failure.kind === "checkoutFailed") {
        this.#checkout = null;
      }
    }
    return started;
  }

  async #folder(): Promise<Outcome<CheckoutFolder>> {
    const preparing = this.#checkout ?? this.#prepare();
    this.#checkout = preparing;
    const prepared = await preparing;
    if (!prepared.ok && this.#checkout === preparing) {
      this.#checkout = null;
    }
    return prepared;
  }

  async #prepare(): Promise<Outcome<CheckoutFolder>> {
    try {
      const result = await this.#source.prepareCheckout();
      if (!result.ok) {
        return {
          ok: false,
          failure: { kind: "checkoutFailed", message: sourceText(result.failure) },
        };
      }
      const ready = result.value;
      return ready.kind === "Ready"
        ? { ok: true, value: ready.folder }
        : { ok: false, failure: { kind: "checkoutFailed", message: ready.message } };
    } catch (error) {
      return { ok: false, failure: { kind: "checkoutFailed", message: String(error) } };
    }
  }

  #start(folder: CheckoutFolder): Promise<Outcome<AgentProcess>> {
    const command = agentCommand(this.#command());
    if (command === null) {
      return Promise.resolve({ ok: false, failure: { kind: "noCommand" } });
    }
    const starting = AgentProcess.start({
      source: this.#source,
      command,
      folder,
      timers: this.#timers,
      exited: () => {
        if (this.#agent === starting) {
          this.#agent = null;
        }
      },
    });
    return starting;
  }
}
