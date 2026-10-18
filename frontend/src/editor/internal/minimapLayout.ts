import { GLYPH_ROWS_PER_SCALE, HIDPI_SCALE, type Scale } from "./minimapGlyphs";
import { LINE_HEIGHT_PX } from "./pane";

export type MinimapInput = {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly rows: number;
  readonly height: number;
  readonly pixelRatio: number;
};

type Slider = { readonly top: number; readonly height: number };

export type MinimapLayout = {
  readonly input: MinimapInput;
  readonly startRow: number;
  readonly endRow: number;
  readonly topPaddingRows: number;
  readonly rowPx: number;
  readonly slider: Slider | null;
  readonly ratio: number;
};

export type Box = { readonly x: number; readonly width: number };

type Columns = {
  readonly left: Box;
  readonly code: Box;
  readonly right: Box;
  readonly width: number;
};

type Sizes = {
  readonly rowPx: number;
  readonly extraTop: number;
  readonly sliderTop: number;
};

type Window = Pick<MinimapLayout, "startRow" | "topPaddingRows">;

export const MAX_COLUMNS = 120;
const EDGE_CSS_PX = 6;
const HALVES = 2;

export function minimapScale(pixelRatio: number): Scale {
  return pixelRatio >= HIDPI_SCALE ? HIDPI_SCALE : 1;
}

export function minimapColumns(pixelRatio: number): Columns {
  const edge = Math.round(EDGE_CSS_PX * pixelRatio);
  const code = MAX_COLUMNS * minimapScale(pixelRatio);
  return {
    left: { x: 0, width: edge },
    code: { x: edge, width: code },
    right: { x: edge + code, width: edge },
    width: edge + code + edge,
  };
}

function scrollHeightOf({ rows, paddingTop, paddingBottom }: MinimapInput): number {
  return rows * LINE_HEIGHT_PX + paddingTop + paddingBottom;
}

export function minimapLayout(input: MinimapInput, previous: MinimapLayout | null): MinimapLayout {
  const { scrollTop, viewportHeight, paddingTop, rows, height, pixelRatio } = input;
  const rowPx = GLYPH_ROWS_PER_SCALE * minimapScale(pixelRatio);
  const rowCss = rowPx / pixelRatio;
  const fitting = Math.floor(Math.floor(pixelRatio * height) / rowPx);
  const sliderHeight = Math.floor((viewportHeight / LINE_HEIGHT_PX) * rowCss);
  const extraTop = Math.floor(paddingTop / LINE_HEIGHT_PX);
  const travel = Math.min(
    height - sliderHeight,
    Math.max(0, (extraTop + rows) * rowCss - sliderHeight),
  );
  const scrollable = scrollHeightOf(input) - viewportHeight;
  const ratio = travel > 0 && scrollable > 0 ? travel / scrollable : 0;
  const sliderTop = scrollTop * ratio;
  if (fitting >= extraTop + rows) {
    const slider = travel > 0 ? { top: sliderTop, height: sliderHeight } : null;
    return { input, startRow: 1, endRow: rows, topPaddingRows: extraTop, rowPx, slider, ratio };
  }
  const shown = steadied(input, windowAt(input, { rowPx, extraTop, sliderTop }), previous);
  const endRow = Math.min(rows, shown.startRow - shown.topPaddingRows + fitting - 1);
  const slider = { top: alignedSliderTop(input, shown, rowCss), height: sliderHeight };
  return { input, ...shown, endRow, rowPx, slider, ratio };
}

function viewportStart({ scrollTop, paddingTop, rows }: MinimapInput): {
  readonly row: number;
  readonly partial: number;
} {
  const row = Math.min(
    rows,
    Math.max(1, Math.floor((scrollTop - paddingTop) / LINE_HEIGHT_PX) + 1),
  );
  const partial = (scrollTop - paddingTop - (row - 1) * LINE_HEIGHT_PX) / LINE_HEIGHT_PX;
  return { row, partial };
}

function windowAt(input: MinimapInput, sizes: Sizes): Window {
  const { rowPx, extraTop, sliderTop } = sizes;
  const { row } = viewportStart(input);
  const considering = row > 1 ? row + extraTop : Math.max(1, input.scrollTop / LINE_HEIGHT_PX);
  const start = Math.max(1, Math.floor(considering - (sliderTop * input.pixelRatio) / rowPx));
  if (start < extraTop) {
    return { startRow: 1, topPaddingRows: extraTop - start + 1 };
  }
  return { startRow: Math.max(1, start - extraTop), topPaddingRows: 0 };
}

function steadied(input: MinimapInput, found: Window, previous: MinimapLayout | null): Window {
  if (previous === null || scrollHeightOf(previous.input) !== scrollHeightOf(input)) {
    return found;
  }
  if (previous.input.scrollTop > input.scrollTop) {
    return {
      startRow: Math.min(found.startRow, previous.startRow),
      topPaddingRows: Math.max(found.topPaddingRows, previous.topPaddingRows),
    };
  }
  if (previous.input.scrollTop < input.scrollTop) {
    return {
      startRow: Math.max(found.startRow, previous.startRow),
      topPaddingRows: Math.min(found.topPaddingRows, previous.topPaddingRows),
    };
  }
  return found;
}

function alignedSliderTop(input: MinimapInput, shown: Window, rowCss: number): number {
  const { scrollTop, paddingTop } = input;
  const { row, partial } = viewportStart(input);
  if (scrollTop >= paddingTop) {
    return (row - shown.startRow + shown.topPaddingRows + partial) * rowCss;
  }
  return (scrollTop / paddingTop) * (shown.topPaddingRows + partial) * rowCss;
}

export function rowAt(layout: MinimapLayout, offsetY: number): number {
  const index = Math.floor((offsetY * layout.input.pixelRatio) / layout.rowPx);
  const row = index + layout.startRow - layout.topPaddingRows;
  return Math.min(layout.input.rows, Math.max(1, row));
}

export function rowTop(layout: MinimapLayout, row: number): number {
  return (row - layout.startRow + layout.topPaddingRows) * layout.rowPx;
}

export function centredScrollTop(row: number, input: MinimapInput): number {
  const top = input.paddingTop + (row - 1) * LINE_HEIGHT_PX;
  // The minimap reveals with source "mouse", which pads the box with one line above and none
  // below (vscode viewLines.ts _computeScrollTopToRevealRange, shouldIgnoreScrollOff).
  const boxStart = top - LINE_HEIGHT_PX;
  const boxEnd = top + LINE_HEIGHT_PX;
  return Math.max(0, (boxStart + boxEnd - input.viewportHeight) / HALVES);
}

export function draggedScrollTop(start: MinimapLayout, delta: number): number {
  const { scrollTop } = start.input;
  return start.ratio === 0 ? scrollTop : Math.round(scrollTop + delta / start.ratio);
}
