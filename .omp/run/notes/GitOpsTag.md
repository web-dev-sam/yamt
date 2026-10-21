# GitOpsTag - notes (web-impl, 3.J row 13)

Output fields verbatim.

The operation now shows as a small gray uppercase tag at the bottom of the file list, and the row at the top of the merge area is gone. Everything the brief's Acceptance asks for was checked in WebKit in both themes, and all five pnpm recipes pass. Not run: `just map-check` (part of `just check`). It will fail on `OperationLabel.vue` until the project map and architecture are updated; that's yours, since `docs/**` and `.omp/**` are read-only for me (wording under deviations).

## summary
- `operationTag(kind)` in `ui/operationText.ts` reads one six-entry table: `MERGE`, `SQUASH MERGE`, `REBASE`, `CHERRY-PICK`, `REVERT`, `AM`.
- New `ui/OperationLabel.vue`: a `<p role="status">` whose text is the tag. Its hover (`title`) is `operationLine`'s tooltip and its accessible name (`aria-label`) is `operationLine`'s text. Styling: `px-3 pt-1.5 pb-1 text-xs font-semibold text-fg-muted truncate shrink-0`.
- `FileList.vue` takes a new `operation: OperationView | null` prop and shows the tag as its last row, under the list or tree, only when an operation is recorded.
- `App.vue` passes the store's `operation` to `FileList` and no longer renders the top row. `OperationBar.vue` is deleted.

## files_changed
- `frontend/src/ui/operationText.ts`
- `frontend/src/ui/operationText.test.ts`
- `frontend/src/ui/OperationLabel.vue` (new)
- `frontend/src/ui/OperationBar.vue` (deleted)
- `frontend/src/ui/FileList.vue`
- `frontend/src/ui/App.vue`
- `frontend/src/ui/AGENTS.md`

## tests_added
- `operationText.test.ts` › "the tag of %s reads %s, as plan #92 words it": a `test.each` over all six `OperationKind`s, pinning the exact uppercase words.

## smoke_evidence
- **Node test** (`pnpm -C frontend vitest run --project node src/ui/operationText.test.ts -t "the tag of" --reporter verbose`):
  ```
  ✓ … the tag of Merge reads MERGE, as plan #92 words it
  ✓ … the tag of SquashMerge reads SQUASH MERGE, as plan #92 words it
  ✓ … the tag of Rebase reads REBASE, as plan #92 words it
  ✓ … the tag of CherryPick reads CHERRY-PICK, as plan #92 words it
  ✓ … the tag of Revert reads REVERT, as plan #92 words it
  ✓ … the tag of Am reads AM, as plan #92 words it
  ```
- **WebKit, dark** (`just app-session start-fixture --name tag --size 1600x1000`, MiniBrowser; each `?operation=` loaded, then read):
  ```
  ?operation=rebase      text "REBASE"       ariaLabel "Rebasing feature/reminders onto main · 1 of 3"  title "Rebasing feature/reminders onto main · 1 of 3\n\nAdd reminder dates\n\nCards keep a due date."  gapBelowTag 4
  ?operation=merge       text "MERGE"        ariaLabel/title "Merging feature/reminders into main"
  ?operation=squash      text "SQUASH MERGE" ariaLabel/title "Squash-merging feature/reminders into main"
  ?operation=cherry-pick text "CHERRY-PICK"  ariaLabel "Cherry-picking 3f1c2a9 Add reminder dates · 1 of 3"
  ?operation=revert      text "REVERT"       ariaLabel "Reverting 3f1c2a9 Add reminder dates · 1 of 3"
  ?operation=am          text "AM"           ariaLabel "Applying patch 1 of 3: Add reminder dates"
  ?operation=none        text null (no tag element)
  ```
  - Styles: fontSize 12px, weight 600, colour rgb(129,126,141).
  - Alignment: tag left 5 + padding 12 = 17, the same as the "Files" heading's left (17).
  - What WebKit computes for the tag (WebDriver `computedlabel` / `computedrole`): `{"value":"Rebasing feature/reminders onto main · 1 of 3"}` / `{"value":"status"}`.
