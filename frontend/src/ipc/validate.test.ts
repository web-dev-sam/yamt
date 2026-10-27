import { expect, test } from "vitest";

import { isTabId } from "./domain";
import { branded } from "./validate";

test("branded returns a value its guard accepts", () => {
  expect(branded(3, isTabId, "tab")).toBe(3);
});

test.each([-1, 0.5])("branded refuses %s, naming the field", (bad) => {
  expect(() => branded(bad, isTabId, "tabs[2].id")).toThrow(
    `tabs[2].id must be a non-negative safe integer, got ${bad}`,
  );
});
