import { StateEffect, StateField } from "@codemirror/state";

import { afterDecision, alone, type SideMark } from "./navigation";
import type { Side } from "./side";
import { showStatuses } from "./sideStatus";
import { isSideOpen, type ChunkState } from "./status";

export const setMark = StateEffect.define<SideMark>();

function settled(mark: SideMark, states: readonly ChunkState[], side: Side): SideMark {
  const id = alone(mark).remembered;
  const state = states.find(({ chunk }) => chunk.id === id);
  if (id === null || state === undefined || isSideOpen(state.chunk, state.status, side)) {
    return mark;
  }
  const next = afterDecision(states, side, id);
  if (mark.kind === "alone" || next === null) {
    return { kind: "alone", remembered: next };
  }
  return { kind: "change", id: next };
}

function sideMarkField(side: Side): StateField<SideMark> {
  return StateField.define<SideMark>({
    create: () => ({ kind: "alone", remembered: null }),
    update(mark, tr) {
      const set = tr.effects.findLast((effect) => effect.is(setMark));
      if (set !== undefined) {
        return set.value;
      }
      const shown = tr.effects.findLast((effect) => effect.is(showStatuses));
      return shown === undefined ? mark : settled(mark, shown.value, side);
    },
  });
}

export const sideMarks: Readonly<Record<Side, StateField<SideMark>>> = {
  local: sideMarkField("local"),
  remote: sideMarkField("remote"),
};
