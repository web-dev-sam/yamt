import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture, type Chunk } from "../../ipc";
import type { SideMark } from "./navigation";
import { setMark, sideMarks } from "./sideMark";
import { showStatuses } from "./sideStatus";
import { PENDING, type ChunkState, type ChunkStatus } from "./status";

const APPLIED_LOCAL: ChunkStatus = { local: "applied", remote: "pending" };
const IGNORED_LOCAL: ChunkStatus = { local: "ignored", remote: "pending" };

const MAGIC = await loadFixture("vueuse-use-magic-keys.ts");

function statuses(decided: Readonly<Record<number, ChunkStatus>>): ChunkState[] {
  return MAGIC.chunks.map((chunk) => ({ chunk, status: decided[chunk.id] ?? PENDING }));
}

function id(index: number): Chunk["id"] {
  const chunk = MAGIC.chunks[index];
  if (chunk === undefined) {
    throw new Error(`no chunk ${index}`);
  }
  return chunk.id;
}

function change(index: number): SideMark {
  return { kind: "change", id: id(index) };
}

function marked(mark: SideMark): EditorState {
  const state = EditorState.create({ doc: MAGIC.local, extensions: sideMarks.local });
  return state.update({ effects: setMark.of(mark) }).state;
}

function pushed(state: EditorState, decided: Readonly<Record<number, ChunkStatus>>): SideMark {
  return state.update({ effects: showStatuses.of(statuses(decided)) }).state.field(sideMarks.local);
}

test("deciding the marked change moves the mark to the next change waiting below on that side", () => {
  expect(pushed(marked(change(2)), { 2: APPLIED_LOCAL })).toEqual(change(5));
});

test("a push that reopens changes, as undo does, leaves the mark where it is", () => {
  expect(pushed(marked(change(5)), {})).toEqual(change(5));
});

test("a remembered change decided while its side is alone moves by the same rule and stays alone", () => {
  const state = marked({ kind: "alone", remembered: id(8) });

  expect(pushed(state, { 8: APPLIED_LOCAL, 7: IGNORED_LOCAL })).toEqual({
    kind: "alone",
    remembered: id(0),
  });
});

test("the last change decided on that side leaves the side alone with nothing remembered", () => {
  const done = [0, 1, 2, 5, 7, 8].map((index) => [index, APPLIED_LOCAL] as const);

  expect(pushed(marked(change(8)), Object.fromEntries(done))).toEqual({
    kind: "alone",
    remembered: null,
  });
});

test("setMark wins over a status push in the same transaction", () => {
  const state = marked(change(2));

  const next = state.update({
    effects: [setMark.of(change(2)), showStatuses.of(statuses({ 2: APPLIED_LOCAL }))],
  }).state;

  expect(next.field(sideMarks.local)).toEqual(change(2));
});
