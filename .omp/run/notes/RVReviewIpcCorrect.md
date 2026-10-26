**Verdict: pass.** I found no `block` findings, 2 `should` and 1 `nit`, which is under the RV3 limit. I ran no tests or tools: no block depended on one (RV6), so every claim below comes from reading the code. Both `should` findings are in fixture mode only; the app's path matches Rust.

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "frontend/src/ipc/fixtureReview.ts",
      "line": 214,
      "rule_id": "fixture mirrors crates/review/src/send.rs send_one",
      "problem": "Under `?gitlab=stopped`, unqueue message 1 during the first 300 ms pause. The fixture then answers `stopped` with \"glab timed out\" and gives no progress for that message, because `postOutcome` runs before the waiting-text check, which lives in `record`. Rust's `send_one` reads `waiting_text` first, skips an unqueued message without calling glab, then counts it done (`done += 1`, progress) and goes on to `Sent`. So the fixture can show a send that stopped on a message that is no longer queued, which contradicts `SendReply.stopped`'s own words (\"the message it stopped at and the rest stay queued\"). Row 20's store and the owner's walk-throughs are built on fixture mode, so they would be checked against a reply the app can't produce. Nothing else gets harder.",
      "fix": "In `postQueue`, read `waitingText(message.posting)` straight after the pause. When it is null, call `onProgress({ done: index + 1, of })` and `continue` before calling `postOutcome`, as `send_one` does. Pass the text into `record`, and add a test row: `?gitlab=stopped` with message 1 unqueued mid-send answers `sent` with `sent: 1` and progress `[{1,2},{2,2}]`."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/fixtureGitLab.ts",
      "line": 41,
      "rule_id": "plan §2 #119",
      "problem": "`lookedAt` decides \"no branch\" from the label kind, but in Rust the right side's label is always `Named`. `MergeBase` is only ever the left side of `a...b` (`crates/range/src/lib.rs:31`, `open.rs:50`, and both committed fixture cases). The commit arm is therefore reachable only from impossible data. `fixtureGitLab.test.ts:6-26` (`DETACHED`, whose right side has a `mergeBase` label) tests exactly that state. A future reader would learn the wrong rule: in Rust, a right side with no branch is a `Named` commit id that `rev-parse --symbolic-full-name` can't resolve, and `?gitlab=noBranch` already scripts that case. Nothing else gets harder.",
      "fix": "Make `noMergeRequest`/`several` look up by `{ kind: \"branch\", name }` from the right side's `Named` label, leaving the commit lookup to `noBranch`, which already scripts it. Delete the `DETACHED` test rows, or rebuild them with a `Named` commit-id right side and say in the test name that only `noBranch` gives a commit lookup."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ipc/fixtureReview.test.ts",
      "line": 436,
      "problem": "The refusal test refuses message 1, but the seed already holds `{ refused, \"This needs a test.\", REFUSAL }`. A `record` that counted the refusal without writing the posting would still pass; only `refused: 1` catches the tally. Nothing gets harder.",
      "fix": "Before sending, `queueMessage(messageId(1), \"Needs a test now\")`, then expect `{ kind: \"refused\", text: \"Needs a test now\", reason: REFUSAL }` at index 1."
    }
  ],
  "survivors": [
    {
      "mutant": "reviewDomain.ts:150-152 case labels \"glabMissing\" / \"notLoggedIn\" / \"failed\" → \"\" (3 survived)",
      "verdict": "dropped VF7 (a) equivalent: with the label emptied, that kind falls to the `never` default, which returns the same `raw` object the pass-through arm returns. The output is identical."
    },
    {
      "mutant": "reviewDomain.ts:174, :194; threadLine.ts:75 (at 6919af1) `never` defaults (6 no coverage)",
      "verdict": "dropped VF7 (a): unreachable by type over generated, trusted payloads (decision 19)."
    },
    {
      "mutant": "fixtureGitLab.ts:24-38 module constants (12 survived: MERGE_REQUEST → {} and its 3 strings, DIFFS_PAGE, OTHER_REFERENCE, GITLAB_HEAD, GITLAB_BASE, LOGGED_OUT, FAILED, REFUSAL, TIMED_OUT)",
      "verdict": "dropped VF7 (b), the #732 load-time class, gate-covered by `pnpm test` because each value is asserted. MERGE_REQUEST's reference, title and web_url: fixtureReview.test.ts:21-25 plus every checkGitLab row, and fixtureGitLab.test.ts:40-48. DIFFS_PAGE: LINK in the seeded and send tests. \"!14\": the `several` row. GITLAB_HEAD/GITLAB_BASE: the `moved`/`otherBase` rows. LOGGED_OUT/FAILED: the `loggedOut`/`failed` rows. REFUSAL: the seeded and refusal tests. TIMED_OUT: the stopped test's `reason`."
    },
    {
      "mutant": "fixtureGitLab.ts:46-59 GITLAB_SCRIPTS → {} (1) and its 13 `true` → `false`",
      "verdict": "`{}` dropped VF7 (b): every script falls back to `linedUp`, which fails the noGlab…failed checkGitLab rows and the fixture_miss test. The 13 `true → false` dropped VF7 (a) equivalent: `isGitLabScript` uses `Object.hasOwn`, which reads only the keys."
    },
    {
      "mutant": "fixtureReview.ts:46 SEEDED_PATH → \"\", :49 SEEDED_SESSION → \"\" (at 6919af1)",
      "verdict": "dropped VF7 (b), #732 class: the seeded test asserts file 7, four threads and \"fixture-session\" (fixtureReview.test.ts:121-152)."
    }
  ],
  "checked": [
    "Shapes: every snake_case field in bindings.ts:245-750 is camelCased: Posting.pending draft_note/merge_request; MergeRequestRef.web_url; LookedAt.short_id; NotLinedUp's looked_at, merge_request, gitlab_head/shown_head and gitlab_base/shown_base; GitLabCheck.merge_request. MessageBody, SendProgress, ThreadLine and the other Posting arms have no snake_case field and pass through. `toSendReply` keeps sent, refused and reason and converts `list`. The tests use `toEqual` against exact camel objects, so a kept raw key would fail them (reviewDomain.test.ts:30-68, 186-238).",
    "Bad ids are refused by field through the brand guards (domain.ts:173-183 over `isNonNegativeInteger`): `threads[i].id`, `.file`, `.messages[j].id`, `.line.left`, `.line.right`, and ThreadAdded's `thread`. Each case is tested with the exact field path (reviewDomain.test.ts:100-160), plus one bad id through the Tauri source (tauriReview.test.ts:200-213).",
    "Line spaces: ThreadLine stays 0-based Left/Right through `toThreadLine`/`fromThreadLine`. The seeded lines are checked against board.ts's real differences: 19 and 20 are inside; 5↔5 and 100↔101 are outside and paired. I worked through the `rightOf` pairing (an insertion at L counts, since start+len ≤ L) and it is correct (fixtureRange.test.ts:206-243).",
    "Tauri channel: one `new Channel<SendProgress>(onProgress)` per call, passed as `commands.sendQueue`'s argument. The Rust side forwards bare `SendProgress` (src-tauri/src/review.rs:128-146). The test drives `channel.onmessage` from inside the mocked command and would fail if the channel were not passed or not wired (tauriReview.test.ts:165-185).",
    "Tauri failures: all seven commands return the IpcError unchanged through the shared `converted` (tauri.ts:43, after 3adf0b3). Tested per command (tauriReview.test.ts:187-198).",
    "Fixture vs Rust thread_store.rs: `EmptyMessage` comes before UnknownRangeFile, UnknownThread and UnknownMessage, as `require_text` runs first. Pending refuses both queue and unqueue with `MessagePending`. Unqueueing a notQueued message succeeds. A failed call takes no ids, matching Rust's clone-then-commit. `written` is in seconds. Ids continue after the seed.",
    "Fixture vs Rust send.rs: SendRunning is checked before the GitLab check, as `send_guard` precedes `lined_up`. The queue is fixed at the start, refused messages are sent again, and the order is threads then messages. `of` is the queue's length. Refused and pending messages both count done. A stop leaves the current message and the rest waiting, with no progress for it. A message unqueued mid-send is skipped but still counts as done (the linedUp/refusal paths; the stopped path is finding 1). `sending` is reset in `finally` (re-send tested at fixtureReview.test.ts:483-497).",
    "?gitlab scripts: all 13 answers are asserted with exact values. `checking` answers only at 3000 ms. An unknown script logs `review.fixture_miss` and lines up, while an empty one logs nothing. `refusal` refuses queue index 1 and `stopped` times out at index 1, as the brief says. noGlab, moved and preparing send nothing and report no progress.",
    "Nothing in a reply aliases the store: `toThread`/`toThreadLine` build new arrays and objects. The postings and bodies that are shared are only ever replaced in the store, never changed in place.",
    "problemText: `hasFixedReason` narrows before the switch, which stays exhaustive. All six new fixed reasons and RemoveFailed (folder plus the trimmed message) are asserted as exact strings, and the five older fixed reasons keep their own tests (problemText.test.ts:152-204, 206-224).",
    "Risk register: no RK row's owner is touched (ipc conversions and fixtures only); merge-core §3.1 and CM1–CM9 are not in scope.",
    "Implementer deviations accepted: the fixtureGitLab split, `RemoveFailed` naming its folder, the optional field argument, SendRunning before the check, and an unknown script logging a miss. The open risk about the seeded lines' coupling to review.json is guarded by fixtureRange.test.ts's difference check."
  ]
}
```