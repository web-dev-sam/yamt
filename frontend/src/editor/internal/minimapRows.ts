import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";

import type { WaveRow } from "./geometry";
import type { Scale } from "./minimapGlyphs";
import { MAX_COLUMNS, rowOfTop, topOfRow } from "./minimapLayout";
import type { EdgeKind } from "./minimapMarks";
import { paintRow, paintWave, rgbOf, type GlyphLook, type Rgb } from "./minimapPixels";
import type { TileRenderer } from "./minimapTiles";
import { SYNTAX_COLOURS, syntaxColourClasses } from "./pane";

export type Look = {
  readonly glyphs: GlyphLook;
  readonly wave: Rgb;
  readonly edges: Readonly<Record<EdgeKind, string>>;
};

type RowSource = {
  readonly state: EditorState;
  readonly blockAtHeight: (height: number) => { readonly from: number; readonly to: number };
  readonly waves: readonly WaveRow[];
  readonly look: Look;
  readonly width: number;
  readonly rowPx: number;
};

const CODE_TOKEN = "--color-code";
const PALETTE_TOKENS: readonly string[] = [
  CODE_TOKEN,
  ...new Set(SYNTAX_COLOURS.map(({ colour }) => colour)),
];
const NO_COLOUR: Rgb = { r: 0, g: 0, b: 0 };
const ROW_MIDDLE = 0.5;

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

export function rowPainter(source: RowSource): TileRenderer["paintRow"] {
  const { state, blockAtHeight, waves, look, width, rowPx } = source;
  let waveRows: ReadonlySet<number> | null = null;
  return (target, row, y) => {
    // A height on a line boundary gives the line above (@codemirror/view lineBlockAtHeight,
    // viewportLines `l.bottom >= height`), so each row is looked up at its middle.
    const block = blockAtHeight(topOfRow(row + ROW_MIDDLE));
    waveRows ??= waveRowsOf(waves);
    if (waveRows.has(row)) {
      paintWave(target, { y, x: 0, width, rowPx }, look.wave);
      return block.to;
    }
    const to = Math.min(block.to, block.from + MAX_COLUMNS);
    const text = state.sliceDoc(block.from, to);
    const colours = rowColours(state, block.from, to);
    paintRow(target, { y, x: 0, text, colours, tabSize: state.tabSize }, look.glyphs);
    return block.to;
  };
}
