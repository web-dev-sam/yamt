import type * as Generated from "./bindings";
import { pause } from "./fixture";
import { TIMED_OUT } from "./fixtureGitLab";
import {
  fixtureRows,
  fixtureUploadedPicture,
  LOGGED_OUT_DETAIL,
  ORIGIN,
} from "./fixtureMergeRequestData";
import type { Log } from "./log";
import { toRowDiscussions } from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";

type Position = { readonly index: number; readonly at: 0 | 1 };

export const DISCUSSIONS_FAILED_IID = 615;
export const DISCUSSIONS_LOGGED_OUT_IID = 629;

const DISCUSSIONS_PAUSE_MS = 400;
const FIXTURE_ANSWERED = 10;
const HOUR_MS = 3_600_000;
const REPLY_HOURS = 3;
const FIRST_LINE = 10;
const FIRST_NOTE = 7000;
const NOTES_PER_ROW = 10;
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
): Generated.DiscussionNote {
  const { index, at } = position;
  const pageless = index % PAGELESS_EVERY === PAGELESS_AT;
  return {
    author,
    createdAt: new Date(Date.parse(row.createdAt) + hours * HOUR_MS).toISOString(),
    text: text(position),
    page: pageless
      ? null
      : `${ORIGIN}/-/merge_requests/${row.iid}#note_${FIRST_NOTE + NOTES_PER_ROW * index + at}`,
  };
}

function discussions(row: Generated.MergeRequestRow, index: number): Generated.OpenDiscussion[] {
  const nextAuthor = fixtureRows(index + 1, 1)[0]?.author ?? null;
  const first: Generated.OpenDiscussion = {
    place:
      index % OVERVIEW_EVERY === 0
        ? { kind: "overview" }
        : { kind: "file", path: "src/board/card.ts", line: FIRST_LINE + index },
    last: note(row, { index, at: 0 }, nextAuthor, 1),
  };
  const reply: Generated.OpenDiscussion = {
    place: { kind: "file", path: "src/board/column.ts", line: null },
    last: note(row, { index, at: 1 }, row.reviewers[0]?.person ?? null, REPLY_HOURS),
  };
  return [first, reply].slice(0, row.openDiscussions);
}

/** The fixture's answer for `iid` among the `listed` rows (every script's rows): its row's `openDiscussions` open
 *  ones, a scripted refusal, or a failure for an iid no row has. */
export function fixtureDiscussions(
  iid: number,
  listed: readonly Generated.MergeRequestRow[],
): Generated.DiscussionsAnswer {
  if (iid === DISCUSSIONS_FAILED_IID) {
    return { kind: "failed", message: TIMED_OUT };
  }
  if (iid === DISCUSSIONS_LOGGED_OUT_IID) {
    return { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL };
  }
  const index = listed.findIndex((row) => row.iid === iid);
  const row = listed[index];
  if (row === undefined) {
    return { kind: "failed", message: `GitLab sent no merge request !${iid}` };
  }
  return { kind: "open", discussions: discussions(row, index) };
}

/** Answers the first FIXTURE_ANSWERED distinct iids, as Rust answers a prefix of DISCUSSION_BATCH. */
export function discussionsScript(
  log: Log,
  listedRows: number,
): Pick<MergeRequestSource, "readDiscussions"> {
  return {
    async readDiscussions(iids) {
      log.info("mergeRequests.fixture_discussions", { iids: iids.join(",") });
      await pause(DISCUSSIONS_PAUSE_MS);
      const listed = fixtureRows(0, listedRows);
      const answered = [...new Set(iids)].slice(0, FIXTURE_ANSWERED);
      const rows = answered.map((iid) => ({ iid, answer: fixtureDiscussions(iid, listed) }));
      return {
        ok: true,
        value: rows.map((row, at) => toRowDiscussions(row, at, fixtureUploadedPicture)),
      };
    },
  };
}
