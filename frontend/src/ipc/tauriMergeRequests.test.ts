import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import {
  isDiscussionId,
  isMergeRequestIid,
  isWebPage,
  type DiscussionId,
  type WebPage,
} from "./domain";
import type { CheckedRow, MergeRequestPage } from "./mergeRequestDomain";
import { createTauriMergeRequests, PICTURE_SCHEME } from "./tauriMergeRequests";
import { branded } from "./validate";

const commands = vi.hoisted(() => ({
  findGitlabProject: vi.fn(),
  askGitlabAgain: vi.fn(),
  listMergeRequests: vi.fn(),
  openMergeRequest: vi.fn(),
  openPage: vi.fn(),
  rerequestReview: vi.fn(),
  readJobLog: vi.fn(),
  readDiscussions: vi.fn(),
  searchPeople: vi.fn(),
  changePeople: vi.fn(),
  readDescription: vi.fn(),
  readLinks: vi.fn(),
  readDiscussionThread: vi.fn(),
  replyToDiscussion: vi.fn(),
  resolveDiscussion: vi.fn(),
  submitReview: vi.fn(),
  previewMarkdown: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor(readonly onmessage: (message: unknown) => void) {}
  },
  convertFileSrc: (path: string, protocol: string) => `${protocol}://localhost/${path}`,
}));

type MessageChannel = { onmessage: (message: Generated.ListMessage) => void };

const ROW: Generated.MergeRequestRow = {
  iid: 12,
  title: "Show overdue cards in red",
  hasDescription: true,
  createdAt: "2026-10-29T08:00:00Z",
  draft: false,
  author: null,
  assignees: [],
  reviewers: [
    {
      person: { username: "anna", name: "Anna Berg", picture: { kind: "none" } },
      state: "requested",
    },
  ],
  labels: [],
  openDiscussions: 0,
  approvedBy: [],
  mayRerequest: true,
  pipeline: null,
  page: null,
  size: null,
  readiness: { kind: "blocked", reason: { kind: "other", status: "MERGE_TRAIN_STUCK" } },
  fromFork: false,
};

const STOPPED = { kind: "WorkerStopped" };
const JOB_PAGE = "https://gitlab.example/x/-/jobs/9000";
const UPLOAD = "upload~00000000000000000000000000000001";
const MICROTASKS = 10;
const D01 = "0000000000000000000000000000000000000001";
const D02 = "0000000000000000000000000000000000000002";
const ANNA_RAW: Generated.Person = {
  username: "anna",
  name: "Anna Berg",
  picture: { kind: "none" },
};
const SAM_MENTION: Generated.Mention = { username: "sam", name: "Sam Weller" };

function discussionId(text: string): DiscussionId {
  if (!isDiscussionId(text)) {
    throw new Error("not a discussion id");
  }
  return text;
}

function jobPage(): WebPage {
  if (!isWebPage(JOB_PAGE)) {
    throw new Error("not a web page");
  }
  return JOB_PAGE;
}

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

