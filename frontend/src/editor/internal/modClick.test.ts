import { expect, test } from "vitest";

import type { Span } from "../../connectors";
import { loadFixture, type FileMergeData } from "../../ipc";
import type { ChunkRow } from "./geometry";
import { isModHeld, modClickAction, modKeyName } from "./modClick";
import type { Side } from "./side";
import { PENDING, type ChunkStatus } from "./status";

const LINE_PX = 10;
const APPLIED_LEFT: ChunkStatus = { local: "applied", remote: "pending" };
const IGNORED_RIGHT: ChunkStatus = { local: "pending", remote: "ignored" };
const MAC = "MacIntel";
const LINUX = "Linux x86_64";
const WINDOWS = "Win32";
const MAIN = 0;
const MIDDLE = 1;
const SECONDARY = 2;
const CTRL = { ctrlKey: true, metaKey: false };

const MAGIC = await loadFixture("vueuse-use-magic-keys.ts");
const VON = await loadFixture("vue-core-compiler-von.ts");

function span({ start, len }: { readonly start: number; readonly len: number }): Span {
  return { top: start * LINE_PX, bottom: (start + len) * LINE_PX };
}

function rowsOf(
  data: FileMergeData,
  statuses: Readonly<Record<number, ChunkStatus>> = {},
): ChunkRow[] {
  return data.chunks.map((chunk) => ({
    chunk,
    status: statuses[chunk.id] ?? PENDING,
    left: span(chunk.local),
    center: span(chunk.middle),
    right: span(chunk.remote),
  }));
}

function lineTop(line: number): number {
  return (line - 1) * LINE_PX;
}

function clicked(
  rows: readonly ChunkRow[],
  {
    side,
    y,
    button = MAIN,
    keys = CTRL,
  }: {
    side: Side;
    y: number;
    button?: number;
    keys?: { ctrlKey: boolean; metaKey: boolean };
  },
): string | null {
  const action = modClickAction(rows, { side, y, click: { button, ...keys }, platform: LINUX });
  return action === null
    ? null
    : `${action.kind} ${action.side} ${action.chunks.map(({ id }) => id).join()}`;
}

test("Ctrl/Cmd+click on a block applies its change and Ctrl/Cmd+right-click ignores it; the next line does not", () => {
  const rows = rowsOf(MAGIC);

  expect(clicked(rows, { side: "local", y: lineTop(129) })).toBe("apply local 8");
  expect(clicked(rows, { side: "local", y: lineTop(137) - 1 })).toBe("apply local 8");
  expect(clicked(rows, { side: "local", y: lineTop(137) })).toBeNull();
  expect(clicked(rows, { side: "local", y: lineTop(129) - 1 })).toBeNull();
  expect(clicked(rows, { side: "local", y: lineTop(131), button: SECONDARY })).toBe(
    "ignore local 8",
  );
  expect(clicked(rows, { side: "remote", y: lineTop(141), button: SECONDARY })).toBe(
    "ignore remote 8",
  );
  expect(clicked(rows, { side: "remote", y: lineTop(155) - 1 })).toBe("apply remote 8");
  expect(clicked(rows, { side: "remote", y: lineTop(87) })).toBe("apply remote 3");
});

test("without Ctrl/Cmd, with the middle button, on an unchanged side or a decided side nothing happens", () => {
  const none = { ctrlKey: false, metaKey: false };
  const rows = rowsOf(MAGIC);
  const decided = rowsOf(MAGIC, { 8: APPLIED_LEFT, 3: IGNORED_RIGHT });

  expect(clicked(rows, { side: "local", y: lineTop(129), keys: none })).toBeNull();
  expect(
    clicked(rows, { side: "local", y: lineTop(129), button: SECONDARY, keys: none }),
  ).toBeNull();
  expect(clicked(rows, { side: "local", y: lineTop(129), button: MIDDLE })).toBeNull();
  expect(clicked(rows, { side: "local", y: lineTop(87) })).toBeNull();
  expect(clicked(decided, { side: "local", y: lineTop(129), button: SECONDARY })).toBeNull();
  expect(clicked(decided, { side: "remote", y: lineTop(141), button: SECONDARY })).toBe(
    "ignore remote 8",
  );
  expect(clicked(decided, { side: "remote", y: lineTop(87) })).toBeNull();
});

test("Ctrl/Cmd+click and Ctrl/Cmd+right-click 3 px from a zero-line change's bar act on it; 5 px away they don't", () => {
  const rows = rowsOf(VON);
  const bar = 18 * LINE_PX;

  expect(VON.chunks[1]?.remote).toEqual({ start: 18, len: 0 });
  for (const y of [bar - 3, bar + 3]) {
    expect(clicked(rows, { side: "remote", y })).toBe("apply remote 1");
    expect(clicked(rows, { side: "remote", y, button: SECONDARY })).toBe("ignore remote 1");
  }
  for (const y of [bar - 5, bar + 5]) {
    expect(clicked(rows, { side: "remote", y })).toBeNull();
    expect(clicked(rows, { side: "remote", y, button: SECONDARY })).toBeNull();
  }
});

test("only Cmd counts on macOS and only Ctrl elsewhere, and the hint names that key", () => {
  const ctrl = { ctrlKey: true, metaKey: false };
  const meta = { ctrlKey: false, metaKey: true };
  const both = { ctrlKey: true, metaKey: true };
  const none = { ctrlKey: false, metaKey: false };

  expect([ctrl, meta, both, none].map((keys) => isModHeld(keys, MAC))).toEqual([
    false,
    true,
    false,
    false,
  ]);
  expect(modKeyName(MAC)).toBe("⌘");
  for (const platform of [LINUX, WINDOWS]) {
    expect([ctrl, meta, both, none].map((keys) => isModHeld(keys, platform))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(modKeyName(platform)).toBe("Ctrl");
  }
});
