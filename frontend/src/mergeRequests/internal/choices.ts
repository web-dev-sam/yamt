import {
  rowPeople,
  stateOf,
  type ChoiceState,
  type Held,
  type LabelValue,
  type ListedRequest,
  type PersonValue,
} from "./filters";

export type Choice<V> = {
  readonly value: V;
  readonly label: string;
  readonly count: number;
  readonly state: ChoiceState;
};

export const NARROW_FROM = 8;

const ME: PersonValue = { kind: "me" };
const NO_PERSON: PersonValue = { kind: "none" };
const NO_LABEL: LabelValue = { kind: "none" };

function byCountThenLabel<V>(a: Choice<V>, b: Choice<V>): number {
  return a.count === b.count ? a.label.localeCompare(b.label, "en") : b.count - a.count;
}

function choice<V extends PersonValue | LabelValue>(
  value: V,
  label: string,
  count: number,
  held: readonly Held<V>[],
): Choice<V> {
  return { value, label, count, state: stateOf(held, value) };
}

type Seen = { readonly name: string; count: number };

function peopleOf(
  rows: readonly ListedRequest[],
  field: "assignees" | "reviewers",
): ReadonlyMap<string, Readonly<Seen>> {
  const people = new Map<string, Seen>();
  for (const row of rows) {
    for (const { username, name } of rowPeople(row, field)) {
      const seen = people.get(username);
      if (seen === undefined) {
        people.set(username, { name, count: 1 });
      } else {
        seen.count += 1;
      }
    }
  }
  return people;
}

function meChoice(
  people: ReadonlyMap<string, Readonly<Seen>>,
  me: string | null,
  held: readonly Held<PersonValue>[],
): readonly Choice<PersonValue>[] {
  if (me !== null) {
    return [choice(ME, "Me", people.get(me)?.count ?? 0, held)];
  }
  return held.some((entry) => entry.value.kind === "me") ? [choice(ME, "Me", 0, held)] : [];
}

export function personChoices(
  rows: readonly ListedRequest[],
  field: "assignees" | "reviewers",
  me: string | null,
  held: readonly Held<PersonValue>[],
): readonly Choice<PersonValue>[] {
  const people = peopleOf(rows, field);
  const none = choice(
    NO_PERSON,
    "None",
    rows.filter((row) => row[field].length === 0).length,
    held,
  );
  const others = [...people]
    .filter(([username]) => username !== me)
    .map(([username, { name, count }]) =>
      choice<PersonValue>({ kind: "person", username }, name, count, held),
    );
  const missing = held.flatMap(({ value, mode }) =>
    value.kind === "person" && (value.username === me || !people.has(value.username))
      ? [
          {
            value,
            label: value.username,
            count: people.get(value.username)?.count ?? 0,
            state: mode,
          },
        ]
      : [],
  );
  return [
    ...meChoice(people, me, held),
    none,
    ...[...others, ...missing].toSorted(byCountThenLabel),
  ];
}

export function labelChoices(
  rows: readonly ListedRequest[],
  held: readonly Held<LabelValue>[],
): readonly Choice<LabelValue>[] {
  const counts = new Map<string, number>();
  for (const { title } of rows.flatMap((row) => row.labels)) {
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const none = choice(NO_LABEL, "None", rows.filter((row) => row.labels.length === 0).length, held);
  const found = [...counts].map(([title, count]) =>
    choice<LabelValue>({ kind: "label", title }, title, count, held),
  );
  const missing = held.flatMap(({ value, mode }) =>
    value.kind === "label" && !counts.has(value.title)
      ? [{ value, label: value.title, count: 0, state: mode }]
      : [],
  );
  return [none, ...[...found, ...missing].toSorted(byCountThenLabel)];
}

export function narrowed<V>(choices: readonly Choice<V>[], typed: string): readonly Choice<V>[] {
  const needle = typed.trim().toLowerCase();
  return choices.filter((listed) => listed.label.toLowerCase().includes(needle));
}
