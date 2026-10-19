import "../style.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../ipc";
import { MergeController, type MergeOptions } from "./index";
import { found, mount, unmountAll } from "./paneHarness";

const WIDTH = 1200;
const HEIGHT = 700;
const LINES = 40;
const CHUNK_START = 30;
const CHUNK_LINES = 6;
const PAINT_WAIT_MS = 3000;
const HALF = 0.5;
const INSIDE_PX = 1;
const OPTIONS: MergeOptions = {
  readOnly: false,
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  collapsed: true,
  minimap: false,
  servers: null,
};
const controllers: MergeController[] = [];

function text(changed: boolean): string {
  const lines = Array.from({ length: LINES }, (_, line) => {
    const inChunk = line >= CHUNK_START && line < CHUNK_START + CHUNK_LINES;
    return changed && inChunk ? `const line${line} = ${line} * 2;` : `const line${line} = ${line};`;
  });
  return [...lines, ""].join("\n");
}

async function data(): Promise<FileMergeData> {
  const lines = { start: CHUNK_START, len: CHUNK_LINES };
  return loadFixture("src/strips.ts", {
    "strips.json": {
      path: "src/strips.ts",
      deleted: null,
      middle: { kind: "Stages", text: text(false) },
      local: text(true),
      remote: text(false),
      eol: "Lf",
      disk_version: 0,
      chunks: [
        {
          chunk: { id: 0, kind: "LocalOnly", base: lines, local: lines, remote: lines },
          middle: lines,
          words: {
            chunk: 0,
            local: { changed: [], removals: [] },
            remote: { changed: [], removals: [] },
          },
          waiting: { kind: "SideLines" },
        },
      ],
    },
  });
}

async function painted<T extends Element>(strip: SVGSVGElement, selector: string): Promise<T> {
  return vi.waitFor(() => found(strip.querySelector<T>(selector), selector), {
    timeout: PAINT_WAIT_MS,
  });
}

function onScreen(path: SVGGeometryElement, x: number, y: number): DOMPoint {
  const matrix = path.getScreenCTM();
  if (matrix === null) {
    throw new Error("no screen matrix");
  }
  return new DOMPoint(x, y).matrixTransform(matrix);
}

async function leftStrip(): Promise<SVGSVGElement> {
  const hosts = mount();
  const controller = new MergeController(await data(), hosts, OPTIONS);
  controllers.push(controller);
  return hosts.strips[0];
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  unmountAll();
});

test("a press on a band below its icon row reaches the strip's svg, so it can drag the divider", async () => {
  const strip = await leftStrip();
  const band = await painted<SVGPathElement>(strip, "path.chunk-band");
  const icons = (await painted<SVGGElement>(strip, ".chunk-action")).getBoundingClientRect();
  const box = band.getBoundingClientRect();
  const point = new DOMPoint(box.left + box.width * HALF, (icons.bottom + box.bottom) * HALF);

  expect(point.y).toBeGreaterThan(icons.bottom);
  expect(point.y).toBeLessThan(box.bottom);
  expect(document.elementFromPoint(point.x, point.y)).toBe(strip);
});

test("a press on an icon's hit area, off its glyph, reaches the icon", async () => {
  const strip = await leftStrip();
  const hit = await painted<SVGRectElement>(strip, ".chunk-action-apply rect");
  const corner = onScreen(hit, INSIDE_PX, INSIDE_PX);

  expect(
    document.elementFromPoint(corner.x, corner.y)?.closest(".chunk-action-apply"),
  ).not.toBeNull();
});

test("a press on a wave join reaches its fold run", async () => {
  const strip = await leftStrip();
  const join = await painted<SVGPathElement>(strip, ".strip-wave-hit");
  const middle = join.getPointAtLength(join.getTotalLength() * HALF);
  const point = onScreen(join, middle.x, middle.y);

  expect(document.elementFromPoint(point.x, point.y)?.closest("[data-fold-run]")).not.toBeNull();
});
