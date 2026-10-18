import {
  indentLess,
  indentMore,
  redo,
  selectParentSyntax,
  undo,
  undoDepth,
  undoSelection,
} from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree, type Language } from "@codemirror/language";
import { Text, type EditorState, type StateCommand } from "@codemirror/state";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { highlightTree, tags, type Tag } from "@lezer/highlight";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, parseKey, type Key, type KeyBindings } from "../../ipc";
import { chunkField } from "./chunkField";
import { sideDecorations } from "./decorations";
import { languageOf } from "./language";
import {
  languageCompartment,
  paletteHighlight,
  SYNTAX_COLOURS,
  syntaxColourClasses,
  paneState,
  preferenceEffects,
  refuseNativeHistory,
  type PaneSettings,
} from "./pane";
import { paneDocs } from "./paneDocs";
import { sideStatusField } from "./sideStatus";

const PARSE_BUDGET_MS = 5000;
const COLOUR = /(?:^|[{ ])color: ([^;]+);/;
const LINUX = "Linux x86_64";
const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: LINUX,
};

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

function lines(text: string): Text {
  return Text.of(text.split("\n"));
}

function center(doc: string, language: Language | null, settings = SETTINGS): EditorState {
  return paneState({
    kind: "center",
    doc: lines(doc),
    eol: "Lf",
    language,
    settings,
    extensions: [],
  });
}

function key(text: string): Key {
  const parsed = parseKey(text);
  if (parsed === null) {
    throw new Error(`${text} does not parse`);
  }
  return parsed;
}

function withKeys(keys: Partial<KeyBindings>): PaneSettings {
  return { preferences: { theme: "dark", keys: { ...DEFAULT_KEYS, ...keys } }, platform: LINUX };
}

// CodeMirror runs the commands bound to a key in the keymap facet's order (precedence first) until
// one returns true (@codemirror/view keymap.ts buildKeymap, runHandlers).
function bindingsOn(state: EditorState, name: string): KeyBinding[] {
  return state
    .facet(keymap)
    .flat()
    .filter((binding) => (binding.linux ?? binding.key) === name)
    .filter(({ scope }) => scope === undefined || scope.split(" ").includes("editor"));
}

