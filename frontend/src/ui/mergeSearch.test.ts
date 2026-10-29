import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  loadFixture,
  type FileEntry,
  type FileMergeData,
  type SideNames,
  type SourceResult,
} from "../ipc";
import { createAsking } from "./asking";
import {
  createMergeSearch,
  MERGE_LAYOUT,
  mergePanes,
  type LiveResults,
  type MergeSearch,
  type MergeSearchTarget,
} from "./mergeSearch";
import type { Problem } from "./problem";
import { startSettings } from "./settings";
import type { ResultLineUp } from "./useMergeController";

type FileRecord = {
  readonly local: string;
  readonly remote: string;
  readonly middle:
    | { kind: "Stages" | "Disk"; text: string }
    | { kind: "DiskNotText"; found: "Binary" };
  readonly chunks?: readonly unknown[];
};

const CHUNK_ADDING_A_LEFT_LINE = {
  chunk: {
    id: 0,
    kind: "LocalOnly",
    base: { start: 0, len: 1 },
    local: { start: 0, len: 2 },
    remote: { start: 0, len: 1 },
  },
  middle: { start: 0, len: 1 },
  words: { chunk: 0, local: { changed: [], removals: [] }, remote: { changed: [], removals: [] } },
  waiting: { kind: "SideLines" },
};

async function data(path: string, record: FileRecord): Promise<FileMergeData> {
  const json = { path, deleted: null, eol: "Lf", chunks: [], disk_version: 0, ...record };
  return loadFixture(path, { [`${path}.json`]: json });
}

function entry(path: string, unsupported: FileEntry["unsupported"] = null): FileEntry {
  return { path, status: "Unresolved", unsupported };
}

type Harness = {
  readonly target: MergeSearchTarget;
  readonly loads: string[];
  readonly stops: number[];
  readonly problem: MergeSearchTarget["problem"];
  readonly files: ShallowRef<readonly FileEntry[]>;
};

function harness(
  files: readonly FileEntry[],
  opened: readonly FileMergeData[],
  load: (path: string) => Promise<SourceResult<FileMergeData>>,
): Harness {
  const loads: string[] = [];
  const stops: number[] = [];
  const problem = shallowRef<Problem | null>(null);
  const listed = shallowRef(files);
  const target: MergeSearchTarget = {
    source: {
      loadFile: async (path) => {
        loads.push(path);
        return load(path);
      },
    },
    files: listed,
    opened: shallowRef(opened),
    sideNames: shallowRef<SideNames>({ local: null, remote: null }),
    active: shallowRef<string | null>(null),
    problem,
    asking: createAsking(),
    settings: shallowRef(startSettings("dark")),
    nextStop: async () => {
      stops.push(stops.length);
    },
  };
  return { target, loads, stops, problem, files: listed };
}

