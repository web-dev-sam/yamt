import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import type {
  ChunkSource,
  FileEntry,
  FileMergeData,
  FileSides,
  Listing,
  OperationView,
  SideNames,
  SourceResult,
} from "../ipc";
import type { Stop } from "./currentStop";
import { refreshFiles } from "./listing";
import type { Notice } from "./noticeText";
import type { Problem } from "./problem";
import type { Taken } from "./sides";
import type { StopEnd } from "./stops";

type Listed = {
  readonly source: ChunkSource;
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly operation: ShallowRef<OperationView | null>;
  readonly sideNames: ShallowRef<SideNames>;
  readonly opened: ShallowRef<readonly FileMergeData[]>;
  readonly choices: ShallowRef<readonly FileSides[]>;
  readonly problem: ShallowRef<Problem | null>;
  readonly notices: ShallowRef<readonly Notice[]>;
  readonly taken: ShallowRef<ReadonlyMap<string, Taken>>;
  readonly guard: { unsavedFiles(): string[] };
  readonly ends: StopEnd[];
  stop: Stop;
  nextStop(end: StopEnd): Promise<void>;
};

const FILES: readonly FileEntry[] = [{ path: "a.ts", status: "Unresolved", unsupported: null }];
const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: { kind: "Branch", name: "main" },
  replaying: null,
  progress: { step: 2, total: 3 },
  editor_steps_ahead: false,
};
const SIDES: SideNames = {
  local: { kind: "Commit", short_id: "8b4e7d0", subject: "Show reminders", message: "Show" },
  remote: { kind: "Branch", name: "main" },
};
const NO_NAMES: SideNames = { local: null, remote: null };

afterEach(() => {
  vi.restoreAllMocks();
});

function notUsed(): Promise<never> {
  return Promise.reject(new Error("not used"));
}

function sourceListing(answers: SourceResult<Listing>[]): ChunkSource {
  return {
    listStop: () =>
      Promise.resolve(answers.shift() ?? { ok: false, failure: { kind: "GitRunning" } }),
    loadFile: notUsed,
    finishFile: notUsed,
    saveFile: notUsed,
    resetFile: notUsed,
    describeFile: notUsed,
    takeSide: notUsed,
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
  };
}

function listedBy(answers: SourceResult<Listing>[]): Listed {
  const ends: StopEnd[] = [];
  return {
    source: sourceListing(answers),
    files: shallowRef<readonly FileEntry[]>([]),
    operation: shallowRef<OperationView | null>(null),
    sideNames: shallowRef<SideNames>(NO_NAMES),
    opened: shallowRef<readonly FileMergeData[]>([]),
    choices: shallowRef<readonly FileSides[]>([]),
    problem: shallowRef<Problem | null>(null),
    notices: shallowRef<readonly Notice[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    guard: { unsavedFiles: () => [] },
    ends,
    stop: { dropped: false },
    nextStop: (end) => {
      ends.push(end);
      return Promise.resolve();
    },
  };
}

function files(operation: OperationView | null, sides: SideNames): SourceResult<Listing> {
  return { ok: true, value: { kind: "Files", files: FILES, diskChanges: [], operation, sides } };
}

test("a list sets the files, the operation and both names from the one reply", async () => {
  const target = listedBy([files(REBASE, SIDES), files(null, NO_NAMES)]);

  expect(await refreshFiles(target, "start")).toBe(FILES);
  expect([target.files.value, target.operation.value, target.sideNames.value]).toEqual([
    FILES,
    REBASE,
    SIDES,
  ]);

  await refreshFiles(target, "running");
  expect([target.operation.value, target.sideNames.value]).toEqual([null, NO_NAMES]);
  expect(target.ends).toEqual([]);
});

test("a list that finds git at another stop goes to the next stop and sets nothing itself", async () => {
  const target = listedBy([files(REBASE, SIDES), { ok: true, value: { kind: "MovedOn" } }]);
  await refreshFiles(target, "start");

  expect(await refreshFiles(target, "running")).toBeNull();

  expect(target.ends).toEqual([{ kind: "outside" }]);
  expect([target.files.value, target.operation.value, target.sideNames.value]).toEqual([
    FILES,
    REBASE,
    SIDES,
  ]);
});

test("a failed list is a list problem and keeps the operation and names it had", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const target = listedBy([files(REBASE, SIDES)]);
  await refreshFiles(target, "start");

  expect(await refreshFiles(target, "running")).toBeNull();

  expect(target.problem.value).toEqual({ action: "list", cause: { kind: "GitRunning" } });
  expect([target.operation.value, target.sideNames.value]).toEqual([REBASE, SIDES]);
  expect(target.ends).toEqual([]);
});
