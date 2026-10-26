import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toGitLabCheck, toSendReply, toThreadAdded, toThreadList } from "./reviewDomain";
import { changedThreadLine, fromThreadLine, toThreadLine, unchangedThreadLine } from "./threadLine";

const MERGE_REQUEST: Generated.MergeRequestRef = {
  reference: "!12",
  title: "Reminders",
  web_url: "https://gitlab.example.com/t/-/merge_requests/12",
};

const CAMEL_MERGE_REQUEST = {
  reference: "!12",
  title: "Reminders",
  webUrl: "https://gitlab.example.com/t/-/merge_requests/12",
};

function thread(posting: Generated.Posting, body?: Generated.MessageBody): Generated.Thread {
  return {
    id: 3,
    file: 7,
    line: { kind: "removed", left: 19 },
    messages: [{ id: 9, body: body ?? { kind: "note", text: "Why?" }, written: 1700, posting }],
    session: null,
  };
}

const LIST: Generated.ThreadList = { threads: [thread({ kind: "notQueued" })] };

test.each<[Generated.Posting, unknown]>([
  [{ kind: "notQueued" }, { kind: "notQueued" }],
  [
    { kind: "queued", text: "Edited" },
    { kind: "queued", text: "Edited" },
  ],
  [
    { kind: "refused", text: "Edited", reason: "400 Bad request" },
    { kind: "refused", text: "Edited", reason: "400 Bad request" },
  ],
  [
    {
      kind: "pending",
      text: "Edited",
      draft_note: 55,
      merge_request: "!12",
      link: "https://x/diffs",
    },
    {
      kind: "pending",
      text: "Edited",
      draftNote: 55,
      mergeRequest: "!12",
      link: "https://x/diffs",
    },
  ],
])("posting %j comes out camelCased", (posting, expected) => {
  expect(toThreadList({ threads: [thread(posting)] })).toEqual({
    threads: [
      {
        id: 3,
        file: 7,
        line: { kind: "removed", left: 19 },
        messages: [
          { id: 9, body: { kind: "note", text: "Why?" }, written: 1700, posting: expected },
        ],
        session: null,
      },
    ],
  });
});

test.each<Generated.MessageBody>([
  { kind: "note", text: "Why?" },
  { kind: "aiAnswer", session: "s1", turn: 2 },
])("message body %j is kept as it came", (body) => {
  const [converted] = toThreadList({ threads: [thread({ kind: "notQueued" }, body)] }).threads;

  expect(converted?.messages[0]?.body).toEqual(body);
});

test("a thread keeps its session and every line kind", () => {
  const lines: Generated.ThreadLine[] = [
    { kind: "removed", left: 1 },
    { kind: "added", right: 2 },
    { kind: "unchangedOnLeft", left: 3, right: 4 },
    { kind: "unchangedOnRight", left: 5, right: 6 },
  ];
  const threads = lines.map((line) => ({ ...thread({ kind: "notQueued" }), line, session: "s1" }));

  const converted = toThreadList({ threads }).threads;

  expect(converted.map((each) => each.line)).toEqual(lines);
  expect(converted.map((each) => each.session)).toEqual(["s1", "s1", "s1", "s1"]);
});

test("toThreadAdded brands the new id and converts the list", () => {
  expect(toThreadAdded({ thread: 3, list: LIST })).toEqual({
    thread: 3,
    list: toThreadList(LIST),
  });
});

test.each<[string, Generated.ThreadList, string]>([
  ["thread id", { threads: [{ ...thread({ kind: "notQueued" }), id: -1 }] }, "threads[0].id"],
  ["file id", { threads: [{ ...thread({ kind: "notQueued" }), file: 1.5 }] }, "threads[0].file"],
  [
    "message id",
    {
      threads: [
        thread({ kind: "notQueued" }),
        {
          ...thread({ kind: "notQueued" }),
          messages: [
            {
              id: 1,
              body: { kind: "note", text: "a" },
              written: 0,
              posting: { kind: "notQueued" },
            },
            {
              id: -2,
              body: { kind: "note", text: "b" },
              written: 0,
              posting: { kind: "notQueued" },
            },
          ],
        },
      ],
    },
    "threads[1].messages[1].id",
  ],
  [
    "left line",
    { threads: [{ ...thread({ kind: "notQueued" }), line: { kind: "removed", left: -1 } }] },
    "threads[0].line.left",
  ],
  [
    "right line",
    {
      threads: [
        {
          ...thread({ kind: "notQueued" }),
          line: { kind: "unchangedOnRight", left: 0, right: -3 },
        },
      ],
    },
    "threads[0].line.right",
  ],
])("a bad %s is refused, naming the field", (_what, list, field) => {
  expect(() => toThreadList(list)).toThrow(`${field} must be a non-negative safe integer`);
});

test("a bad new thread id is refused", () => {
  expect(() => toThreadAdded({ thread: -1, list: LIST })).toThrow(
    "thread must be a non-negative safe integer, got -1",
  );
});

test.each<Generated.ThreadLine>([
  { kind: "removed", left: -1 },
  { kind: "added", right: -1 },
  { kind: "unchangedOnLeft", left: -1, right: 0 },
  { kind: "unchangedOnLeft", left: 0, right: -1 },
])("toThreadLine refuses %j, naming the line field", (line) => {
  expect(() => toThreadLine(line)).toThrow(/^line\.(left|right) must be/);
});

