import type * as Generated from "./bindings";
import { toDescription, type Description } from "./descriptionDomain";
import {
  isDiscussionId,
  isMergeRequestIid,
  type DiscussionId,
  type MergeRequestIid,
  type WebPage,
} from "./domain";
import {
  toPerson,
  toTime,
  toWebPage,
  type Person,
  type UploadedPicture,
} from "./mergeRequestDomain";
import { branded } from "./validate";

type DiscussionPlace = Readonly<Generated.DiscussionPlace>;
export type Mention = Readonly<Generated.Mention>;
export type DiscussionNote = {
  readonly author: Person | null;
  /** Milliseconds since 1970, from GitLab's ISO 8601 time. */
  readonly createdAt: number;
  readonly text: string;
  readonly page: WebPage | null;
  readonly mentions: readonly Mention[];
};
export type TurnComment = { readonly author: Person | null; readonly mentions: readonly Mention[] };
export type FirstComment = {
  /** Milliseconds since 1970, from GitLab's ISO 8601 time. */
  readonly createdAt: number;
  readonly body: Description;
};
export type OpenDiscussion = {
  readonly id: DiscussionId;
  readonly place: DiscussionPlace;
  /** The first person note (earlier[0], else last): its time and GitLab's rendering (request D1, D2). */
  readonly first: FirstComment;
  readonly earlier: readonly TurnComment[];
  readonly last: DiscussionNote;
};
export type DiscussionsAnswer =
  | { readonly kind: "open"; readonly discussions: readonly OpenDiscussion[] }
  | Readonly<Exclude<Generated.DiscussionsAnswer, { kind: "open" }>>;
export type RowDiscussions = { readonly iid: MergeRequestIid; readonly answer: DiscussionsAnswer };
/** `at` in milliseconds since 1970. */
export type NoteEdit = { readonly at: number; readonly by: Person };
export type DiscussionComment = {
  readonly author: Person | null;
  /** Milliseconds since 1970. */
  readonly createdAt: number;
  readonly edited: NoteEdit | null;
  readonly body: Description;
  readonly page: WebPage | null;
};
export type PendingDraft = Readonly<Generated.PendingDraft>;
export type Commenting = Generated.Commenting;
export type DiscussionThread = {
  readonly discussion: OpenDiscussion;
  readonly resolved: boolean;
  readonly comments: readonly DiscussionComment[];
  readonly drafts: readonly PendingDraft[];
  readonly pending: number;
  readonly commenting: Commenting;
  readonly mayResolve: boolean;
};
export type DiscussionThreadReply =
  | { readonly kind: "read"; readonly thread: DiscussionThread }
  | Readonly<Exclude<Generated.DiscussionThreadReply, { kind: "read" }>>;
export type ReplyKind = Generated.ReplyKind;
export type DiscussionWriteReply = Readonly<Generated.DiscussionWriteReply>;
export type MarkdownPreviewReply =
  | { readonly kind: "read"; readonly preview: Description }
  | Readonly<Exclude<Generated.MarkdownPreviewReply, { kind: "read" }>>;

function toDiscussionId(text: string, field: string): DiscussionId {
  if (!isDiscussionId(text)) {
    throw new Error(`${field} must be 40 lowercase hex digits, got "${text}"`);
  }
  return text;
}

function toAuthor(raw: Generated.Person | null, uploadedPicture: UploadedPicture): Person | null {
  return raw === null ? null : toPerson(raw, uploadedPicture);
}

function toNote(
  raw: Generated.DiscussionNote,
  field: string,
  uploadedPicture: UploadedPicture,
): DiscussionNote {
  return {
    author: toAuthor(raw.author, uploadedPicture),
    createdAt: toTime(raw.createdAt, `${field}.createdAt`),
    text: raw.text,
    page: raw.page === null ? null : toWebPage(raw.page, `${field}.page`),
    mentions: raw.mentions,
  };
}

function toDiscussion(
  raw: Generated.OpenDiscussion,
  field: string,
  uploadedPicture: UploadedPicture,
): OpenDiscussion {
  return {
    id: toDiscussionId(raw.id, `${field}.id`),
    place: raw.place,
    first: {
      createdAt: toTime(raw.first.createdAt, `${field}.first.createdAt`),
      body: toDescription(raw.first.body, `${field}.first.body`),
    },
    earlier: raw.earlier.map(({ author, mentions }) => ({
      author: toAuthor(author, uploadedPicture),
      mentions,
    })),
    last: toNote(raw.last, `${field}.last`, uploadedPicture),
  };
}

function toAnswer(
  raw: Generated.DiscussionsAnswer,
  field: string,
  uploadedPicture: UploadedPicture,
): DiscussionsAnswer {
  if (raw.kind !== "open") {
    return raw;
  }
  return {
    kind: "open",
    discussions: raw.discussions.map((discussion, at) =>
      toDiscussion(discussion, `${field}.discussions[${at}]`, uploadedPicture),
    ),
  };
}

export function toRowDiscussions(
  raw: Generated.RowDiscussions,
  index: number,
  uploadedPicture: UploadedPicture,
): RowDiscussions {
  const field = `rows[${index}]`;
  return {
    iid: branded(raw.iid, isMergeRequestIid, `${field}.iid`),
    answer: toAnswer(raw.answer, `${field}.answer`, uploadedPicture),
  };
}

function toComment(
  raw: Generated.DiscussionComment,
  field: string,
  uploadedPicture: UploadedPicture,
): DiscussionComment {
  const { edited } = raw;
  return {
    author: toAuthor(raw.author, uploadedPicture),
    createdAt: toTime(raw.createdAt, `${field}.createdAt`),
    edited:
      edited === null
        ? null
        : { at: toTime(edited.at, `${field}.edited.at`), by: toPerson(edited.by, uploadedPicture) },
    body: toDescription(raw.body, `${field}.body`),
    page: raw.page === null ? null : toWebPage(raw.page, `${field}.page`),
  };
}

/** The discussion as toRowDiscussions converts it; each comment's times in ms, people as toPerson makes them, body
 *  pages through toDescription and page through toWebPage; a bad id, time or page throws. */
export function toDiscussionThreadReply(
  raw: Generated.DiscussionThreadReply,
  uploadedPicture: UploadedPicture,
): DiscussionThreadReply {
  if (raw.kind !== "read") {
    return raw;
  }
  const { thread } = raw;
  return {
    kind: "read",
    thread: {
      ...thread,
      discussion: toDiscussion(thread.discussion, "thread.discussion", uploadedPicture),
      comments: thread.comments.map((comment, at) =>
        toComment(comment, `thread.comments[${at}]`, uploadedPicture),
      ),
    },
  };
}

export function toMarkdownPreviewReply(raw: Generated.MarkdownPreviewReply): MarkdownPreviewReply {
  return raw.kind === "read"
    ? { kind: "read", preview: toDescription(raw.preview, "preview") }
    : raw;
}
