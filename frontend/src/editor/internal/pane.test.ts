import { indentLess, indentMore, undo, undoDepth } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree, type Language } from "@codemirror/language";
import type { EditorState, StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { highlightTree } from "@lezer/highlight";
import { expect, test } from "vitest";

import { createFixtureSource, log } from "../../ipc";
import { chunkField } from "./chunkField";
import { sideDecorations } from "./decorations";
import { languageOf } from "./language";
import { languageCompartment, paletteHighlight, paneState } from "./pane";
import { sideStatusField } from "./sideStatus";

const PARSE_BUDGET_MS = 5000;
const COLOUR = /(?:^|[{ ])color: ([^;]+);/;

const VUE_SFC = `<template>
  <div class="app">{{ msg }}</div>
</template>

<script setup lang="ts">
interface Props {}
const msg: string = "hi";
</script>
`;

const TSX = `export function App() {
  return <div className="app">hi</div>;
}
`;

const RUST = `fn initial() -> char {
    'a'
}
`;

const PHP = `<?php
/**
 * Greets.
 */
function greet($name)
{
    if ($name) {
        return "hi " . $name;
    }
  return "hi";
}
`;

const TABS = "func f() {\n\tif x {\n\t\treturn 1\n\t}\n\treturn 0\n}\n";

async function loaded(path: string): Promise<Language> {
  const description = languageOf(path);
  if (description === null) {
    throw new Error(`no language for ${path}`);
  }
  return (await description.load()).language;
}

function center(doc: string, language: Language | null): EditorState {
  return paneState({ kind: "center", doc, eol: "Lf", language, extensions: [] });
}

function run(command: StateCommand, state: EditorState): EditorState {
  let next = state;
  command({
    state,
    dispatch: (transaction) => {
      next = transaction.state;
    },
  });
  return next;
}

function selectLines(state: EditorState, first: number, last: number): EditorState {
  return state.update({
    selection: { anchor: state.doc.line(first).from, head: state.doc.line(last).to },
  }).state;
}

function linesOf(state: EditorState, first: number, last: number): string[] {
  return Array.from({ length: last - first + 1 }, (_, i) => state.doc.line(first + i).text);
}

function colourOf(classes: string): string | null {
  const rules = paletteHighlight.module?.getRules().split("\n") ?? [];
  for (const name of classes.split(" ")) {
    const rule = rules.find((line) => line.startsWith(`.${name} {`));
    const colour = rule === undefined ? null : COLOUR.exec(rule)?.[1];
    if (colour !== undefined && colour !== null) {
      return colour;
    }
  }
  return null;
}

function colourAt(state: EditorState, needle: string): string | null {
  const pos = state.doc.toString().indexOf(needle);
  expect(pos).toBeGreaterThanOrEqual(0);
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS) ?? syntaxTree(state);
  let colour: string | null = null;
  highlightTree(
    tree,
    paletteHighlight,
    (from, to, classes) => {
      if (from <= pos && pos < to) {
        colour = colourOf(classes);
      }
    },
    pos,
    pos + 1,
  );
  return colour;
}

async function tintedLeft(): Promise<EditorState> {
  const line = { start: 0, len: 1 };
  const data = await createFixtureSource(log, {
    "selection.json": {
      path: "selection.ts",
      base: "const a = old;\n",
      local: "const a = mine;\n",
      remote: "const a = theirs;\n",
      eol: "Lf",
      chunks: [{ id: 0, kind: "Conflict", base: line, local: line, remote: line }],
      word_changes: [
        {
          chunk: 0,
          local: { changed: [{ line: 0, start: 10, len: 4 }], removed_at: [] },
          remote: { changed: [{ line: 0, start: 10, len: 6 }], removed_at: [] },
        },
      ],
    },
  }).loadFile("selection.ts");
  const statuses = sideStatusField(
    data.chunks.map((chunk) => ({ chunk, status: { local: "pending", remote: "pending" } })),
  );
  return paneState({
    kind: "side",
    doc: data.local,
    eol: data.eol,
    language: null,
    extensions: [statuses, sideDecorations(statuses, "local")],
  });
}

function painted(state: EditorState): string[] {
  const found: string[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from, to, decoration) => {
        found.push(`${String(decoration.spec.class)} ${state.sliceDoc(from, to)}`.trimEnd());
      });
    }
  }
  return found;
}

