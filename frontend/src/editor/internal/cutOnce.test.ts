import { expect, test } from "vitest";

import { cutGate } from "./cutOnce";

function gate(): { takes: () => boolean; nextTask: () => void } {
  const queued: (() => void)[] = [];
  const takes = cutGate((open) => queued.push(open));
  return {
    takes,
    nextTask: () => {
      for (const open of queued.splice(0)) {
        open();
      }
    },
  };
}

test("one key press's second cut, in the same task, is refused", () => {
  const { takes } = gate();

  expect([takes(), takes(), takes()]).toEqual([true, false, false]);
});

test("two presses, each in its own task, cut twice", () => {
  const { takes, nextTask } = gate();

  expect(takes()).toBe(true);
  nextTask();
  expect(takes()).toBe(true);
  expect(takes()).toBe(false);
  nextTask();
  expect(takes()).toBe(true);
});
