import { expect, test } from "vitest";

import { noteChangeBlock } from "./noteChange";

const SENDING = { done: 0, of: 2 };
const TURN = { entries: [], answer: "" };

test("a running send blocks Edit and Delete first, then the thread's AI turn", () => {
  expect(noteChangeBlock(null, null)).toBeNull();
  expect(noteChangeBlock(null, TURN)).toBe("aiWorking");
  expect(noteChangeBlock(SENDING, null)).toBe("sending");
  expect(noteChangeBlock(SENDING, TURN)).toBe("sending");
});