function unchecked(): void {
  throw new Error("no checked row was expected");
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

test("askGitLabAgain_calls_the_command", async () => {
  commands.askGitlabAgain.mockResolvedValue({ status: "ok", data: null });
  expect(await createTauriMergeRequests().askGitLabAgain()).toEqual({ ok: true, value: null });
  expect(commands.askGitlabAgain).toHaveBeenCalledTimes(1);
  expect(commands.askGitlabAgain).toHaveBeenCalledWith();
});

test("each page from the channel reaches the callback converted, then the end message ends the load (catches a time left as text)", async () => {
  commands.listMergeRequests.mockImplementation(async (channel: MessageChannel) => {
    channel.onmessage(page([ROW]));
    channel.onmessage(page([]));
    channel.onmessage(end({ kind: "cut", limit: 500 }));
    return { status: "ok", data: null };
  });
  const pages: MergeRequestPage[] = [];

  const ended = await createTauriMergeRequests().listMergeRequests(
    (got) => pages.push(got),
    unchecked,
  );

  expect(pages).toEqual([
    {
      me: "sam",
      rows: [
        {
          ...ROW,
          createdAt: Date.UTC(2026, 9, 29, 8),
          reviewers: [
            { person: { username: "anna", name: "Anna Berg", picture: null }, state: "requested" },
          ],
        },
      ],
    },
    { me: "sam", rows: [] },
  ]);
  expect(ended).toEqual({ ok: true, value: { kind: "cut", limit: 500 } });
});

test("a page that arrives after the command resolved is still in the load, which ends only on the end message (catches the command's answer taken as the end)", async () => {
  const held = heldChannel();
  const pages: MergeRequestPage[] = [];
  let answer: unknown = null;
  const loading = createTauriMergeRequests()
    .listMergeRequests((got) => pages.push(got), unchecked)
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

test("a_checked_message_after_the_end_reaches_onChecked_converted, and a page after the end still reaches nobody (catches checked rows dropped with late pages)", async () => {
  const held = heldChannel();
  const pages: MergeRequestPage[] = [];
  const checked: CheckedRow[] = [];
  const loading = createTauriMergeRequests().listMergeRequests(
    (got) => pages.push(got),
    (row) => checked.push(row),
  );
  await settled();

  held.channel().onmessage(page([ROW]));
  held.channel().onmessage(end({ kind: "loaded" }));
  expect(await loading).toEqual({ ok: true, value: { kind: "loaded" } });
  held
    .channel()
    .onmessage({ kind: "checked", row: { iid: 12, readiness: { kind: "mergesCleanly" } } });
  held.channel().onmessage(page([ROW]));

  expect(checked).toEqual([
    { iid: branded(12, isMergeRequestIid, "iid"), readiness: { kind: "mergesCleanly" } },
  ]);
  expect(pages).toHaveLength(1);
});

test("an unreadable page fails the load even after the command resolved, and no page is passed on after it (catches it lost in the channel)", async () => {
  const held = heldChannel();
  const pages: MergeRequestPage[] = [];
  const loading = createTauriMergeRequests().listMergeRequests((got) => pages.push(got), unchecked);
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

  const ended = await createTauriMergeRequests().listMergeRequests(
    (got) => pages.push(got),
    unchecked,
  );
  held.channel().onmessage(page([ROW]));

  expect(ended).toEqual({ ok: false, failure: STOPPED });
  expect(pages).toEqual([]);
});

test("a command that throws fails the load", async () => {
  commands.listMergeRequests.mockRejectedValue(new Error("no app"));

  await expect(
    createTauriMergeRequests().listMergeRequests(() => undefined, unchecked),
  ).rejects.toThrow("no app");
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

test("the_uploaded_picture_address_is_convertFileSrc_of_the_username_and_the_scheme, in a listed page", async () => {
  const uploaded: Generated.Person = {
    username: "ben",
    name: "Ben Okafor",
    picture: { kind: "uploaded" },
  };
  commands.listMergeRequests.mockImplementation(async (channel: MessageChannel) => {
    channel.onmessage(page([{ ...ROW, author: uploaded }]));
    channel.onmessage(end({ kind: "loaded" }));
    return { status: "ok", data: null };
  });
  const pages: MergeRequestPage[] = [];

  await createTauriMergeRequests().listMergeRequests((got) => pages.push(got), unchecked);

  expect(PICTURE_SCHEME).toBe("yamt-picture");
  expect(pages[0]?.rows[0]?.author?.picture).toBe("yamt-picture://localhost/ben");
});

test("rerequestReview calls the command with the iid and the username and converts the reply's reviewers", async () => {
  const uploaded: Generated.Person = {
    username: "ben",
    name: "Ben Okafor",
    picture: { kind: "uploaded" },
  };
  commands.rerequestReview.mockResolvedValue({
    status: "ok",
    data: { kind: "requested", reviewers: [{ person: uploaded, state: "requested" }] },
  });

  const reply = await createTauriMergeRequests().rerequestReview(
    branded(52, isMergeRequestIid, "iid"),
    "ben",
  );

  expect(commands.rerequestReview).toHaveBeenCalledWith(52, "ben");
  expect(reply).toEqual({
    ok: true,
    value: {
      kind: "requested",
      reviewers: [
        {
          person: { username: "ben", name: "Ben Okafor", picture: "yamt-picture://localhost/ben" },
          state: "requested",
        },
      ],
    },
  });
});

test("a refused re-request comes back as GitLab said it", async () => {
  commands.rerequestReview.mockResolvedValue({
    status: "ok",
    data: { kind: "refused", message: "Reviewer not found" },
  });
  expect(
    await createTauriMergeRequests().rerequestReview(branded(52, isMergeRequestIid, "iid"), "x"),
  ).toEqual({ ok: true, value: { kind: "refused", message: "Reviewer not found" } });
});

test("searchPeople_and_changePeople_call_their_commands_with_the_arguments", async () => {
  const ben: Generated.Person = {
    username: "ben",
    name: "Ben Okafor",
    picture: { kind: "uploaded" },
  };
  const benConverted = {
    username: "ben",
    name: "Ben Okafor",
    picture: "yamt-picture://localhost/ben",
  };
  commands.searchPeople.mockResolvedValue({
    status: "ok",
    data: { kind: "found", people: [ben] },
  });
  commands.changePeople.mockResolvedValue({
    status: "ok",
    data: {
      kind: "changed",
      people: { assignees: [ben], reviewers: [{ person: ben, state: "requested" }] },
    },
  });
  const source = createTauriMergeRequests();
  const change = { group: "reviewers", action: "add", username: "ben" } as const;

  const found = await source.searchPeople("be");
  const changed = await source.changePeople(branded(52, isMergeRequestIid, "iid"), change);

  expect(commands.searchPeople).toHaveBeenCalledWith("be");
  expect(commands.changePeople).toHaveBeenCalledWith(52, change);
  expect(found).toEqual({ ok: true, value: { kind: "found", people: [benConverted] } });
  expect(changed).toEqual({
    ok: true,
    value: {
      kind: "changed",
      people: {
        assignees: [benConverted],
        reviewers: [{ person: benConverted, state: "requested" }],
      },
    },
  });
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

test("readJobLog_calls_the_command_with_the_page_and_returns_its_reply", async () => {
  const page = jobPage();
  const reply: Generated.JobLogReply = {
    kind: "log",
    log: { text: "\u001b[31mError\u001b[0m\r\n", cut: true },
  };
  commands.readJobLog.mockResolvedValue({ status: "ok", data: reply });

  expect(await createTauriMergeRequests().readJobLog(page)).toEqual({ ok: true, value: reply });
  expect(commands.readJobLog).toHaveBeenCalledWith(page);
});

test("readDescription_calls_the_command_with_the_iid_and_converts_the_reply", async () => {
  const reply: Generated.DescriptionReply = {
    kind: "read",
    description: {
      blocks: [
        { kind: "paragraph", inlines: [{ kind: "text", text: "Hello" }] },
        {
          kind: "paragraph",
          inlines: [
            {
              kind: "image",
              image: { kind: "uploaded", key: UPLOAD },
              caption: "shot",
              size: { kind: "width", width: { kind: "percent", value: 40 } },
            },
            {
              kind: "link",
              link: { kind: "page", page: "http://docs.example/x" },
              inlines: [{ kind: "text", text: "docs" }],
            },
          ],
        },
      ],
    },
  };
  commands.readDescription.mockResolvedValue({ status: "ok", data: reply });

  expect(
    await createTauriMergeRequests().readDescription(branded(12, isMergeRequestIid, "iid")),
  ).toEqual({ ok: true, value: reply });
  expect(commands.readDescription).toHaveBeenCalledWith(12);
});

test("readDescription_throws_on_a_linked_page_that_is_not_http", async () => {
  commands.readDescription.mockResolvedValue({
    status: "ok",
    data: {
      kind: "read",
      description: {
        blocks: [
          {
            kind: "paragraph",
            inlines: [{ kind: "link", link: { kind: "page", page: "javascript:x" }, inlines: [] }],
          },
        ],
      },
    },
  });

  await expect(
    createTauriMergeRequests().readDescription(branded(12, isMergeRequestIid, "iid")),
  ).rejects.toThrow('link.page must be an http or https address, got "javascript:x"');
});

test("readLinks_calls_the_command_with_the_iid_and_brands_the_pages", async () => {
  const commit: Generated.LinkedCommit = {
    reference: "fa3335f3",
    page: "https://gitlab.example/g/p/-/commit/fa3335f3",
    title: null,
  };
  const epic: Generated.LinkedEpic = {
    reference: "&3",
    page: "https://gitlab.example/groups/g/-/epics/3",
    shown: null,
  };
  const reply: Generated.LinksReply = {
    kind: "read",
    links: { epics: [epic], issues: [], commits: [commit] },
  };
  commands.readLinks.mockResolvedValue({ status: "ok", data: reply });
  const source = createTauriMergeRequests();

  expect(await source.readLinks(branded(12, isMergeRequestIid, "iid"))).toEqual({
    ok: true,
    value: reply,
  });
  expect(commands.readLinks).toHaveBeenCalledWith(12);

  const unbranded: Generated.LinksReply = {
    kind: "read",
    links: { epics: [], issues: [], commits: [{ ...commit, page: "http://x" }] },
  };
  commands.readLinks.mockResolvedValue({ status: "ok", data: unbranded });
  await expect(source.readLinks(branded(12, isMergeRequestIid, "iid"))).rejects.toThrow(
    'links.commits[0].page must be an https address, got "http://x"',
  );
});

test("uploadedImage_is_the_picture_scheme_address_of_the_key", () => {
  expect(createTauriMergeRequests().uploadedImage(UPLOAD)).toBe(
    "yamt-picture://localhost/upload~00000000000000000000000000000001",
  );
});

test("readDiscussions_calls_the_command_with_the_iids_and_converts_each_row", async () => {
  const note = "https://gitlab.example/x/-/merge_requests/12#note_7001";
  const rows: Generated.RowDiscussions[] = [
    {
      iid: 12,
      answer: {
        kind: "open",
        discussions: [
          {
            id: D01,
            place: { kind: "file", path: "src/a.ts", line: 4 },
            earlier: [{ author: ANNA_RAW, mentions: [SAM_MENTION] }],
            last: {
              author: { username: "ben", name: "Ben Okafor", picture: { kind: "uploaded" } },
              createdAt: "2026-10-29T09:00:00Z",
              text: "**not bold**",
              page: note,
              mentions: [SAM_MENTION],
            },
          },
          {
            id: D02,
            place: { kind: "overview" },
            earlier: [],
            last: {
              author: null,
              createdAt: "2026-10-29T10:00:00Z",
              text: "x",
              page: null,
              mentions: [],
            },
          },
        ],
      },
    },
    { iid: 13, answer: { kind: "notLoggedIn", detail: "gitlab.example" } },
  ];
  commands.readDiscussions.mockResolvedValue({ status: "ok", data: rows });
  const iids = [branded(12, isMergeRequestIid, "iid"), branded(13, isMergeRequestIid, "iid")];

  expect(await createTauriMergeRequests().readDiscussions(iids)).toEqual({
    ok: true,
    value: [
      {
        iid: 12,
        answer: {
          kind: "open",
          discussions: [
            {
              id: D01,
              place: { kind: "file", path: "src/a.ts", line: 4 },
              earlier: [
                {
                  author: { username: "anna", name: "Anna Berg", picture: null },
                  mentions: [SAM_MENTION],
                },
              ],
              last: {
                author: {
                  username: "ben",
                  name: "Ben Okafor",
                  picture: "yamt-picture://localhost/ben",
                },
                createdAt: Date.parse("2026-10-29T09:00:00Z"),
                text: "**not bold**",
                page: note,
                mentions: [SAM_MENTION],
              },
            },
            {
              id: D02,
              place: { kind: "overview" },
              earlier: [],
              last: {
                author: null,
                createdAt: Date.parse("2026-10-29T10:00:00Z"),
                text: "x",
                page: null,
                mentions: [],
              },
            },
          ],
        },
      },
      { iid: 13, answer: { kind: "notLoggedIn", detail: "gitlab.example" } },
    ],
  });
  expect(commands.readDiscussions).toHaveBeenCalledWith([12, 13]);
});

test.each([
  [
    "a time that is not ISO 8601",
    { createdAt: "yesterday" },
    /rows\[0\]\.answer\.discussions\[0\]\.last\.createdAt/u,
  ],
  [
    "a page that is not https",
    { page: "http://gitlab.example/x" },
    /rows\[0\]\.answer\.discussions\[0\]\.last\.page/u,
  ],
] as const)("readDiscussions throws on %s, naming the field", async (_, change, field) => {
  const last = {
    author: null,
    createdAt: "2026-10-29T09:00:00Z",
    text: "x",
    page: null,
    mentions: [],
  };
  commands.readDiscussions.mockResolvedValue({
    status: "ok",
    data: [
      {
        iid: 12,
        answer: {
          kind: "open",
          discussions: [
            { id: D01, place: { kind: "overview" }, earlier: [], last: { ...last, ...change } },
          ],
        },
      },
    ],
  });

  await expect(
    createTauriMergeRequests().readDiscussions([branded(12, isMergeRequestIid, "iid")]),
  ).rejects.toThrow(field);
});

test("readDiscussions throws on a negative iid, naming the row", async () => {
  commands.readDiscussions.mockResolvedValue({
    status: "ok",
    data: [
      { iid: 12, answer: { kind: "glabMissing" } },
      { iid: -1, answer: { kind: "glabMissing" } },
    ],
  });

  await expect(
    createTauriMergeRequests().readDiscussions([branded(12, isMergeRequestIid, "iid")]),
  ).rejects.toThrow(/rows\[1\]\.iid/u);
});

test.each([
  ["askGitlabAgain", { kind: "WorkerStopped" }],
  ["listMergeRequests", { kind: "WorkerStopped" }],
  ["openMergeRequest", { kind: "WorkerStopped" }],
  ["rerequestReview", { kind: "WorkerStopped" }],
  ["readJobLog", { kind: "WorkerStopped" }],
  ["readDiscussions", { kind: "WorkerStopped" }],
  ["searchPeople", { kind: "WorkerStopped" }],
  ["changePeople", { kind: "WorkerStopped" }],
  ["readDescription", { kind: "WorkerStopped" }],
  ["readLinks", { kind: "WorkerStopped" }],
  ["readDiscussionThread", { kind: "WorkerStopped" }],
  ["replyToDiscussion", { kind: "WorkerStopped" }],
  ["resolveDiscussion", { kind: "WorkerStopped" }],
  ["submitReview", { kind: "WorkerStopped" }],
  ["previewMarkdown", { kind: "WorkerStopped" }],
] as const)("a %s failure comes back unchanged", async (name, failure) => {
  commands[name].mockResolvedValue({ status: "error", error: failure });
  const source = createTauriMergeRequests();
  const one = branded(1, isMergeRequestIid, "iid");
  const calls = {
    askGitlabAgain: () => source.askGitLabAgain(),
    listMergeRequests: () => source.listMergeRequests(() => undefined, unchecked),
    openMergeRequest: () => source.openMergeRequest(one),
    rerequestReview: () => source.rerequestReview(one, "anna"),
    readJobLog: () => source.readJobLog(jobPage()),
    readDiscussions: () => source.readDiscussions([one]),
    searchPeople: () => source.searchPeople("an"),
    changePeople: () =>
      source.changePeople(one, {
        group: "assignees",
        action: "remove",
        username: "anna",
      }),
    readDescription: () => source.readDescription(one),
    readLinks: () => source.readLinks(one),
    readDiscussionThread: () => source.readDiscussionThread(one, discussionId(D01)),
    replyToDiscussion: () => source.replyToDiscussion(one, discussionId(D01), "comment", "x"),
    resolveDiscussion: () => source.resolveDiscussion(one, discussionId(D01), true),
    submitReview: () => source.submitReview(one),
    previewMarkdown: () => source.previewMarkdown(one, "x"),
  };
  expect(await calls[name]()).toEqual({ ok: false, failure: STOPPED });
});

test("each_thread_method_calls_its_command_with_its_arguments", async () => {
  const iid = branded(12, isMergeRequestIid, "iid");
  const d01 = discussionId(D01);
  const source = createTauriMergeRequests();
  const ben: Generated.Person = {
    username: "ben",
    name: "Ben Okafor",
    picture: { kind: "uploaded" },
  };
  const link: Generated.DescriptionInline = {
    kind: "link",
    link: { kind: "page", page: "https://docs.example/board" },
    inlines: [{ kind: "text", text: "docs" }],
  };
  const body: Generated.Description = { blocks: [{ kind: "paragraph", inlines: [link] }] };
  const last = {
    author: ben,
    createdAt: "2026-11-02T10:00:00Z",
    text: "x",
    page: null,
    mentions: [],
  };
  commands.readDiscussionThread.mockResolvedValue({
    status: "ok",
    data: {
      kind: "read",
      thread: {
        discussion: { id: D01, place: { kind: "overview" }, earlier: [], last },
        resolved: false,
        comments: [
          {
            author: ben,
            createdAt: "2026-11-02T10:00:00Z",
            edited: { at: "2026-11-02T11:00:00Z", by: ben },
            body,
            page: null,
          },
        ],
        drafts: [],
        pending: 0,
        commenting: "allowed",
        mayResolve: true,
      },
    },
  });
  const read = await source.readDiscussionThread(iid, d01);
  expect(commands.readDiscussionThread).toHaveBeenCalledWith(12, D01);
  const shownBen = { username: "ben", name: "Ben Okafor", picture: "yamt-picture://localhost/ben" };
  expect(read).toMatchObject({
    ok: true,
    value: {
      kind: "read",
      thread: {
        discussion: { last: { author: shownBen, createdAt: Date.UTC(2026, 10, 2, 10) } },
        comments: [{ author: shownBen, edited: { at: Date.UTC(2026, 10, 2, 11), by: shownBen } }],
      },
    },
  });

  commands.replyToDiscussion.mockResolvedValue({ status: "ok", data: { kind: "sent" } });
  expect(await source.replyToDiscussion(iid, d01, "draft", "Looks good")).toEqual({
    ok: true,
    value: { kind: "sent" },
  });
  expect(commands.replyToDiscussion).toHaveBeenCalledWith(12, D01, "draft", "Looks good");

  const refused = { kind: "refused", reason: "403 Forbidden" };
  commands.resolveDiscussion.mockResolvedValue({ status: "ok", data: refused });
  expect(await source.resolveDiscussion(iid, d01, false)).toEqual({ ok: true, value: refused });
  expect(commands.resolveDiscussion).toHaveBeenCalledWith(12, D01, false);

  commands.submitReview.mockResolvedValue({ status: "ok", data: { kind: "glabMissing" } });
  expect(await source.submitReview(iid)).toEqual({ ok: true, value: { kind: "glabMissing" } });
  expect(commands.submitReview).toHaveBeenCalledWith(12);

  commands.previewMarkdown.mockResolvedValue({
    status: "ok",
    data: { kind: "read", preview: body },
  });
  expect(await source.previewMarkdown(iid, "**Preview**")).toEqual({
    ok: true,
    value: { kind: "read", preview: body },
  });
  expect(commands.previewMarkdown).toHaveBeenCalledWith(12, "**Preview**");
});

test("a_thread_or_preview_with_a_bad_page_throws_naming_it", async () => {
  const iid = branded(12, isMergeRequestIid, "iid");
  const bad: Generated.Description = {
    blocks: [
      {
        kind: "paragraph",
        inlines: [{ kind: "link", link: { kind: "page", page: "javascript:x" }, inlines: [] }],
      },
    ],
  };
  commands.previewMarkdown.mockResolvedValue({
    status: "ok",
    data: { kind: "read", preview: bad },
  });
  await expect(createTauriMergeRequests().previewMarkdown(iid, "x")).rejects.toThrow(
    "preview.link.page must be an http or https address",
  );
  commands.readDiscussionThread.mockResolvedValue({
    status: "ok",
    data: {
      kind: "read",
      thread: {
        discussion: {
          id: "d01",
          place: { kind: "overview" },
          earlier: [],
          last: {
            author: null,
            createdAt: "2026-11-02T10:00:00Z",
            text: "x",
            page: null,
            mentions: [],
          },
        },
        resolved: false,
        comments: [],
        drafts: [],
        pending: 0,
        commenting: "allowed",
        mayResolve: true,
      },
    },
  });
  await expect(
    createTauriMergeRequests().readDiscussionThread(iid, discussionId(D01)),
  ).rejects.toThrow('thread.discussion.id must be 40 lowercase hex digits, got "d01"');
});
