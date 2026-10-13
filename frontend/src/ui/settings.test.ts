import { expect, test } from "vitest";

import { showsAntialiasing } from "./settings";

test("antialiasing is shown on Linux platforms only", () => {
  expect(showsAntialiasing("Linux x86_64")).toBe(true);
  expect(showsAntialiasing("Linux aarch64")).toBe(true);
  expect(showsAntialiasing("MacIntel")).toBe(false);
  expect(showsAntialiasing("Win32")).toBe(false);
  expect(showsAntialiasing("")).toBe(false);
  expect(showsAntialiasing("FreeBSD amd64 Linux")).toBe(false);
});
