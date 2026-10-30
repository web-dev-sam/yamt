import { afterEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import type { PushReply, SourceResult } from "../ipc";
import { createAsking, type Asking } from "./asking";
import { createGitRun, type GitRun } from "./gitRun";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { createPushing } from "./pushing";

const LINUX = "Linux x86_64";
const BRANCH = "feature/due-dates";
const REJECTED = "[rejected] (fetch first)";
const PUSHED: SourceResult<PushReply> = { ok: true, value: { kind: "pushed" } };
const FAILED: SourceResult<PushReply> = {
  ok: true,
  value: { kind: "failed", message: REJECTED },
};

type Offered = {
  readonly asking: Asking;
  readonly gitRun: GitRun;
  readonly calls: string[];
  readonly problem: { value: Problem | null };
  readonly stop: { dropped: boolean };
  readonly done: Promise<void>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function offered(
  pushes: SourceResult<PushReply>[],
  closeReply: SourceResult<null> = { ok: true, value: null },
): Offered {
  const asking = createAsking();
  const gitRun = createGitRun();
  const calls: string[] = [];
  const problem = shallowRef<Problem | null>(null);
  const stop = { dropped: false };
  const { offerPush } = createPushing({
    stop,
    asking,
    gitRun,
    problem,
    source: {
      pushMergedBranch: () => {
        calls.push("push");
        return Promise.resolve(pushes.shift() ?? PUSHED);
      },
      closeEndedMerge: () => {
        calls.push("close");
        return Promise.resolve(closeReply);
      },
    },
  });
  return { asking, gitRun, calls, problem, stop, done: offerPush(BRANCH, "Merge") };
}

async function asked(offer: Offered): Promise<void> {
  await vi.waitFor(() => {
    expect(offer.asking.question.value).not.toBeNull();
  });
}

test("Push pushes once", async () => {
  const offer = offered([PUSHED]);

  expect(offer.asking.question.value).toEqual({ kind: "push", branch: BRANCH });
  offer.asking.answer(true);
  await offer.done;

  expect(offer.calls).toEqual(["push"]);
  expect(offer.asking.question.value).toBeNull();
});

test.each<[string, (asking: Asking) => void]>([
  ["Keep Local", (asking) => asking.answer(false)],
  ["Escape", (asking) => asking.dismiss()],
])("Escape and Keep Local never push: %s closes the ended merge instead", async (_name, keep) => {
  const offer = offered([PUSHED]);

  keep(offer.asking);
  await offer.done;

  expect(offer.calls).toEqual(["close"]);
});

test("a failure asks again with git's words, and Keep Local then pushes nothing more", async () => {
  const offer = offered([FAILED]);

  offer.asking.answer(true);
  await asked(offer);
  expect(offer.asking.question.value).toEqual({
    kind: "pushFailed",
    branch: BRANCH,
    message: REJECTED,
  });
  expect(offer.gitRun.running.value).toBe(false);
  offer.asking.dismiss();
  await offer.done;

  expect(offer.calls).toEqual(["push", "close"]);
});

test("a failure asks again and Push Again pushes a second time", async () => {
  const offer = offered([FAILED, PUSHED]);

  offer.asking.answer(true);
  await asked(offer);
  offer.asking.answer(true);
  await offer.done;

  expect(offer.calls).toEqual(["push", "push"]);
});

test("Pushed ends the app: git stays running and nothing else is asked or closed", async () => {
  const offer = offered([PUSHED]);

  offer.asking.answer(true);
  await offer.done;

  expect([offer.gitRun.running.value, offer.asking.question.value]).toEqual([true, null]);
  expect(offer.calls).toEqual(["push"]);
});

test("Keep Local closes once and the window stays ended", async () => {
  const offer = offered([]);

  offer.asking.answer(false);
  await offer.done;

  expect(offer.calls).toEqual(["close"]);
  expect(offer.gitRun.running.value).toBe(true);
  expect(offer.problem.value).toBeNull();
});

test("a push the app refuses is the continue problem, then Keep Local's path closes the merge", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const offer = offered([{ ok: false, failure: { kind: "WorkerStopped" } }]);

  offer.asking.answer(true);
  await offer.done;

  expect(offer.calls).toEqual(["push", "close"]);
  const { problem } = offer;
  expect(problem.value).toEqual({
    action: "continue",
    operation: "Merge",
    cause: { kind: "WorkerStopped" },
  });
  expect(problem.value === null ? null : problemText(problem.value, LINUX)).toBe(
    "Could not commit the merge: yamt's worker stopped; try again.",
  );
});

test("a push answered after its stop was dropped asks nothing more and closes nothing", async () => {
  const offer = offered([FAILED]);

  offer.stop.dropped = true;
  offer.asking.answer(true);
  await offer.done;

  expect([offer.calls, offer.asking.question.value, offer.problem.value]).toEqual([
    ["push"],
    null,
    null,
  ]);
});

test("a close the app refuses is the continue problem and the window can be used again", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const offer = offered([], { ok: false, failure: { kind: "WorkerStopped" } });

  offer.asking.answer(false);
  await offer.done;

  expect(offer.problem.value).toEqual({
    action: "continue",
    operation: "Merge",
    cause: { kind: "WorkerStopped" },
  });
  expect(offer.gitRun.running.value).toBe(false);
});
