import { expect, test } from "vitest";

import {
  centredScrollTop,
  draggedScrollTop,
  minimapColumns,
  minimapLayout,
  minimapScale,
  rowAt,
  rowOfTop,
  rowTop,
  topOfRow,
  type MinimapInput,
} from "./minimapLayout";

// The Result's scroller and the minimap are both 900 CSS px high; CodeMirror pads the content by
// 4 px at the top and the bottom, so 7,277 rows scroll 7,277 × 20 + 8 − 900 = 144,648 px.
const RESULT: MinimapInput = {
  scrollTop: 0,
  viewportHeight: 900,
  paddingTop: 4,
  paddingBottom: 4,
  rows: 7277,
  height: 900,
  pixelRatio: 1,
};
const LAST_SCROLL_TOP = 144_648;
const RATIO = 810 / LAST_SCROLL_TOP;

function at(scrollTop: number, input: Partial<MinimapInput> = {}): MinimapInput {
  return { ...RESULT, ...input, scrollTop };
}

function rowCss(input: MinimapInput): number {
  return minimapLayout(input, null).rowPx / input.pixelRatio;
}

test("scale doubles at ratio ≥ 2: a row is 2 CSS px at 1 and 2, 1.6 at 1.25", () => {
  expect([1, 1.25, 1.99, 2, 3].map(minimapScale)).toEqual([1, 1, 1, 2, 2]);
  expect(rowCss(at(0, { pixelRatio: 1 }))).toBe(2);
  expect(rowCss(at(0, { pixelRatio: 2 }))).toBe(2);
  expect(rowCss(at(0, { pixelRatio: 1.25 }))).toBe(1.6);
});

test("120 columns of one scale each, two 6 px edges in device px; 96 + edges CSS at 1.25", () => {
  expect(minimapColumns(1)).toEqual({
    left: { x: 0, width: 6 },
    code: { x: 6, width: 120 },
    right: { x: 126, width: 6 },
    width: 132,
  });
  expect(minimapColumns(2)).toEqual({
    left: { x: 0, width: 12 },
    code: { x: 12, width: 240 },
    right: { x: 252, width: 12 },
    width: 264,
  });
  const fractional = minimapColumns(1.25);
  expect(fractional.code.width / 1.25).toBe(96);
  expect(fractional).toEqual({
    left: { x: 0, width: 8 },
    code: { x: 8, width: 120 },
    right: { x: 128, width: 8 },
    width: 136,
  });
});

test("a file that fits: rows from the first, no slider", () => {
  expect(minimapLayout(at(0, { rows: 30 }), null)).toEqual({
    input: at(0, { rows: 30 }),
    startRow: 1,
    endRow: 30,
    topPaddingRows: 0,
    canvasHeight: 900,
    rowPx: 2,
    slider: null,
    ratio: 0,
  });
});

test("the canvas is the minimap's height in whole device px", () => {
  expect(minimapLayout(at(0, { height: 901, pixelRatio: 1.25 }), null).canvasHeight).toBe(1126);
  expect(minimapLayout(at(0, { rows: 30, height: 901, pixelRatio: 2 }), null).canvasHeight).toBe(
    1802,
  );
});

test("row n covers document px (n − 1) × 20 up to n × 20", () => {
  expect([0, 19, 20, 145_539].map(rowOfTop)).toEqual([1, 1, 2, 7277]);
  expect([1, 2, 7277].map(topOfRow)).toEqual([0, 20, 145_520]);
});

test("taller than the Result, shorter than the minimap: rows stay, the slider moves by scrollTop × ratio", () => {
  // 450 rows fill the 900 px minimap exactly; the slider travels 450 × 2 − 90 = 810 px over
  // 450 × 20 + 8 − 900 = 8,108 px of scrolling.
  const layout = minimapLayout(at(1000, { rows: 450 }), null);

  expect([layout.startRow, layout.endRow, layout.topPaddingRows]).toEqual([1, 450, 0]);
  expect(layout.ratio).toBe(810 / 8108);
  expect(layout.slider?.height).toBe(90);
  expect(layout.slider?.top).toBeCloseTo((1000 * 810) / 8108, 6);
});

