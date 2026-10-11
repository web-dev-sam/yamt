import { expect, test } from "vitest";

import { loadFixture, type Chunk } from "../../ipc";
import { coveredChunks } from "./drag";
import { gapArrows } from "./gap";
import type { ChunkRow } from "./geometry";
import type { Side } from "./side";
import { PENDING, type ChunkStatus } from "./status";

const LINE_PX = 20;
const FAR_BELOW = 1_000_000;
const APPLIED_LEFT: ChunkStatus = { local: "applied", remote: "pending" };

async function magicRows(
  statuses: Readonly<Record<number, ChunkStatus>> = {},
): Promise<ChunkRow[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) => ({
    chunk,
    status: statuses[chunk.id] ?? PENDING,
    left: { top: chunk.local.start * LINE_PX, bottom: 0 },
    center: { top: 0, bottom: 0 },
    right: { top: chunk.remote.start * LINE_PX, bottom: 0 },
  }));
}

function covered(
  rows: readonly ChunkRow[],
  { side, pressed, pointerTop }: { side: Side; pressed: number; pointerTop: number },
): number[] {
  const chunk: Chunk | undefined = rows[pressed]?.chunk;
  if (chunk === undefined) {
    throw new Error(`no chunk ${pressed}`);
  }
  return coveredChunks(gapArrows(rows, side), {
    pressed: chunk,
    pointerTop,
    lineHeight: LINE_PX,
  }).map(({ id }) => id);
}

test("dragging down covers the pressed icon and every open icon whose row the pointer reached", async () => {
  const rows = await magicRows();
  const pressTop = 53 * LINE_PX;

  expect(covered(rows, { side: "local", pressed: 2, pointerTop: pressTop + LINE_PX - 1 })).toEqual([
    2,
  ]);
  expect(covered(rows, { side: "local", pressed: 2, pointerTop: 102 * LINE_PX - 1 })).toEqual([2]);
  expect(covered(rows, { side: "local", pressed: 2, pointerTop: 102 * LINE_PX })).toEqual([2, 5]);
  expect(covered(rows, { side: "local", pressed: 2, pointerTop: FAR_BELOW })).toEqual([2, 5, 7, 8]);
});

test("dragging up covers every open icon whose row the pointer reached, down to the pressed one", async () => {
  const rows = await magicRows();

  expect(covered(rows, { side: "local", pressed: 2, pointerTop: 22 * LINE_PX })).toEqual([2]);
  expect(covered(rows, { side: "local", pressed: 2, pointerTop: 22 * LINE_PX - 1 })).toEqual([
    1, 2,
  ]);
  expect(covered(rows, { side: "local", pressed: 2, pointerTop: -FAR_BELOW })).toEqual([0, 1, 2]);
});

test("a pointer between icons covers nothing beyond the last icon it passed", async () => {
  const rows = await magicRows();

  expect(covered(rows, { side: "local", pressed: 1, pointerTop: 40 * LINE_PX })).toEqual([1]);
  expect(covered(rows, { side: "local", pressed: 5, pointerTop: 80 * LINE_PX })).toEqual([5]);
});

test("closed sides are skipped: a handled change and changes of the other side are never covered", async () => {
  const rows = await magicRows({ 5: APPLIED_LEFT });

  expect(covered(rows, { side: "local", pressed: 2, pointerTop: FAR_BELOW })).toEqual([2, 7, 8]);
  expect(covered(rows, { side: "remote", pressed: 4, pointerTop: FAR_BELOW })).toEqual([4, 6, 8]);
  expect(covered(rows, { side: "local", pressed: 5, pointerTop: FAR_BELOW })).toEqual([]);
});
