All ten items are fixed, each with the test the brief names. The four acceptance commands pass, along with all the earlier tests. I did not commit anything.

```
summary
  The send now re-reads each message's text under a short lock just before posting it. It records the result only while the message
  still waits with that text (`ThreadStore::record_if_waiting` returns whether it applied); drafts that a pending message already owns
  are dropped before matching. `Compared` now carries git's `%h` short ids for both sides; the hover uses them and cuts GitLab's ids
  to the same length. glab's output reading moved to `glab_answer.rs`, with the HTTP status rule as one `match`.
  The fake glab now serves `merge-request-<iid>.json` first. New scenario `several-none`; the repo-ids guard test is in;
  `QueuedMessage.thread` is gone; the test progress uses mpsc instead of `RefCell`; the `--paginate` comment is reworded.

files_changed
  crates/range/src/lib.rs, crates/range/src/open.rs
  crates/review/src/{lib,send,glab_answer (new),lines_up,gitlab,thread_store}.rs, crates/review/tests/review.rs, crates/review/AGENTS.md
  scripts/fake-glab/glab, scripts/range-repo.sh (header line)
  tests/glab/README.md, tests/glab/drafted/post-3.json (new), tests/glab/several-none/{merge-requests,merge-request,merge-request-14}.json (new)

tests_added
  review.rs a_message_unqueued_while_the_send_runs_is_neither_posted_nor_pending — item 1: after step 1, the progress callback unqueues
    message 2; only messages 1 and 3 are posted; message 2 is NotQueued on disk; progress is [1,2,3]
  review.rs a_message_edited_while_the_send_runs_is_posted_with_its_new_text — item 1: an edit made mid-send is the text that gets
    posted and recorded
  review.rs a_draft_a_pending_message_owns_never_stands_in_for_another_message — item 2: a second message with the same text on the
    same line, sent after message 301 is already Pending, is posted as 305 and is not matched to 301
  review.rs a_send_that_cannot_list_the_drafts_posts_nothing — item 4: commit-route on main...<FEATURE>: Stopped with
    "glab: 404 Not Found (HTTP 404)", no `stdin:` in the log, every posting still Queued in memory and on disk
  review.rs range_repo_has_the_scenarios_commit_ids — item 6: the merge base, main and feature of range-repo.sh equal the three
    constants; the failure message names tests/glab/*
  review.rs several_line_up_as_the_one_that_matches_and_none_name_what_was_looked_at (replaces several_and_none_…) — item 7:
    `several` lines up as !14, `several-none` gives Several ["!12","!14"], `no-merge-request` gives NoMergeRequest
  lines_up.rs gitlab_s_ids_are_cut_to_the_length_of_the_shown_ones — item 3: with 10-character shown ids, Moved and OtherBase show
    10-character ids from both sides
  thread_store.rs waiting_text_is_a_queued_or_refused_message_s_text_now; pending_draft_notes_are_the_drafts_pending_messages_own;
    record_if_waiting_writes_the_posting_and_keeps_it; record_if_waiting_leaves_a_changed_message_alone_and_refuses_an_unknown_one
    (an edited, unqueued or already pending message → false and nothing written; an unknown id → UnknownMessage)
  glab_answer.rs: the moved tests, split in two to stay under 40 lines: a_refusal_keeps_gitlab_s_words_and_a_failure_of_user_or_server_stops
    (now also covers 499 → refused, 299 → drafted); no_http_answer_a_timeout_or_glab_gone_stops_in_glab_s_words
  range open.rs: the accessors test now asserts left_short_id/right_short_id against `git rev-parse --short`

smoke_evidence
  cargo fmt --check → FMT-OK
  cargo clippy --workspace --all-targets -- -D warnings → Finished `dev` profile [unoptimized + debuginfo] target(s) in 2m 40s
    (no warnings)
  cargo test -p yamt-review -p yamt-range -p yamt-app → every suite "test result: ok", 0 failed in all; among them:
    124 passed (yamt-app lib), 35 passed (yamt-review lib), 15 passed (tests/review.rs), 15 passed (tests/threads.rs);
    test range_repo_has_the_scenarios_commit_ids ... ok
    test a_send_that_cannot_list_the_drafts_posts_nothing ... ok
    test a_message_unqueued_while_the_send_runs_is_neither_posted_nor_pending ... ok
    test a_message_edited_while_the_send_runs_is_posted_with_its_new_text ... ok
    test several_line_up_as_the_one_that_matches_and_none_name_what_was_looked_at ... ok
    test a_draft_a_pending_message_owns_never_stands_in_for_another_message ... ok
  just arch-check → arch-check: ok

deviations_from_brief
  - Item 1, how a change is detected: `record_if_waiting(message, posted_text, posting)` applies only while the stored posting is
    still Queued or Refused with exactly the posted text; it does not compare the whole Posting value. The only difference:
    unqueuing and re-queuing the same text mid-send still records. The brief left the comparison open.
  - Item 1, counting: `sent` and `refused` count only results that were recorded. A message skipped because it no longer waits
    still advances `done`, so progress reaches `of`. A post whose record does not apply leaves an unowned draft on GitLab; the
    next send matches it instead of posting again.
  - Item 1, the snapshot: `QueuedMessage` dropped `text` as well as `thread` (item 10), since the text is now read again before
    each post. The old `record` is replaced by `record_if_waiting`, its only caller being the sender. New `pub(crate)` methods:
    `waiting_text` and `pending_draft_notes`.
  - Item 2, the scenario: the "pending message owns 301" case is its own test, `a_draft_a_pending_message_owns_never_stands_in_for_another_message`,
    which runs two sends on `drafted` (added `post-3.json`, id 305). Extending the existing test pushed it past clippy's
    40-line limit.
  - The glab_answer test had to be split into two for the 40-line limit; in the moved code, `HttpAnswer` and `http_answer_from`
    became private to that module.
  - Item 3, the range test's ids: `crates/range/src/open.rs`'s test reads the short ids with `git rev-parse --short` through a new
    test helper, `short_commit`. In the unit tests, the 7-character length is the constant `GIT_SHORT_ID_CHARS`.
  - Docs: tests/glab/README.md has the `merge-request-<iid>.json` row, and crates/review/AGENTS.md names the new ThreadStore
    methods. Not done: the README scenario list, AGENTS.md entries for send/gitlab/glab_answer, and the map; I left those for the
    orchestrator's docs pass.

open_risks
  - crates/review/tests/review.rs is 713 lines, against RS6's 400 for files; test files already exceed it (threads.rs 561).
  - crates/review/src/thread_store.rs is 396 lines, close to the 400 limit.
  - crates/review/src/send.rs:101-130: if a message changes while its post is running, the draft stays on GitLab with no owner and
    is not reported. The next send matches it only if the text and line are the same again.
```