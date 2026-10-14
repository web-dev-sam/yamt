# LspEditorR3 (3.Y-editor fix round 3, Gate B #952)

Fix round 3 is done: Ctrl/Cmd+S formatting now leaves out every edit that would touch a change still waiting on a side, or the line just before or after it, and applies the rest. All four #951 shapes (A), (B), (B2) and (C) now keep the block `pending pending` with its own text and `replace` arrows, whether the edge line changes in whitespace only or also gains a `;` or quotes. Lint, typecheck, `fmt:check` and the full test suite pass. `pnpm -C frontend unused` fails, but only on two exports in `src/lsp/index.ts`, which this slice did not touch (see open_risks).

```
summary
  formatResult(open, pane, field, closed) reads chunkField. A change counts as open when !isResolved (any changed side still pending).
  It drops every line edit (after the round-2 pairing) whose old lines overlap that change's lines, the line before or the line after.
  An edit that inserts lines exactly there is dropped too. The rest goes out as one `yamt.format` transaction.
  The outcome is `formatted` if any change was applied, `unchanged` (nothing dispatched) if none was left.
  Pieces that keep the line count are split into one edit per line, so a reindent spanning a block still formats the lines away from it.

files_changed
  frontend/src/editor/internal/format.ts
  frontend/src/editor/internal/format.test.ts
  frontend/src/editor/internal/serverDoc.ts
  frontend/src/editor/internal/serverDoc.test.ts
  frontend/src/editor/index.ts

tests_added (format.test.ts)
  "(A)/(B)/(B2)/(C) … is left out; the block stays pending with its own text and arrows, line 3 is formatted, one undo step"
    9 cases: whitespace-only, `;` on the edge line, and (B) with quotes. Each checks: outcome formatted, Result = only line 3 formatted,
    `pending pending`, block text unchanged, `replace` arrows on both sides, undoDepth 1.
  "a formatter reformatting the lines inside an open block leaves them as they were (Lf/CrLf)"
  "a half-decided conflict ($local $remote) and the lines next to it are not formatted" (applied/pending, ignored/pending, pending/applied)
  "a decided change ($local $remote) is formatted like any other line" (applied/applied, ignored/ignored, ignored/applied)
  "an answer that only touches an open change or the lines next to it is unchanged and dispatches nothing"
    7 answers: block deleted, line 199, line 203, the old "line before + first line" reindent, block lines, a blank inserted at either edge.
    Expects all `unchanged`, dispatched 0, same state.
  "random answers around an open block never change it or the lines next to it"
    200 seeded rounds of splits, joins, reindents, `;`, quotes, deletions and blanks over lines 191–213.
  "random answers away from an open block are applied exactly"
    200 rounds, edits only away from the block; the Result equals the answer.
  The two exactness property tests from rounds 1 and 2 now run with a `chunkField([])`, so every edit is kept and applied exactly.

smoke_evidence
  Acc 1, failing before the change (old format.ts; the test helper temporarily called the old 3-argument signature):
    pnpm -C frontend exec vitest run --project node src/editor/internal/format.test.ts
     × reindenting lines 198–204 formats 198 and 204 only … (Lf) / (CrLf)
     × (A) … ×2, (B) … ×3, (B2) … ×2, (C) … ×2
       e.g. AssertionError: expected 'line 1\nline 2\nline 3;\nline 4\nline…' to be 'line 1\nline 2\nline 3;\nline 4\nline…'
     × a formatter reformatting the lines inside an open block … (Lf) / (CrLf)
     × a half-decided conflict (applied pending) / (ignored pending) / (pending applied) …
     × an answer that only touches an open change … → expected [ { kind: 'formatted', …(1) }, …(6) ] to deeply equal [ { kind: 'unchanged', …(1) }, …(6) ]
     × random answers around an open block … → expected 'block 1\nblock\n2\nblock 3\n' to be 'block 1\nblock 2\nblock 3\n'
     × a closed Result is changedMeanwhile … (old signature)
          Tests  19 failed | 16 passed (35)
  Acc 1/2, after: format.test.ts + serverDoc.test.ts → Tests  42 passed (42)
  Acc 3, failing-path proof (format.ts mutated by hand, then restored; `cmp` with the saved copy → restored-identical):
    mutant 1, the rule removed (filter always true)              → Tests 18 failed | 17 passed (35)
    mutant 2, line before/after not guarded (block lines only)   → Tests 11 failed | 24 passed (35):
      198–204 ×2, (A)/(B)/(B2)/(C) with `;`, half-decided ×3, only-touches, random-around
    mutant 3, decided changes treated as open                    → Tests 3 failed | 32 passed (35) (the "decided change" cases)
    mutant 4, no line-by-line split                              → Tests 2 failed | 33 passed (35) (198–204 Lf/CrLf)
  Acc 4:
    pnpm -C frontend lint       → $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"; exit 0
    pnpm -C frontend typecheck  → $ vue-tsc -b; exit 0
    pnpm -C frontend fmt:check  → All matched files use the correct format. Finished in 567ms on 265 files; exit 0
    pnpm -C frontend test       → Test Files  89 passed (89)   Tests  1119 passed (1119); exit 0

deviations_from_brief
  - Owned list widened by Main: format.ts cannot reach the per-controller chunkField instance.
    Plumbing only: index.ts:101 passes `this.#field` to openResult; serverDoc.ts openResult/ServerDoc take `field`
    and pass it to formatResult(open, pane, field, closed); serverDoc.test.ts gives its panes and openResult calls a `chunkField([])`.
  - Pieces that keep the line count are split into one edit per line before the rule is applied, so it is checked per line, not per lineDiff group.
    This yields the same changes as pairing by position, and keeps "the lines away from the block formatted" when a reindent runs across a block.
  - "Open" means !isResolved (a changed side still pending), as the brief's Read-only note says.
    A side that did not change but still says "pending" does not keep a change open.
  - Round-1/2 tests updated to the rule:
    - "reindenting lines 198–204 …" now expects only 198 and 204 formatted; the block, 199 and 203 are kept, and the problem on line 200 is "untouched".
    - The round-2 (A)/(B)/(B2)/(C) whitespace-only cases now expect the edge edits left out, line 3 formatted, block unchanged.
    - "reindenting the line before an open block and its first line …" and "formatting that removes every line of an open block ignores it …"
      are now cases of the "only touches an open change → unchanged, nothing dispatched" test.
  - Test helpers: `answering`, `plain`, `decided` (sets statuses via placeSpans), `seeded`, `perturbed`, `linesNextToBlock`, `reindent`.
    `formatting` now takes the Merge.

open_risks
  - frontend/src/editor/internal/format.ts:114-122: a zero-line span ending mid-line at the end of the document (no trailing newline) guards the last line as a whole, which is more than needed.
  - `pnpm -C frontend unused` (not in this round's acceptance) fails on src/lsp/index.ts:14-15 (`detect`, type `ProjectLookups`), outside this slice; looks like the detect slice's work in progress.
```