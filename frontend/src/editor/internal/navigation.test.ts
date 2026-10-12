import { expect, test } from "vitest";

import type { Span } from "../../connectors";
import { loadFixture, type Chunk } from "../../ipc";
import type { ChunkRow } from "./geometry";
import {
  afterDecision,
  afterDecisionFocus,
  changeAt,
  crossTo,
  fromScreen,
  handoverTo,
  hasWaiting,
  stepAlone,
  stepFrom,
  type SideMark,
} from "./navigation";
import { PENDING, type ChunkState, type ChunkStatus } from "./status";

const LINE_PX = 10;
const APPLIED_LOCAL: ChunkStatus = { local: "applied", remote: "pending" };
const IGNORED_LOCAL: ChunkStatus = { local: "ignored", remote: "pending" };
const IGNORED_REMOTE: ChunkStatus = { local: "pending", remote: "ignored" };
const DONE: ChunkStatus = { local: "applied", remote: "ignored" };
const ALONE: SideMark = { kind: "alone", remembered: null };

const MAGIC = await loadFixture("vueuse-use-magic-keys.ts");

// Local waits on 0, 1, 2, 5, 7, 8; remote on 3, 4, 6, 8; 8 is the conflict (local 129-136, remote 141-154).
function magic(statuses: Readonly<Record<number, ChunkStatus>> = {}): ChunkState[] {
  return MAGIC.chunks.map((chunk) => ({ chunk, status: statuses[chunk.id] ?? PENDING }));
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

function remembering(index: number): SideMark {
  return { kind: "alone", remembered: id(index) };
}

function span({ start, len }: { readonly start: number; readonly len: number }): Span {
  return { top: start * LINE_PX, bottom: (start + len) * LINE_PX };
}

function rowsOf(states: readonly ChunkState[]): ChunkRow[] {
  return states.map(({ chunk, status }) => ({
    chunk,
    status,
    left: span(chunk.local),
    center: span(chunk.middle),
    right: span(chunk.remote),
  }));
}

function area(top: number, bottom: number): Span {
  return { top, bottom };
}

test("Down and Up pass over a change already decided on that side and stop at it on the other", () => {
  const states = magic({ 8: APPLIED_LOCAL, 5: IGNORED_LOCAL });

  expect(stepFrom(states, { side: "local", id: id(7), direction: "down" })).toBeNull();
  expect(stepFrom(states, { side: "remote", id: id(6), direction: "down" })).toBe(8);
  expect(stepFrom(states, { side: "local", id: id(7), direction: "up" })).toBe(2);
  expect(stepFrom(states, { side: "local", id: id(2), direction: "down" })).toBe(7);
  expect(stepFrom(states, { side: "remote", id: id(4), direction: "down" })).toBe(6);
});

test("Down on the lowest waiting change and Up on the top-most stay put", () => {
  const states = magic();

  expect(stepFrom(states, { side: "local", id: id(8), direction: "down" })).toBeNull();
  expect(stepFrom(states, { side: "local", id: id(0), direction: "up" })).toBeNull();
  expect(stepFrom(states, { side: "remote", id: id(3), direction: "up" })).toBeNull();
});

test("after deciding the lowest waiting change the pick is the top-most still waiting, not the one above", () => {
  const states = magic({ 1: APPLIED_LOCAL, 5: APPLIED_LOCAL, 7: APPLIED_LOCAL, 8: APPLIED_LOCAL });

  expect(afterDecision(states, "local", id(8))).toBe(0);
  expect(afterDecision(states, "local", id(1))).toBe(2);
});

test("with nothing left on that side there is no pick, even while the other side waits", () => {
  const states = magic({ 0: DONE, 1: DONE, 2: DONE, 5: DONE, 7: DONE, 8: APPLIED_LOCAL });

  expect(afterDecision(states, "local", id(8))).toBeNull();
  expect(hasWaiting(states, "local")).toBe(false);
  expect(hasWaiting(states, "remote")).toBe(true);
});

test("Left/Right from a conflict half lands on its other half while it waits, else the remembered change, else alone", () => {
  const from = change(8);
  const remembered = remembering(4);

  expect(crossTo(magic(), { from, to: remembered, toSide: "remote" })).toEqual(change(8));
  expect(crossTo(magic({ 8: IGNORED_REMOTE }), { from, to: remembered, toSide: "remote" })).toEqual(
    change(4),
  );
  expect(
    crossTo(magic({ 8: IGNORED_REMOTE, 4: DONE }), { from, to: remembered, toSide: "remote" }),
  ).toEqual(remembered);
  expect(crossTo(magic({ 8: IGNORED_REMOTE }), { from, to: ALONE, toSide: "remote" })).toEqual(
    ALONE,
  );
});

test("a change made the same way on both sides crosses to its other half", () => {
  const states = magic().map((state) =>
    state.chunk.id === 0
      ? { ...state, chunk: { ...state.chunk, kind: "BothSame" } satisfies Chunk }
      : state,
  );
  expect(crossTo(states, { from: change(0), to: change(3), toSide: "remote" })).toEqual(change(0));
});

test("from a local-only change, Right uses the right side's remembered change", () => {
  const from = change(7);

  expect(crossTo(magic(), { from, to: remembering(6), toSide: "remote" })).toEqual(change(6));
  expect(crossTo(magic(), { from, to: change(3), toSide: "remote" })).toEqual(change(3));
});

test("from the screen, Down takes a change straddling the top and skips one ending exactly at it", () => {
  const rows = rowsOf(magic());
  function below(top: number): number | null {
    return fromScreen(rows, { side: "local", area: area(top, top + 500), direction: "down" });
  }

  expect(below(1030)).toBe(5);
  expect(below(1070)).toBe(7);
  expect(below(1020)).toBe(5);
});

test("from the screen, Up takes a change straddling the bottom and skips one starting exactly at it", () => {
  const rows = rowsOf(magic());
  function above(bottom: number): number | null {
    return fromScreen(rows, { side: "local", area: area(bottom - 500, bottom), direction: "up" });
  }

  expect(above(1030)).toBe(5);
  expect(above(1020)).toBe(2);
  expect(above(1025)).toBe(5);
});

test("from the screen, a zero-line change exactly at the edge counts", async () => {
  const data = await loadFixture("vue-core-compiler-von.ts");
  const rows = rowsOf(data.chunks.map((chunk) => ({ chunk, status: PENDING })));

  expect(fromScreen(rows, { side: "remote", area: area(180, 400), direction: "down" })).toBe(1);
  expect(fromScreen(rows, { side: "remote", area: area(0, 180), direction: "up" })).toBe(1);
  expect(fromScreen(rows, { side: "remote", area: area(181, 400), direction: "down" })).toBe(2);
});

test("a side alone with waiting changes only above the area stays put; with none waiting it falls back", () => {
  const areas = { local: area(1400, 1900), remote: area(0, 500) };
  const rows = rowsOf(magic());

  expect(
    stepAlone(rows, { side: "local", fallback: "remote", areas, direction: "down" }),
  ).toBeNull();

  const doneLocal = rowsOf(
    magic({ 0: DONE, 1: DONE, 2: DONE, 5: DONE, 7: DONE, 8: APPLIED_LOCAL }),
  );
  expect(
    stepAlone(doneLocal, { side: "local", fallback: "remote", areas, direction: "down" }),
  ).toEqual({ side: "remote", id: 3 });
  expect(stepAlone(doneLocal, { side: "local", fallback: null, areas, direction: "down" })).toBe(
    null,
  );
});

test("a click hits a band by its px span and a zero-line change near its bar, never a decided side", async () => {
  const rows = rowsOf(magic({ 7: APPLIED_LOCAL }));

  expect(changeAt(rows, "local", 1280)).toBe(8);
  expect(changeAt(rows, "local", 1359)).toBe(8);
  expect(changeAt(rows, "local", 1360)).toBeNull();
  expect(changeAt(rows, "local", 1145)).toBeNull();
  expect(changeAt(rows, "remote", 865)).toBe(3);

  const von = await loadFixture("vue-core-compiler-von.ts");
  const point = rowsOf(von.chunks.map((chunk) => ({ chunk, status: PENDING })));
  expect(changeAt(point, "remote", 183)).toBe(1);
  expect(changeAt(point, "remote", 177)).toBe(1);
  expect(changeAt(point, "remote", 186)).toBeNull();
  const ignored = rowsOf(von.chunks.map((chunk) => ({ chunk, status: IGNORED_REMOTE })));
  expect(changeAt(ignored, "remote", 180)).toBeNull();
});

test("the keyboard moves to the other side only when the decision emptied the focused side, never to the hidden side", () => {
  const lastOnLocal = magic({ 0: DONE, 1: DONE, 2: DONE, 5: DONE, 7: DONE });
  const doneLocal = magic({ 0: DONE, 1: DONE, 2: DONE, 5: DONE, 7: DONE, 8: APPLIED_LOCAL });
  const emptied = { before: lastOnLocal, after: doneLocal };

  expect(handoverTo(emptied, { focused: "local", hidden: null })).toBe("remote");
  expect(
    handoverTo({ before: magic(), after: magic({ 0: DONE }) }, { focused: "local", hidden: null }),
  ).toBeNull();
  expect(handoverTo(emptied, { focused: null, hidden: null })).toBeNull();
  expect(handoverTo(emptied, { focused: "local", hidden: "remote" })).toBeNull();
});

test("a decision on the other side never moves the keyboard off a side that was already empty", () => {
  const doneLocal = magic({ 0: DONE, 1: DONE, 2: DONE, 5: DONE, 7: DONE, 8: APPLIED_LOCAL });
  const remoteDecided = magic({
    0: DONE,
    1: DONE,
    2: DONE,
    3: DONE,
    5: DONE,
    7: DONE,
    8: APPLIED_LOCAL,
  });

  expect(
    handoverTo({ before: doneLocal, after: remoteDecided }, { focused: "local", hidden: null }),
  ).toBeNull();
});

test("after a decision that moved the focused side's mark on, the view reveals its new change", () => {
  expect(
    afterDecisionFocus({ beforeMark: change(2), afterMark: change(5), handover: null }),
  ).toEqual({ kind: "reveal" });
  expect(
    afterDecisionFocus({ beforeMark: remembering(2), afterMark: change(5), handover: null }),
  ).toEqual({ kind: "reveal" });
});

test("after a decision on another change the mark stays and the view does not move", () => {
  expect(
    afterDecisionFocus({ beforeMark: change(2), afterMark: change(2), handover: null }),
  ).toEqual({ kind: "stay" });
});

test("after a decision that left the focused side alone the view does not move", () => {
  expect(afterDecisionFocus({ beforeMark: change(8), afterMark: ALONE, handover: null })).toEqual({
    kind: "stay",
  });
  expect(
    afterDecisionFocus({ beforeMark: remembering(2), afterMark: remembering(5), handover: null }),
  ).toEqual({ kind: "stay" });
});

test("a handover wins over revealing on the emptied side", () => {
  expect(
    afterDecisionFocus({ beforeMark: change(8), afterMark: ALONE, handover: "remote" }),
  ).toEqual({ kind: "handover", side: "remote" });
  expect(
    afterDecisionFocus({ beforeMark: change(2), afterMark: change(5), handover: "remote" }),
  ).toEqual({ kind: "handover", side: "remote" });
});
