import "@fontsource/jetbrains-mono/400.css";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

type PaneKind = "side" | "center";

const LANGUAGES: Readonly<Record<string, () => Extension>> = {
  typescript: () => javascript({ typescript: true }),
};

const darkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-editor)",
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
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "var(--color-selection)" },
    ".cm-activeLine": { backgroundColor: "var(--color-active-line)" },
    ".cm-gutters": {
      backgroundColor: "var(--color-editor)",
      color: "var(--color-gutter)",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color-active-line)",
      color: "var(--color-gutter-active)",
    },
  },
  { dark: true },
);

const paletteHighlight = HighlightStyle.define([
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
]);

function kindExtensions(kind: PaneKind): Extension {
  switch (kind) {
    case "side":
      return [EditorState.readOnly.of(true), EditorView.editable.of(false)];
    case "center":
      return [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        highlightActiveLine(),
        highlightActiveLineGutter(),
      ];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function createPane(pane: {
  kind: PaneKind;
  doc: string;
  language: string | null;
  parent: HTMLElement;
}): EditorView {
  const languageExtension =
    pane.language !== null && Object.hasOwn(LANGUAGES, pane.language)
      ? LANGUAGES[pane.language]
      : undefined;
  const state = EditorState.create({
    doc: pane.doc,
    extensions: [
      lineNumbers(),
      drawSelection(),
      darkTheme,
      syntaxHighlighting(paletteHighlight),
      languageExtension?.() ?? [],
      kindExtensions(pane.kind),
    ],
  });
  return new EditorView({ state, parent: pane.parent });
}
