All four items are fixed, each has tests, and the five `pnpm -C frontend` commands pass.

**summary**
1. `branded(value, isBrand, field)` now lives in `ipc/validate.ts` next to `invalid`. `reviewDomain.ts`, `threadLine.ts` and `compareDomain.ts` call it, and their per-brand copies are gone (`leftLine`/`rightLine`, `toTabId`/`toColumnVersion`, the private `branded`).
2. All three Tauri sources (`tauri.ts`, `tauriCompare.ts`, `tauriRange.ts`) now return through `converted(toResult(await commands.x(…)), toY)`. No inline `result.ok ? … : result` is left in any of them.
3. The fixture's send loop reads `waitingText` right after the 300 ms pause, as Rust's `send_one` does. A message unqueued during the pause is skipped, still counted as done with progress reported, and never reaches `postOutcome`. `record` now receives the text.
4. Under `noMergeRequest` and `several` the fixture now always looks up by branch, using the right side's `named` label (new `rightBranch`). Only `noBranch` looks up by commit. A `mergeBase` right side throws `"a range's right side is never a merge base"`.

**files_changed**
- `frontend/src/ipc/validate.ts`, `validate.test.ts` (new)
- `frontend/src/ipc/reviewDomain.ts`, `threadLine.ts`, `compareDomain.ts`
- `frontend/src/ipc/tauri.ts`, `tauriCompare.ts`, `tauriRange.ts`, `tauriCompare.test.ts`
- `frontend/src/ipc/fixtureReview.ts`, `fixtureReview.test.ts`
- `frontend/src/ipc/fixtureGitLab.ts`, `fixtureGitLab.test.ts`

**tests_added**
- `validate.test.ts` › "branded returns a value its guard accepts" and "branded refuses %s, naming the field" (−1 and 0.5): the shared check passes good values through and throws with the field name.
- `tauriCompare.test.ts` › "openCompare, loadTab and setColumn return the app's error unchanged": covers the three commands whose `IpcError` path had no test before the switch to `converted`.
- `fixtureReview.test.ts` › "?gitlab=stopped skips a message unqueued before its post instead of stopping on it": the reply is `sent` with `sent: 1`, progress is `[{1,2},{2,2}]`, and message 1 is `notQueued`. The old code would have answered `stopped`.
- `fixtureGitLab.test.ts`, rebuilt around a `named` commit-id right side (`5d6e7f8`), replacing the `DETACHED` rows:
  - "%s looks the merge requests up by the right side's name as a branch, even a commit id" (`noMergeRequest`, `several`).
  - "only noBranch looks up by the right commit, even when the right side names a branch".
  - "a right side labelled as a merge base is refused as impossible".

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, with no errors.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, with no diagnostics.
- `pnpm -C frontend test` → `Test Files  192 passed (192)` / `Tests  2580 passed (2580)`.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend unused` → `$ knip --include exports,types`, with no findings.
- A verbose run of the four test files shows each new test name above as passed (`Tests  62 passed (62)`).

**deviations_from_brief**
- Item 4 needs an answer for the `mergeBase` arm, because the generated `RangeSideLabel` type still allows it on the right side. `rightBranch` is an exhaustive switch that throws there rather than looking anything up, and a test pins the throw.
- `tauriCompare.test.ts` gained the failure-path test for `openCompare`, `loadTab` and `setColumn` (not asked for). It is there so item 2 has a test for every converted call.
- The nits in the two reviews (the `field = "line"` default in `threadLine.ts`, the refusal test's seeded text in `fixtureReview.test.ts`, `FixedKind` in `problemText.ts`) and the PM6 map-check gap were not promoted in this round's brief and are untouched.

**open_risks**
- `fixtureGitLab.ts:82–117`: the `answers` table is built in full on every call, so a `mergeBase` right side would throw for every `?gitlab` script, `linedUp` included, not just the two that look up by branch. Rust never produces that data, and the committed fixtures (`range/review.json`, `range/empty.json`) both have a `named` right side, so this only matters for hand-made data.
- The same "brand or throw" check is still written out by hand in `domain.ts` (`toDiskVersion`, `nextColumnVersion`, the run id) and `rangeDomain.ts:53`. Those files are outside this round's Owned list; they could call `branded` in a later round.