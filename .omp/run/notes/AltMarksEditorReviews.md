# AltMarksEditor reviews (3.O-editor round 1)

## Boundary

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "PM-growth (review-protocol: data through layers that do not use it; a second job)",
      "file": "frontend/src/editor/internal/frame.ts",
      "line": 30,
      "problem": "Frame never uses its new `focus: SideFocus` part. It only passes it to `jumpTo` (lines 46–50). So Frame now imports `SideFocus` and `markJump` and builds what a tick click does, on top of its listed jobs (the per-frame paint and the rows/waves/anchors cache). Any later tick action will be wired through Frame again, and a reader tracing a click has to go controller → Frame → MarkLanes → jumpTo.",
      "fix": "Replace `focus` in `FrameParts` with `jump: (pane, target, rows) => void`. The controller builds it in `#createFocus`'s neighbourhood as `jumpTo({ views, spans: this.#field, focus: this.#focus, rows }, pane, target)` (+2 lines, index.ts ≈ 294). Frame's MarkLanes callback calls `parts.jump(pane, target, this.layout().rows)` then `this.#scroll.follow(pane)`, and Frame drops its `SideFocus` and `markJump` imports."
    },
    {
      "severity": "block",
      "rule_id": "vision 2 (one constant per tunable)",
      "file": "frontend/src/editor/theme.css",
      "line": 323,
      "problem": "The 4 px pick distance lives in two places: `PICK_DISTANCE_PX = 4` in `marks.ts:46`, which `tickAt` uses, and the literal `inset: -4px 0` of `.change-mark::before`, which decides whether a click reaches the lane at all (the lane is `pointer-events: none`). Change one and clicks near a tick either fall through to the scrollbar or get swallowed and pick nothing. `strips.ts:101–103` already shows the shared form (`--strip-wave-hit` set from the TS constant).",
      "fix": "In `MarkLanes.#lane`, set `lane.style.setProperty(\"--mark-pick\", `${PICK_DISTANCE_PX}px`)` with the constant exported from `marks.ts`, and write the CSS as `inset: calc(-1 * var(--mark-pick)) 0`."
    },
    {
      "severity": "should",
      "rule_id": "vision 2",
      "file": "frontend/src/editor/internal/marks.ts",
      "line": 65,
      "problem": "The patch adds two new copies of the Pane→Side mapping: `TINT_OF` here and `pane === \"left\" ? \"local\" : \"remote\"` in `markJump.ts:75`. `geometry.ts` already owns the opposite table, `SIDE_PANE`. As the app grows, each new pane-aware feature will add its own copy.",
      "fix": "Export one `PANE_TINT: Readonly<Record<Pane, Side | \"center\">>` (or a `sideOfPane`) from `geometry.ts` next to `SIDE_PANE`, and use it in both `marks.ts` and `markJump.ts`."
    },
    {
      "severity": "should",
      "rule_id": "principles §2",
      "file": "frontend/src/editor/internal/frame.ts",
      "line": 60,
      "problem": "`this.#marks.changed(update, moved)` sets the lanes dirty as a side effect inside an `||` condition. It only works because it is the first operand. If someone reorders or shortens the condition, the lanes silently stop repainting while shown.",
      "fix": "Call `const marksDirty = this.#marks.changed(update, moved);` before the `if`, and test `marksDirty || update.docChanged || …`."
    },
    {
      "severity": "should",
      "rule_id": "vision 2 (one tint rule)",
      "file": "frontend/src/editor/internal/gap.ts",
      "line": 79,
      "problem": "The strip bands still work out the side tint inline: `isSideOpen` at line 79 and `chunkTone(row.chunk, side)` at line 87. So `paneTone` is not the one tint rule that `editor/AGENTS.md` now says it is (\"bands use it too\"). A change to the rule will update the pane bands and ticks but not the strip bands. This copy predates the patch.",
      "fix": "In `gap.ts`, use `const tone = paneTone(row.chunk, row.status, side); if (tone !== null) { … tone … }` in place of `isSideOpen` + `chunkTone`."
    },
    {
      "severity": "nit",
      "rule_id": "plan §2 #80 (hidden: nothing computed)",
      "file": "frontend/src/editor/internal/frame.ts",
      "line": 101,
      "problem": "`showMarks(false)` still evaluates `this.layout()` and calls `paint`, which then returns early. On an Alt release with no cached layout this rebuilds rows for nothing. As the app grows, nothing gets harder.",
      "fix": "Paint only when shown: `if (shown) { this.#marks.paint(this.layout().rows); }`."
    }
  ],
  "checked": [
    "Ownership: all 23 touched files are inside Owned (editor/**, style.css, ui/useMergeController(.test).ts, ui/MergeView.vue). altHold.ts, App.vue, store.ts, ipc/, lsp/, connectors/ and docs are untouched.",
    "Contract: `MergeOptions.marks: boolean` (index.ts:53), `MergeController.showMarks(shown)` (index.ts:228), ControllerOptions `marks: MaybeRefOrGetter<boolean>` watched to `showMarks`, MergeView prop `marks` passed as `() => props.shown && props.marks`, and `paneTone(chunk, status, pane): Tone | null` in tone.ts all match the brief.",
    "Dependency edges: marks.ts imports `Span` from ../../connectors (allowed, editor→connectors). No vue, @tauri-apps or sibling `internal/` imports in editor/. ui/ reaches the editor only through useMergeController (PM2/PM3/PM5).",
    "`ChunkSpan.tone` removal: no reader is left. Side and Result bands use `paneTone`. words.ts still tints only the `tinted` chunks taken from the same bands (decorations.ts:51–56).",
    "`linted` in problems.ts: two users (serverDoc.ts:65, markLanes.ts:36); it fits problems.ts's diagnostics job; the old inline copy in serverDoc was deleted.",
    "`followWithoutRebuild` in useMergeController: one job (watches that update the live controller), `Pick<ControllerOptions, …>` per TS6. The test covers built-with, follow-without-rebuild and before-load (useMergeController.test.ts:299–326).",
    "MarkLanes: one job (lane DOM, dirty flag, ticks for click lookup). Listeners use one AbortController, removed on destroy. Lanes are appended to `view.dom`, outside scrollDOM/contentDOM. `click` stopPropagation keeps Folding's host click listener (folding.ts:30–50) from acting. `changed` does nothing while hidden. `show()` marks dirty.",
    "Repaint triggers: `rowsChanged` already includes `geometryChanged` (geometry.ts:71–79), so lanes go dirty on padding, size, statuses, folds and `setDiagnosticsEffect`. Scrolling never paints lanes.",
    "CM9: tick targets carry a chunk id or a Diagnostic object. Positions are read at click time (markJump.ts `startOf`, `this.layout().rows`). The TS3 exhaustive `default` is present in `startOf`.",
    "SideFocus.focusChange is a one-line public wrapper over the existing `#focusOn` (outline + keyboard, #54), not a second focus path.",
    "Colour tokens: the seven `--color-mark-*` tokens in both themes match the brief's table hex for hex (style.css dark 63–69, light 126–132). theme.css uses only `var(--color-mark-*)` (VU17).",
    "Size caps: editor/index.ts 292 lines; marks.ts 129, markLanes.ts 120, markJump.ts 77, frame.ts ~111. All ≤ 300, and the functions read ≤ 40 lines.",
    "Comments: the WebStorm source notes in marks.ts:41–43, markJump.ts:51–52 and viewport.ts:68–69 are CP1 external facts with a reference. No narrating comments.",
    "markJump.ts as a separate file: one concept (what a tick click does). Declared deviation, accepted.",
    "`changePlaces`/`problemPlaces` in place of the design's `sidePlaces`/`centerPlaces`: one function per source, same rules. Declared deviation, accepted.",
    "Build-report open risks accepted: the double repaint after an apply (only while shown); problem ticks unchanged after an edit that changes no line heights (the line block, and so the tick, is unchanged); Windows arrows and overlay painting checked on Linux only (plan #80 [owner check on Windows]).",
    "The docs/architecture.md §5.1 row for MarkLanes' state (shown, dirty, ticks) and the project-map entries for marks.ts, markLanes.ts and markJump.ts are the orchestrator's, outside this patch. They are still needed for `just map-check`."
  ]
}
```

## Correctness

**Verdict: fail.** I found two blocking bugs in the change marks. Both are narrow and each needs a fix of a few lines. The rest of the patch matches plan §2 #80 and the brief.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "R-plan80-click",
      "file": "frontend/src/editor/internal/markJump.ts",
      "line": 59,
      "problem": "A problem tick whose problem starts exactly at the end of the last collapsed line (a zero-length diagnostic at a line end, e.g. a missing semicolon) leaves those lines collapsed and parks the cursor on the wave. The fold's hidden range ends at that line's end (`foldRuns.ts:37`). `foldSelection.ts` `holds` only reveals a cursor strictly inside the range. So neither the line-end cursor nor the start cursor (both equal `hidden.to`) shows the lines. Rule 5 says collapsed lines around the place show.",
      "fix": "Make the first dispatch select the whole line (`{ anchor: line.from, head: line.to }`): a non-empty selection inside a hidden range always reveals (`holds`, third clause). Then place the cursor at `start`."
    },
    {
      "severity": "block",
      "rule_id": "R-plan80-place",
      "file": "frontend/src/editor/internal/markLanes.ts",
      "line": 97,
      "problem": "While Alt is held, a mouse-wheel gesture that starts with the pointer on a tick (each tick's 4 px hit area above and below, `theme.css` `.change-mark::before`) scrolls nothing. The lane is a child of `view.dom` and a sibling of `scrollDOM`, so the browser finds no scrollable ancestor of the tick to scroll. WebStorm's stripe is part of the scrollbar and scrolls under the wheel. [INFERENCE from DOM scroll-chain rules; not observed; a gesture already scrolling keeps its latched scroller]",
      "fix": "Add a passive `wheel` listener on each lane (with the same abort signal) that forwards the deltas to that pane's `scrollDOM` (`scrollBy({ top: deltaY, left: deltaX })`, scaled by `deltaMode`)."
    },
    {
      "severity": "should",
      "rule_id": "promote",
      "file": "frontend/src/editor/internal/gap.ts",
      "line": 80,
      "problem": "The strip bands still use their own copy of the tint rule (`isSideOpen` + `chunkTone(row.chunk, side)`). So 'paneTone is the one tint rule, bands use it too' (editor AGENTS.md) is false for the strips. If the rule changes later, the strips can drift from the pane bands and the ticks.",
      "fix": "Replace the condition and the tone with `const tone = paneTone(row.chunk, row.status, side); if (tone !== null) { … tone … }`; behaviour stays the same."
    },
    {
      "severity": "should",
      "rule_id": "R-plan80-hold",
      "file": "frontend/src/ui/MergeView.vue",
      "line": 59,
      "problem": "No test or smoke observation shows that a hidden file never draws marks. The rule lives only in the getter `() => props.shown && props.marks`; changing it to `||` would pass every test and silently paint lanes in every opened file while Alt is held. Nothing else builds on it today, so only the performance promise (plan #80 'hidden files compute nothing') would be lost.",
      "fix": "Add one WebKit-smoke assertion: with two files opened and Alt held, the hidden file's `.change-marks` lanes stay `hidden` and contain no children."
    }
  ],
  "checked": [
    "paneTone matches the bands before the patch. Side: `isSideOpen` + `chunkTone(chunk, side)`, the same as the old `sideDecorations` filter and map, and `tinted` holds the same chunks in the same order for `sideWordDecorations`. Result: `!isResolved` + `chunkTone(chunk, 'center')`, the same as the removed `span.tone`, which was set once at create and only copied by spreads (chunkField.ts). No other reader of `ChunkSpan.tone` remains (grep).",
    "changePlaces: side panes mark exactly what they tint (TINT_OF left→local, right→remote, `row[pane]` span). The Result marks every unresolved change in its band tone. Insertion points and one-side deletions are point spans and get the 2 px floor.",
    "Tick geometry by hand: y = track.top + (paddingTop + top) × trackLen / scrollHeight, the same formula as the thumb top when the place is scrolled to the top. Height is the change's share, at least 2 px, at most the track length. The end clamp is `track.bottom − height`. Short documents map 1:1 (`scrollHeight ≤ clientHeight`; no vertical scrollbar there, so no Windows arrow inset in practice). The find space comes in through `documentPadding.top`. The lane sits at `view.dom` top 0, which is the scroller's top: the find panel is absolutely positioned (find.ts:38–42).",
    "Repaint triggers: `Frame.changed` calls `marks.changed` first, so the dirty flag is never skipped. `moved` covers geometryChanged, `chunkField` identity (a new array on every Result doc change or status change, chunkField.ts:72–82) and both fold fields. `linted` covers `setDiagnosticsEffect`. `paint` returns early unless the lanes are shown and dirty, so the scroll path (ScrollSync → `request`) does no tick work. While hidden, `changed` returns at its first test.",
    "`showMarks(true)` sets dirty and paints at once from `layout()`; `false` only sets `hidden`. A controller built with `marks: true` paints on its first `request()` frame (index.ts:99).",
    "`tickAt`: candidates lie within 4 px of a tick's extent, the nearest top wins, a tie goes to the tick painted on top (`<=` over the paint-sorted list). This matches WebStorm's `getNearestRangeHighlighter` as given in the design notes. The hit area (`::before`, inset −4 px) matches the candidate band.",
    "Presses: the lane is outside `contentDOM` and `scrollDOM`, so CodeMirror (contentDOM listeners, index.js:4605–4616), SideFocus (capture on scrollDOM) and the drag (strips) never see it. Folding keys off `foldRunAt(target)`, which is null for ticks. `mousedown` button 0 is prevented and stopped. The lane itself has pointer-events none, so presses between ticks reach the scrollbar.",
    "Side jump: `focusChange` → `#focusOn` (setMark + focus, no scrollIntoView), then a `scrollTop` write from rows read at click time (CM9), then `follow(pane)`. Result jump: positions from `chunkField`/`forEachDiagnostic` at click time (CM9), two selection-only dispatches with no scrollIntoView, then focus, then `lineBlockAt` read after the reveal. The height map and gap DOM update synchronously in the dispatch, so the top and `scrollHeight` are the new ones.",
    "`thirdScrollTop`: the line's top + padding − clientHeight/3, clamped to [0, scrollHeight − clientHeight]. It reuses `REVEAL_PARTS` = 3, so there is no second constant.",
    "Locked scroll after a jump: `follow(pane)` sets the source and clears `syncedTops`. Side-pane scroll events caused by the sync are echoes and are ignored (CM12). A fold reveal drops the layout cache through `folds.center`/`folds.sides`, so the anchors are rebuilt in the same frame.",
    "`destroy`: aborts the lane listeners and removes the lanes; `Frame` cancels its pending frame (CM14 hosts are left empty).",
    "Hidden files: App passes `:marks=altHeld`; MergeView gives `shown && marks`; its `shown` includes `screen.kind === 'files'`, so Settings and a server log hide the lanes too. A rebuild after a disk change reads the current value (useMergeController.ts:181).",
    "Do the node tests catch real bugs? Yes for the pure rules: marks.test.ts covers scaling, the 2 px floor, 1:1, the find space, lane width, the Windows inset, the end clamp, a problem on the wave line, side and Result marking, paint order, and both tickAt boundaries (96 in, 295 out; 306 in, 307 out). tone.test.ts covers both paneTone branches; viewport.test.ts covers a third down and both clamps; useMergeController.test.ts covers build, follow without a rebuild, and nothing before the file loads. The build broke each rule and showed the failing lines. Not covered by node tests (the brief allows the smoke instead): MarkLanes' dirty logic and 'never on scroll', markJump, Frame.showMarks, destroy. The Result-mark test drops the tops, but `row[pane]` is shared, so a center-only wrong span is unlikely.",
    "Acceptance evidence: the build report's WebKit items match brief item 3. The click checks there were synthetic events dispatched from a timer, which run the same jump code but cannot prove the press's default action is prevented. The real app (item 4) gives that proof with real X clicks: Result focused, selection empty; left tick outlined.",
    "Open risk 1 (a scrollTop write undone): accepted. CodeMirror's measure drops its scroll anchor when the offset moved more than 1 px (index.js:8186–8189), the write is the last thing in the click task, and no yamt path sends scrollIntoView on these dispatches (only findMatch.ts and the side panes' reveal on selection, folds.ts:287). MiniBrowser's undo looks like a WebDriver artifact. Still unobserved: one real-X click on a long file in the real app.",
    "Open risk 2 (MiniBrowser follow after a far Result write): it happens the same with lanes hidden and this patch does not change the sync path; not this slice.",
    "Open risk 3 (an apply repaints twice): accepted; it costs a few divs only while Alt is held.",
    "Open risk 4 (Windows arrow inset, overlay paint order): accepted as owner checks. `.cm-scroller` is z-index 0 and the lane is a later positioned sibling, so it paints above.",
    "Open risk 5 (problem ticks stale after a doc edit that changes no height): this does not happen in the Result. Every doc change there replaces the `chunkField` array, so `moved` is true and the lanes repaint.",
    "Geometry changes during scrolling (contentDOM width growing as wider lines are drawn, index.js:6415–6419) can repaint while Alt is held. That repaint is a geometry trigger allowed by rule 4, not a scroll trigger.",
    "Mutation survivors (14, none on lines this patch changed). 104 `shallowRef(true)`: equivalent (a), because `reloaded` sets `unsaved.value = false` in the immediate watch before the handle is returned. 192 `() => undefined`: equivalent (a), because `?.` and `?? null` treat undefined as null. 79–83 and 89 host guards, 133–136 forwarders, 186 `flush`: real gaps from earlier slices, already logged as #582/#617; no finding here.",
    "No `bash` test run: neither block depends on a node test, and the browser suite cannot launch WebKit on this host (#1074)."
  ],
  "open_risks_judged": {
    "scrollTop write undone": "accepted (CodeMirror anchor drop at index.js:8186–8189; the write comes last; no scrollIntoView on these dispatches); a real-app long-file click is still unobserved",
    "MiniBrowser follow after a far write": "not this slice (same with lanes hidden)",
    "double repaint after apply": "accepted",
    "Windows arrows / overlay paint order": "accepted as owner checks",
    "stale problem ticks after a doc edit": "does not happen in the Result: the chunkField array changes on every doc change"
  }
}
```