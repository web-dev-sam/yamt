import type { Timers } from "../../jsonrpc";
import type { AgentFailure } from "./failure";
import type { AgentSessionId } from "./session";
import {
  EMPTY_TURN,
  endTurn,
  foldUpdate,
  refuseStep,
  type Refusal,
  type TurnUpdate,
  type TurnView,
} from "./turn";

export type TurnEnd =
  | { readonly kind: "finished"; readonly turn: TurnView }
  | { readonly kind: "stopped"; readonly turn: TurnView }
  | { readonly kind: "failed"; readonly turn: TurnView; readonly failure: AgentFailure };

export type TurnEvents = {
  readonly session: (session: AgentSessionId) => void;
  readonly changed: (turn: TurnView) => void;
};

export type Ending =
  | { readonly kind: "finished" | "stopped" }
  | { readonly kind: "failed"; readonly failure: AgentFailure };

const TURN_FLUSH_MS = 50;

/** The `stopReason` of a `session/prompt` result as a turn's end (ACP prompt turn). */
export function stopEnding(stopReason: string): Ending {
  switch (stopReason) {
    case "end_turn":
      return { kind: "finished" };
    case "cancelled":
      return { kind: "stopped" };
    default:
      return { kind: "failed", failure: { kind: "ended", reason: stopReason } };
  }
}

/** One running turn: its fold, `changed` at most once per 50 ms and always at the end, and one end. */
export class TurnRun {
  readonly ended: Promise<TurnEnd>;
  #turn: TurnView = EMPTY_TURN;
  #flush: number | null = null;
  #done = false;
  readonly #events: TurnEvents;
  readonly #timers: Timers;
  #settle: (end: TurnEnd) => void = () => undefined;

  constructor(events: TurnEvents, timers: Timers) {
    this.#events = events;
    this.#timers = timers;
    this.ended = new Promise((settle) => {
      this.#settle = settle;
    });
  }

  session(session: AgentSessionId): void {
    this.#events.session(session);
  }

  update(update: TurnUpdate): void {
    this.#changed(foldUpdate(this.#turn, update));
  }

  refuse(refusal: Refusal): void {
    this.#changed(refuseStep(this.#turn, refusal));
  }

  end(ending: Ending): void {
    if (this.#done) {
      return;
    }
    this.#done = true;
    if (this.#flush !== null) {
      this.#timers.clearTimeout(this.#flush);
    }
    const turn = endTurn(this.#turn);
    this.#events.changed(turn);
    this.#settle(ending.kind === "failed" ? { ...ending, turn } : { kind: ending.kind, turn });
  }

  #changed(turn: TurnView): void {
    if (this.#done) {
      return;
    }
    this.#turn = turn;
    this.#flush ??= this.#timers.setTimeout(() => {
      this.#flush = null;
      this.#events.changed(this.#turn);
    }, TURN_FLUSH_MS);
  }
}
