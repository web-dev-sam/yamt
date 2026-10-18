import type { PixelRows } from "./minimapPixels";

type Stale = "none" | "all" | { readonly from: number };

export type TileRenderer = {
  readonly width: number;
  readonly rowPx: number;
  readonly rows: number;
  paintRow(target: PixelRows, row: number, y: number): number;
};

type Tile = { readonly canvas: HTMLCanvasElement; readonly to: number };

export const TILE_ROWS = 128;

export function staleTiles(facts: {
  readonly docChanged: boolean;
  readonly foldsChanged: boolean;
  readonly themeChanged: boolean;
  readonly languageChanged: boolean;
  readonly treeBefore: number;
  readonly treeAfter: number;
}): Stale {
  const { docChanged, foldsChanged, themeChanged, languageChanged, treeBefore, treeAfter } = facts;
  if (docChanged || foldsChanged || themeChanged || languageChanged) {
    return "all";
  }
  return treeAfter > treeBefore ? { from: treeBefore } : "none";
}

function renderTile(index: number, renderer: TileRenderer): Tile {
  const { width, rowPx, rows } = renderer;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = TILE_ROWS * rowPx;
  const image = new ImageData(width, canvas.height);
  const target = { data: image.data, width };
  const first = index * TILE_ROWS + 1;
  const last = Math.min(rows, first + TILE_ROWS - 1);
  let to = 0;
  for (let row = first; row <= last; row += 1) {
    to = renderer.paintRow(target, row, (row - first) * rowPx);
  }
  canvas.getContext("2d")?.putImageData(image, 0, 0);
  return { canvas, to };
}

export class MinimapTiles {
  readonly #tiles = new Map<number, Tile>();

  canvas(index: number, renderer: TileRenderer): HTMLCanvasElement {
    const cached = this.#tiles.get(index);
    if (cached !== undefined) {
      return cached.canvas;
    }
    const tile = renderTile(index, renderer);
    this.#tiles.set(index, tile);
    return tile.canvas;
  }

  keep(first: number, last: number): void {
    for (const index of this.#tiles.keys()) {
      if (index < first || index > last) {
        this.#tiles.delete(index);
      }
    }
  }

  drop(stale: Stale): void {
    if (stale === "none") {
      return;
    }
    if (stale === "all") {
      this.#tiles.clear();
      return;
    }
    for (const [index, tile] of this.#tiles) {
      if (tile.to > stale.from) {
        this.#tiles.delete(index);
      }
    }
  }

  clear(): void {
    this.#tiles.clear();
  }
}
