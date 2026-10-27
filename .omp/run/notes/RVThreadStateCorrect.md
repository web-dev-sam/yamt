```json
{
  "verdict": "fail",
  "lens": "correctness-reviewer",
  "patch": "fd06743 RVThreadState",
  "findings": [
    {
      "severity": "block",
      "rule_id": "VF7",
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 99,
      "problem": "No test checks the acceptance item `shownFor` per file. Every seeded thread is on `src/board/board.ts`, and no test calls `shownFor` while another file has a thread or a draft. So the test suite still passes if the stored-thread filter (`.filter((thread) => thread.file === file)`, line 99) or the draft's `draft.file === file` (line 106) is deleted, and then every mounted file would show other files' threads and drafts at their line numbers. These are survivors 99-100, 106 ×3 and NoCoverage 108.",
      "fix": "In `rangeThreads.test.ts` \"counts per file ignore drafts\", after `addThread(\"draft-0\")` add `expect(threads.shownFor(other)).toEqual([{ key: \"draft-0\", line: changedThreadLine(\"left\", 0), shown: \"open\" }])` and `expect(threads.shownFor(board).map(({ key }) => key)).toEqual([\"thread-0\", \"thread-1\", \"thread-2\", \"thread-3\", \"draft-1\"])`."
    },
    {
      "severity": "block",
      "rule_id": "VF7",
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 173,
      "problem": "Three rules that row 21's boxes depend on have no test. (1) After a refused Comment the in-flight guard is released (line 173): with `state.adding.delete(key)` removed, every later Comment on that draft silently does nothing, so keeping the text on failure has no use. (2) A second press matches a draft only in the same column (line 95): with the column check gone, a press on right line 3 focuses the draft on left line 3 instead of opening a new one; the existing test presses at left 4 and right 6, so the numbers differ anyway. (3) Reply text is kept per thread (`noteKey`, lines 74-75): with one key for every note, typing a reply on thread A shows it on thread B.",
      "fix": "Add three tests to `rangeThreads.test.ts`. (1) A refused `addThread` followed by a second call that the source accepts gives one stored thread. (2) `startThread(board, changedThreadLine(\"left\", 3))` then `startThread(board, changedThreadLine(\"right\", 3))` gives two drafts. (3) `writeNote(a, \"x\")` and `writeNote(b, \"y\")` give `noteText(a) === \"x\"`."
    },
    {
      "severity": "block",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 138,
      "problem": "[INFERENCE] The progress callback writes `sending` unconditionally. Tauri's `Channel` (node_modules/@tauri-apps/api/core.js:116-160) keeps its own messages in order but does not order them against the invoke response. If a progress message arrives after the reply, `sending` stays non-null for good: the button stays disabled at \"Sending 2 of 2…\" and `send()` returns at its guard for the rest of the window's life. A late message from a previous send can also overwrite the next send's progress.",
      "fix": "Give each send a `let running = true`. The callback writes `state.sending.value = progress` only while `running`, and `running = false` is set before `state.sending.value = null`. Add a test whose `sendQueue` calls `onProgress` after resolving and expects `sending` to be `null`."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 168,
      "problem": "Two edges of `addThread` have no test. (1) Comment on a key with no draft (line 168): without the `draft === null` return, the null read throws inside `attempt` and shows a spurious \"Could not add the thread\" problem. (2) A refused add whose draft was dropped while the call ran (line 176): without the `kept !== null` check, a malformed `{ text }` draft would come back. Nothing else gets harder as the app grows.",
      "fix": "Add a test where `await threads.addThread(\"draft-9\", \"x\")` makes no source call and reports nothing, and one where a refused add with `dropDraft` called mid-flight leaves `drafts.value.size === 0`."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 123,
      "problem": "No test pins that focus does not re-check while a Send runs (survivor 123). The rule could be dropped unnoticed, and then a focus check started before the send's own re-check could land after it and overwrite the newer `notLinedUp` answer.",
      "fix": "In \"the progress label counts the message being sent\", call `vi.setSystemTime(T0 + RECHECK_PAUSE_MS)` and `live.gitlab.checkOnFocus()` while the send is pending, then expect `live.checks()` to stay at 1."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 135,
      "problem": "A Send that ends `notLinedUp` or fails leaves the previous Send's `result` (\"1 sent, 1 refused\") on screen. The notice then reads as the outcome of the press just made, though that press sent nothing. Each further outcome kind would need its own clearing.",
      "fix": "Set `state.result.value = null` at the start of `send()`, and add a test where a send after a `refusal` result ends `notLinedUp` with `result` null."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/useRangeController.ts",
      "line": 166,
      "problem": "None of the store-to-controller wiring runs in a node test (NoCoverage ×8 at 166-176): `shownFor(file.id)`, `startThread(file.id, line)`, `toggle(keys)` and the `events` handed to `new RangeController`. Pressing a line number could do nothing, or open the draft in the wrong file, and no test or observed smoke would notice. That is the same failure the promoted `NO_EVENTS` finding was about.",
      "fix": "Move the store half into an exported `rangeThreadParts(threads, file)` that returns `{ threads, events }`. Test it with a real `createRangeThreads`: `events.startThread(line)` puts a draft in `shownFor(file.id)` and nowhere else. Otherwise, name row 21's smoke (a press on a number opens a box in that file only) as the drop-(c) evidence."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeThreads.test.ts",
      "line": 280,
      "problem": "The test named \"a reply arriving after the view unmounted…\" calls `dropDraft`, which is the box's Cancel; unmounting drops nothing. No test evicts a view and checks that its draft survives, which is the acceptance item \"drafts kept across the 16-view eviction\". That holds today only because `forget`/`show` never touch `threads` (by reading). A later move of drafts next to the views, such as the boundary review's `rangeDrafts.ts` split, would go unchecked.",
      "fix": "Rename the test after what it does (a Cancel while Comment is in flight still adds and opens the thread). Add a `rangeStore.test.ts` case: a draft on file 0, then `showFile` on 16 other files evicts file 0, then `store.threads.shownFor(id0)` still holds the draft with its text."
    }
  ],
  "survivors": [
    {"mutant": "rangeGitLab.ts:68 `|| start === null` → `|| false`", "verdict": "drop (a) equivalent in every reachable state: `start` is written only by rangeStore `startUp`, before its `checkNow`; `checkOnFocus` needs `lastEnded`, which only `checkNow` sets; `send` is reachable only from an enabled button, which needs a non-null check. So `check !== null` implies `start !== null`."},
    {"mutant": "rangeGitLab.ts:123 `sending !== null` → `false`", "verdict": "kill: rangeGitLab.test.ts \"the progress label…\" + checkOnFocus at +30 s during the send expects checks() 1 (finding 5)"},
    {"mutant": "rangeThreads.ts:108 `[]` → `[\"Stryker was here\"]` (NoCoverage)", "verdict": "kill: finding 1's `shownFor(other)` and `shownFor(board)` while a draft sits on the other file"},
    {"mutant": "rangeThreads.ts:74-75 noteKey body / `note-${thread}` → ``", "verdict": "kill: notes on two threads keep their own text (finding 2)"},
    {"mutant": "rangeThreads.ts:95 `first.column === second.column` → true", "verdict": "kill: left 3 then right 3 gives two drafts (finding 2)"},
    {"mutant": "rangeThreads.ts:99-100 shownFor filter removed / → true", "verdict": "kill: finding 1 (`shownFor(other)` holds only its own thread)"},
    {"mutant": "rangeThreads.ts:106 whole condition → true; `&&` → `||`; `draft.file === file` → true", "verdict": "kill: finding 1 (`shownFor(other)` must not list board's draft-1)"},
    {"mutant": "rangeThreads.ts:106 `draft.kind === \"thread\"` → true", "verdict": "drop (a) equivalent: a note draft has no `file`, so `draft.file === file` is false at run time and the note never shows"},
    {"mutant": "rangeThreads.ts:126 `draft.kind === \"thread\"` → true", "verdict": "drop (a) equivalent: same reason; `draft.file === file` is false for a note draft"},
    {"mutant": "rangeThreads.ts:168 `draft === null` → false", "verdict": "kill: `addThread(\"draft-9\", \"x\")` makes no call and reports nothing (finding 4)"},
    {"mutant": "rangeThreads.ts:173 `state.adding.delete(key)` removed", "verdict": "kill: a refused add then an accepted add gives one stored thread (finding 2)"},
    {"mutant": "rangeThreads.ts:176 `kept !== null` → true", "verdict": "kill: a refused add whose draft was dropped mid-flight leaves drafts empty (finding 4)"},
    {"mutant": "rangeThreadText.ts:60, :77 (×4) `never` default arms", "verdict": "drop (a)/(b): unreachable by type; `pnpm -C frontend typecheck` (in `just check`) rejects a missing `NotLinedUp`/`Posting` case"},
    {"mutant": "useRangeController.ts:166-176 (×8) the per-file build closure", "verdict": "not droppable: no smoke observed, so (c) has no evidence; finding 7 (node test through an extracted parts function, or row 21's smoke named)"}
  ],
  "checked": [
    "Read brief 3.RV-thread-state.md, implementer notes, design §2/§4/§5/§6, boundary review (not repeated), every changed file as it now is: rangeThreads.ts, rangeGitLab.ts, rangeThreadText.ts, rangeStore.ts, useRangeController.ts, and the tests rangeThreads/rangeGitLab/rangeThreadText/rangeStore/useRangeController.",
    "Drafts are store-held, so they survive the 16-view eviction: `createRangeThreads` is built once in `createRangeStore`, and `show`/`forget` write only `visited`/`recent`. A remounted view's `build` calls `showThreads(parts.threads())`, which brings the draft back. By reading only; there is no test (finding 8).",
    "A reply after unmount: rangeThreads does not depend on views, so the reply lands in `list`. useRangeController.test.ts \"a thread change after the view unmounted reaches no controller\" fails if the `threads` watch outlived the scope.",
    "One check at a time: `checking` guard (rangeGitLab.ts:110). Tests: \"no overlapping checks\" covers both `checkNow` and `checkOnFocus` while one runs.",
    "30 s focus rule: `Date.now() - lastEnded >= RECHECK_PAUSE_MS`, with `lastEnded` set after any ended check, a failed one included. The test pins 30 s − 1 ms (no check) and exactly 30 s (check), plus no check before the first one ends.",
    "`checkNow` at start runs after the list shows: rangeStore.test.ts asserts openRange → listThreads → checkGitLab with the first file already shown. A failed openRange checks nothing.",
    "Disabled until the first answer, and the last answer kept during a re-check: both tested with exact `ButtonView`s.",
    "Send states: the label goes \"Sending 1 of 2…\" → \"Sending 2 of 2…\" (done+1, capped at `of`); disabled while sending; a second `send()` makes no second call; `notLinedUp` replaces the check and records no result; `sent`, `refusal` and `stopped` results; a failed send reports step `send`. All tested.",
    "Unqueue always enabled: `postButton` returns Unqueue for `queued`/`refused` before the gate. Tested under `noMergeRequest`. It also holds while the check is null, by reading the branch order.",
    "The queued count includes `refused`, matching design §5 step 3 (the send snapshots queued and refused); the result test asserts queued 1 after a refusal.",
    "A draft's key becoming the stored id: implemented inverted; the thread keeps `draft-N` through `state.keys`, so its host is not rebuilt. The boundary review accepted this; the test asserts `shownFor` and `boxOf` under `draft-0` after the add.",
    "`counts` sums only `list.threads` per file, so drafts are excluded; tested before and after an add.",
    "Blank text is never sent for add, note or queue: tested, the draft is kept.",
    "Toggle opens all when any one is closed, else closes all; it ignores draft and unknown keys. Tested per thread and per line.",
    "`threadPlaceText`: `removed` gives the old path and left+1; the other kinds give the path and right+1, as design §2 says. Tested for all four kinds and for a rename.",
    "The `threads` Problem variant: log line tested in problem.test.ts, words for all seven steps tested in problemText.test.ts.",
    "The editor's `events` parameter is required and `NO_EVENTS` is deleted. `range.ts` `showThreads` dispatches with `ThreadRowWidget.eq` by keys (threadWidget.ts:27), so the re-push on every draft keystroke keeps the widget DOM.",
    "Implementer's open risk accepted: an IPC-level check failure before any answer leaves \"Checking GitLab…\" until a focus 30 s later. The problem bar names the failure, and glab failures come back as `Failed` answers, not as IPC errors.",
    "Accepted race: a focus check started before a Send could overwrite the Send's `notLinedUp`. The Rust Send re-checks every time (design §5 step 2), so nothing can be posted misplaced.",
    "No test file was run; every block above rests on reading the code and the Stryker survivor list."
  ]
}
```