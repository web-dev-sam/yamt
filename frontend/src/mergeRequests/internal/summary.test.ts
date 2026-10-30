import { expect, test } from "vitest";

import { summaryText } from "../index";

test("the summary counts the shown rows of the loaded ones", () => {
  expect(summaryText(12, 40, false)).toBe("12 of 40 merge requests");
  expect(summaryText(0, 0, false)).toBe("0 of 0 merge requests");
  expect(summaryText(1, 1, false)).toBe("1 of 1 merge request");
  expect(summaryText(1, 2, false)).toBe("1 of 2 merge requests");
});

test("a cut list says only the newest were loaded", () => {
  expect(summaryText(12, 500, true)).toBe(
    "12 of 500 merge requests (the newest 500; GitLab has more)",
  );
});
