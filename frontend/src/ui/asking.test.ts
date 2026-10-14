import { expect, test } from "vitest";

import { createAsking } from "./asking";
import type { Question } from "./question";

const EXIT: Question = { kind: "exit", files: ["a.ts"] };
const OTHER: Question = { kind: "exit", files: ["b.ts"] };

test.each([
  ["Yes", "yes", true],
  ["No", "no", false],
] as const)("%s ends the question as %s", async (_, reply, yes) => {
  const asking = createAsking();
  const asked = asking.ask(EXIT);
  expect(asking.question.value).toBe(EXIT);

  asking.answer(yes);

  await expect(asked).resolves.toBe(reply);
  expect(asking.question.value).toBeNull();
});

test("Escape ends the question as dismissed", async () => {
  const asking = createAsking();
  const asked = asking.ask(EXIT);

  asking.dismiss();

  await expect(asked).resolves.toBe("dismissed");
  expect(asking.question.value).toBeNull();
});

test("a second question while one waits is dismissed at once and leaves the first waiting", async () => {
  const asking = createAsking();
  const first = asking.ask(EXIT);

  await expect(asking.ask(OTHER)).resolves.toBe("dismissed");
  expect(asking.question.value).toBe(EXIT);

  asking.answer(true);
  await expect(first).resolves.toBe("yes");
});

test("answering or dismissing with nothing asked does nothing", () => {
  const asking = createAsking();

  asking.answer(true);
  asking.dismiss();

  expect(asking.question.value).toBeNull();
});
