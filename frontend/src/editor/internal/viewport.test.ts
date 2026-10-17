import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { revealScrollTop, textLineEdges, thirdScrollTop } from "./viewport";

const LINE_PX = 20;
const FIND_SPACE_PX = 29;
const PANE = { area: { top: 1000, bottom: 1500 }, lineHeight: LINE_PX, paddingTop: 0 };

test("a change fully on screen, or a zero-line change on screen, does not move the view", () => {
  expect(revealScrollTop({ top: 1100, bottom: 1200 }, PANE)).toBeNull();
  expect(revealScrollTop({ top: 1000, bottom: 1500 }, PANE)).toBeNull();
  expect(revealScrollTop({ top: 1200, bottom: 1200 }, PANE)).toBeNull();
});

test("a change below the view lands a third of the way down", () => {
  expect(revealScrollTop({ top: 2000, bottom: 2100 }, PANE)).toBeCloseTo(2000 - 500 / 3);
  expect(revealScrollTop({ top: 1450, bottom: 1550 }, PANE)).toBeCloseTo(1450 - 500 / 3);
  expect(revealScrollTop({ top: 2000, bottom: 2100 }, { ...PANE, paddingTop: 4 })).toBeCloseTo(
    2004 - 500 / 3,
  );
});

test("a change that fits only lower than a third ends two lines above the bottom", () => {
  expect(revealScrollTop({ top: 2000, bottom: 2400 }, PANE)).toBe(2000 - (500 - 2 * LINE_PX - 400));
});

test("a change taller than the pane minus two gaps starts two lines below the top", () => {
  expect(revealScrollTop({ top: 3000, bottom: 3450 }, PANE)).toBe(3000 - 2 * LINE_PX);
  expect(revealScrollTop({ top: 3000, bottom: 4000 }, PANE)).toBe(3000 - 2 * LINE_PX);
});

test("a change near line 1 clamps at 0, keeping the space above line 1 in view", () => {
  expect(revealScrollTop({ top: 20, bottom: 40 }, PANE)).toBe(0);
  expect(revealScrollTop({ top: 20, bottom: 40 }, { ...PANE, paddingTop: FIND_SPACE_PX })).toBe(0);
});

const SCROLLER = { clientHeight: 600, scrollHeight: 5000, paddingTop: 0 };

test("a tick's jump puts the line a third of the way down, also when it is already on screen", () => {
  expect(thirdScrollTop(2000, SCROLLER)).toBe(2000 - 200);
  expect(thirdScrollTop(300, SCROLLER)).toBe(100);
  expect(thirdScrollTop(2000, { ...SCROLLER, paddingTop: FIND_SPACE_PX })).toBe(
    2000 + FIND_SPACE_PX - 200,
  );
});

test("a tick's jump never scrolls above 0 nor past the end", () => {
  expect(thirdScrollTop(60, SCROLLER)).toBe(0);
  expect(thirdScrollTop(4900, SCROLLER)).toBe(5000 - 600);
  expect(thirdScrollTop(100, { ...SCROLLER, scrollHeight: 400 })).toBe(0);
});

const DOC = Text.of(Array.from({ length: 100 }, (_, index) => `line ${index + 1}`));

function textBlock(line: number, top: number) {
  const { from, to } = DOC.line(line);
  return { from, to, top, bottom: top + LINE_PX };
}

test("a wave line at the top or bottom of the pane is skipped: the visible lines are text lines", () => {
  const wave = { from: DOC.line(1).from, to: DOC.line(40).to, top: 0, bottom: LINE_PX };
  const bottomWave = { ...wave, from: DOC.line(60).from, to: DOC.line(100).to, top: 200 };

  expect(
    textLineEdges(DOC, { first: wave, last: textBlock(50, 180), area: { top: 5, bottom: 195 } }),
  ).toEqual({
    first: 41,
    last: 49,
  });
  expect(
    textLineEdges(DOC, {
      first: textBlock(45, 0),
      last: bottomWave,
      area: { top: 0, bottom: 210 },
    }),
  ).toEqual({ first: 45, last: 59 });
  expect(
    textLineEdges(DOC, {
      first: textBlock(45, 0),
      last: textBlock(50, 100),
      area: { top: 5, bottom: 110 },
    }),
  ).toEqual({ first: 46, last: 49 });
});
