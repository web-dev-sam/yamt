import { beforeEach, expect, test, vi } from "vitest";

import { isMergeRequestIid } from "./domain";
import type { ContinueMergeReply, LocalMerge, ResolveReply } from "./mergeRequestDomain";
import { createTauriMergeRequests } from "./tauriMergeRequests";
import { branded } from "./validate";

const commands = vi.hoisted(() => ({
  resolveMergeRequest: vi.fn(),
  continueMergeRequest: vi.fn(),
  findLocalMerge: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({ Channel: class {} }));

const STOPPED = { kind: "WorkerStopped" };
const IID = branded(21, isMergeRequestIid, "iid");

beforeEach(() => {
  vi.resetAllMocks();
});

test("resolving passes the iid and its reply comes back as the app sent it", async () => {
  const reply: ResolveReply = {
    kind: "refused",
    refusal: {
      kind: "gitRefused",
      message: "error: boom",
      left: [{ kind: "branchCheckedOut", branch: "feature/x" }],
    },
  };
  commands.resolveMergeRequest.mockResolvedValue({ status: "ok", data: reply });

  expect(await createTauriMergeRequests().resolveMergeRequest(IID)).toEqual({
    ok: true,
    value: reply,
  });
  expect(commands.resolveMergeRequest).toHaveBeenCalledWith(21);
});

test("continuing passes the iid and its reply comes back as the app sent it", async () => {
  const reply: ContinueMergeReply = { kind: "opened", branch: "feature/x", target: "main" };
  commands.continueMergeRequest.mockResolvedValue({ status: "ok", data: reply });

  expect(await createTauriMergeRequests().continueMergeRequest(IID)).toEqual({
    ok: true,
    value: reply,
  });
  expect(commands.continueMergeRequest).toHaveBeenCalledWith(21);
});

test("the local merge comes back as the app found it", async () => {
  const merging: LocalMerge = { kind: "merging", iid: 21, windowOpen: true };
  commands.findLocalMerge.mockResolvedValue({ status: "ok", data: merging });

  expect(await createTauriMergeRequests().findLocalMerge()).toEqual({ ok: true, value: merging });
});

test.each(["resolveMergeRequest", "continueMergeRequest", "findLocalMerge"] as const)(
  "a %s failure comes back unchanged",
  async (name) => {
    commands[name].mockResolvedValue({ status: "error", error: STOPPED });
    const source = createTauriMergeRequests();
    const calls = {
      resolveMergeRequest: () => source.resolveMergeRequest(IID),
      continueMergeRequest: () => source.continueMergeRequest(IID),
      findLocalMerge: () => source.findLocalMerge(),
    };
    expect(await calls[name]()).toEqual({ ok: false, failure: STOPPED });
  },
);
