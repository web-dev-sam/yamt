import type * as Generated from "./bindings";
import { toRowDiscussions } from "./discussionDomain";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  fixtureRows,
  fixtureUploadedPicture,
  LOGGED_OUT_DETAIL,
  ORIGIN,
} from "./fixtureMergeRequestData";
import { personNamed, renderedText, type FixtureComment } from "./fixtureMergeRequestRendering";
import { discussionId, turnCases, type FixtureDiscussion } from "./fixtureMergeRequestTurnCases";
import type { Log } from "./log";
import type { MergeRequestSource } from "./MergeRequestSource";

type Position = { readonly index: number; readonly at: 0 | 1 };
/** One source's discussions, seeded per merge request at its first ask and changed by the thread script's writes;
 *  `nextNote` is read and advanced only by `takeNote`. */
export type DiscussionStore = {
  readonly listedRows: number;
  readonly createdAt: number;
  readonly discussions: Map<number, FixtureDiscussion[]>;
  nextNote: number;
};

export const DISCUSSIONS_FAILED_IID = 615;
export const DISCUSSIONS_LOGGED_OUT_IID = 629;

const DISCUSSIONS_PAUSE_MS = 400;
const FIXTURE_ANSWERED = 10;
const HOUR_MS = 3_600_000;
const REPLY_HOURS = 3;
const FIRST_LINE = 10;
const FIRST_NOTE = 7000;
const NOTES_PER_ROW = 10;
const IDS_PER_ROW = 100;
const MARKUP_EVERY = 4;
const PAGELESS_EVERY = 6;
const PAGELESS_AT = 1;
const OVERVIEW_EVERY = 2;
const LONG_TEXT_INDEX = 2;
const LONG_TEXT_LENGTH = 400;
const LONG_TEXT = "A single line that runs on,".padEnd(LONG_TEXT_LENGTH, " and on");
const MARKUP_TEXT =
  "Please RENAME this.\n**not bold** <b>not bold</b> &amp; <script>x</script>\nThird line\nA fourth line the box leaves out";
const SHORT_TEXTS: Readonly<Record<Position["at"], string>> = {
  0: "Could you look at this again?",
  1: "Done, see the new commit.",
};

/** The smoke's due rows (`docs/slices/briefs/mr-review-mode-design.md` §1, "Expected orders"): their first discussion
 *  asks the reviewer, so it is the reviewer's turn (request-mr-threads B2) and review mode puts them first; !622, due
 *  too, asks no one. */
const ASKED: Readonly<Record<number, string>> = { 618: "sam", 633: "sam", 623: "sam", 602: "anna" };

function text({ index, at }: Position): string {
  if (index === LONG_TEXT_INDEX && at === 0) {
    return LONG_TEXT;
  }
  return (index + at) % MARKUP_EVERY === 0 ? MARKUP_TEXT : SHORT_TEXTS[at];
}

function note(
  row: Generated.MergeRequestRow,
  position: Position,
  author: Generated.Person | null,
  hours: number,
): FixtureComment {
  const { index, at } = position;
  const pageless = index % PAGELESS_EVERY === PAGELESS_AT;
  const said = text(position);
  return {
    author,
    createdAt: new Date(Date.parse(row.createdAt) + hours * HOUR_MS).toISOString(),
    edited: null,
    body: { blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: said }] }] },
    page: pageless
      ? null
      : `${ORIGIN}/-/merge_requests/${row.iid}#note_${FIRST_NOTE + NOTES_PER_ROW * index + at}`,
    text: said,
    mentions: [],
  };
}

function asking(comment: FixtureComment, username: string): FixtureComment {
  const said = `@${username} ${comment.text}`;
  const person = personNamed(username);
  return {
    ...comment,
    body: renderedText(said),
    text: said,
    mentions: person === null ? [] : [{ username: person.username, name: person.name }],
  };
}

