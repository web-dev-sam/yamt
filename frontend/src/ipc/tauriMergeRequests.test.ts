import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isMergeRequestIid, isWebPage } from "./domain";
import type { MergeRequestPage } from "./mergeRequestDomain";
import { createTauriMergeRequests } from "./tauriMergeRequests";
import { branded } from "./validate";

const commands = vi.hoisted(() => ({
  findGitlabProject: vi.fn(),
  listMergeRequests: vi.fn(),
  openMergeRequest: vi.fn(),
  openPage: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor(readonly onmessage: (message: unknown) => void) {}
  },
}));

type MessageChannel = { onmessage: (message: Generated.ListMessage) => void };

const ROW: Generated.MergeRequestRow = {
  iid: 12,
  title: "Show overdue cards in red",
  createdAt: "2026-10-29T08:00:00Z",
  draft: false,
  assignees: [],
  reviewers: [{ username: "anna", name: "Anna Berg" }],
  labels: [],
  openDiscussions: 0,
  approvals: 2,
  pipeline: null,
  page: null,
};

const STOPPED = { kind: "WorkerStopped" };
const MICROTASKS = 10;

function page(rows: Generated.MergeRequestRow[]): Generated.ListMessage {
  return { kind: "page", page: { me: "sam", rows } };
}

function end(listEnd: Generated.ListEnd): Generated.ListMessage {
  return { kind: "end", end: listEnd };
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < MICROTASKS; turn += 1) {
    await Promise.resolve();
  }
}

function heldChannel(reply: unknown = { status: "ok", data: null }): {
  readonly channel: () => MessageChannel;
} {
  let held: MessageChannel | null = null;
  commands.listMergeRequests.mockImplementation(async (channel: MessageChannel) => {
    held = channel;
    return reply;
  });
  return {
    channel: () => {
      if (held === null) {
        throw new Error("the list command was not called");
      }
      return held;
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("the project comes back as GitLab answered it", async () => {
  commands.findGitlabProject.mockResolvedValue({ kind: "found", repository: "/r/.git" });
  expect(await createTauriMergeRequests().findGitLabProject()).toEqual({
    ok: true,
    value: { kind: "found", repository: "/r/.git" },
  });
});

test("each page from the channel reaches the callback converted, then the end message ends the load (catches a time left as text)", async () => {
  commands.listMergeRequests.mockImplementation(async (channel: MessageChannel) => {
    channel.onmessage(page([ROW]));
    channel.onmessage(page([]));
    channel.onmessage(end({ kind: "cut", limit: 500 }));
    return { status: "ok", data: null };
  });
  const pages: MergeRequestPage[] = [];

  const ended = await createTauriMergeRequests().listMergeRequests((got) => pages.push(got));

  expect(pages).toEqual([
    { me: "sam", rows: [{ ...ROW, createdAt: Date.UTC(2026, 9, 29, 8) }] },
    { me: "sam", rows: [] },
  ]);
  expect(ended).toEqual({ ok: true, value: { kind: "cut", limit: 500 } });
});

test("a page that arrives after the command resolved is still in the load, which ends only on the end message (catches the command's answer taken as the end)", async () => {
  const held = heldChannel();
  const pages: MergeRequestPage[] = [];
  let answer: unknown = null;
  const loading = createTauriMergeRequests()
    .listMergeRequests((got) => pages.push(got))
    .then((result) => {
      answer = result;
      return result;
    });
  await settled();
  expect(answer).toBeNull();

  held.channel().onmessage(page([ROW]));
  await settled();
  expect(pages).toHaveLength(1);
  expect(answer).toBeNull();

  held.channel().onmessage(end({ kind: "loaded" }));
  expect(await loading).toEqual({ ok: true, value: { kind: "loaded" } });
  held.channel().onmessage(page([ROW]));
  expect(pages).toHaveLength(1);
});

test("an unreadable page fails the load even after the command resolved, and no page is passed on after it (catches it lost in the channel)", async () => {
  const held = heldChannel();
  const pages: MergeRequestPage[] = [];
  const loading = createTauriMergeRequests().listMergeRequests((got) => pages.push(got));
  await settled();

  held.channel().onmessage(page([ROW]));
  held.channel().onmessage(page([{ ...ROW, createdAt: "soon" }]));
  held.channel().onmessage(page([]));
  held.channel().onmessage(end({ kind: "loaded" }));

  await expect(loading).rejects.toThrow('rows[0].createdAt must be an ISO 8601 time, got "soon"');
  expect(pages.map((got) => got.rows.length)).toEqual([1]);
});

test("an IPC failure of the command ends the load as that failure, and a later page is not passed on", async () => {
  const held = heldChannel({ status: "error", error: STOPPED });
  const pages: MergeRequestPage[] = [];

  const ended = await createTauriMergeRequests().listMergeRequests((got) => pages.push(got));
  held.channel().onmessage(page([ROW]));

  expect(ended).toEqual({ ok: false, failure: STOPPED });
  expect(pages).toEqual([]);
});

test("a command that throws fails the load", async () => {
  commands.listMergeRequests.mockRejectedValue(new Error("no app"));

  await expect(createTauriMergeRequests().listMergeRequests(() => undefined)).rejects.toThrow(
    "no app",
  );
});

test("opening passes the iid and camelCases a missing commit", async () => {
  commands.openMergeRequest.mockResolvedValue({
    status: "ok",
    data: { kind: "missingCommit", short_id: "531ea52" },
  });

  const reply = await createTauriMergeRequests().openMergeRequest(
    branded(13, isMergeRequestIid, "iid"),
  );

  expect(commands.openMergeRequest).toHaveBeenCalledWith(13);
  expect(reply).toEqual({ ok: true, value: { kind: "missingCommit", shortId: "531ea52" } });
});

test("a page is passed as it came and its answer comes back", async () => {
  const page = "https://gitlab.example/x/-/merge_requests/7";
  if (!isWebPage(page)) {
    throw new Error("not a web page");
  }
  commands.openPage.mockResolvedValue({ kind: "notOffered" });

  expect(await createTauriMergeRequests().openPage(page)).toEqual({
    ok: true,
    value: { kind: "notOffered" },
  });
  expect(commands.openPage).toHaveBeenCalledWith(page);
});

test.each([
  ["listMergeRequests", { kind: "WorkerStopped" }],
  ["openMergeRequest", { kind: "WorkerStopped" }],
] as const)("a %s failure comes back unchanged", async (name, failure) => {
  commands[name].mockResolvedValue({ status: "error", error: failure });
  const source = createTauriMergeRequests();
  const calls = {
    listMergeRequests: () => source.listMergeRequests(() => undefined),
    openMergeRequest: () => source.openMergeRequest(branded(1, isMergeRequestIid, "iid")),
  };
  expect(await calls[name]()).toEqual({ ok: false, failure: STOPPED });
});
