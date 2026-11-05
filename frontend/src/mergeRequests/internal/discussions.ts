import type { ListedRequest, Person, ReviewFor } from "./filters";
import { displayName } from "./people";

export type DiscussionPlace =
  | { readonly kind: "overview" }
  | { readonly kind: "file"; readonly path: string; readonly line: number | null };
export type Mention = { readonly username: string; readonly name: string };
export type DiscussionNote = {
  readonly author: Person | null;
  readonly createdAt: number;
  readonly text: string;
  readonly mentions: readonly Mention[];
};
export type TurnComment = { readonly author: Person | null; readonly mentions: readonly Mention[] };
export type OpenDiscussion = {
  readonly place: DiscussionPlace;
  /** Person comments before `last`, oldest first; the starter is earlier[0], else last. */
  readonly earlier: readonly TurnComment[];
  readonly last: DiscussionNote;
};

/** Whose turn a discussion is (request-mr-threads B1–B3): `person` names someone who is neither the viewer nor the
 *  author; `waiting`: the viewer is the author and waits on nobody named; `open`: on nobody. */
export type Turn =
  | { readonly kind: "viewer" }
  | { readonly kind: "author" }
  | { readonly kind: "person"; readonly username: string; readonly name: string }
  | { readonly kind: "waiting" }
  | { readonly kind: "open" };
export type TurnLine<D extends OpenDiscussion> = { readonly discussion: D; readonly turn: Turn };
export type TurnCounts = {
  readonly viewersTurn: number;
  /** D3 (owner's answer 2429): discussions with a comment (`earlier` or `last`) whose author is the viewer. */
  readonly viewerWrote: number;
  readonly total: number;
};
/** Whose turn the box and the review order speak for (request-mr-discussions rule 3, review-mode rule 5). */
export type Viewer =
  | { readonly kind: "me"; readonly username: string | null }
  | { readonly kind: "person"; readonly username: string; readonly name: string };

export const DISCUSSIONS_LABEL = "Open discussions";
export const UNKNOWN_AUTHOR = "Someone";

const EXCERPT_LINES = 3;
const EXCERPT_CHARACTERS = 280;

const VIEWER: Turn = { kind: "viewer" };
const AUTHOR: Turn = { kind: "author" };
const WAITING: Turn = { kind: "waiting" };
const OPEN: Turn = { kind: "open" };

const WAITING_TEXT = "Waiting for an answer";

/** Who a discussion's turn is weighed for: usernames, null for nobody (no viewer) or unknown (no author). */
type Sides = { readonly viewer: string | null; readonly author: string | null };

function isUser(person: Person | null, username: string | null): boolean {
  return username !== null && person !== null && person.username === username;
}

function personsTurn(person: Person): Turn {
  return { kind: "person", username: person.username, name: displayName(person) };
}

function starterOf(discussion: OpenDiscussion): Person | null {
  return (discussion.earlier[0] ?? discussion.last).author;
}

/** B1: the viewer wrote the last comment. */
function waitedOn(discussion: OpenDiscussion, { viewer, author }: Sides): Turn {
  if (viewer !== author) {
    return AUTHOR;
  }
  const starter = starterOf(discussion);
  return starter === null || isUser(starter, author) ? WAITING : personsTurn(starter);
}

/** B2.4 and D3: the viewer wrote a comment in it. */
function wroteIn(discussion: OpenDiscussion, viewer: string | null): boolean {
  return [...discussion.earlier, discussion.last].some((comment) => isUser(comment.author, viewer));
}

/** B2, with B1 false. B2.1 (the viewer started it) is B2.4 (the viewer wrote a comment); a mention of the viewer in
 *  any comment is B2.2, or B2.4 when the viewer wrote it; B2.3 the viewer is the author. */
function isViewersTurn(discussion: OpenDiscussion, { viewer, author }: Sides): boolean {
  return (
    viewer !== null &&
    (viewer === author ||
      wroteIn(discussion, viewer) ||
      [...discussion.earlier, discussion.last].some((comment) =>
        comment.mentions.some((mention) => mention.username === viewer),
      ))
  );
}

/** B3: neither B1 nor B2. */
function othersTurn(discussion: OpenDiscussion, author: string | null): Turn {
  const { last } = discussion;
  const mentioned = last.mentions.find((mention) => mention.username !== last.author?.username);
  if (mentioned !== undefined) {
    return mentioned.username === author ? AUTHOR : personsTurn(mentioned);
  }
  if (!isUser(last.author, author)) {
    return AUTHOR;
  }
  const starter = starterOf(discussion);
  return starter === null || isUser(starter, author) ? OPEN : personsTurn(starter);
}

/** Request B1–B3 for `viewer` (a username; null: no one — never the viewer's turn, design §4 item 11) on a merge
 *  request by `author` (a username; null: unknown). A deleted person (null author) is never the viewer, never the
 *  author and never mentioned (B6). */
export function turnOf(
  discussion: OpenDiscussion,
  viewer: string | null,
  author: string | null,
): Turn {
  const sides: Sides = { viewer, author };
  if (isUser(discussion.last.author, viewer)) {
    return waitedOn(discussion, sides);
  }
  return isViewersTurn(discussion, sides) ? VIEWER : othersTurn(discussion, author);
}

/** B4: each discussion with its turn, the viewer's turn first, then every other; within each, the newest last
 *  comment first; equal times keep `open`'s order. */
export function discussionTurns<D extends OpenDiscussion>(
  open: readonly D[],
  viewer: string | null,
  author: string | null,
): readonly TurnLine<D>[] {
  return open
    .map((discussion) => ({ discussion, turn: turnOf(discussion, viewer, author) }))
    .toSorted((a, b) => {
      const turns = Number(b.turn.kind === "viewer") - Number(a.turn.kind === "viewer");
      return turns === 0 ? b.discussion.last.createdAt - a.discussion.last.createdAt : turns;
    });
}

/** How many are the viewer's turn (the box's header) and how many the viewer wrote in (review mode's D3). */
export function turnCounts(
  open: readonly OpenDiscussion[],
  viewer: string | null,
  author: string | null,
): TurnCounts {
  return {
    viewersTurn: open.filter((discussion) => turnOf(discussion, viewer, author).kind === "viewer")
      .length,
    viewerWrote: open.filter((discussion) => wroteIn(discussion, viewer)).length,
    total: open.length,
  };
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

export function viewerAddressed(viewer: Viewer): string {
  return viewer.kind === "me" ? "you" : viewer.name;
}

/** A1/A2: `author` is the merge request's author; "author" reads "<displayName(author)>'s turn", "Author's turn"
 *  when null. Every other kind as today. */
export function turnText(turn: Turn, viewer: Viewer, author: Person | null): string {
  switch (turn.kind) {
    case "viewer":
      return `${viewerPossessive(viewer, "start")} turn`;
    case "author":
      return author === null ? "Author's turn" : `${displayName(author)}'s turn`;
    case "person":
      return `${turn.name}'s turn`;
    case "waiting":
      return WAITING_TEXT;
    case "open":
      return "Open";
    default: {
      const _exhaustive: never = turn;
      return _exhaustive;
    }
  }
}

export function turnSummaryText({ viewersTurn, total }: TurnCounts, viewer: Viewer): string {
  if (total === 0) {
    return "No open discussions";
  }
  return `${viewersTurn} of ${total} ${viewersTurn === 1 ? "waits" : "wait"} for ${viewerAddressed(viewer)}`;
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
