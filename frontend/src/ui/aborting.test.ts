import { afterEach, expect, test, vi } from "vitest";
import { shallowRef, type ShallowRef } from "vue";

import type { AbortReply, MergeView, OperationView, SourceFailure, SourceResult } from "../ipc";
import { createAborting, type Aborting } from "./aborting";
import { createAsking, type Asking } from "./asking";
import type { Stop } from "./currentStop";
import { createGitRun } from "./gitRun";
import type { Problem } from "./problem";
import { problemText } from "./problemText";

const LINUX = "Linux x86_64";

const REBASE: OperationView = {
  kind: "Rebase",
  branch: "feature",
  onto: { kind: "Branch", name: "main" },
  replaying: null,
  progress: { step: 2, total: 3 },
  editor_steps_ahead: false,
};

const DUE_DATES: MergeView = {
  branch: "feature/due-dates",
  target: "main",
  returnTo: { kind: "commit", id: "9b0d4e1" },
  branchBefore: { kind: "movedFrom", id: "3f1c2a9" },
};

const CLEAN: SourceResult<AbortReply> = { ok: true, value: { leftovers: [] } };

type Pressed = Aborting & {
  readonly asking: Asking;
  readonly operation: ShallowRef<OperationView | null>;
  readonly mergeRequest: ShallowRef<MergeView | null>;
  readonly problem: ShallowRef<Problem | null>;
  readonly ends: string[];
  readonly closes: string[];
  stop: Stop;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function aborting(
  abortOperation: () => Promise<SourceResult<AbortReply>>,
  operation: OperationView | null = REBASE,
  mergeRequest: MergeView | null = null,
  closeReply: SourceResult<null> = { ok: true, value: null },
): Pressed {
  const asking = createAsking();
  const ends: string[] = [];
  const closes: string[] = [];
  const target = {
    source: {
      abortOperation,
      closeEndedMerge: () => {
        closes.push("closeEndedMerge");
        return Promise.resolve(closeReply);
      },
    },
    asking,
    operation: shallowRef(operation),
    mergeRequest: shallowRef(mergeRequest),
    problem: shallowRef<Problem | null>(null),
    ends,
    closes,
    stop: { dropped: false },
    gitRun: createGitRun(),
    nextStop: (end: { readonly kind: "outside" }) => {
      ends.push(end.kind);
      return Promise.resolve();
    },
  };
  return Object.assign(target, createAborting(target));
}

async function pressUnasked(abort: Pressed): Promise<void> {
  const pressed = abort.abortOperation();
  expect(abort.asking.question.value).toBeNull();
  abort.asking.dismiss();
  await pressed;
}

test("without a recorded operation there is no Abort: the state is none and a press asks nothing", async () => {
  let aborts = 0;
  const abort = aborting(() => {
    aborts += 1;
    return Promise.resolve(CLEAN);
  }, null);

  expect(abort.abortState.value).toEqual({ kind: "none" });
  await pressUnasked(abort);
  expect(aborts).toBe(0);
});

test("the state follows the operation git lists", () => {
  const abort = aborting(() => Promise.resolve(CLEAN), null);

  abort.operation.value = REBASE;
  expect(abort.abortState.value).toEqual({ kind: "ready", operation: REBASE });
  abort.operation.value = null;
  expect(abort.abortState.value).toEqual({ kind: "none" });
});

test("Abort asks about the operation and calls git only after a yes; No and Escape change nothing", async () => {
  let aborts = 0;
  const abort = aborting(() => {
    aborts += 1;
    return Promise.resolve(CLEAN);
  });

  const declined = abort.abortOperation();
  expect(abort.asking.question.value).toEqual({
    kind: "abort",
    operation: REBASE,
    mergeRequest: null,
  });
  abort.asking.answer(false);
  await declined;
  const escaped = abort.abortOperation();
  abort.asking.dismiss();
  await escaped;
  expect(aborts).toBe(0);
  expect(abort.abortState.value.kind).toBe("ready");

  const confirmed = abort.abortOperation();
  abort.asking.answer(true);
  await confirmed;

  expect(aborts).toBe(1);
  expect(abort.abortState.value).toEqual({ kind: "running", operation: REBASE });
  expect(abort.problem.value).toBeNull();
  await pressUnasked(abort);
  expect([aborts, abort.closes]).toEqual([1, []]);
});

test("git's refusal names the operation, logs it, and a later press asks again", async () => {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.push(line);
  });
  const refused: SourceFailure = { kind: "Git", message: "error: Entry 'a.ts' not uptodate." };
  let aborts = 0;
  const abort = aborting(() => {
    aborts += 1;
    return Promise.resolve({ ok: false, failure: refused });
  });

  const refusing = abort.abortOperation();
  abort.asking.answer(true);
  await refusing;

  const problem = abort.problem.value;
  expect(problem).toEqual({ action: "abort", operation: "Rebase", cause: refused });
  expect(problem === null ? null : problemText(problem, LINUX)).toBe(
    "Could not abort the rebase: error: Entry 'a.ts' not uptodate.",
  );
  expect(lines).toEqual([
    `[error] store.abort_failed {operation: "Rebase", kind: "Git", message: ${JSON.stringify(refused.message)}}`,
  ]);
  expect(abort.abortState.value.kind).toBe("ready");

  const again = abort.abortOperation();
  expect(abort.asking.question.value).toEqual({
    kind: "abort",
    operation: REBASE,
    mergeRequest: null,
  });
  abort.asking.answer(true);
  await again;
  expect(aborts).toBe(2);
});