function previews(search: MergeSearch["search"]): string[] {
  return search.rows.value.flatMap((row) =>
    row.kind === "place"
      ? [
          `${row.path}: ${row.place.preview.before}${row.place.preview.match}${row.place.preview.after} [${row.shown.map(({ pane }) => pane).join(" ")}]`,
        ]
      : [],
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("an opened file's Result is its live text when built, else its data; an unopened one is loaded once until forgotten; a choice file is skipped", async () => {
  const live = await data("live.ts", {
    local: "",
    remote: "",
    middle: { kind: "Disk", text: "stale x" },
  });
  const unbuilt = await data("unbuilt.ts", {
    local: "",
    remote: "",
    middle: { kind: "Stages", text: "opened x" },
  });
  const closed = await data("closed.ts", {
    local: "",
    remote: "",
    middle: { kind: "Stages", text: "loaded x" },
  });
  const files = [
    entry("live.ts"),
    entry("unbuilt.ts"),
    entry("logo.png", "Binary"),
    entry("closed.ts"),
  ];
  const { target, loads } = harness(files, [live, unbuilt], async () => ({
    ok: true,
    value: closed,
  }));
  const { search, liveResults } = createMergeSearch(target, () => undefined);
  const lineUp: ResultLineUp = { result: "live x", changes: [] };
  const registry: LiveResults = liveResults;
  registry.track("live.ts", { lineUp: () => lineUp });
  registry.track("unbuilt.ts", { lineUp: () => null });

  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();
  expect(previews(search)).toEqual([
    "live.ts: live x [center]",
    "unbuilt.ts: opened x [center]",
    "closed.ts: loaded x [center]",
  ]);
  expect(loads).toEqual(["closed.ts"]);

  search.enter();
  await vi.runAllTimersAsync();
  expect(loads).toEqual(["closed.ts"]);

  search.changed("closed.ts");
  await vi.runAllTimersAsync();
  expect(loads).toEqual(["closed.ts", "closed.ts"]);
  search.changed("logo.png");
  await vi.runAllTimersAsync();
  expect(loads).toEqual(["closed.ts", "closed.ts"]);
});

test("an untracked live Result falls back to the file's data; untrack by another view keeps it", async () => {
  const opened = await data("a.ts", {
    local: "",
    remote: "",
    middle: { kind: "Disk", text: "data x" },
  });
  const { target } = harness([entry("a.ts")], [opened], async () => ({ ok: true, value: opened }));
  const { search, liveResults } = createMergeSearch(target, () => undefined);
  const view = { lineUp: (): ResultLineUp => ({ result: "live x", changes: [] }) };
  liveResults.track("a.ts", view);
  liveResults.untrack("a.ts", { lineUp: () => null });

  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();
  expect(previews(search)).toEqual(["a.ts: live x [center]"]);

  liveResults.untrack("a.ts", view);
  search.enter();
  await vi.runAllTimersAsync();
  expect(previews(search)).toEqual(["a.ts: data x [center]"]);
});

test("a Result git left as something other than text has no Result rows, only the sides'", async () => {
  const notText = await data("a.ts", {
    local: "x",
    remote: "x",
    middle: { kind: "DiskNotText", found: "Binary" },
  });
  const { target } = harness([entry("a.ts")], [notText], async () => ({
    ok: true,
    value: notText,
  }));
  const { search } = createMergeSearch(target, () => undefined);

  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();

  expect(previews(search)).toEqual(["a.ts: x [left right]"]);
});

test("a file's data lines its panes up through its chunks", async () => {
  const shifted = await data("a.ts", {
    local: "added\nkept\nend\n",
    remote: "kept\nend\n",
    middle: { kind: "Stages", text: "kept\nend\n" },
    chunks: [CHUNK_ADDING_A_LEFT_LINE],
  });
  const { target } = harness([entry("a.ts")], [], async () => ({ ok: true, value: shifted }));
  const { search } = createMergeSearch(target, () => undefined);

  search.type("end");
  search.enter();
  await vi.runAllTimersAsync();

  expect(previews(search)).toEqual(["a.ts: end [left center right]"]);
});

test("a read failure is reported once as the search's and stops the run", async () => {
  const { target, loads, problem } = harness([entry("a.ts"), entry("b.ts")], [], async () => ({
    ok: false,
    failure: { kind: "Git", message: "gone" },
  }));
  const { search } = createMergeSearch(target, () => undefined);

  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();

  expect(loads).toEqual(["a.ts"]);
  expect(problem.value).toEqual({ action: "search", cause: { kind: "Git", message: "gone" } });
  expect(search.running.value).toBe(false);
});

test("a read answering that git moved on ends the stop instead of showing a problem", async () => {
  const { target, stops, problem } = harness([entry("a.ts")], [], async () => ({
    ok: false,
    failure: { kind: "StopMovedOn" },
  }));
  const { search } = createMergeSearch(target, () => undefined);

  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();

  expect(stops).toEqual([0]);
  expect(problem.value).toBeNull();
});

test("the merge window searches its three panes with the Result leading", () => {
  expect(MERGE_LAYOUT).toEqual({ panes: ["left", "center", "right"], lead: "center" });
});

test("the panes are titled as their headers: both sides' names and Result", () => {
  expect(
    mergePanes({ local: { kind: "Branch", name: "main" }, remote: null }).map(
      ({ pane, icon, title }) => [pane, icon, title],
    ),
  ).toEqual([
    ["left", "panel-left", "Local (yours): main"],
    ["center", "panel-left-right-dashed", "Result"],
    ["right", "panel-right", "Remote (theirs)"],
  ]);
});

test("a place click opens its file the way the shown path is asked", async () => {
  const opened: string[] = [];
  const file = await data("a.ts", { local: "", remote: "", middle: { kind: "Disk", text: "x" } });
  const { target } = harness([entry("a.ts")], [], async () => ({ ok: true, value: file }));
  const { search } = createMergeSearch(target, (path) => {
    opened.push(path);
  });
  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();
  const row = search.rows.value.find((each) => each.kind === "place");
  if (row?.kind !== "place") {
    throw new Error("no place row");
  }

  search.go(row.path, row.place, null);

  expect(opened).toEqual(["a.ts"]);
  expect(search.goTo.value).toMatchObject({ path: "a.ts", pane: "center" });
});

test("a cleared stop forgets every loaded text, so the next run loads again", async () => {
  const file = await data("a.ts", { local: "", remote: "", middle: { kind: "Disk", text: "x" } });
  const { target, loads } = harness([entry("a.ts")], [], async () => ({ ok: true, value: file }));
  const { search } = createMergeSearch(target, () => undefined);
  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();

  search.clear();
  search.rerun();
  await vi.runAllTimersAsync();

  expect(loads).toEqual(["a.ts", "a.ts"]);
  expect(previews(search)).toEqual(["a.ts: x [center]"]);
});

test("a load that lands after its file was forgotten is not kept", async () => {
  const file = await data("a.ts", { local: "", remote: "", middle: { kind: "Disk", text: "x" } });
  const gate = { open: (): void => undefined };
  const { target, loads } = harness([entry("a.ts")], [], async () => {
    await new Promise<void>((resolve) => {
      gate.open = resolve;
    });
    return { ok: true, value: file };
  });
  const { search } = createMergeSearch(target, () => undefined);
  search.type("x");
  search.enter();
  await vi.advanceTimersByTimeAsync(0);
  search.changed("a.ts");
  gate.open();
  await vi.advanceTimersByTimeAsync(0);

  search.enter();
  await vi.advanceTimersByTimeAsync(0);
  gate.open();
  await vi.runAllTimersAsync();

  expect(loads).toEqual(["a.ts", "a.ts"]);
});

test("a file that is no longer text is searched as nothing, without a load", async () => {
  const file = await data("a.ts", { local: "", remote: "", middle: { kind: "Disk", text: "x" } });
  const { target, loads, files } = harness([entry("a.ts"), entry("b.ts")], [], async (path) => ({
    ok: true,
    value: { ...file, path },
  }));
  const { search } = createMergeSearch(target, () => undefined);
  search.type("x");
  search.enter();
  await vi.runAllTimersAsync();
  expect(loads).toEqual(["a.ts", "b.ts"]);

  files.value = [entry("a.ts", "Binary"), entry("b.ts")];
  search.changed("a.ts");
  await vi.runAllTimersAsync();

  expect(loads).toEqual(["a.ts", "b.ts"]);
  expect(search.results.value?.groups.map(({ path }) => path)).toEqual(["b.ts"]);
});

test("the panes follow the side names, and the shown file is the active one", async () => {
  const { target } = harness([], [], async () => ({
    ok: false,
    failure: { kind: "WorkerStopped" },
  }));
  const names = shallowRef<SideNames>({ local: null, remote: null });
  const active = shallowRef<string | null>("c.ts");
  const { search } = createMergeSearch({ ...target, sideNames: names, active }, () => undefined);

  names.value = { local: null, remote: { kind: "Branch", name: "feature" } };
  search.focusShownFile();

  expect(search.panes.value.map(({ title }) => title)).toEqual([
    "Local (yours)",
    "Result",
    "Remote (theirs): feature",
  ]);
  expect(search.goTo.value).toEqual({ id: 1, path: "c.ts", pane: "center", match: null });
});
