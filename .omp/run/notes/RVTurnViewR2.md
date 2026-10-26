Both items are done: a side's last line with no line break no longer gets a line-ending word, and new tests kill all four named survivors. Test, `fmt:check`, `typecheck` and `lint` pass. Stryker leaves 2 survivors, neither on the named lines; both look equivalent (below).

**summary**
- `editDiffLines.ts` gains `lacksBreak(side, line)`, used by `addLastLine` and by both the removed and added rows. A last line with no line break now gets `ending: null`; its pair keeps its own word.
- The C1 test now uses two-character CRLF lines, so the `withoutCr` slice survivor dies.
- New tests: a last line without a line break in both directions, and uneven pairs whose next unchanged line differs only by `\r`, in both directions.
- The `diffRowCells` test now includes an added row with `ending: null`.

**files_changed**
- `frontend/src/ui/editDiffLines.ts`
- `frontend/src/ui/editDiffLines.test.ts`

**tests_added**
- "a last line without a line break claims no ending; its pair keeps its own": `"a\r\n"`→`"a"` gives `-1 a [crlf]`, `+1 a`, `\`; the reverse gives `-1 a`, `\`, `+1 a [crlf]`. With the added-side fix temporarily reverted, this test fails (`Tests 1 failed | 12 passed`); after restoring, 13 pass.
- "an unpaired changed line is never paired with the unchanged line after the change": old `"a\r\nc\r\nc\n"`, new `"a\nc\n"`, `[0,2,0,1]` gives `-1 a [crlf]`, `-2 c`, `+1 a [lf]`, ` 3:2 c`. The mirror case `[0,1,0,2]` gives `-1 a [lf]`, `+1 a [crlf]`, `+2 c`, ` 2:3 c`. This kills the old `:130` and `:142` mutants.
- C1 test changed to `"ab\r\ncd\r\n"`→`"ab\ncd\n"`, which kills the old `:65` `slice(0, +CR.length)` mutant.
- `diffRowCells` test: an added row with `ending: null` has note `""`, which kills the old `:202` mutants.

**smoke_evidence**
- `pnpm -C frontend test` → `Test Files 197 passed (197)`, `Tests 2651 passed (2651)`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend typecheck` → `vue-tsc -b`, no errors
- `pnpm -C frontend lint` → `oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
- `pnpm -C frontend exec stryker run --plugins @stryker-mutator/vitest-runner --testRunner vitest --mutate src/ui/editDiffLines.ts --reporters clear-text --tempDirName ../target/stryker-tmp --ignoreStatic` →
  ```
  File              |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
  editDiffLines.ts  |  96.14 |   99.12 |      220 |         4 |          2 |        7 |        0 |
  ```
  The four helper lines added earlier in the file move the named lines down: `:65`→`:69`, `:130`→`:134`, `:142`→`:146`, `:202`→`:206`. None of them has a survivor or a no-coverage mutant.
  - **Survivor `:58` `open: false` → `true`:** the re-check already judged this equivalent (`lacksBreak` compares the line with -1, and no loop index is ever -1).
  - **Survivor `:109` `length <= LONGEST_SHOWN_RUN` → `<`:** looks equivalent, but the re-check did not rule on it. At length 6, the two context blocks are 3 + 3, so nothing is skipped and the rows are the same.
  - **No coverage (7 mutants):** the `?? ""` fallbacks at `:95`, `:133`, `:145` and the `never` default branches at `:112`, `:215`. The re-check judged these unreachable.

**deviations_from_brief**
- `lacksBreak` is a new private helper with three call sites that must agree. I did not add the optional shared `endingNote(ending)`; the brief allows the test row instead.

**open_risks**
- `frontend/src/ui/editDiffLines.ts:109`: the new `<=` → `<` survivor needs a verdict from the reviewer.
- `frontend/src/ui/editDiffLines.ts:69`: a last line with no line break that ends in `\r` (text `"a\r"`) still has the `\r` removed from its shown text, though its ending is now `null`. The brief does not cover this, and I did not change it.