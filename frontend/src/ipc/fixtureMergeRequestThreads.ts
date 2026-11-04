import type * as Generated from "./bindings";
import {
  toDiscussionThreadReply,
  toMarkdownPreviewReply,
  type DiscussionWriteReply,
} from "./discussionDomain";
import type { MergeRequestIid, SourceResult } from "./domain";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import { FIXTURE_ME, fixtureUploadedPicture, LOCKED_THREADS_IID } from "./fixtureMergeRequestData";
import {
  openDiscussion,
  storedDiscussions,
  type DiscussionStore,
} from "./fixtureMergeRequestDiscussions";
import {
  renderedText,
  textComment,
  type FixtureComment,
  type FixtureDiscussion,
} from "./fixtureMergeRequestTurnCases";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";

type Write = Generated.ReplyKind | "resolve" | "unresolve" | "submit";
type Written = Promise<SourceResult<DiscussionWriteReply>>;

const THREAD_PAUSE_MS = 400;
const WRITE_PAUSE_MS = 300;
const PREVIEW_PAUSE_MS = 300;
const NOTHING_TO_SEND = "There is nothing to send.";
const FORBIDDEN = "403 Forbidden";
const NOT_FOUND = "404 Not Found";
const SENT: Generated.DiscussionWriteReply = { kind: "sent" };

function discussionOf(
  store: DiscussionStore,
  iid: number,
  discussion: string,
): FixtureDiscussion | undefined {
  return storedDiscussions(store, iid)?.find((each) => each.id === discussion);
}

function thread(
  store: DiscussionStore,
  iid: number,
  discussion: string,
): Generated.DiscussionThreadReply {
  const all = storedDiscussions(store, iid) ?? [];
  const found = all.find((each) => each.id === discussion);
  if (found === undefined) {
    return { kind: "notFound" };
  }
  return {
    kind: "read",
    thread: {
      discussion: openDiscussion(found),
      resolved: found.resolved,
      comments: found.comments.map(({ author, createdAt, edited, body, page }) => ({
        author,
        createdAt,
        edited,
        body,
        page,
      })),
      drafts: [...found.drafts],
      pending: all.reduce((sum, each) => sum + each.drafts.length, 0),
      commenting: iid === LOCKED_THREADS_IID ? "locked" : "allowed",
      mayResolve: found.mayResolve,
    },
  };
}

function scriptedRefusal(text: string): Generated.DiscussionWriteReply | null {
  if (text.trim() === "") {
    return { kind: "refused", reason: NOTHING_TO_SEND };
  }
  if (text.startsWith("refuse")) {
    return { kind: "refused", reason: FORBIDDEN };
  }
  return text.startsWith("fail") ? { kind: "failed", message: TIMED_OUT } : null;
}

function samSays(store: DiscussionStore, iid: number, text: string): FixtureComment {
  store.nextNote += 1;
  return textComment(iid, [FIXTURE_ME, text], Date.now(), store.nextNote);
}

function replied(
  store: DiscussionStore,
  iid: number,
  discussion: string,
  kind: Generated.ReplyKind,
  text: string,
): Generated.DiscussionWriteReply {
  const found = discussionOf(store, iid, discussion);
  const refusal = scriptedRefusal(text);
  if (refusal !== null || found === undefined) {
    return refusal ?? { kind: "refused", reason: NOT_FOUND };
  }
  if (kind === "comment") {
    found.comments.push(samSays(store, iid, text));
  } else {
    found.drafts.push({ text });
  }
  return SENT;
}

function resolved(
  store: DiscussionStore,
  iid: number,
  discussion: string,
  resolve: boolean,
): Generated.DiscussionWriteReply {
  const found = discussionOf(store, iid, discussion);
  if (found === undefined) {
    return { kind: "refused", reason: NOT_FOUND };
  }
  if (iid === LOCKED_THREADS_IID) {
    return { kind: "refused", reason: FORBIDDEN };
  }
  found.resolved = resolve;
  return SENT;
}

function submitted(store: DiscussionStore, iid: number): Generated.DiscussionWriteReply {
  const all = storedDiscussions(store, iid);
  if (all === null) {
    return { kind: "refused", reason: NOT_FOUND };
  }
  for (const discussion of all) {
    for (const { text } of discussion.drafts.splice(0)) {
      discussion.comments.push(samSays(store, iid, text));
    }
  }
  return SENT;
}

function preview(text: string): Generated.MarkdownPreviewReply {
  return text.startsWith("fail")
    ? { kind: "failed", message: TIMED_OUT }
    : { kind: "read", preview: renderedText(text) };
}

async function written(
  log: Log,
  change: { readonly kind: Write; readonly iid: MergeRequestIid; readonly discussion: string },
  write: () => Generated.DiscussionWriteReply,
): Written {
  log.info("mergeRequests.fixture_write", change);
  await pause(WRITE_PAUSE_MS);
  return { ok: true, value: write() };
}

/** A discussion's thread, its writes and the preview over `store`, the discussions script's: a write shows in the
 *  next read of either. Logs name the iid and the discussion, never a text. */
export function threadsScript(
  log: Log,
  store: DiscussionStore,
): Pick<
  MergeRequestSource,
  | "readDiscussionThread"
  | "replyToDiscussion"
  | "resolveDiscussion"
  | "submitReview"
  | "previewMarkdown"
> {
  return {
    async readDiscussionThread(iid, discussion) {
      log.info("mergeRequests.fixture_thread", { iid, discussion });
      await pause(THREAD_PAUSE_MS);
      const reply = thread(store, iid, discussion);
      return { ok: true, value: toDiscussionThreadReply(reply, fixtureUploadedPicture) };
    },
    replyToDiscussion(iid, discussion, kind, text) {
      return written(log, { kind, iid, discussion }, () =>
        replied(store, iid, discussion, kind, text),
      );
    },
    resolveDiscussion(iid, discussion, resolve) {
      const kind = resolve ? "resolve" : "unresolve";
      return written(log, { kind, iid, discussion }, () =>
        resolved(store, iid, discussion, resolve),
      );
    },
    submitReview(iid) {
      return written(log, { kind: "submit", iid, discussion: "" }, () => submitted(store, iid));
    },
    async previewMarkdown(iid, text) {
      log.info("mergeRequests.fixture_preview", { iid });
      await pause(PREVIEW_PAUSE_MS);
      return { ok: true, value: toMarkdownPreviewReply(preview(text)) };
    },
  };
}
