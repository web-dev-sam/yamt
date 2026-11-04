import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import type { Description } from "./descriptionDomain";
import {
  toDiscussionThreadReply,
  toMarkdownPreviewReply,
  toRowDiscussions,
  type Commenting,
  type DiscussionComment,
  type DiscussionNote,
  type Mention,
  type NoteEdit,
  type PendingDraft,
  type TurnComment,
} from "./discussionDomain";
import { isDiscussionId, isLinkedPage, type WebPage } from "./domain";
import type { Person } from "./mergeRequestDomain";

const D01 = "0000000000000000000000000000000000000001";
const NOTE = "https://gitlab.example/g/p/-/merge_requests/12#note_901";
const DOCS = "http://docs.example/board";
const BEN: Generated.Person = {
  username: "ben",
  name: "Ben Okafor",
  picture: { kind: "uploaded" },
};
const ANNA: Generated.Person = { username: "anna", name: "Anna Berg", picture: { kind: "none" } };
const SAM_MENTION: Mention = { username: "sam", name: "Sam Weller" };
const BEN_MENTION: Mention = { username: "ben", name: "Ben Okafor" };

function uploadedPicture(username: string): string {
  return `yamt-picture://localhost/${username}`;
}

function webPage(text: string): WebPage {
  if (!isLinkedPage(text)) {
    throw new Error(`not a page: ${text}`);
  }
  return text;
}

function discussion(change: Partial<Generated.OpenDiscussion> = {}): Generated.OpenDiscussion {
  return {
    id: D01,
    place: { kind: "overview" },
    earlier: [
      { author: BEN, mentions: [SAM_MENTION] },
      { author: null, mentions: [] },
    ],
    last: {
      author: ANNA,
      createdAt: "2026-11-02T10:00:00Z",
      text: "@ben over to you",
      page: NOTE,
      mentions: [BEN_MENTION],
    },
    ...change,
  };
}

function rowOf(open: Generated.OpenDiscussion): Generated.RowDiscussions {
  return { iid: 12, answer: { kind: "open", discussions: [open] } };
}

const BEN_CONVERTED: Person = {
  username: "ben",
  name: "Ben Okafor",
  picture: "yamt-picture://localhost/ben",
};
const ANNA_CONVERTED: Person = { username: "anna", name: "Anna Berg", picture: null };
const EARLIER_CONVERTED: readonly TurnComment[] = [
  { author: BEN_CONVERTED, mentions: [SAM_MENTION] },
  { author: null, mentions: [] },
];
const LAST_CONVERTED: DiscussionNote = {
  author: ANNA_CONVERTED,
  createdAt: Date.UTC(2026, 10, 2, 10),
  text: "@ben over to you",
  page: webPage(NOTE),
  mentions: [BEN_MENTION],
};
const DISCUSSION_CONVERTED = {
  id: D01,
  place: { kind: "overview" },
  earlier: EARLIER_CONVERTED,
  last: LAST_CONVERTED,
};

test("toRowDiscussions_brands_ids_and_keeps_earlier_and_mentions", () => {
  expect(toRowDiscussions(rowOf(discussion()), 0, uploadedPicture)).toEqual({
    iid: 12,
    answer: { kind: "open", discussions: [DISCUSSION_CONVERTED] },
  });
  expect(isDiscussionId(D01)).toBe(true);
});

test.each([
  "",
  "1",
  "000000000000000000000000000000000000001",
  "00000000000000000000000000000000000000001",
  "000000000000000000000000000000000000000A",
  "000000000000000000000000000000000000000g",
  "gid://gitlab/Discussion/0000000000000000000000000000000000000001",
  " 0000000000000000000000000000000000000001",
])("a_discussion_id_not_40_hex_throws: %j", (id) => {
  expect(isDiscussionId(id)).toBe(false);
  expect(() => toRowDiscussions(rowOf(discussion({ id })), 3, uploadedPicture)).toThrow(
    `rows[3].answer.discussions[0].id must be 40 lowercase hex digits, got "${id}"`,
  );
});

test("a_bad_last_note_names_its_field", () => {
  const last = { ...discussion().last, createdAt: "yesterday" };
  expect(() => toRowDiscussions(rowOf(discussion({ last })), 0, uploadedPicture)).toThrow(
    "rows[0].answer.discussions[0].last.createdAt must be",
  );
  const pageless = { ...discussion().last, page: "http://gitlab.example/x" };
  expect(() => toRowDiscussions(rowOf(discussion({ last: pageless })), 0, uploadedPicture)).toThrow(
    "rows[0].answer.discussions[0].last.page must be an https address",
  );
});

