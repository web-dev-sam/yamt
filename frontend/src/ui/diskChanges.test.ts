import { afterEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import type { ChunkSource, FileEntry, FileMergeData, FileSides } from "../ipc";
import type { SearchedFile } from "../search";
import { createAsking } from "./asking";
import { applyDiskChanges } from "./diskChanges";
import type { Notice } from "./noticeText";
import type { Problem } from "./problem";
import { createSearching, type Searching } from "./searching";
import { SEARCH_PAUSE_MS } from "./searchRun";
import { startSettings } from "./settings";
import type { Taken } from "./sides";

type Pane = "left" | "right";

type Files = { readonly texts: Map<string, string>; readonly reads: string[] };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function notUsed(): Promise<never> {
  return Promise.reject(new Error("not used"));
}

const SOURCE: ChunkSource = {
  loadFile: notUsed,
  finishFile: notUsed,
  saveFile: notUsed,
  resetFile: notUsed,
  describeFile: notUsed,
  takeSide: notUsed,
  listStop: notUsed,
  continueOperation: notUsed,
  abortOperation: notUsed,
  loadSettings: notUsed,
  setTheme: notUsed,
  setAntialiasing: notUsed,
  setKeys: notUsed,
  moveSettings: notUsed,
  setServerAnswer: notUsed,
  setServerSwitch: notUsed,
  setAddedServers: notUsed,
  setAgent: notUsed,
};

function searchOver(files: Files): Searching<Pane> {
  function searched(path: string): SearchedFile<Pane> {
    files.reads.push(path);
    const text = files.texts.get(path) ?? "";
    return { path, texts: { left: text, right: text }, changes: [] };
  }
  return createSearching<Pane>({
    source: {
      layout: { panes: ["left", "right"], lead: "right" },
      async *files() {
        for (const path of files.texts.keys()) {
          yield await Promise.resolve(searched(path));
        }
      },
      file: (path) => Promise.resolve(searched(path)),
      forget: () => undefined,
      forgetAll: () => undefined,
    },
    panes: () => [],
    open: () => undefined,
    shownPath: () => null,
    keys: { asking: createAsking(), settings: shallowRef(startSettings("dark")) },
  });
}

function groups(search: Searching<Pane>): [string, number][] {
  return (search.results.value?.groups ?? []).map(({ path, places }) => [path, places.length]);
}

test("a disk change searches that path again after the pause, and no other", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const files: Files = {
    texts: new Map([
      ["a.ts", "needle\n"],
      ["b.ts", "needle\n"],
    ]),
    reads: [],
  };
  const search = searchOver(files);
  search.type("needle");
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);
  files.reads.length = 0;
  files.texts.set("a.ts", "needle needle\nneedle\n");
  files.texts.set("b.ts", "needle needle\nneedle\n");

  await applyDiskChanges(
    {
      source: SOURCE,
      files: shallowRef<readonly FileEntry[]>([]),
      opened: shallowRef<readonly FileMergeData[]>([]),
      choices: shallowRef<readonly FileSides[]>([]),
      problem: shallowRef<Problem | null>(null),
      notices: shallowRef<readonly Notice[]>([]),
      taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
      guard: { unsavedFiles: () => [] },
      search,
      nextStop: notUsed,
    },
    [{ path: "a.ts", result: { kind: "Staged" } }],
    "running",
    { dropped: false },
  );
  expect(groups(search)).toEqual([
    ["a.ts", 1],
    ["b.ts", 1],
  ]);
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);

  expect(files.reads).toEqual(["a.ts"]);
  expect(groups(search)).toEqual([
    ["a.ts", 3],
    ["b.ts", 1],
  ]);
});
