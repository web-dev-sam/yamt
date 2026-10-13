import "@fontsource/jetbrains-mono/400.css";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  redo,
  redoSelection,
  undo,
  undoSelection,
} from "@codemirror/commands";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  type Language,
} from "@codemirror/language";
import {
  Compartment,
  EditorState,
  Prec,
  type Extension,
  type StateCommand,
  type StateEffect,
} from "@codemirror/state";
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

import type { FileMergeData, KeyAction, KeyBindings, Theme } from "../../ipc";
import { find, findKeys, findKeysCompartment } from "./find";
import { indentUnitOf } from "./indent";
import { cmKeys } from "./keys";
import { sideKeys } from "./sideKeys";

type PaneKind = "side" | "center" | "readOnlyCenter";

export type Preferences = { readonly theme: Theme; readonly keys: KeyBindings };

export type PaneSettings = { readonly preferences: Preferences; readonly platform: string };

export const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const middleKeysCompartment = new Compartment();
const sideKeysCompartment = new Compartment();

const MIDDLE_COMMANDS: readonly {
  readonly action: KeyAction;
  readonly run: StateCommand;
  readonly preventDefault: boolean;
}[] = [
  { action: "undo", run: undo, preventDefault: true },
  { action: "redo", run: redo, preventDefault: true },
  { action: "indent", run: indentMore, preventDefault: false },
  { action: "outdent", run: indentLess, preventDefault: false },
];

const selectionHistoryKeymap = historyKeymap.filter(
  ({ run }) => run === undoSelection || run === redoSelection,
);

const paneTheme = EditorView.theme({
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
});

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

function darkFlag(theme: Theme): Extension {
  return EditorView.darkTheme.of(theme === "dark");
}

function middleKeys(keys: KeyBindings, platform: string): Extension {
  return Prec.high(
    keymap.of(
      MIDDLE_COMMANDS.flatMap(({ action, run, preventDefault }) =>
        cmKeys(keys[action], platform).map((key) => ({ key, run, preventDefault })),
      ),
    ),
  );
}

export function preferenceEffects(
  kind: "side" | "center",
  { preferences, platform }: PaneSettings,
): StateEffect<unknown>[] {
  const { theme, keys } = preferences;
  const kindKeys =
    kind === "side"
      ? sideKeysCompartment.reconfigure(sideKeys(keys, platform))
      : middleKeysCompartment.reconfigure(middleKeys(keys, platform));
  return [
    themeCompartment.reconfigure(darkFlag(theme)),
    findKeysCompartment.reconfigure(findKeys(keys, platform)),
    kindKeys,
  ];
}

const HISTORY_INPUTS: Readonly<Record<string, true>> = { historyUndo: true, historyRedo: true };

// The browser's own undo (WebKit: Ctrl/Cmd+Z when no binding prevents the key) arrives as a
// beforeinput that history() turns into an undo (@codemirror/commands history(), dist/index.js:267-271);
// undo comes only from the bound keys and the toolbar.
export function refuseNativeHistory(
  event: Pick<InputEvent, "inputType" | "preventDefault">,
): boolean {
  if (!Object.hasOwn(HISTORY_INPUTS, event.inputType)) {
    return false;
  }
  event.preventDefault();
  return true;
}

const nativeHistoryBlocked = Prec.highest(
  EditorView.domEventHandlers({ beforeinput: refuseNativeHistory }),
);

function centerExtensions(doc: string, { preferences, platform }: PaneSettings): Extension {
  return [
    nativeHistoryBlocked,
    history(),
    indentUnit.of(indentUnitOf(doc)),
    middleKeysCompartment.of(middleKeys(preferences.keys, platform)),
    keymap.of([...defaultKeymap, ...selectionHistoryKeymap]),
    highlightActiveLine(),
    highlightActiveLineGutter(),
  ];
}

function kindExtensions(kind: PaneKind, doc: string, settings: PaneSettings): Extension {
  switch (kind) {
    case "side":
      return [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ tabindex: "0" }),
        sideFocusOutline,
        sideKeysCompartment.of(sideKeys(settings.preferences.keys, settings.platform)),
      ];
    case "center":
      return centerExtensions(doc, settings);
    case "readOnlyCenter":
      return [centerExtensions(doc, settings), EditorState.readOnly.of(true)];
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
  settings: PaneSettings;
  extensions: Extension;
}): EditorState {
  const { preferences, platform } = pane.settings;
  return EditorState.create({
    doc: pane.doc,
    extensions: [
      lineNumbers(),
      pane.eol === "CrLf" ? EditorState.lineSeparator.of("\r\n") : [],
      drawSelection(),
      selectionOverTints,
      paneTheme,
      themeCompartment.of(darkFlag(preferences.theme)),
      syntaxHighlighting(paletteHighlight),
      languageCompartment.of(pane.language ?? []),
      find,
      findKeysCompartment.of(findKeys(preferences.keys, platform)),
      kindExtensions(pane.kind, pane.doc, pane.settings),
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
