# Implementer report V0WindowChromeR1

## deviations_from_brief
[
  "New files: frontend/src/ui/closeGuard.ts (track/untrack/markSaved/unsavedFiles/mayClose/watchWindowClose, created by the store and held in its state; split out so store.ts stays at or under 300 lines), frontend/src/ui/sides.ts (SIDES, otherSide), frontend/src/ui/deletedSide.ts (deletedSideView, keptToApply) and its test.",
  "Map-check (PM6) will fail until the project map names the new files; I may not edit docs. The architecture/project-map ui entry needs: 'closeGuard.ts (unsaved work per opened file and the window-close question, held by the store); sides.ts (`SIDES`, `otherSide`); deletedSide.ts (`deletedSideView(deleted, taken)`: Keep/Delete/middle/Reset of the deleted-side view; `keptToApply`)'.",
  "`FileWork` moved from store.ts to closeGuard.ts. MergeView and store.test.ts now import it from './closeGuard'; there is no re-export.",
  "The store's `track`/`untrack`/`unsavedFiles`/`mayClose`/`watchWindowClose` API is unchanged; they forward to the guard. `Actions` is `Omit<CloseGuard, \"markSaved\">` plus the store's own actions.",
  "I took the 'state to reach' rule (#460) one step further than the brief: besides `deletedSideView` there is a pure, tested `keptToApply(view, summary)`, which returns the kept side while the middle should show kept text and summary.changes > 0. MergeView watches it.",
  "DeletedSideView's shape is my choice: { kept, keepIn: Side|null, deleteIn: Side|null, middle: 'base'|'kept'|'deleted', resettable }.",
  "The smoke used tauri-driver on a private Xvfb display (:67) because test-screen placement was not tried. The scratch WebDriver helper lives in /tmp/yamt-3w-r1-wd/, outside the tree. No screenshots were required this round; two were taken in /tmp/yamt-3w-r1-wd/ (kept.png, deleted.png)."
]

## open_risks
[
  {
    "location": "frontend/src/ui/store.test.ts:367",
    "risk": "Without the active-file check, 'a finish of a file no longer shown does not switch files' fails by timing out (5 s) rather than by an assertion: the c.ts load it starts is never answered."
  },
  {
    "location": "frontend/src/ui/MergeView.vue:57",
    "risk": "The watch fires when keptToApply changes. If an editor is rebuilt while the previous one still had un-applied changes and the kept side was taken, the value stays the same side and does not fire again. The first firing would already have applied to the old editor, so this cannot happen today, but it relies on the apply always finishing synchronously."
  },
  {
    "location": "frontend/src/editor/internal/apply.test.ts:36",
    "risk": "Already failing in my worktree: 6 tests fail because `deleted: null` is missing. Fixed in the main tree at 3527fe8, so the merged `pnpm test` should pass."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend fmt:check && pnpm -C frontend unused && pnpm -C frontend sfc-order; echo EXIT=$?",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\n$ vue-tsc -b\n$ oxfmt --check … All matched files use the correct format. Finished in 434ms on 105 files\n$ knip --include exports,types\n$ tsx scripts/check-sfc-order.ts\nEXIT=0"
  },
  {
    "command": "pnpm -C frontend test",
    "observed": "Test Files  1 failed | 31 passed (32); Tests  6 failed | 324 passed (330). The only failures are src/editor/internal/apply.test.ts: 'fixture synthetic.json: × Invalid key: Expected \"deleted\" but received undefined'. This was already failing in my worktree (editor/ untouched) and is fixed in the main tree at 3527fe8."
  },
  {
    "command": "pnpm -C frontend exec vitest run --project node src/ui src/scripts scripts",
    "observed": "Test Files  13 passed (13); Tests  150 passed (150). This run came before the two keptToApply tests were added; those passed in the full run above."
  },
  {
    "command": "guard tests with the guard weakened (moveOn reduced to `active === path`, then to `latestOpen === opensBefore`, then restored)",
    "observed": "Active check only: × 'a file the user opens while a finish runs…' and × '…while a take runs…' (2 failed | 39 passed). Counter check only: × 'a finish of a file no longer shown does not switch files' (fails by timing out after 5009ms). Full guard: all 41 pass."
  },
  {
    "command": "cargo tauri build --debug --no-bundle; scripts/conflict-repo.sh /tmp/yamt-smoke-3w-r1; Xvfb :67 + tauri-driver --port 4644; WebDriver session on target/debug/yamt --repo /tmp/yamt-smoke-3w-r1",
    "observed": "Built application at target/debug/yamt. Start: active docs/removed.md; buttons [Keep, Reset(disabled), Delete]; middle text '# Removed\\n\\nbase text'; sentence 'Deleted in this branch.'"
  },
  {
    "command": "docs/removed.md: Keep",
    "observed": "active → notes/crlf.txt; list shows 'docs/removed.md resolved'; git ls-files -s: '100644 63d4fa5f… 0 docs/removed.md' (the local blob, '# Removed\\n\\nlocal text')."
  },
  {
    "command": "back to docs/removed.md, then Reset",
    "observed": "After going back: buttons [Reset]; middle '# Removed\\n\\nlocal text' (kept text applied); middle visible, no deletion line. After Reset: buttons [Keep, Reset(disabled), Delete]; middle '# Removed\\n\\nbase text'; git index back to stages 1 and 2 (8b95f5c… 1, 63d4fa5f… 2)."
  },
  {
    "command": "Delete, then back to docs/removed.md",
    "observed": "After Delete: active → notes/crlf.txt; `git ls-files -s docs/removed.md` prints nothing (gone from the index). After going back: buttons [Reset]; middle pane hidden (centerInvisible: true); line 'Resolved by deleting the file.'; header mark 'docs/removed.md resolved'."
  },
  {
    "command": "notes/crlf.txt: Mark resolved, then 'Save Current Result'",
    "observed": "Dialog: 'Unprocessed Changes … 1 unresolved conflict still remains …'. After Save: active → packages-private/sfc-playground/src/App.vue (next unresolved; logo.bin comes before it but the search starts after the current file); 'notes/crlf.txt resolved'; git ls-files -u no longer lists notes/crlf.txt."
  },
  {
    "command": "extra check, ChoiceView now reading the taken side from the store: assets/logo.bin → Take left → back",
    "observed": "Before: [Take left, Take right, Reset(disabled)], 'Take the left or the right version.' Take left moved on to App.vue. Back: [Reset], 'Resolved with the left version.', 'assets/logo.bin resolved'. Session ended, then `pgrep target/debug/yamt` → 'no yamt left'; tauri-driver and Xvfb stopped."
  }
]

## orchestrator note
The 6 failing editor tests in the implementer's worktree are fixed in the main tree (3527fe8); `pnpm -C frontend test` at 0eb8849: 330 passed.
