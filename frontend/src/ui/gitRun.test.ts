import { expect, test, vi } from "vitest";

import type { SourceResult } from "../ipc";
import { createGitRun } from "./gitRun";
import type { Outcome } from "./problem";

type Ending = "ends" | "goesOn";

function held(): {
  readonly call: () => Promise<SourceResult<Ending>>;
  readonly answers: ((reply: SourceResult<Ending>) => void)[];
} {
  const answers: ((reply: SourceResult<Ending>) => void)[] = [];
  return {
    call: () =>
      new Promise((resolve) => {
        answers.push(resolve);
      }),
    answers,
  };
}

async function ran(
  reply: SourceResult<Ending>,
  dropped = false,
): Promise<{ running: boolean; landed: Outcome<Ending>[]; runningAtLanding: boolean[] }> {
  const git = createGitRun();
  const { call, answers } = held();
  const stop = { dropped: false };
  const landed: Outcome<Ending>[] = [];
  const runningAtLanding: boolean[] = [];
  const running = git.run(stop, {
    call,
    endsApp: (value) => value === "ends",
    landing: (outcome) => {
      landed.push(outcome);
      runningAtLanding.push(git.running.value);
      return Promise.resolve();
    },
  });
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  expect(git.running.value).toBe(true);
  stop.dropped = dropped;
  answers[0]?.(reply);
  await running;
  return { running: git.running.value, landed, runningAtLanding };
}

test("a success that ends the app keeps git running after its landing", async () => {
  expect(await ran({ ok: true, value: "ends" })).toEqual({
    running: true,
    landed: [{ ok: true, value: "ends" }],
    runningAtLanding: [true],
  });
});

test("a success that does not end the app is landed while running, then git is idle", async () => {
  expect(await ran({ ok: true, value: "goesOn" })).toEqual({
    running: false,
    landed: [{ ok: true, value: "goesOn" }],
    runningAtLanding: [true],
  });
});

test("a refusal is landed while running, then git is idle", async () => {
  expect(await ran({ ok: false, failure: { kind: "GitRunning" } })).toEqual({
    running: false,
    landed: [{ ok: false, cause: { kind: "GitRunning" } }],
    runningAtLanding: [true],
  });
});

test("a reply after its stop was dropped lands nothing, even one that would end the app", async () => {
  expect(await ran({ ok: true, value: "ends" }, true)).toEqual({
    running: false,
    landed: [],
    runningAtLanding: [],
  });
});
