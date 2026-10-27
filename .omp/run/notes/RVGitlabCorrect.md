```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "design §5 steps 3–5 / brief Contract (threads locked only briefly)",
      "file": "crates/review/src/send.rs",
      "line": 96,
      "problem": "The send posts the snapshot taken at line 70 and then calls `record(message, posting)` with no check, but `record` (thread_store.rs:149) overwrites whatever is stored. The lock is deliberately released across glab, and the design keeps Unqueue and Queue enabled, so the user can change a message mid-send. A message unqueued while \"Sending 2 of 7…\" is still posted to GitLab and comes back as `Pending`, which undoes the Unqueue. A message re-queued with edited text has its old text posted, and the edit is silently replaced by `Pending { text: old }`.",
      "fix": "Before each post, re-read the message's current posting under a brief lock: skip it unless it is still `Queued`/`Refused`, and post the current text. Record only when the posting is still the one the post was based on, through a `ThreadStore` addition that returns whether it applied (report it as a row-14 change). Add an integration test that unqueues the second message from the progress callback and asserts it is neither posted nor recorded `Pending`."
    },
    {
      "severity": "block",
      "rule_id": "design §5 step 4 (duplicate safety)",
      "file": "crates/review/src/send.rs",
      "line": 180,
      "problem": "Any draft with the same text, paths, lines and head can be matched, including a draft this store already recorded as `Pending` for another message: GitLab keeps listing unpublished drafts. Take a later message with the same text on the same thread line (for example a second \"Same here\" before the review is published). It is recorded `Pending` with the earlier message's `draft_note` and never posted, so yamt shows two pending comments while GitLab holds one.",
      "fix": "When taking the snapshot, collect the `draft_note` ids of messages already `Pending` in the store and drop those drafts before matching. Only drafts no message owns can then stand in for a timed-out or crashed post. Extend the `drafted` scenario with a pending message that owns draft 301 and assert that the new message is posted."
    },
    {
      "severity": "should",
      "rule_id": "plan §2 #118 (drafts listed first)",
      "file": "crates/review/tests/review.rs",
      "line": 380,
      "problem": "No test covers the rule that a send which cannot list the drafts posts nothing (`post_queue`'s `Err(reason) => return … stopped`). This rule is what makes a retry after a timeout safe. If that arm changed to post with an empty draft list, every test would still pass and a retried send would duplicate drafts. Mutants cannot reach the arm.",
      "fix": "Add `a_send_that_cannot_list_the_drafts_posts_nothing`: run `send_queue` on `main...<FEATURE>` with the `commit-route` scenario, which lines up and has no `draft-notes.json`, so the fake answers 404. Assert `Stopped` with glab's line, no `stdin:` in the log, and every posting still `Queued`."
    },
    {
      "severity": "should",
      "rule_id": "RVGlab open risk (What's-new notice on stderr)",
      "file": "crates/review/src/send.rs",
      "line": 281,
      "problem": "[INFERENCE: not measured for `auth status`] Row 15 measured glab printing a one-time \"What's new in glab v1.124.0\" notice first on stderr after a fresh install or an upgrade. `auth status` is always yamt's first glab call. If the notice also appears there, `first_line(&stderr)` makes the hover read \"glab is not logged in: What's new in glab v1.124.0\" exactly when a user who just installed glab is logged out. Nothing gets harder as the app grows; one sentence is wrong once.",
      "fix": "Measure `glab auth status` under a fresh config. If the notice appears, take the first stderr line after the notice lines, for example the first line not starting with \"What's new\" or \"Run: glab whatsnew\", and record the measurement in tests/glab/README.md."
    }
  ],
  "checked": [
    "Lines-up rule (lines_up.rs:40-66): base_sha == compared.left and head_sha == compared.right, start_sha ignored. This matches GitLab's MR diff, which runs from base_sha (the merge base) to head_sha. lined-up (start_sha=main) lines up and two-dots (start_sha=merge base) lines up, so a start_sha-compared mutant fails",
    "a..b vs a...b: lines_up does not look at the dots by design (#119). yamt-range proves `a..b` gives left = a in open.rs:207 (`main..local` → left main), and the integration tests prove `main...feature` gives the merge base by lining up against base_sha 531ea52",
    "One non-lining-up candidate gives Moved (head checked first) or OtherBase; null diff_refs gives Preparing; several give Several; none gives NoMergeRequest with looked_at (design §6)",
    "Candidates: on the branch route GitLab filters by `state=opened` and `source_branch`; on the commit route `candidates` keeps state==opened && sha==right before truncating to MAX_MERGE_REQUESTS_CHECKED=5. commit-route fixture: merged !9 and !11 (ending at 7685b25) are dropped, !12 kept; at_most_five_merge_requests_are_checked",
    "right_branch: refs/heads/x → x; refs/remotes/<longest remote>/x → x; detached HEAD, tags and HEAD~n → None → commit route. An empty side is \"HEAD\" by spec.rs:2 (EMPTY_SIDE) for both Named and MergeBase.right, so the empty name gitio's `--verify` refuses never reaches it (RVGlab:77)",
    "Endpoints follow GitLab REST and design §5: projects/:fullpath/merge_requests?state=opened&source_branch=, projects/:fullpath/repository/commits/:sha/merge_requests, projects/<project_id>/merge_requests/<iid> (the MR's own project_id), …/draft_notes GET --paginate and POST --include --input -",
    "Position body (position.rs): ThreadLine is 0-based (merge-core line.rs:24; plan #116 '+1 only in the GitLab position'); removed → old_line only, added → new_line only, both unchanged variants → both, each +1. Renamed → old_path=old/new_path=new; added/deleted → both = entry.path (the old path for a deleted file, range lib.rs:58). The body has position_type text and base/start/head from the checked diff_refs; a missing side's key is left out rather than null",
    "Tests would catch an off-by-one: the_post_body_names_the_three_commits_and_the_position asserts exact JSON (new_line 3 for RightLine(2), old_line 2 for LeftLine(1), both 1 for the renamed file's line 0); position unit tests cover all four variants",
    "Draft matching: same note, head_sha and LinePlace (paths and both optional lines). drafted fixture decoys are a same-text draft on new_line 4 (300) and an unplaced draft (302); the test expects 301, so a match that ignores lines fails. Each draft is used once (swap_remove). A 2xx whose id cannot be read stops and stays queued, so the next send matches it",
    "Refusal vs stop (posted): 2xx → Drafted; 4xx except 401/403/429 → Refused with body.message, else glab's last stderr line, else 'HTTP n'; 5xx, 3xx, 401/403/429, timeout, glab gone, and no HTTP status line → Stop. Matches plan #118 and design §5 step 5; unit test a_refusal_keeps_gitlab_s_words…; the http_answer_from parse matches the row-15 measurement (RVGlab.md:48-51: status line, CRLF headers, empty line, body; exit 1 on HTTP error)",
    "A refused message is re-sent: queued() includes Refused (thread_store.rs:133); a stop leaves a Refused message Refused and Queued ones Queued (no record before the stop)",
    "Lock: post_queue takes only temporary guards (snapshot :70, record :96, the list in the replies); none lives across answer/outcome/run; check_gitlab never touches threads",
    "Progress: one SendProgress after each handled message (drafted, refused or posted), with `of` = the snapshot length and none after a stop; asserted [1,2,3]/3 in sent, refusal and drafted, [1]/3 on timeout, [] when not lined up and for missing/logged-out glab",
    "Recheck inside send: the moved scenario gives NotLinedUp, no draft_notes call, no post, postings unchanged in memory and on disk",
    "Thread order beats file order: the test threads are created reminders → keys → mockBoards, which is not the range's list order, and the posted notes come back in creation order",
    "Timeout test: with_timeout 2 s, the second post sleeps 25 s → Stopped 'glab timed out'; two posts logged, the rest queued in memory and on disk",
    "Implementer open risks accepted: --paginate concatenated arrays (the parser takes one array or several; comment wording is the boundary reviewer's); 100 Continue is not printed by Go's client; the orphan `sleep` holds only glab's pipes, not the test's; short-id length is the boundary reviewer's finding",
    "Boundary findings not repeated (short ids, glab_answer split, ids guard test, per-iid fake, RefCell, paginate comment, status match, dead field)",
    "Mutation: no survivors reported (129 tested); I ran no tests (none of the blocks depends on running one)"
  ]
}
```