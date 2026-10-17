# AltMarksEditor fix round 1 re-checks

## Boundary

All five findings in my lens are fixed, and the fixes don't create a second job, a copied rule or a boundary bend. I read the patch and the touched files as they are now; I ran no tests or gates.

```json
{
  "verdict": "pass",
  "findings": [],
  "per_finding": {
    "#1204": {
      "status": "fixed",
      "evidence": "frontend/src/editor/internal/frame.ts:29 — FrameParts now has `jump: (pane, target, rows) => void` instead of `focus: SideFocus`. frame.ts:45-48 — the lane callback calls `parts.jump(pane, target, this.layout().rows)` and then `this.#scroll.follow(pane)`. frame.ts:1-15 — the imports no longer include `SideFocus` or `markJump`. frontend/src/editor/index.ts:97-99 — the controller builds `jump` from its own `#views`, `#field` and `#focus`; index.ts is 295 lines (≤ 300)."
    },
    "#1205": {
      "status": "fixed",
      "evidence": "frontend/src/editor/internal/marks.ts:45 — `export const PICK_DISTANCE_PX = 4` is the only copy; `tickAt` uses it at marks.ts:116. markLanes.ts:87 — `lane.style.setProperty(\"--mark-pick\", `${PICK_DISTANCE_PX}px`)`, the same pattern as strips.ts:101. theme.css:323 — `inset: calc(-1 * var(--mark-pick)) 0`. No `-4px` literal is left."
    },
    "#1206": {
      "status": "fixed",
      "evidence": "frontend/src/editor/internal/geometry.ts:22-26 — `PANE_TINT` sits next to `SIDE_PANE`, `as const satisfies Readonly<Record<Pane, Side | \"center\">>`. marks.ts:66 and markJump.ts:79 both use it. `TINT_OF` and the inline `pane === \"left\" ? \"local\" : \"remote\"` are gone (grep). The only other copy is in test setup (folds.test.ts:125), from before this patch."
    },
    "#1207": {
      "status": "fixed",
      "evidence": "frontend/src/editor/internal/frame.ts:57 — `const marksDirty = this.#marks.changed(update, moved);` comes before the `if`, and line 59 tests `marksDirty || …`. The condition no longer depends on operand order."
    },
    "#1208": {
      "status": "fixed",
      "evidence": "frontend/src/editor/internal/gap.ts:79-80 — `const tone = paneTone(row.chunk, row.status, side); if (tone !== null)`, and the paint pushes `tone` at gap.ts:88. `chunkTone` is no longer imported in gap.ts. `paneTone` with a side pane (tone.ts:27-30) is `isSideOpen` + `chunkTone(chunk, side)`, so behaviour is unchanged. `isSideOpen` is still imported, but only for `gapArrows` (gap.ts:37), which is a different rule (arrows, not tint)."
    }
  },
  "checked": [
    "Ownership: every file in the patch is inside editor/ (index.ts, AGENTS.md, theme.css, internal/{frame,geometry,gap,markJump,markLanes,marks}.ts, folds.test.ts). Nothing in ui/, ipc/, lsp/, connectors/ or src-tauri changed.",
    "New import edges: index.ts→markJump (the controller builds the jump; Frame dropped that edge), markJump/marks→geometry (PANE_TINT), markLanes→marks (PICK_DISTANCE_PX), markLanes→pane (LINE_HEIGHT_PX, which strips.ts already imports), folds.test.ts→markJump (test only). All stay inside editor/internal; no sibling internal/, vue, @tauri-apps or ~icons edge (PM2/PM3/PM5).",
    "Growth: Frame keeps its two listed jobs (the per-frame paint and the rows/waves/anchors cache). It no longer knows what a tick click does: `FrameParts.jump` is a callback it passes on with its own cached rows, which is data Frame owns.",
    "Growth: the new wheel forwarding (markLanes.ts:89-97) is event handling on the lane DOM that MarkLanes already owns, under the same AbortController signal; no new state. `wheelScale` copies nothing: wheel.ts:24 only tells pixel mode from the others and never scales.",
    "Growth: `revealSteps` (markJump.ts:51-54) is exported for the #1210 test and used once in production (markJump.ts:62). It is pure, its rule lives only there, and knip passed per the report.",
    "One tint rule: every tint-deciding band reader (decorations.ts:52,104, gap.ts:79, marks.ts:66) goes through `paneTone`. `chunkTone` is called directly only by `paneTone` and words.ts:61, which tints chunks the bands already filtered, so editor/AGENTS.md's claim 'paneTone the one tint rule, bands use it too' now holds.",
    "Narrowing: in `jumpTo`, `pane` is narrowed to \"left\" | \"right\" after the center return, and `as const` makes `PANE_TINT[pane]` a `Side` for `focusChange`, with no cast (no `as` other than `as const`).",
    "Docs: docs/architecture.md:624-631 (orchestrator, 090debf) already describes the `jump` part, `revealSteps`, the wheel forwarding and `PANE_TINT`, so the report's suggested doc line is in. editor/AGENTS.md:9 says the same.",
    "Comments: the removed WebStorm comment described the line-end-first order that no longer exists. No new comments were added (comment policy).",
    "Report deviations accepted: the `as const satisfies` type for PANE_TINT, revealSteps exported from markJump.ts, the test placed in folds.test.ts, the AGENTS.md rewrite.",
    "Round 1's `showMarks(false)` nit (frame.ts:101-104) was not on this round's fix list and is unchanged. It is not re-raised here (RV8)."
  ]
}
```

## Correctness

**Verdict: fail.** #1211 and #1208 are fixed. #1210 is fixed only when the line where the problem sits has text. If the file ends with a line break, the last hidden line of a collapsed tail is empty, and a problem there still leaves the lines hidden. This is one block.

```json
{
  "verdict": "fail",
  "findings_status": {
    "#1210": "not fixed for an empty line at the hidden range's edge (frontend/src/editor/internal/markJump.ts:51-54); fixed for a line with text (folds.test.ts:329)",
    "#1211": "fixed (frontend/src/editor/internal/markLanes.ts:20-29, 90-97)",
    "#1208": "fixed, behaviour unchanged (frontend/src/editor/internal/gap.ts:79-88)"
  },
  "findings": [
    {
      "severity": "block",
      "rule_id": "R-plan80-click",
      "file": "frontend/src/editor/internal/markJump.ts",
      "line": 52,
      "problem": "#1210 is still open in its most common form: a problem at the very end of a file that ends with a line break, inside a collapsed tail. Example: TypeScript's or rust-analyzer's \"'}' expected\" for an unclosed brace, at `doc.length`. Clicking its tick leaves the tail collapsed and puts the cursor on the wave. Why: `hiddenLines` (foldRuns.ts:33-38) ends the tail at `doc.line(doc.lines).to`, which is the empty line after the final line break. So `lineAt(start)` gives `line.from === line.to === hidden.to`, the first step selects nothing, and `holds` (foldSelection.ts:5-12) matches neither the strict-inside test nor the non-empty test. The same happens for an empty first hidden line at `hidden.from`. architecture.md:627-628 now says the opposite (\"also for a zero-length problem at their end\").",
      "fix": "When the start's line is empty, make the first step select the innermost hidden middle range that holds `start`, both ends counted (from `paneFolds(folds, \"center\", state)`). That selection is non-empty, so `holds`' third clause shows it. Add a `revealSteps` case at `merge.state.doc.length` on `twoChanges`' collapsed tail (run 2: lines 76–101, line 101 empty), and drop the \"also … at their end\" claim from architecture.md unless it becomes true."
    }
  ],
  "checked": [
    "#1210 for a line with text, traced by hand. Step 1 is `[line.from, line.to]`. Hidden ranges are whole lines and hold at least 2 lines (`MIN_HIDDEN_LINES`), so this selection is non-empty and inside every level that holds the line. `holds`' third clause is true, and `revealKeep` (findLastIndex = the innermost holding level) shows that level and every level outside it. Step 2 is a cursor at `start`. After the reveal, `start` is outside any level still hidden, so `leaveHidden` does not move it. Same for a problem inside an inner level: the line selection sits inside the innermost level, so all levels show.",
    "#1210 for an empty line, traced by hand: with `start === line.from === line.to === hidden.to`, `anchor > from && anchor < to` is false and `!selection.empty` is false. `revealKeep` returns null, `leaveHidden` returns null, and the lines stay hidden. `paneDocs` builds the doc through `EditorState.create`, so text ending in \"\\n\" gives an empty last line. The tail's `runEdge` end is Infinity, so `end = doc.lines` and the hidden range ends at that empty line. The round's real-app check removed the file's final line break on purpose, so it never ran into this case.",
    "Strength of the #1210 test (folds.test.ts:329-341). If the feature is removed (cursor steps only, i.e. 502e997's rule), it fails; the report shows the failing line `['37-66','41-62','49-54']`. Dropping step 2 fails the cursor assertion. Both edges of run 1 level 0 are checked (`from`, `to`). Each step runs as its own `state.update`, the same as `jumpInResult`'s two dispatches. It is a pure state test with no DOM, as the brief asked. Its one gap is the empty line at the edge (the block above).",
    "#1211: the passive `wheel` listener on each lane uses the lanes' shared AbortController signal (removed on `destroy`). It scrolls that pane's own `scrollDOM` with `scrollBy({left: deltaX·s, top: deltaY·s})`, where s is 1 for pixels, `LINE_HEIGHT_PX` (20, the panes' fixed line height) for lines, and `clientHeight` for pages. The listener does not run while the lanes are hidden. `scrollBy` fires the pane's `scroll` event, so `ScrollSync` makes it the source and the other panes follow. The report shows this: pixel 300 → 300/300/320; line mode 5 → +100 on all three.",
    "#1211, no double scroll: the driven wheel moved the pane by exactly 300 px, so no ancestor scrolled as well. Nothing else in editor/ listens for wheel events on `view.dom` or its ancestors (grep: only sideFocus.ts on `scrollDOM`, and markLanes.ts). ui/altHold.ts listens in the capture phase, passively, and only for Alt.",
    "#1208: `side` is a `Side` there, so `paneTone(row.chunk, row.status, side)` is `isSideOpen(...) ? chunkTone(chunk, side) : null` (tone.ts:27-30), the same condition and tone as before. The tone is now computed before `crossesStrip`, which has no effect because both are pure. `isSideOpen` is still imported for `gapArrows` (gap.ts:37).",
    "#1204, as far as behaviour goes: Frame's lane callback still runs the jump with rows read at click time (CM9), then `this.#scroll.follow(pane)` (frame.ts:47-50). The controller's `jump` passes the same `views`, `spans` and `focus` as before (index.ts). `PANE_TINT[pane]` gives local or remote for the side panes, as the old ternary did.",
    "#1207: `marksDirty` is computed before the `if` with the same value, so the redraw triggers have not changed.",
    "Mutation survivors: none to triage. editor/ is not mutated (brief Contract).",
    "No `bash` test run: the block comes from reading `holds` and `hiddenLines`, and this role cannot write a probe test (SP1 hook)."
  ],
  "open_risks_judged": {
    "empty last hidden line": "Not accepted; this is the block above. It is not limited to \"a problem placed on that empty line\". Any problem at the end of a file that ends with a line break (unclosed brace or string, unexpected EOF) lands there, which is the usual syntax error after a bad resolution in a merge tool.",
    "Ctrl/Cmd+wheel over a tick": "Accepted. It needs Alt and Ctrl/Cmd held together, with the pointer on a tick (2–10 px tall). Before this fix that gesture did nothing, because the lane sits outside `scrollDOM`, so SideFocus's mod-wheel listener (sideFocus.ts:56) never saw it. Now it scrolls the pane. Nothing that used to work broke.",
    "driven wheel reports Alt up": "Accepted as a WebDriver artifact. altHold.ts is untouched, and a physical wheel with Alt held reports altKey true.",
    "far side jump settles at 261 on both rounds": "Not the jump: the jump's write reads back 781, a plain timer `scrollTop = 781` with no click also ends at 261, and 502e997 behaves the same. This patch changed only the `PANE_TINT` lookup in the side jump, not the scroll math or ScrollSync. `ScrollSync` alone is not proven either. It writes only to the following panes, never to its source (scrollSync.ts:100-104). It returns early when the source's `scrollTop` equals the recorded `syncedTops`. So it moves the left pane only if the center or right becomes the source after the one-frame echo window, with a `scrollTop` different from the one it recorded, for example a follower clamped at its document end whose maximum later changes. By my estimate from the fixture's chunk table, no follower is clamped at left=781 (center ≈ left + 2 lines, right ≈ left + 18 lines) [INFERENCE]. CodeMirror's height map already counts the fold replaces (state-computed decorations; NodeBuilder.point, @codemirror/view index.js:6038), so an estimate correction of 520 px is also unlikely [INFERENCE]. To tell them apart: on the fixture page, log every `scroll` event of the three `scrollDOM`s with its `scrollTop` and the frame number, between the 781 write and the 261 event. A center or right event after the echo frame whose value differs from the synced one points to the sync; otherwise the cause is CodeMirror or WebKit. Not a block for this round, because the behaviour existed before it. A far side-tick click in the real app, with real X input, is still unobserved."
  }
}
```