function comment(change: Partial<Generated.DiscussionComment> = {}): Generated.DiscussionComment {
  return {
    author: BEN,
    createdAt: "2026-11-01T09:00:00Z",
    edited: { at: "2026-11-01T11:30:00Z", by: ANNA },
    body: {
      blocks: [
        {
          kind: "paragraph",
          inlines: [
            {
              kind: "link",
              link: { kind: "page", page: DOCS },
              inlines: [{ kind: "text", text: "docs" }],
            },
          ],
        },
      ],
    },
    page: NOTE,
    ...change,
  };
}

const DRAFTS: readonly PendingDraft[] = [{ text: "I'll take the second option." }];
const LOCKED: Commenting = "locked";

function threadOf(comments: Generated.DiscussionComment[]): Generated.DiscussionThreadReply {
  return {
    kind: "read",
    thread: {
      discussion: discussion(),
      resolved: true,
      comments,
      drafts: [...DRAFTS],
      pending: 2,
      commenting: LOCKED,
      mayResolve: false,
    },
  };
}

test("toDiscussionThreadReply_converts_times_people_pages_and_bodies", () => {
  const raw = threadOf([comment(), comment({ author: null, edited: null, page: null })]);
  const body: Description = {
    blocks: [
      {
        kind: "paragraph",
        inlines: [
          {
            kind: "link",
            link: { kind: "page", page: webPage(DOCS) },
            inlines: [{ kind: "text", text: "docs" }],
          },
        ],
      },
    ],
  };
  const edit: NoteEdit = { at: Date.UTC(2026, 10, 1, 11, 30), by: ANNA_CONVERTED };
  const comments: readonly DiscussionComment[] = [
    {
      author: BEN_CONVERTED,
      createdAt: Date.UTC(2026, 10, 1, 9),
      edited: edit,
      body,
      page: webPage(NOTE),
    },
    { author: null, createdAt: Date.UTC(2026, 10, 1, 9), edited: null, body, page: null },
  ];

  expect(toDiscussionThreadReply(raw, uploadedPicture)).toEqual({
    kind: "read",
    thread: {
      discussion: DISCUSSION_CONVERTED,
      resolved: true,
      comments,
      drafts: DRAFTS,
      pending: 2,
      commenting: LOCKED,
      mayResolve: false,
    },
  });
});

const BAD_COMMENTS: [Partial<Generated.DiscussionComment>, string][] = [
  [{ createdAt: "soon" }, "thread.comments[1].createdAt must be an ISO 8601 time"],
  [
    { edited: { at: "later", by: ANNA } },
    'thread.comments[1].edited.at must be an ISO 8601 time, got "later"',
  ],
  [{ page: "http://gitlab.example/x" }, "thread.comments[1].page must be an https address"],
  [
    {
      body: {
        blocks: [
          {
            kind: "paragraph",
            inlines: [{ kind: "link", link: { kind: "page", page: "javascript:x" }, inlines: [] }],
          },
        ],
      },
    },
    'thread.comments[1].body.link.page must be an http or https address, got "javascript:x"',
  ],
];

test.each(BAD_COMMENTS)("a thread comment's bad field %j throws naming it", (change, message) => {
  const raw = threadOf([comment(), comment(change)]);
  expect(() => toDiscussionThreadReply(raw, uploadedPicture)).toThrow(message);
});

test("a_threads_discussion_id_is_branded_too", () => {
  const raw: Generated.DiscussionThreadReply = {
    kind: "read",
    thread: { ...readThread(), discussion: discussion({ id: "d01" }) },
  };
  expect(() => toDiscussionThreadReply(raw, uploadedPicture)).toThrow(
    'thread.discussion.id must be 40 lowercase hex digits, got "d01"',
  );
});

function readThread(): Generated.DiscussionThread {
  const raw = threadOf([comment()]);
  if (raw.kind !== "read") {
    throw new Error("not read");
  }
  return raw.thread;
}

test("thread_and_preview_refusals_pass_unchanged", () => {
  const replies: Generated.DiscussionThreadReply[] = [
    { kind: "notFound" },
    { kind: "glabMissing" },
    { kind: "notLoggedIn", detail: "d" },
    { kind: "failed", message: "m" },
  ];
  for (const reply of replies) {
    expect(toDiscussionThreadReply(reply, uploadedPicture)).toBe(reply);
  }
  const failed: Generated.MarkdownPreviewReply = { kind: "failed", message: "glab timed out" };
  expect(toMarkdownPreviewReply(failed)).toBe(failed);
});

test("a_preview_brands_its_pages_and_names_the_field", () => {
  const preview = comment().body;
  expect(toMarkdownPreviewReply({ kind: "read", preview })).toEqual({ kind: "read", preview });
  const bad: Generated.Description = {
    blocks: [
      {
        kind: "paragraph",
        inlines: [{ kind: "link", link: { kind: "page", page: "file:///x" }, inlines: [] }],
      },
    ],
  };
  expect(() => toMarkdownPreviewReply({ kind: "read", preview: bad })).toThrow(
    'preview.link.page must be an http or https address, got "file:///x"',
  );
});
