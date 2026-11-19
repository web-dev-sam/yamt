import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue";

import type {
  RangeEntry,
  RangeFileId,
  RangeStart,
  ReviewedSource,
  ReviewMarks,
  SinceReview,
  SourceResult,
} from "../ipc";
import { nextOpen } from "./nextFile";
import { attempt, type Problem, type ReviewedStep } from "./problem";

export type RangeReviewed = {
  readonly marks: Readonly<ShallowRef<ReviewMarks>>;
  /** Rule 3's "N of M reviewed": `reviewed` counts only "reviewed" marks; `of` is the list's length. */
  readonly counted: ComputedRef<{ readonly reviewed: number; readonly of: number }>;
  /** True until the first list answers ok, and while a mark/unmark runs (one write at a time). */
  readonly busy: Readonly<ShallowRef<boolean>>;
  load(): Promise<void>;
  /** Rule 2: "reviewed" → unmark, stay; otherwise → mark, then show the next file in `start.files` order whose mark is
   *  not "reviewed" (wrapping, never itself; none → stay). Ignored while busy. */
  toggle(entry: RangeEntry): Promise<void>;
  /** Rule 6: forgets a mark; the file shows its whole change (the view derives it from `marks`). Ignored while busy. */
  reviewFromStart(entry: RangeEntry): Promise<void>;
  /** The since view's reply; a failure drops the file's view (as `loadFile`) and reports, answering null. */
  loadSince(entry: RangeEntry): Promise<SinceReview | null>;
};

type ReviewedWindow = {
  readonly start: Readonly<ShallowRef<RangeStart | null>>;
  show(path: string): void;
  forget(file: RangeFileId): void;
  problems(problem: Problem): void;
};

type State = {
  readonly source: ReviewedSource;
  readonly window: ReviewedWindow;
  readonly marks: ShallowRef<ReviewMarks>;
  readonly busy: ShallowRef<boolean>;
};

function isReviewed(marks: ReviewMarks, file: RangeFileId): boolean {
  return marks.get(file) === "reviewed";
}

async function load(state: State): Promise<void> {
  const outcome = await attempt(() => state.source.listReviewed());
  if (!outcome.ok) {
    state.window.problems({ action: "reviewed", step: "list", path: null, cause: outcome.cause });
    return;
  }
  state.marks.value = outcome.value;
  state.busy.value = false;
}

async function written(
  state: State,
  step: Extract<ReviewedStep, "mark" | "unmark">,
  entry: RangeEntry,
  call: () => Promise<SourceResult<null>>,
): Promise<boolean> {
  if (state.busy.value) {
    return false;
  }
  state.busy.value = true;
  const outcome = await attempt(call);
  state.busy.value = false;
  if (!outcome.ok) {
    state.window.problems({ action: "reviewed", step, path: entry.path, cause: outcome.cause });
  }
  return outcome.ok;
}

async function unmark(state: State, entry: RangeEntry): Promise<void> {
  if (await written(state, "unmark", entry, () => state.source.unmarkReviewed(entry.id))) {
    const marks = new Map(state.marks.value);
    marks.delete(entry.id);
    state.marks.value = marks;
  }
}

async function mark(state: State, entry: RangeEntry): Promise<void> {
  if (!(await written(state, "mark", entry, () => state.source.markReviewed(entry.id)))) {
    return;
  }
  state.marks.value = new Map(state.marks.value).set(entry.id, "reviewed");
  const files = state.window.start.value?.files ?? [];
  const next = nextOpen(files, entry.path, (file) => isReviewed(state.marks.value, file.id));
  if (next !== null) {
    state.window.show(next);
  }
}

async function loadSince(state: State, entry: RangeEntry): Promise<SinceReview | null> {
  const outcome = await attempt(() => state.source.loadSinceReview(entry.id));
  if (!outcome.ok) {
    state.window.forget(entry.id);
    state.window.problems({
      action: "reviewed",
      step: "since",
      path: entry.path,
      cause: outcome.cause,
    });
    return null;
  }
  return outcome.value;
}

export function createRangeReviewed(source: ReviewedSource, window: ReviewedWindow): RangeReviewed {
  const state: State = {
    source,
    window,
    marks: shallowRef<ReviewMarks>(new Map()),
    busy: shallowRef(true),
  };
  const counted = computed(() => {
    const files = window.start.value?.files ?? [];
    const reviewed = files.filter(({ id }) => isReviewed(state.marks.value, id)).length;
    return { reviewed, of: files.length };
  });
  return {
    marks: state.marks,
    counted,
    busy: state.busy,
    load: () => load(state),
    toggle: (entry) =>
      isReviewed(state.marks.value, entry.id) ? unmark(state, entry) : mark(state, entry),
    reviewFromStart: (entry) => unmark(state, entry),
    loadSince: (entry) => loadSince(state, entry),
  };
}
