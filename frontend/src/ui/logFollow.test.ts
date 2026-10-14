import { expect, test } from "vitest";

import type { LogLine } from "../lsp";
import { droppedAbove } from "./logFollow";

const CAP = 2000;

function line(n: number): LogLine {
  return { at: n, source: "stderr", text: `line ${n}` };
}

function capped(lines: readonly LogLine[]): LogLine[] {
  return lines.slice(Math.max(0, lines.length - CAP));
}

test("below the cap, new lines drop nothing", () => {
  const before = [line(0), line(1)];

  expect(droppedAbove(before, [...before, line(2)])).toBe(0);
});

test("at the 2,000-line cap, each new line drops one above", () => {
  const before = capped(Array.from({ length: CAP }, (_, n) => line(n)));
  const after = capped([...before, line(CAP), line(CAP + 1), line(CAP + 2)]);

  expect(after).toHaveLength(CAP);
  expect(droppedAbove(before, after)).toBe(3);
});

test("equal lines are told apart by identity, not by value", () => {
  const first = line(0);
  const second = line(0);
  const third = line(0);

  expect(droppedAbove([first, second, third], [second, third, line(0)])).toBe(1);
});

test("a log with none of the old lines left dropped them all", () => {
  const before = [line(0), line(1)];

  expect(droppedAbove(before, [line(2), line(3)])).toBe(2);
  expect(droppedAbove(before, [])).toBe(2);
  expect(droppedAbove([], [line(0)])).toBe(0);
});