- **WebKit, light** (Theme → Light clicked in Settings; after each reload `data-theme="light"` was set by script, because fixture settings live in memory): the same six tags and accessible names. Colour rgb(115,118,124) on panel rgb(255,255,255); `none` shows no tag.
- **Right column starts with the toolbar**, for both rebase and none: `{"markResolvedTop":10.25,"asideTop":5}`, and there are 0 `p.bg-info` rows.
- **Scrolling list at 1400×360**:
  - At 1400×600 the 12 fixture files fit without scrolling, so I used a shorter window.
  - List view: `{"listScrollTop":86,"listScrollHeight":330,"listClientHeight":244,"listBottom":289.0,"tagTop":289.0,"tagBottom":315,"asideBottom":319}`.
  - Tree view: `{"role":"tree","scrollHeight":330,"clientHeight":244,"treeBottom":289.0,"tagTop":289.0,"tagIsAfterTree":true}`.
- **Ctrl+B**: `{"tagRendered":0,"tagStillInDom":true,"asideDisplay":"none"}`; pressing it again gives `"flex"`.
- **Screenshots**, all from the WebDriver page, in `/tmp/yamt-tag/`:

  | file | shows |
  |---|---|
  | `filelist-dark.png` | the file list with the tag, dark |
  | `filelist-light.png` | the file list with the tag, light |
  | `rebase-dark-window.png` | whole window, dark |
  | `rebase-light-window.png` | whole window, light |
  | `scrolled-list-dark.png` | short window, list view scrolled |
  | `scrolled-tree-dark.png` | short window, tree view scrolled |
  | `scrolled-list-light-cherry-pick.png` | short window, light, cherry-pick |
  | `none-light-window.png` | `?operation=none`, no tag |
  | `ctrl-b-hidden-dark.png` | file list hidden by Ctrl+B |

