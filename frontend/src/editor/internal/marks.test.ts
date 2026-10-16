import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture, type Chunk } from "../../ipc";
import type { ChunkRow } from "./geometry";
import { changePlaces, laneBox, problemPlaces, tickAt, ticks, type MarkPlace } from "./marks";
import type { MarkKind, Tick } from "./marks";
import { PENDING, type ChunkStatus } from "./status";

const LINE_PX = 20;
const FIND_SPACE_PX = 29;
const SCROLLBAR_PX = 15;
const TALL = { scrollHeight: 4000, clientHeight: 800, offsetWidth: 600, clientWidth: 600 };
const OVERLAY = laneBox({ ...TALL, paddingTop: 0 }, false);
const TARGET: MarkPlace["target"] = {
  kind: "problem",
  diagnostic: { from: 0, to: 0, severity: "info", message: "" },
};

function place(top: number, bottom: number, kind: MarkKind = "modified"): MarkPlace {
  return { top, bottom, kind, target: TARGET };
}

function rowOf(chunk: Chunk, status: ChunkStatus): ChunkRow {
  function span(range: { start: number; len: number }): { top: number; bottom: number } {
    return { top: range.start * LINE_PX, bottom: (range.start + range.len) * LINE_PX };
  }
  return {
    chunk,
    status,
    left: span(chunk.local),
    center: span(chunk.middle),
    right: span(chunk.remote),
  };
}

const LOCAL_APPLIED = 5;
const CONFLICT = 8;

async function magicRows(): Promise<ChunkRow[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) => {
    if (chunk.id === LOCAL_APPLIED) {
      return rowOf(chunk, { local: "applied", remote: "pending" });
    }
    return rowOf(chunk, chunk.id === CONFLICT ? { local: "ignored", remote: "pending" } : PENDING);
  });
}

function marked(places: readonly MarkPlace[]): (string | number)[][] {
  return places.map(({ kind, target, top }) => [
    target.kind === "change" ? target.id : "problem",
    kind,
    top,
  ]);
}

test("rule 4: a place's top over the scrollable height, scaled to the track", () => {
  const [tick] = ticks([place(2000, 2100)], OVERLAY);

  expect(tick).toMatchObject({ top: 400, height: 20 });
});

test("rule 4: never thinner than 2 px; an insertion point is 2 px", () => {
  const [thin, point] = ticks([place(2000, 2005), place(3000, 3000)], OVERLAY);

  expect(thin).toMatchObject({ top: 400, height: 2 });
  expect(point).toMatchObject({ top: 600, height: 2 });
});

test("rule 4: a document no taller than its pane maps 1:1", () => {
  const short = laneBox({ ...TALL, scrollHeight: 800, paddingTop: 0 }, false);
  const shortWithArrows = laneBox(
    { ...TALL, scrollHeight: 800, clientWidth: 600 - SCROLLBAR_PX, paddingTop: 0 },
    true,
  );

  expect(ticks([place(300, 340)], short)).toMatchObject([{ top: 300, height: 40 }]);
  expect(ticks([place(300, 340)], shortWithArrows)).toMatchObject([
    { top: SCROLLBAR_PX + 300, height: 40 },
  ]);
});

test("rule 4: the find space moves ticks by its share", () => {
  const withFind = laneBox({ ...TALL, paddingTop: FIND_SPACE_PX }, false);

  expect(ticks([place(2000, 2100)], withFind)[0]?.top).toBeCloseTo((2000 + FIND_SPACE_PX) / 5);
});

test("rule 4: an overlay scrollbar gets the 14 px lane, a classic one its width; on Windows the track leaves out both arrows", () => {
  const classic = { ...TALL, clientWidth: 600 - SCROLLBAR_PX, paddingTop: 0 };

  expect(OVERLAY).toMatchObject({ width: 14, height: 800, track: { top: 0, bottom: 800 } });
  expect(laneBox(classic, false)).toMatchObject({
    width: SCROLLBAR_PX,
    track: { top: 0, bottom: 800 },
  });
  const windows = laneBox(classic, true);
  expect(windows).toMatchObject({
    width: SCROLLBAR_PX,
    track: { top: SCROLLBAR_PX, bottom: 800 - SCROLLBAR_PX },
  });
  const trackPx = 800 - 2 * SCROLLBAR_PX;
  expect(ticks([place(2000, 2100)], windows)[0]?.top).toBeCloseTo(
    SCROLLBAR_PX + (2000 * trackPx) / 4000,
  );
});

