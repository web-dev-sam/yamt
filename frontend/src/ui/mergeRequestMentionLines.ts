import type { Person } from "../ipc";
import { displayName, mentionLines, mentionWordAt, type MentionWord } from "../mergeRequests";
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
