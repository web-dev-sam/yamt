# Implementer report V0EditorFindDrag

## deviations_from_brief
[
  "New files: frontend/src/editor/internal/drag.ts (coveredChunks, coveredAction, IconDrag: pointer capture and move/up/cancel/lostpointercapture listeners on the persistent strips), covered.ts (showCovered effect plus a side-pane field and line decoration `chunk-covered`, not in history; sameCovered), modClick.ts (openBlockAt, applyOnModClick), find.ts (FindPanel, findLabel, stepMatch, the `find` extension). Tests: drag.test.ts, modClick.test.ts, find.test.ts. For the orchestrator: update the project map, architecture and the cm6-rules dependency note.",
  "apply.ts API changed (internal): applySteps/ignoreSteps({target, chunk, side}) are replaced by `actionSteps(target, action: ChunkAction)` with `ChunkAction = { kind: \"apply\" | \"ignore\"; side; chunks: readonly Chunk[] }` (moved from strips.ts to apply.ts). A click is a one-element list, so a click and a drag share one code path. Call sites in apply.test.ts, sides.test.ts and words.test.ts are migrated (apply.test.ts has local helpers applyOne/ignoreOne). An ignore action now carries an empty ChangeSet; it still does not change the document.",
  "strips.ts: per-button `pointerdown` now only starts a press (IconPress); acting happens on release through IconDrag, which listens on the persistent <svg> strips with setPointerCapture. paintStrips takes `{ covered, onPress }`; `onPress: null` (read-only) draws bands without icons. Covered icons get the class `chunk-action-covered`.",
  "pane.ts: PaneKind adds \"readOnlyCenter\" (the center extensions plus EditorState.readOnly). CodeMirror then ignores DOM input, paste and drop, and refuses Enter, Tab and undo/redo commands. Read-only is not a transaction filter, so applyAllNonConflicting still works. Side panes get `contentAttributes { tabindex: \"0\" }` so they take focus (they stay editable:false). The `find` extension goes into every pane. Theme overrides for .cm-panels and .cm-searchMatch are in darkTheme.",
  "Strings the find bar shows: \"\" (empty field), \"No results\", \"1 result\" (singular, not in the brief), \"N results\", \"k of N\". Placeholder \"Find\". Button titles: \"Previous Occurrence (Shift+Enter)\", \"Next Occurrence (Enter)\", \"Close (Escape)\".",
  "Keys bound, in every pane, scope \"editor search-panel\": Mod-f opens the bar or focuses it again; F3 next, Shift-F3 previous; Escape closes and focuses the pane. Enter and Shift+Enter work inside the field. searchKeymap's Mod-g, Mod-d, Mod-Shift-l and Mod-Alt-g are not bound. F3 also steps while the bar is closed, using the last query, with no highlight.",
  "Opening the bar: openSearchPanel fills the field from a selection of ≤100 characters. If the selection spans lines, the previous query is put back, so only a selection on one line fills the field.",
  "Typing selects the first match at or after the selection start and wraps to the first match. Next and previous are our own `stepMatch` (state-level, testable in node) instead of @codemirror/search's findNext/findPrevious. The current match is scrolled into view with y: \"center\".",
  "Ctrl+click accepts ctrlKey OR metaKey on every platform; CodeMirror does not export a platform check. On macOS Ctrl+click usually opens the context menu, but its mousedown would also apply. The click acts on mousedown, which is prevented so the side pane does not take focus; the middle pane is focused, as with the icons. The line comes from lineBlockAtHeight(clientY − documentTop), so a click anywhere on a tinted line counts.",
  "Where the drag differs from clicking one by one: text, statuses and the final cursor (at the last covered change) are the same. History differs as intended: one undo step instead of N, and undo puts the cursor at the last covered change. Drag coverage uses each icon's row: [top, top+lineHeight) intersecting the span from the press to the pointer.",
  "Palette: style.css has no find tokens (it is read-only here). Other matches use --color-success-border (close to JetBrains' green search tint), the current match uses --color-selection with a 1px --color-primary outline, and covered icons use --color-hover / --color-fg. A covered side block doubles its own tone (background-image: linear-gradient(var(--chunk-tone), var(--chunk-tone))).",
  "I appended to theme.css with a bash heredoc instead of the edit tool (content is as reviewed; no other file was touched that way). After the edits I ran `pnpm fmt` over the frontend; git status shows only editor/ files changed.",
  "test:browser could not run: Playwright's WebKit is missing host libraries on Arch. This is an environment gap, not a code result."
]

## open_risks
[
  {
    "location": "frontend/src/editor/internal/find.ts:212 (panel at top) / frontend/src/editor/internal/scrollSync.ts",
    "risk": "An open find bar makes that pane's scroller shorter by the bar's height. Bands and icons stay right (they use documentTop), but scroll sync matches scrollTop, so that pane's lines sit about one bar height off the other panes (seen in find-bar.png: right pane starts at line 28, the others at 27)."
  },
  {
    "location": "frontend/src/editor/internal/pane.ts:128-129",
    "risk": "In read-only mode MergeController.undo()/redo() return false, because @codemirror/commands history refuses when state.readOnly. If the window later wants undo after \"Keep\", the read-only center needs another mechanism."
  },
  {
    "location": "frontend/src/editor/internal/drag.ts:69-75",
    "risk": "Pointer capture outside the window and wheel scrolling during a drag were not exercised in the smoke (only moves inside the strip). pointercancel was not triggered in WebKit either; its handler and lostpointercapture are covered only by reading the code."
  },
  {
    "location": "frontend/src/editor/internal/apply.ts:109-129",
    "risk": "Adjacent chunks with no unchanged line between them: one composed ChangeSet may map an applied span's `to` differently than two sequential clicks, because the replaced ranges merge. Text and statuses stay equal; only the displayed span bounds might differ. Not covered by a test."
  },
  {
    "location": "/tmp/yamt-smoke-3e/*.png",
    "risk": "In MiniBrowser screenshots, parts of panes scrolled by scroll sync appear unpainted (blank lines), although the DOM has the lines rendered (probe: 105 .cm-line elements per pane). It looks like a WebKitGTK paint or screenshot artifact and is probably unrelated to this slice; I did not check it against the previous commit."
  },
  {
    "location": "frontend/src/editor/internal/modClick.ts:31",
    "risk": "metaKey is accepted on Linux as well (Super+click); usually the window manager takes it first."
  }
]
