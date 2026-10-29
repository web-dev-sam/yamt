import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  loadFixture,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type OperationView,
  type WriteRequest,
} from "../ipc";
import { createAborting } from "./aborting";
import { createAsking, type Asking } from "./asking";
import { createGitRun } from "./gitRun";
import { noticeRow, type Notice } from "./noticeText";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { claimWrite, finish } from "./saving";
import type { Screen } from "./screen";
import { createSearching, type Searching } from "./searching";
import { SEARCH_PAUSE_MS } from "./searchRun";
import { startSettings } from "./settings";
import type { Taken } from "./sides";
import { nextStop, type StopTarget } from "./stops";
import type { FormatOutcome } from "./useMergeController";

const LINUX = "Linux x86_64";
const MAGIC_KEYS = await loadFixture("vueuse-use-magic-keys.ts");
const LOGO: FileSides = {
  path: "logo.png",
  reason: "Binary",
  local: { kind: "Binary", bytes: 10 },
  remote: { kind: "Binary", bytes: 12 },
  diskVersion: MAGIC_KEYS.diskVersion,
};
const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: { kind: "Branch", name: "main" },
  replaying: null,
  progress: { step: 1, total: 3 },
  editor_steps_ahead: false,
};
const NEXT_STEP: OperationView = { ...REBASE, progress: { step: 2, total: 3 } };
const CHERRY_PICK: OperationView = { kind: "CherryPick", picking: null, progress: null };
const C_TS: FileEntry = { path: "c.ts", status: "Unresolved", unsupported: null };
const TEXTS: Readonly<Record<string, string>> = {
  "a.ts": "const needle = 1;\n",
  "c.ts": "needle();\nneedle();\n",
};
const MICROTASKS = 20;

type Pane = "left" | "right";

type Stop = StopTarget &
  Parameters<typeof finish>[0] & {
    readonly lists: number[];
    readonly finishes: WriteRequest[];
    readonly aborts: string[];
    readonly asking: Asking;
    readonly operation: ShallowRef<OperationView | null>;
    readonly search: Searching<Pane>;
    searched: readonly string[];
  };

