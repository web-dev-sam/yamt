import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isAgentRun, type AgentRun, type HostEvent } from "./domain";
import { createTauriAgentSource } from "./index";
import type { Log } from "./log";

const commands = vi.hoisted(() => ({
  prepareCheckout: vi.fn(),
  startAgent: vi.fn(),
  sendToAgent: vi.fn(),
  stopAgent: vi.fn(),
  checkoutChanges: vi.fn(),
  discardCheckout: vi.fn(),
  diffTexts: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor(readonly onmessage: (message: unknown) => void) {}
  },
}));

const LOG: Log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function run(n: number): AgentRun {
  if (!isAgentRun(n)) {
    throw new Error(String(n));
  }
  return n;
}

function ok<T>(data: T): { status: "ok"; data: T } {
  return { status: "ok", data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("startAgent sends the command in the app's shape and hands every channel event on", async () => {
  const seen: HostEvent[] = [];
  commands.startAgent.mockImplementation(
    async (
      _command: Generated.AgentCommand,
      channel: { onmessage: (event: HostEvent) => void },
    ) => {
      channel.onmessage({ kind: "Message", text: "{}" });
      channel.onmessage({ kind: "Exited", code: 1 });
      return ok({ kind: "Started", run: 3 });
    },
  );
  const reply = await createTauriAgentSource(LOG).startAgent(
    { program: "omp", args: ["acp"], homeFolders: [".bun/bin"] },
    (event) => seen.push(event),
  );
  expect(commands.startAgent.mock.calls[0]?.[0]).toEqual({
    program: "omp",
    args: ["acp"],
    home_folders: [".bun/bin"],
  });
  expect(reply).toEqual({ ok: true, value: { kind: "Started", run: 3 } });
  expect(seen).toEqual([
    { kind: "Message", text: "{}" },
    { kind: "Exited", code: 1 },
  ]);
});

test("a start that did not start comes back unchanged", async () => {
  const notFound = { kind: "NotFound", program: "omp", searched: ["/usr/bin"] };
  commands.startAgent.mockResolvedValue(ok(notFound));
  expect(
    await createTauriAgentSource(LOG).startAgent(
      { program: "omp", args: [], homeFolders: [] },
      () => undefined,
    ),
  ).toEqual({ ok: true, value: notFound });
});

test("a run that is not a non-negative integer is refused", async () => {
  commands.startAgent.mockResolvedValue(ok({ kind: "Started", run: -1 }));
  await expect(
    createTauriAgentSource(LOG).startAgent(
      { program: "omp", args: [], homeFolders: [] },
      () => undefined,
    ),
  ).rejects.toThrow("run must be a non-negative safe integer, got -1");
});

test("prepareCheckout brands an absolute folder and refuses a relative one", async () => {
  commands.prepareCheckout.mockResolvedValue(ok({ kind: "Ready", folder: "/data/checkout" }));
  expect(await createTauriAgentSource(LOG).prepareCheckout()).toEqual({
    ok: true,
    value: { kind: "Ready", folder: "/data/checkout" },
  });
  commands.prepareCheckout.mockResolvedValue(ok({ kind: "Ready", folder: "C:\\data\\checkout" }));
  expect((await createTauriAgentSource(LOG).prepareCheckout()).ok).toBe(true);
  commands.prepareCheckout.mockResolvedValue(ok({ kind: "Failed", message: "no git" }));
  expect(await createTauriAgentSource(LOG).prepareCheckout()).toEqual({
    ok: true,
    value: { kind: "Failed", message: "no git" },
  });
  commands.prepareCheckout.mockResolvedValue(ok({ kind: "Ready", folder: "data/checkout" }));
  await expect(createTauriAgentSource(LOG).prepareCheckout()).rejects.toThrow(
    "folder must be an absolute path, got data/checkout",
  );
});

test.each<[Generated.CheckoutLook, object]>([
  [{ kind: "Missing" }, { kind: "Missing" }],
  [{ kind: "Clean" }, { kind: "Clean" }],
  [
    {
      kind: "Changed",
      folder: "/data/checkout",
      files: ["a.ts"],
      refs: ["ai", "stash"],
      head_moved: true,
    },
    {
      kind: "Changed",
      folder: "/data/checkout",
      files: ["a.ts"],
      refs: { branches: ["ai"], stash: true },
      headMoved: true,
    },
  ],
  [
    { kind: "Unreadable", folder: "/data/checkout", message: "bad object" },
    { kind: "Unreadable", folder: "/data/checkout", message: "bad object" },
  ],
])("checkoutChanges converts %j", async (look, expected) => {
  commands.checkoutChanges.mockResolvedValue(ok(look));
  expect(await createTauriAgentSource(LOG).checkoutChanges()).toEqual({
    ok: true,
    value: expected,
  });
});

test("checkoutChanges refuses a relative folder", async () => {
  commands.checkoutChanges.mockResolvedValue(ok({ kind: "Unreadable", folder: "x", message: "m" }));
  await expect(createTauriAgentSource(LOG).checkoutChanges()).rejects.toThrow(
    "folder must be an absolute path, got x",
  );
});

test("sendToAgent is fire and forget; a failure is logged", async () => {
  commands.sendToAgent.mockResolvedValueOnce(ok(null));
  commands.sendToAgent.mockResolvedValueOnce({ status: "error", error: { kind: "AiOff" } });
  commands.sendToAgent.mockRejectedValueOnce(new Error("gone"));
  const source = createTauriAgentSource(LOG);
  source.sendToAgent(run(2), "a");
  source.sendToAgent(run(2), "b");
  source.sendToAgent(run(2), "c");
  await vi.waitFor(() => expect(LOG.warn).toHaveBeenCalledTimes(2));
  expect(commands.sendToAgent.mock.calls).toEqual([
    [2, "a"],
    [2, "b"],
    [2, "c"],
  ]);
  expect(LOG.warn).toHaveBeenNthCalledWith(1, "agent.send_failed", {
    run: 2,
    failure: '{"kind":"AiOff"}',
  });
  expect(LOG.warn).toHaveBeenNthCalledWith(2, "agent.send_failed", {
    run: 2,
    failure: "Error: gone",
  });
});

test("stopAgent waits for the app and logs a failure", async () => {
  commands.stopAgent.mockResolvedValue({ status: "error", error: { kind: "AiOff" } });
  await createTauriAgentSource(LOG).stopAgent(run(4));
  expect(commands.stopAgent).toHaveBeenCalledWith(4);
  expect(LOG.warn).toHaveBeenCalledWith("agent.stop_failed", {
    run: 4,
    failure: '{"kind":"AiOff"}',
  });
});

test("diffTexts brands the differences; discard and failures come back unchanged", async () => {
  const difference: Generated.Difference = {
    left: { start: 1, len: 0 },
    right: { start: 1, len: 2 },
    words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
  };
  commands.diffTexts.mockResolvedValue(ok([difference]));
  expect(await createTauriAgentSource(LOG).diffTexts("a", "b")).toEqual({
    ok: true,
    value: [difference],
  });
  expect(commands.diffTexts).toHaveBeenCalledWith("a", "b");
  commands.diffTexts.mockResolvedValue({
    status: "error",
    error: { kind: "ColumnTooLarge", limit: 8 },
  });
  expect(await createTauriAgentSource(LOG).diffTexts("a", "b")).toEqual({
    ok: false,
    failure: { kind: "ColumnTooLarge", limit: 8 },
  });
  commands.discardCheckout.mockResolvedValue({
    status: "error",
    error: { kind: "RemoveFailed", folder: "/c", message: "busy" },
  });
  expect(await createTauriAgentSource(LOG).discardCheckout()).toEqual({
    ok: false,
    failure: { kind: "RemoveFailed", folder: "/c", message: "busy" },
  });
});