test("an abort git answers StopMovedOn goes on to the new stop and shows no problem", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const abort = aborting(() => Promise.resolve({ ok: false, failure: { kind: "StopMovedOn" } }));

  const refusing = abort.abortOperation();
  abort.asking.answer(true);
  await refusing;

  expect([abort.problem.value, abort.ends]).toEqual([null, ["outside"]]);
  expect(abort.abortState.value.kind).toBe("ready");
});

test("an abort answered after its stop was dropped reports nothing and lists nothing", async () => {
  const answers: ((reply: SourceResult<AbortReply>) => void)[] = [];
  const abort = aborting(
    () =>
      new Promise((resolve) => {
        answers.push(resolve);
      }),
  );

  const pressed = abort.abortOperation();
  abort.asking.answer(true);
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  abort.stop.dropped = true;
  answers[0]?.({ ok: false, failure: { kind: "StopMovedOn" } });
  await pressed;

  expect([abort.problem.value, abort.ends]).toEqual([null, []]);
  expect(abort.abortState.value.kind).toBe("ready");
});

const MERGING: OperationView = { kind: "Merge", merging: null, into: null };

const LEFT: AbortReply = {
  leftovers: [
    { kind: "notReturned", to: { kind: "commit", id: "9b0d4e1" } },
    { kind: "branchKept", branch: "feature/due-dates" },
  ],
};

test("a recorded merge's Abort asks with its merge request, and without leftovers ends as today", async () => {
  const abort = aborting(() => Promise.resolve(CLEAN), MERGING, DUE_DATES);

  const pressed = abort.abortOperation();
  expect(abort.asking.question.value).toEqual({
    kind: "abort",
    operation: MERGING,
    mergeRequest: DUE_DATES,
  });
  abort.asking.answer(true);
  await pressed;

  expect([abort.asking.question.value, abort.closes]).toEqual([null, []]);
  expect(abort.abortState.value.kind).toBe("running");
});

test.each<[string, (abort: Pressed) => void]>([
  ["Close", (abort) => abort.asking.answer(true)],
  ["Escape", (abort) => abort.asking.dismiss()],
])(
  "leftovers show the notice behind running git; %s closes the ended merge once and the window stays ended",
  async (_name, close) => {
    const abort = aborting(() => Promise.resolve({ ok: true, value: LEFT }), MERGING, DUE_DATES);

    const pressed = abort.abortOperation();
    abort.asking.answer(true);
    await vi.waitFor(() => {
      expect(abort.asking.question.value).toEqual({
        kind: "abortLeftovers",
        mergeRequest: DUE_DATES,
        leftovers: LEFT.leftovers,
      });
    });
    expect(abort.closes).toEqual([]);
    expect(abort.abortState.value.kind).toBe("running");
    close(abort);
    await pressed;

    expect([abort.closes, abort.problem.value]).toEqual([["closeEndedMerge"], null]);
    expect(abort.abortState.value.kind).toBe("running");
  },
);

test("a close that fails is the closeMerge problem of the pressed merge and the window can be used again", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const abort = aborting(() => Promise.resolve({ ok: true, value: LEFT }), MERGING, DUE_DATES, {
    ok: false,
    failure: { kind: "WorkerStopped" },
  });

  const pressed = abort.abortOperation();
  abort.asking.answer(true);
  await vi.waitFor(() => {
    expect(abort.asking.question.value?.kind).toBe("abortLeftovers");
  });
  abort.asking.answer(true);
  await pressed;

  const problem = abort.problem.value;
  expect(problem).toEqual({
    action: "closeMerge",
    merge: DUE_DATES,
    cause: { kind: "WorkerStopped" },
  });
  expect(problem === null ? null : problemText(problem, LINUX)).toBe(
    "Could not close the merge of main into feature/due-dates: yamt's worker stopped; try again.",
  );
  expect(abort.abortState.value.kind).toBe("ready");
});

test("leftovers without a recorded merge ask nothing and still close the ended merge", async () => {
  const abort = aborting(() => Promise.resolve({ ok: true, value: LEFT }), MERGING, null);

  const pressed = abort.abortOperation();
  abort.asking.answer(true);
  await pressed;

  expect([abort.asking.question.value, abort.closes]).toEqual([null, ["closeEndedMerge"]]);
});
