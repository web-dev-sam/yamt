All eight items from the fix-round brief are done, and every acceptance item is met. `typecheck`, `lint`, `test`, `fmt:check` and `sfc-order` all pass, and the real app still opens the range window. Two equivalent Stryker survivors remain in `fences.ts`; the four other survivors in `problem.ts` are on lines this round did not write (open_risks).

**summary**
- A failed `openRange` now has its own Problem kind, `{ action: "openRange"; cause }`. It is logged as `store.openRange_failed` and its words are "Could not open the range: …" in `problemText.ts`. `RANGE_WORD` is gone.
- `loadFile(entry: RangeEntry)` uses `entry.id` and `entry.path`, and clears the problem through the shared `clearProblemAbout`. The id lookup, the `file ${id}` fallback and the "names file 3" test case are gone.
- `RangeHandle.shown` / `RangeShown` are renamed to `content` / `RangeContent`. `shownHosts<D, S>` is exported and tested.
- `fences.ts` has typed roots (`Root`, `WindowRoot`) and an `isWindowRoot` guard. The `Recording` re-export is deleted. A pure `appArgs(opens, repoDir)` in `startArgs.ts` builds the launch argv; `prepareApp` calls it, with a new `repoFolder` helper.

**files_changed**
- `frontend/src/ui/rangeStore.ts`
- `frontend/src/ui/rangeStore.test.ts`
- `frontend/src/ui/problem.ts`
- `frontend/src/ui/problem.test.ts`
- `frontend/src/ui/problemText.ts`
- `frontend/src/ui/problemText.test.ts`
- `frontend/src/ui/useRangeController.ts`
- `frontend/src/ui/useRangeController.test.ts`
- `frontend/src/ui/RangeView.vue`
- `frontend/scripts/fences.ts`
- `frontend/scripts/app-session/args.ts`
- `frontend/scripts/app-session/args.test.ts`
- `frontend/scripts/app-session/startArgs.ts`
- `frontend/scripts/app-session/start.ts`
- `frontend/scripts/app-session/video.ts`

**tests_added**
- `problem.test.ts` "a failed openRange logs its cause under its own event": pins the `store.openRange_failed` log line with the cause's fields.
- `problemText.test.ts` "a failed openRange says the range could not be opened, with git's words": pins "Could not open the range: bad revision".
- `rangeStore.test.ts` "a failed openRange reports the range and shows nothing" (rewritten): the store holds `{ action: "openRange", cause }`, the shown words are "Could not open the range: the app is gone", and exactly one `store.openRange_failed` line is logged. The other `loadFile` tests now pass entries.
- `useRangeController.test.ts` "no hosts while the %s ref is still null" (left/right/strip): three set refs give the hosts; any one null ref gives `null`.
- `args.test.ts` "the app opens the range window with --diff=<range> and --repo, …": checks the argv for range, diff, dir and fresh.

**smoke_evidence**
- `pnpm -C frontend typecheck && lint && fmt:check && sfc-order && test` → `vue-tsc -b` clean; oxlint/eslint with no output and exit 0; "All matched files use the correct format."; `Test Files 162 passed (162)`, `Tests 2098 passed (2098)`.
- **Failed `openRange` words:** checked with the node test of words and store, which the brief allows instead of MiniBrowser (the `rangeStore`, `problemText` and `problem` tests above, all passing).
- **Real app:** built the debug app (`cargo tauri build --debug --no-bundle`), ran `scripts/range-repo.sh /tmp/rvw-r1-repo`, then `just app-session start-app --name rvwr1 --range main...feature --repo /tmp/rvw-r1-repo`.
  - The start reply showed `"repoDir":"/tmp/rvw-r1-repo"`.
  - `read` of `dataset.window` returned `range | yamt | Files`.
  - The screenshot `/tmp/rvw-r1-app.png` shows the file list and "config" with its sentence.
  - After clicking `docs/current.md`, the columns read `shortcuts.md || keys.md`; `git show feature:docs/current.md` gives `keys.md`.
  - Session stopped.
- **Stryker on the changed lines:**
  - `rangeStore.ts` 100 %, `useRangeController.ts` 100 %, `problemText.ts` 100 %, `startArgs.ts` 100 % (18/18).
  - `fences.ts` 26 killed, 2 survived; both are equivalent, see open_risks.
  - `problem.ts`: all 5 survivors and the 1 no-coverage mutant are on the existing `stopped`/`reset` lines (92–105). My lines 42 and 82 have none.

**deviations_from_brief**
- `appArgs(opens, repoDir: string | null)` adds `--repo <dir>` whenever a repo is passed, for every kind, `diff` included. `prepareApp` passes `null` only for `diff`. My first version dropped the repo for `diff`, which left the null branch unreachable and Stryker kept 2 survivors on it.
- `problem.ts` `logProblem`: removed the `never` default because the added case pushed the function to 41 lines (cap 40). Exhaustiveness is still checked by tsgolint's `switch-exhaustiveness-check`, the second form TS3 allows.
- `fences.ts`: the guard is `root = …?.toLowerCase() ?? ""` then `!isWindowRoot(root)`, with no separate `undefined` check; this removed two equivalent mutants.
- The `RangeApp.vue` empty-text nit (VU16) is not done: it is not one of the brief's eight items.
- Kept the `RangeController` build call in `useRangeController.ts` exactly as in the base, as you asked.

**open_risks**
- `frontend/scripts/fences.ts:130`: two Stryker survivors are equivalent. `?.[1].toLowerCase()` cannot differ because the regex group is required whenever it matches. A changed `?? ""` fallback string is still not a window root.
- `frontend/scripts/app-session/start.ts` `repoFolder` (runs `conflict-repo.sh` for fresh) has no unit test; only the range path was run for real.
- `.omp/run/slices.json` shows as changed in the worktree; I did not touch it.