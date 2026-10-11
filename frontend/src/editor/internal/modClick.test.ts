import { expect, test } from "vitest";

import { loadFixture } from "../../ipc";
import { openBlockAt } from "./modClick";
import type { Side } from "./side";
import { PENDING, type ChunkState, type ChunkStatus } from "./status";

const APPLIED_LEFT: ChunkStatus = { local: "applied", remote: "pending" };
const IGNORED_RIGHT: ChunkStatus = { local: "pending", remote: "ignored" };

async function magicStates(
  statuses: Readonly<Record<number, ChunkStatus>> = {},
): Promise<ChunkState[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) => ({ chunk, status: statuses[chunk.id] ?? PENDING }));
}

function blockAt(states: readonly ChunkState[], side: Side, line: number): number | null {
  return openBlockAt(states, { side, line })?.id ?? null;
}

test("a line inside an open block of that side maps to its change", async () => {
  const states = await magicStates();

  expect(blockAt(states, "local", 128)).toBe(8);
  expect(blockAt(states, "local", 135)).toBe(8);
  expect(blockAt(states, "remote", 140)).toBe(8);
  expect(blockAt(states, "remote", 153)).toBe(8);
  expect(blockAt(states, "remote", 86)).toBe(3);
  expect(blockAt(states, "local", 2)).toBe(0);
});

test("lines outside every block, unchanged sides and empty side ranges map to nothing", async () => {
  const states = await magicStates();

  expect(blockAt(states, "local", 127)).toBeNull();
  expect(blockAt(states, "local", 136)).toBeNull();
  expect(blockAt(states, "remote", 154)).toBeNull();
  expect(blockAt(states, "remote", 126)).toBeNull();
  expect(blockAt(states, "local", 86)).toBeNull();
  expect(blockAt(states, "remote", 2)).toBeNull();
});

test("a side that is already applied or ignored maps to nothing; the other side still does", async () => {
  const states = await magicStates({ 8: APPLIED_LEFT, 3: IGNORED_RIGHT });

  expect(blockAt(states, "local", 128)).toBeNull();
  expect(blockAt(states, "remote", 140)).toBe(8);
  expect(blockAt(states, "remote", 86)).toBeNull();
});
