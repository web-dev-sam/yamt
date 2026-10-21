# GitOpsRevertText - notes (web-impl, 3.J row 12a)

Output fields verbatim.

The revert Abort message is now tested. With `case "Revert":` changed to `case "":`, both tests fail, and the received text shows the `[object Object]` bug. With the product code unchanged, `pnpm test`, `lint` and `fmt:check` all pass.

The ownership hook blocked my hand edit of `operationText.ts`. So I applied the mutation to a copy of the two files in `/tmp` and ran the test there; the product file in the tree was never touched, and the copy is deleted.

**summary**
- "the abort message counts the steps already done" has a Revert row: step 2 of 3 must contain `" The 1 commit already reverted is undone too. "`.
- "the first step has nothing done to name" now checks the whole message with `toBe` for its three rows (rebase step 1 of 5, rebase with no progress, revert step 1 of 2). Before, it only checked `not.toContain("undone too")`, which `[object Object]` slipped past.

**files_changed**
- `frontend/src/ui/operationText.test.ts`

**tests_added**
- `the abort message counts the steps already done` + Revert row: a revert at step 2 says one commit already reverted is undone too.
- `the first step has nothing done to name` (now one message per row): at a first step, `abortMessage` gives exactly the plain sentence for rebase and for revert, so any fallthrough that changes the text fails.

**smoke_evidence**
- Mutation (`case "Revert":` → `case "":` in the `/tmp` copy of `operationText.ts`, run with that copy's test file and a one-line vitest config), `vitest run -t "nothing done|steps already done"`:
  ```
  × the abort message counts the steps already done: {"kind":"Revert",...,"progress":{"step":2,"total":3}}
  × the first step has nothing done to name: {"kind":"Revert",...,"progress":{"step":1,"total":2}}
  Expected: " The 1 commit already reverted is undone too. "
  Received: "Every resolution and every save in this revert will be lost, and so will unsaved edits.[object Object] The repository goes back to how it was before the revert, and yamt closes."
  Expected: "Every resolution and every save in this revert will be lost, and so will unsaved edits. The repository goes back to how it was before the revert, and yamt closes."
  Received: "Every resolution and every save in this revert will be lost, and so will unsaved edits.[object Object] The repository goes back to how it was before the revert, and yamt closes."
        Tests  2 failed | 6 passed | 33 skipped (41)
  ```
- Restored: the copy was deleted; `frontend/src/ui/operationText.ts` was never changed.
- `pnpm -C frontend test`:
  ```
   Test Files  126 passed (126)
        Tests  1749 passed (1749)
  ```
- `pnpm -C frontend lint`:
  ```
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"
  exit=0
  ```
- `pnpm -C frontend fmt:check`:
  ```
  All matched files use the correct format.
  Finished in 1107ms on 365 files using 24 threads.
  ```

**deviations_from_brief**
- The ownership hook blocked the hand edit of `frontend/src/ui/operationText.ts` (outside the slice). I ran the mutation on a copy in `/tmp/yamt-mut-3J`, linked to the worktree's `node_modules`, then deleted the copy. If you want it observed in-tree, it's that one-line change to `operationText.ts:216`.
- The worktree had no `frontend/node_modules`, so I ran `pnpm -C frontend install --frozen-lockfile --offline` before the recipes.

**open_risks**
- None.

## Stryker on operationText.ts:200-226 after 4ffd4fc

24 mutants: `case "Revert"` killed; survived `case "SquashMerge"` -> `""` (:212, #1448); 2 NoCoverage on the `never` default (VF7 a).
