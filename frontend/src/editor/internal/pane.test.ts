import { undoDepth } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree, type Language } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";
import { expect, test } from "vitest";

import { createFixtureSource, log } from "../../ipc";
import { chunkField } from "./chunkField";
import { languageOf } from "./language";
import { languageCompartment, paletteHighlight, paneState } from "./pane";

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
