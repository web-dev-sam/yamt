import { language, syntaxTree } from "@codemirror/language";
import { EditorView, type ViewUpdate } from "@codemirror/view";

import type { FoldFields } from "./folds";
import type { ChunkRow, PaneViews, WaveRow } from "./geometry";
import { MAX_COLUMNS, minimapColumns, minimapLayout, minimapScale } from "./minimapLayout";
import { rowOfTop, rowTop, topOfRow } from "./minimapLayout";
import type { Columns, MinimapInput, MinimapLayout, Slider } from "./minimapLayout";
import { changeMarks, markBoxes, problemMarks, type EdgeMark } from "./minimapMarks";
import { paintRow, paintWave } from "./minimapPixels";
import { MinimapPointer } from "./minimapPointer";
import { readLook, rowColours, waveRowsOf, type Look } from "./minimapRows";
import { MinimapTiles, staleTiles, TILE_ROWS, type TileRenderer } from "./minimapTiles";
import { linted } from "./problems";

type MinimapParts = {
  readonly views: PaneViews;
  readonly folds: FoldFields;
  readonly shown: boolean;
  readonly follow: () => void;
};

type FrameLayout = { readonly rows: readonly ChunkRow[]; readonly waves: readonly WaveRow[] };

type Edges = { readonly left: readonly EdgeMark[]; readonly right: readonly EdgeMark[] };

const ROW_MIDDLE = 0.5;

export class Minimap {
  readonly #views: PaneViews;
  readonly #folds: FoldFields;
  readonly #box = document.createElement("div");
  readonly #canvas = document.createElement("canvas");
  readonly #slider = document.createElement("div");
  readonly #tiles = new MinimapTiles();
  readonly #pointer: MinimapPointer;
  #shown = false;
  #layout: MinimapLayout | null = null;
  #drawn: MinimapLayout | null = null;
  #placed: Slider | null = null;
  #look: Look | null = null;
  #edges: Edges | null = null;

