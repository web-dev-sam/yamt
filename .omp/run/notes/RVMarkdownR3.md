The code-span case now fails when the `CodeSpans.#next` cursor is turned off and passes with it on. It is now its own test, with 60,000 spans.

**summary**
- The code-span case is split out of the linear-time test into its own test, `60,000 code spans parse in linear time`, using ``"`a` ".repeat(60_000)``.
- The timer now covers only the `parseInline` call; the 120,000-node `toEqual` check runs after the timer stops, so the comparison's cost doesn't affect the timing.
- The other test keeps the three non-code-span inputs and is renamed `unmatched openers, closers and brackets parse in linear time`. Both tests still use the 500 ms `LINEAR_MS`.

**files_changed**
- `frontend/src/editor/internal/markdownInline.test.ts`

**tests_added**
- `60,000 code spans parse in linear time`: proves that without the cursor the parse is not linear. With the cursor off it took about 2,060 ms against the 500 ms limit; with it on, the whole test took 260 ms.

**smoke_evidence**
- Cursor off: a temporary probe in the test (described under deviations), then `pnpm -C frontend exec vitest run --project node src/editor/internal/markdownInline.test.ts`:
  ```
   ❯ |node| src/editor/internal/markdownInline.test.ts (13 tests | 1 failed) 2218ms
     × 60,000 code spans parse in linear time 2064ms
   FAIL  |node| src/editor/internal/markdownInline.test.ts > 60,000 code spans parse in linear time
  AssertionError: expected 2059.948464 to be less than 500
   ❯ src/editor/internal/markdownInline.test.ts:163:39
   Test Files  1 failed (1)
        Tests  1 failed | 12 passed (13)
  ```
- Cursor on, with the probe removed (same command with `--reporter verbose`):
  ```
   ✓ |node| src/editor/internal/markdownInline.test.ts > unmatched openers, closers and brackets parse in linear time 90ms
   ✓ |node| src/editor/internal/markdownInline.test.ts > 60,000 code spans parse in linear time 260ms
   Test Files  1 passed (1)
        Tests  13 passed (13)
  ```
- `pnpm -C frontend test`:
  ```
   Test Files  184 passed (184)
        Tests  2479 passed (2479)
  ```
- `pnpm -C frontend fmt:check`:
  ```
  All matched files use the correct format.
  ```

**deviations_from_brief**
- I could not turn the cursor off by hand (`let index = 0` in `markdownInline.ts:53`): the ownership hook (SP1) blocked the edit because the file is Read-only for this slice.
  - Instead I used an in-process probe, the same one the re-check used, and Main approved it.
  - The probe swapped in a stand-in for the global `Map` around the single `parseInline` call in the new test. Its `get` returns `undefined` for number values, so the cursor restarts at index 0 on every call, which is the same as `let index = 0`.
  - On this input it changes nothing else: there are no parentheses, so `parenMatches` stays empty, and there are no emphasis marks, so the emphasis memo is never used.
  - I removed the probe afterwards; the file's snapshot tag (`#0EE1`) matches the one from before the probe.
- I chose the "own test" option rather than enlarging the shared test. The parse is timed alone so the comparison cost doesn't eat into the 500 ms window.

**open_risks**
- `frontend/src/editor/internal/markdownInline.test.ts:153-155` uses a wall-clock limit (the existing pattern). The margins are wide in both directions: with the cursor on, the whole test ran in 260 ms with the comparison included, and with it off, the parse alone took about 2,060 ms, roughly 4× the limit.