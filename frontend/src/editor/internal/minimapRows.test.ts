import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { languageOf } from "./language";
import { topOfRow } from "./minimapLayout";
import type { PixelRows } from "./minimapPixels";
import { readLook, rowColours, rowPainter, waveRowsOf, type Look } from "./minimapRows";

const CODE = 0;
const KEYWORD = 1;
const STRING = 2;
const NUMBER = 3;

async function typescript(text: string): Promise<EditorState> {
  const description = languageOf("a.ts");
  if (description === null) {
    throw new Error("no language for a.ts");
  }
  const { language } = await description.load();
  return EditorState.create({ doc: text, extensions: language });
}

test("a row's colours are the palette index of each character's syntax token, from the row's start", async () => {
  const state = await typescript("const x = 1;\nlet y = 'a';\n");
  const second = state.doc.line(2);
  const first = state.doc.line(1);

  expect([...rowColours(state, second.from, second.to)]).toEqual([
    KEYWORD,
    KEYWORD,
    KEYWORD,
    CODE,
    CODE,
    CODE,
    CODE,
    CODE,
    STRING,
    STRING,
    STRING,
    CODE,
  ]);
  expect([...rowColours(state, first.from + 6, first.to)]).toEqual([
    CODE,
    CODE,
    CODE,
    CODE,
    NUMBER,
    CODE,
  ]);
});

test("text no grammar colours is drawn in the code colour", () => {
  const state = EditorState.create({ doc: "const x = 1;" });

  expect([...rowColours(state, 0, state.doc.length)]).toEqual(
    Array.from({ length: 12 }, () => CODE),
  );
});

function hexOf({ r, g, b }: { r: number; g: number; b: number }): string {
  return ["#", ...[r, g, b].map((channel) => channel.toString(16).padStart(2, "0"))].join("");
}

test("the look reads each token once: code first, a missing token in the code colour, edges as given", () => {
  const code = { r: 196, g: 194, b: 206 };
  const keyword = { r: 224, g: 152, b: 107 };
  const wave = { r: 86, g: 83, b: 98 };
  const conflict = hexOf({ r: 129, g: 80, b: 190 });
  const error = hexOf({ r: 246, g: 107, b: 113 });
  const values: Readonly<Record<string, string>> = {
    "--color-code": ` ${hexOf(code)}`,
    "--color-syntax-keyword": hexOf(keyword),
    "--color-diff-wave": hexOf(wave),
    "--color-mark-conflict": ` ${conflict}`,
    "--color-problem-error": error,
    "--color-problem-warning": "not a colour",
  };
  const style = { getPropertyValue: (name: string): string => values[name] ?? "" };
  const look = readLook(style, true, 2);

  expect(look.glyphs.scale).toBe(2);
  expect(look.glyphs.light).toBe(true);
  expect(look.glyphs.palette.slice(0, 3)).toEqual([code, keyword, code]);
  expect(look.wave).toEqual(wave);
  expect(look.edges).toEqual({
    inserted: hexOf(code),
    modified: hexOf(code),
    deleted: hexOf(code),
    conflict,
    error,
    warning: hexOf(code),
  });
});

test("a collapsed run's row is the row of its wave line's top in the Result", () => {
  const waves = [
    { left: 0, center: 40, right: 0 },
    { left: 100, center: null, right: 100 },
    { left: 200, center: 2000, right: 220 },
  ];

  expect([...waveRowsOf(waves)]).toEqual([3, 101]);
});

const ROW_PX = 2;
const WIDTH = 120;
const WHITE = { r: 255, g: 255, b: 255 };
const WAVE = { r: 86, g: 83, b: 98 };
const NOT_PAINTED = "";
const LOOK: Look = {
  glyphs: { scale: 1, light: false, palette: [WHITE] },
  wave: WAVE,
  edges: {
    inserted: NOT_PAINTED,
    modified: NOT_PAINTED,
    deleted: NOT_PAINTED,
    conflict: NOT_PAINTED,
    error: NOT_PAINTED,
    warning: NOT_PAINTED,
  },
};

// Line n is 20 px high from (n − 1) × 20; a height is answered as @codemirror/view's
// lineBlockAtHeight does: the first line with top <= height and bottom >= height.
function blocksOf(state: EditorState): (height: number) => { from: number; to: number } {
  const lines = Array.from({ length: state.doc.lines }, (_, index) => state.doc.line(index + 1));
  return (height) => {
    const found = lines.find(
      ({ number }) => topOfRow(number) <= height && topOfRow(number + 1) >= height,
    );
    return found ?? state.doc.line(state.doc.lines);
  };
}

function pixelRows(rows: number): PixelRows {
  return { data: new Uint8ClampedArray(WIDTH * ROW_PX * rows * 4), width: WIDTH };
}

function paintedColumns(target: PixelRows, y: number): number {
  let columns = 0;
  for (let x = 0; x < WIDTH; x += 1) {
    const alphas = [0, 1].map((dy) => target.data[((y + dy) * WIDTH + x) * 4 + 3] ?? 0);
    columns += alphas.some((alpha) => alpha > 0) ? 1 : 0;
  }
  return columns;
}

test("row n paints line n: its text and its end, also where a height falls on a line boundary", () => {
  const state = EditorState.create({ doc: "MMMM\nM\nMMM\nMM" });
  const target = pixelRows(4);
  const paint = rowPainter({
    state,
    blockAtHeight: blocksOf(state),
    waves: [],
    look: LOOK,
    width: WIDTH,
    rowPx: ROW_PX,
  });

  const ends = [1, 2, 3, 4].map((row) => paint(target, row, (row - 1) * ROW_PX));

  expect(ends).toEqual([1, 2, 3, 4].map((line) => state.doc.line(line).to));
  expect([0, 1, 2, 3].map((index) => paintedColumns(target, index * ROW_PX))).toEqual([4, 1, 3, 2]);
});

test("a collapsed run's row paints the wave across the row's middle, no text", () => {
  const state = EditorState.create({ doc: "MMMM\nM\nMMM\nMM" });
  const target = pixelRows(1);
  const paint = rowPainter({
    state,
    blockAtHeight: blocksOf(state),
    waves: [{ left: 0, center: topOfRow(3), right: 0 }],
    look: LOOK,
    width: WIDTH,
    rowPx: ROW_PX,
  });

  expect(paint(target, 3, 0)).toBe(state.doc.line(3).to);
  const middle = Array.from(target.data.subarray(WIDTH * 4, WIDTH * 4 * 2));
  const wave = Array.from({ length: WIDTH }, () => [WAVE.r, WAVE.g, WAVE.b, 255]).flat();
  expect(middle).toEqual(wave);
  expect(target.data.subarray(0, WIDTH * 4).every((channel) => channel === 0)).toBe(true);
});
