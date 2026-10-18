// The glyph painting and the row walk below follow Visual Studio Code line by line
// (microsoft/vscode at 789f2c470d13c4760f2b5cc6a9e1919c05d04f7d, src/vs/editor/browser/viewParts/minimap/:
// minimapCharRenderer.ts renderChar, minimap.ts _renderLine).
// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License.

import { charIndex, glyphIntensity, GLYPH_ROWS_PER_SCALE, type Scale } from "./minimapGlyphs";
import { MAX_COLUMNS } from "./minimapLayout";

export type Rgb = { readonly r: number; readonly g: number; readonly b: number };

export type PixelRows = { readonly data: Uint8ClampedArray; readonly width: number };

export type CodeRow = {
  readonly y: number;
  readonly x: number;
  readonly text: string;
  readonly colours: Uint8Array;
  readonly tabSize: number;
};

export type GlyphLook = {
  readonly scale: Scale;
  readonly light: boolean;
  readonly palette: readonly Rgb[];
};

type GlyphAt = { readonly x: number; readonly y: number; readonly glyph: number };

const HEX_RGB = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i;
const HEX = 16;
const TAB = 9;
const SPACE = 32;
const CHANNELS = 4;
const GREEN = 1;
const BLUE = 2;
const ALPHA = 3;
const OPAQUE = 255;
const HALVES = 2;
// VS Code softens its glyph intensities by 12/15 on dark and by 50/60 on light backgrounds
// (minimapCharRenderer.ts constructor); these are the same doubles.
const SOFTEN: Readonly<Record<"dark" | "light", number>> = {
  dark: 0.8,
  light: 0.8333333333333334,
};

export function rgbOf(value: string): Rgb | null {
  const match = HEX_RGB.exec(value.trim());
  if (match === null) {
    return null;
  }
  const [, r = "", g = "", b = ""] = match;
  return { r: Number.parseInt(r, HEX), g: Number.parseInt(g, HEX), b: Number.parseInt(b, HEX) };
}

function writePixel(target: PixelRows, at: { x: number; y: number }, colour: Rgb, alpha: number) {
  const offset = (at.y * target.width + at.x) * CHANNELS;
  target.data[offset] = colour.r;
  target.data[offset + GREEN] = colour.g;
  target.data[offset + BLUE] = colour.b;
  target.data[offset + ALPHA] = alpha;
}

function paintGlyph(target: PixelRows, at: GlyphAt, colour: Rgb, look: GlyphLook): void {
  const { scale, light } = look;
  const soften = light ? SOFTEN.light : SOFTEN.dark;
  for (let dy = 0; dy < GLYPH_ROWS_PER_SCALE * scale; dy += 1) {
    for (let dx = 0; dx < scale; dx += 1) {
      const intensity = glyphIntensity(scale, at.glyph, dy * scale + dx);
      writePixel(target, { x: at.x + dx, y: at.y + dy }, colour, Math.trunc(intensity * soften));
    }
  }
}

export function paintRow(target: PixelRows, row: CodeRow, look: GlyphLook): void {
  const { text, colours, tabSize } = row;
  let column = 0;
  for (let index = 0; index < text.length && column < MAX_COLUMNS; index += 1) {
    const code = text.charCodeAt(index);
    if (code === TAB) {
      column += tabSize - (column % tabSize);
      continue;
    }
    const colour = look.palette[colours[index] ?? 0];
    if (code !== SPACE && colour !== undefined) {
      const at = { x: row.x + column * look.scale, y: row.y, glyph: charIndex(code) };
      paintGlyph(target, at, colour, look);
    }
    column += 1;
  }
}

export function paintWave(
  target: PixelRows,
  wave: { readonly y: number; readonly x: number; readonly width: number; readonly rowPx: number },
  colour: Rgb,
): void {
  const y = wave.y + wave.rowPx / HALVES;
  for (let dx = 0; dx < wave.width; dx += 1) {
    writePixel(target, { x: wave.x + dx, y }, colour, OPAQUE);
  }
}
