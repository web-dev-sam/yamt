# GitOpsRememberedWindow — notes (web-impl, 3.J row 10)

Output fields verbatim.

The file list now marks a file git rerere filled in. Its conflicts are counted apart as "remembered", and Mark resolved no longer asks "Unprocessed Changes" for them. Typecheck still fails: four summary literals in three test files I don't own need a `remembered: 0` (exact lines under deviations). Lint, fmt:check, unused, node tests, the fixture page in WebKit and the real app all passed.

**summary**
- New `FileMark.vue`, used by both the list and the tree for every status. A `Remembered` file shows Lucide `history` and the muted word "remembered". The hover title and accessible name are "git rerere filled in a resolution you recorded before; review it, then Mark resolved". `Resolved` and `Unresolved` look as before.
- `MergeSummary` gains `remembered`. `summarize` counts a `Conflict` whose `waiting` is `Remembered` and whose sides are both still pending as remembered, not as a conflict. Once either side is applied or ignored it counts like any other conflict.
- `finishMustAsk` now looks only at `conflicts` and `changes`. The question's wording never mentions remembered conflicts.
- The toolbar label adds "N remembered" last; the word has no plural.

**files_changed**
- `frontend/src/editor/internal/status.ts`
- `frontend/src/editor/internal/status.test.ts` (new)
- `frontend/src/editor/internal/apply.test.ts`, `frontend/src/editor/internal/sides.test.ts` (expected summaries gain `remembered: 0`)
- `frontend/src/ui/FileMark.vue` (new), `frontend/src/ui/FileList.vue`, `frontend/src/ui/FileTree.vue`
- `frontend/src/ui/question.ts`, `frontend/src/ui/question.test.ts`
- `frontend/src/ui/summaryLabel.ts`, `frontend/src/ui/summaryLabel.test.ts`
- `frontend/src/ui/deletedSide.test.ts` (literals only; you granted this file)

**tests_added**
- `status.test.ts`, running the real chunk field and apply/ignore actions on one remembered and one plain conflict:
  - "a conflict git rerere filled in counts as remembered, apart from a plain conflict" catches a remembered conflict counted as a conflict. Expected `{changes:0, conflicts:1, remembered:1}`.
  - "a side decided on a remembered conflict moves it out of remembered…" catches it staying remembered after a decision. Apply local or ignore remote gives `conflicts:2, remembered:0`; then ignore remote gives `conflicts:1`.
  - "deciding the plain conflict leaves the remembered one counted as remembered" catches the plain conflict's decision clearing the remembered count.
- `question.test.ts`:
  - "Mark resolved never asks for conflicts git rerere filled in, but still asks for the others" catches a remembered conflict blocking Mark resolved. It is false with only remembered, true with a plain conflict or change as well.
  - "the unprocessed sentence never mentions remembered conflicts".
- `summaryLabel.test.ts`: "remembered conflicts are counted apart, last, and the word has no plural". It checks "1 remembered", "2 remembered" and "1 change · 2 conflicts · 1 remembered".
- I didn't extract a separate `FileMark` rule file; the component only switches on `status`.

**smoke_evidence**
- Targeted run, `pnpm -C frontend exec vitest run --project node` on the status/apply/sides/question/summaryLabel/deletedSide tests: `Test Files 6 passed (6)`, `Tests 75 passed (75)`.
- `pnpm -C frontend test`: `Test Files 126 passed (126)`, `Tests 1751 passed (1751)`.
- `pnpm -C frontend lint`, `fmt:check`, `unused`: exit 0 each ("All matched files use the correct format.").
- `pnpm -C frontend typecheck`: fails only in files I don't own: `src/ui/saving.test.ts` (4 errors), `src/ui/stops.test.ts` (1), `src/ui/store.test.ts` (16). Every error is `TS2741: Property 'remembered' is missing…` and traces back to the four literals listed under deviations.
- WebKit, fixture page (`just app-session start-fixture --name rw-fix`):
  - The rows read show `remembered.ts remembered | git rerere filled in a resolution you recorded before; review it, then Mark resolved`; every other row has no mark. The icon is the rendered `<svg … class="size-3.5" aria-hidden="true">`.
  - Screenshots: `/tmp/rw/list-dark.png`, `/tmp/rw/tree-dark.png`, `/tmp/rw/tree-light.png`, `/tmp/rw/list-light.png`. The mark shows in list and tree, dark and light; the toolbar reads "2 remembered".
  - After clicking Mark resolved: `{"dialog":null,"row":"remembered.ts resolved"}`. QuestionDialog is a `<dialog>`; I checked `dialog[open]`.
