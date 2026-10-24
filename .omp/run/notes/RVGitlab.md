I've built the GitLab side of the review: `check_gitlab` and `send_queue` (row 16), plus the twelve recorded scenarios. All four acceptance commands pass, and cargo-mutants caught every viable mutant in my files.

## summary
- **`check_gitlab`** goes through `glab auth status`, then the right side's branch (or, when the side is a commit id, the merge requests of that commit), up to `MAX_MERGE_REQUESTS_CHECKED = 5` candidates and each one's `diff_refs`. The rule is the pure `lines_up`: base equals the left commit and head equals the right one; `start_sha` is not compared.
- **`send_queue`** checks again first, then takes a snapshot of the queue under the lock and lists the existing drafts. It then works through the messages in thread order: a message that matches a draft is recorded as pending without posting again; anything else is posted with the three commits and the position.
  - A 2xx becomes `Pending { link: <web_url>/diffs }`.
  - Any other 4xx becomes `Refused` with GitLab's message, and the send continues.
  - A timeout, 401/403/429, 5xx, glab missing or output with no HTTP status stops the send as `Stopped`.
  - After each message it locks the store, writes the result and reports progress. The lock is never held across a glab call.
- **New modules:** `right_branch.rs`, `gitlab.rs` (GitLab's JSON read with `serde_json`; an unexpected shape becomes `Failed` naming the field, e.g. `references.short`), `lines_up.rs`, `position.rs` (1-based lines, both paths, `same_draft`) and `send.rs`. The IPC types from the contract are in `lib.rs`.
- **Scenarios** in `tests/glab/` use the real commit ids of `scripts/range-repo.sh`, whose names and dates are fixed: merge base `531ea52…`, `feature` `9c1ba3f…`, `main` `4378055…`. The same folders therefore work for the Rust tests and for an app session on the range repository.

## files_changed
- `crates/review/Cargo.toml` (adds `yamt-gitio`)
- `crates/review/src/lib.rs`, `crates/review/src/thread_store.rs` (only the three `expect(dead_code)` lines removed, as you allowed)
- New: `crates/review/src/{right_branch,gitlab,lines_up,position,send}.rs`, `crates/review/tests/review.rs`
- New: `tests/glab/{lined-up,two-dots,moved,other-base,several,preparing,no-merge-request,commit-route,logged-out,refusal,timeout,drafted}/*`
- `Cargo.lock` (changed by cargo for the new dependency)

## tests_added
**`lines_up.rs`** (over the recorded JSON):
- `three_dots_lines_up_when_base_and_head_are_the_two_commits`: lines up, including `start_sha`; with `main` as the left side it is `OtherBase`.
- `two_dots_lines_up_only_when_the_left_is_the_merge_base`: the merge base lines up; `main` gives `OtherBase` 531ea52 / 4378055.
- `a_moved_head_names_both_short_ids`: d1e2f3a / 9c1ba3f.
- `another_base_names_both_short_ids`: 5f9d381 / 531ea52.
- `no_open_merge_request_from_the_branch`
- `several_open_merge_requests_take_the_one_that_lines_up`: picks !14; with none lining up it is `Several` ["!12", "!14"].
- `a_commit_id_side_uses_the_merge_request_ending_at_it`: drops the merged !9 and !11, which ends elsewhere.
- `null_diff_refs_is_preparing`
- `at_most_five_merge_requests_are_checked`

**`gitlab.rs`:**
- `unexpected_json_is_failed_naming_the_field`: `project_id`, `references.short`, `diff_refs.head_sha`, `sha`, `id`, not-JSON, not-a-list.
- Plus drafts read across `--paginate` pages, GitLab's `message`/`error` words, and the endpoint argv.

**`position.rs`:**
- `removed_added_and_unchanged_give_one_based_old_and_new_lines`
- `renamed_added_and_deleted_files_give_both_paths`: also the not-UTF-8 refusal.
- A body test showing the missing side's line is left out.
- `same_draft` is checked field by field.

**`send.rs` and `right_branch.rs`:** how each post result is sorted (refused, drafted, stopped), glab's last stderr line, the exit wording, `--include` parsing, and choosing the longest matching remote.

**`tests/review.rs`** (`#[cfg(unix)]`; runs `scripts/range-repo.sh` and the fake through a symlink beside its `glab.env`):
- `sending_posts_in_thread_order_and_records_pending_with_the_link`
- `the_post_body_names_the_three_commits_and_the_position`
- `a_refused_message_keeps_its_reason_and_stays_queued_while_the_others_are_sent`
- `a_timeout_stops_the_send_and_leaves_the_rest_queued`
- `a_message_already_among_the_drafts_is_recorded_without_posting_again`
- `send_rechecks_and_posts_nothing_when_the_merge_request_moved`
- `glab_missing_and_logged_out_are_their_reasons`
- Extra: `a_branch_side_asks_for_the_branch_s_open_merge_requests` (a local and a remote-tracking side, exact argv, cwd), `a_commit_id_side_asks_for_the_commit_s_merge_requests`, `several_and_none_name_what_was_looked_at`

## smoke_evidence
- `cargo fmt --check`: no output.
- `cargo clippy --workspace --all-targets -- -D warnings`: `Finished`, no warnings.
- `cargo test -p yamt-review`:
  - lib: `ok. 31 passed`
  - review: `ok. 10 passed; … finished in 2.60s`
  - threads: `ok. 15 passed`
- `just arch-check`: `arch-check: ok`
- `cargo mutants -p yamt-review -f …` on all five new files:
  - first run: `133 mutants tested: 8 missed, 94 caught, 31 unviable`
  - I added tests and rewrote `branch_after_remote`; the rerun on `send.rs`, `right_branch.rs` and `gitlab.rs` gave `102 mutants tested in 2m: 78 caught, 24 unviable`.

## deviations_from_brief
- **Edits outside my list:** `thread_store.rs` — the three `expect(dead_code)` lines removed, with your permission. `Cargo.lock` changed through cargo.
- **The fake is passed as `Some(&Glab::at(link))`, not put on a temp PATH.** The contract takes `Option<&Glab>`, so this is simpler.
- **Tests build their repository with `scripts/range-repo.sh`** (bash, about 0.4 s each) rather than `yamt-conflict-repo`. This keeps the commit ids fixed, so the recorded JSON holds real ids.
- **Test placement:** `unexpected_json_is_failed_naming_the_field` is in `gitlab.rs`, where the reading happens, not in `lines_up.rs`. `candidates()`, the commit-route filter, is in `lines_up.rs`.
- **Decisions the brief left open:**
  - Short ids are 7 characters (`SHORT_ID_CHARS`).
  - A draft that matches is counted in `sent` and in progress; each draft is used once.
  - A draft whose position cannot be read matches no message instead of failing the send.
  - A path containing U+FFFD is refused with "the path is not UTF-8" without posting (design point 1). It is detected through the lossy path.
  - Stop reasons read "glab timed out" and "glab printed no HTTP answer". Otherwise the reason is glab's last stderr line, or "glab exited with status N".
  - `send_queue` returns `UnknownFile` if a queued file has no entry. That cannot happen.
- **For you to add to `tests/glab/README.md`** (not mine):
  - The twelve scenarios, and that they use `range-repo.sh`'s commit ids.
  - `several/merge-request-14.json` is read only by the unit test. The fake serves `merge-request.json` for every iid, so an app session on `several` shows `Several` ["!12", "!12"].
  - `refusal/post-2.err` is my imitation of glab's `glab: <message> (HTTP 400)` line, because the fake's sed cut a message containing quotes. It was not measured.
- **Docs not updated (not mine):** the project map, `docs/architecture.md` and `crates/review/AGENTS.md` need the new modules, `check_gitlab`/`send_queue` and the scenarios.

## open_risks
- `crates/review/src/gitlab.rs:184` (`draft_notes_from`): I assumed `glab api --paginate` prints one JSON array per page; a single array also parses. Not measured.
- `crates/review/src/send.rs:187` (`posted`): a 3xx or 1xx stops the send. HTTP/1.1 `100 Continue` blocks are not skipped.
- `crates/review/tests/review.rs`: the timeout test leaves a `sleep 25` running behind it after glab is killed. It holds no lock or file.
- `crates/review/src/lines_up.rs:85` (`short_id`): 7 characters, while the window header uses git's own `%h` length, which can be longer in a large repository.