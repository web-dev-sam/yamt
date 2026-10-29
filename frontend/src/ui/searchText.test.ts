import { expect, test } from "vitest";

import { CUT_TEXT, paneHitTitle, summaryText } from "./searchText";

test.each([
  [1, 1, "1 result in 1 file"],
  [2, 1, "2 results in 1 file"],
  [5, 3, "5 results in 3 files"],
])(
  "%i rows in %i files read as VS Code's summary, singular forms included",
  (rows, files, words) => {
    expect(summaryText({ kind: "results", rows, files, cut: false })).toBe(words);
  },
);

test("the other summaries have VS Code's words, and every pane off says so", () => {
  expect(summaryText({ kind: "searching" })).toBe("Searching…");
  expect(summaryText({ kind: "noResults" })).toBe("No results found.");
  expect(summaryText({ kind: "filteredOut" })).toBe("Every pane is filtered out.");
  expect(CUT_TEXT).toContain("Be more specific in your search");
});

test("a pane icon's title names the pane and its 1-based line", () => {
  expect(paneHitTitle("Result", 0)).toBe("Result, line 1");
  expect(paneHitTitle("feature (2b3b4b5)", 41)).toBe("feature (2b3b4b5), line 42");
});
