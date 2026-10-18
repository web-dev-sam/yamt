No blocking problems: `pushStatuses` behaves exactly like the removed `#statusesChanged` body, and the cutover matches the brief.

```json
{
  "verdict": "pass",
  "findings": [],
  "checked": [
    "pushStatuses (sideStatus.ts:18-32) is the removed #statusesChanged body line for line. Same every() status comparison with `before[index]?.status`, same {chunk,status} projection, left dispatch then right dispatch, and it returns null when no status changed. index.ts:184-190 calls frame.request() and the summary listener only when the result is non-null, and passes it summarize(after) as before. The contract signature matches exactly.",
    "Accepted open risk: pushStatuses has no node test. The node project has no DOM, so it cannot build the EditorViews in PaneViews. The side push had no unit test before this patch either, the patch only moved it. Brief Acceptance 4 accepts a WebKit step as evidence, and the report shows the WebKit tint check catching mutant A (no right dispatch) and mutant B (no dispatch to either side), then passing again once restored.",
    "Frame.changed: the old MarkLanes.changed returned false whenever the marks were not shown, so with marks hidden the old request condition equals the new one. frame.ts is byte-identical to a200f9e: `git diff --stat a200f9e 67dc661` names only index.ts and useMergeController.ts. Accepted deviation: the `git restore` was a process slip, and its result matches the pre-#80 file.",
    "Removing the folds.test.ts jump tests is correct: they called only revealSteps, which is deleted. The kept reveal rules still have their own tests: 'a selection with both ends exactly on a range's edges shows it', 'a cursor at a range's first or last position shows nothing', 'a match ending exactly at a range's end shows it'.",
    "The removed viewport.test.ts cases tested only thirdScrollTop, which is deleted. REVEAL_PARTS is still used by revealScrollTop (viewport.ts:8,64), and the revealScrollTop tests stay.",
    "useMergeController.ts:172-178: the preferences and collapsed watches are back inline (an accepted deviation), registered in the same place followWithoutRebuild used to be, so their order relative to the build watch is unchanged. 'a preferences change never resets collapsing' still exercises them. The two removed tests covered only the marks option.",
    "Mutation survivors at useMergeController.ts :78-88, :103, :132-135, :169, :181 come from older code (#582/#658) and are dropped. None fall on the lines this patch changed (145, 172-178).",
    "Acceptance grep re-run over frontend/src: the only match is saving.test.ts:63 `readonly marks: Written[]`, which the brief allows. MarkTarget, altHeld, #80, `change-mark` and `--mark-pick` are gone from frontend/src.",
    "Kept helpers still have users outside the deleted files: `linted` (serverDoc.ts:65), `paneFolds` (foldView.ts, folds.ts), `PANES` (foldRuns, scrollSync, wavePhase). paneTone in tone.ts is kept, as the brief asks.",
    "MergeView still uses `shown` (lines 136, 143, 159). The contract defineProps<{ data; shown }> holds, and App.vue has no useAltHold or :marks left.",
    "The style.css diff removes only --color-mark-error/-warning/-info, in both themes. The four kept change tokens and altHold.ts having no user is accepted, as the brief expects.",
    "Committing .omp/run/notes/MinimapCutover.md follows the repo's practice: earlier commits (a58ba75, 8733345) also add notes.",
    "Ran no tests. No finding depended on one."
  ]
}
``````json
{
  "verdict": "pass",
  "findings": [
    {
      "file": "frontend/src/ui/useMergeController.ts",
      "line": 172,
      "problem": "The deviation that inlined `followWithoutRebuild`'s two watches back into `useMergeController` leaves that function at about 39 of the 40 lines oxlint allows (`max-lines-per-function`, `frontend/.oxlintrc.json:49-52`). MinimapDesign Build B1 adds a `minimap` option and its watch to this file, which takes the function over the limit. B1 would then have to bring back the helper this patch deleted, and the Change did not ask for that restructuring (it said to remove the marks watch only).",
      "fix": "Restore `followWithoutRebuild(current, { preferences, collapsed }: Pick<ControllerOptions, \"preferences\" | \"collapsed\">)` with only the `marks` watch removed, and call it as `followWithoutRebuild(() => controller, { preferences, collapsed })`.",
      "severity": "should",
      "rule_id": null
    }
  ],
  "checked": [
    "Contract: `MergeOptions` is `{ readOnly, preferences, collapsed, servers }` (editor/index.ts:49-54) and `MergeController` no longer has `showMarks`. `ControllerOptions` lost `marks` (useMergeController.ts:43-48). MergeView has `defineProps<{ data: FileMergeData; shown: boolean }>()` (MergeView.vue:28). App.vue has no `useAltHold` and no `:marks`.",
    "`pushStatuses(update, field, views): readonly ChunkSpan[] | null` in sideStatus.ts:18-32 has the contract's signature. Its body is the old `#statusesChanged` body word for word. `#statusesChanged` (index.ts:184-190) keeps `#frame.request()` and the summary listener, and calls them only when the result is non-null, so behaviour is unchanged.",
    "New import edges `sideStatus` → `chunkField` (type) and `sideStatus` → `geometry` (type) create no cycle: chunkField, geometry and status never import sideStatus. Every edge stays inside editor/internal (PM5).",
    "sideStatus.ts still has one job, the side-status mirror (the field, its effect and the push that feeds it). No new state and no second writer: `showStatuses` is still dispatched only from the center listener.",
    "Leftover sweep: grep for markLanes|markJump|MarkLanes|showMarks|thirdScrollTop|focusChange|PANE_TINT|revealSteps|change-mark|color-mark-(error|warning|info)|MarkTarget|mark-pick|mark-tone over frontend/src, frontend/scripts and scripts finds nothing. The only `marks` hits are unrelated (saving.test.ts `marks: Written[]`, word marks, store test locals).",
    "frame.ts as it now is: `FrameParts` has no jump/marks, no `#marks`, no `showMarks`, no `marksDirty`, and the unused `Pane` import is gone. Every removed line belongs to #80. Inlining `moved` into the `if` is equivalent, so the implementer's `git restore` (an SP9 process breach) produced exactly the hunk reviewed. Accepted.",
    "Nothing left dangling: `#focusOn` and `ChunkState` are still used in sideFocus.ts (lines 22, 28, 98, 172). `REVEAL_PARTS` is still used by `revealScrollTop` (viewport.ts:64). `Side` is still used by `SIDE_PANE`/`STRIP_PANES` in geometry.ts. The WebStorm comment went out together with `thirdScrollTop` (comment policy).",
    "folds.test.ts: the `revealSteps` import, `jumpAt` and the three jump tests are removed. `EditorSelection` and `levelOf` are still used by the remaining tests (typecheck and lint passed per the report).",
    "theme.css: the `.change-marks`/`.change-mark*` block is removed and no `--mark-*` variable is left. style.css: the three error/warning/info tokens are removed in both themes, and the four change tokens are kept as plan §2 #81 requires (known, not a finding).",
    "editor/AGENTS.md: the change-marks paragraph is removed and nothing else changed. The stale project-map, architecture and CHANGELOG text is the orchestrator's (excluded).",
    "Ownership: every source file in the patch is in `Owned`. `.omp/run/notes/MinimapCutover.md` was committed by the orchestrator (SP9: the orchestrator commits). Neither pane.ts nor minimap*.ts is touched.",
    "Plan §2 #81 (read whole): #80's Marks, Place and Click parts go, and the Hold stays in `ui/altHold.ts`. The interim state, where the hold reaches nothing, is the brief's intent. No contradiction with any §2 row (DR1).",
    "editor/index.ts is 280 lines (read). That is ≤ 285 and leaves room for B1's roughly 6 lines under the 300-line limit.",
    "Accepted deviation: the optional `#centerSync` merge was not done. The Change does not list it and the line target is met.",
    "Accepted open risk: `pushStatuses` has no node test. The node project is `environment: \"node\"` (vite.config.ts:32) and `ViewUpdate`/`PaneViews` need a DOM. The contract fixes the signature. Acceptance 4's WebKit mutants A and B show that the side tint catches a broken push.",
    "Accepted open risks: the four mark tokens and `altHold.ts` have no user yet (the orchestrator said this is known).",
    "Accepted with a note: console-error hooks went in after the first page load. A construction-time throw would have stopped the panes, strips, apply/undo, keyboard step and find that the report observed afterwards.",
    "useMergeController.test.ts: the `marks` mock array, the constructor push, the `showMarks` method, the mount option and both marks tests are removed. The preferences/collapsed no-rebuild test still covers the watches that remain."
  ]
}
```