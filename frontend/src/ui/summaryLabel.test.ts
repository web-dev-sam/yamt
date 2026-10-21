import { expect, test } from "vitest";

import { summaryLabel } from "./summaryLabel";

test("summaryLabel counts open changes and conflicts, singular and plural", () => {
  expect(summaryLabel({ changes: 0, conflicts: 0, remembered: 0 })).toBe("All changes processed");
  expect(summaryLabel({ changes: 1, conflicts: 0, remembered: 0 })).toBe("1 change");
  expect(summaryLabel({ changes: 0, conflicts: 1, remembered: 0 })).toBe("1 conflict");
  expect(summaryLabel({ changes: 3, conflicts: 1, remembered: 0 })).toBe("3 changes · 1 conflict");
  expect(summaryLabel({ changes: 2, conflicts: 2, remembered: 0 })).toBe("2 changes · 2 conflicts");
});

test("remembered conflicts are counted apart, last, and the word has no plural (catches them shown as conflicts or hidden)", () => {
  expect(summaryLabel({ changes: 0, conflicts: 0, remembered: 1 })).toBe("1 remembered");
  expect(summaryLabel({ changes: 0, conflicts: 0, remembered: 2 })).toBe("2 remembered");
  expect(summaryLabel({ changes: 1, conflicts: 2, remembered: 1 })).toBe(
    "1 change · 2 conflicts · 1 remembered",
  );
});
