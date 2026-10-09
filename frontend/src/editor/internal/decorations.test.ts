import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { createFixtureSource, log } from "../../ipc";
import { chunkField } from "./chunkField";
import { centerDecorations, sideDecorations } from "./decorations";

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

test("vueuse-use-magic-keys: each pane colours the chunks its side changed, by tone", async () => {
  const data = await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts");
  const field = chunkField(data.chunks);

  expect(decoratedRuns(data.local, sideDecorations(data.chunks, "local"))).toEqual([
    "3 chunk-modified chunk-band",
    "22 chunk-modified chunk-band",
    "54 chunk-modified chunk-band",
    "103-107 chunk-modified chunk-band",
    "115 chunk-modified chunk-band",
    "129-136 chunk-conflict chunk-band",
  ]);
  expect(decoratedRuns(data.remote, sideDecorations(data.chunks, "remote"))).toEqual([
    "87 chunk-inserted chunk-band",
    "98-106 chunk-inserted chunk-band",
    "120-123 chunk-modified chunk-band",
    "141-154 chunk-conflict chunk-band",
  ]);
  expect(decoratedRuns(data.base, [field, centerDecorations(field)])).toEqual([
    "3 chunk-modified chunk-band",
    "22 chunk-modified chunk-band",
    "54 chunk-modified chunk-band",
    "87 chunk-inserted chunk-gap-above",
    "97 chunk-inserted chunk-gap-above",
    "103-107 chunk-modified chunk-band",
    "110-111 chunk-modified chunk-band",
    "115 chunk-modified chunk-band",
    "129-138 chunk-conflict chunk-band",
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
  const record = {
    path: "synthetic.ts",
    base: "a\nb",
    local: "a\nb\nc",
    remote: "a\nb",
    eol: "Lf",
    language: null,
    chunks: [
      {
        id: 0,
        kind: "LocalOnly",
        base: { start: 2, len: 0 },
        local: { start: 2, len: 1 },
        remote: { start: 2, len: 0 },
      },
    ],
  };
  const data = await createFixtureSource(log, { "synthetic.json": record }).loadFile(
    "synthetic.ts",
  );
  const field = chunkField(data.chunks);

  expect(decoratedRuns(data.base, [field, centerDecorations(field)])).toEqual([
    "2 chunk-inserted chunk-gap-below",
  ]);
  expect(decoratedRuns(data.local, sideDecorations(data.chunks, "local"))).toEqual([
    "3 chunk-inserted chunk-band",
  ]);
});