function discussions(row: Generated.MergeRequestRow, index: number): FixtureDiscussion[] {
  const nextAuthor = fixtureRows(index + 1, 1)[0]?.author ?? null;
  const first: Generated.DiscussionPlace =
    index % OVERVIEW_EVERY === 0
      ? { kind: "overview" }
      : { kind: "file", path: "src/board/card.ts", line: FIRST_LINE + index };
  const reply: Generated.DiscussionPlace = {
    kind: "file",
    path: "src/board/column.ts",
    line: null,
  };
  const opening = note(row, { index, at: 0 }, nextAuthor, 1);
  const asked = ASKED[row.iid];
  const lasts = [
    asked === undefined ? opening : asking(opening, asked),
    note(row, { index, at: 1 }, row.reviewers[0]?.person ?? null, REPLY_HOURS),
  ];
  return lasts.slice(0, row.openDiscussions).map((last, at) => ({
    id: discussionId(row.iid * IDS_PER_ROW + at),
    place: at === 0 ? first : reply,
    mayResolve: true,
    resolved: false,
    comments: [last],
    drafts: [],
  }));
}

/** The next free note number, above every listed row's notes. */
export function takeNote(store: DiscussionStore): number {
  const note = store.nextNote;
  store.nextNote += 1;
  return note;
}

function seeded(store: DiscussionStore, iid: number): FixtureDiscussion[] | null {
  const scripted = turnCases({ iid, now: store.createdAt, takeNote: () => takeNote(store) });
  if (scripted !== null) {
    return scripted;
  }
  const listed = fixtureRows(0, store.listedRows);
  const index = listed.findIndex((row) => row.iid === iid);
  const row = listed[index];
  return row === undefined ? null : discussions(row, index);
}

export function createDiscussionStore(listedRows: number): DiscussionStore {
  const nextNote = FIRST_NOTE + NOTES_PER_ROW * listedRows;
  return { listedRows, createdAt: Date.now(), discussions: new Map(), nextNote };
}

/** Merge request `iid`'s discussions, resolved ones too, seeded at the first ask; null when no listed row has it. */
export function storedDiscussions(store: DiscussionStore, iid: number): FixtureDiscussion[] | null {
  const kept = store.discussions.get(iid) ?? seeded(store, iid);
  if (kept !== null) {
    store.discussions.set(iid, kept);
  }
  return kept;
}

export function openDiscussion(discussion: FixtureDiscussion): Generated.OpenDiscussion {
  const last = discussion.comments.at(-1);
  if (last === undefined) {
    throw new Error(`discussion ${discussion.id} has no comment`);
  }
  const { author, createdAt, text: said, page, mentions } = last;
  return {
    id: discussion.id,
    place: discussion.place,
    earlier: discussion.comments.slice(0, -1).map((each) => ({
      author: each.author,
      mentions: each.mentions,
    })),
    last: { author, createdAt, text: said, page, mentions },
  };
}

/** The fixture's answer for `iid`: its unresolved discussions as the store holds them, a scripted refusal, or a
 *  failure for an iid no row has. */
export function fixtureDiscussions(
  iid: number,
  store: DiscussionStore,
): Generated.DiscussionsAnswer {
  if (iid === DISCUSSIONS_FAILED_IID) {
    return { kind: "failed", message: TIMED_OUT };
  }
  if (iid === DISCUSSIONS_LOGGED_OUT_IID) {
    return { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL };
  }
  const stored = storedDiscussions(store, iid);
  if (stored === null) {
    return { kind: "failed", message: `GitLab sent no merge request !${iid}` };
  }
  const open = stored.filter((discussion) => !discussion.resolved);
  return { kind: "open", discussions: open.map(openDiscussion) };
}

/** Answers the first FIXTURE_ANSWERED distinct iids, as Rust answers a prefix of DISCUSSION_BATCH. */
export function discussionsScript(
  log: Log,
  store: DiscussionStore,
): Pick<MergeRequestSource, "readDiscussions"> {
  return {
    async readDiscussions(iids) {
      log.info("mergeRequests.fixture_discussions", { iids: iids.join(",") });
      await pause(DISCUSSIONS_PAUSE_MS);
      const answered = [...new Set(iids)].slice(0, FIXTURE_ANSWERED);
      const rows = answered.map((iid) => ({ iid, answer: fixtureDiscussions(iid, store) }));
      return {
        ok: true,
        value: rows.map((row, at) => toRowDiscussions(row, at, fixtureUploadedPicture)),
      };
    },
  };
}