  constructor({ views, folds, shown, follow }: MinimapParts) {
    this.#views = views;
    this.#folds = folds;
    this.#box.className = "minimap";
    this.#box.setAttribute("aria-hidden", "true");
    this.#slider.className = "minimap-slider";
    this.#box.append(this.#canvas, this.#slider);
    this.#pointer = new MinimapPointer({
      box: this.#box,
      slider: this.#slider,
      scroller: views.center.scrollDOM,
      layout: () => this.#layout,
      follow,
    });
    views.right.dom.append(this.#box);
    this.show(shown);
  }

  show(shown: boolean): void {
    this.#pointer.release();
    this.#shown = shown;
    this.#box.hidden = !shown;
    this.#slider.hidden = true;
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    this.#tiles.clear();
    this.#layout = null;
    this.#drawn = null;
    this.#placed = null;
    this.#look = null;
    this.#edges = null;
  }

  changed(update: ViewUpdate, rowsMoved: boolean): boolean {
    if (!this.#shown || update.view !== this.#views.center) {
      return false;
    }
    const { startState, state } = update;
    const themeChanged =
      startState.facet(EditorView.darkTheme) !== state.facet(EditorView.darkTheme);
    const stale = staleTiles({
      docChanged: update.docChanged,
      foldsChanged: startState.field(this.#folds.center) !== state.field(this.#folds.center),
      themeChanged,
      languageChanged: startState.facet(language) !== state.facet(language),
      treeBefore: syntaxTree(startState).length,
      treeAfter: syntaxTree(state).length,
    });
    this.#tiles.drop(stale);
    if (themeChanged) {
      this.#look = null;
    }
    if (rowsMoved || linted(update.transactions)) {
      this.#edges = null;
    }
    const redraw = stale !== "none" || themeChanged || this.#edges === null;
    if (redraw) {
      this.#drawn = null;
    }
    return redraw;
  }

  paint(frame: FrameLayout): void {
    if (!this.#shown) {
      return;
    }
    const input = this.#input();
    const layout = minimapLayout(input, this.#layout);
    this.#layout = layout;
    this.#fit(layout);
    this.#place(layout.slider);
    const drawn = this.#drawn;
    if (
      drawn?.startRow === layout.startRow &&
      drawn.endRow === layout.endRow &&
      drawn.topPaddingRows === layout.topPaddingRows
    ) {
      return;
    }
    this.#drawn = layout;
    this.#draw(layout, frame);
  }

  destroy(): void {
    this.#pointer.destroy();
    this.#tiles.clear();
    this.#box.remove();
  }

  #input(): MinimapInput {
    const center = this.#views.center;
    const { scrollTop, clientHeight } = center.scrollDOM;
    const { top, bottom } = center.documentPadding;
    return {
      scrollTop,
      viewportHeight: clientHeight,
      paddingTop: top,
      paddingBottom: bottom,
      rows: rowOfTop(center.lineBlockAt(center.state.doc.length).top),
      height: this.#box.clientHeight,
      pixelRatio: devicePixelRatio,
    };
  }

  #fit({ input, canvasHeight }: MinimapLayout): void {
    const { pixelRatio } = input;
    if (this.#look !== null && this.#look.glyphs.scale !== minimapScale(pixelRatio)) {
      this.#tiles.clear();
      this.#look = null;
    }
    const canvas = this.#canvas;
    const width = minimapColumns(pixelRatio).width;
    if (canvas.width === width && canvas.height === canvasHeight) {
      return;
    }
    canvas.width = width;
    canvas.height = canvasHeight;
    canvas.style.width = `${width / pixelRatio}px`;
    canvas.style.height = `${canvasHeight / pixelRatio}px`;
    this.#box.style.width = canvas.style.width;
    this.#drawn = null;
  }

  #place(slider: Slider | null): void {
    const placed = this.#placed;
    if (placed?.top === slider?.top && placed?.height === slider?.height) {
      return;
    }
    this.#placed = slider;
    this.#slider.hidden = slider === null;
    if (slider !== null) {
      this.#slider.style.transform = `translateY(${slider.top}px)`;
      this.#slider.style.height = `${slider.height}px`;
    }
  }

  #draw(layout: MinimapLayout, frame: FrameLayout): void {
    const context = this.#canvas.getContext("2d");
    if (context === null) {
      return;
    }
    const { pixelRatio } = layout.input;
    const columns = minimapColumns(pixelRatio);
    const light = !this.#views.center.state.facet(EditorView.darkTheme);
    const scale = minimapScale(pixelRatio);
    const look = (this.#look ??= readLook(getComputedStyle(this.#box), light, scale));
    context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    const first = Math.floor((layout.startRow - 1) / TILE_ROWS);
    const last = Math.floor((layout.endRow - 1) / TILE_ROWS);
    const renderer = this.#renderer(layout, look, frame.waves, columns);
    for (let index = first; index <= last; index += 1) {
      const y = rowTop(layout, index * TILE_ROWS + 1);
      context.drawImage(this.#tiles.canvas(index, renderer), columns.code.x, y);
    }
    this.#tiles.keep(first - 1, last + 1);
    this.#paintEdges(context, { layout, rows: frame.rows, look, columns });
  }

  #renderer(
    layout: MinimapLayout,
    look: Look,
    waves: readonly WaveRow[],
    columns: Columns,
  ): TileRenderer {
    const view = this.#views.center;
    const { rowPx } = layout;
    const width = columns.code.width;
    let waveRows: ReadonlySet<number> | null = null;
    return {
      width,
      rowPx,
      rows: layout.input.rows,
      paintRow: (target, row, y) => {
        // A height on a line boundary gives the line above (@codemirror/view lineBlockAtHeight,
        // viewportLines `l.bottom >= height`), so each row is looked up at its middle.
        const block = view.lineBlockAtHeight(topOfRow(row + ROW_MIDDLE));
        waveRows ??= waveRowsOf(waves);
        if (waveRows.has(row)) {
          paintWave(target, { y, x: 0, width, rowPx }, look.wave);
          return block.to;
        }
        const { state } = view;
        const to = Math.min(block.to, block.from + MAX_COLUMNS);
        const text = state.sliceDoc(block.from, to);
        const colours = rowColours(state, block.from, to);
        paintRow(target, { y, x: 0, text, colours, tabSize: state.tabSize }, look.glyphs);
        return block.to;
      },
    };
  }

  #paintEdges(
    context: CanvasRenderingContext2D,
    paint: {
      readonly layout: MinimapLayout;
      readonly rows: readonly ChunkRow[];
      readonly look: Look;
      readonly columns: Columns;
    },
  ): void {
    const { layout, rows, look, columns } = paint;
    const center = this.#views.center;
    const edges = (this.#edges ??= {
      left: problemMarks(center.state, (pos) => center.lineBlockAt(pos)),
      right: changeMarks(rows),
    });
    const boxes = [
      ...markBoxes(edges.left, layout, columns.left),
      ...markBoxes(edges.right, layout, columns.right),
    ];
    for (const { x, y, width, height, kind } of boxes) {
      context.fillStyle = look.edges[kind];
      context.fillRect(x, y, width, height);
    }
  }
}