test("rule 4: a tick at the end stays in the track", () => {
  const [last] = ticks([place(3995, 4000)], OVERLAY);
  const windows = laneBox({ ...TALL, clientWidth: 600 - SCROLLBAR_PX, paddingTop: 0 }, true);
  const [lastWithArrows] = ticks([place(3995, 4000)], windows);

  expect(last).toMatchObject({ top: 798, height: 2 });
  expect(lastWithArrows).toMatchObject({ top: 800 - SCROLLBAR_PX - 2, height: 2 });
});

const DOC = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join("\n");
const WAVE = { first: 11, last: 40 };

function foldedBlockAt(state: EditorState): (pos: number) => { top: number; bottom: number } {
  return (pos) => {
    const line = state.doc.lineAt(pos).number;
    if (line < WAVE.first) {
      return { top: (line - 1) * LINE_PX, bottom: line * LINE_PX };
    }
    if (line <= WAVE.last) {
      return { top: (WAVE.first - 1) * LINE_PX, bottom: WAVE.first * LINE_PX };
    }
    const shown = line - (WAVE.last - WAVE.first);
    return { top: (shown - 1) * LINE_PX, bottom: shown * LINE_PX };
  };
}

function withProblems(
  problems: readonly { line: number; severity: Diagnostic["severity"] }[],
): EditorState {
  const state = EditorState.create({ doc: DOC });
  const diagnostics = problems.map(({ line, severity }) => {
    const from = state.doc.line(line).from;
    return { from, to: from + 4, severity, message: "problem" };
  });
  return state.update(setDiagnostics(state, diagnostics)).state;
}

test("rule 4: a problem inside collapsed lines takes the wave line's place", () => {
  const state = withProblems([
    { line: 25, severity: "error" },
    { line: 45, severity: "warning" },
  ]);

  expect(problemPlaces(state, foldedBlockAt(state))).toMatchObject([
    { top: 10 * LINE_PX, bottom: 11 * LINE_PX, kind: "error" },
    { top: 15 * LINE_PX, bottom: 16 * LINE_PX, kind: "warning" },
  ]);
});

test("rule 3: a side marks exactly what it tints: waiting there, in its tone; applied, ignored and other-side changes none", async () => {
  const rows = await magicRows();

  expect(marked(changePlaces(rows, "left"))).toEqual([
    [0, "modified", 2 * LINE_PX],
    [1, "modified", 21 * LINE_PX],
    [2, "modified", 53 * LINE_PX],
    [7, "modified", 114 * LINE_PX],
  ]);
  expect(marked(changePlaces(rows, "right"))).toEqual([
    [3, "inserted", 86 * LINE_PX],
    [4, "inserted", 97 * LINE_PX],
    [6, "modified", 119 * LINE_PX],
    [8, "conflict", 140 * LINE_PX],
  ]);
});

test("rule 3: the Result marks each change with a side waiting, none once resolved, one per problem, hint as info", async () => {
  const rows = await magicRows();
  const state = withProblems([
    { line: 3, severity: "hint" },
    { line: 5, severity: "info" },
  ]);

  expect(marked(changePlaces(rows, "center")).map(([id, kind]) => [id, kind])).toEqual([
    [0, "modified"],
    [1, "modified"],
    [2, "modified"],
    [3, "inserted"],
    [4, "inserted"],
    [6, "modified"],
    [7, "modified"],
    [8, "conflict"],
  ]);
  expect(marked(problemPlaces(state, foldedBlockAt(state)))).toEqual([
    ["problem", "info", 2 * LINE_PX],
    ["problem", "info", 4 * LINE_PX],
  ]);
});

test("rule 3: errors above changes above warnings above info", () => {
  const painted = ticks(
    [
      place(100, 120, "error"),
      place(300, 320, "conflict"),
      place(200, 220, "info"),
      place(50, 70, "warning"),
      place(0, 20, "inserted"),
    ],
    OVERLAY,
  );

  expect(painted.map(({ kind }) => kind)).toEqual([
    "info",
    "warning",
    "inserted",
    "conflict",
    "error",
  ]);
});

function tick(top: number, height: number): Tick {
  return { top, height, kind: "modified", target: TARGET };
}

function pickedTop(shown: readonly Tick[], y: number): number | null {
  return tickAt(shown, y)?.top ?? null;
}

test("rule 5: within 4 px picks the tick, the nearest top wins among overlaps, farther picks none", () => {
  const shown = [tick(100, 2), tick(103, 40), tick(300, 2)];

  expect(pickedTop(shown, 101)).toBe(100);
  expect(pickedTop(shown, 96)).toBe(100);
  expect(pickedTop(shown, 104)).toBe(103);
  expect(pickedTop(shown, 140)).toBe(103);
  expect(pickedTop(shown, 306)).toBe(300);
  expect(pickedTop(shown, 307)).toBeNull();
  expect(pickedTop(shown, 295)).toBeNull();
  expect(pickedTop(shown, 200)).toBeNull();
});