- Real app:
  - `scripts/operations-repo.sh rerere /tmp/yamt-test-rerere-rw` printed `Recorded resolution for 'src/board.ts'.` and `git ls-files -u` listed stages 1, 2 and 3.
  - Then `just app-session start-app --name rw-app --repo /tmp/yamt-test-rerere-rw`. The list read `{"rows":["src/board.ts remembered"], "mark":"git rerere filled in a resolution you recorded before; review it, then Mark resolved"}`.
  - The Result read `export const columns = ["backlog", "todo", "doing", "done"];`, with its conflict's buttons on line 1 (`/tmp/rw/app-open.png`). The toolbar read `["1 remembered"]`.
  - After Mark resolved: `{"dialog":null,"rows":["src/board.ts resolved"]}`. `git ls-files -u` printed nothing; `ls-files -s` shows `… 0	src/board.ts` (`/tmp/rw/app-after.png`). Sessions stopped.

**deviations_from_brief**
- Four literals in files owned by GitOpsRetire, to be applied in your follow-up (as sent):
  - `ui/saving.test.ts:41` `const NOTHING_LEFT = { conflicts: 0, changes: 0 };` → `{ conflicts: 0, changes: 0, remembered: 0 }`
  - `ui/stops.test.ts:300` `summary: { conflicts: 1, changes: 0 },` → `summary: { conflicts: 1, changes: 0, remembered: 0 },`
  - `ui/store.test.ts:48` `const NOTHING_LEFT = { conflicts: 0, changes: 0 };` → `{ conflicts: 0, changes: 0, remembered: 0 }`
  - `ui/store.test.ts:670` `const summary = { conflicts: 1, changes: 2 };` → `{ conflicts: 1, changes: 2, remembered: 0 }`
- I edited `ui/deletedSide.test.ts`, which you granted.
- To build the app, `cargo tauri build`'s own frontend step fails while those literals are missing. I ran `pnpm -C frontend exec vite build --mode tauri` myself, then `cargo tauri build --debug --no-bundle --config '{"build":{"beforeBuildCommand":""}}'`.
- `FileMark.vue` is a new component, as the brief asks; the reason for it (VU15) is one mark rule shared by list and tree. It is not yet named in `docs/architecture.md`, the project map, or `ui/AGENTS.md`, which I can't edit, so `just map-check` will flag it. Suggested map text after FileTree: "+ FileMark (a file's status mark in the list and the tree: resolved, remembered with the rerere hint, plan §2 #90)".
- I decided:
  - The remembered mark is `role="img"` with `aria-label` and `title` both set to the hint, so the hint is its accessible name and the visible word is decoration.
  - The file name itself stays unmuted for `Remembered`.
- `useMergeController.ts` needed no change; its re-export carries the new field.

**open_risks**
- `frontend/src/ui/FileMark.vue:22-27`: with `role="img"`, the row's accessible name includes the whole hint sentence. If a screen reader should hear only the word "remembered", the hint would have to move to a description instead.
- `frontend/src/editor/internal/status.ts:69-75`: a remembered conflict counts as remembered only while both sides are pending. A side that git rerere's chunk leaves empty is still counted as pending until the user acts on it; I didn't see such a chunk in the fixture or the rerere repo.
- I didn't run `just mutants`; `editor/` isn't mutated anyway, while `ui/question.ts` and `ui/summaryLabel.ts` are.

Checks for you on the merged tree, after the four literals land: `pnpm -C frontend typecheck`, `just check` (including `map-check` once the architecture line is added), and `just mutants`.

