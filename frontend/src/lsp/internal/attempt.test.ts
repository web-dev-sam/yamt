import { expect, test, vi } from "vitest";

import type { RunId, ServerHost } from "../../ipc";
import { Attempt } from "./attempt";
import { Connection } from "./connection";
import { SYSTEM_TIMERS } from "./timers";

function isRunId(n: number): n is RunId {
  return Number.isSafeInteger(n);
}

function host(send: ServerHost["send"]): ServerHost {
  return {
    context: () => Promise.resolve({ root: "/repo", process_id: 1 }),
    start: () => Promise.resolve({ kind: "SpawnFailed", program: "x", message: "unused" }),
    send,
    stop: () => Promise.resolve(),
    findProgram: () => Promise.resolve({ kind: "NotFound", searched: [] }),
    projectFiles: () => Promise.resolve([]),
  };
}

function attempt(send: ServerHost["send"]): Attempt {
  return new Attempt(
    host(send),
    (self) =>
      new Connection(
        {
          send: (text) => self.send(text),
          request: () => ({ kind: "result", value: null, log: null }),
          notification: () => undefined,
          log: () => undefined,
        },
        SYSTEM_TIMERS,
      ),
  );
}

test("an attempt sends nothing until the host started its run", async () => {
  const send = vi.fn();
  const pending = attempt(send);
  pending.send("early");
  pending.markStarted(null);
  pending.send("never started");
  expect(send).not.toHaveBeenCalled();
  expect(await pending.started).toBeNull();

  const run = 7;
  if (!isRunId(run)) {
    throw new Error("7 is a run id");
  }
  const started = attempt(send);
  started.markStarted(run);
  started.send("hello");

  expect(send).toHaveBeenCalledWith(run, "hello");
  expect(await started.started).toBe(run);
});

test("markExited resolves exited and is remembered", async () => {
  const exited = attempt(vi.fn());
  expect(exited.hasExited).toBe(false);
  exited.markExited();

  expect(exited.hasExited).toBe(true);
  await expect(exited.exited).resolves.toBeUndefined();
});