- **pnpm recipes**:
  - `typecheck`: `$ vue-tsc -b`, exit 0.
  - `test`: `Test Files 126 passed (126)`, `Tests 1756 passed (1756)`, exit 0.
  - `lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0.
  - `unused`: `$ knip --include exports,types`, exit 0.
  - `fmt:check`: `All matched files use the correct format. Finished in 744ms on 365 files`, exit 0.
  - Also ran `sfc-order`, which passed.

## deviations_from_brief
- `just map-check` will fail until the docs I can't edit are updated:
  - In the project map (`.omp/skills/project-map/SKILL.md:119`), replace `+ OperationBar (the top line, the right column's first row, plan §2 #87)` with `+ OperationLabel (the operation's tag, the file list's last row: hover and accessible name from operationLine, plan §2 #92)`, and add `operationTag` to the operationText.ts entry.
  - In `docs/architecture.md:889`, replace `OperationBar.vue (the top line over the right column…, plan §2 #87)` with `OperationLabel.vue (the operation's tag at the file list's bottom, plan §2 #92)`.
- Vue rule VU15: a reason for the new component would be needed, but it replaces `OperationBar.vue` one for one, so the component count is unchanged.
- The 1400×600 window the brief suggests did not make the list scroll with the fixture's 12 files, so I used 1400×360.
- For light runs after a reload, I set `data-theme` by script, because fixture settings reset on reload. Light was first switched on through the Settings screen.
- `operationTag` is a one-line lookup, which a project rule against tiny functions flags. I kept it because the brief names it and the test calls it.
- I ran `pnpm install --offline` because the worktree had no `node_modules`.

## open_risks
- `OperationLabel.vue:14`: the tag uses `role="status"`, as `OperationBar` did, because ARIA forbids an `aria-label` on a plain paragraph. It's a live region, so screen readers announce the line again whenever the operation changes.
- No test covers the component or `FileList`'s render condition; it was checked only in the WebKit smoke above. The repo has no Vue component tests.

## Mutants on changed TS lines (operationText.ts:31-39, 63-66)

8 mutants: 1 killed, 7 survived, all in the module-level `TAGS` table (each word -> "", the table -> {}): #732's class (module constants are not re-evaluated per mutant under the vitest runner); the `operationTag` test pins all six words. Dropped (VF7).


## Boundary review (GitOpsTagBoundary): pass, should #1450 (docs, fixed)

```json
{
  "verdict": "pass",
  "lens": "boundary-reviewer",
  "commit": "5a504c0",
  "findings": [
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": "docs/architecture.md",
      "line": 599,
      "problem": "The state-ownership row for `operation`/`sideNames` still says \"the top line, both headers and the buttons read the same reply\". `docs/plan.md` row #89 (line 121: \"an empty list shows git's message with the top line\", \"the top line and buttons go\") also still names the top line, and the \"Names in older rows\" note (line 126) does not map it to the tag. A reader who follows the owner table looks for a top line that no longer exists. Growth effect: none beyond this stale pointer, because #92 itself says it replaces #87's placement.",
      "fix": "Orchestrator, not this patch: change line 599 to \"the tag (`OperationLabel`), both headers and the buttons read the same reply\", and add \"the top line (#87, #89) is the file list's tag `OperationLabel` (#92)\" to the \"Names in older rows\" paragraph in plan.md."
    }
  ],
  "checked": [
    "Ownership: the patch touches only the 7 files the brief names as Owned (ui/AGENTS.md, App.vue, FileList.vue, OperationBar.vue→OperationLabel.vue, operationText.ts, operationText.test.ts). No change to ipc/, editor/, Rust, docs/ or .omp/.",
    "Clean cutover: grep for `OperationBar` in frontend/src and frontend/scripts finds nothing. App.vue no longer imports or renders it. The right column now starts with NoticeBar / ProblemBar / the all-resolved line / the merge grid (App.vue:79-114). No leftover `bg-info`/`border-info` use for the operation; the only remaining users are NoticeBar's own.",
    "One words table: `TAGS: Readonly<Record<OperationKind, string>>` (operationText.ts:31-38) is exhaustive over OperationKind and read only through `operationTag` (operationText.ts:63-65). OperationLabel shows nothing but `operationTag` and `operationLine`. It is kept apart from `NAMES` on purpose, because `Am` reads `AM` against \"patch application\" (plan #92).",
    "Single writer of `operation` holds: App.vue takes `operation` from useAppStore() and passes it down as a prop (App.vue:69-75). FileList passes it on to OperationLabel only; neither component writes it. listing.ts `refreshFiles` is still the only writer (ui/AGENTS.md:13, project map state table).",
    "Prop through FileList: FileList renders the label itself, as plan #92 and brief Change 3 prescribe, so this is not a side channel. FileList's jobs stay the panel's own: header, list/tree, last row, resize handle.",
    "Dependency direction: OperationLabel imports only `vue`, the `../ipc` types and `./operationText`. FileList adds only `./OperationLabel.vue` and the `OperationView` type from `../ipc`. No @tauri-apps, @codemirror or editor/internal imports (PM2/PM5).",
    "Vue conventions in OperationLabel.vue: script setup → template (VU1); imports → macros → computed (VU2); type-based `defineProps` (VU5); Tailwind classes only, palette token `text-fg-muted`, no <style> (VU14).",
    "Vue conventions in FileList.vue: the props block is type-based with the new `operation: OperationView | null`; `v-if=\"operation !== null\"` narrows for the non-null child prop; no new state, watch or handler; section order is unchanged.",
    "Accessibility pattern matches existing code: `role=\"status\"` + `:title` + `:aria-label` is the same shape as ServerStatus.vue:58-60. The implementer's open risk (live region, aria-label needs a role) is accepted: the brief asks for the accessible name to be the line, and the old bar had role=status.",
    "VU15: no growth in component count. The new component replaces OperationBar one for one, and the implementer's deviation saying so is accepted.",
    "Layout rule from #92: the tag sits after FileTree / the `<ul>`, and both are `flex-1 overflow-y-auto` (FileTree.vue:55, FileList.vue:107), so the tag stays at the panel bottom in both views. It hides with the `<aside>` under `v-show` (Ctrl/Cmd+B), as #92 states. Left padding `px-3` matches the header's `pl-3`.",
    "Comments: the patch adds no code comments. The existing WebKitGTK handle comment in FileList is untouched (comment-policy CP1).",
    "AGENTS.md wording: ui/AGENTS.md:13 now names `operationTag` and `operationLine` in the words list, and says what `OperationLabel.vue` is and where it renders (plan §2 #92). Its 'top line' and `OperationBar` mentions are gone.",
    "Project map and architecture §5.4: both name OperationLabel and operationTag (SKILL.md:119, architecture.md:889), so `map-check` has its entry. The implementer's deviation about map-check is resolved by 15ebbb4.",
    "No contradiction with the decision record: the words MERGE, SQUASH MERGE, REBASE, CHERRY-PICK, REVERT and AM, the hover (`operationLine` tooltip), the accessible name (the line), the missing step count and the removed first row all match plan §2 #92. #87's words are unchanged.",
    "Dead weight: `operationTag` is a one-line lookup, but it is the exported seam the brief names. Its users are OperationLabel and the test, so the implementer's deviation is accepted. No unused export: knip passed per the notes.",
    "Test file: the `test.each` over all six kinds (operationText.test.ts:38-47) follows the file's existing table style."
  ]
}
```

## Correctness review (GitOpsTagCorrectness): fail, block #1451

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/OperationLabel.vue",
      "line": 14,
      "rule_id": null,
      "problem": "The live region's text is now the bare tag, and the line sits only in `aria-label`. At a new stop of the same operation (Continue: rebase 1 of 3 → 2 of 3, `listing.ts:32` writes a new `operation` while the `<p>` stays mounted, because `stops.ts` never sets it to null), the text node 'REBASE' does not change. A changed attribute is not one of the changes a live region reports (`aria-relevant` only covers additions, removals and text), so a screen reader announces nothing; before this patch, `OperationBar` announced 'Rebasing … · 2 of 3'. When the kind changes (a cherry-pick inside a stopped rebase, #91), it announces the bare word 'CHERRY-PICK' rather than the line plan #92 wants the reader to hear. [INFERENCE from the ARIA live-region rules, not tried with a real screen reader. `ServerStatus.vue:58-61` uses the same `aria-label` pattern safely only because its text changes along with its label.]",
      "fix": "Remove `:aria-label` and put the line in the status region's own text: `<p role=\"status\" :title=\"line.tooltip\" …><span aria-hidden=\"true\">{{ operationTag(operation.kind) }}</span><span class=\"sr-only\">{{ line.text }}</span></p>`. The announced text then changes with every step and kind, and the accessible name stays the line."
    },
    {
      "severity": "should",
      "file": "docs/architecture.md",
      "line": 599,
      "rule_id": null,
      "problem": "The state-ownership row for 'what git is doing' still says 'the top line, both headers and the buttons read the same reply', but #92 removed the top line. A reader looking for who reads `operation` is sent to a component that no longer exists, and `OperationLabel`/`FileList` are not named as a reader.",
      "fix": "Change 'the top line' to 'the tag (`OperationLabel` in `FileList`)' in that row (orchestrator-owned docs, `15ebbb4`)."
    }
  ],
  "checked": [
    "Brief, plan §2 #92 (full row), patch `5a504c0` and notes `GitOpsTag.md` read. Current `OperationLabel.vue`, `FileList.vue`, `App.vue`, `operationText.ts`, `listing.ts` and `stops.ts` read whole.",
    "The tag shows exactly when an operation is recorded. `FileList.vue:119` uses `v-if=\"operation !== null\"`; `App.vue` passes the store's `operation`. Its only writer is `listing.ts:32` (`refreshFiles`), from each `listStop` reply, so the tag follows every list. `MovedOn` goes to `nextStop` → `loadFiles` → `refreshFiles`, which rewrites it; `nextStop` never clears it.",
    "Stash pop: `gitio/src/operation.rs:125` gives `operation: None` for stash pop/apply, so the listing's operation is null and no tag renders.",
    "Hover: `:title=\"line.tooltip\"`. Accessible name: `:aria-label=\"line.text\"`, with `line = computed(() => operationLine(props.operation))`, so both follow each new `OperationView` object. The notes' WebDriver `computedlabel` for rebase is the line.",
    "Visible text is `operationTag(operation.kind)` from one `Readonly<Record<OperationKind,string>>` table (`operationText.ts:31-38`). The words match plan #92 exactly (MERGE, SQUASH MERGE, REBASE, CHERRY-PICK, REVERT, AM), with no CSS `uppercase`.",
    "Scrolling: the list `<ul>` (`FileList.vue:106`) and the `FileTree` root (`FileTree.vue:55`) are both `flex-1 overflow-y-auto`. A scroll container's automatic minimum height is 0, so they shrink; the tag is `shrink-0` after them inside the `flex-col` aside, so it stays at the bottom. The notes measured this at 1400×360 (12 fixture files do not scroll at 600; accepted deviation): list `listBottom 289 = tagTop 289`, tree `treeBottom 289 = tagTop`.",
    "Narrow list: the `<p>` is `truncate` and stretches to the aside's width. `FILE_LIST_BOUNDS` has a 160 px minimum, minus 24 px of padding; 'SQUASH MERGE' at 12 px semibold is about 90 px, so it does not truncate in practice, and if it did, the title gives the full line.",
    "The `rounded-b-island` list background is `opaque-scroller` = `--color-panel` (`style.css:142`), the same as the aside, so no visible corner appears above the tag.",
    "Ctrl+B: `v-show=\"fileListShown\"` sits on the `FileList` root `<aside>`, so the tag is hidden with it (`display:none`, also hidden from assistive tech). Notes: `asideDisplay none` → `flex`.",
    "Left alignment: the tag's `px-3` equals the header's `pl-3`; the notes measured 17 px for both.",
    "`App.vue`: the right column now starts with `NoticeBar`/`ProblemBar`/all-resolved/grid. `OperationBar` is gone everywhere in `frontend/src`.",
    "Added test (`operationText.test.ts`, `test.each` over six kinds with `toBe`): a wrong word for any kind fails its row. A missing kind fails `vue-tsc` first (`Record<OperationKind,…>`) and its row at runtime (undefined). A seventh `OperationKind` added later is caught by the typecheck only, not the test. The test would not notice the component showing `line.text` instead of the tag, `title`/`aria-label` swapped, or the `v-if` inverted. There are no Vue component tests in the repo (all `ui/*.test.ts` test composables and modules), so that wiring rests on the WebKit smoke, as the brief's Acceptance asks. Not graded.",
    "Accepted deviations: `just map-check` wording was the orchestrator's and is done (project map line 119, `architecture.md:889` now name `OperationLabel`); 1400×360 instead of 1400×600; light theme set by script after reloads; the one-line `operationTag`, named by the brief and plan.",
    "Accepted open risk: `role=\"status\"` is kept; finding 1 is about what its text announces, not the role itself, which plan #87/#92 keep.",
    "Mutation survivors: no survivor list came with this task (none to triage). No tests were run; no finding depends on a test run."
  ]
}
```
