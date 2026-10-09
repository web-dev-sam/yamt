import { StateEffect, StateField } from "@codemirror/state";

import type { Chunk } from "../../ipc";
import type { ChunkState } from "./status";

export const showStatuses = StateEffect.define<readonly ChunkState[]>();

export function sideStatusField(chunks: readonly Chunk[]): StateField<readonly ChunkState[]> {
  return StateField.define<readonly ChunkState[]>({
    create: () => chunks.map((chunk) => ({ chunk, status: "pending" })),
    update: (states, tr) =>
      tr.effects.findLast((effect) => effect.is(showStatuses))?.value ?? states,
  });
}
