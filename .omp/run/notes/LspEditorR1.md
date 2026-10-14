# LspEditorR1 (3.Y-editor fix round 1)

All seven findings (#918, #919, #920, #922, #923, #924, #925) are fixed. Every new test failed against the old code, and the six layer recipes exit 0. The WebKit browser test (`problems.browser.test.ts`) was edited but not run: Playwright WebKit still can't start on this host.

```
summary
  Format (#922): each old line in a changed region is paired with a new one and changed only in the characters that differ. Extra lines are inserted or deleted whole, so no change crosses a line edge. Reindenting around an open conflict now leaves it `pending pending` with its arrows.
  Format (#923): the formatter's result is split on any line break, so an LF answer to a CRLF Result keeps CRLF and the right line count.
  Problems (#924): an answer that leaves the shown problems exactly as they are sends only the `answered` effect, with no `setDiagnostics`, so an open problem tooltip stays open.
  Problems (#919): the editor's own `version < last` check is gone; `answered` is kept only for the forgetting floor. Two answers with the same version are still both shown, and the later one wins.
  serverDoc (#918): `#counts` is gone; counts in `startState` and `state` are compared on each update. Tests (#920) use `isDocVersion` from lsp. The `useMergeController` fake now keeps the summary listener (#925).

files_changed
  frontend/src/editor/internal/format.ts
  frontend/src/editor/internal/format.test.ts
  frontend/src/editor/internal/problems.ts
  frontend/src/editor/internal/problems.test.ts
  frontend/src/editor/internal/serverDoc.ts
  frontend/src/editor/internal/serverDoc.test.ts
  frontend/src/editor/problems.browser.test.ts
  frontend/src/editor/AGENTS.md
  frontend/src/ui/useMergeController.test.ts

tests_added
  format.test.ts "rule 5: reindenting lines 198–204 around an open block keeps it pending on both sides, with its own lines, its arrows and the problems" (Lf and CrLf; #922)
    - The Result equals the formatted result, the block is `pending pending`, the block's text is the reindented block lines, and both sides show `["replace"]`.
    - Problems on lines 3 and 205 (not reformatted) stay where they were.
    - Problems on reformatted lines 198 and 200 stay on "198" and "block 1".
  format.test.ts "rule 5: reindenting the line before an open block and its first line leaves the block where it starts" (#922)
    - The block's range still starts at line 200 ("  block 1\nblock 2\nblock 3\n"), so it has not grown over line 199.
  format.test.ts "rule 5: a formatter's LF answer to a CRLF Result is split on every line break, and the Result stays CRLF" (#923)
    - The Result is CRLF, `doc.lines` equals the number of result lines, the block stays pending, and an answer that differs only in line endings is `unchanged`.
  problems.test.ts "rule 2: an answer that changes nothing shown sets no diagnostics, so an open problem tooltip stays" (#924)
    - A repeated identical answer carries no `setDiagnosticsEffect`.
    - A change in message, range, severity or code, or an empty answer, does carry one.
    - After the repeated answer, the other server's `[]` still keeps this server's problem (the owner map is kept).
  problems.test.ts "rule 2: answers for a version never taken or forgotten are dropped; a second answer for the same version replaces the first" (#919)
    - Replaces the old "older than the server's last answer" test and pins "same version: the later one wins".
  useMergeController.test.ts "summary: the editor's summary when built, then each change it reports, also from an editor rebuilt after a disk change" (#925)

smoke_evidence
  Acceptance 1 and 2: failing-path proofs. Each rule was broken in place, the test file run, then restored and re-run green.
    #922 + #923, old format.ts from HEAD (`pnpm exec vitest run --project node src/editor/internal/format.test.ts`):
      × reindenting lines 198–204 … (Lf)  /  × … (CrLf)   AssertionError: expected 'ignored ignored' to be 'pending pending'
      × reindenting the line before an open block …    AssertionError: expected '  line 199\n  block 1\nblock 2\nblock…' to be '  block 1\nblock 2\nblock 3\n'
      × a formatter's LF answer to a CRLF Result …      expected 'line 1\nline 2\nline 3;\n…' to be 'line 1\r\nline 2\r\nline 3;\r\n…'
      Tests  4 failed | 11 passed (15)
    #923 alone (split line put back to `state.toText(reply.result).toJSON()`):
      × a formatter's LF answer …   Tests  1 failed | 14 passed (15)
    #924, check disabled (`false && shownAlready(…)`):
      × an answer that changes nothing shown sets no diagnostics …   AssertionError: expected true to be false   Tests  1 failed | 8 passed (9)
    #924, no-op path given the new owner map instead of the kept one:
      × same test   AssertionError: expected [] to deeply equal [ 'a error kept (oxlint)' ]
    #919, equal versions dropped (`version <= last`):
      × answers … a second answer for the same version replaces the first
      × an answer that changes nothing shown …
      × two servers' problems … [] clears only that server's
      Tests  3 failed | 6 passed (9)
    #918, `before` set to a constant (always tells): × rule 4: counts go out … expected [ …(4) ] to deeply equal [ …(3) ]
    #918, `before` from `update.state` (never tells): × rule 4: counts go out … expected [] to deeply equal [ …(3) ]
    #925, `onSummaryChange((next) => {})`:
      × summary: … AssertionError: expected { conflicts: 2, changes: 5 } to deeply equal { conflicts: 1, changes: 5 }
      Tests  1 failed | 14 passed (15)
    All restored: `vitest run --project node src/editor src/ui/useMergeController.test.ts` → Test Files 35 passed (35), Tests 337 passed (337)
  Acceptance 2, stryker on ui/useMergeController.ts (the `just mutants` command line, `--mutate src/ui/useMergeController.ts`):
    killed 64, survived 14, errors 1.
    No survivor on lines 113–118 (summary/problems/unsaved listeners); the `onSummaryChange` mutant is killed.
    The 14 survivors are all on lines this round did not touch: 77–81, 87, 102, 131–134, 168, 180 (see open_risks).
  Acceptance 3 (`set -o pipefail; pnpm $s; echo exit`):
    lint exit=0, typecheck exit=0, unused exit=0, fmt:check exit=0 ("All matched files use the correct format."), sfc-order exit=0
    test exit=0: "Test Files 85 passed (85) / Tests 1055 passed (1055)"

deviations_from_brief
  1. #922, a decision the brief left open: extra new lines go at the end of the last paired line ("\n" + lines). A pure insertion with no paired line keeps the old placement, at the start of the next line.
  2. #924, a decision the brief left open: when nothing shown changes, the `answered` effect carries the previous owner map, because lint keeps the old Diagnostic objects. The comparison sorts JSON keys of (from, to, severity, message, source); source includes the server, so two servers' identical problems are never confused.
  3. #918: the `docChanged || setDiagnostics` gate in `updated` stays, so counts are not computed on selection-only or viewport-only updates. `PaneUpdate` gained `startState`.
  4. `problems.browser.test.ts` changed only for #920 (`isDocVersion`); it has not run.
  5. editor/AGENTS.md line 3 now states the new rules (lsp's no-older-answer guarantee, no re-set when nothing changed, any-break split, per-line pairing). The brief did not ask for it.
  6. Needed outside my files: cm6-rules CM1 or CM5 could add "a format edit never crosses a line edge". It is not required.

open_risks
  1. frontend/src/editor/internal/format.ts:49-54: extra lines after a pair join the block when the last paired line is inside an open block. Example: the formatter splits a block's last line into two; the new line belongs to the block. Untested beyond the property test.
  2. frontend/src/editor/internal/format.ts:30-47: the trimmed prefix and suffix compare UTF-16 code units, so a change can split a surrogate pair. The resulting text is exact (the property test covers exactness), but a cursor or problem mapped there could land mid-pair [INFERENCE: harmless].
  3. frontend/src/editor/internal/problems.ts:101-115: each answer now walks the shown diagnostics twice and sorts their keys. That is cheap for normal counts, but not measured with thousands of problems.
  4. frontend/src/ui/useMergeController.ts:77-81, 87, 102, 131-134, 168, 180: these 14 stryker survivors are older than this round and outside its findings, so they were left alone.
  5. frontend/src/editor/problems.browser.test.ts: still has not run on any host (Playwright WebKit cannot launch here).
```