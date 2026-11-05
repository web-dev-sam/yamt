import type { Person } from "./filters";
import { peopleOnRow, type KnownPeople } from "./suggestions";

/** GitLab's `@` list shows 10 lines (gfm_auto_complete.js `limit: 10`, request rule 2). */
export const MENTION_LINES = 10;

/** The mention being typed: `text[start]` is "@"; `typed` is the text between it and the caret; `end` (≥ the
 *  caret) is where the word's characters stop. */
export type MentionWord = { readonly start: number; readonly end: number; readonly typed: string };

/** Rule 4: replace the whole word with "@<username> " (one space). */
export type MentionEdit = { readonly from: number; readonly to: number; readonly insert: string };

/** Request rule 1. `caret` is a UTF-16 index (a textarea's `selectionStart`); null: the caret is in no mention word. */
export function mentionWordAt(text: string, caret: number): MentionWord | null {
  if (caret < 0 || caret > text.length) {
    return null;
  }
  const at = /@[\p{L}\p{N}_.-]*$/u.exec(text.slice(0, caret));
  if (at === null) {
    return null;
  }
  const start = at.index;
  if (start > 0 && !/[\s([{]/u.test(text.charAt(start - 1))) {
    return null;
  }
  const wordStop = text.slice(caret).search(/[^\p{L}\p{N}_.-]/u);
  const end = wordStop < 0 ? text.length : caret + wordStop;
  return { start, end, typed: text.slice(start + 1, caret) };
}

function eachUsernameOnce<P extends Person>(people: readonly P[]): readonly P[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    const first = !seen.has(person.username);
    seen.add(person.username);
    return first;
  });
}

/** The merge request's people for a field (rule 2): `row`'s author, assignees, reviewers, approvers (suggestions'
 *  `peopleOnRow`), then the non-null `writers`, each username once, in that order; a null `row`: the writers only. */
export function knownMentions<P extends Person>(
  row: KnownPeople<P> | null,
  writers: readonly (P | null)[],
): readonly P[] {
  const present = writers.filter((writer) => writer !== null);
  return eachUsernameOnce([...(row === null ? [] : peopleOnRow(row)), ...present]);
}

function matchOf(person: Person, query: string): "starts" | "contains" | null {
  const nameTerm = person.name.replace(/\s+/gu, "").toLowerCase();
  const usernameTerm = person.username.toLowerCase();
  if (nameTerm.startsWith(query) || usernameTerm.startsWith(query)) {
    return "starts";
  }
  return `${nameTerm} ${usernameTerm}`.includes(query) ? "contains" : null;
}

function matching<P extends Person>(people: readonly P[], query: string): readonly P[] {
  return [
    ...people.filter((person) => matchOf(person, query) === "starts"),
    ...people.filter((person) => matchOf(person, query) === "contains"),
  ];
}

/** Rule 2's lines: `known` matching `typed`, then `found` matching it; inside each, starts-with before contains (order
 *  kept); each username once (the first wins); at most MENTION_LINES. A blank `typed`: every known person, no found. */
export function mentionLines<P extends Person>(
  known: readonly P[],
  found: readonly P[],
  typed: string,
): readonly P[] {
  const query = typed.toLowerCase();
  const lines =
    typed.trim() === "" ? known : [...matching(known, query), ...matching(found, query)];
  return eachUsernameOnce(lines).slice(0, MENTION_LINES);
}

/** Rule 4: the edit that replaces `word` with "@<username> ". */
export function mentionEdit(word: MentionWord, username: string): MentionEdit {
  return { from: word.start, to: word.end, insert: `@${username} ` };
}
