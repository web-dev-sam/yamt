# SaveWebR2 (3.Z-web fix round 2)

**summary**
After the user deletes the line break above a waiting conflict and then applies a side, the applied span now starts on the side's first line. Before, it started on the line above. A new `startOnOwnLine` in `apply.ts` does this inside `chainedChanges` when the apply replaces the span (not when it appends). It moves the span's `from` past the leading break `wholeLines` inserted, so the span holds "L\n" instead of "\nL\n". The centre band and strip rows now cover only the applied lines. Save writes one marker block with no blank line. All four layer recipes exit 0.

**files_changed**
- `frontend/src/editor/internal/apply.ts`
- `frontend/src/editor/internal/apply.test.ts`
- `frontend/src/editor/internal/fileText.test.ts`

**tests_added**
- `apply.test.ts` › "a side applied after the line break above a waiting conflict was deleted starts on its own line". Starting from "ab\nz\n" (the join), applying Local gives "a\nL\nz\n" with span text "L\n" and band lines `[2]` only. Applying Remote then gives span text "L\nR1\nR2\n". A second case covers the append path: Local applied, the break above deleted again ("aL\nz\n"), then Remote applied. The span keeps "L\nR1\nR2\n", which pins that only the replace path moves `from`.
- `fileText.test.ts` › "a side applied after the line break above a waiting conflict was deleted is written as one block with no blank line". After the join and applying Local, `written` is exactly `a\n<<<<<<< ours\nL\n=======\nR1\nR2\n>>>>>>> theirs\nz\n`.

**smoke_evidence**
1. Before the fix: `pnpm -C frontend exec vitest run --project node src/editor/internal/apply.test.ts src/editor/internal/fileText.test.ts -t "line break above a waiting conflict"`
   - `AssertionError: expected '\nL\n' to be 'L\n'` (apply.test.ts:622)
   - `AssertionError: expected 'a\n<<<<<<< ours\n\nL\n=======\nR1\nR2…' to be 'a\n<<<<<<< ours\nL\n=======\nR1\nR2\n…'` (fileText.test.ts:281)
   - `Tests  2 failed | 47 skipped (49)`

   After the fix, the same two files in full: `Tests  49 passed (49)`. The round-1 tests are among them and stay green, including "a side applied where a line break at the change's edge was deleted lands on lines of its own" and "a line break deleted at a waiting change's edge is written back…".
2. Failing-path proof. Each change below was made by hand to a temporary copy of `apply.ts`, the tests were run, and the original was put back with `cp`. Stryker was not run on `editor/`.
   - Dropping the fix (`state = click.state;`): both new tests fail, `Tests  2 failed | 346 passed (348)`.
   - Dropping the replace-only condition (`replaces = kind === "apply"`): `AssertionError: expected 'R1\nR2\n' to be 'L\nR1\nR2\n'`, `Tests  1 failed | 347 passed (348)`.
   - Dropping the empty-span guard: "bulk apply over touching spans whose last deletes an unterminated final line equals clicking each" and "a change on an unterminated last line keeps the file without a final line break" fail, `2 failed`.

   After restoring: `Tests  348 passed (348)`.
3. Layer recipes:
   - `pnpm -C frontend fmt:check` → `All matched files use the correct format.`, exit 0
   - `pnpm -C frontend lint` → `oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings, exit 0
   - `pnpm -C frontend typecheck` → `vue-tsc -b`, exit 0
   - `pnpm -C frontend test` → `Test Files  89 passed (89)`, `Tests  1121 passed (1121)`, exit 0

**deviations_from_brief**
- **Fix:** The brief suggested placing the span at `from + 1` (or mapping the start with assoc 1). I did it as one extra throwaway step instead. After a replacing apply, `startOnOwnLine` sets the fields with `placeSpans`, moving that chunk's non-empty span from mid-line to the start of the next line. This is the same chain the final `placeSpans` already reads, so the change set is unchanged and the action is still one undo step (CM7). `chunkField.ts` is not touched.
- **Extra test case:** I added the append-path case, beyond the two tests the brief names, because without it dropping the replace-only condition went undetected.
- **Mutation method:** I made the hand changes in proof 2 with `sed -i` on a temporary copy and put back the original with `cp` each time. No such change is left in the tree.

**open_risks**
- `frontend/src/editor/internal/apply.ts:87-99`: `startOnOwnLine` relies on `wholeLines` (apply.ts:49-62) always inserting a leading break when a replace starts mid-line. If `wholeLines` stops doing that, the span would skip a real line. The new apply test would catch that.