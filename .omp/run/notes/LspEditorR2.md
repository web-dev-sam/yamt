# LspEditorR2 (3.Y-editor fix round 2)

Fixed #945 in `format.ts`: a formatter that splits or joins a line next to an open conflict now leaves the block intact. All four new tests (A, B, B2, C) failed before the fix and pass after it. The round-1 tests still pass. `lint`, `typecheck`, `test` and `fmt:check` exit 0, but `unused` exits 1. It reports unused exports in `src/lsp/index.ts`, which this slice doesn't touch; I didn't confirm whether they were already there at the base commit `9de2e63`.

```
summary
  formatResult now matches lines inside each LineEdit with a second lineDiff on whitespace-free keys
  (`line.replaceAll(/\s+/g, "")`). Reindented lines are always paired with themselves. Pairing by position and
  inserting or deleting extra lines happen only in the sub-edits whose keys did not match. As before, an unpaired
  inserted line goes at the start of the next line. A split or join next to an open block, plus a reindent of the
  block's first or last line, no longer moves text across the block's edge.

files_changed
  frontend/src/editor/internal/format.ts
  frontend/src/editor/internal/format.test.ts

tests_added
  - "rule 5: $name keeps the block pending on both sides with its own lines, its arrows, in one undo step", run for:
      (A) a line split before the block, its first line reindented (3-line block)
      (B) two lines joined before a one-line block, the block reindented
      (B2) two lines joined before a two-line block, its first line reindented
      (C) a blank line added after the block's reindented last line
    Each checks: the Result equals the formatter's answer, status `pending pending`, the block's own text,
    `replace` arrows on both sides, `undoDepth` 1.
  - "rule 5: a result differing mostly in whitespace, lines split and joined, is applied exactly (Lf/CrLf)":
    300 seeded rounds per line ending, with whitespace variants of the same lines; checks that the result is
    applied exactly. It catches mistakes in the old/new index bookkeeping that the round-1 property test misses
    (shown below).
  - Test helpers `conflicted(eol, middleLen)` and `chunkRecord(middleLen)` take the block's length as a
    parameter; the default (3) keeps every round-1 test unchanged.

smoke_evidence
  Acceptance 1, before the fix (tests added, format.ts unchanged):
    $ pnpm -C frontend exec vitest run --project node src/editor/internal/format.test.ts --reporter=dot
    ·····xxxx············
    (A)  AssertionError: expected '  199\n  block 1\nblock 2\nblock 3\n' to be '  block 1\nblock 2\nblock 3\n'
    (B)  AssertionError: expected 'ignored ignored' to be 'pending pending'
    (B2) AssertionError: expected 'block 2\n' to be '  block 1\nblock 2\n'
    (C)  AssertionError: expected 'block 1\nblock 2\n  block 3\n\n' to be 'block 1\nblock 2\n  block 3\n'
    Tests  4 failed | 17 passed (21)
  Acceptance 1, after the fix:
    $ pnpm -C frontend exec vitest run --project node src/editor/internal/format.test.ts src/editor/internal/lineDiff.test.ts
    Tests  26 passed (26)        (round-1 reindent, CRLF and property tests included)
  Acceptance 2, failing path (format.ts mutated by hand, then restored):
    mutant 1: keys keep whitespace (`replaceAll(/\s+/g, " ")`):
      × (A) × (B) × (B2) × (C) — the same four assertion errors as before the fix; Tests 4 failed | 17 passed (21)
    mutant 2: `const nextFrom = unmatched.from;` (ignores the line shift):
      × rule 5: a result differing mostly in whitespace, lines split and joined, is applied exactly (Lf)
      × ... (CrLf)
      AssertionError: expected 'b c\n d ;\n\na\nc\nc\n d ;\nb c\n  \n…' to be 'b c\n d ;\n\na\nc\n d ;\nb c\n  \nc\n'
      Tests 2 failed | 19 passed (21)
  Acceptance 3:
    pnpm -C frontend lint       → lint=0
    pnpm -C frontend typecheck  → typecheck=0
    pnpm -C frontend test       → Test Files 88 passed (88); Tests 1093 passed (1093)
    pnpm -C frontend fmt:check  → "All matched files use the correct format." fmt=0
    pnpm -C frontend unused     → exit 1:
        Unused exports (2): addedSpecs, detect  src/lsp/index.ts:14
        Unused exported types (1): ProjectLookups  src/lsp/index.ts:15
      Not caused by this slice: `git status` shows only format.ts and format.test.ts changed; the exports come
      from the `lsp/` detection work at HEAD 9de2e63.

deviations_from_brief
  - `pnpm -C frontend unused` does not exit 0, for the `src/lsp/index.ts` reason above (outside Owned). Whoever owns
    `lsp/` needs to wire up or drop `addedSpecs`, `detect` and `ProjectLookups`.
  - I added a whitespace-heavy property test, beyond the four named cases. It is what catches the index-bookkeeping
    mutant; the round-1 property test lets it through.
  - `lineDiff.ts` and `lineDiff.test.ts` are unchanged; the fix reuses `lineDiff` as it is.

open_risks
  - A line inserted with no pair, exactly between a line outside the block and the block's first line, still goes
    at the start of the next line. Under CM1 (`from` maps with -1) it joins the block below. The brief keeps this
    behaviour ("as it does today"), and none of A/B/B2/C reaches it (frontend/src/editor/internal/format.ts:49-53).
  - Keys without whitespace can match lines that differ only inside a string literal's spaces, or blank lines that
    are not related to each other. Such lines are paired and edited character by character, so the result is still
    exact; only which block an edit lands next to could differ (frontend/src/editor/internal/format.ts:73-96).
```