import { expect, test } from "vitest";

import { isDocVersion, nextVersion } from "./version";

test("a document version is a positive safe integer", () => {
  expect([1, 7, Number.MAX_SAFE_INTEGER].map(isDocVersion)).toEqual([true, true, true]);
  expect([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN].map(isDocVersion)).toEqual([
    false,
    false,
    false,
    false,
    false,
  ]);
});

test("versions start at 1 and rise by one; past the safe range is an error", () => {
  const first = nextVersion(null);

  expect(first).toBe(1);
  expect(nextVersion(nextVersion(first))).toBe(3);
  const last = Number.MAX_SAFE_INTEGER;
  if (!isDocVersion(last)) {
    throw new Error("MAX_SAFE_INTEGER is a version");
  }
  expect(() => nextVersion(last)).toThrow(
    new RangeError("document version 9007199254740992 is not a safe integer"),
  );
});