function commandsOn(state: EditorState, name: string): unknown[] {
  return bindingsOn(state, name).map(({ run: command }) => command);
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
  const data = await loadFixture("selection.ts", {
    "selection.json": {
      path: "selection.ts",
      deleted: null,
      middle: { kind: "Stages", text: "const a = old;\n" },
      local: "const a = mine;\n",
      remote: "const a = theirs;\n",
      eol: "Lf",
      disk_version: 0,
      chunks: [
        {
          chunk: { id: 0, kind: "Conflict", base: line, local: line, remote: line },
          middle: line,
          words: {
            chunk: 0,
            local: { changed: [{ line: 0, start: 10, len: 4 }], removals: [] },
            remote: { changed: [{ line: 0, start: 10, len: 6 }], removals: [] },
          },
          waiting: {
            kind: "Markers",
            open: "<<<<<<< ours",
            between: ["======="],
            close: ">>>>>>> theirs",
          },
        },
      ],
    },
  });
  const statuses = sideStatusField(
    data.chunks.map((chunk) => ({ chunk, status: { local: "pending", remote: "pending" } })),
  );
  return paneState({
    kind: "side",
    doc: paneDocs(data).left,
    eol: data.eol,
    language: null,
    settings: SETTINGS,
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
  const data = await loadFixture("vue-core-playground-app.vue");
  const field = chunkField(data.chunks);
  const plain = paneState({
    kind: "center",
    doc: paneDocs(data).center,
    eol: data.eol,
    language: null,
    settings: SETTINGS,
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

test("the middle pane binds Undo, Redo, Indent and Outdent once each, from the defaults", () => {
  const state = center(PHP, null);

  expect(commandsOn(state, "Mod-z")).toEqual([undo]);
  expect(commandsOn(state, "Mod-Shift-z")).toEqual([redo]);
  expect(commandsOn(state, "Mod-y")).toEqual([redo]);
  expect(commandsOn(state, "Ctrl-Shift-z")).toEqual([]);
  expect(commandsOn(state, "Tab")).toEqual([indentMore]);
  expect(commandsOn(state, "Shift-Tab")).toEqual([indentLess]);
});

test("Indent on Mod-i runs before the default keymap's selectParentSyntax", () => {
  const state = center(PHP, null, withKeys({ indent: [key("Mod-i")] }));

  expect(commandsOn(state, "Mod-i")).toEqual([indentMore, selectParentSyntax]);
});

test("Undo on Alt-Backspace: Mod-z does nothing in the middle, Mod-u still undoes the selection", () => {
  const state = center(PHP, null, withKeys({ undo: [key("Alt-Backspace")] }));

  expect(commandsOn(state, "Mod-z")).toEqual([]);
  expect(commandsOn(state, "Alt-Backspace")).toEqual([undo]);
  expect(commandsOn(state, "Mod-u")).toEqual([undoSelection]);
});

test("Indent without keys: Tab indents nothing in the middle", () => {
  const state = center(PHP, null, withKeys({ indent: [] }));

  expect(commandsOn(state, "Tab")).toEqual([]);
  expect(commandsOn(state, "Shift-Tab")).toEqual([indentLess]);
});

test("CodeMirror's dark flag follows the theme", () => {
  const light: PaneSettings = { ...SETTINGS, preferences: { theme: "light", keys: DEFAULT_KEYS } };

  expect(center(PHP, null).facet(EditorView.darkTheme)).toBe(true);
  expect(center(PHP, null, light).facet(EditorView.darkTheme)).toBe(false);
});

test("the browser's own undo and redo are refused in the middle; other input passes through", () => {
  const prevented: string[] = [];
  function input(inputType: string): boolean {
    return refuseNativeHistory({
      inputType,
      preventDefault: () => {
        prevented.push(inputType);
      },
    });
  }

  expect(["historyUndo", "historyRedo", "insertText", "deleteContentBackward"].map(input)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect(prevented).toEqual(["historyUndo", "historyRedo"]);
});

test("a read-only Result pane leaves Tab to the browser: Indent refuses and nothing prevents the key", () => {
  const state = paneState({
    kind: "readOnlyCenter",
    doc: lines(PHP),
    eol: "Lf",
    language: null,
    settings: SETTINGS,
    extensions: [],
  });
  const tab = bindingsOn(state, "Tab");

  expect(tab.map(({ run: command }) => command)).toEqual([indentMore]);
  expect(tab.some(({ preventDefault }) => preventDefault === true)).toBe(false);
  expect(indentMore({ state, dispatch: () => undefined })).toBe(false);
  expect(bindingsOn(state, "Mod-z").map(({ preventDefault }) => preventDefault)).toEqual([true]);
});

test("new preferences turn the middle light, move its Undo and rebind its find keys", () => {
  const changed = withKeys({ undo: [key("Alt-Backspace")], "close-find": [key("F10")] });
  const light: PaneSettings = {
    ...changed,
    preferences: { ...changed.preferences, theme: "light" },
  };

  const state = center(PHP, null).update({ effects: preferenceEffects("center", light) }).state;

  expect(state.facet(EditorView.darkTheme)).toBe(false);
  expect(commandsOn(state, "Mod-z")).toEqual([]);
  expect(commandsOn(state, "Alt-Backspace")).toEqual([undo]);
  expect(commandsOn(state, "F10")).toHaveLength(1);
});

test("new preferences turn a side light, rebind its Apply and its find keys", () => {
  const changed = withKeys({ apply: [key("a")], "close-find": [key("F10")] });
  const light: PaneSettings = {
    ...changed,
    preferences: { ...changed.preferences, theme: "light" },
  };
  const before = paneState({
    kind: "side",
    doc: lines(PHP),
    eol: "Lf",
    language: null,
    settings: SETTINGS,
    extensions: [],
  });

  const state = before.update({ effects: preferenceEffects("side", light) }).state;

  expect(before.facet(EditorView.darkTheme)).toBe(true);
  expect(state.facet(EditorView.darkTheme)).toBe(false);
  expect(commandsOn(before, "a")).toEqual([]);
  expect(commandsOn(state, "a")).toHaveLength(1);
  expect(commandsOn(state, "Enter")).toEqual([]);
  expect(commandsOn(state, "F10")).toHaveLength(1);
  expect(commandsOn(state, "Escape")).toEqual([]);
});

function ruleOf(tag: Tag): string | null {
  const classes = paletteHighlight.style([tag]) ?? "";
  const rules = paletteHighlight.module?.getRules().split("\n") ?? [];
  const rule = rules.find((line) => line.startsWith(`.${classes} {`));
  return rule === undefined ? null : rule.slice(rule.indexOf("{") + 1, -1);
}

test("the pane's highlight styles every tag as before the syntax table", () => {
  const keyword = "color: var(--color-syntax-keyword);";
  const string = "color: var(--color-syntax-string);";
  const styled: readonly (readonly [Tag, string])[] = [
    [tags.keyword, keyword],
    [tags.bool, keyword],
    [tags.null, keyword],
    [tags.self, keyword],
    [tags.atom, keyword],
    [tags.string, string],
    [tags.special(tags.string), string],
    [tags.number, "color: var(--color-syntax-number);"],
    [tags.comment, "color: var(--color-syntax-comment);"],
    [tags.function(tags.variableName), "color: var(--color-syntax-function);"],
    [tags.function(tags.propertyName), "color: var(--color-syntax-function);"],
    [tags.propertyName, "color: var(--color-syntax-property);"],
    [tags.constant(tags.variableName), "color: var(--color-syntax-property);"],
    [tags.meta, "color: var(--color-syntax-decorator);"],
    [tags.tagName, "color: var(--color-syntax-tag);"],
    [tags.angleBracket, "color: var(--color-syntax-tag);"],
    [tags.attributeValue, string],
    [tags.escape, keyword],
    [tags.regexp, "color: var(--color-syntax-regexp);"],
    [tags.link, "color: var(--color-syntax-link);"],
    [tags.url, "color: var(--color-syntax-link);"],
    [tags.heading, "font-weight: bold;"],
    [tags.strong, "font-weight: bold;"],
    [tags.emphasis, "font-style: italic;"],
    [tags.strikethrough, "text-decoration: line-through;"],
  ];

  expect(styled.map(([tag]) => ruleOf(tag))).toEqual(styled.map(([, rule]) => rule));
});

test("the minimap classes and the pane's highlight give each tag the same token", () => {
  const probed: readonly Tag[] = [
    ...SYNTAX_COLOURS.flatMap(({ tag }) => [tag].flat()),
    tags.controlKeyword,
    tags.docComment,
    tags.definition(tags.propertyName),
    tags.variableName,
    tags.heading,
  ];

  expect(probed.map((tag) => syntaxColourClasses.style([tag]))).toEqual(
    probed.map((tag) => /var\(([^)]+)\)/.exec(ruleOf(tag) ?? "")?.[1] ?? null),
  );
});
