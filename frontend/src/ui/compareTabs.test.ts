import { expect, test } from "vitest";

import { languageLabel } from "./compareTabs";

test("Auto shows what it found, or plain text when it found nothing (catches Auto shown without its finding)", () => {
  expect(languageLabel({ kind: "auto" }, "JSON")).toBe("Auto · JSON");
  expect(languageLabel({ kind: "auto" }, null)).toBe("Auto · Plain text");
});

test("a picked language shows its name only, whatever Auto found (catches Auto's finding over the user's pick)", () => {
  expect(languageLabel({ kind: "picked", name: "TypeScript" }, "JSON")).toBe("TypeScript");
});
