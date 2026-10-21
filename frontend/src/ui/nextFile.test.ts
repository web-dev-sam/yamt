import { expect, test } from "vitest";

import type { FileEntry } from "../ipc";
import { nextUnresolved } from "./nextFile";

function file(path: string, status: FileEntry["status"]): FileEntry {
  return { path, status, unsupported: null };
}

const FILES: readonly FileEntry[] = [
  file("a.ts", "Unresolved"),
  file("b.ts", "Resolved"),
  file("c.ts", "Resolved"),
  file("d.ts", "Unresolved"),
  file("e.ts", "Resolved"),
];

test("the next unresolved file after the active one, skipping resolved ones", () => {
  expect(nextUnresolved(FILES, "b.ts")).toBe("d.ts");
  expect(nextUnresolved(FILES, "a.ts")).toBe("d.ts");
});

test("past the end it wraps to the top", () => {
  expect(nextUnresolved(FILES, "d.ts")).toBe("a.ts");
  expect(nextUnresolved(FILES, "e.ts")).toBe("a.ts");
});

test("none left is null", () => {
  const resolved = FILES.map((entry): FileEntry => ({ ...entry, status: "Resolved" }));

  expect(nextUnresolved(resolved, "b.ts")).toBeNull();
  expect(nextUnresolved([], null)).toBeNull();
});

test("the active file as the only unresolved one is null, not itself", () => {
  const only = [file("a.ts", "Resolved"), file("b.ts", "Unresolved"), file("c.ts", "Resolved")];

  expect(nextUnresolved(only, "b.ts")).toBeNull();
});

test("an active file not in the list, or none, starts from the top", () => {
  expect(nextUnresolved(FILES, "gone.ts")).toBe("a.ts");
  expect(nextUnresolved(FILES, null)).toBe("a.ts");
});

test("a file git rerere filled in is not resolved yet: Next file goes there", () => {
  const files = [file("a.ts", "Unresolved"), file("b.ts", "Resolved"), file("c.ts", "Remembered")];

  expect(nextUnresolved(files, "a.ts")).toBe("c.ts");
  expect(nextUnresolved(files, "c.ts")).toBe("a.ts");
});
