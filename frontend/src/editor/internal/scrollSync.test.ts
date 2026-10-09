import { expect, test } from "vitest";

import type { Span } from "../../connectors";
import type { Pane } from "./geometry";
import { anchorsOf, targets, type Anchor } from "./scrollSync";

const LINE_PX = 20;

type Lines = { readonly start: number; readonly len: number };

function span({ start, len }: Lines): Span {
  return { top: start * LINE_PX, bottom: (start + len) * LINE_PX };
}

function row(left: Lines, center: Lines, right: Lines): Record<Pane, Span> {
  return { left: span(left), center: span(center), right: span(right) };
}

function ends(left: number, center: number, right: number): Anchor {
  return { left: left * LINE_PX, center: center * LINE_PX, right: right * LINE_PX };
}

test("without chunks every pane follows line for line", () => {
  const anchors = anchorsOf([], ends(100, 100, 100));

  expect(targets(anchors, "center", 730)).toEqual({ left: 730, center: 730, right: 730 });
  expect(targets(anchors, "left", 0)).toEqual({ left: 0, center: 0, right: 0 });
  expect(targets([], "right", 55)).toEqual({ left: 55, center: 55, right: 55 });
});

test("a 5-line chunk against 12 lines maps its edges exactly and its interior proportionally", () => {
  const anchors = anchorsOf(
    [row({ start: 5, len: 5 }, { start: 5, len: 12 }, { start: 5, len: 12 })],
    ends(20, 27, 27),
  );

  expect(targets(anchors, "left", 100).center).toBe(100);
  expect(targets(anchors, "left", 200).center).toBe(340);
  expect(targets(anchors, "left", 150).center).toBe(220);
  expect(targets(anchors, "center", 220).left).toBe(150);
  expect(targets(anchors, "left", 300).center).toBe(440);
});

test("an insertion on the scrolled side holds the follower at the insertion point", () => {
  const anchors = anchorsOf(
    [row({ start: 5, len: 4 }, { start: 5, len: 0 }, { start: 5, len: 0 })],
    ends(30, 26, 26),
  );

  for (const y of [100, 120, 150, 180]) {
    expect(targets(anchors, "left", y)).toEqual({ left: y, center: 100, right: 100 });
  }
  expect(targets(anchors, "left", 200).center).toBeCloseTo(120);
});

test("positions beyond the last anchor and before the first keep the last offset", () => {
  const anchors = anchorsOf(
    [row({ start: 2, len: 3 }, { start: 2, len: 1 }, { start: 2, len: 6 })],
    ends(40, 38, 43),
  );

  expect(targets(anchors, "center", 38 * LINE_PX + 90)).toEqual({
    left: 40 * LINE_PX + 90,
    center: 38 * LINE_PX + 90,
    right: 43 * LINE_PX + 90,
  });
  expect(targets(anchors, "right", -30)).toEqual({ left: -30, center: -30, right: -30 });
});

test("a 2,000-line file with 40 mixed chunks maps every chunk top exactly and never goes back", () => {
  const rows = [];
  const next = { left: 0, center: 0, right: 0 };
  for (let index = 0; index < 40; index += 1) {
    const gap = 30 + (index % 7);
    const lens = { left: (index * 5) % 11, center: (index * 7) % 13, right: (index * 3) % 9 };
    const at = { left: next.left + gap, center: next.center + gap, right: next.right + gap };
    rows.push(
      row(
        { start: at.left, len: lens.left },
        { start: at.center, len: lens.center },
        { start: at.right, len: lens.right },
      ),
    );
    next.left = at.left + lens.left;
    next.center = at.center + lens.center;
    next.right = at.right + lens.right;
  }
  const tail = 2000 - next.center;
  expect(tail).toBeGreaterThan(0);
  const anchors = anchorsOf(rows, ends(next.left + tail, 2000, next.right + tail));
  const panes = ["left", "center", "right"] as const;

  for (const chunk of rows) {
    const top = { left: chunk.left.top, center: chunk.center.top, right: chunk.right.top };
    for (const source of panes) {
      expect(targets(anchors, source, top[source])).toEqual(top);
    }
  }
  for (const source of panes) {
    let previous = targets(anchors, source, -LINE_PX);
    for (let y = 0; y <= 2100 * LINE_PX; y += 7) {
      const current = targets(anchors, source, y);
      for (const pane of panes) {
        expect(current[pane]).toBeGreaterThanOrEqual(previous[pane]);
      }
      previous = current;
    }
  }
});
