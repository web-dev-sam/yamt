import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  createFixtureRangeSource,
  log,
  type RangeEntry,
  type RangeFileId,
  type RangeSource,
  type RangeStart,
  type ReviewMarks,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { createFileListMode, type FileListView } from "./fileListMode";
import type { Problem } from "./problem";
import { createRangeReviewed, type RangeReviewed } from "./rangeReviewed";

type Edit = (fixture: RangeSource) => Partial<RangeSource>;

type Opened = {
  readonly reviewed: RangeReviewed;
  readonly source: RangeSource;
  readonly files: readonly RangeEntry[];
  readonly listMode: FileListView;
  readonly shown: string[];
  readonly forgotten: RangeFileId[];
  readonly problems: Problem[];
};

const SEEDED = "?range=review&reviewed=seeded";
const FULL: SourceFailure = { kind: "WriteFailed", path: "/data/reviewed.json", message: "full" };

afterEach(() => {
  vi.restoreAllMocks();
});

function valueOf<T>(result: SourceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, got ${JSON.stringify(result.failure)}`);
  }
  return result.value;
}

function created(
  search: string,
  edit: Edit = () => ({}),
): Omit<Opened, "files"> & { readonly start: ShallowRef<RangeStart | null> } {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const fixture = createFixtureRangeSource(log, search);
  const source = { ...fixture, ...edit(fixture) };
  const start = shallowRef<RangeStart | null>(null);
  const shown: string[] = [];
  const forgotten: RangeFileId[] = [];
  const problems: Problem[] = [];
  const listMode = createFileListMode();
  const reviewed = createRangeReviewed(source, {
    start,
    listMode,
    show: (path) => shown.push(path),
    problems: (problem) => problems.push(problem),
    loadView: async (view, call, problem) => {
      const result = await call();
      if (result.ok) {
        return result.value;
      }
      forgotten.push(view.id);
      problems.push(problem(result.failure));
      return null;
    },
  });
  return { reviewed, source, listMode, start, shown, forgotten, problems };
}

async function opened(search: string = SEEDED, edit: Edit = () => ({})): Promise<Opened> {
  const made = created(search, edit);
  made.start.value = valueOf(await made.source.openRange());
  await made.reviewed.load();
  return { ...made, files: made.start.value.files };
}

async function openedBackwards(): Promise<Opened> {
  const made = created(SEEDED);
  const start = valueOf(await made.source.openRange());
  made.start.value = { ...start, files: [...start.files].reverse() };
  await made.reviewed.load();
  return { ...made, files: start.files };
}

function entry({ files }: Opened, path: string): RangeEntry {
  const found = files.find((each) => each.path === path);
  if (found === undefined) {
    throw new Error(`no file ${path}`);
  }
  return found;
}

function marked(window: Opened): [string, string][] {
  return [...window.reviewed.marks.value].map(([id, mark]) => [
    window.files[id]?.path ?? String(id),
    mark,
  ]);
}

async function stored(window: Opened): Promise<ReviewMarks> {
  return valueOf(await window.source.listReviewed());
}

test("marking_an_unreviewed_file_opens_the_next_not_reviewed_file_in_list_order", async () => {
  const window = await opened();

  await window.reviewed.toggle(entry(window, "docs/current.md"));

  expect(window.reviewed.marks.value.get(entry(window, "docs/current.md").id)).toBe("reviewed");
  expect(window.shown).toEqual(["docs/legacy.txt"]);
  expect((await stored(window)).get(entry(window, "docs/current.md").id)).toBe("reviewed");
  expect(window.problems).toEqual([]);
});

test("marking_an_unreviewed_file_opens_the_next_not_reviewed_file_in_list_order_wraps_to_the_top", async () => {
  const window = await opened();

  await window.reviewed.toggle(entry(window, "vendor/ui"));

  expect(window.shown).toEqual(["config"]);
});

test("in tree mode Reviewed opens the next not-reviewed tree row, not the list's next; the list mode follows the list", async () => {
  const window = await openedBackwards();
  window.listMode.toggle();

  await window.reviewed.toggle(entry(window, "docs/current.md"));
  window.listMode.toggle();
  await window.reviewed.toggle(entry(window, "docs/legacy.txt"));

  expect(window.shown).toEqual(["docs/legacy.txt", "data/big.txt"]);
});

test("in tree mode Reviewed on the last tree row wraps to the first tree row", async () => {
  const window = await openedBackwards();
  window.listMode.toggle();

  await window.reviewed.toggle(entry(window, "config"));

  expect(window.shown).toEqual(["data/big.txt"]);
});

test("marking_the_last_unreviewed_file_stays", async () => {
  const window = await opened(SEEDED, (fixture) => ({
    listReviewed: async () => {
      const { files } = valueOf(await fixture.openRange());
      return {
        ok: true,
        value: new Map(
          files.flatMap(({ id }): [RangeFileId, "reviewed"][] =>
            id === 6 ? [] : [[id, "reviewed"]],
          ),
        ),
      };
    },
  }));
  const last = entry(window, "src/api/mockBoards.ts");

  await window.reviewed.toggle(last);

  expect(window.reviewed.marks.value.get(last.id)).toBe("reviewed");
  expect(window.reviewed.counted.value).toEqual({ reviewed: 13, of: 13 });
  expect(window.shown).toEqual([]);
});

test.each([["list"], ["tree"]])(
  "a mark before the window knows its files is stored and shows nothing next (%s view)",
  async (mode) => {
    const window = await opened();
    const early = created(SEEDED);
    if (mode === "tree") {
      early.listMode.toggle();
    }
    await early.reviewed.load();

    await early.reviewed.toggle(entry(window, "config"));

    expect(early.reviewed.marks.value.get(entry(window, "config").id)).toBe("reviewed");
    expect(early.shown).toEqual([]);
    expect(early.problems).toEqual([]);
  },
);

test("a_changed_since_review_file_counts_as_not_reviewed_for_the_next_file", async () => {
  const window = await opened();

  await window.reviewed.toggle(entry(window, "docs/legacy.txt"));
  await window.reviewed.toggle(entry(window, "src/board/board.ts"));

  expect(window.shown).toEqual(["public/logo.png", "src/board/reminders.ts"]);
  expect(marked(window)).toEqual([
    ["docs/keys.md", "reviewed"],
    ["public/logo.png", "changedSinceReview"],
    ["src/board/board.ts", "reviewed"],
    ["docs/legacy.txt", "reviewed"],
  ]);
});

test("unmarking_a_reviewed_file_stays_and_forgets_it", async () => {
  const window = await opened();
  const keys = entry(window, "docs/keys.md");

  await window.reviewed.toggle(keys);

  expect(window.reviewed.marks.value.has(keys.id)).toBe(false);
  expect((await stored(window)).has(keys.id)).toBe(false);
  expect(window.shown).toEqual([]);
  expect(window.reviewed.busy.value).toBe(false);
});

test("review_from_start_forgets_a_changed_mark", async () => {
  const window = await opened();
  const board = entry(window, "src/board/board.ts");

  await window.reviewed.reviewFromStart(board);

  expect(marked(window)).toEqual([
    ["docs/keys.md", "reviewed"],
    ["public/logo.png", "changedSinceReview"],
  ]);
  expect((await stored(window)).has(board.id)).toBe(false);
  expect(window.shown).toEqual([]);
});

test("the_count_counts_only_reviewed_marks_of_every_listed_file", async () => {
  const before = created(SEEDED);
  expect(before.reviewed.counted.value).toEqual({ reviewed: 0, of: 0 });

  const seeded = await opened();
  expect(seeded.reviewed.counted.value).toEqual({ reviewed: 1, of: 13 });
  await seeded.reviewed.toggle(entry(seeded, "config"));
  expect(seeded.reviewed.counted.value).toEqual({ reviewed: 2, of: 13 });

  const board = entry(seeded, "src/board/board.ts").id;
  const fewer = created(SEEDED, (fixture) => ({
    listReviewed: async () => {
      await fixture.markReviewed(board);
      return fixture.listReviewed();
    },
  }));
  const whole = valueOf(await fewer.source.openRange());
  fewer.start.value = { ...whole, files: whole.files.slice(0, 5) };
  await fewer.reviewed.load();
  expect(fewer.reviewed.marks.value.get(board)).toBe("reviewed");
  expect(fewer.reviewed.counted.value).toEqual({ reviewed: 1, of: 5 });
});

test("a_failed_mark_keeps_the_marks_and_reports_with_the_path", async () => {
  const window = await opened(SEEDED, () => ({
    markReviewed: async () => ({ ok: false, failure: FULL }),
    unmarkReviewed: async () => ({ ok: false, failure: FULL }),
  }));
  const marks = window.reviewed.marks.value;

  await window.reviewed.toggle(entry(window, "config"));
  await window.reviewed.toggle(entry(window, "docs/keys.md"));
  await window.reviewed.reviewFromStart(entry(window, "src/board/board.ts"));

  expect(window.reviewed.marks.value).toBe(marks);
  expect(window.shown).toEqual([]);
  expect(window.reviewed.busy.value).toBe(false);
  expect(window.problems).toEqual([
    { action: "reviewed", step: "mark", path: "config", cause: FULL },
    { action: "reviewed", step: "unmark", path: "docs/keys.md", cause: FULL },
    { action: "reviewed", step: "unmark", path: "src/board/board.ts", cause: FULL },
  ]);
});

test("a_second_toggle_while_one_runs_is_ignored", async () => {
  const calls: string[] = [];
  const opens: (() => void)[] = [];
  // Promise.withResolvers is ES2024; tsconfig.app.json's lib stops at ES2023.
  const gate = new Promise<void>((resolve) => {
    opens.push(resolve);
  });
  const window = await opened(SEEDED, (fixture) => ({
    markReviewed: async (file) => {
      calls.push(`mark ${file}`);
      await gate;
      return fixture.markReviewed(file);
    },
    unmarkReviewed: (file) => {
      calls.push(`unmark ${file}`);
      return fixture.unmarkReviewed(file);
    },
  }));
  const config = entry(window, "config");

  const first = window.reviewed.toggle(config);
  expect(window.reviewed.busy.value).toBe(true);
  await window.reviewed.toggle(entry(window, "docs/current.md"));
  await window.reviewed.toggle(entry(window, "docs/keys.md"));
  await window.reviewed.reviewFromStart(entry(window, "src/board/board.ts"));
  expect(window.reviewed.marks.value.has(config.id)).toBe(false);
  opens.forEach((open) => {
    open();
  });
  await first;

  expect(calls).toEqual([`mark ${config.id}`]);
  expect(window.reviewed.busy.value).toBe(false);
  expect(window.reviewed.marks.value.get(config.id)).toBe("reviewed");
  expect(window.shown).toEqual(["data/big.txt"]);
});

test("busy_until_the_list_answers", async () => {
  const calls: string[] = [];
  let listed: SourceResult<ReviewMarks> = { ok: false, failure: { kind: "WorkerStopped" } };
  const made = created(SEEDED, (fixture) => ({
    listReviewed: async () => listed,
    markReviewed: (file) => {
      calls.push(`mark ${file}`);
      return fixture.markReviewed(file);
    },
  }));
  made.start.value = valueOf(await made.source.openRange());
  const window: Opened = { ...made, files: made.start.value.files };
  expect(window.reviewed.busy.value).toBe(true);

  await window.reviewed.load();
  await window.reviewed.toggle(entry(window, "config"));

  expect(window.reviewed.busy.value).toBe(true);
  expect(calls).toEqual([]);
  expect(window.problems).toEqual([
    { action: "reviewed", step: "list", path: null, cause: { kind: "WorkerStopped" } },
  ]);

  listed = { ok: true, value: new Map([[entry(window, "docs/keys.md").id, "reviewed"]]) };
  await window.reviewed.load();

  expect(window.reviewed.busy.value).toBe(false);
  expect(marked(window)).toEqual([["docs/keys.md", "reviewed"]]);
});

test("a_failed_since_load_forgets_the_view_and_reports", async () => {
  const window = await opened(SEEDED, (fixture) => ({
    loadSinceReview: async (file) =>
      file === 7 ? { ok: false, failure: FULL } : fixture.loadSinceReview(file),
  }));
  const board = entry(window, "src/board/board.ts");

  expect(await window.reviewed.loadSince(board)).toBeNull();
  expect(window.forgotten).toEqual([board.id]);
  expect(window.problems).toEqual([
    { action: "reviewed", step: "since", path: "src/board/board.ts", cause: FULL },
  ]);

  expect(await window.reviewed.loadSince(entry(window, "public/logo.png"))).toEqual({
    kind: "noText",
  });
  expect(window.forgotten).toEqual([board.id]);
  expect(window.problems).toHaveLength(1);
});
