export const PLACEHOLDERS = [
  "RELATIVE_FILE_PATH_WITH_LINE",
  "MESSAGE",
  "RANGE",
  "OLD_COMMIT",
  "NEW_COMMIT",
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];

export const DEFAULT_FIRST_MESSAGE = [
  "You are helping me review the changes {{ RANGE }} ({{ OLD_COMMIT }}..{{ NEW_COMMIT }}).",
  "The current folder is a checkout of {{ NEW_COMMIT }}; `git diff {{ OLD_COMMIT }} {{ NEW_COMMIT }}` shows the changes.",
  "A line removed by the changes is named by its place in {{ OLD_COMMIT }}.",
  "",
  "My comment on {{ RELATIVE_FILE_PATH_WITH_LINE }}:",
  "",
  "{{ MESSAGE }}",
].join("\n");

const PLACEHOLDER = /\{\{\s*([A-Z_]+)\s*\}\}/gu;

function placeholderNamed(name: string): Placeholder | undefined {
  return PLACEHOLDERS.find((placeholder) => placeholder === name);
}

/** Known placeholders get their value; an unknown one is sent as typed. */
export function firstMessage(
  template: string,
  values: Readonly<Record<Placeholder, string>>,
): string {
  return template.replace(PLACEHOLDER, (typed, name: string) => {
    const known = placeholderNamed(name);
    return known === undefined ? typed : values[known];
  });
}

/** Each unknown placeholder as typed, once, in the order it first appears. */
export function unknownPlaceholders(template: string): string[] {
  const typed = [...template.matchAll(PLACEHOLDER)].flatMap(([text, name]) =>
    name === undefined || placeholderNamed(name) !== undefined ? [] : [text],
  );
  return [...new Set(typed)];
}