test.each<[string, () => unknown]>([
  ["left line", () => changedThreadLine("left", -1)],
  ["right line", () => changedThreadLine("right", -1)],
  ["left line", () => unchangedThreadLine("left", { left: -1, right: 0 })],
  ["right line", () => unchangedThreadLine("right", { left: 0, right: -1 })],
])("a line builder refuses a bad %s, naming it", (field, build) => {
  expect(build).toThrow(`${field} must be a non-negative safe integer, got -1`);
});

test("fromThreadLine hands the app the same line", () => {
  const line = toThreadLine({ kind: "unchangedOnLeft", left: 3, right: 4 });

  expect(fromThreadLine(line)).toEqual({ kind: "unchangedOnLeft", left: 3, right: 4 });
});

const NOT_LINED_UP: [Generated.NotLinedUp, unknown][] = [
  [{ kind: "glabMissing" }, { kind: "glabMissing" }],
  [
    { kind: "notLoggedIn", detail: "gitlab.com: no token" },
    { kind: "notLoggedIn", detail: "gitlab.com: no token" },
  ],
  [
    { kind: "noMergeRequest", looked_at: { kind: "branch", name: "feature" } },
    { kind: "noMergeRequest", lookedAt: { kind: "branch", name: "feature" } },
  ],
  [
    { kind: "noMergeRequest", looked_at: { kind: "commit", short_id: "9c1ba3f" } },
    { kind: "noMergeRequest", lookedAt: { kind: "commit", shortId: "9c1ba3f" } },
  ],
  [
    { kind: "several", looked_at: { kind: "branch", name: "feature" }, references: ["!1", "!2"] },
    { kind: "several", lookedAt: { kind: "branch", name: "feature" }, references: ["!1", "!2"] },
  ],
  [
    { kind: "moved", merge_request: MERGE_REQUEST, gitlab_head: "aaa", shown_head: "bbb" },
    { kind: "moved", mergeRequest: CAMEL_MERGE_REQUEST, gitlabHead: "aaa", shownHead: "bbb" },
  ],
  [
    { kind: "otherBase", merge_request: MERGE_REQUEST, gitlab_base: "ccc", shown_base: "ddd" },
    { kind: "otherBase", mergeRequest: CAMEL_MERGE_REQUEST, gitlabBase: "ccc", shownBase: "ddd" },
  ],
  [
    { kind: "preparing", merge_request: MERGE_REQUEST },
    { kind: "preparing", mergeRequest: CAMEL_MERGE_REQUEST },
  ],
  [
    { kind: "failed", message: "502 Bad Gateway" },
    { kind: "failed", message: "502 Bad Gateway" },
  ],
];

test.each(NOT_LINED_UP)("check: not lined up %j comes out camelCased", (why, expected) => {
  expect(toGitLabCheck({ kind: "notLinedUp", why })).toEqual({ kind: "notLinedUp", why: expected });
});

test.each(NOT_LINED_UP)("send: not lined up %j comes out camelCased", (why, expected) => {
  expect(toSendReply({ kind: "notLinedUp", why })).toEqual({ kind: "notLinedUp", why: expected });
});

test("a lined-up check names the merge request camelCased", () => {
  expect(toGitLabCheck({ kind: "linedUp", merge_request: MERGE_REQUEST })).toEqual({
    kind: "linedUp",
    mergeRequest: CAMEL_MERGE_REQUEST,
  });
});

test("a sent reply keeps its counts and converts the list", () => {
  const pending: Generated.Posting = {
    kind: "pending",
    text: "t",
    draft_note: 1,
    merge_request: "!12",
    link: "l",
  };

  expect(
    toSendReply({ kind: "sent", list: { threads: [thread(pending)] }, sent: 5, refused: 1 }),
  ).toEqual({
    kind: "sent",
    list: toThreadList({ threads: [thread(pending)] }),
    sent: 5,
    refused: 1,
  });
  expect(toSendReply({ kind: "sent", list: LIST, sent: 0, refused: 0 })).toMatchObject({
    list: { threads: [{ messages: [{ posting: { kind: "notQueued" } }] }] },
  });
});

test("a stopped reply keeps its counts and reason and converts the list", () => {
  const pending: Generated.Posting = {
    kind: "pending",
    text: "t",
    draft_note: 4,
    merge_request: "!12",
    link: "l",
  };

  expect(
    toSendReply({
      kind: "stopped",
      list: { threads: [thread(pending)] },
      sent: 1,
      refused: 0,
      reason: "glab timed out",
    }),
  ).toEqual({
    kind: "stopped",
    list: {
      threads: [
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              posting: { kind: "pending", text: "t", draftNote: 4, mergeRequest: "!12", link: "l" },
            }),
          ],
        }),
      ],
    },
    sent: 1,
    refused: 0,
    reason: "glab timed out",
  });
});

test("a sent reply with a bad thread id is refused", () => {
  expect(() =>
    toSendReply({
      kind: "sent",
      list: { threads: [{ ...thread({ kind: "notQueued" }), id: -1 }] },
      sent: 0,
      refused: 0,
    }),
  ).toThrow("threads[0].id must be");
});
