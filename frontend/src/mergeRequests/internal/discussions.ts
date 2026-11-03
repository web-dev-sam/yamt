import type { Person } from "./filters";
import { displayName } from "./people";

export type DiscussionPlace =
  | { readonly kind: "overview" }
  | { readonly kind: "file"; readonly path: string; readonly line: number | null };
export type DiscussionNote = {
  readonly author: Person | null;
  readonly createdAt: number;
  readonly text: string;
};
export type OpenDiscussion = { readonly place: DiscussionPlace; readonly last: DiscussionNote };

/** "viewer": the last comment is not the viewer's (an unknown author too), so it is the viewer's turn; "waiting":
 *  the viewer wrote it and waits for an answer (request rule 3). */
export type Turn = "viewer" | "waiting";
export type TurnLine<D extends OpenDiscussion> = { readonly discussion: D; readonly turn: Turn };
export type TurnCounts = { readonly viewersTurn: number; readonly waiting: number };

export const DISCUSSIONS_LABEL = "Open discussions";
export const UNKNOWN_AUTHOR = "Someone";

const EXCERPT_LINES = 3;
const EXCERPT_CHARACTERS = 280;

const TURN_RANK: Readonly<Record<Turn, number>> = { viewer: 0, waiting: 1 };

const TURN_TEXTS: Readonly<Record<Turn, string>> = {
  viewer: "Your turn",
  waiting: "Waiting for an answer",
};

function turnOf(last: DiscussionNote, viewer: string | null): Turn {
  return last.author !== null && last.author.username === viewer ? "waiting" : "viewer";
}

/** Each discussion with its turn for `viewer` (a username; null: nobody, so every one is the viewer's turn): the
 *  viewer's turn first, then the rest; within each, the newest last comment first; equal times keep `open`'s order. */
export function discussionTurns<D extends OpenDiscussion>(
  open: readonly D[],
  viewer: string | null,
): readonly TurnLine<D>[] {
  return open
    .map((discussion) => ({ discussion, turn: turnOf(discussion.last, viewer) }))
    .toSorted((a, b) => {
      const turns = TURN_RANK[a.turn] - TURN_RANK[b.turn];
      return turns === 0 ? b.discussion.last.createdAt - a.discussion.last.createdAt : turns;
    });
}

/** How many are `viewer`'s turn and how many wait on others (review mode's order uses both). */
export function turnCounts(open: readonly OpenDiscussion[], viewer: string | null): TurnCounts {
  const viewersTurn = open.filter(
    (discussion) => turnOf(discussion.last, viewer) === "viewer",
  ).length;
  return { viewersTurn, waiting: open.length - viewersTurn };
}

export function turnText(turn: Turn): string {
  return TURN_TEXTS[turn];
}

export function turnSummaryText({ viewersTurn, waiting }: TurnCounts): string {
  const total = viewersTurn + waiting;
  if (total === 0) {
    return "No open discussions";
  }
  return `${viewersTurn} of ${total} ${viewersTurn === 1 ? "waits" : "wait"} for you`;
}

export function placeText(place: DiscussionPlace): string {
  switch (place.kind) {
    case "overview":
      return "Overview";
    case "file":
      return place.line === null ? place.path : `${place.path}:${place.line}`;
    default: {
      const _exhaustive: never = place;
      return _exhaustive;
    }
  }
}

export function noteAuthorName(author: Person | null): string {
  return author === null ? UNKNOWN_AUTHOR : displayName(author);
}

/** The text trimmed, its first 3 lines (any of \n, \r\n), at most 280 characters (code points, never half a
 *  surrogate pair); when anything was left out, cut there, end-trimmed, plus "…". Plain text, never markup. */
export function noteExcerpt(text: string): string {
  const lines = text.trim().split(/\r?\n/u);
  const kept = Array.from(lines.slice(0, EXCERPT_LINES).join("\n"));
  if (lines.length <= EXCERPT_LINES && kept.length <= EXCERPT_CHARACTERS) {
    return kept.join("");
  }
  return `${kept.slice(0, EXCERPT_CHARACTERS).join("").trimEnd()}…`;
}
