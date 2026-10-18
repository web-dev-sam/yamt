import { expect, test } from "vitest";

import { charIndex, glyphs } from "./minimapGlyphs";
import {
  paintRow,
  paintWave,
  rgbOf,
  type CodeRow,
  type GlyphLook,
  type PixelRows,
  type Rgb,
} from "./minimapPixels";

const CODE: Rgb = { r: 200, g: 201, b: 202 };
const KEYWORD: Rgb = { r: 224, g: 152, b: 107 };
const WAVE: Rgb = { r: 90, g: 91, b: 92 };
const PALETTE: readonly Rgb[] = [CODE, KEYWORD];
const DARK: GlyphLook = { scale: 1, light: false, palette: PALETTE };
const WIDTH = 140;
const HEIGHT = 8;
const T = 84;

// VS Code's prebaked intensities for `T` (glyph 52): 154 over 46 at scale 1, and 2 × 4 at scale 2.
const T_SCALE_1 = [154, 46];
const T_SCALE_2 = [201, 171, 93, 63, 93, 63, 0, 0];
// `)` (glyph 9) at scale 1.
const PAREN_SCALE_1 = [87, 65];

function hex(...bytes: readonly number[]): string {
  return `#${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function canvas(): PixelRows {
  return { data: new Uint8ClampedArray(WIDTH * HEIGHT * 4), width: WIDTH };
}

function pixel(target: PixelRows, x: number, y: number): number[] {
  const offset = (y * target.width + x) * 4;
  return [...target.data.subarray(offset, offset + 4)];
}

function row(text: string, at: Partial<CodeRow> = {}): CodeRow {
  return { y: 2, x: 3, text, colours: new Uint8Array(text.length).fill(1), tabSize: 4, ...at };
}

function alphas(target: PixelRows, y: number, xs: readonly number[]): number[] {
  return xs.map((x) => pixel(target, x, y)[3] ?? -1);
}

test("rgbOf reads #rrggbb and #rrggbbaa, else null", () => {
  expect(rgbOf(hex(18, 52, 86))).toEqual({ r: 18, g: 52, b: 86 });
  expect(rgbOf(hex(18, 52, 86, 120))).toEqual({ r: 18, g: 52, b: 86 });
  expect(rgbOf(` ${hex(255, 0, 171)}\n`)).toEqual({ r: 255, g: 0, b: 171 });
  expect(rgbOf(hex(18, 52).concat("5"))).toBeNull();
  expect(rgbOf("red")).toBeNull();
  expect(rgbOf("")).toBeNull();
});

test("`T` at scale 1 paints VS Code's two intensities ×12/15 in the token's RGB; scale 2 paints 2×4", () => {
  const one = canvas();
  paintRow(one, row("T"), DARK);

  expect(glyphs(1).subarray(charIndex(T) * 2, charIndex(T) * 2 + 2)).toEqual(
    Uint8ClampedArray.from(T_SCALE_1),
  );
  expect(pixel(one, 3, 2)).toEqual([224, 152, 107, Math.trunc((154 * 12) / 15)]);
  expect(pixel(one, 3, 3)).toEqual([224, 152, 107, 36]);
  expect(pixel(one, 3, 2)[3]).toBe(123);
  expect(pixel(one, 4, 2)).toEqual([0, 0, 0, 0]);
  expect(pixel(one, 3, 4)).toEqual([0, 0, 0, 0]);

  const two = canvas();
  paintRow(two, row("T"), { ...DARK, scale: 2 });

  expect(glyphs(2).subarray(charIndex(T) * 8, charIndex(T) * 8 + 8)).toEqual(
    Uint8ClampedArray.from(T_SCALE_2),
  );
  expect([2, 3, 4, 5].flatMap((y) => alphas(two, y, [3, 4]))).toEqual(
    T_SCALE_2.map((intensity) => Math.trunc((intensity * 12) / 15)),
  );
  expect([2, 3, 4, 5].flatMap((y) => alphas(two, y, [3, 4]))).toEqual([
    160, 136, 74, 50, 74, 50, 0, 0,
  ]);
  expect(alphas(two, 6, [3, 4])).toEqual([0, 0]);
});

test("light uses 50/60", () => {
  const target = canvas();
  paintRow(target, row("T"), { ...DARK, light: true });

  expect(alphas(target, 2, [3])).toEqual([Math.trunc((154 * 50) / 60)]);
  expect([...alphas(target, 2, [3]), ...alphas(target, 3, [3])]).toEqual([128, 38]);
});

test("a tab advances to the next stop; a space paints nothing", () => {
  const tabbed = canvas();
  paintRow(tabbed, row("a\tT"), DARK);
  const spaced = canvas();
  paintRow(spaced, row(" T", { colours: Uint8Array.of(1, 0) }), DARK);

  expect(alphas(tabbed, 2, [3 + 4, 3 + 5])).toEqual([123, 0]);
  expect(pixel(spaced, 3, 2)).toEqual([0, 0, 0, 0]);
  expect(pixel(spaced, 3, 3)).toEqual([0, 0, 0, 0]);
  expect(pixel(spaced, 4, 2)).toEqual([200, 201, 202, 123]);
});

test("column 121 and on is cut", () => {
  const target = canvas();
  paintRow(target, row("T".repeat(130), { x: 0 }), DARK);
  const tabbed = canvas();
  paintRow(tabbed, row(`${"T".repeat(118)}\tTT`, { x: 0, tabSize: 2 }), DARK);

  expect(alphas(target, 2, [119, 120, 121])).toEqual([123, 0, 0]);
  expect(alphas(tabbed, 2, [117, 118, 119, 120])).toEqual([123, 0, 0, 0]);
});

test("outside ASCII uses VS Code's getCharIndex: wrapped into the 96 glyphs", () => {
  const target = canvas();
  paintRow(target, row("é"), DARK);

  expect(charIndex(0xe9)).toBe(charIndex(")".charCodeAt(0)));
  expect([charIndex(32), charIndex(126), charIndex(127), charIndex(31), charIndex(0x2028)]).toEqual(
    [0, 94, 95, 95, (0x2028 - 32) % 96],
  );
  expect([...alphas(target, 2, [3]), ...alphas(target, 3, [3])]).toEqual(
    PAREN_SCALE_1.map((intensity) => Math.trunc((intensity * 12) / 15)),
  );
});

test("a wave row is one device px in the wave colour across the code", () => {
  const thin = canvas();
  paintWave(thin, { y: 2, x: 3, width: 5, rowPx: 2 }, WAVE);
  const sharp = canvas();
  paintWave(sharp, { y: 2, x: 3, width: 5, rowPx: 4 }, WAVE);

  expect([2, 3, 4].map((y) => alphas(thin, y, [2, 3, 7, 8]))).toEqual([
    [0, 0, 0, 0],
    [0, 255, 255, 0],
    [0, 0, 0, 0],
  ]);
  expect(pixel(thin, 5, 3)).toEqual([90, 91, 92, 255]);
  expect([3, 4, 5].map((y) => alphas(sharp, y, [3]))).toEqual([[0], [255], [0]]);
});
