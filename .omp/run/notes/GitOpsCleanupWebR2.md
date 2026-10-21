# GitOpsCleanupWebR2 - notes (web-impl, 3.J row 11b fix round 2)

Output fields verbatim.

Both fixes are in, and all five frontend recipes pass on the final tree. The changed Continue test failed on `b56f16e` and passes now. I didn't commit, as the brief requires.

summary
- #1438: when git refuses Continue, `continuing.ts` now hands the refusal to `reportFailure(target, { action: "continue", operation: operation.kind, cause })`. It calls `refreshFiles()` only after a `Git` refusal. Continue's own `StopMovedOn` branch is deleted, so every `StopMovedOn` (Continue's too) is logged and reaches `nextStop({ kind: "outside" })` once, through one path.
- #1439: `summaryLabel.ts` now checks at compile time that the label order lists every `MergeSummary` key exactly once. The word table's keys are the checked order's keys (`EveryKeyOnce<typeof LABEL_ORDER>[number]`). If a key is missing, listed twice, or not a `MergeSummary` key, that key type becomes `never` and the table lookup fails to compile. The output is unchanged.
- `ui/AGENTS.md` (lines 13 and 21) now says Continue's `StopMovedOn` also goes through `reportFailure`.

files_changed
- frontend/src/ui/continuing.ts
- frontend/src/ui/continuing.test.ts
- frontend/src/ui/summaryLabel.ts
- frontend/src/ui/AGENTS.md

tests_added
- `continuing.test.ts` "StopMovedOn is logged and goes on to the stop git is at once, instead of showing a problem" (rewrites the existing test). It checks that the log line `[error] store.continue_failed {operation: "Rebase", kind: "StopMovedOn"}` is written exactly once, that `ends` is exactly `[{kind:"outside"}]`, that no problem is shown, that the file list is not re-read, and that Continue is `ready` afterwards.

smoke_evidence
- **The test on the `b56f16e` code:** I put the old `continuing.ts` back with the edit tool, ran `git diff --quiet b56f16e -- frontend/src/ui/continuing.ts && echo …` (printed `continuing.ts == b56f16e`), then ran `pnpm -C frontend exec vitest run --project node src/ui/continuing.test.ts`:
  ```
  × StopMovedOn is logged and goes on to the stop git is at once, instead of showing a problem
  AssertionError: expected [] to deeply equal [ Array(1) ]
  - [ "[error] store.continue_failed {operation: \"Rebase\", kind: \"StopMovedOn\"}", ]
  + []
   Tests  1 failed | 14 passed (15)
  ```
- **The same test after the fix** (run after formatting):
  ```
   Test Files  1 passed (1)
        Tests  15 passed (15)
  ```
- **#1439 check:** with the valid order, `pnpm -C frontend typecheck` passed. I then broke the order on purpose twice:
  - Order `["changes","conflicts"]` (a key missing) → `src/ui/summaryLabel.ts(29,27): error TS7053: … can't be used to index type 'Readonly<Record<never, Words>>'.`
  - Order `["changes","conflicts","remembered","changes"]` (a key twice) → the same TS7053 error at `(29,27)`.
  - I then put the original order back.
