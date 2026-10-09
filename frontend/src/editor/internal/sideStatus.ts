import { StateEffect, StateField } from "@codemirror/state";

import type { ChunkState } from "./status";

export const showStatuses = StateEffect.define<readonly ChunkState[]>();

export function sideStatusField(initial: readonly ChunkState[]): StateField<readonly ChunkState[]> {
  return StateField.define<readonly ChunkState[]>({
    create: () => initial,
    update: (states, tr) =>
      tr.effects.findLast((effect) => effect.is(showStatuses))?.value ?? states,
  });
}
