import { expect, test } from "vitest";

import { menuAfterClick } from "./serverMenuToggle";

const OXLINT = { name: "oxlint", at: 10 };
const OXFMT = { name: "oxfmt", at: 20 };

test("a server's button opens its menu when none is open", () => {
  expect(menuAfterClick(null, OXLINT)).toBe(OXLINT);
});

test("the open server's own button closes its menu", () => {
  expect(menuAfterClick(OXLINT, { ...OXLINT })).toBeNull();
});

test("another server's button moves the menu to that server", () => {
  expect(menuAfterClick(OXLINT, OXFMT)).toBe(OXFMT);
});
