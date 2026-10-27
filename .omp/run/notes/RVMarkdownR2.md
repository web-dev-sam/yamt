All three fixes from round 2 are in, and the earlier tests still pass. Typecheck and lint each fail on exactly one error, the known one in `ui/problemText.ts`; nothing in the markdown files is flagged. Test and format checks pass. With the memo disabled by hand, the new linear-time test failed at 1,856 ms; I then put the line back exactly as it was.

**summary**
- `ITEM` and `FENCE` (and `QUOTE`, so the three rules match) now have the `s` flag, so a line ending in U+2028/U+2029 no longer makes them backtrack quadratically.
- `interrupts` is split into `startsBlock` (list, quote, fence, heading, rule) plus `startsTable`. The table row loop stops only on `startsBlock`, so a `| - | - |` row after a data row stays in the same table. Paragraphs, lazy quote lines and lazy item lines still use the full `interrupts`.
- The inline linear-time test now also covers the `openers_bottom` memo and the code-span cursor.

**files_changed**
- `frontend/src/editor/internal/markdownBlocks.ts`
- `frontend/src/editor/internal/markdownBlocks.test.ts`
- `frontend/src/editor/internal/markdownInline.test.ts`
- `frontend/src/editor/internal/markdownTree.ts`: the memo line was removed for the experiment and restored; the file's snapshot tag is back to `#4829`, so it is unchanged.

**tests_added**
- **`a row of dashes after a data row stays a row of the same table`:** `| name | a |` / `|---|---|` / `| x | 1 |` / `| - | - |` / `| y | 3 |` gives one table with rows `[x,1]`, `[-,-]`, `[y,3]`. Before the fix this opened a second table and lost the dashes row.
- **`item and fence lines ending in U+2028 parse in linear time`:** all of these together stay under `LINEAR_MS` (500 ms), each with its exact expected blocks:
  - `-` + 100,000 spaces + U+2028 → a bullet list with one empty item
  - `1.` + 100,000 spaces + U+2028 → an ordered list starting at 1
  - 100,000 backticks + U+2028 → an empty code block
  - `p\n-` + 100,000 spaces + U+2028 → one paragraph (this goes through `interrupts`)
- **`unmatched openers, closers, brackets and code spans parse in linear time`** (renamed from the old linear test): it now also parses `"*a ".repeat(20_000) + "a_ ".repeat(20_000)` to one text node and ``"`a` ".repeat(20_000)`` to exactly 20,000 code/text pairs, inside the same 500 ms window.

**smoke_evidence**

Timings, from `pnpm -C frontend exec tsx -e` probes after the fix:

| Input | Time |
|---|---|
| bullet item, 100k spaces, U+2028 | 1.2 ms |
| ordered item, 100k spaces, U+2029 | 0.5 ms |
| fence, 100k backticks, U+2028 | 0.3 ms |
| fence, 100k tildes, U+2028 | 0.3 ms |
| paragraph then item line | 1.2 ms |
| quote, 100k spaces, U+2028 | 1.2 ms |
| closing fence, 100k spaces, then `x` | 0.3 ms |
| rule-like, 50k dash-space pairs, then `x` | 11.2 ms |
| rule, 3 dashes, 100k spaces, U+2028 | 1.8 ms |
| table delimiter of 100k dashes, then `x` | 0.8 ms |
| table row of 100k backslashes | 0.3 ms |
| heading of 100k `#`, U+2028 | 0.2 ms |
| table with 20k dash rows | 25.7 ms |
| `*a `×20k then `a_ `×20k | 79.3 ms |
| `*a `×20k then `a~~ `×20k | 40.8 ms |
| `` `a` ``×20k | 26.5 ms |
| `<a@`×20k | 16.5 ms |
| `<ab:`×20k | 18.9 ms |

For comparison, the old regexes on the same probe: old `ITEM` with 20k spaces + U+2028 took 883.7 ms, and old `FENCE` with 20k backticks + U+2028 took 343.7 ms.

**Memo disabled by hand** (`level.bottoms.set(key, this.#stack.length);` cut from `markdownTree.ts`), then `pnpm -C frontend exec vitest run --project node src/editor/internal/markdownInline.test.ts`:
```
× unmatched openers, closers, brackets and code spans parse in linear time 1871ms
AssertionError: expected 1856.0480850000001 to be less than 500
Tests  1 failed | 11 passed (12)
```

**Regex audit** — I checked every regex in the four files for the same problem (a greedy `.*` before `$` that fails when `.` stops at U+2028/U+2029):
- **`markdownBlocks.ts`:**
  - `HEADING` already had the `s` flag.
  - `CLOSING_FENCE` and `RULE` have no `.`, and each repeated group starts with a fixed character, so backtracking stays linear. Probes: closing fence 0.3 ms, rule 1.8 ms and 11.2 ms.
  - `WHITESPACE` tests one character, `LINE_BREAK` is a plain choice, and `/\s+/` is used only in a `split`.
- **`markdownTable.ts`:** `DELIMITER_CELL` is anchored with one quantifier (0.8 ms). `LEADING_PIPE`, `TRAILING_PIPE` and `CELL_PIPE` have no quantifiers; the lookbehind is one character (0.3 ms).
- **`markdownInline.ts`:**
  - `PUNCTUATION`, `SPACE` and `WORD` each test a single character.
  - `AUTOLINK` is anchored and each of its quantifiers stops at `<`, so one call never scans past the next `<` (16–19 ms).
  - `/\s+/` is used only in a `split`.
- **`markdownTree.ts`:** contains no regex.

Gate commands:
```
$ pnpm -C frontend typecheck
src/ui/problemText.ts(120,64): error TS2366: Function lacks ending return statement …   (the known one, nothing else)

$ pnpm -C frontend lint
src/ui/problemText.ts:122:11: error typescript(switch-exhaustiveness-check) …   (the known one, nothing else from oxlint)
$ pnpm -C frontend exec eslint --max-warnings 0 "src/**/*.vue" → ESLINT_OK   (the recipe's second half, run separately because the oxlint error stops the chain)

$ pnpm -C frontend test
Test Files  168 passed (168)
Tests  2149 passed (2149)

$ pnpm -C frontend fmt:check
All matched files use the correct format.
```

**deviations_from_brief**
- The old test `unmatched openers, brackets and parentheses parse in linear time` was renamed to `unmatched openers, closers, brackets and code spans parse in linear time`, since it now covers closers and code spans too.
- The `s` flag also changes behaviour slightly: a list item or fence line containing U+2028/U+2029 now parses as an item or fence instead of falling through to a paragraph. This matches what `HEADING` already did.
- `markdownTable.test.ts` and `markdownTree.test.ts` are listed as owned but don't exist; I didn't create them, because the new tests belong in the block and inline test files.
- I did not disable the code-span cursor by hand; the brief asks for that only for the memo. The new code-span case pins its result exactly, but I haven't shown that it would fail without the cursor.

**open_risks**
- `markdownInline.test.ts:139-154` uses a 500 ms wall-clock limit. It ran in about 150 ms here and 1,856 ms without the memo, but a very loaded CI machine could still make it flaky.