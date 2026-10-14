# CollapseToggle — 3.V-toggle round 1 (board "Unchanged lines, part 2" row 3)

Brief `docs/slices/briefs/3.V-toggle.md`. Verbatim report below. Orchestrator: deviations accepted (`setHiding` private; `sideFoldPush` returns the side's transaction; a selection ending exactly on a hidden range's edges collapses to its head — needed for the no-reopen property; `ScrollPane` structural type; two specs in one dispatch; `setSSRHandler` in store.test.ts; raw WebDriver pointer actions). Open risk 'Delete at the wave line's end joins the next line' ruled not a defect (#63 blocks only removal of hidden characters; the newline after the hidden range is visible and the join is undoable). Doc diffs applied at the feature's docs step.

---

Collapsing can now be switched on and off from a toolbar button in every opened file. All node tests and frontend recipes pass, and every WebKit acceptance step behaved as plan §2 #68 describes. `just map-check` fails, but on `wavePhase.ts` from the previous slice, not on this one.

```
summary
  - A "Collapse unchanged fragments" button (Lucide chevrons-down-up), third in the toolbar and third in the right-click menu; shows pressed with aria-pressed while on; on at first. Its own storage key, "yamt.collapse.unchanged": anything but "false" means on.
  - The middle pane keeps every level of every run, moved with its edits, plus a per-run count of steps still hidden (FoldState). Off sets every count to 0; on sets each back to its full level count. The sides mirror the counts.
  - On moves a cursor inside newly hidden lines to the wave line's start and drops a selection with an end inside, in the middle and both sides (foldSelection.ts). It keeps the middle's top line in place (scrollSnapshot) and lines the sides up at once (Frame.realign → ScrollSync.follow("center")).
  - The toggle is not in the undo history. The on/off value reaches every live controller through useMergeController's new options object and a watch, never through Preferences.

files_changed
  frontend/src/editor/internal/folds.ts, folds.test.ts, foldSelection.ts (new), foldSelection.test.ts (new), foldView.ts,
  geometry.test.ts, frame.ts, scrollSync.ts, scrollSync.test.ts; frontend/src/editor/index.ts (296 lines);
  frontend/src/ui/collapsing.ts (new), collapsing.test.ts (new), store.ts (299 lines), store.test.ts, toolbarButtons.ts,
  toolbarButtons.test.ts, MergeToolbar.vue, MergeView.vue, useMergeController.ts, useMergeController.test.ts

tests_added
  folds.test.ts:
    "off shows every hidden line in all three panes: no wave, and the sides get zero counts"
    "on after clicks hides every run as at a fresh open, whether it was on or off before"
    "lines typed above or inside a run while off move or grow its ranges, which hide when on"
    "a level shrunk below 2 lines while off stays shown when on"
    "a file opened while off has its runs but hides nothing, and on hides every step"
    "a toggle is not an undo step: undo after it undoes the earlier edit and leaves the folds" (undoDepth unchanged)
    "Undo selection after a toggle moved the cursor does not put it back inside the hidden lines" (the only test that catches a toggle recorded in history; Mod-u is bound)
    "after a toggle, clicks show 4, 8, then all, and Delete at a wave shows the next step"
    "on moves a middle cursor inside hidden lines to the wave line's start and drops a selection with an end inside, without showing the run"
    "a side cursor inside lines that get hidden moves to the wave line's start when counts grow, not when they shrink"
    the existing side-mirror test, rewritten for the new sideFoldPush
  foldSelection.test.ts: cursor strictly inside → start, on an edge → unchanged; anchor inside → cursor at head,
    head inside → start, exact-edge selection → cursor at head; covering selection kept; multi-range selection keeps
    its main range; property: for every anchor/head pair in a 12-line document, revealKeep of leaveHidden's result is
    null; revealKeep cases (moved here).
  geometry.test.ts: rows go stale on a toggle; updated to foldField(runs, collapsed).
  scrollSync.test.ts: "follow('center') makes the next sync write both sides though the middle did not scroll, and their
    echoes stay ignored" (the scrollTop guard skips first, then follow writes [300,300,300], then an echo is ignored).
  collapsing.test.ts: missing → on, nothing written; "false" → off; "true", "", "no", "[]", "FALSE" → on; toggling
    writes "false" then "true" and a second start reads it; getItem throws → on, collapse.storage_failed logged, still
    toggles in memory.
  toolbarButtons.test.ts: order (collapse after next, before applyLeft); stored ["undo","redo"] shows collapse; hiding it
    stores ["collapse","undo","redo"].
  store.test.ts: "toggleCollapsing flips collapsing and keeps the choice in the window's storage".
  useMergeController.test.ts: built off → `1 built false`, then flip → `1 set true`, rebuild → `2 built true`; flip with
    two live controllers and one destroyed → exactly ["2 set false","3 set false"]; a preferences change never calls
    setCollapsed; a flip before the file loaded throws nothing.

smoke_evidence
  A1 node tests and failing-path proofs (each rule broken, `pnpm vitest run --project node src/editor`, then restored):
    M1 collapseSpec always "on" → 5 failed incl. "off shows every hidden line in all three panes: no wave, and the sides get zero counts"
    M2 shown levels not mapped (map only while something hides) → 3 failed incl. "lines typed above or inside a run while off move or grow its ranges, which hide when on"
    M3 a shrunk level brought back → "a level shrunk below 2 lines while off stays shown when on" and "deleting a level down to one line shows it, and undo does not hide it again" failed
    M4 side cursor moved on shrink too → "a side cursor inside lines that get hidden moves … when counts grow, not when they shrink" failed
    M5 toggle recorded in history (addToHistory true) → "Undo selection after a toggle moved the cursor does not put it back inside the hidden lines" failed
    M7 sides ignore setHiding → 3 failed incl. "off shows every hidden line …"
    M8 leaveHidden keeps the head inside → 7 failed incl. "no selection left by leaveHidden makes a reveal show the lines again"
    M9 exact-edge selection kept → property failed: "AssertionError: 14→62: expected 1 to be null"
    M10 follow() keeps the scroll guard → "follow('center') makes the next sync write both sides …" failed
    After restoring: "Tests  566 passed (566)" (src/editor + src/ui).
  Stryker on the changed ui files (the `just mutants` web command, run directly with
  --mutate src/ui/collapsing.ts,src/ui/store.ts,src/ui/toolbarButtons.ts,src/ui/useMergeController.ts):
    collapsing.ts 94.74 % (1 survivor), store.ts 97.49 %, toolbarButtons.ts 87.50 %, useMergeController.ts 82.50 %.
    Survivors on my lines:
      useMergeController.ts:142 `loaded?.` → `loaded.` — killed by the added test (mutated: "promise rejected
        'TypeError: Cannot read properties of null…'"; restored: passes).
      collapsing.ts:12 STORAGE_KEY → "" — module-level: the vitest runner does not re-evaluate module-level mutants
        (justfile note, #732), same as the existing toolbarButtons.ts:24; the test asserts the key by value.
    Other survivors (store.ts:179,185,276; toolbarButtons.ts:24,27,32; useMergeController.ts:67-77,85-88,134,128 no
    coverage) are not on lines I wrote.
  A2 WebKit (fixture page through `pnpm exec tsx scripts/app-session.ts start-fixture --name tog`, which runs
  `pnpm -C frontend dev --port <free>` and `just webdriver <port>`, MiniBrowser; waves clicked with real WebDriver
  pointer actions; keys through `press`):
    1. Fresh: "Collapse unchanged fragments|true"; vOn waves ["999|12 25|83 92|$", "999|12 25|83 92|$", "999|12 22|80 89|$"]
       (999 is CodeMirror's gutter spacer, i.e. the file top). Screenshot /tmp/tog-two-clicks.png.
    2. Two wave clicks → 29|79, then 37|71; open vueuse-use-magic-keys; toggle off →
       {"stored":"false","stripRuns":0,"allWaves":0,"pressed":"false"}; gaps in every pane of 3 opened files: "… 0 gaps" ×9.
    3. Toggle on → magic-keys waves equal those before; vOn back to "25|83" and "22|80"; allWaves 34 as before.
    4. Off, real click on middle line 50, on → cursor top 394 / left 750 on the wave line (wave at 393), middle still
       focused, waves unchanged. Off, click line 50 + Shift+click line 86 (1222 chars selected), on → selBgs 0, cursor on
       line 86 "  if (exp) {", run not reopened.
    5. magic-keys, on→off with line 52 at the top: before {gutter "52", y 93, left [93], right [-107]}, after
       {gutter "52", y 93, left [93], right [93]}. Off→on with lines 29/30 at the top edge: run 2's wave took line 29's
       row (72 vs 73, rounding). Side scrollTops [361,361,381] equal what a later scroll sync gives.
    6. Typed "zz" in the middle, toggled off, Ctrl+Z → zz 0, waves unchanged (0 while off). Toggled on, Ctrl+Shift+Z → zz 1,
       waves unchanged.
    7. Right-click on the toolbar → ["Previous change|true","Next change|true","Collapse unchanged fragments|true", …,
       "Undo|false","Redo|false"] (7 items). Hiding it → button gone, waves stay (35), stored hidden
       ["collapse","undo","redo"]. Showing it again → back with aria-pressed true, hidden ["undo","redo"].
    8. Off, reload → {"stored":"false","waves":0,"strips":0,"pressed":"false"}. vOn opened while off → on gives the #63 waves.
    9. After off/on: clicks 25|83 → 29|79 → 37|71 → gone, in all three panes. Backspace at the wave line's end → still 92
       lines, next step shown (29|79, 26|76). Find "vnode-" + Enter → the run is shown in all panes. Hover → "DIV:2 g:2 DIV:2
       g:2 DIV:2" (three panes, two strips). Off-state screenshot /tmp/tog-off.png. Session stopped (vite and webdriver
       stopped).
  A3 recipes (pnpm -C frontend):
    lint exit 0; typecheck exit 0; test "Test Files 69 passed (69) / Tests 789 passed (789)"; unused exit 0 (knip
    printed no unused exports); fmt:check "All matched files use the correct format."; sfc-order exit 0.

deviations_from_brief
  - setHiding is defined in folds.ts but not exported: nothing outside the file imports it (TS16; knip flagged it).
  - sideFoldPush's signature changed to (fields, pane, side: EditorState, folds: FoldState): TransactionSpec | null
    (was (onSides, folds) → effect). It returns the side's whole transaction so the "counts grow → move the cursor" rule
    lives in one place; pushFolds dispatches it to each side when `hiding` changes identity.
  - New or renamed exports: FoldState, collapseSpec(field, state, collapsed), foldField(runs, collapsed),
    foldFields(runs, collapsed), showNextStep(folds: FoldState, run) (folds.ts); leaveHidden, leaveAllHidden and the
    moved revealKeep (foldSelection.ts; holds moved too, not exported); Folds.setCollapsed and the Folds constructor's
    4th argument `collapsed`; Frame.realign; ScrollSync.follow; MergeController.setCollapsed; MergeOptions.collapsed;
    createCollapsing and Collapsing (ui/collapsing.ts); store.collapsing and store.toggleCollapsing;
    useMergeController(data, hosts, { readOnly, preferences, collapsed }).
  - A non-empty selection whose ends sit exactly on a hidden range's edges is dropped to the cursor at its head. The
    brief left this open: IntelliJ keeps such a selection, but #63's reveal would reopen the run on the next selection
    change, and the brief's property test needs revealKeep to be null for every selection.
  - ScrollSync now takes a structural ScrollPane type (scrollDOM: EventTarget & { scrollTop, clientHeight },
    documentPadding.top) instead of EditorView, so follow() is tested in node without a DOM. EditorView still fits it.
  - Folds.setCollapsed passes two specs to one dispatch (collapseSpec and { effects: scrollSnapshot() }); CodeMirror
    merges them into one transaction with the contract's effects, selection and annotation.
  - store.test.ts gives the store a storage in node through @vueuse/core setSSRHandler("getDefaultStorage", …), reset
    in `finally`.
  - The WebKit run used the app-session fixture helper, which runs the brief's dev-server and webdriver commands on free
    ports. Waves and lines were clicked with raw WebDriver pointer actions (curl to the session), because the helper's
    finder treats waves inside CodeMirror's aria-hidden gutter as hidden.
  - Docs outside the owned globs need these changes:
    (a) .omp/skills/project-map/SKILL.md and docs/architecture.md:
        - editor/internal: "foldSelection (pure: holds, revealKeep, leaveHidden/leaveAllHidden: the cursor rule of #68)";
        - folds: "the middle's foldField holds FoldState { runs (every level, mapped), hiding (steps still hidden per run) }";
        - ui: "collapsing.ts (`createCollapsing`: on/off in localStorage `yamt.collapse.unchanged`, held by the store)";
        - a state-table row "collapsing on/off | `collapsing` in ui/store.ts via createCollapsing, reaches each
          controller through useMergeController's `collapsed` option and a watch (plan §2 #68)";
        - in the state table, "unchanged runs, which steps still hide": "all levels mapped plus per-run hiding counts;
          setHiding (toggle, no history)";
        - MergeController surface: "+ setCollapsed".
    (b) skill://vue-conventions VU11: the useMergeController signature is now
        (data, hosts, { readOnly, preferences, collapsed }).
    (c) `just map-check` fails today on frontend/src/editor/internal/wavePhase.ts (from 3.V-phase, not this slice).

open_risks
  - frontend/src/editor/internal/foldView.ts:198-203: CodeMirror's scrollSnapshot anchors the block at the top edge,
    which may be a partly visible line. So "the top line" is that edge line: in step 5 the wave took line 29's row,
    72 vs 73 px.
  - Possible bug in #63's delete filter (frontend/src/editor/internal/folds.ts deletedWaves): in WebKit, ArrowDown onto a
    wave line leaves the cursor at the hidden range's end, and Delete there removes the line break after it. That joins
    the next line into the hidden lines (vOn 25|83 → 25|82, 92 → 91 lines). The filter only blocks deletes of hidden
    text, so this is not caused by this slice; it needs a #63 decision.
  - frontend/src/editor/internal/folds.ts:247-261: shown levels are now mapped too. An edit at a shown range's edge
    shrinks the range it will hide on the next "on" (after an undo, vOn showed 25|82). This follows #63's
    edge-mapping rule.
  - frontend/src/editor/internal/folds.ts:254-259: the sides' setHiding, and with it their cursor move, is dispatched
    inside the middle's update listener, the same pattern the old push used. Within that listener, the side's
    sideReveals sees a cursor at the wave start and reveals nothing (property test).
  - frontend/src/ui/MergeToolbar.vue:165: whether `aria-pressed:bg-row-selected` beats `hover:bg-hover` while pressed
    and hovered depends on Tailwind's variant order. ChoiceButtons.vue relies on the same order; the screenshot shows the
    pressed tint. WebStorm's exact pressed colour is still unchecked [INFERENCE].
```