import type { AgentSource, Difference, SourceFailure } from "../ipc";
import { parseWith, SYSTEM_TIMERS, type Reply, type Timers } from "../jsonrpc";
import { replayTurns } from "./internal/conversation";
import { requestFailure, type AgentFailure } from "./internal/failure";
import type { AgentProcess, Outcome } from "./internal/process";
import { NEW_SESSION_RESULT, PROMPT_RESULT } from "./internal/protocol";
import type { AgentSessionId } from "./internal/session";
import { Starter } from "./internal/starter";
import type { FileEdit, TurnView } from "./internal/turn";
import {
  stopEnding,
  TurnRun,
  type Ending,
  type TurnEnd,
  type TurnEvents,
} from "./internal/turnRun";

export type { AgentFailure } from "./internal/failure";
export type { AgentSessionId } from "./internal/session";
export type { TurnEnd, TurnEvents } from "./internal/turnRun";
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
  /** Sends `session/cancel` once the prompt is out; before that, the turn ends stopped at once. */
  stop(): void;
}

export type ConversationLoad =
  | { readonly kind: "loaded"; readonly turns: readonly TurnView[] }
  | { readonly kind: "failed"; readonly failure: AgentFailure }
  | { readonly kind: "stopped" };

export type EditDiff =
  | { readonly kind: "differences"; readonly differences: readonly Difference[] }
  | { readonly kind: "tooLarge"; readonly limit: number }
  | { readonly kind: "appFailed"; readonly failure: SourceFailure }
  | { readonly kind: "failed"; readonly message: string };

export type AgentSetup = {
  readonly source: AgentSource;
  readonly command: () => readonly string[];
  readonly timers?: Timers;
};

type Asking =
  | { readonly kind: "preparing" }
  | { readonly kind: "stopped" }
  | { readonly kind: "prompted"; readonly agent: AgentProcess; readonly session: AgentSessionId }
  | { readonly kind: "answered" };

type AskingNow = { now: Asking };

const STOPPED: Ending = { kind: "stopped" };

function isStopped(asking: AskingNow): boolean {
  return asking.now.kind === "stopped";
}

/** The window's one agent: the checkout made and the process started at the first ask. */
export class AgentClient {
  readonly #source: AgentSource;
  readonly #timers: Timers;
  readonly #starter: Starter;
  readonly #running = new Set<TurnRun>();
  readonly #bySession = new Map<AgentSessionId, TurnRun>();

  constructor(setup: AgentSetup) {
    this.#source = setup.source;
    this.#timers = setup.timers ?? SYSTEM_TIMERS;
    this.#starter = new Starter({ ...setup, timers: this.#timers });
  }

  ask(request: AskRequest, events: TurnEvents): RunningTurn {
    const run = new TurnRun(events, this.#timers);
    const { session } = request;
    if (session !== null && this.#bySession.has(session)) {
      run.end({ kind: "failed", failure: { kind: "busy" } });
      return { ended: run.ended, stop: () => undefined };
    }
    if (this.#starter.isDestroyed()) {
      run.end(STOPPED);
      return { ended: run.ended, stop: () => undefined };
    }
    const asking: AskingNow = { now: { kind: "preparing" } };
    this.#running.add(run);
    if (session !== null) {
      this.#bySession.set(session, run);
    }
    void this.#turn(run, request, asking);
    return { ended: run.ended, stop: () => this.#stop(run, asking) };
  }

  async loadConversation(session: AgentSessionId): Promise<ConversationLoad> {
    if (this.#bySession.has(session)) {
      return { kind: "failed", failure: { kind: "busy" } };
    }
    const started = await this.#starter.ready(() => true);
    if (started.kind !== "started") {
      return started.kind === "failed" ? started : { kind: "stopped" };
    }
    const replay = await started.agent.replay(session);
    if (replay.ok) {
      return { kind: "loaded", turns: replayTurns(replay.value) };
    }
    return this.#starter.isDestroyed()
      ? { kind: "stopped" }
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
        : { kind: "appFailed", failure };
    } catch (error) {
      return { kind: "failed", message: String(error) };
    }
  }

  /** Whether any turn is running; false already inside an `ended` handler. */
  isRunning(): boolean {
    return this.#running.size > 0;
  }

  /** Stops the process; running turns end stopped, and nothing starts afterwards. */
  destroy(): void {
    this.#starter.destroy();
  }

  #stop(run: TurnRun, asking: AskingNow): void {
    const { now } = asking;
    switch (now.kind) {
      case "preparing":
        asking.now = { kind: "stopped" };
        this.#end(run, STOPPED);
        return;
      case "prompted":
        now.agent.cancel(now.session);
        return;
      case "stopped":
      case "answered":
        return;
      default: {
        const _exhaustive: never = now;
        return _exhaustive;
      }
    }
  }

  async #turn(run: TurnRun, request: AskRequest, asking: AskingNow): Promise<void> {
    const started = await this.#starter.ready(() => !isStopped(asking));
    if (isStopped(asking)) {
      return;
    }
    if (started.kind !== "started") {
      this.#end(run, started.kind === "failed" ? this.#failed(started.failure) : STOPPED);
      return;
    }
    const { agent } = started;
    const session = await this.#session(agent, request.session);
    if (isStopped(asking)) {
      return;
    }
    if (!session.ok) {
      this.#end(run, this.#failed(session.failure));
      return;
    }
    if (request.session === null) {
      this.#bySession.set(session.value, run);
      run.session(session.value);
    }
    const unlisten = agent.listen(session.value, run);
    asking.now = { kind: "prompted", agent, session: session.value };
    const prompt = [{ type: "text", text: request.text }];
    const reply = await agent.request("session/prompt", { sessionId: session.value, prompt });
    asking.now = { kind: "answered" };
    unlisten();
    this.#end(run, this.#promptEnding(agent, reply));
  }

  async #session(
    agent: AgentProcess,
    session: AgentSessionId | null,
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
    if (!parsed.ok) {
      const message = parsed.reason;
      return { ok: false, failure: { kind: "refused", method: "session/new", message } };
    }
    const created = parsed.value.sessionId;
    agent.created(created);
    return { ok: true, value: created };
  }

  #promptEnding(agent: AgentProcess, reply: Reply): Ending {
    if (reply.kind !== "result") {
      return this.#failed(requestFailure("session/prompt", reply, agent.exit));
    }
    const parsed = parseWith(PROMPT_RESULT, reply.value);
    return parsed.ok
      ? stopEnding(parsed.value.stopReason)
      : this.#failed({ kind: "refused", method: "session/prompt", message: parsed.reason });
  }

  #failed(failure: AgentFailure): Ending {
    return this.#starter.isDestroyed() ? STOPPED : { kind: "failed", failure };
  }

  /** Forgets the run before it settles, so code awaiting `ended` sees it gone. */
  #end(run: TurnRun, ending: Ending): void {
    this.#running.delete(run);
    for (const [session, each] of this.#bySession) {
      if (each === run) {
        this.#bySession.delete(session);
      }
    }
    run.end(ending);
  }
}
