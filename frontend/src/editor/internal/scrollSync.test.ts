import { afterEach, expect, test, vi } from "vitest";

import type { Span } from "../../connectors";
import { PANES, type Pane } from "./geometry";
import { anchorsOf, ScrollSync, targets as paneTargets, type Anchor } from "./scrollSync";

const LINE_PX = 20;

type Lines = { readonly start: number; readonly len: number };

function span({ start, len }: Lines): Span {
  return { top: start * LINE_PX, bottom: (start + len) * LINE_PX };
}

function row(left: Lines, center: Lines, right: Lines): Record<Pane, Span> {
  return { left: span(left), center: span(center), right: span(right) };
}

function ends(left: number, center: number, right: number): Anchor<Pane> {
  return { left: left * LINE_PX, center: center * LINE_PX, right: right * LINE_PX };
}

function targets(anchors: readonly Anchor<Pane>[], source: Pane, y: number): Anchor<Pane> {
  const at = paneTargets(anchors, source, y);
  return { left: at("left"), center: at("center"), right: at("right") };
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

test("the content ends anchor the tails when they differ from the last chunk's offset", () => {
  const anchors = anchorsOf(
    [row({ start: 5, len: 5 }, { start: 5, len: 12 }, { start: 5, len: 12 })],
    ends(20, 27, 30),
  );

  expect(targets(anchors, "center", 27 * LINE_PX).right).toBe(30 * LINE_PX);
  expect(targets(anchors, "center", 22 * LINE_PX)).toEqual({
    left: 15 * LINE_PX,
    center: 22 * LINE_PX,
    right: 23.5 * LINE_PX,
  });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

type FakePane = {
  readonly scrollDOM: EventTarget & { scrollTop: number; readonly clientHeight: number };
  readonly documentPadding: { readonly top: number };
};

function fakePane(scrollTop: number): FakePane {
  return {
    scrollDOM: Object.assign(new EventTarget(), { scrollTop, clientHeight: 10 * LINE_PX }),
    documentPadding: { top: 0 },
  };
}

function scrolled(pane: FakePane, scrollTop: number): void {
  pane.scrollDOM.scrollTop = scrollTop;
  pane.scrollDOM.dispatchEvent(new Event("scroll"));
}

function tops(views: Readonly<Record<Pane, FakePane>>): number[] {
  return [views.left, views.center, views.right].map((pane) => pane.scrollDOM.scrollTop);
}

test("follow('center') makes the next sync write both sides though the middle did not scroll, and their echoes stay ignored", () => {
  const frames: (() => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const views = { left: fakePane(0), center: fakePane(0), right: fakePane(0) };
  let requested = 0;
  const sync = new ScrollSync(views, PANES, () => {
    requested += 1;
  });
  const anchors = anchorsOf([], ends(100, 100, 100));
  scrolled(views.center, 300);
  sync.sync(anchors);
  for (const frame of frames.splice(0)) {
    frame();
  }
  views.left.scrollDOM.scrollTop = 0;
  views.right.scrollDOM.scrollTop = 0;

  scrolled(views.center, 300);
  sync.sync(anchors);
  expect(tops(views)).toEqual([0, 300, 0]);

  const before = requested;
  sync.follow("center");
  expect(requested).toBe(before + 1);
  sync.sync(anchors);
  expect(tops(views)).toEqual([300, 300, 300]);

  scrolled(views.left, 500);
  sync.sync(anchors);
  expect(tops(views)).toEqual([500, 300, 300]);
});

test("two columns follow each other through their difference's anchors, the source left where it was", () => {
  const frames: (() => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const views = { left: fakePane(0), right: fakePane(0) };
  const sync = new ScrollSync(views, ["left", "right"], () => {});
  const anchors = [
    { left: 0, right: 0 },
    { left: 5 * LINE_PX, right: 5 * LINE_PX },
    { left: 10 * LINE_PX, right: 17 * LINE_PX },
    { left: 20 * LINE_PX, right: 27 * LINE_PX },
  ];

  scrolled(views.left, 50);
  sync.sync(anchors);
  const leftLed = [views.left.scrollDOM.scrollTop, views.right.scrollDOM.scrollTop];
  for (const frame of frames.splice(0)) {
    frame();
  }
  scrolled(views.right, 300);
  sync.sync(anchors);

  expect(leftLed).toEqual([50, 120]);
  expect([views.left.scrollDOM.scrollTop, views.right.scrollDOM.scrollTop]).toEqual([160, 300]);
});
