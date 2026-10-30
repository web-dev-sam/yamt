import { sameValue, type LabelValue, type ListedRequest, type PersonValue } from "./filters";

export type Choice<V> = {
  readonly value: V;
  readonly label: string;
  readonly count: number;
  readonly checked: boolean;
};

export const NARROW_FROM = 8;

const ME: PersonValue = { kind: "me" };
const NO_PERSON: PersonValue = { kind: "none" };
const NO_LABEL: LabelValue = { kind: "none" };

function byLabel<V>(a: Choice<V>, b: Choice<V>): number {
  return a.label.localeCompare(b.label, "en");
}

function choice<V extends PersonValue | LabelValue>(
  value: V,
  label: string,
  count: number,
  checked: readonly V[],
): Choice<V> {
  return { value, label, count, checked: checked.some((held) => sameValue(held, value)) };
}

type Seen = { readonly name: string; count: number };

function peopleOf(
  rows: readonly ListedRequest[],
  field: "assignees" | "reviewers",
): ReadonlyMap<string, Readonly<Seen>> {
  const people = new Map<string, Seen>();
  for (const row of rows) {
    for (const { username, name } of row[field]) {
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
  checked: readonly PersonValue[],
): readonly Choice<PersonValue>[] {
  if (me !== null) {
    return [choice(ME, "Me", people.get(me)?.count ?? 0, checked)];
  }
  return checked.some((held) => held.kind === "me") ? [choice(ME, "Me", 0, checked)] : [];
}

export function personChoices(
  rows: readonly ListedRequest[],
  field: "assignees" | "reviewers",
  me: string | null,
  checked: readonly PersonValue[],
): readonly Choice<PersonValue>[] {
  const people = peopleOf(rows, field);
  const none = choice(
    NO_PERSON,
    "None",
    rows.filter((row) => row[field].length === 0).length,
    checked,
  );
  const others = [...people]
    .filter(([username]) => username !== me)
    .map(([username, { name, count }]) =>
      choice<PersonValue>({ kind: "person", username }, name, count, checked),
    );
  const missing = checked.flatMap((held) =>
    held.kind === "person" && (held.username === me || !people.has(held.username))
      ? [
          {
            value: held,
            label: held.username,
            count: people.get(held.username)?.count ?? 0,
            checked: true,
          },
        ]
      : [],
  );
  return [...meChoice(people, me, checked), none, ...[...others, ...missing].toSorted(byLabel)];
}

export function labelChoices(
  rows: readonly ListedRequest[],
  checked: readonly LabelValue[],
): readonly Choice<LabelValue>[] {
  const titles = new Set(rows.flatMap((row) => row.labels));
  const none = choice(
    NO_LABEL,
    "None",
    rows.filter((row) => row.labels.length === 0).length,
    checked,
  );
  const found = [...titles].map((title) =>
    choice<LabelValue>(
      { kind: "label", title },
      title,
      rows.filter((row) => row.labels.includes(title)).length,
      checked,
    ),
  );
  const missing = checked.flatMap((held) =>
    held.kind === "label" && !titles.has(held.title)
      ? [{ value: held, label: held.title, count: 0, checked: true }]
      : [],
  );
  return [none, ...[...found, ...missing].toSorted(byLabel)];
}

export function narrowed<V>(choices: readonly Choice<V>[], typed: string): readonly Choice<V>[] {
  const needle = typed.trim().toLowerCase();
  return choices.filter((listed) => listed.label.toLowerCase().includes(needle));
}