test("a Vue file draws template tags in the tag colour and its script setup as TypeScript", async () => {
  const state = center(VUE_SFC, await loaded("App.vue"));

  expect(colourAt(state, "div")).toBe("var(--color-syntax-tag)");
  expect(colourAt(state, "interface")).toBe("var(--color-syntax-keyword)");
  expect(colourAt(state, "const")).toBe("var(--color-syntax-keyword)");
  expect(colourAt(state, '"hi"')).toBe("var(--color-syntax-string)");
});

test("a TSX file draws JSX tags in the tag colour", async () => {
  const state = center(TSX, await loaded("Provider.tsx"));

  expect(colourAt(state, "div")).toBe("var(--color-syntax-tag)");
  expect(colourAt(state, "return")).toBe("var(--color-syntax-keyword)");
});

test("a character literal is drawn in the string colour", async () => {
  const state = center(RUST, await loaded("lib.rs"));

  expect(colourAt(state, "'a'")).toBe("var(--color-syntax-string)");
});

test("recolouring the center pane adds no undo step and keeps the chunks", async () => {
  const data = await createFixtureSource(log).loadFile("vue-core-playground-app.vue");
  const field = chunkField(data.chunks);
  const plain = paneState({
    kind: "center",
    doc: data.base,
    eol: data.eol,
    language: null,
    extensions: [field],
  });
  expect(colourAt(plain, "<template>")).toBeNull();

  const coloured = plain.update({
    effects: languageCompartment.reconfigure(await loaded(data.path)),
  }).state;

  expect(colourAt(coloured, "<template>")).toBe("var(--color-syntax-tag)");
  expect(undoDepth(coloured)).toBe(0);
  expect(coloured.field(field)).toBe(plain.field(field));
  expect(coloured.doc).toBe(plain.doc);
});

test("a selection across a word mark is the innermost mark, drawn over block and word tints", async () => {
  const tinted = await tintedLeft();
  const line = tinted.doc.line(1);

  const selected = tinted.update({ selection: { anchor: line.from, head: line.to } }).state;

  expect(painted(selected)).toEqual([
    "selected-text const a = mine;",
    "chunk-conflict chunk-band",
    "chunk-word-conflict mine",
  ]);
});

test("Tab adds the file's four-space unit to each of three selected lines and Shift+Tab removes it", () => {
  const selected = selectLines(center(PHP, null), 7, 9);

  const indented = run(indentMore, selected);

  expect(linesOf(indented, 7, 9)).toEqual([
    "        if ($name) {",
    '            return "hi " . $name;',
    "        }",
  ]);
  expect(indented.sliceDoc(indented.selection.main.from, indented.selection.main.to)).toBe(
    selected
      .sliceDoc(selected.selection.main.from, selected.selection.main.to)
      .replaceAll("\n", "\n    "),
  );
  expect(run(indentLess, indented).doc.toString()).toBe(PHP);
});

test("Tab adds a tab to each selected line of a tab-indented file", () => {
  const indented = run(indentMore, selectLines(center(TABS, null), 2, 4));

  expect(linesOf(indented, 2, 4)).toEqual(["\t\tif x {", "\t\t\treturn 1", "\t\t}"]);
  expect(run(indentLess, indented).doc.toString()).toBe(TABS);
});

test("Shift+Tab on lines with less than one unit removes what is there", () => {
  const outdented = run(indentLess, selectLines(center(PHP, null), 3, 10));

  expect(linesOf(outdented, 3, 10)).toEqual([
    "* Greets.",
    "*/",
    "function greet($name)",
    "{",
    "if ($name) {",
    '    return "hi " . $name;',
    "}",
    'return "hi";',
  ]);
});

test("one undo takes back a whole Tab on three lines", () => {
  const indented = run(indentMore, selectLines(center(PHP, null), 7, 9));

  expect(undoDepth(indented)).toBe(1);
  expect(run(undo, indented).doc.toString()).toBe(PHP);
});
