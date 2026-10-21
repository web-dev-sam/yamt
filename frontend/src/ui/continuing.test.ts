import { afterEach, expect, test, vi } from "vitest";
import { shallowReactive, shallowRef, type ShallowRef } from "vue";

import type { ContinueReply, FileEntry, OperationView, SourceFailure, SourceResult } from "../ipc";
import { createAsking, type Asking } from "./asking";
import { createContinuing, type ContinueState, type Continuing } from "./continuing";
import type { Stop } from "./currentStop";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { claimWrite } from "./saving";
import type { StopEnd } from "./stops";

const LINUX = "Linux x86_64";

const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: { kind: "Branch", name: "main" },
  replaying: null,
  progress: { step: 1, total: 3 },
  editor_steps_ahead: false,
};
const REWORDS: OperationView = { ...REBASE, editor_steps_ahead: true };
const MERGE: OperationView = { kind: "Merge", merging: null, into: null };

const RESOLVED: FileEntry = { path: "a.ts", status: "Resolved", unsupported: null };
const LEFT: FileEntry = { path: "b.ts", status: "Unresolved", unsupported: null };

type Reply = SourceResult<ContinueReply>;

type Pressed = Continuing & {
  readonly asking: Asking;
  readonly files: ShallowRef<readonly FileEntry[]>;
  readonly operation: ShallowRef<OperationView | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly running: ShallowRef<boolean>;
  readonly writing: Map<string, { writes: number; overtaken: boolean }>;
  readonly calls: number[];
  readonly ends: StopEnd[];
  readonly lists: string[];
  readonly answers: ((reply: Reply) => void)[];
  unsaved: string[];
  stop: Stop;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function quiet(): string[] {
  const lines: string[] = [];
  for (const level of ["info", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: string) => {
      lines.push(line);
    });
  }
  return lines;
}

function continuing(
  operation: OperationView | null = REBASE,
  files: readonly FileEntry[] = [RESOLVED],
): Pressed {
  const calls: number[] = [];
  const answers: ((reply: Reply) => void)[] = [];
  const ends: StopEnd[] = [];
  const lists: string[] = [];
  const unsaved: string[] = [];
  const target = {
    asking: createAsking(),
    files: shallowRef(files),
    operation: shallowRef(operation),
    problem: shallowRef<Problem | null>(null),
    running: shallowRef(false),
    writing: shallowReactive(new Map<string, { writes: number; overtaken: boolean }>()),
    calls,
    ends,
    lists,
    answers,
    unsaved,
    stop: { dropped: false },
    source: {
      continueOperation: (): Promise<Reply> => {
        calls.push(calls.length + 1);
        return new Promise((resolve) => {
          answers.push(resolve);
        });
      },
    },
    guard: { unsavedFiles: () => [...target.unsaved] },
    nextStop: (end: StopEnd) => {
      ends.push(end);
      return Promise.resolve();
    },
    refreshFiles: () => {
      lists.push("list");
      return Promise.resolve();
    },
  };
  return Object.assign(target, createContinuing(target));
}

async function answered(press: Pressed, reply: Reply): Promise<void> {
  const pressed = press.continueOperation();
  await vi.waitFor(() => {
    expect(press.answers).toHaveLength(press.calls.length);
    expect(press.calls.length).toBeGreaterThan(0);
  });
  expect(press.continueState.value).toBe("running");
  press.answers.at(-1)?.(reply);
  await pressed;
}

test("no recorded operation is noOperation, and a press calls nothing", async () => {
  const press = continuing(null);

  expect(press.continueState.value).toBe("noOperation");
  expect(press.continueHover.value).toBeNull();
  await press.continueOperation();
  expect([press.calls, press.asking.question.value]).toEqual([[], null]);
});

test("files git lists as not resolved make it filesLeft, counted in the hover, and a press calls nothing", async () => {
  const press = continuing(REBASE, [RESOLVED, LEFT, { ...LEFT, path: "c.ts" }]);

  expect(press.continueState.value).toBe("filesLeft");
  expect(press.continueHover.value).toBe("2 files are not resolved yet");
  press.files.value = [RESOLVED, LEFT];
  expect(press.continueHover.value).toBe("1 file is not resolved yet");
  await press.continueOperation();
  expect(press.calls).toEqual([]);
});

test("a held write claim makes it writing until the write is done", async () => {
  const press = continuing();
  const done: (() => void)[] = [];
  const writing = claimWrite(
    press,
    "a.ts",
    () =>
      new Promise<void>((resolve) => {
        done.push(resolve);
      }),
  );

  expect(press.continueState.value).toBe("writing");
  expect(press.continueHover.value).toBe("Saving…");
  await press.continueOperation();
  expect(press.calls).toEqual([]);
  done[0]?.();
  await writing;
  expect(press.continueState.value).toBe("ready");
});

test("every file resolved, no write and git idle is ready, with no hover; a stop without files is ready too", () => {
  expect(continuing().continueState.value).toBe("ready");
  expect(continuing().continueHover.value).toBeNull();
  expect(continuing(REBASE, []).continueState.value).toBe("ready");
});

test("while git runs, Continue is running with the terminal hover and a second press calls nothing", async () => {
  const press = continuing();
  const pressed = press.continueOperation();
  await vi.waitFor(() => {
    expect(press.calls).toEqual([1]);
  });

  expect(press.continueState.value).toBe("running");
  expect(press.continueHover.value).toBe(
    "Continuing… (if nothing happens, git may be asking for something in the terminal that started yamt)",
  );
  await press.continueOperation();
  expect(press.calls).toEqual([1]);
  press.answers[0]?.({ ok: true, value: { kind: "Stopped", message: "" } });
  await pressed;
});

