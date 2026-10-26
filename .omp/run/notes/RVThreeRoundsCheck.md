All three rounds fixed every listed item. Rounds 1 and 2 pass. Round 3 fails on one new block: the new start-sweep test claims to prove C1 but still passes with C1 reverted. I ran no tests or toolchains; everything below comes from reading the code.

```json
[
  {
    "round": "3.RV-thread-state rework-1 (698a642)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`ShownThread` is in ipc/threadLine.ts:12 and exported from ipc/index.ts:125. rangeThreads.ts:3-14 imports it from `../ipc`. editor/range.ts:3,24 imports it from ../ipc and re-exports it; editor/index.ts:46 re-exports it from ./range. The only ui imports from `../editor` are the controller files (useRange/useMerge/useCompareController) and useMarkdown (another slice)."},
      {"item": 2, "status": "fixed", "evidence": "`isQueued` (rangeThreads.ts:63-76) is an exhaustive switch with a `never` default. Both the `queued` computed (:179) and postButton's Unqueue branch (rangeGitLab.ts:107) use it. Tested at rangeThreads.test.ts:506-512 for all four kinds."},
      {"item": 3, "status": "fixed", "evidence": "ui/rangeDrafts.ts holds `Draft`, `setDraft`, `threadDraft`, `startThread`, `writeDraft`, `dropDraft`, `noteText` and `writeNote`. createRangeThreads builds it and spreads it minus `threadDraft` (rangeThreads.ts:216-225), so the `RangeThreads` type is unchanged. The refused add's `writeDraft` writes only to an existing draft, which keeps the old `kept !== null` rule. addNote's `writeNote(thread, added ? \"\" : text)` behaves as before (text is non-blank there)."},
      {"item": 4, "status": "fixed", "evidence": "`GitLabState.result` is `SentReply = Exclude<SendReply, notLinedUp>` (rangeGitLab.ts:28,48) and `send` stores the reply as it came. `sendResultText` switches exhaustively on `kind` (rangeThreadText.ts). `SendResult` is gone (grep: no hits in ui/). Tests assert `kind: sent` / `kind: stopped` with `reason`."},
      {"item": 5, "status": "fixed", "evidence": "\"counts per file ignore drafts\" asserts `shownFor(other)` is exactly `[{key: draft-0, line: left 0, shown: open}]` and `shownFor(board)` keys are `thread-0..3, draft-1`. That kills both the file filter at :84 and `draft.file === file` at :90."},
      {"item": 6, "status": "fixed", "evidence": "(1) \"after a refused Comment the next Comment … stored once\": with `adding.delete` removed, `calls` stays 1 and the test fails. (2) \"a press on the same line number in the other column opens a second draft\": left 3 then right 3 gives `[draft-0, draft-1]`, which fails if the column check is gone. (3) \"each thread keeps its own reply text\": x/y on two threads, which fails with one shared note key."},
      {"item": 7, "status": "fixed", "evidence": "rangeGitLab.ts:144-155: `let running = true`; the callback writes only while `running`; `running = false` comes before `sending = null`. Test \"a progress message arriving after the reply leaves Send usable\" calls onProgress after the resolve and expects `sending` null and the label \"Send to GitLab (0)\". Without the guard, `sending` would be {1,2}."},
      {"item": 8, "status": "fixed", "evidence": "\"a Comment on a key with no draft makes no call and reports nothing\" (calls 0, problems []). \"a refused Comment whose draft was dropped while it ran brings no draft back\" (drafts.size 0, one add problem)."},
      {"item": 9, "status": "fixed", "evidence": "rangeGitLab.test.ts:289-291: `lastEnded` is T0 (from `checked`). At T0+RECHECK_PAUSE_MS, `checkOnFocus` during the pending send keeps `checks()` at 1. Without the `sending !== null` guard, the 30 s rule would fire."},
      {"item": 10, "status": "fixed", "evidence": "`result.value = null` at the start of send (rangeGitLab.ts:143). Test \"a send that ends not lined up clears the previous send's result\": first send gives `kind: sent`, the second gives notLinedUp with `result` null. The notLinedUp branch never writes `result`, so without the reset the test fails."},
      {"item": 11, "status": "fixed", "evidence": "`rangeThreadParts(threads, file)` (useRangeController.ts:155) is spread into followRange (:183). The test uses a real `createRangeThreads`: `events.startThread` puts draft-0 in `shownFor(first.id)` and leaves `shownFor(second.id)` equal to before; toggleThreads opens and then closes `thread-<id>`."},
      {"item": 12, "status": "fixed", "evidence": "The test is renamed \"a Cancel while Comment is in flight still adds and opens the thread\" (rangeThreads.test.ts:472). rangeStore.test.ts:269: a draft on file 0, then `showFile` on 16 others; file 0 is no longer visited, and `shownFor(id0)` and `boxOf` still hold the draft with \"Why?\"."},
      {"item": "ThreadAdded export", "status": "fixed", "evidence": "ipc/index.ts no longer exports `ThreadAdded`. It is used only inside ipc/ (ReviewSource, reviewDomain, fixtureReview, tauriReview)."}
    ],
    "survivors": [
      {"mutant": "rangeDrafts.ts:62 `draft.kind === \"thread\"` → true", "verdict": "drop (a) equivalent: a note draft has no `file`, so `draft.file === file` is false at run time and the loop never matches a note."},
      {"mutant": "rangeThreads.ts:68, rangeThreadText.ts:101 `never` default arms (×4 NoCoverage)", "verdict": "drop (b): unreachable by type; `pnpm -C frontend typecheck` (in `just check`) rejects a missing Posting/SendReply kind."},
      {"mutant": "useRangeController.ts:176-181 (×4 NoCoverage) useRangeStore, load, hosts in the composable body", "verdict": "drop (c) wiring with no decision of its own (the decisions moved to the tested `rangeThreadParts`). Observed in RVThreadBoxes.md WebKit step 1: a press on left line 8 opens the box in that file."}
    ],
    "findings": [],
    "checked": [
      "Read the brief, both reviews, the notes, the survivors, `git show 698a642` in full, and the current rangeThreads.ts, rangeGitLab.ts and test call sites (later rounds added Post drafts and `PostView`; this round's items are intact).",
      "Deviation accepted: editor/internal/threadRows.ts:10 re-exports `ShownThread` from ../../ipc for the read-only threadNumbers.ts and editor tests. One type, no second definition.",
      "Deviations accepted: no rangeDrafts.test.ts (the draft rules are tested through `RangeThreads`); `SentReply` as the local alias; the `threadDraft: _threadDraft` destructure.",
      "No new edge from ui/ into the editor; state writers unchanged (`drafts` only through RangeDrafts, `result`/`sending` only in rangeGitLab)."
    ]
  },
  {
    "round": "3.RV-review-ipc rework-1 (8fdd485)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`branded` is in validate.ts:9-18. threadLine.ts (changedThreadLine, unchangedThreadLine, toThreadLine), compareDomain.ts (toTabList, toColumnVersions) and reviewDomain.ts call it. Grep finds no `leftLine`/`rightLine`/`toTabId`/`toColumnVersion`/private `branded` left. validate.test.ts covers pass-through and the field-named refusal for −1 and 0.5."},
      {"item": 2, "status": "fixed", "evidence": "The only `result.ok ?` left in ipc/ is `converted` itself (tauri.ts:44). tauri.ts listStop/loadFile/describeFile, every tauriCompare.ts method and tauriRange.loadRangeFile now return `converted(toResult(await commands.x(…)), toY)`. openRange is infallible, so no `toResult`. tauriCompare.test.ts adds the error path for openCompare/loadTab/setColumn."},
      {"item": 3, "status": "fixed", "evidence": "fixtureReview.ts postQueue reads `waitingText` right after the pause; when null it skips `postOutcome` and still reports `{done: index+1, of}`. `record` takes the text, with no await between read and record. This matches crates/review/src/send.rs:110-121 (`send_one` returns Ok(None) before glab) and :99-103 (done += 1 and progress after any non-stop). Test \"?gitlab=stopped skips a message unqueued before its post…\" expects `sent` with sent 1, progress [{1,2},{2,2}] and postings [pending, notQueued]. The old order answers `stopped`."},
      {"item": 4, "status": "fixed", "evidence": "`rightBranch` (fixtureGitLab.ts:41-52) gives `{branch, name}` for `named` and throws for the impossible `mergeBase`. noMergeRequest/several use it; only noBranch uses `{commit, short_id}`. The `DETACHED` rows were replaced by `COMMIT_ID_RIGHT` (named \"5d6e7f8\"); the test names say so; the throw is pinned."}
    ],
    "survivors": [
      {"mutant": "fixtureGitLab.ts:46 `never` default (ConditionalExpression, BlockStatement; NoCoverage)", "verdict": "drop (b): unreachable by type over `RangeSideLabel`; `pnpm -C frontend typecheck` rejects a missing arm."}
    ],
    "findings": [],
    "checked": [
      "Read the brief, both reviews, the notes, the survivors and `git show 8fdd485` in full, plus the current fixtureGitLab.ts and tauri.ts:30-80.",
      "Deviation accepted: the `mergeBase` arm throws. Rust's right side is always `Named` (correctness review, crates/range), and both committed fixtures have a named right side. The open risk (the eager `answers` table throws for every script on such hand-made data) is fixture-only.",
      "The open risk is accepted as out of Owned: the hand-written brand-or-throw in domain.ts:187,249,295 and rangeDomain.ts:53 (these files were not listed in item 1). This was already there and was not made worse.",
      "`toSettingsResult` (tauri.ts:47) goes through `converted`; createTauriSettings has no inline copy.",
      "The unqueue test's index matches the script: if messageId(1) were queue index 0, the new code would still stop at index 1 and the test would fail, so it pins the skip at the stopping index."
    ]
  },
  {
    "round": "3.RV-ai-shell rework-1 (79037b5)",
    "verdict": "fail",
    "items": [
      {"item": "B1", "status": "fixed", "evidence": "`servers::forward` is `pub(crate)` (servers.rs:57) and called by ai::start_agent (ai.rs:18,137); there is no copy in ai.rs. `channel_into`/`is_alive` are `pub(crate)` in `servers::run_tests` (cfg(test), cfg(unix)) and used by ai.rs's `page_load` tests."},
      {"item": "B2", "status": "fixed", "evidence": "On `WouldBlock`, ai.rs:90-93 spawns a thread that waits for `lock(&app.state())` and then runs `stop_agent_in`. The doc comment (:80-82) and src-tauri/AGENTS.md say \"deferred, never dropped\". The test holds the lock, sends Started and sees the pid still alive; after `drop(held)` it gets `Exited`, the pid is gone and the checkout is kept. Without the thread, no `Exited` arrives."},
      {"item": "B3", "status": "fixed", "evidence": "`fn lock` is private (ai.rs:34)."},
      {"item": "B4", "status": "fixed", "evidence": "src-tauri/AGENTS.md calls `start_agent` \"a worker command: under the lock it stops and reaps an earlier agent — up to about 3 s\". It names the AI lock's holders as prepare, start, discard (\"under the lock while the folder is removed\") and the own-pair sweep, and says `sweep_other_pairs` runs without the lock."},
      {"item": "B5", "status": "fixed", "evidence": "window.rs is 360 lines (wc); start_script.rs (57 lines) holds `start_script` and its two tests; window.rs:21 imports it."},
      {"item": "C1", "status": "fixed (code); its test does not pin it, see finding 1", "evidence": "The sweep thread (ai.rs:67-77) takes the lock, sends `held`, runs `remove_own_leftovers`, drops the guard at the block end, then calls `yamt_agent::sweep_other_pairs(&range_dir, &pair_folder)` without it. `Workspace::sweep_leftovers` is gone. The crate tests call `sweep_other_pairs`/`remove_own_leftovers`, and a new test pins the `folder == own` skip."},
      {"item": "C2", "status": "fixed", "evidence": "`prepared_checkout` asserts a.txt == \"two\\n\" (the right side; base and main hold \"one\") and that `checkout.parent()/lock` is a file. Every checkout test goes through it."},
      {"item": "C3", "status": "fixed", "evidence": "`the_exit_keeps_a_changed_checkout_and_leaves_the_ai_off` writes new.txt, runs `end_at_exit`, then checks that new.txt exists and the look answers AiOff. It fails if the exit calls `discard()`."},
      {"item": "S1", "status": "fixed", "evidence": "`an_ai_start_sweeps_its_own_pair_under_the_state_and_other_pairs_without_it` opens an `Ai::On` window with partials in its own pair and in x-0123456789abcdef/a-b. After `lock(&state)` the own partial is gone, and the other one is gone within the wait. `sweep_while_held → ()` now fails the own-partial assertion (mutants: caught)."}
    ],
    "survivors": [
      {"mutant": "none", "verdict": "RVAiShellR1.survivors.txt: 11 tested, 7 caught, 4 unviable, no survivors. The earlier `sweep_while_held → ()` survivor is now caught by the S1 test."}
    ],
    "findings": [
      {
        "severity": "block",
        "rule_id": "VF7 / growth: a rule other code relies on left untested (C1)",
        "file": "src-tauri/src/ai.rs",
        "line": 345,
        "problem": "If `yamt_agent::sweep_other_pairs` moved back inside the guarded block (ai.rs:68-75), the S1 test would still pass. That is the exact C1 regression: Ask AI and the close question would again wait on looks at every kept checkout. The test's `lock(&state)` blocks until the sweep thread lets go, so by then the other pair's partial is already gone. The test comment (:327-328) and the notes say it fails in that case; it does not, so C1 has no test that sees the lock held.",
        "fix": "Move the thread body into `fn sweep_own_then_others(state: &Mutex<AiState>, held: &Sender<()>, others: impl FnOnce())`, with manage passing `|| yamt_agent::sweep_other_pairs(&range_dir, &pair_folder)`. Add a test whose `others` closure asserts `state.try_lock().is_ok()` (fails if `others` runs under the guard), and keep the S1 window test for the real sweep."
      }
    ],
    "checked": [
      "Read the brief, all three reviews (RVAgentCrateR1Check block 2 only), the notes, the survivors, `git show 79037b5` for crates/ and the non-ai.rs shell files, the current ai.rs (all 399 lines), start_script.rs, the AGENTS.md ai.rs paragraph and crates/agent/src/sweep.rs.",
      "Finding 1, worked through by hand: manage returns after `held` (lock taken). The test's `lock` waits for the thread's guard. With the free sweep moved inside the guard, both partials are gone before the test gets the lock, and both assertions hold.",
      "Handshake kept: `held.send` comes after the lock is taken and before the own-pair removal, so every later command (prepare included) waits for that removal.",
      "The page-load hook in commands.rs passes `webview.app_handle()`. `stop_agent_on_page_start` does `try_state` itself, so merge/compare windows return at once. The main thread never blocks (only `try_lock`). The first page's Started during the start sweep defers a stop that finds no agent.",
      "Open risk accepted: a deferred stop that gets the lock after the reloaded page's own prepare and start would stop the new agent. It needs the waiting thread to lose two lock races to user-driven commands. The effect is an `Exited` the page shows and a restart; the checkout is kept.",
      "Open risks accepted: the 10 s polling deadlines in the S1 and page-load tests (deterministic up to scheduling; a failure would show as a test failure, never a false pass).",
      "Deviations accepted: the page-load signature change in commands.rs, `pub(crate)` `repo`/`open_range_window_in`, `mod start_script` in lib.rs, the checkout.rs test helper, `WindowKind::name` `pub(crate)`, the merged page-load test and the `look` helper.",
      "`folder == own` in sweep_other_pairs: if the path forms ever differ, the own pair's `try_hold` answers None (the window holds it) and it is skipped, so the own checkout is safe either way.",
      "No stale `sweep_leftovers` in code, AGENTS.md or architecture; only historical briefs mention it.",
      "ai.rs is at 399 lines, one under RS6's 400. The fix in finding 1 adds lines, so the extraction should move test helpers or the thread body rather than add net lines."
    ]
  }
]
```