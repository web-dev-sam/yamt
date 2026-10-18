```json
{
  "verdict": "fail",
  "findings": [
    {
      "file": "frontend/src/editor/internal/scrollSync.ts",
      "line": 69,
      "severity": "block",
      "rule_id": "growth",
      "problem": "`scrollSync.ts` now has two separate jobs that share no code. The existing job is the three-pane locked scroll: the pure `targets`/`anchorsOf` functions and the `ScrollSync` class, which `Frame` owns, uses the CodeMirror-free `ScrollPane` type, has node tests, and is plan decision #12's one swap point (architecture lines 705-710). The new job is `exactScroll` (lines 69-123): a WebKitGTK workaround inside each single pane, with its own `placed` StateField, a `placeTop` effect, a scroll observer and a `scrollHandler`. `paneViews` builds it, not `Frame`. It uses no symbol from the rest of the file (`Anchor`, `targets`, `ANCHOR_AT`, `middle`, `ScrollPane`), and it would be needed even with a single pane and no lock. Any change to the lock, or a decision #12 swap, now has to work around a CodeMirror state extension, and `scrollSync.test.ts` loads that extension's runtime imports.",
      "fix": "Move `Placed`, `placeTop`, `placed`, `placeFarScroll` and `exactScroll` with its comment into a new `editor/internal/exactScroll.ts`, the way `cutOnce.ts` holds the other per-pane WebKitGTK quirk. Import it in `paneViews.ts`, drop the `@codemirror/state` value imports from `scrollSync.ts` and return its `EditorView` import to `import type`. Point `editor/AGENTS.md` at the new file, and the orchestrator names the file in the project map (PM6 `map-check`) next to `scrollSync`."
    },
    {
      "file": "frontend/src/editor/internal/scrollSync.ts",
      "line": 110,
      "severity": "should",
      "rule_id": "CM13",
      "problem": "The `scroll` observer reads `scrollDOM.scrollTop` and `scrollDOM.clientHeight` synchronously, which CM13 forbids as written, and the exception is recorded only in the implementer's notes. The next reviewer of `editor/` will flag it again, or the next author will copy it as a precedent for a scroll handler that does force a layout pass.",
      "fix": "Have the orchestrator/curator add to CM13: 'except `exactScroll`'s check of `scrollTop`/`clientHeight`, which runs inside CodeMirror's own scroll handling right before its synchronous `measure` (`DOMObserver.onScrollChanged`: `runHandlers(\"scroll\")` then `view.measure()`), so it adds no layout pass; any other scroll handler still reads layout only in the frame'."
    },
    {
      "file": ".omp/run/notes/MinimapWindowR3.md",
      "line": 86,
      "severity": "should",
      "rule_id": "DR2",
      "problem": "This is a decision that affects all future scrolling code, and no plan §2 row is proposed for it. The decision: every pane turns a far scroll into a CodeMirror scroll request, and code that scrolls a pane keeps writing `scrollTop` (stated only in `editor/AGENTS.md`). The rejected alternatives were routing only the press and the follower writes through `scrollIntoView` (a raw write still failed), `overflow-anchor: none` (no effect) and the minimap layer (no gain). Without a row, the next far-jump bug in the #1216/#1219 family will explore those alternatives again, and a new scroller may route through `scrollIntoView` and bypass the rule.",
      "fix": "Under DR5, the implementer adds the proposed row to `deviations_from_brief` and the orchestrator records it: '| n | **A far scroll lands where it was sent: every pane turns a scroll that shows none of its rendered lines into a CodeMirror scroll request with that exact scrollTop; code that scrolls a pane writes scrollTop** (#1240) | press/follower routing through scrollIntoView (a raw write still pulled back); overflow-anchor: none (no effect) | 2 |'."
    },
    {
      "file": "frontend/src/editor/internal/scrollSync.ts",
      "line": 84,
      "severity": "should",
      "rule_id": "CP1",
      "problem": "The workaround comment is four lines (CP1 allows one to three). Its only reference is CodeMirror's remark about Chrome in `DocView.updateInner`. That is an analogy, not a source for the WebKitGTK 2.54 behaviour it claims. Once #1240 is closed, a reader cannot find the evidence (the stack, 2552 → 1385, the sweep) the rule rests on.",
      "fix": "Cite the observation the way `cutOnce.ts` cites its brief, in at most three lines, e.g. '// WebKitGTK 2.54 pulls a scrollTop that shows none of the rendered lines back while CodeMirror swaps its viewport in its scroll measure (#1240, docs/slices/briefs/3.M-minimap-window-rework-3.md); a scroll request places the viewport first.'"
    },
    {
      "file": "frontend/src/editor/internal/paneViews.ts",
      "line": 41,
      "severity": "should",
      "rule_id": "CP1",
      "problem": "The tooltip comment now sits above a `return` that holds two unrelated extensions but explains only `tooltips(...)`. A reader may take it as the reason for `exactScroll` too. Nothing else gets harder.",
      "fix": "Put each entry of the returned array on its own line, with the two comment lines directly above the `tooltips({ parent: document.body })` element. Keep the name `everyPane()`: it says where the extensions go, and the obvious home, pane.ts's CM4 base list, is at its 300-line cap."
    }
  ],
  "checked": [
    "Owner of the scroll position (architecture §5.1 'scroll positions: DOM, driven by editor/scrollSync'): exactScroll decides no position. `placeFarScroll` reads `top` from `scrollDOM.scrollTop` at the event (scrollSync.ts:89), and the `scrollHandler` writes back exactly that value (scrollSync.ts:120). The positions themselves are still decided only by the writers: ScrollSync.sync for the followers, and minimapPointer, sideFocus and scripts for the source. One decider per position, so no second source of truth.",
    "New state `placed` (StateField per pane, scrollSync.ts:71-82) is written only by `placeTop` dispatched from `placeFarScroll`. It has no §5.1 row yet; per the notes the orchestrator writes it. It needs a row like 'last far-scroll request per pane: `placed` field (exactScroll), set by its scroll observer, read by its scrollHandler, no history'.",
    "CM13 performance claim verified in CodeMirror's source: `DOMObserver.onScrollChanged` runs `inputState.runHandlers(\"scroll\", e)` then `view.measure()` synchronously (frontend/node_modules/@codemirror/view/dist/index.js:7231-7235). So the observer's reads come right before CodeMirror's own measure in the same task. That makes the deviation harmless in effect; the CM13 wording is reported above.",
    "No history pollution: `placeTop` transactions only carry effects. chunkField's `invertedEffects` fires only on `docChanged` or `placeSpans` (chunkField.ts:107-110), and the updateListeners in folds.ts:248-280 act only on `hiding` changes or `selectionSet`.",
    "PM2/PM3/PM5: scrollSync.ts imports only @codemirror/state, @codemirror/view, ../../connectors (type) and ./geometry. paneViews.ts imports ./scrollSync, a sibling within internal/. No vue, no tauri, no import of another module's internal/.",
    "Public surface unchanged: `exactScroll` is not exported from editor/index.ts, and `MergeController` is untouched. Frame, minimapPointer, sideFocus and ScrollSync are unchanged, as the deviation states.",
    "Plan §2 decision #12 holds: `targets` is still the one interpolation function. exactScroll does not change what a follower targets.",
    "`everyPane()` deviation accepted: pane.ts ends at line 300 (the `max-lines` 300 cap in frontend/.oxlintrc.json:53), and adding `exactScroll` inline at the two call sites would wrap the center `extensions` line and push `createPaneViews` past 40 lines. `bodyTooltips()` was already a pane-wide list in paneViews before this patch, so the rename creates no new split from CM4.",
    "Deviation 'fix at the scroll event, not the press' accepted: the notes show a raw scripted write still pulled back with press routing, and the event-level fix covers the minimap press, follower writes and scripts with one rule.",
    "No tests added, accepted under brief Acceptance 3 (cause is CodeMirror/WebKit timing): the notes report real-app before/after tables with the fix removed once (rows 106/111/116/151 and D1 back at 1645/1545/1445/1385).",
    "Layer for #1241 measured and removed; no `.minimap` style change remains in the patch. Accepted per brief Change 3.",
    "editor/AGENTS.md entry matches the code (`placeTop`, `scrollIntoView`, `scrollHandler`, 'code that scrolls a pane keeps writing scrollTop'). It needs repointing if the move in finding 1 lands.",
    "Non-frontend files in the commit (.omp/run/notes/MinimapVerifyDiagnostics.md rewritten under an 'orchestrator's record' header; the tracked .omp/run/__pycache__ .pyc deleted as the verifier asked) are orchestrator records, not implementer edits to read-only source.",
    "Read only: no gate, no test run."
  ]
}
``````json
{
  "verdict": "fail",
  "findings": [
    {
      "file": "frontend/src/editor/internal/scrollSync.ts",
      "line": 87,
      "severity": "block",
      "rule_id": "review-protocol block (2): a rule other code relies on left untested",
      "problem": "No test pins the rule in `placeFarScroll` that decides when to act: the visible span `[scrollTop - documentPadding.top, +clientHeight)` against `lineBlockAt(viewport.from).top` and `lineBlockAt(viewport.to).bottom`. Every far-jump path depends on it: the minimap press, `ScrollSync.sync` follower writes, `SideFocus.#reveal`, and any future code, since AGENTS.md now says code that scrolls a pane \"keeps writing scrollTop\". If the early return were inverted, `from`/`to` swapped, the padding subtraction dropped, or the comparison made `<=`, two things could happen and no test would fail. In one, the check never fires and #1240 comes back. In the other, it fires on every scroll event, dispatching a transaction each time and rewriting scrollTop; the report saw that kind of over-firing raise late frames to 20 against 12. The decision is plain arithmetic, the same kind as `targets`/`anchorsOf` in this module and `revealScrollTop`, which already have node tests. So the brief's carve-out (\"CodeMirror timing → real-app numbers\") covers the WebKit cause, not this check.",
      "fix": "Move the decision into an exported pure function, e.g. `farTop({ scrollTop, clientHeight, paddingTop }, rendered: { top, bottom }): number | null`, which returns the visible top to place or null. Call it from `placeFarScroll`. Pin it in `scrollSync.test.ts` at both edges: touching the rendered top and bottom, 1 px of overlap at each end, a non-zero padding, and a jump fully above and fully below. Show one hand mutation failing (swapping top/bottom, or dropping the padding)."
    }
  ],
  "checked": [
    "Order of events in CodeMirror 6.43: `onScroll` (view index.js:7236) → `onScrollChanged` runs the scroll observers (7232) before `view.measure()` (7234). So `placeFarScroll` reads scrollTop before CodeMirror's measure swaps the viewport, as the cause in the report needs. Scroll observers are reached only through this path; `ensureHandlers` skips \"scroll\" (4607), so the observer never runs twice for one event.",
    "How the request lands: the dispatch sets `viewState.scrollTarget` (8044 → 6349). `viewState.update` places the viewport around the target (`getViewport`, 6479-6491). The measure loop's scrollTarget branch (8257-8261) calls `docView.scrollIntoView`, which asks the `scrollHandler` facet first (3463). The handler returns true, so CodeMirror's default `scrollRectIntoView` never runs. No selection is set, focus is not touched, and the cursor does not move.",
    "Matching the `placed` request: `clip` keeps the same object while `range.to ≤ doc.length` (1375) and `map` returns `this` for empty changes (1371), so the `!==` identity check holds. When the pane is in view, measure runs synchronously right after the observers, so only another scroll observer could slip a document change in between. Then CodeMirror maps the range, the handler steps aside, and CodeMirror's own `y: \"start\"` scroll with `yMargin = line.top - visibleTop` lands about 1 px off. Open risk accepted.",
    "Undo history is untouched: the `invertedEffects` in chunkField.ts:107-110 only fire on `docChanged` or `placeSpans`, and history adds nothing for an effects-only transaction with no selection (`@codemirror/commands` index.js:242-247). Side panes have no history.",
    "The extra effects-only transaction is ignored by every update listener that could react to it: `SavedPoint.updated` (field identity check, savedPoint.ts:81), `ServerDoc.updated` (serverDoc.ts:62-66), the folds selection listener (folds.ts:278), `pushFolds` (hiding identity check, folds.ts:250), and `pushStatuses`. `waveDeletes` sees no changes.",
    "No loop: the handler writes the scrollTop read at the same event. The next scroll event sees a viewport around the target, so the overlap check returns early. The measure loop is capped at i > 5 (8208). A zero editor height breaks the loop (8256) instead of spinning.",
    "Echo window: in `sync`, `#syncedTops` is read right after the follower writes. The handler's rewrite restores that same whole-pixel value, so a later second scroll event from a follower or the source fails `scrollTop === #syncedTops[source]` and does not re-sync.",
    "Ordinary scrolling does not trigger it: the viewport covers the visible area plus up to ~500-1000 px (`getViewport`, 6478), so wheel steps, the minimap wheel's instant `scrollBy` (minimapPointer.ts:120) and page-sized steps always overlap it. The report counts 0 fires in 200×40 px. If it does fire (a fast thumb drag, a nonlinear follower jump), it rewrites the value the browser already holds. Nothing under src sets `scroll-behavior`, so no write is animated.",
    "Find (findMatch.ts:65) and the fold-selection reveal (folds.ts:287) use CodeMirror's own requests: the target is rendered before the write, so the next scroll event overlaps and the handler ignores their ranges. A theme switch only reconfigures (no `setState` anywhere in editor/). Typing has no far scroll.",
    "Side reveal and keyboard navigation: `SideFocus.#reveal` writes the side's scrollTop (sideFocus.ts:243). That pane's scroll event goes through `exactScroll`, then `ScrollSync` makes the side the source. The `setMark` dispatch is unchanged.",
    "All three panes carry it: `everyPane()` is in the centre's extensions and in `sideExtensions` (paneViews.ts:63,79). `createPaneViews` is the only builder (index.ts:123), and no `setState` path can drop the extension.",
    "Acceptance 2 accepted: rows 101/106/111/116/151 from the top land at `centredScrollTop` truncated, with the sides following after 2 frames and 1 s. Also: the press from 1405, the D1 write in the middle and left panes, writes from 2785 upward, drag/wheel numbers equal to MinimapVerify 5c/5d, and the drag to the end with each pane read after and 1 s later. Acceptance 3: the fix removed once brings back 1645/1545/1445/1385 and the D1 1385. Acceptance 4: six interleaved runs, the layer removed (theme.css untouched). Acceptance 5: tails present.",
    "Acceptance 1 accepted without a pasted stack: the scrollTop setter wrap shows no JS writer for the pull-back, so no stack exists. The values (69/82 lines swapped, 1385 at the second `getBoundingClientRect`, 3688 locked height) place it inside `ViewState.measure` after `DocView.updateInner`.",
    "Deviation CM13 (a synchronous scrollTop/clientHeight read in a scroll observer) accepted: CodeMirror's `measure` reads layout synchronously right after, with no DOM writes in between, so no extra layout pass. The curator may want CM13 to name this exception.",
    "Deviations accepted: `MinimapVerifyDiagnostics.md` now holds D1-D5; deleting the tracked `.pyc` is cleanup; the `everyPane` rename is for the 40-line limit; the decision to put the fix on the scroll event rather than on each writer is backed by the failing raw-write case.",
    "Open risk accepted: no far toolbar-arrow or Ctrl/Cmd+wheel jump was exercised. By reading, both end in `#reveal` writing scrollTop and take the same scroll-event path as the scripted writes that were measured.",
    "Timing not judged as a regression: the final build's Alt-up median of 15.5 comes from another session than MinimapVerify's 11, and no A/B without the fix was run on the final build. [INFERENCE] By reading, the per-event cost when it does not fire is one scrollTop/clientHeight read (layout CodeMirror's measure needs next anyway) plus two O(log n) height-map lookups, so the difference is noise.",
    "[INFERENCE] Remaining gap, not a regression: if a follower's CodeMirror measure rAF were queued after Frame's rAF in the same frame, it would measure before that follower's scroll event. Traced the press, reveal and drag paths: no side pane has a pending measure there.",
    "No mutation survivors to triage (editor/ is not mutated). No targeted test run: the block is a missing test, which needs no run to establish."
  ]
}
```