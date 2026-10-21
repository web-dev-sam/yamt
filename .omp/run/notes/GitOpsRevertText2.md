# GitOpsRevertText2 - notes (web-impl, 3.J row 12a round 2)

Output fields verbatim.

summary

- I added a SquashMerge row to the Abort-message test, beside Merge's. It checks the whole message with `toBe`.
- If `case "SquashMerge"` in `doneSentence` (`operationText.ts:212`) is dropped, this test now fails. No other test catches that mutant.
- Product code is unchanged.

files_changed

- `frontend/src/ui/operationText.test.ts`

tests_added

- `a merge's abort message is plan #74's, word for word: %j` replaces the single-case Merge test with a two-row `test.each`:
  - **Merge:** the exact message is unchanged from before.
  - **SquashMerge:** the exact message is "Every resolution and every save in this squash merge will be lost, and so will unsaved edits. The repository goes back to how it was before the squash merge, and yamt closes." This kills the `case "SquashMerge"` → `case ""` mutant.

smoke_evidence

- **Mutant on a `/tmp/sq1448` copy** (`sed '212s/case "SquashMerge":/case "":/'`, then `npx vitest run --project node src/ui/operationText.test.ts`):
  ```
     case "Merge":
     case "":
       return "";
  ...
   FAIL  |node| src/ui/operationText.test.ts > a merge's abort message is plan #74's, word for word: {"kind":"SquashMerge","merging":{"kind":"Branch","name":"feature/reminders"},"into":{"kind":"Branch","name":"main"}}
  Expected: "Every resolution and every save in this squash merge will be lost, and so will unsaved edits. The repository goes back to how it was before the squash merge, and yamt closes."
  Received: "Every resolution and every save in this squash merge will be lost, and so will unsaved edits.[object Object] The repository goes back to how it was before the squash merge, and yamt closes."
        Tests  1 failed | 41 passed (42)
  ```
- **`pnpm -C frontend test`:**
  ```
   Test Files  126 passed (126)
        Tests  1750 passed (1750)
  ```
- **`pnpm -C frontend lint`:** it printed no findings.
  ```
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"
  exit=0
  ```
- **`pnpm -C frontend fmt:check`:**
  ```
  All matched files use the correct format.
  Finished in 741ms on 365 files using 24 threads.
  ```

deviations_from_brief

- The worktree has no `frontend/node_modules`. To run the recipes, I linked `/home/wds/Projects/yamt/frontend/node_modules` into the worktree for the duration of the runs only. I removed the link afterwards and deleted the `/tmp` copy.

open_risks

- None. `node_modules` came from the main repo, not a fresh install in the worktree, so `pnpm -C frontend test` should be rerun on the merged tree.

## Stryker on operationText.ts:200-226 after 4093d45

25 mutants: 23 killed, 2 NoCoverage on the unreachable `never` default (VF7 a), 0 survived.
