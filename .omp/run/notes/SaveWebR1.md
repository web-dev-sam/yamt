# SaveWebR1 (3.Z-web fix round 1)

I've fixed all fourteen findings (#927–#943). The layer recipes all exit 0, the 1067 node tests pass, and Stryker leaves no survivors in `saving.ts`. The new tests failed before their fixes, apart from the ones that pin mutants (those are proven by Stryker). Two decisions you might want to look at:
- **The #942 rule:** a Save drops its write if a Reset or Mark resolved touched the same file while it was formatting.
- **`markSaved` changed shape:** it is now `markSaved("asShown" | "fileText")` (#936). The brief allowed this, but it is a contract change.

```
summary
  The rule for which shown text Save leaves out now lives in one place, `dropsShownText` in editor/internal/fileText.ts. Both the file text and the saved point use it.
  The saved point records which text was last written. Typing inside a fully waiting change keeps the dot only after a "fileText" write, so Mark resolved and saving a resolved file clear it.
  apply.ts exports `wholeLines`, which puts back a line break deleted at a change's edge; fileText uses it. A half-decided conflict's decided section is built from the span's own text, so no line is written twice.
  ui/saving.ts has `afterWrite` (used by finish, save, reset and take), the named exclusive claim `claimWrite`, and claims that count writers. A Save drops its write when Reset or Mark resolved starts on the same file while it is formatting.
  The "Not saved" dot shows only for an editable Result. Save's tests moved to ui/saving.test.ts.

files_changed
  frontend/src/editor/internal/fileText.ts, fileText.test.ts, savedPoint.ts, savedPoint.test.ts, apply.ts, apply.test.ts
  frontend/src/editor/AGENTS.md
  frontend/src/ui/saving.ts, saving.test.ts (new), store.ts, store.test.ts, MergeView.vue

tests_added
  fileText.test:
    "a line break deleted at a waiting change's edge…" now also has the half-decided cases (break deleted after the decided line and before it); expects one marker block and "z" once (#937).
    "the shown text is left out of the file for a waiting one-sided change and a conflict whose sides both wait, nothing else": the dropsShownText rules (#927).
  apply.test "a side applied where a line break at the change's edge was deleted lands on lines of its own": checks wholeLines' mid-line case for replace (break deleted after and before) and for append (#930).
  savedPoint.test "typing inside %s whose sides all wait is on disk after a write of the Result as shown, so the dot clears" (one-sided change, conflict) (#936).
  saving.test (new). Moved from store.test, now testing saving.ts directly on a target built from refs:
    Written; no unsaved work; format outcomes; save during a save; finish ending during a save; ChangedOnDisk; failed save.
  saving.test, new tests:
    test.each with three resolved-file cases: only a.ts Resolved; a.ts Unresolved and b.ts Resolved → fileText; a.ts Resolved and b.ts Unresolved → asShown (#941).
    claimWrite / whileWriting claim rules (#929).
    a save whose formatting still runs when another write starts writes nothing (#942).
    finish writes as shown and marks "asShown" (#936).
    afterWrite: Written → true; ChangedOnDisk → notice, reload, false (#928).
  store.test:
    "a finish with work left asks; Back writes nothing and stays…": b.ts is now listed unresolved; after Back, active is still a.ts and calls are only ["loadFile a.ts"] (#939).
    "a save while a %s of the same file runs is ignored": expects `saves` to be [] right after the in-flight save (#940).
    New test.each "a save whose formatting still runs when a %s of the same file lands writes nothing" (reset, finish) (#942).
    `takenChoice` also takes REMOVED; after the LOGO reset, `taken` still holds REMOVED (KEPT_TAKEN) (#943).

smoke_evidence
  Acceptance 1, failing runs (break the rule, run, restore, run green):
    wholeLines back to its old body →
      "× a line break deleted at a waiting change's edge…"
      "× a side applied where a line break at the change's edge was deleted lands on lines of its own"
      AssertionError: expected 'a\nBz\n' to be 'a\nB\nz\n'
      "Tests 2 failed | 45 passed (47)"
    shownLines back to whole document lines →
      AssertionError: expected 'a\n<<<<<<< ours\nLz\n=======\nR1\nR2\…' to be 'a\n<<<<<<< ours\nL\n=======…'
      "Tests 1 failed | 10 passed (11)"
    savedPoint without the `written === "fileText"` check →
      "× typing inside a one-sided change whose sides all wait is on disk after a write of the Result as shown, so the dot clears"
      "× … a conflict …"
      "Tests 2 failed | 9 passed (11)"
    dropsShownText Markers `every` → `some` →
      ×: half-decided keeps markers; line break deleted at edge; shown text is left out…; typing inside a conflict…; typing in the decided section…
      "Tests 5 failed | 17 passed (22)"
    save ignoring `overtaken` →
      "× a save whose formatting still runs when another write of the same file starts writes nothing"
      "× … when a reset of the same file lands writes nothing"
      "× … when a finish of the same file lands writes nothing"
      "Tests 3 failed | 97 passed (100)"
    whileWriting not claiming →
      "× a save while a reset of the same file runs is ignored"
      "× … a finish …"
      "× claimWrite runs nothing while the path is held…"
      AssertionError: expected [ [ 'a.ts', 'typed\n(file)', +0 ] ] to deeply equal []
      "Tests 3 failed | 97 passed (100)"
    All restored → "Tests 58 passed (58)" (editor), "Tests 115 passed (115)" (ui).
  Acceptance 2, `pnpm exec stryker run --plugins @stryker-mutator/vitest-runner --testRunner vitest --mutate src/ui/saving.ts,src/ui/store.ts --ignoreStatic` (final run with `--reporters clear-text,json`):
    All files |  99.29 |   99.29 | 281 | 0 | 2 | 0 | 0
    saving.ts | 100.00 | 100.00 | 102 | 0 | 0 | 0 | 0
    store.ts  |  98.90 |  98.90 | 179 | 0 | 2 | 0 | 0
    The two store.ts survivors are `state.latestOpen += 1` → `-=` at store.ts:198 and :204. They were there before this patch and were not named.
    Named mutants from the JSON report:
      #939 finish Back `return false`→`true`: Killed by "a finish with work left asks; Back writes nothing and stays…"
      #941 `.every`: Killed by "…: it is resolved and another is not"
      #941 `file.path === path`→true: Killed by "save: Written…" and "…: another file is resolved"
      #943 store.ts:265 (6 mutants, incl. `taken === path`, `[]`): Killed by "reset of a taken choice forgets only its side…"
  Acceptance 3:
    lint=0, typecheck=0, unused=0 (knip --include exports,types)
    fmt:check → "All matched files use the correct format. Finished in 565ms on 259 files"
    sfc-order → "$ tsx scripts/check-sfc-order.ts" (no findings)
    pnpm test → "Test Files 86 passed (86) / Tests 1067 passed (1067)"
  #938 smoke in the real app (`cargo tauri build --debug --no-bundle` → "Built application at …/target/debug/yamt"; `app-session start-app --name savewebr1 --fresh-repo`, display :2):
    docs/removed.md (UD) shown → dots 0. Click "Keep" → the list shows "docs/removed.md ✓ resolved"; git status no longer lists it.
    Re-showing it: Result "# Removed / local text", header "Result | Reset", no dot (`querySelectorAll('[aria-label="Not saved"]').length` = 0). Screenshot /tmp/yamt-savewebr1-kept.png.
    Session stopped.

deviations_from_brief
  1. #942, the claim rule I chose: Save drops its write when another write to the path started during its claim. Reset and Mark resolved never wait or refuse; they join a held claim and mark it overtaken. Save checks this after `format()` and before `snapshot()`.
     - The claim is a writer count, so the path stays held until the last writer ends. A finish ending during a save keeps the save's claim.
     - `Writing.writing` is now `Map<string, Claim>`; store.ts initialises it with `new Map()`.
  2. `afterWrite` returns `Promise<boolean>`, not `boolean`, because `changedOnDisk` is async.
  3. Contract shape change (#936): `ResultSnapshot.markSaved(written: "asShown" | "fileText")`. Save passes the kind it sent (`snapshot[sent]()`); finish passes "asShown". editor/index.ts and useMergeController.ts needed no edit, since they re-export the type.
  4. New or changed exports:
     - fileText.ts: `dropsShownText`.
     - apply.ts: `wholeLines` (now exported, mid-line case moved in).
     - saving.ts: `afterWrite`, `claimWrite`.
     - Private: `freeClaim` (shared constructor for a free claim; it keeps the claim mutants non-equivalent), `holding`.
  5. `wholeLines` now changes apply too. A side applied where the user deleted the line break at a change's edge lands on lines of its own ("a\nB\nz\n", before "a\nBz\n"). Appending at a mid-line edge also adds the break.
  6. #931: store.test keeps two save tests rather than one:
     - "a save while a %s … is ignored" (#940 names it).
     - The #942 store test the acceptance asks for. Both are test.each over reset/finish.
     - The older finish tests stay in store.test because they test the store's finish-then-open-next step.
  7. #943: KEPT_TAKEN also changes the end check of "a failed describe after a reset…", which uses `takenChoice`.
  8. Ran `pnpm install --frozen-lockfile --offline`, because the worktree had no node_modules. Deleted Stryker's frontend/reports/ afterwards (it broke fmt:check).
  9. In the test fakes (saving.test.ts `format`, `answeredLater`; store.test.ts #942 test) I used `new Promise` instead of `Promise.withResolvers` (a project rule asks for the latter). tsconfig's lib is ES2023, which has no type for it, and the existing tests use the same form.

open_risks
  1. frontend/src/editor/internal/apply.ts:49-62: when a break before a change was deleted, the applied change's span now starts at the end of the previous line (`from` maps with assoc -1 over the inserted "\n"). The span then covers the line above too [INFERENCE: decorations and arrows may then mark that line].
  2. frontend/src/ui/saving.ts:157: a save dropped this way logs nothing, and if the Reset then fails the typing keeps its dot until the next Ctrl+S.
  3. frontend/src/ui/saving.ts:57-98: if a Reset and a Mark resolved of the same file overlap (not reachable from one view today), the path is free only once both end.
```