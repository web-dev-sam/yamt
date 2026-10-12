import { expect, test } from "vitest";

import { bandPath } from "../../connectors";
import { loadFixture, type Chunk } from "../../ipc";
import {
  arrowTitles,
  bandPaints,
  crossesStrip,
  gapArrows,
  keepsArrowRow,
  type Arrow,
  type ArrowTitles,
} from "./gap";
import type { ChunkRow } from "./geometry";
import type { Side } from "./side";
import { PENDING, type ChunkStatus } from "./status";

const LINE_PX = 20;
const STRIP_PX = 600;
const STRIP = { width: 40, height: 1000 };
const CONFLICT_ID = 8;
const IN_STRIP = { left: -2000, right: -2100 };
const NO_SHIFT = { left: 0, right: 0 };

function rowOf(chunk: Chunk, status: ChunkStatus): ChunkRow {
  return {
    chunk,
    status,
    left: {
      top: chunk.local.start * LINE_PX,
      bottom: (chunk.local.start + chunk.local.len) * LINE_PX,
    },
    center: {
      top: chunk.middle.start * LINE_PX,
      bottom: (chunk.middle.start + chunk.middle.len) * LINE_PX,
    },
    right: {
      top: chunk.remote.start * LINE_PX,
      bottom: (chunk.remote.start + chunk.remote.len) * LINE_PX,
    },
  };
}

async function magicRows(conflictStatus: ChunkStatus): Promise<ChunkRow[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) =>
    rowOf(chunk, chunk.id === CONFLICT_ID ? conflictStatus : PENDING),
  );
}

async function conflictBand(
  side: Side,
  shifts: { readonly left: number; readonly right: number },
  conflictStatus: ChunkStatus = PENDING,
): Promise<string | undefined> {
  const rows = await magicRows(conflictStatus);
  return bandPaints({ rows, side }, shifts, STRIP).find(({ chunk }) => chunk.id === CONFLICT_ID)?.d;
}

function noWords(chunk: number): Record<string, unknown> {
  return { chunk, local: { changed: [], removed_at: [] }, remote: { changed: [], removed_at: [] } };
}

