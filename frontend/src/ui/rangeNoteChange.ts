import type { TurnView } from "../agent";
import type { Message, SendProgress } from "../ipc";

/** Why Edit and Delete are off (plan row 123). */
export type NoteChangeBlock = "sending" | "aiWorking";

/** Edit and Delete (plan row 123): your own note, until it is on GitLab. */
export function isChangeable({ body, posting }: Message): boolean {
  return body.kind === "note" && posting.kind !== "pending";
}

export function noteChangeBlock(
  sending: SendProgress | null,
  aiTurn: TurnView | null,
): NoteChangeBlock | null {
  if (sending !== null) {
    return "sending";
  }
  return aiTurn === null ? null : "aiWorking";
}
