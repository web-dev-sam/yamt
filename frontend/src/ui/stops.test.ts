import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import {
  loadFixture,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type OperationView,
} from "../ipc";
import type { Notice } from "./noticeText";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { claimWrite } from "./saving";
import type { Screen } from "./screen";
import type { Taken } from "./sides";
import { nextStop, type StopTarget } from "./stops";

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

type Stop = StopTarget & {
  readonly lists: number[];
  readonly operation: ShallowRef<OperationView | null>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function stopAt(
  unsaved: readonly string[],
  nextFiles: readonly FileEntry[] | null = [
    { path: "c.ts", status: "Unresolved", unsupported: null },
  ],
): Stop {
  const lists: number[] = [];
  const stop: Stop = {
    lists,
    opened: shallowRef<readonly FileMergeData[]>([
      { ...MAGIC_KEYS, path: "a.ts" },
      { ...MAGIC_KEYS, path: "b.ts" },
    ]),
    choices: shallowRef<readonly FileSides[]>([LOGO]),
    problem: shallowRef<Problem | null>({ action: "list", cause: { kind: "GitRunning" } }),
    writing: new Map(),
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
    active: shallowRef<string | null>("a.ts"),
    screen: shallowRef<Screen>({ kind: "serverLog", name: "oxlint" }),
    operation: shallowRef<OperationView | null>(REBASE),
    guard: { unsavedFiles: () => [...unsaved] },
    latestOpen: 4,
    loadFiles: () => {
      lists.push(stop.latestOpen);
      stop.operation.value = NEXT_STEP;
      if (nextFiles !== null) {
        stop.active.value = nextFiles[0]?.path ?? null;
      }
      return Promise.resolve(nextFiles);
    },
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

test("a write still running for the old stop is dropped: its claim is gone and marked overtaken", async () => {
  quiet();
  const stop = stopAt([]);
  const claims: { overtaken: boolean; dropped: boolean }[] = [];
  const releases: (() => void)[] = [];
  const writing = claimWrite(stop, "a.ts", async (claim) => {
    await new Promise<void>((resolve) => {
      releases.push(resolve);
    });
    claims.push({ overtaken: claim.overtaken, dropped: claim.dropped });
  });

  await nextStop(stop, { kind: "outside" });
  expect(stop.writing.size).toBe(0);
  releases[0]?.();
  await writing;

  expect(claims).toEqual([{ overtaken: true, dropped: true }]);
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
  const stop = stopAt([], []);

  await nextStop(stop, { kind: "continued", message: "error: could not apply 8b4e7d0\n" });

  const problem = stop.problem.value;
  expect(problem).toEqual({
    action: "stopped",
    operation: "Rebase",
    message: "error: could not apply 8b4e7d0\n",
  });
  expect(problem === null ? null : problemText(problem, LINUX)).toBe(
    "The rebase stopped: error: could not apply 8b4e7d0",
  );
});

test("continued to a stop with files, or one whose list failed, shows no message", async () => {
  quiet();
  const listed = stopAt([]);
  const failed = stopAt([], null);

  await nextStop(listed, { kind: "continued", message: "CONFLICT (content)" });
  await nextStop(failed, { kind: "continued", message: "CONFLICT (content)" });

  expect([listed.problem.value, failed.problem.value]).toEqual([null, null]);
});
