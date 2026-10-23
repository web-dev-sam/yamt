# PasteCrashWindowR2 (3.F-paste fix round 2)

I removed the import cycle: `clipboardFence.ts` no longer imports anything from `./fences`. Typecheck, lint, fmt:check, unused and test all pass. I could not plant the read in `src/ipc/tauri.ts` itself, because the ownership hook blocked it. I ran the same check with the plant added in memory instead, and it reports `PM8`.

**summary**
- `clipboardViolations(path: string, texts: readonly string[])` now returns a `ClipboardViolation[]` defined in `clipboardFence.ts` itself: `{ readonly rule: "PM8"; readonly file; readonly specifier; readonly reason }`. It fits `FenceViolation`.
- `fences.ts:224` now calls `clipboardViolations(file.path, texts)`. The only edge left is `fences.ts` → `clipboardFence.ts`.

**files_changed**
- `frontend/scripts/clipboardFence.ts`
- `frontend/scripts/fences.ts`

**tests_added**
- None. The existing test "the real source tree has no fence violations" (`fences.test.ts:21`) already covers the PM8 path through `findFenceViolations(readSourceTree(...))`.

**smoke_evidence**
- `clipboardFence.ts` imports (search for `^import|from "` in the file): one line only, `1:import ts from "typescript";`.
- `pnpm -C frontend typecheck && … lint && … fmt:check && … unused && … test`:
  ```
  $ vue-tsc -b
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"
  $ oxfmt --check
  All matched files use the correct format.
  Finished in 850ms on 422 files using 24 threads.
  $ knip --include exports,types
  $ vitest run --project node
   Test Files  147 passed (147)
        Tests  1947 passed (1947)
  ```
  typecheck, lint and unused finished without printing anything, so none of the three found a problem.
- Planted read: I loaded the real `src/` tree with `readSourceTree` and appended `return event.clipboardData?.getData("text/plain");` to `src/ipc/tauri.ts`'s text in memory. Then I ran `findFenceViolations` on it, with `pnpm exec tsx -e …` in `frontend/`:
  ```
  [{ "rule": "PM8", "file": "src/ipc/tauri.ts", "specifier": "event.clipboardData",
     "reason": "only ui/linuxPaste.ts reads the clipboard through WebKit (plan §2 #99)" }]
  ```
  The real-tree test asserts exactly this call returns `[]`, so with the plant on disk it would fail with this line. No file on disk was changed, so there is no plant to remove.

**deviations_from_brief**
- The plant did not go on disk. The SP1 ownership hook refused writing to `frontend/src/ipc/tauri.ts`, and it also refused copying `frontend/scripts` to `/tmp` (it treats the source path as outside the slice). I ran the fence's own entry point on the real tree with the plant added in memory instead (evidence above). If you want the literal on-disk run, someone with ownership of `src/ipc/tauri.ts` needs to add the plant and run `pnpm -C frontend exec vitest run --project node scripts/fences.test.ts`.
- I removed the `satisfies FenceViolation` from the `map` callback. The declared return type `ClipboardViolation[]` already checks the object, and the `push` at `fences.ts:224` checks that it fits `FenceViolation`.
- `fences.test.ts` needed no change.

**open_risks**
- `frontend/scripts/clipboardFence.ts:3-8`: `ClipboardViolation` repeats the field shape of `FenceViolation` (`fences.ts:11-16`), which the brief asked for. If `FenceViolation` gains a required field, the `push` at `fences.ts:224` stops compiling, so the two can't drift apart silently.