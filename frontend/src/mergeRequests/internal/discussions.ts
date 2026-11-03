import type { ListedRequest, Person, ReviewFor } from "./filters";
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
/** Whose turn the box and the review order speak for (request-mr-discussions rule 3, review-mode rule 5). */
export type Viewer =
  | { readonly kind: "me"; readonly username: string | null }
  | { readonly kind: "person"; readonly username: string; readonly name: string };

export const DISCUSSIONS_LABEL = "Open discussions";
export const UNKNOWN_AUTHOR = "Someone";

const EXCERPT_LINES = 3;
const EXCERPT_CHARACTERS = 280;

const TURN_RANK: Readonly<Record<Turn, number>> = { viewer: 0, waiting: 1 };

const WAITING_TEXT = "Waiting for an answer";

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

/** null or Me → me; a person whose username is `me` → me; else the person, named by displayName of the first row
 *  reviewer with that username, else the username. */
export function viewerOf(
  review: ReviewFor | null,
  me: string | null,
  rows: readonly ListedRequest[],
): Viewer {
  if (review === null || review.kind === "me" || review.username === me) {
    return { kind: "me", username: me };
  }
  const { username } = review;
  const found = rows
    .flatMap((row) => row.reviewers)
    .find((reviewer) => reviewer.person.username === username);
  return {
    kind: "person",
    username,
    name: found === undefined ? username : displayName(found.person),
  };
}

export function viewerPossessive(viewer: Viewer, at: "start" | "inside"): string {
  if (viewer.kind === "person") {
    return `${viewer.name}'s`;
  }
  return at === "start" ? "Your" : "your";
}

export function turnText(turn: Turn, viewer: Viewer): string {
  if (turn === "waiting") {
    return WAITING_TEXT;
  }
  return `${viewerPossessive(viewer, "start")} turn`;
}

export function turnSummaryText({ viewersTurn, waiting }: TurnCounts, viewer: Viewer): string {
  const total = viewersTurn + waiting;
  if (total === 0) {
    return "No open discussions";
  }
  const whom = viewer.kind === "me" ? "you" : viewer.name;
  return `${viewersTurn} of ${total} ${viewersTurn === 1 ? "waits" : "wait"} for ${whom}`;
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
