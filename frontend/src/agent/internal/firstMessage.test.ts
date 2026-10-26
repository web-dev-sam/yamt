import { expect, test } from "vitest";

import {
  DEFAULT_FIRST_MESSAGE,
  firstMessage,
  PLACEHOLDERS,
  unknownPlaceholders,
  type Placeholder,
} from "./firstMessage";

const VALUES: Readonly<Record<Placeholder, string>> = {
  RELATIVE_FILE_PATH_WITH_LINE: "src/board/board.ts:12",
  MESSAGE: "Why $& and $1 here?",
  RANGE: "main...feature",
  OLD_COMMIT: "1a2b3c4",
  NEW_COMMIT: "5d6e7f8",
};

test("each known placeholder gets its value, written as typed by `$` patterns", () => {
  expect(firstMessage("{{ MESSAGE }} on {{ RELATIVE_FILE_PATH_WITH_LINE }}", VALUES)).toBe(
    "Why $& and $1 here? on src/board/board.ts:12",
  );
});

test("an unknown placeholder is sent as typed", () => {
  expect(firstMessage("{{ FOO }} {{ RANGE }} {{ BAR_BAZ }}", VALUES)).toBe(
    "{{ FOO }} main...feature {{ BAR_BAZ }}",
  );
});

test("a repeated placeholder is filled every time", () => {
  expect(firstMessage("{{ OLD_COMMIT }}..{{ NEW_COMMIT }}, {{ OLD_COMMIT }}", VALUES)).toBe(
    "1a2b3c4..5d6e7f8, 1a2b3c4",
  );
});

test.each([["{{RANGE}}"], ["{{ RANGE }}"], ["{{   RANGE\t}}"], ["{{\nRANGE\n}}"]])(
  "spacing %j inside the braces is allowed",
  (template) => {
    expect(firstMessage(template, VALUES)).toBe("main...feature");
  },
);

test("lower case or single braces are not placeholders", () => {
  expect(firstMessage("{{ range }} { RANGE } {RANGE}", VALUES)).toBe(
    "{{ range }} { RANGE } {RANGE}",
  );
});

test("the default message names all five placeholders and fills to plain text", () => {
  for (const placeholder of PLACEHOLDERS) {
    expect(DEFAULT_FIRST_MESSAGE).toContain(`{{ ${placeholder} }}`);
  }
  expect(firstMessage(DEFAULT_FIRST_MESSAGE, VALUES)).toBe(
    [
      "You are helping me review the changes main...feature (1a2b3c4..5d6e7f8).",
      "The current folder is a checkout of 5d6e7f8; `git diff 1a2b3c4 5d6e7f8` shows the changes.",
      "A line removed by the changes is named by its place in 1a2b3c4.",
      "",
      "My comment on src/board/board.ts:12:",
      "",
      "Why $& and $1 here?",
    ].join("\n"),
  );
});

test("unknownPlaceholders names each unknown one once, as typed, in order", () => {
  expect(unknownPlaceholders("{{ FOO }} {{ RANGE }} {{BAR}} {{ FOO }} {{ MESSAGE }}")).toEqual([
    "{{ FOO }}",
    "{{BAR}}",
  ]);
  expect(unknownPlaceholders(DEFAULT_FIRST_MESSAGE)).toEqual([]);
});