## Boundary review (GitOpsRememberedWindowBoundary): pass, shoulds #1422-#1426

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "TS7",
      "file": "frontend/src/ui/summaryLabel.ts",
      "line": 3,
      "problem": "`counted(count: number, noun: string, plural: string)` has three parameters, two of them strings that can be swapped without a type error, so a call like `counted(n, \"conflicts\", \"conflict\")` would print the wrong plural and still compile. Every new count added to the label repeats that risk.",
      "fix": "Pass the words as one object, e.g. `counted(count, { one: \"conflict\", many: \"conflicts\" })`, or put the words for each `MergeSummary` key in a `Readonly<Record<keyof MergeSummary, { one; many }>>` table and walk it in label order."
    },
    {
      "severity": "should",
      "rule_id": "TS6",
      "file": "frontend/src/ui/useMergeController.test.ts",
      "line": 9,
      "problem": "This test file is owned by the slice. It declares its own `type Summary = { conflicts: number; changes: number }` beside `MergeSummary`, and that copy no longer has `remembered`. The test double's summaries (lines 22, 102, 353–372) are now shapes the real controller can never emit, and the next field added to `MergeSummary` will drift again without a type error.",
      "fix": "Import `type MergeSummary` from `./useMergeController`, write `type Summary = MergeSummary`, and add `remembered: 0` (or a non-zero value) to the literals at lines 22, 102 and 353–372."
    },
    {
      "severity": "should",
      "rule_id": "TS17",
      "file": "frontend/src/ui/FileMark.vue",
      "line": 14,
      "problem": "The mark is a `v-if`/`v-else-if` chain over `FileStatus`, and the two branches repeat the same class list. `Unresolved` renders nothing only because no branch matches. A fourth `FileStatus` from the generated bindings would also render nothing, with no type error (vision 4).",
      "fix": "Build the marks as a `Readonly<Record<FileStatus, { icon: Component; word: string; hint: string | null } | null>>` literal (`Unresolved: null`) and render one `<span v-if=\"mark\">` with the shared classes, `:title`/`:aria-label` from `hint`, and `role=\"img\"` only when `hint` is set."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/FileList.vue",
      "line": 111,
      "problem": "How a status looks is now split across three files. The mark lives in `FileMark.vue`, but the muted name (`text-fg-muted` only for `Resolved`) is still copied in `FileList.vue:111` and `FileTree.vue:85-86`. The implementer's own decision that a `Remembered` name stays unmuted therefore exists twice and is not where the brief puts 'one mark used by the list and the tree for every status'.",
      "fix": "Give `FileMark` the name as well (a `name` prop or a default slot, rendering the truncated span with its muted class), so the list and the tree each pass only `status` and the label."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": "docs/architecture.md",
      "line": 597,
      "problem": "The slice leaves docs behind that the implementer could not edit (an accepted deviation). The project map and `ui/AGENTS.md` do not name `FileMark.vue`, so `just map-check` will fail. `architecture.md:597` still documents `summary()` as `{ changes, conflicts }`, and `architecture.md:836` still credits `FileList.vue` with the 'resolved mark'.",
      "fix": "Before the verifier runs `just check`, the orchestrator adds the map line the notes suggest ('+ FileMark (a file's status mark in the list and the tree: resolved, remembered with the rerere hint, plan §2 #90)') to the map, `architecture.md` §Components and `ui/AGENTS.md`, and updates line 597 to `{ changes, conflicts, remembered }`."
    }
  ],
  "checked": [
    "Brief, patch `0a09bb1`, notes and plan §2 #90 read in full. The patch matches #90: the summary counts a remembered conflict as remembered, not as an unresolved conflict; Mark resolved does not ask about it; the mark is Lucide `history` with the hint text verbatim (`FileMark.vue:9-10`).",
    "The remembered-count rule exists once: private `isRememberedWaiting` in `editor/internal/status.ts:69-75`, used only by `summarize` (TS11: status.ts already owns `summarize`). No ui/ module re-derives it from `waiting`.",
    "`summarize` arithmetic (`status.ts:77-82`): `isRememberedWaiting` implies `Conflict` and both sides pending, which implies open, so subtracting it from conflicts and from changes keeps the three counts disjoint and their sum equal to `open.length`.",
    "Half-decided remembered conflicts: a Conflict changes both sides (`side.ts:20` CHANGED_SIDES), so with one side applied or ignored it is still open, not remembered, and is counted as a conflict, as the brief's Behaviour 2 says. `status.test.ts` checks this through the real `actionSteps`/`dispatchSteps` (CM6/CM7 path), not through hand-built statuses.",
    "`MergeSummary` stays the editor's public type: it is defined in `status.ts` and re-exported unchanged by `editor/index.ts:40` and `useMergeController.ts:16,28`, and `useMergeController.ts` needed no edit. No new IPC or `ipc/` type, and no `bindings.ts` edit (PM4).",
    "No new state and no new writer: the summary is still the `shallowRef` in `useMergeController` fed by `onSummaryChange` (`editor/index.ts:190`, no per-field comparison that would miss `remembered`). The state-ownership row is unchanged.",
    "CM rules: no StateField, effect, history or position change. `summarize` reads `state.field(chunkField)` at use time (CM9).",
    "`finishMustAsk` (`question.ts:58-60`) ignores `remembered`, and `unprocessedText` (`question.ts:84`) never names it. Its callers are `saving.ts:119` (the question) and `MergeToolbar.vue:136` (`nothingLeft`, the primary look of Mark resolved), so the button and the question share one rule.",
    "`deletedSide.ts:38-40` `keptToApply` reads only `changes`, so remembered conflicts do not change it. The only edits to `deletedSide.test.ts` are its literals, and the notes say that grant was given.",
    "`summaryLabel` words: 'N remembered' with no plural, placed last; 'All changes processed' only when all three counts are 0. `summaryLabel.test.ts` covers singular, plural and the combined order.",
    "Ownership: all 12 touched files are inside Owned (`editor/**` tests and `status.ts`; `FileMark.vue`, `FileList.vue`, `FileTree.vue`, `question.ts`, `summaryLabel.ts` and their tests), plus `deletedSide.test.ts` by the stated grant. No Rust, `ipc/` or `crates/` change.",
    "The four summary literals missing `remembered: 0` in `saving.test.ts:41`, `stops.test.ts:297`, `store.test.ts:48` and `store.test.ts:667` are in files this slice does not own. Accepted deviation: another build fixes them (as the task context says).",
    "PM2/PM3: `FileMark.vue` imports only `~icons/lucide/*` (a ui/ component, Vue form, so no `?raw` needed) and `type FileEntry` from `../ipc`. No `editor/` or `@codemirror` import in ui/, and no Vue import in editor/.",
    "VU1/VU2/VU5 in `FileMark.vue`: script → template order, imports → macro → const, type-based `defineProps<{ status: FileEntry[\"status\"] }>()` (TS6: derived from the binding).",
    "VU15: the sixth-component reason is given in `deviations_from_brief` (one mark rule shared by the list and the tree). Accepted.",
    "`role=\"img\"` with `aria-label` = `title` = the hint matches the brief ('hover/accessible name …'). Accepted as the implementer's decision; the screen-reader open risk is noted, not a finding.",
    "No comments added in the patch (comment policy). Each test name states the bug it catches, as the Acceptance asks.",
    "Accepted open risk: `isRememberedWaiting` counts a remembered conflict only while both sides are pending. `statusAfterApply` already auto-ignores an empty other side, so a remembered chunk with an empty side resolves on its first apply."
  ]
}
```


## Correctness review (GitOpsRememberedWindowCorrectness): pass (#1436)

**Verdict: pass, no findings.** The summary count and the Mark resolved question rule are both correct for plan §2 #90. The added tests would catch a real bug in either one.

The one surviving mutant, `status.ts:71:5` `chunk.kind === "Conflict" &&` → `true &&`, can be dropped as equivalent (VF7 (a)). Only one Rust function creates `Waiting::Remembered`: `waiting_chunks` in `crates/session/src/remembered.rs`. It writes `kind: ChunkKind::Conflict` and `Waiting::Remembered` into the same chunk (lines 166 and 193). `shown_merge_data` (`merge_data.rs:127-157`) passes those chunks through unchanged, and `session/tests/remembered.rs:112-113` checks the pair. The same function builds the showcase fixtures. Nothing in the window changes a chunk's kind, and undo puts back the whole stored chunk.

One caveat: the IPC types still allow `Remembered` on a non-conflict chunk, and the guard is what keeps the `conflicts` subtraction from going negative there. That case is unreachable from any producer, so I graded it equivalent rather than a missing test.

```json
{
  "verdict": "pass",
  "findings": [],
  "checked": [
    "Read brief 3.J-remembered-window, notes GitOpsRememberedWindow.md incl. the boundary review (shoulds #1422-#1426 already triaged), plan §2 #90 in full, patch 0a09bb1, and 86fe613's literal fixes; files read as they are now: status.ts, status.test.ts, question.ts, question.test.ts, summaryLabel.ts, summaryLabel.test.ts, FileMark.vue, FileList.vue:97-115, FileTree.vue:53-89.",
    "summarize (status.ts:77-82): isRememberedWaiting needs a Conflict with waiting Remembered and both sides pending. For a Conflict, 'some side pending' means the chunk is open, so `remembered` is a subset of the open Conflicts. That gives conflicts = open Conflicts − remembered (>= 0) and changes = open − conflicts − remembered = open non-Conflicts. The three counts do not overlap and add up to open.length, and each remembered conflict is counted once.",
    "Half-decided remembered conflict: apply local or ignore remote makes it open but not every-pending, so it counts as a conflict (brief Behaviour 2; plan #90 'applying a side over it works as on any conflict'). An apply whose other side is empty auto-ignores that side (statusAfterApply) and resolves the chunk. A user deleting the whole block (CM8) ignores both sides and resolves it.",
    "Undo back to remembered: chunkField.ts:107-109 inverts with `placeSpans.of(tr.startState.field(field))`, which restores the whole spans, including the chunk object that carries `waiting`. Statuses go back to pending/pending (RK11: apply.test.ts:303 'undo after apply restores text and status'). editor/index.ts:186-191 sends summarize(after) on every status change, undo included. The count goes back to remembered structurally; no undo-specific test, and none is needed because summarize is pure over (chunk, status).",
    "status.test.ts drives the real chunkField, actionSteps and dispatchSteps (CM7 path) on a fixture parsed by loadFixture. Mutations I traced by hand would fail: isRememberedWaiting → false (test 1 expects remembered 1); dropping the pending check, or every → some (test 2 expects remembered 0 after one side); not subtracting remembered from conflicts (test 1 would give conflicts 2); changes = open − conflicts (test 1 would give changes 1); a plain conflict's decision touching the remembered count (test 3).",
    "Mutant survivor status.ts:71:5 (`chunk.kind === \"Conflict\"` → `true`): dropped as VF7 (a) equivalent. The only constructor of Waiting::Remembered is remembered.rs waiting_chunks (kind ChunkKind::Conflict :166, waiting :193). It goes through shown_merge_data unchanged (merge_data.rs:127-157), the pair is pinned in session/tests/remembered.rs:112-113, and the showcase fixtures come from the same Rust function. fixture.ts:101-115 would accept the pair on any kind, but only Rust-made JSON reaches it. The other 53 of 54 mutants were killed.",
    "finishMustAsk (question.ts:58-60) reads only conflicts and changes. question.test.ts:20-24 checks remembered-only → false, plus a plain conflict or change next to remembered → true; mutants adding `|| remembered > 0` or dropping either term are killed. unprocessedText never names remembered (question.test.ts:26-31). Both callers share the rule: saving.ts:119 (the question) and MergeToolbar.vue:136 (`nothingLeft`, Mark resolved's primary look). The real-app and WebKit smokes in the notes saw no dialog and the file turned resolved.",
    "summaryLabel (summaryLabel.ts:10-17): changes, then conflicts, then remembered, joined with ' · '; 'remembered' has no plural; 'All changes processed' only when all three are 0. The tests cover 1 and 2 remembered, the full three-part order, and the earlier two-count cases with remembered 0. A plural or order mutant fails them.",
    "FileMark.vue: Resolved shows the check and 'resolved' as before; Remembered shows Lucide history and the muted word 'remembered', with role=img and title = aria-label = plan #90's hint verbatim; Unresolved renders nothing. List (FileList.vue:114, role=option rows) and tree (FileTree.vue:88, file rows only, role=treeitem) use the same component, so the row's accessible name includes the hint. The implementer's open risk on that is accepted, since it matches the brief's 'hover/accessible name'.",
    "Other summary readers are unaffected: deletedSide.ts:39 reads only `changes`; noticeText.ts:42 reads a DiskResult, not a MergeSummary. File-level Remembered handling (nextFile, Continue's filesLeft) belongs to rows 7/8, with tests in nextFile.test.ts:46 and continuing.test.ts:29.",
    "86fe613 adds `remembered: 0` to saving.test.ts, stops.test.ts and store.test.ts, which covers the four literals the notes listed.",
    "Ran no test or toolchain."
  ]
}
```
