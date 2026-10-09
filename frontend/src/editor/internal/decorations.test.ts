import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { createFixtureSource, log, type Chunk, type FileMergeData } from "../../ipc";
import { chunkField } from "./chunkField";
import { centerDecorations, sideDecorations } from "./decorations";
import type { Side } from "./side";
import { showStatuses, sideStatusField } from "./sideStatus";
import type { ChunkState } from "./status";

function sideBands(chunks: readonly Chunk[], side: Side): Extension {
  const statuses = sideStatusField(chunks.map((chunk) => ({ chunk, status: "pending" })));
  return [statuses, sideDecorations(statuses, side)];
}

function decoratedRuns(doc: string, extension: Extension): string[] {
  return runsOf(EditorState.create({ doc, extensions: extension }));
}

function runsOf(state: EditorState): string[] {
  const lines: { line: number; classes: string }[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source === "function") {
      continue;
    }
    source.between(0, state.doc.length, (from, _to, decoration) => {
      lines.push({ line: state.doc.lineAt(from).number, classes: String(decoration.spec.class) });
    });
  }
  const runs: { first: number; last: number; classes: string }[] = [];
  for (const { line, classes } of lines) {
    const previous = runs.at(-1);
    if (previous?.classes === classes && previous.last + 1 === line) {
      previous.last = line;
    } else {
      runs.push({ first: line, last: line, classes });
    }
  }
  return runs.map(({ first, last, classes }) =>
    first === last ? `${first} ${classes}` : `${first}-${last} ${classes}`,
  );
}

async function synthetic(
  texts: { base: string; local: string; remote: string },
  chunks: readonly {
    kind: Chunk["kind"];
    base: [start: number, len: number];
    local: [start: number, len: number];
    remote: [start: number, len: number];
  }[],
): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    ...texts,
    eol: "Lf",
    chunks: chunks.map(({ kind, base, local, remote }, id) => ({
      id,
      kind,
      base: { start: base[0], len: base[1] },
      local: { start: local[0], len: local[1] },
      remote: { start: remote[0], len: remote[1] },
    })),
  };
  return createFixtureSource(log, { "synthetic.json": record }).loadFile("synthetic.ts");
}

test("vueuse-use-magic-keys: each pane colours the chunks its side changed, by tone", async () => {
  const data = await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);

  expect(decoratedRuns(data.local, sideBands(data.chunks, "local"))).toEqual([
    "3 chunk-modified chunk-band",
    "22 chunk-modified chunk-band",
    "54 chunk-modified chunk-band",
    "103-107 chunk-modified chunk-band",
    "115 chunk-modified chunk-band",
    "129-136 chunk-conflict chunk-band",
  ]);
  expect(decoratedRuns(data.remote, sideBands(data.chunks, "remote"))).toEqual([
    "87 chunk-inserted chunk-band",
    "98-106 chunk-inserted chunk-band",
    "120-123 chunk-modified chunk-band",
    "141-154 chunk-conflict chunk-band",
  ]);
  expect(decoratedRuns(data.base, [field, centerDecorations(field)])).toEqual([
    "3 chunk-modified chunk-band",
    "22 chunk-modified chunk-band",
    "54 chunk-modified chunk-band",
    "87 chunk-marker-inserted chunk-point-above",
    "97 chunk-marker-inserted chunk-point-above",
    "103-107 chunk-modified chunk-band",
    "110-111 chunk-modified chunk-band",
    "115 chunk-modified chunk-band",
    "129-138 chunk-conflict chunk-band",
  ]);
});

test("a side pane drops a resolved change's band and keeps a half-applied conflict", async () => {
  const data = await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts");
  const statuses = sideStatusField(data.chunks.map((chunk) => ({ chunk, status: "pending" })));
  const state = EditorState.create({
    doc: data.local,
    extensions: [statuses, sideDecorations(statuses, "local")],
  });
  const reported = data.chunks.map((chunk) => ({
    chunk,
    status: chunk.id === 0 || chunk.kind === "Conflict" ? "applied-local" : "pending",
  })) satisfies ChunkState[];

  const updated = state.update({ effects: showStatuses.of(reported) }).state;

  expect(runsOf(updated)).toEqual([
    "22 chunk-modified chunk-band",
    "54 chunk-modified chunk-band",
    "103-107 chunk-modified chunk-band",
    "115 chunk-modified chunk-band",
    "129-136 chunk-conflict chunk-band",
  ]);
});

test("center colours follow their text when a line is typed above them", async () => {
  const data = await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);
  const state = EditorState.create({
    doc: data.base,
    extensions: [field, centerDecorations(field)],
  });

  const typed = state.update({ changes: { from: state.doc.line(1).to, insert: "\n// typed" } });

  expect(runsOf(typed.state).slice(0, 2)).toEqual([
    "4 chunk-modified chunk-band",
    "23 chunk-modified chunk-band",
  ]);
});

