import { afterEach, expect, test, vi } from "vitest";

import type { PixelRows } from "./minimapPixels";
import { MinimapTiles, staleTiles, TILE_ROWS, type TileRenderer } from "./minimapTiles";

const QUIET = {
  docChanged: false,
  foldsChanged: false,
  themeChanged: false,
  languageChanged: false,
  treeBefore: 4000,
  treeAfter: 4000,
};
const ROW_PX = 2;
const ROW_CHARS = 30;

type Painted = { readonly row: number; readonly y: number; readonly width: number };

function stubCanvas(): unknown[] {
  const put: unknown[] = [];
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        putImageData: (image: unknown) => {
          put.push(image);
        },
      }),
    }),
  });
  vi.stubGlobal(
    "ImageData",
    class {
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    },
  );
  return put;
}

function renderer(rows: number, painted: Painted[]): TileRenderer {
  return {
    width: 120,
    rowPx: ROW_PX,
    rows,
    paintRow: (target: PixelRows, row: number, y: number) => {
      painted.push({ row, y, width: target.width });
      return row * ROW_CHARS;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("doc or folds or theme or language → all; tree grown → from the old length; statuses → none", () => {
  expect(staleTiles({ ...QUIET, docChanged: true, treeAfter: 9000 })).toBe("all");
  expect(staleTiles({ ...QUIET, foldsChanged: true })).toBe("all");
  expect(staleTiles({ ...QUIET, themeChanged: true })).toBe("all");
  expect(staleTiles({ ...QUIET, languageChanged: true, treeAfter: 0 })).toBe("all");
  expect(staleTiles({ ...QUIET, treeAfter: 9000 })).toEqual({ from: 4000 });
  expect(staleTiles(QUIET)).toBe("none");
});

test("a tile paints its 128 rows once, each at its own y, and the last tile stops at the last row", () => {
  const put = stubCanvas();
  const painted: Painted[] = [];
  const tiles = new MinimapTiles();
  const source = renderer(300, painted);

  const first = tiles.canvas(0, source);
  expect(tiles.canvas(0, source)).toBe(first);
  tiles.canvas(2, source);

  expect(first).toMatchObject({ width: 120, height: TILE_ROWS * ROW_PX });
  expect(put).toHaveLength(2);
  expect(painted).toHaveLength(TILE_ROWS + 300 - 2 * TILE_ROWS);
  expect(painted.slice(0, 2)).toEqual([
    { row: 1, y: 0, width: 120 },
    { row: 2, y: 2, width: 120 },
  ]);
  expect(painted.at(TILE_ROWS - 1)).toEqual({ row: 128, y: 254, width: 120 });
  expect(painted.slice(TILE_ROWS, TILE_ROWS + 1)).toEqual([{ row: 257, y: 0, width: 120 }]);
  expect(painted.at(-1)).toEqual({ row: 300, y: 86, width: 120 });
});

test("a grown tree drops the tiles ending past its old length; keep drops tiles outside the window", () => {
  stubCanvas();
  const painted: Painted[] = [];
  const tiles = new MinimapTiles();
  const source = renderer(1000, painted);
  for (const index of [0, 1, 2, 3]) {
    tiles.canvas(index, source);
  }

  tiles.drop({ from: 256 * ROW_CHARS });
  painted.length = 0;
  tiles.canvas(1, source);
  tiles.canvas(2, source);
  expect(painted.map(({ row }) => row)).toEqual(
    Array.from({ length: TILE_ROWS }, (_, row) => 2 * TILE_ROWS + row + 1),
  );
  tiles.canvas(3, source);

  tiles.keep(2, 3);
  tiles.drop("none");
  painted.length = 0;
  for (const index of [0, 2, 3]) {
    tiles.canvas(index, source);
  }
  expect(painted.map(({ row }) => row)).toEqual(
    Array.from({ length: TILE_ROWS }, (_, row) => row + 1),
  );

  tiles.drop("all");
  painted.length = 0;
  tiles.canvas(3, source);
  expect(painted).toHaveLength(TILE_ROWS);
});
