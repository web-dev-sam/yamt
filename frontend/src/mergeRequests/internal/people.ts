import type { Person, ReviewState } from "./filters";

export const STACK_SHOWN = 3;
export const NO_PEOPLE_TEXT = "No assignee or reviewer";

const HUES = 360;
const HASH_FACTOR = 31;
const INITIALS_WORDS = 2;

const REVIEW_STATE_TEXTS: Readonly<Record<ReviewState, string>> = {
  requested: "Review requested",
  reviewed: "Reviewed",
  approved: "Approved",
  changesRequested: "Changes requested",
};

const REVIEW_DONE: Readonly<Record<ReviewState, boolean>> = {
  requested: false,
  reviewed: true,
  approved: true,
  changesRequested: true,
};

export function peopleStack<P extends Person>(
  assignees: readonly P[],
  reviewers: readonly { readonly person: P }[],
): { readonly shown: readonly P[]; readonly more: number } {
  const assigned = new Set(assignees.map((person) => person.username));
  const people = [
    ...assignees,
    ...reviewers
      .map((reviewer) => reviewer.person)
      .filter((person) => !assigned.has(person.username)),
  ];
  return { shown: people.slice(0, STACK_SHOWN), more: Math.max(people.length - STACK_SHOWN, 0) };
}

export function displayName(person: Person): string {
  return person.name.trim() === "" ? person.username : person.name;
}

/** Each username once, the first wins, order kept. */
export function eachUsernameOnce<P extends Person>(people: readonly P[]): readonly P[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    const first = !seen.has(person.username);
    seen.add(person.username);
    return first;
  });
}

export function initials(person: Person): string {
  return displayName(person)
    .trim()
    .split(/\s+/u)
    .slice(0, INITIALS_WORDS)
    .map((word) => (Array.from(word)[0] ?? "").toUpperCase())
    .join("");
}

export function pictureHue(username: string): number {
  let hue = 0;
  for (const letter of username) {
    hue = (hue * HASH_FACTOR + (letter.codePointAt(0) ?? 0)) % HUES;
  }
  return hue;
}

export function reviewStateText(state: ReviewState): string {
  return REVIEW_STATE_TEXTS[state];
}

/** Whether GitLab's "Re-request review" applies (owner answer 2104): reviewed, approved or changes requested. */
export function reviewDone(state: ReviewState): boolean {
  return REVIEW_DONE[state];
}

export function authorText(author: Person | null): string {
  return `Author: ${author === null ? "unknown" : displayName(author)}`;
}

export function approversText(approvers: readonly Person[]): string {
  return approvers.length === 0 ? "No approvals" : approvers.map(displayName).join("\n");
}
