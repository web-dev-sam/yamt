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