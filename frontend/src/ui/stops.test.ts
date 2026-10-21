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
import { noticeRow, type Notice } from "./noticeText";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { claimWrite, finish } from "./saving";
import type { Screen } from "./screen";
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

type Stop = StopTarget &
  Parameters<typeof finish>[0] & {
    readonly lists: number[];
    readonly finishes: WriteRequest[];
    readonly aborts: string[];
    readonly asking: Asking;
    readonly operation: ShallowRef<OperationView | null>;
  };

type NextStop = {
  readonly files: readonly FileEntry[] | null;
  readonly operation: OperationView | null;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function notUsed(): Promise<never> {
  return Promise.reject(new Error("not used"));
}

function writesSource(finishes: WriteRequest[], aborts: string[]): ChunkSource {
  return {
    listFiles: notUsed,
    loadFile: notUsed,
    finishFile: (request) => {
      finishes.push(request);
      return Promise.resolve({ ok: true, value: { kind: "Written", files: [] } });
    },
    saveFile: notUsed,
    resetFile: notUsed,
    describeFile: notUsed,
    takeSide: notUsed,
    sideNames: notUsed,
    abortMerge: notUsed,
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
  };
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
    asking: createAsking(),
    guard: { unsavedFiles: () => [...unsaved] },
    latestOpen: 4,
    loadFiles: () => {
      lists.push(stop.latestOpen);
      stop.operation.value = next.operation;
      if (next.files !== null) {
        stop.active.value = next.files[0]?.path ?? null;
      }
      return Promise.resolve(next.files);
    },
    refreshFiles: notUsed,
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

test("continued to a stop that lists no file shows git's message, naming the new stop's operation", async () => {
  quiet();
  const stop = stopAt([], { files: [], operation: CHERRY_PICK });

  await nextStop(stop, { kind: "continued", message: "error: could not apply 8b4e7d0\n" });

  const problem = stop.problem.value;
  expect(problem).toEqual({
    action: "stopped",
    operation: "CherryPick",
    message: "error: could not apply 8b4e7d0\n",
  });
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
});

test("moved on outside to a stop that lists no file shows no message", async () => {
  quiet();
  const stop = stopAt([], { files: [], operation: NEXT_STEP });

  await nextStop(stop, { kind: "outside" });

  expect(stop.problem.value).toBeNull();
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
    summary: { conflicts: 1, changes: 0 },
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
  const { abortOperation } = createAborting(stop);
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
