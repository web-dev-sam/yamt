import { EMPTY_TURN, endTurn, foldUpdate, type TurnUpdate, type TurnView } from "./turn";

/**
 * A `session/load` replay as turns, folded like live ones: a turn starts at each user message
 * (one or more `user_message_chunk`s in a row); anything before the first one is not a turn.
 */
export function replayTurns(updates: readonly TurnUpdate[]): TurnView[] {
  const turns: TurnView[] = [];
  let previous: TurnUpdate["kind"] | null = null;
  for (const update of updates) {
    if (update.kind === "asked" && previous !== "asked") {
      turns.push(EMPTY_TURN);
    }
    previous = update.kind;
    const at = turns.length - 1;
    const turn = turns[at];
    if (turn !== undefined) {
      turns[at] = foldUpdate(turn, update);
    }
  }
  return turns.map(endTurn);
}
