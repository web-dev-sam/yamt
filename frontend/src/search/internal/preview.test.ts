import { expect, test } from "vitest";

import type { Preview } from "../index";
import { previewOf } from "./preview";

test("preview: leading whitespace trimmed, the match and the rest of the line (wrong trimming)", () => {
  const preview: Preview = previewOf("    let x = foo(1);", 12, 15);

  expect(preview).toEqual({ before: "let x = ", match: "foo", after: "(1);" });
});

test("preview: 26 characters before the match with … when cut (wrong trimming)", () => {
  const before = "abcdefghijklmnopqrstuvwxyz";

  expect(previewOf(`${before}foo`, 26, 29)).toEqual({ before, match: "foo", after: "" });
  expect(previewOf(`  0${before}foo`, 29, 32)).toEqual({
    before: `…${before}`,
    match: "foo",
    after: "",
  });
});

test("preview: a cut never splits a surrogate pair", () => {
  const before = `😀${"a".repeat(25)}`;

  expect(previewOf(`${before}foo`, 27, 30).before).toBe(`…${"a".repeat(25)}`);
  expect(previewOf(`b${before}foo`, 28, 31).before).toBe(`…${"a".repeat(25)}`);
});
