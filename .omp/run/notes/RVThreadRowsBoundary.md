```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": null,
      "file": "frontend/src/editor/internal/threadHosts.ts",
      "line": 141,
      "problem": "The patch only forgets the remembered field on a `focusin` (`#focusIn`), and the implementer lists this as an open risk. Suppose a user leaves a thread's text box by clicking somewhere that cannot take focus, so focus goes to `<body>` in WebKit. If they then scroll the row out and back, or a `showThreads` rebuilds the row, `addCell` and `restoreFocus` (111) put focus back in that text box. The keys the user types next then go into the comment, not to the window.",
      "fix": "Clear `#focused` in a capturing document `pointerdown` listener whenever the press is outside every host. Remove that listener in `destroy()` next to the `focusin` one. A detach caused by scrolling then still restores focus, but a field the user left does not."
    },
    {
      "severity": "block",
      "rule_id": "principles §3 / review-protocol growth check (copied decision)",
      "file": "frontend/src/editor/internal/threadNumbers.ts",
      "line": 21,
      "problem": "The rule for which column a `ThreadLine` shows in (removed or unchangedOnLeft → left, added or unchangedOnRight → right) is now written twice: as `shownColumn` in ipc/threadLine.ts:11 and again as `lineInShownColumn`, and `lineCounts` (40–42) calls both. Rows 20–21 need the same line-in-its-column answer for the list counts and the box header, and they can only copy it a third time, because `editor/internal` is fenced off from ui.",
      "fix": "Add `shownLine(line): { column: Column; line: number }` to ipc/threadLine.ts as the one exhaustive switch, define `shownColumn` as `shownLine(line).column`, export it from ipc/index.ts, and delete `lineInShownColumn` so `lineCounts` reads both values from one call."
    },
    {
      "severity": "should",
      "rule_id": "principles §2",
      "file": "frontend/src/editor/range.ts",
      "line": 66,
      "problem": "`ThreadHosts` is built before the views, so it holds a `() => ThreadViews` getter (threadHosts.ts:21) and needs a second setup step, `watchColumns()` (range.ts:80). It does not need to be built first: the views reach their cells only through the `showThreadRows` payload, and `updated` never runs during construction. Every later reader has to trace a thunk and a two-phase setup that do nothing.",
      "fix": "Build `ThreadHosts` after `createReadOnlyColumnViews`, pass it `views: this.#views` directly, and observe the scrollers and gutters in its constructor. This removes the getter and `watchColumns`."
    },
    {
      "severity": "should",
      "rule_id": "slice contract (\"fixed; you may add, never change\")",
      "file": "frontend/src/editor/range.ts",
      "line": 41,
      "problem": "`events: RangeEvents = NO_EVENTS` turns the contract's required fourth argument into a fallback that silently does nothing. A caller that forgets `events` still compiles, and line-number presses then do nothing. If row 20 does not remove the default, it stays as a second constructor shape.",
      "fix": "Delete `NO_EVENTS` and the default, and make `events` required. The orchestrator should put that removal, plus `ui/useRangeController.ts:129` and `editor/range.browser.test.ts:119`, in row 20's Owned and Change."
    }
  ],
  "checked": [
    "Ownership: every file the patch touches is in the brief's Owned list (thread*.ts and their tests, rangeThreads.browser.test.ts, range/index/compare.ts, compareFrame(.test).ts, theme.css, editor/AGENTS.md, ipc/threadLine.ts, ipc/index.ts) or is the implementer's report under .omp/run/notes.",
    "PM2/PM3/PM5: the new editor files import only @codemirror/*, ../../ipc (index), siblings in editor/internal and `~icons/lucide/message-square-plus?raw`. They import no vue, @tauri-apps or ui. ipc/threadLine.ts imports only compareDomain, domain and validate inside ipc.",
    "Brands: threadLine.ts makes LeftLine and RightLine only through domain.ts's `isLeftLine`/`isRightLine` guards, as compareDomain.ts does. I accept the deviation of adding changedThreadLine/unchangedThreadLine, because the editor cannot create brands.",
    "Contract: ThreadLine has the four variants with readonly fields; `shownColumn` is exhaustive through a `never` default. ShownThread and RangeEvents are re-exported from editor/index.ts. RangeController has setPreferences, moveToChange, showThreads and destroy. CompareFrame takes { views, strip, fields, anchors }; compare.ts passes [differenceField] and () => [], and range.ts passes [differenceField, threadField] and threadAnchors.",
    "Deviation accepted: `threadRows(differences, shown)` shares `linePlace` with `anchorAt` (threadAnchor.ts:13), so the anchor rule and the gap rule are one rule.",
    "Deviation accepted: there is one module-level threadField whose payload carries the column and cells. compareViews.ts's `extensions` is shared by both columns and is not owned. threadAnchors reads the rows from the left column's field only, and showThreads hands both columns the same `rows` (range.ts showThreads).",
    "Deviation accepted: place-0 rows use side `index − rows.length` (threadField.ts:31–34), which keeps order above line 1. Pinned by threadField.test.ts 'each row is a block widget…'.",
    "Deviation accepted: the `LineBlock` export from compareFrame.ts is a type-only edge threadField → compareFrame and adds no cycle. EditorView.lineBlockAt's BlockInfo satisfies it, so compare.ts compiles unchanged.",
    "Deviation accepted: destroy() reports `events.hosts(new Map())` only when hosts existed (range.ts destroy). ThreadHosts.destroy disconnects the observer, removes the focusin listener and clears both CSS variables.",
    "Deviation accepted: the xmlns comment in threadNumbers.ts:98–99 is an external fact with a source (CP1). The new files have no other comments.",
    "Open risk accepted: threadAnchors add nothing under exact geometry, because an unchanged row adds equal height in both columns, so the slope stays 1. The brief requires them, so this is not a finding.",
    "Open risks accepted: a three-digit badge overflowing the 20 px padding, and focus sitting on <body> while the focused row is virtualised out. Both are inherent to the design's host model.",
    "State: row heights have one writer, ThreadHosts.#heights; the widget's toDOM only reads height(). Hosts are created and dropped only in ThreadHosts.show/#drop. Vue receives HTMLElements only, never an EditorView or a position.",
    "CM: ThreadRowWidget keeps the default ignoreEvent (true). Its eq compares row key, column and keys, never height. Block decorations come from a StateField's provide, not a plugin. rowsChanged counts threadField, so a showThreads drops the cached layout.",
    "theme.css: the thread rules use only variables (--color-fg, --color-fg-muted, --color-primary, --color-on-primary, --font-sans), with no colour literal (VU17). The rules are scoped under .cm-thread-lines, so the compare window's gutter is untouched.",
    "TS10: the new files have no top-level arrow functions; TS17: the Maps and Sets are keyed by runtime keys only.",
    "Decision record: the patch contradicts no plan §2 row (#116, #96, #51 as cited by the brief). Map and ipc/AGENTS.md lines are left to the orchestrator's docs pass, as stated."
  ]
}
```