- **`pnpm -C frontend typecheck`:** `$ vue-tsc -b`, no errors.
- **`pnpm -C frontend test`:** `Test Files  126 passed (126)` / `Tests  1748 passed (1748)`.
- **`pnpm -C frontend lint`:** `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no output; also re-run after formatting.
- **`pnpm -C frontend unused`:** `$ knip --include exports,types`, no output.
- **`pnpm -C frontend fmt:check`:** the first run flagged `src/ui/continuing.test.ts`. After `oxfmt src/ui/continuing.test.ts`: `All matched files use the correct format.`

deviations_from_brief
- I picked the compile-time check over the brief's other option (one ordered entries array). It costs one type alias, `EveryKeyOnce`, in `summaryLabel.ts`. The order is still written once, as an `as const` tuple, with the word table keyed from it.
- I didn't need to change `problem.ts` or `problem.test.ts`: `reportFailure` already does what this needs.

open_risks
- `frontend/src/ui/summaryLabel.ts:29`: a broken order shows up as an indirect error (TS7053 "can't be used to index … Record<never, Words>" at the lookup), not at the `LABEL_ORDER` line. The name `EveryKeyOnce` is the only hint at the cause.
- `frontend/src/ui/continuing.ts:74`: the `nextStop` parameter in `ContinueTarget` (`StopEnd`) has to keep accepting `{ kind: "outside" }` for the target to fit `EndsStop`. The type check confirms this today.

## Mutants (`just mutants de5f41f`, both round-2 commits)

Rust 1 - 1 unviable. TS (continuing.ts, summaryLabel.ts): 130 killed, 2 survived on unchanged lines continuing.ts:65 (`operation.kind === "Rebase"` -> true) and :113 (`operation === null` -> false), both dropped in row 8's review as VF7 (a) (notes GitOpsContinue-mutants.md).


## Boundary re-check (GitOpsCleanupR2Boundary): pass, should #1442 (carried)

```json
{
  "verdict": "pass",
  "round": "3.J-cleanup fix round 2 re-check (RV8): ca74e42 (#1438, #1439), d851002 (#1440)",
  "findings": [
    {
      "id": "#1439-recheck",
      "severity": "should",
      "rule_id": "vision-1 / principles §2 (reader load)",
      "file": "frontend/src/ui/summaryLabel.ts",
      "line": 7,
      "problem": "You asked whether `EveryKeyOnce` is readable or clever. It is clever: a recursive conditional type that infers a variadic tuple with an `infer … extends` constraint and tests for never with the bracket trick. When it trips, the error does not appear at `LABEL_ORDER`. It appears as TS7053 on `Record<never, Words>` at the lookup (line 29), as the implementer's open_risks says. So a TS-proficient owner who adds a fourth key gets a puzzle in place of a pointer. It stays inside one module, so it has no effect on growth and does not reach the block bar.",
      "fix": "Replace the 10-line recursive alias with a check that only catches missing keys: `const LABEL_ORDER = [\"changes\", \"conflicts\", \"remembered\"] as const satisfies readonly Key[]; type Unlisted = Exclude<Key, (typeof LABEL_ORDER)[number]>;`, then type the table `Readonly<Record<[Unlisted] extends [never] ? Key : never, Words>>`. Drop the duplicate check: a listed-twice key shows twice in the label, and the full-label assertions in summaryLabel.test.ts:16-18 already catch that."
    }
  ],
  "checked": [
    "#1438 fixed, continuing.ts:69-78: `refused` calls `reportFailure(target, { action: \"continue\", operation: operation.kind, cause })` and calls `refreshFiles()` only when `cause.kind === \"Git\"`. Continue's own `StopMovedOn` branch is gone. `landing` (:80-91) keeps only Stopped → `nextStop({ kind: \"continued\" })` and Finished → `log.info`.",
    "One path in the window: `StopMovedOn` turns into `nextStop({ kind: \"outside\" })` only in problem.ts:110-113 (`reportFailure`). listing.ts:28 handles `Listing::MovedOn`, which is a different reply. Every refusal-handling caller goes through `reportFailure`: aborting.ts:52, continuing.ts:74, saving.ts:130/156/185/220, views.ts:65, store.ts:271. grep found no other `StopMovedOn` branch under ui/.",
    "Log line: `reportFailure` calls `logProblem`, and its `continue` case (problem.ts:72-74) logs `store.continue_failed {operation, kind}`. continuing.test.ts:294-305 asserts that exact line once, `ends == [{kind: \"outside\"}]`, no problem, no extra list, and the state back at `ready`. The notes show it failing on b56f16e and passing now.",
    "Types: `ContinueTarget.nextStop(end: StopEnd)` accepts the wider `StopEnd` (stops.ts:14-16), so the target satisfies `Target & EndsStop` without a cast. `problem: ShallowRef<Problem | null>` is present.",
    "ui/AGENTS.md:13 now says every `StopMovedOn` (the writes, Abort, Continue, an open, every reload) goes once to `nextStop({ outside })` through `problem.ts` `reportFailure`, the one path. AGENTS.md:21 says Continue's refusals go through `reportFailure`, and that a `Git` refusal lists again. No second place is documented any more.",
    "#1439 output unchanged: `LABEL_ORDER` is still `changes, conflicts, remembered`, the words are identical, and summaryLabel.test.ts covers singular, plural, empty and all three keys. The notes show the broken-order typecheck failing for a missing key and for a key listed twice.",
    "#1440 shape, merge.rs:160-176: there is one match on `worker.await`. In the `Ok((session, Err(error)))` arm, `matches!(error, yamt_session::Error::StopMovedOn)` picks `moved_on(&session)`, and every other error goes back to `Held(session)`. `error.into()` still maps `StopMovedOn` to `IpcError::StopMovedOn` (ipc_error.rs:62), so the answer is unchanged.",
    "`moved_on` (merge.rs:140-145) is the only place that builds `Merge::MovedOn { root, highest_disk_version }`. Its callers are `list_stop`'s `Refreshed::MovedOn` (:102), `on_worker`'s `after_a_panic` (:155), the new StopMovedOn arm (:165) and Continue's `Stopped` (:195). No copy of the construction is left.",
    "State ownership: `Merge` is still written only in merge.rs. The MovedOn → list_stop → `open_after(root, highest_disk_version)` path (:89-96) opens the new stop, which matches the plan §2 rule that the next `list_stop` after `StopMovedOn` lists git's current stop. That makes the window's single `nextStop` list correct (the nested second `nextStop` from #1440 cannot happen).",
    "`continued_outside(root)` (tests.rs:320-329) is a plain helper used by three tests: the existing terminal-continue list test (:334) and both new tests (:352, :365). It resolves step 1, stages it and asserts that `git rebase --continue` stops again. It has no extra parameters or abstraction.",
    "New tests (tests.rs:348-372): Abort and Continue after the outside move answer `{kind: StopMovedOn}`, `has_ended()` stays false, and the next `list_stop` lists step 2 (`assert_step_listed(.., 2)`). The notes show both failing on the old `Held` code (the list answered MovedOn) and passing now.",
    "src-tauri/AGENTS.md:1 has the hand-back rule: refused → Held, `StopMovedOn` → MovedOn (#1440), stopped → MovedOn, panicked worker → MovedOn. The doc comment at merge.rs:147-149 says the same.",
    "Boundaries: no new import edges. Neither commit touched ipc/bindings.ts (the notes show bindings-check byte-equal). No file outside either brief's Owned globs changed (the notes' files_changed lists are subsets of Owned).",
    "Accepted as logged: merge/tests.rs is at 457 lines (#1441, triaged as accepted for this feature).",
    "Accepted deviation: problem.ts and problem.test.ts were left unchanged because `reportFailure` already logs and routes `StopMovedOn`.",
    "Not reported because it is below RV8's bar: tests.rs:363 has a stray leading space before `{`, which rustfmt leaves as written because the function name runs past max_width."
  ]
}
```


## Correctness re-check (GitOpsCleanupR2Correctness, both commits): pass, no findings

```json
{
  "verdict": "pass",
  "round": "3.J-cleanup fix round 2 re-check (d851002 + ca74e42), correctness lens, RV8 scope",
  "blocks_rechecked": [
    {
      "id": "#1440",
      "status": "fixed",
      "evidence": "src-tauri/src/merge.rs:163-169: when the worker returns `Err(StopMovedOn)`, the state becomes `moved_on(&session)`, using the same constructor as the panic arm (:173) and Continue's `Stopped` (:195). On the next `list_stop` the `MovedOn` arm (:88-95) runs `open_after`, then `refresh_stop`, and answers `Files`. The window's single `nextStop` (stops.ts:51-66) sets the moved-on notice and then calls `loadFiles` once. That list now answers `Files`, so `listing.ts:27` never reaches a second `nextStop`, and `clearStop` does not run again to wipe the notice."
    },
    {
      "id": "#1438",
      "status": "fixed",
      "evidence": "continuing.ts:69-78: every refusal now goes through `reportFailure` (problem.ts:106-116). `StopMovedOn` logs and makes one call to `nextStop({kind:\"outside\"})`. A refusal of kind `Git` calls `report` and then `refreshFiles()`. Continue's own `StopMovedOn` branch is gone."
    }
  ],
  "findings": [],
  "checked": [
    "Every StopMovedOn raiser traced to the window's one list: (1) operation_still_here (session/operation.rs:146-152), used by both abort_operation:120 and continue_operation:128. on_worker now leaves `MovedOn`, so the next list_stop answers Files.",
    "(2) The worker panic (merge.rs:171-175). `after_a_panic` is built before the hand-over and is unchanged; the next list opens the new stop. Pinned by tests.rs:302-318.",
    "(3) `session()` while in `MovedOn` (merge.rs:78). The state stays `MovedOn`, and `hand_to_worker` returns this error before its `mem::replace` (merge.rs:111-114), so the state is not touched. The next list opens the new stop (tests.rs:335-345).",
    "(4) A write below `first_disk_version` (session/writes.rs:139). This can only fire in a session opened by `open_after`, i.e. the stop git is at now. The state stays `Held`, and the next list's `refresh_stop` finds the same stop and answers Files (tests.rs:237-241).",
    "In all four cases the window takes one path: `reportFailure` → `nextStop(outside)` → one `loadFiles` → `Listing::Files`. The notice set at stops.ts:57-59 survives because `clearStop` runs only once.",
    "Rust's two meanings of 'moved on' now match. `refresh_stop`'s `Refreshed::MovedOn` (merge.rs:93) and `operation_still_here`'s `StopMovedOn` both come from `has_moved_on_to`, and both now end in `moved_on(session)`.",
    "Other worker errors still return `Held(session)`: GitRefused, NoOperation, and gitio errors. `a_continue_git_refuses_answers_git_s_text_and_keeps_the_stop_open` (tests.rs:287-299) would fail if every error became `MovedOn`, because its `save_file` would answer StopMovedOn instead of Written. That test kills the over-broad mutant.",
    "Both new Rust tests (tests.rs:347-372) would fail with the fix deleted. On `Held`, list_stop runs refresh_stop, which answers `Listing::MovedOn`, and `assert_step_listed` requires kind Files. The implementer's red run on the old arm matches this ('left: String(\"MovedOn\")').",
    "The new tests catch the off-by-one in progress: they assert step 2 of 3, and the root is preserved implicitly because open_after succeeds on the same repo.",
    "Moving the existing test into the `continued_outside` helper leaves it unchanged: it still writes and adds STEP_TWO_FILE and runs a `rebase --continue` that stops (tests.rs:320-328).",
    "The close ending in `MovedOn` is unchanged and correct: outcome.rs:62 `moved_on_ending(root)` counts the new stop, as before the fix through the `Held` path at outcome.rs:93.",
    "continuing.test.ts:294-305 would fail on b56f16e: no log line (the implementer's red run is shown). It asserts exactly one end `{kind:\"outside\"}`, no problem, no re-list, and Continue `ready` afterwards.",
    "continuing.test.ts:276-290 checks that a `Git` refusal re-lists (`lists` = [\"list\"]). Removing the `cause.kind === \"Git\"` guard would fail the StopMovedOn test and the GitRunning test (:292, `lists` []). Inverting the guard would fail the Git test.",
    "gitRun.ts:21-31: `landing` runs only while `landed`. For failures, `running` is cleared after `nextStop`. Abort uses the same `reportFailure` (aborting.ts:51-57), and aborting.test.ts:146 still covers its StopMovedOn.",
    "Not a block, noted for the orchestrator: docs/architecture.md:361-363 still says only a worker panic leaves `MovedOn`. architecture.md was outside the Rust brief's owned files; src-tauri/AGENTS.md:1 has the new rule (#1440). Below the RV8 block bar.",
    "Not a block, noted for the orchestrator: src-tauri/src/merge/tests.rs is 457 lines, over the brief's ~440 and RS6's 400. The implementer listed it in open_risks; #1437 tracks the split. The two new tests are identical apart from the command name and could become one loop over [\"abort_operation\", \"continue_operation\"]. Below the RV8 block bar.",
    "No mutants survivor list was attached to this re-check, so no VF7 triage was done. No test was run: no block depended on one."
  ]
}
```
