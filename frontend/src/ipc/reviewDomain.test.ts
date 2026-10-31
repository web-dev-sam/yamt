import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toGitLabCheck, toSendReply, toThreadAdded, toThreadList } from "./reviewDomain";
import {
  changedThreadLine,
  diffLineOf,
  fromThreadPlace,
  isOneLine,
  onePlace,
  sameDiffLine,
  toThreadPlace,
  unchangedThreadLine,
  type ThreadLine,
} from "./threadLine";

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
    place: { start: { kind: "removed", left: 19 }, end: { kind: "removed", left: 19 } },
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
        place: { start: { kind: "removed", left: 19 }, end: { kind: "removed", left: 19 } },
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

test.each([-1, 1.5])("an AI answer whose turn is %d is refused, naming the field", (turn) => {
  const body: Generated.MessageBody = { kind: "aiAnswer", session: "s1", turn };

  expect(() => toThreadList({ threads: [thread({ kind: "notQueued" }, body)] })).toThrow(
    `threads[0].messages[0].body.turn must be a non-negative safe integer, got ${turn}`,
  );
});

test("a thread keeps its session and its place's start and end of every kind", () => {
  const places: Generated.ThreadPlace[] = [
    { start: { kind: "removed", left: 1 }, end: { kind: "added", right: 2 } },
    { start: { kind: "added", right: 2 }, end: { kind: "added", right: 2 } },
    {
      start: { kind: "unchanged", left: 3, right: 4 },
      end: { kind: "unchangedOnLeft", left: 7, right: 8 },
    },
    {
      start: { kind: "unchanged", left: 5, right: 6 },
      end: { kind: "unchangedOnRight", left: 5, right: 6 },
    },
    { start: { kind: "unchanged", left: 9, right: 10 }, end: { kind: "removed", left: 11 } },
  ];
  const threads = places.map((place) => ({
    ...thread({ kind: "notQueued" }),
    place,
    session: "s1",
  }));

  const converted = toThreadList({ threads }).threads;

  expect(converted.map((each) => each.place)).toEqual(places);
  expect(converted.map((each) => each.session)).toEqual(["s1", "s1", "s1", "s1", "s1"]);
});

test("an empty session is refused, naming the field, on the thread and on an AI answer", () => {
  const answer: Generated.MessageBody = { kind: "aiAnswer", session: "", turn: 0 };

  expect(() =>
    toThreadList({ threads: [{ ...thread({ kind: "notQueued" }), session: "" }] }),
  ).toThrow("threads[0].session must be a non-empty session id");
  expect(() => toThreadList({ threads: [thread({ kind: "notQueued" }, answer)] })).toThrow(
    "threads[0].messages[0].body.session must be a non-empty session id",
  );
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
    {
      threads: [
        {
          ...thread({ kind: "notQueued" }),
          place: { start: { kind: "removed", left: -1 }, end: { kind: "removed", left: 0 } },
        },
      ],
    },
    "threads[0].place.start.left",
  ],
  [
    "right line",
    {
      threads: [
        {
          ...thread({ kind: "notQueued" }),
          place: {
            start: { kind: "unchanged", left: 0, right: 0 },
            end: { kind: "unchangedOnRight", left: 0, right: -3 },
          },
        },
      ],
    },
    "threads[0].place.end.right",
  ],
])("a bad %s is refused, naming the field", (_what, list, field) => {
  expect(() => toThreadList(list)).toThrow(`${field} must be a non-negative safe integer`);
});

test("a bad new thread id is refused", () => {
  expect(() => toThreadAdded({ thread: -1, list: LIST })).toThrow(
    "thread must be a non-negative safe integer, got -1",
  );
});

const GOOD_START: Generated.DiffLine = { kind: "unchanged", left: 0, right: 0 };
const GOOD_END: Generated.ThreadLine = { kind: "unchangedOnLeft", left: 0, right: 0 };

test.each<[Generated.ThreadPlace, string]>([
  [{ start: { kind: "removed", left: -1 }, end: GOOD_END }, "place.start.left"],
  [{ start: { kind: "added", right: -1 }, end: GOOD_END }, "place.start.right"],
  [{ start: { kind: "unchanged", left: -1, right: 0 }, end: GOOD_END }, "place.start.left"],
  [{ start: { kind: "unchanged", left: 0, right: -1 }, end: GOOD_END }, "place.start.right"],
  [{ start: GOOD_START, end: { kind: "removed", left: -1 } }, "place.end.left"],
  [{ start: GOOD_START, end: { kind: "added", right: -1 } }, "place.end.right"],
  [{ start: GOOD_START, end: { kind: "unchangedOnLeft", left: -1, right: 0 } }, "place.end.left"],
  [{ start: GOOD_START, end: { kind: "unchangedOnRight", left: 0, right: -1 } }, "place.end.right"],
])("toThreadPlace refuses %j, naming %s", (place, field) => {
  expect(() => toThreadPlace(place)).toThrow(
    `${field} must be a non-negative safe integer, got -1`,
  );
});

