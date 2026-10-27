import { expect, test } from "vitest";

import { commandWords } from "./commandWords";

test("a command splits at each run of spaces, leading and trailing spaces dropped", () => {
  expect(commandWords("omp acp")).toEqual(["omp", "acp"]);
  expect(commandWords("  ruff   server --preview ")).toEqual(["ruff", "server", "--preview"]);
  expect(commandWords("pylsp")).toEqual(["pylsp"]);
});

test("an empty or all-space command has no words", () => {
  expect(commandWords("")).toEqual([]);
  expect(commandWords("   ")).toEqual([]);
});

test("only spaces split: quotes and tabs stay inside the words", () => {
  expect(commandWords('"my tool"\t--x')).toEqual(['"my', 'tool"\t--x']);
});
