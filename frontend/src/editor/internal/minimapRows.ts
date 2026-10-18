import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";

import type { WaveRow } from "./geometry";
import type { Scale } from "./minimapGlyphs";
import { rowOfTop } from "./minimapLayout";
import type { EdgeKind } from "./minimapMarks";
import { rgbOf, type GlyphLook, type Rgb } from "./minimapPixels";
import { SYNTAX_COLOURS, syntaxColourClasses } from "./pane";

export type Look = {
  readonly glyphs: GlyphLook;
  readonly wave: Rgb;
  readonly edges: Readonly<Record<EdgeKind, string>>;
};

const CODE_TOKEN = "--color-code";
const PALETTE_TOKENS: readonly string[] = [
  CODE_TOKEN,
  ...new Set(SYNTAX_COLOURS.map(({ colour }) => colour)),
];
const NO_COLOUR: Rgb = { r: 0, g: 0, b: 0 };

function paletteIndex(classes: string): number {
  for (const name of classes.split(" ")) {
    const index = PALETTE_TOKENS.indexOf(name);
    if (index > 0) {
      return index;
    }
  }
  return 0;
}

export function rowColours(state: EditorState, from: number, to: number): Uint8Array {
  const colours = new Uint8Array(to - from);
  highlightTree(
    syntaxTree(state),
    syntaxColourClasses,
    (start, end, classes) => {
      colours.fill(paletteIndex(classes), start - from, end - from);
    },
    from,
    to,
  );
  return colours;
}

export function readLook(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
  light: boolean,
  scale: Scale,
): Look {
  const codeValue = style.getPropertyValue(CODE_TOKEN).trim();
  const code = rgbOf(codeValue) ?? NO_COLOUR;
  function read(token: string): Rgb {
    return rgbOf(style.getPropertyValue(token)) ?? code;
  }
  function css(token: string): string {
    const value = style.getPropertyValue(token).trim();
    return rgbOf(value) === null ? codeValue : value;
  }
  return {
    glyphs: { scale, light, palette: PALETTE_TOKENS.map(read) },
    wave: read("--color-diff-wave"),
    edges: {
      inserted: css("--color-mark-inserted"),
      modified: css("--color-mark-modified"),
      deleted: css("--color-mark-deleted"),
      conflict: css("--color-mark-conflict"),
      error: css("--color-problem-error"),
      warning: css("--color-problem-warning"),
    },
  };
}

export function waveRowsOf(waves: readonly WaveRow[]): ReadonlySet<number> {
  return new Set(waves.flatMap(({ center }) => (center === null ? [] : [rowOfTop(center)])));
}
