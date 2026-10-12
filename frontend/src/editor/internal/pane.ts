import "@fontsource/jetbrains-mono/400.css";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  type Language,
} from "@codemirror/language";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

import type { FileMergeData } from "../../ipc";
import { find } from "./find";
import { indentUnitOf } from "./indent";

type PaneKind = "side" | "center" | "readOnlyCenter";

export const languageCompartment = new Compartment();

const darkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-panel)",
      color: "var(--color-code)",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      fontVariantLigatures: "none",
      lineHeight: "1.4",
    },
    ".cm-content": { caretColor: "var(--color-caret)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-caret)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection, .selected-text":
      { backgroundColor: "var(--color-selection)" },
    ".cm-activeLine": { backgroundColor: "var(--color-active-line)" },
    ".cm-gutters": {
      backgroundColor: "var(--color-panel)",
      color: "var(--color-gutter)",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color-active-line)",
      color: "var(--color-gutter-active)",
    },
    ".cm-panels": { backgroundColor: "var(--color-panel-inline)", color: "var(--color-fg)" },
    ".cm-searchMatch": { backgroundColor: "var(--color-search-match)" },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--color-selection)",
      outline: "1px solid var(--color-primary)",
    },
  },
  { dark: true },
);

export const paletteHighlight = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.bool, tags.null, tags.self, tags.atom],
    color: "var(--color-syntax-keyword)",
  },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-syntax-string)" },
  { tag: tags.number, color: "var(--color-syntax-number)" },
  { tag: tags.comment, color: "var(--color-syntax-comment)" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--color-syntax-function)",
  },
  {
    tag: [tags.propertyName, tags.constant(tags.variableName)],
    color: "var(--color-syntax-property)",
  },
  { tag: tags.meta, color: "var(--color-syntax-decorator)" },
  { tag: [tags.tagName, tags.angleBracket], color: "var(--color-syntax-tag)" },
  { tag: tags.attributeValue, color: "var(--color-syntax-string)" },
  { tag: tags.escape, color: "var(--color-syntax-keyword)" },
  { tag: tags.regexp, color: "var(--color-syntax-regexp)" },
  { tag: [tags.link, tags.url], color: "var(--color-syntax-link)" },
  { tag: [tags.heading, tags.strong], fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
]);

const selectedText = Decoration.mark({ class: "selected-text" });

// drawSelection paints behind every line background (@codemirror/view LayerView.setZIndex: z-index -1);
// the highest-precedence mark is the innermost span, so it covers block and word tints under the text.
const selectionOverTints = Prec.highest(
  EditorView.decorations.compute(["selection"], (state) =>
    Decoration.set(
      state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => selectedText.range(range.from, range.to)),
    ),
  ),
);

const sideFocusOutline = EditorView.theme({
  "&.cm-focused": { outline: "1px solid var(--color-primary)", outlineOffset: "-1px" },
});

function centerExtensions(doc: string): Extension {
  return [
    history(),
    indentUnit.of(indentUnitOf(doc)),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    highlightActiveLine(),
    highlightActiveLineGutter(),
  ];
}

function kindExtensions(kind: PaneKind, doc: string): Extension {
  switch (kind) {
    case "side":
      return [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ tabindex: "0" }),
        sideFocusOutline,
      ];
    case "center":
      return centerExtensions(doc);
    case "readOnlyCenter":
      return [centerExtensions(doc), EditorState.readOnly.of(true)];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function paneState(pane: {
  kind: PaneKind;
  doc: string;
  eol: FileMergeData["eol"];
  language: Language | null;
  extensions: Extension;
}): EditorState {
  return EditorState.create({
    doc: pane.doc,
    extensions: [
      lineNumbers(),
      pane.eol === "CrLf" ? EditorState.lineSeparator.of("\r\n") : [],
      drawSelection(),
      selectionOverTints,
      darkTheme,
      syntaxHighlighting(paletteHighlight),
      languageCompartment.of(pane.language ?? []),
      find,
      kindExtensions(pane.kind, pane.doc),
      pane.extensions,
    ],
  });
}

export function createPane(
  pane: Parameters<typeof paneState>[0] & { parent: HTMLElement },
): EditorView {
  return new EditorView({ state: paneState(pane), parent: pane.parent });
}

export function paneText(state: EditorState): string {
  return state.sliceDoc();
}

type CenterPane = { readonly kind: "center" | "readOnlyCenter"; readonly doc: string };

export function centerPane(middle: FileMergeData["middle"], readOnly: boolean): CenterPane {
  return {
    kind: readOnly ? "readOnlyCenter" : "center",
    doc: middle.kind === "DiskNotText" ? "" : middle.text,
  };
}
