import { expect, test } from "vitest";

import type { Preview } from "../index";
import { previewOf } from "./preview";

test("preview: leading whitespace trimmed, the match and the rest of the line (wrong trimming)", () => {
  const preview: Preview = previewOf({ lineText: "    let x = foo(1);", from: 12, to: 15 });

  expect(preview).toEqual({ before: "let x = ", match: "foo", after: "(1);" });
});

test("preview: 26 characters before the match with … when cut (wrong trimming)", () => {
  const before = "abcdefghijklmnopqrstuvwxyz";

  expect(previewOf({ lineText: `${before}foo`, from: 26, to: 29 })).toEqual({
    before,
    match: "foo",
    after: "",
  });
  expect(previewOf({ lineText: `  0${before}foo`, from: 29, to: 32 })).toEqual({
    before: `…${before}`,
    match: "foo",
    after: "",
  });
});

test("preview: a cut never splits a surrogate pair", () => {
  const before = `😀${"a".repeat(25)}`;

  expect(previewOf({ lineText: `${before}foo`, from: 27, to: 30 }).before).toBe(
    `…${"a".repeat(25)}`,
  );
  expect(previewOf({ lineText: `b${before}foo`, from: 28, to: 31 }).before).toBe(
    `…${"a".repeat(25)}`,
  );
});
