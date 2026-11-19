import type { ShallowRef } from "vue";

import type { RangeEntry, RangeFileId, SourceResult } from "../ipc";
import { attempt, clearProblemAbout, report, type Problem, type ProblemCause } from "./problem";

/** The mounted views: `visited` in first-shown order, `recent` the same files least recently shown first. */
type Visited = {
  readonly shown: ShallowRef<RangeFileId | null>;
  readonly visited: ShallowRef<readonly RangeEntry[]>;
  recent: readonly RangeFileId[];
};

export const MOUNTED_FILES = 16;

export function markShown(state: Visited, entry: RangeEntry): void {
  const { id } = entry;
  state.shown.value = id;
  state.recent = [...state.recent.filter((each) => each !== id), id];
  if (state.visited.value.some((each) => each.id === id)) {
    return;
  }
  const [oldest, ...kept] = state.recent;
  const visited = [...state.visited.value, entry];
  if (visited.length > MOUNTED_FILES) {
    state.recent = kept;
    state.visited.value = visited.filter((each) => each.id !== oldest);
  } else {
    state.visited.value = visited;
  }
}

function forget(state: Visited, file: RangeFileId): void {
  state.recent = state.recent.filter((each) => each !== file);
  state.visited.value = state.visited.value.filter((each) => each.id !== file);
}

export async function loadView<T>(
  state: Visited & { readonly problem: ShallowRef<Problem | null> },
  entry: RangeEntry,
  call: () => Promise<SourceResult<T>>,
  problem: (cause: ProblemCause) => Problem,
): Promise<T | null> {
  const outcome = await attempt(call);
  if (!outcome.ok) {
    forget(state, entry.id);
    report(state, problem(outcome.cause));
    return null;
  }
  clearProblemAbout(state, entry.path);
  return outcome.value;
}
