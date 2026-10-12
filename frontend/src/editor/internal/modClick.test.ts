import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture } from "../../ipc";
import { isModHeld, openBlockAt } from "./modClick";
import type { Side } from "./side";
import { PENDING, type ChunkState, type ChunkStatus } from "./status";

type Magic = { readonly states: ChunkState[]; readonly docs: Readonly<Record<Side, Text>> };

const APPLIED_LEFT: ChunkStatus = { local: "applied", remote: "pending" };
const IGNORED_RIGHT: ChunkStatus = { local: "pending", remote: "ignored" };
const MAC = "MacIntel";
const LINUX = "Linux x86_64";
const WINDOWS = "Win32";

async function magic(statuses: Readonly<Record<number, ChunkStatus>> = {}): Promise<Magic> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return {
    states: data.chunks.map((chunk) => ({ chunk, status: statuses[chunk.id] ?? PENDING })),
    docs: { local: Text.of(data.local.split("\n")), remote: Text.of(data.remote.split("\n")) },
  };
}

function blockAt({ states, docs }: Magic, side: Side, pos: number): number | null {
  return openBlockAt(states, { side, doc: docs[side], pos })?.id ?? null;
}

function lineStart({ docs }: Magic, side: Side, line: number): number {
  return docs[side].line(line).from;
}

function lineEnd({ docs }: Magic, side: Side, line: number): number {
  return docs[side].line(line).to;
}

test("a block's first character and the end of its last line map to its change; the next line does not", async () => {
  const merge = await magic();

  expect(blockAt(merge, "local", lineStart(merge, "local", 129))).toBe(8);
  expect(blockAt(merge, "local", lineEnd(merge, "local", 136))).toBe(8);
  expect(blockAt(merge, "local", lineStart(merge, "local", 137))).toBeNull();
  expect(blockAt(merge, "local", lineEnd(merge, "local", 128))).toBeNull();
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 141))).toBe(8);
  expect(blockAt(merge, "remote", lineEnd(merge, "remote", 154))).toBe(8);
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 155))).toBeNull();
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 87))).toBe(3);
  expect(blockAt(merge, "local", lineStart(merge, "local", 3))).toBe(0);
});

test("unchanged sides and empty side ranges map to nothing", async () => {
  const merge = await magic();

  expect(blockAt(merge, "local", lineStart(merge, "local", 87))).toBeNull();
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 3))).toBeNull();
});

test("a side that is already applied or ignored maps to nothing; the other side still does", async () => {
  const merge = await magic({ 8: APPLIED_LEFT, 3: IGNORED_RIGHT });

  expect(blockAt(merge, "local", lineStart(merge, "local", 129))).toBeNull();
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 141))).toBe(8);
  expect(blockAt(merge, "remote", lineStart(merge, "remote", 87))).toBeNull();
});

test("only Cmd counts on macOS and only Ctrl elsewhere", () => {
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
  for (const platform of [LINUX, WINDOWS]) {
    expect([ctrl, meta, both, none].map((keys) => isModHeld(keys, platform))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  }
});
