The three test gaps are closed, and each new test fails when its guard is removed. `test`, `typecheck` and `lint` pass. `fmt:check` fails on one file: a Stryker report I created and couldn't delete. Main needs to run `rm -r frontend/reports`, then rerun `fmt:check`.

**summary**
- Two new tests cover Stop during the session step. During `session/load`, the turn ends `stopped`, no `session/prompt` is sent, and a re-ask on the thread is not busy. During `session/new`, no session is reported and no prompt is sent.
- The "loaded once per process" test now also checks that an ask on an existing thread reports no session.
- A new test shows a failed load is not kept: the thread's next ask sends its own `session/load`, prompts, and finishes.
- `settings.test.ts` now imports `AgentSettings` from `../ipc`, and its private alias is gone.

**files_changed**
- `frontend/src/agent/index.test.ts`
- `frontend/src/ui/settings.test.ts`

**tests_added**
- **"Stop while a thread loads ends the turn stopped; the late load prompts nothing"** (test 37) pins the `isStopped` return at `index.ts:186` for an existing thread. The load is held, the turn is stopped and ends `stopped`, then the load is answered. `methods()` stays `["initialize","session/load"]`. A re-ask on `s5` is not ended (not busy) and sends one `session/prompt`.
- **"Stop while session/new runs reports no session and prompts nothing"** (test 38) pins the same guard for a new thread. `session/new` is held, the turn is stopped, then it is answered with `s1`. `methods()` stays `["initialize","session/new"]` and `turn.sessions` is `[]`.
- **"a thread is loaded once per process before its prompts"** (test 5, extended) adds `expect(second.sessions).toEqual([])`, which pins the `request.session === null` check at `index.ts:193`.
- **"a failed load is not kept: the thread's next ask loads again and prompts"** (test 39) pins the delete at `process.ts:150-151`. The first load is refused and the ask fails; the next ask sends `initialize, session/load, session/load, session/prompt` and ends `finished`.

**smoke_evidence**

*Guard present:*
- `pnpm -C frontend exec vitest run --project node src/agent/index.test.ts src/ui/settings.test.ts` → `Test Files 2 passed (2)`, `Tests 93 passed (93)`.
- Again after oxfmt, `src/agent/index.test.ts` alone → `Tests 58 passed (58)`.

*Guard removed:* the ownership hook blocked a hand edit of `index.ts` ("[ownership/SP1] frontend/src/agent/index.ts is outside your slice"), so Stryker removed the guards in its sandbox copy.

Run 1 (bail on):
```
pnpm -C frontend exec stryker run --plugins @stryker-mutator/vitest-runner --testRunner vitest --mutate "src/agent/index.ts:186-196,src/agent/internal/process.ts:150-152" --reporters clear-text --tempDirName ../target/stryker-tmp --ignoreStatic
```
- index.ts: 14 killed, 0 survived.
- process.ts: 4 killed, 1 survived. The survivor is `process.ts:150:11` → `if (true)`, which the re-check already dropped as (a).
- Per test: `✓ Stop while a thread loads … (killed 2)`, `✓ a failed load is not kept … (killed 4)`, `✓ a thread is loaded once … (killed 1)`.

Run 2 (same command plus `--disableBail --reporters json`), each mutant with the tests that kill it:

| Mutant | Killed by |
|---|---|
| `186:9 if (false)` | `[37, 38]` |
| `186:28 {}` (block removed) | `[37, 38]` |
| `193:9 true` | `[5]` |
| `150:11 false` | `[39]` |
| `150:11 !==` | `[39]` |
| `151:9` delete removed | `[39]` |
| `150:49 {}` | `[39]` |

**Acceptance commands**
- `pnpm -C frontend test` → `Test Files 194 passed (194)`, `Tests 2602 passed (2602)`.
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no output, exit 0.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no output, exit 0.
- `pnpm -C frontend fmt:check`:
  - First run: `src/agent/index.test.ts` was flagged, and I ran `oxfmt` on it.
  - Final run: `reports/mutation/mutation.json (2ms) / Format issues found in above 1 files` → exit 1. The only flagged file is the Stryker report; every source file passes.

**deviations_from_brief**
1. **How the guards were removed:** the brief says "by hand", but the hook blocks edits outside owned files, so Stryker removed them in its sandbox copy. The table above lists the killing tests for each mutant.
2. **Stray report:** the Stryker JSON run wrote `frontend/reports/mutation/mutation.json`. `bash-guard` blocked `rm -r frontend/reports`, so it is still in the tree and is what makes `fmt:check` fail. Main needs to delete it before committing or running `fmt:check`.

**open_risks**
- `process.ts:150` `if (true)` still survives. That matches the re-check's drop (a): it only differs with two concurrent `replay`s of one session. It is not covered by these tests.