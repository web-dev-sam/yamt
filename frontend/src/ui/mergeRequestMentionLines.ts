import type { Person } from "../ipc";
import {
  displayName,
  mentionEdit,
  mentionLines,
  mentionWordAt,
  type MentionEdit,
  type MentionWord,
} from "../mergeRequests";
import { ARROW_STEPS } from "./menuKeys";
import type { Size } from "./menuPosition";
import type { PeopleSearch } from "./mergeRequests";
import { peopleSearchText } from "./mergeRequestsText";
import type { CaretBox, Rect } from "./textareaCaret";

export type MentionLine = {
  readonly username: string;
  readonly picture: Person;
  readonly label: string;
};
/** `note`: why GitLab's search is missing (the people box's words), muted under the lines (rule 5). */
export type MentionList = { readonly lines: readonly MentionLine[]; readonly note: string | null };
export type MentionInput = {
  readonly known: readonly Person[];
  readonly typed: string;
  readonly search: PeopleSearch;
  readonly platform: string;
};
export type FieldRead = {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly composing: boolean;
};
export type MentionKey =
  | { readonly kind: "step"; readonly step: number }
  | { readonly kind: "pick" }
  | { readonly kind: "close" };
/** The field's text and selection; the composing flag is the state's. */
export type FieldText = Omit<FieldRead, "composing">;
/** Why the word at `start` stays closed: Escape, until the caret leaves the word; `close()` (a send, Preview, Queue),
 *  while the field still shows `text`. */
type Dismissal =
  | { readonly kind: "escape"; readonly start: number }
  | { readonly kind: "close"; readonly start: number; readonly text: string };
/** `word`: the open `@` word, null while closed. */
export type MentionState = {
  readonly word: MentionWord | null;
  readonly dismissed: Dismissal | null;
  readonly composing: boolean;
};
/** What reached a field's mentions: `read` is an input, click, keyup or focus (none finds a word while composing). */
export type MentionEvent =
  | { readonly kind: "read" | "close"; readonly field: FieldText }
  | { readonly kind: "compose"; readonly composing: boolean; readonly field: FieldText }
  | { readonly kind: "escape" | "blur" };
/** The mention search's next call: `search` only when the open word changed, `end` when it closed. */
export type MentionCall =
  | { readonly kind: "search"; readonly typed: string }
  | { readonly kind: "end" }
  | { readonly kind: "none" };
export type MentionStep = { readonly state: MentionState; readonly call: MentionCall };
/** The caret, the field's and the room's viewport rects, measured together. */
export type MentionAnchor = { readonly caret: CaretBox; readonly field: Rect; readonly room: Rect };
/** Pixels relative to the field's border box. */
export type MentionPlace = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
};

/** Design §2.4; null (closed) when there is no line and no note. */
export function mentionList({ known, typed, search, platform }: MentionInput): MentionList | null {
  const found = search.kind === "searching" || search.kind === "found" ? search.people : [];
  const note =
    search.kind === "refused" || search.kind === "failed"
      ? peopleSearchText(search, platform)
      : null;
  const lines = mentionLines(known, found, typed).map((person) => ({
    username: person.username,
    picture: person,
    label: displayName(person),
  }));
  return lines.length === 0 && note === null ? null : { lines, note };
}

/** The open word (design §2.1): null while composing, with a selection, with no word, or for the word Escape
 *  dismissed (`dismissed` is that word's start). */
export function mentionRead(read: FieldRead, dismissed: number | null): MentionWord | null {
  if (read.composing || read.selectionStart !== read.selectionEnd) {
    return null;
  }
  const word = mentionWordAt(read.text, read.selectionStart);
  return word?.start === dismissed ? null : word;
}

export const MENTION_CLOSED: MentionState = { word: null, dismissed: null, composing: false };

function heldDismissal(dismissed: Dismissal | null, read: FieldRead): Dismissal | null {
  const under = mentionRead(read, null);
  if (dismissed === null || under?.start !== dismissed.start) {
    return null;
  }
  return dismissed.kind === "escape" || dismissed.text === read.text ? dismissed : null;
}

function readState(read: FieldRead, dismissed: Dismissal | null): MentionState {
  const held = heldDismissal(dismissed, read);
  return {
    word: mentionRead(read, held?.start ?? null),
    dismissed: held,
    composing: read.composing,
  };
}

function closedDismissal(field: FieldText, composing: boolean): Dismissal | null {
  const under = mentionRead({ ...field, composing }, null);
  return under === null ? null : { kind: "close", start: under.start, text: field.text };
}

function stateAfter(state: MentionState, event: MentionEvent): MentionState {
  switch (event.kind) {
    case "read":
      return readState({ ...event.field, composing: state.composing }, state.dismissed);
    case "compose":
      return readState({ ...event.field, composing: event.composing }, state.dismissed);
    case "escape":
      return {
        ...state,
        word: null,
        dismissed: state.word === null ? null : { kind: "escape", start: state.word.start },
      };
    case "close":
      return { ...state, word: null, dismissed: closedDismissal(event.field, state.composing) };
    case "blur":
      return { ...state, word: null };
  }
}

function callAfter(before: MentionWord | null, after: MentionWord | null): MentionCall {
  if (after === null) {
    return before === null ? { kind: "none" } : { kind: "end" };
  }
  return before?.start === after.start && before.typed === after.typed
    ? { kind: "none" }
    : { kind: "search", typed: after.typed };
}

/** Design §2.6 "Closing" and the dismissal rules: the next state and the search call `event` makes. */
export function mentionStep(state: MentionState, event: MentionEvent): MentionStep {
  const after = stateAfter(state, event);
  return { state: after, call: callAfter(state.word, after.word) };
}

/** Design §2.7 step 1: the edit that writes line `index` of `list` over the open `word`; null with no such line. */
export function mentionPick(
  word: MentionWord | null,
  list: MentionList | null,
  index: number,
): MentionEdit | null {
  const line = list?.lines[index];
  return word === null || line === undefined ? null : mentionEdit(word, line.username);
}

/** Design §2.6's table; null: the key is the field's. */
export function mentionKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">,
  list: MentionList | null,
): MentionKey | null {
  if (
    list === null ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return null;
  }
  if (event.key === "Escape") {
    return { kind: "close" };
  }
  if (list.lines.length === 0) {
    return null;
  }
  const step = ARROW_STEPS[event.key];
  if (step !== undefined) {
    return { kind: "step", step };
  }
  return event.key === "Enter" || event.key === "Tab" ? { kind: "pick" } : null;
}

function usernamesOf(lines: readonly MentionLine[]): string {
  return lines.map((line) => line.username).join("\n");
}

/** `current` while the usernames are unchanged, else 0. */
export function highlightAfter(
  before: readonly MentionLine[],
  after: readonly MentionLine[],
  current: number,
): number {
  return usernamesOf(before) === usernamesOf(after) ? current : 0;
}

/** The id of the list's option at `index`: the field's `aria-activedescendant` names it. */
export function mentionOptionId(listId: string, index: number): string {
  return `${listId}-${index}`;
}

/** Design §2.5 "Placement". */
export function mentionPlace({ caret, field, room }: MentionAnchor, list: Size): MentionPlace {
  const below = room.bottom - field.top - caret.bottom;
  const above = field.top + caret.top - room.top;
  const onBelow = list.height <= below || below >= above;
  const maxHeight = onBelow ? below : above;
  const left = Math.max(
    room.left - field.left,
    Math.min(caret.left, room.right - field.left - list.width),
  );
  return {
    left,
    top: onBelow ? caret.bottom : caret.top - Math.min(list.height, above),
    maxHeight,
  };
}
