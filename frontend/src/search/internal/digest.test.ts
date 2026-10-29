import { expect, test } from "vitest";

import { digestOf } from "./digest";

test("cyrb53's published values (https://stackoverflow.com/a/52171480): a transcription slip", () => {
  expect(["a", "b", "revenge", "revenue"].map(digestOf)).toEqual([
    7929297801672961, 8684336938537663, 4051478007546757, 8309097637345594,
  ]);
});

test("a digest is a safe integer read from every character (a digest of a prefix)", () => {
  const long = `${"x".repeat(1000)}y`;

  expect(Number.isSafeInteger(digestOf(long))).toBe(true);
  expect(digestOf(long)).not.toBe(digestOf(`${"x".repeat(1000)}z`));
  expect(digestOf("")).not.toBe(digestOf("\0"));
});
