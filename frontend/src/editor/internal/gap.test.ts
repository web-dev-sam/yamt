import { expect, test } from "vitest";

import { bandPath } from "../../connectors";
import { loadFixture } from "../../ipc";
import { bandPaints, crossesStrip } from "./gap";
import type { ChunkRow } from "./geometry";
import type { Side } from "./side";
import { PENDING } from "./status";

const LINE_PX = 20;
const STRIP_PX = 600;
const STRIP = { width: 40, height: 1000 };
const CONFLICT_ID = 8;

async function magicRows(): Promise<ChunkRow[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) => ({
    chunk,
    status: PENDING,
    left: {
      top: chunk.local.start * LINE_PX,
      bottom: (chunk.local.start + chunk.local.len) * LINE_PX,
    },
    center: {
      top: chunk.base.start * LINE_PX,
      bottom: (chunk.base.start + chunk.base.len) * LINE_PX,
    },
    right: {
      top: chunk.remote.start * LINE_PX,
      bottom: (chunk.remote.start + chunk.remote.len) * LINE_PX,
    },
  }));
}

async function conflictBand(
  side: Side,
  shifts: { readonly left: number; readonly right: number },
): Promise<string | undefined> {
  const rows = await magicRows();
  return bandPaints({ rows, side }, shifts, STRIP).find(({ chunk }) => chunk.id === CONFLICT_ID)?.d;
}

test("a shape is drawn while any part of it touches the strip, edges included", () => {
  expect(crossesStrip(-LINE_PX, 0, STRIP_PX)).toBe(true);
  expect(crossesStrip(STRIP_PX, STRIP_PX + LINE_PX, STRIP_PX)).toBe(true);
  expect(crossesStrip(-LINE_PX, STRIP_PX + LINE_PX, STRIP_PX)).toBe(true);
  expect(crossesStrip(LINE_PX, LINE_PX, STRIP_PX)).toBe(true);
});

test("a shape wholly above or below the strip is left out", () => {
  expect(crossesStrip(-LINE_PX - 1, -1, STRIP_PX)).toBe(false);
  expect(crossesStrip(STRIP_PX + 1, STRIP_PX + LINE_PX, STRIP_PX)).toBe(false);
});

test("each strip joins its own pane pair, each edge moved by its own pane's shift", async () => {
  const shifts = { left: -2000, right: -2100 };

  expect(await conflictBand("local", shifts)).toBe(
    bandPath({ left: { top: 560, bottom: 720 }, right: { top: 460, bottom: 660 } }, STRIP.width),
  );
  expect(await conflictBand("remote", shifts)).toBe(
    bandPath({ left: { top: 560, bottom: 760 }, right: { top: 700, bottom: 980 } }, STRIP.width),
  );
});

test("a band is kept while one edge is still in the strip and the other has left it", async () => {
  expect(await conflictBand("local", { left: -2721, right: -2560 })).toBe(
    bandPath({ left: { top: -161, bottom: -1 }, right: { top: 0, bottom: 200 } }, STRIP.width),
  );
  expect(await conflictBand("local", { left: -1570, right: -1559 })).toBe(
    bandPath({ left: { top: 990, bottom: 1150 }, right: { top: 1001, bottom: 1201 } }, STRIP.width),
  );
});

test("a band 1 px above or below the strip on both edges is dropped", async () => {
  expect(await conflictBand("local", { left: -2721, right: -2761 })).toBeUndefined();
  expect(await conflictBand("local", { left: -1559, right: -1559 })).toBeUndefined();
});