test.each([
  ["No", (asking: Asking) => asking.answer(false)],
  ["Escape", (asking: Asking) => asking.dismiss()],
])("unsaved edits ask first, naming the files; %s calls nothing", async (_name, decline) => {
  const press = continuing();
  press.unsaved = ["a.ts", "b.ts"];

  const pressed = press.continueOperation();
  expect(press.asking.question.value).toEqual({
    kind: "continueUnsaved",
    operation: "Rebase",
    files: ["a.ts", "b.ts"],
  });
  decline(press.asking);
  await pressed;

  expect([press.calls, press.continueState.value]).toEqual([[], "ready"]);
});

test("the reword question comes only with editor_steps_ahead, after the unsaved one; No calls nothing", async () => {
  const press = continuing(REWORDS);
  press.unsaved = ["a.ts"];

  const declined = press.continueOperation();
  expect(press.asking.question.value?.kind).toBe("continueUnsaved");
  press.asking.answer(true);
  await vi.waitFor(() => {
    expect(press.asking.question.value).toEqual({ kind: "rewords" });
  });
  press.asking.answer(false);
  await declined;
  expect(press.calls).toEqual([]);

  press.unsaved = [];
  const confirmed = press.continueOperation();
  expect(press.asking.question.value).toEqual({ kind: "rewords" });
  press.asking.answer(true);
  await vi.waitFor(() => {
    expect(press.calls).toEqual([1]);
  });
  press.answers[0]?.({ ok: true, value: { kind: "Stopped", message: "" } });
  await confirmed;
});

test("without editor steps and without unsaved edits Continue asks nothing", async () => {
  const press = continuing(MERGE);
  const pressed = press.continueOperation();

  expect(press.asking.question.value).toBeNull();
  await vi.waitFor(() => {
    expect(press.calls).toEqual([1]);
  });
  press.answers[0]?.({ ok: true, value: { kind: "Stopped", message: "" } });
  await pressed;
});

test("Stopped goes to the next stop with git's message, and only then is Continue ready again", async () => {
  const press = continuing();
  let stateAtNextStop: ContinueState | null = null;
  Object.assign(press, {
    nextStop: (end: StopEnd) => {
      press.ends.push(end);
      stateAtNextStop = press.continueState.value;
      return Promise.resolve();
    },
  });

  await answered(press, {
    ok: true,
    value: { kind: "Stopped", message: "CONFLICT (content): Merge conflict in b.ts" },
  });

  expect(press.ends).toEqual([
    { kind: "continued", message: "CONFLICT (content): Merge conflict in b.ts" },
  ]);
  expect(stateAtNextStop).toBe("running");
  expect(press.continueState.value).toBe("ready");
  expect(press.problem.value).toBeNull();
});

test("git's refusal is the problem naming the operation, the list is read again and Continue is ready again", async () => {
  const lines = quiet();
  const refused: SourceFailure = { kind: "Git", message: "hook says no\n" };
  const press = continuing();

  await answered(press, { ok: false, failure: refused });

  const problem = press.problem.value;
  expect(problem).toEqual({ action: "continue", operation: "Rebase", cause: refused });
  expect(problem === null ? null : problemText(problem, LINUX)).toBe(
    "Could not continue the rebase: hook says no",
  );
  expect(lines).toEqual([
    `[error] store.continue_failed {operation: "Rebase", kind: "Git", message: "hook says no\\n"}`,
  ]);
  expect([press.lists, press.ends, press.continueState.value]).toEqual([["list"], [], "ready"]);
});

test("another failure is reported through problemText without reading the list again", async () => {
  quiet();
  const press = continuing(MERGE);

  await answered(press, { ok: false, failure: { kind: "GitRunning" } });

  expect(press.problem.value).toEqual({
    action: "continue",
    operation: "Merge",
    cause: { kind: "GitRunning" },
  });
  expect([press.lists, press.continueState.value]).toEqual([[], "ready"]);
});

test("StopMovedOn goes on to the stop git is at instead of showing a problem", async () => {
  const press = continuing();

  await answered(press, { ok: false, failure: { kind: "StopMovedOn" } });

  expect([press.ends, press.problem.value, press.lists]).toEqual([[{ kind: "outside" }], null, []]);
  expect(press.continueState.value).toBe("ready");
});

test("Finished is logged and Continue stays running: the window is closing", async () => {
  const lines = quiet();
  const press = continuing();

  await answered(press, { ok: true, value: { kind: "Finished" } });

  expect(lines).toEqual(['[info] continue.finished {operation: "Rebase"}']);
  expect([press.ends, press.problem.value, press.continueState.value]).toEqual([
    [],
    null,
    "running",
  ]);
});

test("a reply after its stop was dropped changes nothing but the running state", async () => {
  const press = continuing();
  const pressed = press.continueOperation();
  await vi.waitFor(() => {
    expect(press.calls).toEqual([1]);
  });
  press.stop.dropped = true;
  press.answers[0]?.({ ok: false, failure: { kind: "Git", message: "late" } });
  await pressed;

  expect([press.problem.value, press.ends, press.lists]).toEqual([null, [], []]);
  expect(press.continueState.value).toBe("ready");
});