test("an empty range at the end of an unterminated last line is drawn below that line", async () => {
  const data = await synthetic({ base: "a\nb", local: "a\nb\nc", remote: "a\nb" }, [
    { kind: "LocalOnly", base: [2, 0], local: [2, 1], remote: [2, 0] },
  ]);
  const field = chunkField(data.chunks);

  expect(decoratedRuns(data.base, [field, centerDecorations(field)])).toEqual([
    "2 chunk-marker-inserted chunk-point-below",
  ]);
  expect(decoratedRuns(data.local, sideBands(data.chunks, "local"))).toEqual([
    "3 chunk-inserted chunk-band",
  ]);
});

test("a marker on another chunk's band line keeps its own tone class", async () => {
  const data = await synthetic({ base: "a\nb\n", local: "a\nx\nb\n", remote: "y\nb\n" }, [
    { kind: "Conflict", base: [0, 1], local: [0, 1], remote: [0, 1] },
    { kind: "LocalOnly", base: [1, 0], local: [1, 1], remote: [1, 0] },
  ]);
  const field = chunkField(data.chunks);
  const state = EditorState.create({
    doc: data.base,
    extensions: [field, centerDecorations(field)],
  });

  const joined = state.update({ changes: { from: 1, to: 2 } });

  expect(runsOf(joined.state)).toEqual([
    "1 chunk-conflict chunk-band",
    "1 chunk-marker-inserted chunk-point-below",
  ]);
});

test("a line break pasted at the end of a band line stops at the marker that follows it", async () => {
  const data = await synthetic({ base: "a\nb\n", local: "a\nx\nb\n", remote: "y\nb\n" }, [
    { kind: "Conflict", base: [0, 1], local: [0, 1], remote: [0, 1] },
    { kind: "LocalOnly", base: [1, 0], local: [1, 1], remote: [1, 0] },
  ]);
  const field = chunkField(data.chunks);
  const joined = EditorState.create({
    doc: data.base,
    extensions: [field, centerDecorations(field)],
  }).update({ changes: { from: 1, to: 2 } }).state;

  const pasted = joined.update({ changes: { from: 1, insert: "\n  x" } }).state;

  expect(pasted.field(field).map((span) => [span.from, span.to])).toEqual([
    [0, 1],
    [1, 1],
  ]);
  expect(runsOf(pasted)).toEqual([
    "1 chunk-conflict chunk-band",
    "1 chunk-marker-inserted chunk-point-below",
  ]);
});

test("random edits keep center ranges sorted, disjoint, inside the document, and drawable", async () => {
  const data = await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);
  let state = EditorState.create({ doc: data.base, extensions: [field, centerDecorations(field)] });
  let seed = 7;
  function random(below: number): number {
    seed = (seed * 48_271) % 2_147_483_647;
    return seed % below;
  }

  for (let step = 0; step < 200; step += 1) {
    const spans = state.field(field);
    const anchor = spans[random(spans.length)];
    const near = anchor === undefined ? 0 : ([anchor.from, anchor.to][random(2)] ?? 0);
    const from = Math.max(0, Math.min(state.doc.length, near + random(9) - 4));
    const to = random(2) === 0 ? from : Math.min(state.doc.length, from + random(40));
    const insert = Array.from({ length: random(6) }, () => "ab\n"[random(3)]).join("");
    state = state.update({ changes: { from, to, insert } }).state;

    const after = state.field(field);
    const broken = after.filter(
      (span, index) =>
        span.from > span.to ||
        span.to > state.doc.length ||
        span.to > (after[index + 1]?.from ?? state.doc.length),
    );
    expect({ step, broken }).toEqual({ step, broken: [] });
    expect(() => runsOf(state)).not.toThrow();
  }
});

test("a RemoteOnly deletion: center band and right marker are deleted, left is bare", async () => {
  const data = await synthetic({ base: "a\nb\nc\n", local: "a\nb\nc\n", remote: "c\n" }, [
    { kind: "RemoteOnly", base: [0, 2], local: [0, 2], remote: [0, 0] },
  ]);
  const field = chunkField(data.chunks);

  expect(decoratedRuns(data.base, [field, centerDecorations(field)])).toEqual([
    "1-2 chunk-deleted chunk-band",
  ]);
  expect(decoratedRuns(data.remote, sideBands(data.chunks, "remote"))).toEqual([
    "1 chunk-marker-deleted chunk-point-above",
  ]);
  expect(decoratedRuns(data.local, sideBands(data.chunks, "local"))).toEqual([]);
});
