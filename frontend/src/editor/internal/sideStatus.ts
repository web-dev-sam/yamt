import { StateEffect, StateField } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { ChunkSpan } from "./chunkField";
import type { PaneViews } from "./geometry";
import type { ChunkState } from "./status";

export const showStatuses = StateEffect.define<readonly ChunkState[]>();

export function sideStatusField(initial: readonly ChunkState[]): StateField<readonly ChunkState[]> {
  return StateField.define<readonly ChunkState[]>({
    create: () => initial,
    update: (states, tr) =>
      tr.effects.findLast((effect) => effect.is(showStatuses))?.value ?? states,
  });
}

export function pushStatuses(
  update: ViewUpdate,
  field: StateField<readonly ChunkSpan[]>,
  views: PaneViews,
): readonly ChunkSpan[] | null {
  const before = update.startState.field(field);
  const after = update.state.field(field);
  if (after.every((span, index) => span.status === before[index]?.status)) {
    return null;
  }
  const states = after.map(({ chunk, status }) => ({ chunk, status }));
  views.left.dispatch({ effects: showStatuses.of(states) });
  views.right.dispatch({ effects: showStatuses.of(states) });
  return after;
}