test("toThreadPlace names the field it is given", () => {
  expect(() =>
    toThreadPlace({ start: GOOD_START, end: { kind: "added", right: -1 } }, "x"),
  ).toThrow(/^x\.end\.right must be/);
});

test.each<[string, () => unknown]>([
  ["left line", () => changedThreadLine("left", -1)],
  ["right line", () => changedThreadLine("right", -1)],
  ["left line", () => unchangedThreadLine("left", { left: -1, right: 0 })],
  ["right line", () => unchangedThreadLine("right", { left: 0, right: -1 })],
])("a line builder refuses a bad %s, naming it", (field, build) => {
  expect(build).toThrow(`${field} must be a non-negative safe integer, got -1`);
});

test("fromThreadPlace hands the app the same place", () => {
  const place = toThreadPlace({
    start: { kind: "unchanged", left: 3, right: 4 },
    end: { kind: "unchangedOnRight", left: 6, right: 7 },
  });

  expect(fromThreadPlace(place)).toEqual({
    start: { kind: "unchanged", left: 3, right: 4 },
    end: { kind: "unchangedOnRight", left: 6, right: 7 },
  });
});

function removed(left: number): ThreadLine {
  return changedThreadLine("left", left);
}

function added(right: number): ThreadLine {
  return changedThreadLine("right", right);
}

function onLeft(left: number, right: number): ThreadLine {
  return unchangedThreadLine("left", { left, right });
}

function onRight(left: number, right: number): ThreadLine {
  return unchangedThreadLine("right", { left, right });
}

test.each<[() => ThreadLine, unknown]>([
  [() => removed(3), { kind: "removed", left: 3 }],
  [() => added(4), { kind: "added", right: 4 }],
  [() => onLeft(3, 4), { kind: "unchanged", left: 3, right: 4 }],
  [() => onRight(3, 4), { kind: "unchanged", left: 3, right: 4 }],
])("diffLineOf drops the column only (%#)", (line, expected) => {
  expect(diffLineOf(line())).toEqual(expected);
});

test("a line builder keeps the column it is given", () => {
  expect([removed(3), added(4), onLeft(3, 4), onRight(3, 4)]).toEqual([
    { kind: "removed", left: 3 },
    { kind: "added", right: 4 },
    { kind: "unchangedOnLeft", left: 3, right: 4 },
    { kind: "unchangedOnRight", left: 3, right: 4 },
  ]);
});

test("onePlace starts and ends on the line", () => {
  expect(onePlace(onRight(3, 4))).toEqual({
    start: { kind: "unchanged", left: 3, right: 4 },
    end: { kind: "unchangedOnRight", left: 3, right: 4 },
  });
});

test.each<[string, () => ThreadLine, () => ThreadLine, boolean]>([
  ["the same removed line", () => removed(3), () => removed(3), true],
  ["the same added line", () => added(4), () => added(4), true],
  ["the same unchanged line", () => onLeft(3, 4), () => onRight(3, 4), true],
  ["another removed line", () => removed(3), () => removed(4), false],
  ["another added line", () => added(4), () => added(3), false],
  ["an unchanged line on another left", () => onLeft(3, 4), () => onLeft(2, 4), false],
  ["an unchanged line on another right", () => onLeft(3, 4), () => onLeft(3, 5), false],
  ["a removed and an added line", () => removed(3), () => added(3), false],
  ["an added and a removed line", () => added(4), () => removed(4), false],
  ["an unchanged and a removed line", () => onLeft(3, 4), () => removed(3), false],
  ["a removed and an unchanged line", () => removed(3), () => onLeft(3, 4), false],
  ["an added and an unchanged line", () => added(4), () => onRight(3, 4), false],
])("sameDiffLine of %s is %s", (_what, a, b, same) => {
  expect(sameDiffLine(diffLineOf(a()), diffLineOf(b()))).toBe(same);
});

test.each<[string, () => ThreadLine]>([
  ["removed", () => removed(3)],
  ["added", () => added(4)],
  ["unchangedOnLeft", () => onLeft(3, 4)],
  ["unchangedOnRight", () => onRight(3, 4)],
])("a one-line place on a %s line is one line", (_kind, line) => {
  expect(isOneLine(onePlace(line()))).toBe(true);
});

test.each<[string, () => ThreadLine]>([
  ["unchangedOnLeft", () => onLeft(3, 4)],
  ["unchangedOnRight", () => onRight(3, 4)],
])("an unchanged start with its own %s end is one line", (_kind, end) => {
  expect(isOneLine({ start: diffLineOf(onLeft(3, 4)), end: end() })).toBe(true);
});

test("a place from a removed line to an added one is two lines", () => {
  expect(isOneLine({ start: diffLineOf(removed(3)), end: added(4) })).toBe(false);
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
