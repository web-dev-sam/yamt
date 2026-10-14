import { expect, test } from "vitest";

import { lineDiff, type LineEdit } from "./lineDiff";

function applied(old: readonly string[], edits: readonly LineEdit[]): string[] {
  const result: string[] = [];
  let at = 0;
  for (const { from, to, lines } of edits) {
    result.push(...old.slice(at, from), ...lines);
    at = to;
  }
  return [...result, ...old.slice(at)];
}

function seeded(seed: number): (below: number) => number {
  let state = seed;
  return (below) => {
    state = (state * 48_271) % 2_147_483_647;
    return state % below;
  };
}

test("lineDiff: applying the edits to the old lines gives the new ones, in order and without overlap", () => {
  const random = seeded(11);
  const words = ["a", "b", "c", "", "  d", "e;"];
  function lines(): string[] {
    return Array.from({ length: random(30) }, () => words[random(words.length)] ?? "");
  }

  for (let round = 0; round < 500; round += 1) {
    const old = lines();
    const next = random(4) === 0 ? lines() : old.map((line) => (random(5) === 0 ? "x" : line));
    if (random(3) === 0) {
      next.splice(random(next.length + 1), 0, ...lines().slice(0, random(4)));
    }
    const edits = lineDiff(old, next);

    expect(applied(old, edits)).toEqual(next);
    edits.forEach((edit, index) => {
      expect(edit.from).toBeLessThanOrEqual(edit.to);
      expect(edit.to > edit.from || edit.lines.length > 0).toBe(true);
      expect(edit.from).toBeGreaterThan(edits[index - 1]?.to ?? -1);
    });
  }
});

test("lineDiff: identical lines give no edits", () => {
  expect(lineDiff(["a", "b", ""], ["a", "b", ""])).toEqual([]);
  expect(lineDiff([""], [""])).toEqual([]);
});

test("lineDiff: changes far apart stay two edits and keep every line between them", () => {
  const old = Array.from({ length: 410 }, (_, index) => `line ${index}`);
  const next = old.map((line, index) => (index === 2 || index === 399 ? `${line};` : line));

  expect(lineDiff(old, next)).toEqual([
    { from: 2, to: 3, lines: ["line 2;"] },
    { from: 399, to: 400, lines: ["line 399;"] },
  ]);
});

test("lineDiff: an inserted and a removed line are a pure insertion and a pure deletion", () => {
  expect(lineDiff(["a", "b", "c"], ["a", "x", "b", "c"])).toEqual([
    { from: 1, to: 1, lines: ["x"] },
  ]);
  expect(lineDiff(["a", "b", "c"], ["a", "c"])).toEqual([{ from: 1, to: 2, lines: [] }]);
});

test("lineDiff: a 5,000-line file whose every other line changed keeps each unchanged line", () => {
  const old = Array.from({ length: 5000 }, (_, index) => `old ${index}`);
  const next = old.map((line, index) => (index % 2 === 0 ? `new ${index}` : line));

  const edits = lineDiff(old, next);

  expect(edits).toHaveLength(2500);
  expect(applied(old, edits)).toEqual(next);
});
