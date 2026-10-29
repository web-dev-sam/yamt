# Slice SearchGoToR1 — fix round 1: MergeController in its own file with separate listeners; one pending go-to rule; the line-up in its own file

Board "Search" row 3, fix round 1 (session 35). Round 1: `SearchGoToB`, commit `4c42cc6`, brief
`docs/slices/briefs/search-goto.md` (its Contract holds), notes `.omp/run/notes/SearchGoTo.md`. Both reviews failed.
Verbatim (promoted `should`s marked):

1. **#1700 (boundary, block)** `editor/index.ts:122` — "The patch merged three listeners and the new Result event into
   one `#centerSync` listener only to stay under `max-lines` 300. That removes the error isolation CodeMirror gives each
   update listener … If `pushStatuses` or `ServerDoc.updated` now throws, `#saved.updated` and the Result event are
   skipped … It also leaves `index.ts` at exactly 300 lines." Fix: each job its own `EditorView.updateListener.of`
   again (status push + summary, server sync, saved point, a `docChanged` → Result-event one); make room by moving
   `MergeController` into `editor/merge.ts`, re-exported by `index.ts` as `compare.ts` and `range.ts` are (`index.ts`
   becomes the barrel).
2. **#1712 (correctness, block)** `editor/index.ts:130` — "`resultVersion` bumps on an edit" is proven only through a
   mocked listener; deleting the Result-event call or its `docChanged` guard passes every test. Fix: a throwaway WebKit
   probe on the merge fixture: the handle's `resultVersion` before and after typing in the Result, an apply, an undo
   (+1 each), a cursor move with no edit and an ignore that changes only a status (+0 each); paste the values. If a
   node test with a real `EditorView` is possible in the `node` project (no DOM: likely not), add it instead.
3. **#1701 (boundary, should → promoted)** `ui/useMergeController.ts:152` — "The rule for a go-to that arrives before
   the controller exists … is written twice in two different shapes" (merge `pendingGoTos` factory with `ask`/`built`;
   range `Live.goTo`, `askGoTo`, an inline drain in `build`). Fix: write the merge side like the range side — a
   `pending` variable next to the controller, applied right after `reloaded` in the watch, an `ask` reading the same
   variable.
4. **#1702 (boundary, should → promoted)** `editor/internal/goTo.ts:48` — "`goTo.ts` holds two concepts: the go-to …
   and the Result's line-up (`ResultLineUp`, `resultLineUp`, `changeLines`)." Fix: move the line-up and its tests into
   `editor/internal/lineUp.ts` (+ `lineUp.test.ts`); name it in `editor/AGENTS.md`.
5. **#1713 (correctness, should → promoted)** `editor/internal/goTo.ts:40` — "`changeLines` puts a mid-line `to` in the
   line that holds it, and a non-empty span starting mid-line in the line that holds that start. Two touching spans
   whose shared edge became mid-line therefore get overlapping line ranges … Design §3.1 requires `SearchedFile.changes`
   to be "sorted and disjoint in every pane"." Fix: in `resultLineUp` start each centre range at no less than the
   previous range's end (`len` reduced to match); a test with two spans touching mid-line.

## Target

Owned: `frontend/src/editor/index.ts`, `frontend/src/editor/merge.ts` (new), `frontend/src/editor/internal/goTo.ts`,
`goTo.test.ts`, `lineUp.ts` (new), `lineUp.test.ts` (new) under `editor/internal/`, `frontend/src/editor/AGENTS.md`,
`frontend/src/ui/useMergeController.ts`, `frontend/src/ui/useMergeController.test.ts`.

Read-only: everything else; every name `editor/index.ts` exports today keeps being exported (same names, same types).
Merge tests stay passing unedited apart from import paths if any. Docs (`docs/architecture.md`, project map) are the
orchestrator's: report the new files.

## Acceptance

- Grep: four separate `updateListener`s for the Result's jobs; `index.ts` re-exports only (no class body);
  `merge.ts` ≤ 300 lines; one pending go-to shape in both hooks.
- Item 5's test fails before the fix (paste), passes after; item 2's probe values pasted.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check` pass; Stryker on `useMergeController.ts` keeps no
  survivor on your changed lines (paste).

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