async function oneLineDeletedOnEachSide(): Promise<readonly Chunk[]> {
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: "a\nb\nc\n" },
    local: "b\nc\n",
    remote: "a\nb\n",
    eol: "Lf",
    disk_version: 0,
    chunks: [
      {
        chunk: {
          id: 0,
          kind: "LocalOnly",
          base: { start: 0, len: 1 },
          local: { start: 0, len: 0 },
          remote: { start: 0, len: 1 },
        },
        middle: { start: 0, len: 1 },
        words: noWords(0),
      },
      {
        chunk: {
          id: 1,
          kind: "RemoteOnly",
          base: { start: 2, len: 1 },
          local: { start: 1, len: 1 },
          remote: { start: 2, len: 0 },
        },
        middle: { start: 2, len: 1 },
        words: noWords(1),
      },
    ],
  };
  const data = await loadFixture("synthetic.ts", { "synthetic.json": record });
  return data.chunks;
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
  expect(await conflictBand("local", IN_STRIP)).toBe(
    bandPath({ left: { top: 560, bottom: 720 }, right: { top: 460, bottom: 660 } }, STRIP.width),
  );
  expect(await conflictBand("remote", IN_STRIP)).toBe(
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

test.each<ChunkStatus["local"]>(["applied", "ignored"])(
  "a chunk whose local side is %s leaves the local strip and stays on the remote one",
  async (local) => {
    const status: ChunkStatus = { local, remote: "pending" };

    expect(await conflictBand("local", IN_STRIP, status)).toBeUndefined();
    expect(await conflictBand("remote", IN_STRIP, status)).toBe(
      bandPath({ left: { top: 560, bottom: 760 }, right: { top: 700, bottom: 980 } }, STRIP.width),
    );
  },
);

test("each strip paints a chunk in its own side's tone", async () => {
  const rows = (await oneLineDeletedOnEachSide()).map((chunk) => rowOf(chunk, PENDING));

  expect(
    bandPaints({ rows, side: "local" }, NO_SHIFT, STRIP).map(({ chunk, tone }) => [chunk.id, tone]),
  ).toEqual([[0, "deleted"]]);
  expect(
    bandPaints({ rows, side: "remote" }, NO_SHIFT, STRIP).map(({ chunk, tone }) => [
      chunk.id,
      tone,
    ]),
  ).toEqual([[1, "deleted"]]);
});

async function conflictTitles(
  conflictStatus: ChunkStatus,
  { side, platform }: { side: Side; platform: string },
): Promise<{ mode: string; titles: ArrowTitles } | null> {
  const rows = await magicRows(conflictStatus);
  const arrow = gapArrows(rows, side).find(({ chunk }) => chunk.id === CONFLICT_ID);
  return arrow === undefined ? null : { mode: arrow.mode, titles: arrowTitles(arrow, platform) };
}

const LINUX = "Linux x86_64";

test("a conflict's icons name the Ctrl+click while the other side waits, and lose the line once it is decided", async () => {
  const linux: { side: Side; platform: string } = { side: "local", platform: LINUX };

  expect(await conflictTitles(PENDING, linux)).toEqual({
    mode: "replace",
    titles: {
      apply: "Apply\nCtrl+click: also ignore the other side",
      ignore: "Ignore\nCtrl+click: also take the other side",
    },
  });
  expect(await conflictTitles({ local: "pending", remote: "ignored" }, linux)).toEqual({
    mode: "replace",
    titles: { apply: "Apply", ignore: "Ignore" },
  });
  expect(await conflictTitles({ local: "pending", remote: "applied" }, linux)).toEqual({
    mode: "append",
    titles: { apply: "Apply after the other side", ignore: "Ignore" },
  });
  expect(
    await conflictTitles({ local: "ignored", remote: "pending" }, { ...linux, side: "remote" }),
  ).toEqual({ mode: "replace", titles: { apply: "Apply", ignore: "Ignore" } });
});

test("on macOS the hint says ⌘+click", async () => {
  expect(await conflictTitles(PENDING, { side: "remote", platform: "MacIntel" })).toEqual({
    mode: "replace",
    titles: {
      apply: "Apply\n⌘+click: also ignore the other side",
      ignore: "Ignore\n⌘+click: also take the other side",
    },
  });
});

test("a change that is not a conflict never has the hint, even when both sides changed it", async () => {
  const rows = await magicRows(PENDING);
  const first = rows[0]?.chunk;
  if (first === undefined) {
    throw new Error("no chunk 0");
  }
  const bothSame = rowOf({ ...first, kind: "BothSame" }, PENDING);

  for (const side of ["local", "remote"] satisfies Side[]) {
    const titles = gapArrows([...rows, bothSame], side)
      .filter(({ chunk }) => chunk.id !== CONFLICT_ID)
      .map((arrow) => arrowTitles(arrow, LINUX));
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) {
      expect(title).toEqual({ apply: "Apply", ignore: "Ignore" });
    }
  }
});

test("an icon row built while the other side waited is rebuilt once that side is ignored", async () => {
  const layout = { applyX: 0, ignoreX: 16, lineHeight: LINE_PX };
  async function conflictArrow(conflictStatus: ChunkStatus): Promise<Arrow> {
    const arrow = gapArrows(await magicRows(conflictStatus), "local").find(
      ({ chunk }) => chunk.id === CONFLICT_ID,
    );
    if (arrow === undefined) {
      throw new Error("no arrow for the conflict");
    }
    return arrow;
  }
  const built = await conflictArrow(PENDING);
  const row = { mode: built.mode, decidesOther: built.decidesOther, layout };

  const ignored = await conflictArrow({ local: "pending", remote: "ignored" });

  expect(ignored.mode).toBe(row.mode);
  expect(keepsArrowRow(row, await conflictArrow(PENDING), { ...layout })).toBe(true);
  expect(keepsArrowRow(row, ignored, layout)).toBe(false);
});