type NextStop = {
  readonly files: readonly FileEntry[] | null;
  readonly operation: OperationView | null;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function notUsed(): Promise<never> {
  return Promise.reject(new Error("not used"));
}

function writesSource(finishes: WriteRequest[], aborts: string[]): ChunkSource {
  return {
    loadFile: notUsed,
    finishFile: (request) => {
      finishes.push(request);
      return Promise.resolve({ ok: true, value: { kind: "Written", files: [] } });
    },
    saveFile: notUsed,
    resetFile: notUsed,
    describeFile: notUsed,
    takeSide: notUsed,
    listStop: notUsed,
    continueOperation: notUsed,
    abortOperation: () => {
      aborts.push("abort");
      return Promise.resolve({ ok: true, value: null });
    },
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
}

function searchOver(stop: () => Stop): Searching<Pane> {
  return createSearching<Pane>({
    source: {
      layout: { panes: ["left", "right"], lead: "right" },
      async *files() {
        for (const path of stop().searched) {
          const text = TEXTS[path] ?? "";
          yield await Promise.resolve({ path, texts: { left: text, right: text }, changes: [] });
        }
      },
      file: () => Promise.resolve(null),
      forget: () => undefined,
      forgetAll: () => undefined,
    },
    panes: () => [],
    open: () => undefined,
    shownPath: () => null,
    keys: { asking: createAsking(), settings: shallowRef(startSettings("dark")) },
  });
}

async function microtasks(): Promise<void> {
  for (let tick = 0; tick < MICROTASKS; tick += 1) {
    await Promise.resolve();
  }
}

function groups(search: Searching<Pane>): [string, number][] | null {
  return (
    search.results.value?.groups.map(({ path, places }): [string, number] => [
      path,
      places.length,
    ]) ?? null
  );
}

function stopAt(
  unsaved: readonly string[],
  next: NextStop = { files: [C_TS], operation: NEXT_STEP },
  operation: OperationView | null = REBASE,
): Stop {
  const lists: number[] = [];
  const finishes: WriteRequest[] = [];
  const aborts: string[] = [];
  const stop: Stop = {
    lists,
    finishes,
    aborts,
    source: writesSource(finishes, aborts),
    files: shallowRef<readonly FileEntry[]>([]),
    opened: shallowRef<readonly FileMergeData[]>([
      { ...MAGIC_KEYS, path: "a.ts" },
      { ...MAGIC_KEYS, path: "b.ts" },
    ]),
    choices: shallowRef<readonly FileSides[]>([LOGO]),
    problem: shallowRef<Problem | null>({ action: "list", cause: { kind: "GitRunning" } }),
    writing: new Map(),
    stop: { dropped: false },
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map([[LOGO.path, { by: "disk" }]])),
    notices: shallowRef<readonly Notice[]>([
      {
        kind: "disk",
        path: "a.ts",
        result: { kind: "Staged" },
        editsDropped: false,
        when: "start",
      },
    ]),
    formatOutcomes: shallowRef<ReadonlyMap<string, FormatOutcome>>(
      new Map([["a.ts", { kind: "formatted", server: "oxfmt" }]]),
    ),
    active: shallowRef<string | null>("a.ts"),
    screen: shallowRef<Screen>({ kind: "serverLog", name: "oxlint" }),
    operation: shallowRef<OperationView | null>(operation),
    stopMessage: shallowRef<string | null>("the old stop's message"),
    asking: createAsking(),
    guard: { unsavedFiles: () => [...unsaved] },
    search: searchOver(() => stop),
    searched: ["a.ts"],
    latestOpen: 4,
    loadFiles: () => {
      lists.push(stop.latestOpen);
      stop.operation.value = next.operation;
      if (next.files !== null) {
        stop.active.value = next.files[0]?.path ?? null;
        stop.searched = next.files.map((file) => file.path);
      }
      return Promise.resolve(next.files);
    },
    nextStop: notUsed,
  };
  return stop;
}

function quiet(): void {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
}

test("a new stop drops every opened file, choice, side taken, notice, problem and the shown file, and shows the files", async () => {
  quiet();
  const stop = stopAt([]);
  const seen: unknown[] = [];
  const listing = stop.loadFiles.bind(stop);
  stop.loadFiles = () => {
    seen.push({
      opened: stop.opened.value,
      choices: stop.choices.value,
      taken: stop.taken.value,
      notices: stop.notices.value,
      formatOutcomes: stop.formatOutcomes.value,
      active: stop.active.value,
      problem: stop.problem.value,
      stopMessage: stop.stopMessage.value,
      screen: stop.screen.value,
    });
    return listing();
  };

  await nextStop(stop, { kind: "outside" });

  expect(seen).toEqual([
    {
      opened: [],
      choices: [],
      taken: new Map(),
      notices: [],
      formatOutcomes: new Map(),
      active: null,
      problem: null,
      stopMessage: null,
      screen: { kind: "files" },
    },
  ]);
});

test("the list runs after the opens are bumped, so a load still running for the old stop lands nowhere", async () => {
  quiet();
  const stop = stopAt([]);

  await nextStop(stop, { kind: "outside" });

  expect(stop.lists).toEqual([5]);
  expect(stop.active.value).toBe("c.ts");
});

test("a write still running for the old stop is dropped: its claim is gone, marked overtaken, and its stop dropped", async () => {
  quiet();
  const stop = stopAt([]);
  const old = stop.stop;
  const claims: boolean[] = [];
  const releases: (() => void)[] = [];
  const writing = claimWrite(stop, "a.ts", async (claim) => {
    await new Promise<void>((resolve) => {
      releases.push(resolve);
    });
    claims.push(claim.overtaken);
  });

  await nextStop(stop, { kind: "outside" });
  expect(stop.writing.size).toBe(0);
  releases[0]?.();
  await writing;

  expect(claims).toEqual([true]);
  expect([old.dropped, stop.stop.dropped]).toEqual([true, false]);
});

test("moved on outside with unsaved edits: one notice names the operation and every dropped file", async () => {
  quiet();
  const stop = stopAt(["a.ts", "b.ts"]);

  await nextStop(stop, { kind: "outside" });

  expect(stop.notices.value).toEqual([
    { kind: "movedOn", operation: "Rebase", files: ["a.ts", "b.ts"] },
  ]);
});

test("moved on outside without unsaved edits, or continued with them, gives no notice", async () => {
  quiet();
  const clean = stopAt([]);
  const continued = stopAt(["a.ts"]);

  await nextStop(clean, { kind: "outside" });
  await nextStop(continued, { kind: "continued", message: "CONFLICT (content)" });

  expect([clean.notices.value, continued.notices.value]).toEqual([[], []]);
});

test("continued to a stop that lists no file shows git's message, naming the new stop's operation, and keeps it for the stop view", async () => {
  quiet();
  const stop = stopAt([], { files: [], operation: CHERRY_PICK });

  await nextStop(stop, { kind: "continued", message: "error: could not apply 8b4e7d0\n" });

  const problem = stop.problem.value;
  expect(problem).toEqual({
    action: "stopped",
    operation: "CherryPick",
    message: "error: could not apply 8b4e7d0\n",
  });
  expect(stop.stopMessage.value).toBe("error: could not apply 8b4e7d0\n");
  expect(problem === null ? null : problemText(problem, LINUX)).toBe(
    "The cherry-pick stopped: error: could not apply 8b4e7d0",
  );
});

test("continued to a stop with files, or one whose list failed, shows no message", async () => {
  quiet();
  const listed = stopAt([]);
  const failed = stopAt([], { files: null, operation: NEXT_STEP });

  await nextStop(listed, { kind: "continued", message: "CONFLICT (content)" });
  await nextStop(failed, { kind: "continued", message: "CONFLICT (content)" });

  expect([listed.problem.value, failed.problem.value]).toEqual([null, null]);
  expect([listed.stopMessage.value, failed.stopMessage.value]).toEqual([null, null]);
});

test("moved on outside to a stop that lists no file shows no message", async () => {
  quiet();
  const stop = stopAt([], { files: [], operation: NEXT_STEP });

  await nextStop(stop, { kind: "outside" });

  expect(stop.problem.value).toBeNull();
  expect(stop.stopMessage.value).toBeNull();
});

test("moved on outside from a stop that recorded no operation: the notice says Git moved on", async () => {
  quiet();
  const stop = stopAt(["a.ts"], { files: [C_TS], operation: null }, null);

  await nextStop(stop, { kind: "outside" });

  expect(stop.notices.value.map((notice) => noticeRow(notice).text)).toEqual([
    "Git moved on outside yamt; your unsaved edits in a.ts were dropped",
  ]);
});

test("a Mark resolved question waiting when the stop ends ends with it: a Yes afterwards sends no finishFile", async () => {
  quiet();
  const stop = stopAt([]);
  const finishing = finish(stop, {
    path: "a.ts",
    diskVersion: MAGIC_KEYS.diskVersion,
    summary: { conflicts: 1, changes: 0, remembered: 0 },
    snapshot: { asShown: () => "the old stop's text\n", markSaved: () => undefined },
  });
  expect(stop.asking.question.value?.kind).toBe("unprocessed");

  await nextStop(stop, { kind: "outside" });
  stop.asking.answer(true);

  expect(await finishing).toBe(false);
  expect([stop.asking.question.value, stop.finishes]).toEqual([null, []]);
});

test("an Abort question waiting when the stop ends ends with it: a Yes afterwards aborts nothing", async () => {
  quiet();
  const stop = stopAt([]);
  const { abortOperation } = createAborting(Object.assign(stop, { gitRun: createGitRun() }));
  const pressed = abortOperation();
  expect(stop.asking.question.value?.kind).toBe("abort");

  await nextStop(stop, { kind: "outside" });
  stop.asking.answer(true);
  await pressed;

  expect([stop.asking.question.value, stop.aborts]).toEqual([null, []]);
});

test("a question that is not about the stop stays open across it", async () => {
  quiet();
  const stop = stopAt([]);
  const asked = stop.asking.ask({ kind: "exit", files: ["a.ts"] });

  await nextStop(stop, { kind: "outside" });

  expect(stop.asking.question.value).toEqual({ kind: "exit", files: ["a.ts"] });
  stop.asking.answer(false);
  expect(await asked).toBe("no");
});

test("a new stop clears the results, then searches the new stop's files for the same query once its list arrived", async () => {
  quiet();
  vi.useFakeTimers();
  const stop = stopAt([]);
  stop.search.type("needle");
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);
  expect(groups(stop.search)).toEqual([["a.ts", 1]]);
  const seen: unknown[] = [];
  const listing = stop.loadFiles.bind(stop);
  stop.loadFiles = () => {
    seen.push(groups(stop.search));
    return listing();
  };

  await nextStop(stop, { kind: "outside" });
  await microtasks();

  expect(seen).toEqual([null]);
  expect(stop.search.query.value).toBe("needle");
  expect(groups(stop.search)).toEqual([["c.ts", 2]]);
});

test("a new stop whose list failed searches nothing", async () => {
  quiet();
  vi.useFakeTimers();
  const stop = stopAt([], { files: null, operation: NEXT_STEP });
  stop.search.type("needle");
  await vi.advanceTimersByTimeAsync(SEARCH_PAUSE_MS);

  await nextStop(stop, { kind: "outside" });
  await microtasks();

  expect([stop.search.query.value, groups(stop.search)]).toEqual(["needle", null]);
});
