**summary**
The `^` anchor in the drive-letter pattern at `uri.ts:3` is now covered by a test. The new test passes against the current code. With the anchor removed, the same assertions fail. I changed only `uri.test.ts`; no product code changed.

There is a bug in `fileUri` that the brief asked me to test and I did not pin: a POSIX folder named `x:` comes out as `X:` (details under deviations).

**files_changed**
- `frontend/src/lsp/internal/uri.test.ts`

**tests_added**
- `only a leading /X: is a drive: a POSIX folder with a colon keeps its path`:
  - `absolutePath("/home/u/proj:v2", "src")` → `/home/u/proj:v2/src`
  - `absolutePath("/home/u/x:", "src")` → `/home/u/x:/src`
  - `absolutePath("/home/u", "x:/src")` → `/home/u/x:/src`
  - `fileUri("/home/u/proj:v2", "src/a.ts")` → `file:///home/u/proj%3Av2/src/a.ts`
  - The two nested `x:` cases are the ones that kill mutant #1044. `proj:v2` never matches the pattern, with or without the anchor, because only a single letter can come before the colon.

**smoke_evidence**
1. The test passes: `pnpm -C frontend exec vitest run --project node src/lsp/internal/uri.test.ts` → `Test Files 1 passed (1)`, `Tests 12 passed (12)`.
   It fails with the anchor removed. The hook blocked editing `uri.ts` and also blocked creating a separate throwaway test file, so I put a copy of `absolutePath` using `/\/([A-Za-z]:)/` into the owned `uri.test.ts` for one run, then removed it:
   ```
   × MUTANT: same assertions against SLASHED_DRIVE without ^
   AssertionError: expected '/home/ux:/src' to be '/home/u/x:/src' // Object.is equality
   Expected: "/home/u/x:/src"
   Received: "/home/ux:/src"
         Tests  1 failed | 12 passed (13)
   ```
   After removing the copy, the file's tag went back to `#03A1`, the same snapshot as before the copy was added.
2. Recipes (`node_modules` linked from the main checkout, link removed afterwards; `git status --short` → only ` M frontend/src/lsp/internal/uri.test.ts`):
   - `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
   - `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0
   - `pnpm -C frontend fmt:check` → `All matched files use the correct format. Finished in 666ms on 298 files`, exit 0
   - `pnpm -C frontend test` → `Test Files 100 passed (100)`, `Tests 1336 passed (1336)`, exit 0

**deviations_from_brief**
- **`fileUri` is not checked for the nested `x:` folder.** It does not keep that path unchanged: `encodeSegment` (`uri.ts:7-9`) tests every segment against `DRIVE` (`/^[A-Za-z]:$/`). So `fileUri("/home/u", "x:/a.ts")` gives `file:///home/u/X:/a.ts`, an upper-cased, unencoded segment, which names a different file on POSIX. Asserting that output would lock the bug in. Asserting the correct output would fail without a product fix that this slice doesn't allow. So `fileUri` is checked only with `proj:v2`. The fix would be to treat only the first segment after the root as a possible drive in `encodeSegment`/`fileUri`; it needs its own slice.
- **The mutant was shown inside the owned file.** Both the `uri.ts` edit and the new throwaway file were blocked by the ownership hook, so the mutant copy lived in `uri.test.ts` for one run and was then removed.

**open_risks**
- `frontend/src/lsp/internal/uri.ts:8`: the `fileUri` bug above. A POSIX folder named exactly one letter plus a colon gets a wrong URI, so a language server could be sent the wrong file.