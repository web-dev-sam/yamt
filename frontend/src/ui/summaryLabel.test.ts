import { expect, test } from "vitest";

import { summaryLabel } from "./summaryLabel";

test("summaryLabel counts open changes and conflicts, singular and plural", () => {
  expect(summaryLabel({ changes: 0, conflicts: 0 })).toBe("All changes processed");
  expect(summaryLabel({ changes: 1, conflicts: 0 })).toBe("1 change");
  expect(summaryLabel({ changes: 0, conflicts: 1 })).toBe("1 conflict");
  expect(summaryLabel({ changes: 3, conflicts: 1 })).toBe("3 changes · 1 conflict");
  expect(summaryLabel({ changes: 2, conflicts: 2 })).toBe("2 changes · 2 conflicts");
});