test("7,277 rows, 900 px, scrollTop 72,770: slider 90 high at 408.6, rows 3,435–3,884", () => {
  // Row 3,639 starts 6 px above the top (0.3 rows); the plain slider top is 72,770 × ratio =
  // 407.49, so the window starts at floor(3,639 − 407.49 / 2) = 3,435 and holds 450 rows.
  const layout = minimapLayout(at(72_770), null);

  expect(layout.ratio).toBe(RATIO);
  expect([layout.startRow, layout.endRow, layout.topPaddingRows]).toEqual([3435, 3884, 0]);
  expect(layout.slider?.height).toBe(90);
  expect(layout.slider?.top).toBeCloseTo((3639 - 3435 + 0.3) * 2, 9);
});

test("the end: scrollTop 144,648 → rows 6,828–7,277, slider at 810.4", () => {
  const layout = minimapLayout(at(LAST_SCROLL_TOP), null);

  expect([layout.startRow, layout.endRow]).toEqual([6828, 7277]);
  expect(layout.slider?.top).toBeCloseTo(810.4, 9);
  expect(rowTop(layout, 7277)).toBe(449 * 2);
});

test("scrolling up never moves the window down, down never up", () => {
  // At 70,002 and 70,003 px the top row is 3,500 for both, but the slider's own fraction puts
  // the window's start at 3,304 and 3,303.
  expect(minimapLayout(at(70_002), null).startRow).toBe(3304);
  expect(minimapLayout(at(70_003), null).startRow).toBe(3303);

  const up = minimapLayout(at(70_002), minimapLayout(at(70_003), null));
  const down = minimapLayout(at(70_003), minimapLayout(at(70_002), null));

  expect(up.startRow).toBe(3303);
  expect(down.startRow).toBe(3304);
});

test("find space 33 px in a small file: one padding row, row 1 drawn at 2 px", () => {
  const layout = minimapLayout(at(0, { rows: 30, paddingTop: 33 }), null);

  expect(layout.topPaddingRows).toBe(1);
  expect(rowTop(layout, 1)).toBe(2);
  expect(rowTop(layout, 30)).toBe(60);
});

test("a press: index + start − padding rows, within [1, rows]", () => {
  const middle = minimapLayout(at(72_770), null);
  const end = minimapLayout(at(LAST_SCROLL_TOP), null);
  const padded = minimapLayout(at(0, { rows: 30, paddingTop: 33 }), null);
  const sharp = minimapLayout(at(0, { rows: 30, paddingTop: 33, pixelRatio: 2 }), null);

  expect(rowAt(middle, 100)).toBe(3435 + 50);
  expect(rowAt(middle, 0)).toBe(3435);
  expect(rowAt(end, 899)).toBe(7277);
  expect(rowAt(end, 2000)).toBe(7277);
  expect(rowAt(padded, 0)).toBe(1);
  expect(rowAt(padded, 10)).toBe(5);
  expect(rowAt(sharp, 10)).toBe(5);
  expect(rowAt(padded, 500)).toBe(30);
});

test("Center: the row's top in the middle, as VS Code's mouse reveal; row 100 → 1,534; row 5 → 0", () => {
  // Row 100's top is 4 + 99 × 20 = 1,984; the box runs one line above it to its bottom.
  expect(centredScrollTop(100, RESULT)).toBe(1984 - 450);
  expect(centredScrollTop(5, RESULT)).toBe(0);
});

test("drag: start + delta / ratio, from the start layout; no slider, no scroll", () => {
  const start = minimapLayout(at(72_770), null);

  expect(draggedScrollTop(start, 50)).toBe(Math.round(72_770 + 50 / RATIO));
  expect(draggedScrollTop(start, 50)).toBe(81_699);
  expect(draggedScrollTop(start, -10)).toBe(Math.round(72_770 - 10 / RATIO));
  expect(draggedScrollTop(minimapLayout(at(0, { rows: 30 }), null), 50)).toBe(0);
});
