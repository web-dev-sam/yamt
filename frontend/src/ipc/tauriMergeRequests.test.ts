import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isJobPage, isMergeRequestIid } from "./domain";
import type { MergeRequestPage } from "./mergeRequestDomain";
import { createTauriMergeRequests } from "./tauriMergeRequests";
import { branded } from "./validate";

const commands = vi.hoisted(() => ({
  findGitlabProject: vi.fn(),
  listMergeRequests: vi.fn(),
  openMergeRequest: vi.fn(),
  openJobPage: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor(readonly onmessage: (message: unknown) => void) {}
  },
}));

type PageChannel = { onmessage: (page: Generated.MergeRequestPage) => void };

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
};

const STOPPED = { kind: "WorkerStopped" };

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

test("each page from the channel reaches the callback converted, then the end (catches a time left as text)", async () => {
  commands.listMergeRequests.mockImplementation(async (channel: PageChannel) => {
    channel.onmessage({ me: "sam", rows: [ROW] });
    channel.onmessage({ me: "sam", rows: [] });
    return { status: "ok", data: { kind: "cut", limit: 500 } };
  });
  const pages: MergeRequestPage[] = [];

  const end = await createTauriMergeRequests().listMergeRequests((page) => pages.push(page));

  expect(pages).toEqual([
    { me: "sam", rows: [{ ...ROW, createdAt: Date.UTC(2026, 9, 29, 8) }] },
    { me: "sam", rows: [] },
  ]);
  expect(end).toEqual({ ok: true, value: { kind: "cut", limit: 500 } });
});

test("an unreadable page fails the load after the pages before it arrived (catches it lost in the channel)", async () => {
  commands.listMergeRequests.mockImplementation(async (channel: PageChannel) => {
    channel.onmessage({ me: null, rows: [ROW] });
    channel.onmessage({ me: null, rows: [{ ...ROW, createdAt: "soon" }] });
    channel.onmessage({ me: null, rows: [] });
    return { status: "ok", data: { kind: "loaded" } };
  });
  const pages: MergeRequestPage[] = [];

  await expect(
    createTauriMergeRequests().listMergeRequests((page) => pages.push(page)),
  ).rejects.toThrow('rows[0].createdAt must be an ISO 8601 time, got "soon"');
  expect(pages.map((page) => page.rows.length)).toEqual([1, 0]);
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

test("a job page is passed as it came and its answer comes back", async () => {
  const page = "https://gitlab.example/x/-/jobs/7";
  if (!isJobPage(page)) {
    throw new Error("not a job page");
  }
  commands.openJobPage.mockResolvedValue({ kind: "notOffered" });

  expect(await createTauriMergeRequests().openJobPage(page)).toEqual({
    ok: true,
    value: { kind: "notOffered" },
  });
  expect(commands.openJobPage).toHaveBeenCalledWith(page);
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
