import { expect, test, vi } from "vitest";

import type {
  HostEvent,
  ProgramFound,
  ProjectFile,
  RunId,
  ServerCommand,
  ServerContext,
  ServerHost,
  StartReply,
} from "../../ipc";
import { Attempt, type AttemptEvents } from "./attempt";
import { SYSTEM_TIMERS } from "./timers";

function isRunId(n: number): n is RunId {
  return Number.isSafeInteger(n);
}

function runId(n: number): RunId {
  if (!isRunId(n)) {
    throw new Error("bad run id");
  }
  return n;
}

const RUN = runId(7);

const COMMAND: ServerCommand = { program: "x", args: [], project: "" };

class FakeHost implements ServerHost {
  readonly sent: [RunId, string][] = [];
  readonly stopped: RunId[] = [];
  reply: () => Promise<StartReply>;
  emit: (event: HostEvent) => void = () => undefined;

  constructor(reply: StartReply) {
    this.reply = () => Promise.resolve(reply);
  }

  context(): Promise<ServerContext> {
    return Promise.resolve({ root: "/repo", process_id: 1 });
  }

  start(_: ServerCommand, onEvent: (event: HostEvent) => void): Promise<StartReply> {
    this.emit = onEvent;
    return this.reply();
  }

  send(run: RunId, message: string): void {
    this.sent.push([run, message]);
  }

  stop(run: RunId): Promise<void> {
    this.stopped.push(run);
    return Promise.resolve();
  }

  findProgram(): Promise<ProgramFound> {
    return Promise.resolve({ kind: "NotFound", searched: [] });
  }

  projectFiles(): Promise<readonly ProjectFile[]> {
    return Promise.resolve([]);
  }
}

function attempt(host: ServerHost, events: Partial<AttemptEvents> = {}): Attempt {
  return new Attempt({
    host,
    timers: SYSTEM_TIMERS,
    answers: { settings: null, folder: { uri: "file:///repo", name: "repo" } },
    events: { log: () => undefined, exited: () => undefined, docs: () => null, ...events },
  });
}

test("an attempt sends nothing until the host started its run", async () => {
  const refused = new FakeHost({ kind: "SpawnFailed", program: "x", message: "no" });
  const never = attempt(refused);
  never.connection.notify("early", null);
  await never.start(COMMAND);
  never.connection.notify("never started", null);
  expect(refused.sent).toEqual([]);

  const started = new FakeHost({ kind: "Started", run: RUN });
  const running = attempt(started);
  await running.start(COMMAND);
  running.connection.notify("hello", null);

  expect(started.sent).toEqual([[RUN, expect.stringContaining('"hello"')]]);
});

test("a host that throws while starting is a spawn failure with its message", async () => {
  const host = new FakeHost({ kind: "SpawnFailed", program: "x", message: "unused" });
  host.reply = () => Promise.reject(new Error("channel closed"));

  expect(await attempt(host).start(COMMAND)).toEqual({
    kind: "SpawnFailed",
    program: "x",
    message: "Error: channel closed",
  });
});

test("an exit closes the connection, logs the code and reports it, so a stop does not stop it again", async () => {
  const host = new FakeHost({ kind: "Started", run: RUN });
  const log = vi.fn();
  const exited = vi.fn();
  const exiting = attempt(host, { log, exited });
  await exiting.start(COMMAND);
  const pending = exiting.connection.request("shutdown", undefined, 2000);

  host.emit({ kind: "Exited", code: 3 });

  expect(await pending).toEqual({ kind: "closed" });
  expect(log).toHaveBeenCalledWith("yamt", "Exited with code 3");
  expect(exited).toHaveBeenCalledWith(3);
  await exiting.stop(true);
  expect(host.stopped).toEqual([]);
});
