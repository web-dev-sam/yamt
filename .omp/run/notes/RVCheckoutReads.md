The brief is done: `yamt-gitio` gains the five checkout methods and `StatusEntry`, and `yamt-compare` gains `text_differences`. Every acceptance test passes, as do the brief's `cargo fmt --check`, workspace clippy and the crate tests. One method does more than the brief's comment says: `clone_shared_into` also deletes the clone's branch (first deviation below).

**summary**
- `crates/gitio/src/checkout.rs` (new) adds `StatusEntry { xy, path }` and five `Repo` methods: `clone_shared_into`, `remove_remote`, `checkout_detached`, `status_entries` and `head_commit`.
- The clone and the checkout use the no-deadline runner (`run_to_end`) with the usual `LC_ALL=C` command. The other git runs use the 30 s deadline runner.
- Status output is read by a small parser over the `-z` records; paths stay bytes.
- `yamt_compare::text_differences(left, right)` returns `Error::TooLarge { bytes }` when either side is over `MAX_COLUMN_BYTES` (it reuses `files::require_within_limit`); otherwise it returns `merge_core::compare`.

**files_changed**
- `crates/gitio/src/checkout.rs` (new)
- `crates/gitio/src/lib.rs` (`mod checkout`, `pub use checkout::StatusEntry`, the `//!` line now mentions the clone; the existing re-exports, `glab`/`program` included, are kept)
- `crates/gitio/tests/checkout.rs` (new)
- `crates/compare/src/lib.rs` (`text_differences` and its two tests only)

**tests_added**
- `checkout::tests::status_records_parse_with_their_letters_and_paths_as_written`: `??`, ` D`, `M ` and `A ` records; a path with a space and one with a newline come back as written.
- `checkout::tests::a_status_path_that_is_not_utf8_keeps_its_bytes` (unix): the bytes `\xff\xfe` survive.
- `checkout::tests::a_clean_status_lists_nothing`: empty output gives an empty list.
- `checkout::tests::a_status_record_without_a_path_or_its_space_is_unexpected_output`: `"?? "`, `"??x.txt"` and `"M"` each give `UnexpectedOutput { command: "status" }`.
- `a_shared_clone_without_origin_checks_out_the_commit_detached`: the clone lands at `<folder>/checkout`. HEAD is detached (`symbolic-ref` exits 1), HEAD is the `remote` commit and the file holds that commit's text. Status is clean and `git remote` is empty.
- `the_clone_borrows_objects_and_keeps_no_refs_of_the_source`: `objects/info/alternates` points at the source's objects. After `remove_remote`, `for-each-ref` in the clone prints nothing and `git remote` is empty. HEAD is the source's checked-out commit.
- `status_lists_modified_added_deleted_and_untracked_files_but_not_ignored_ones`: the result is exactly `A ` added.txt, ` M` edited.txt, `??` new folder/untracked.txt, ` D` removed.txt and `M ` staged.txt. `ignored.txt`, excluded through `.git/info/exclude`, is not listed.
- `head_commit_moves_after_a_commit_in_the_clone`: after a commit, `head_commit` is no longer the checked-out commit, equals `rev-parse HEAD`, and its parent is that commit.
- `a_commit_in_the_clone_leaves_the_source_refs_and_config_untouched`: a branch and a commit are made in the clone. The source's `for-each-ref`, `.git/config` bytes and `symbolic-ref HEAD` stay the same, and `cat-file -e <new commit>` fails in the source.
- `text_differences_refuses_a_side_over_the_column_limit`: a side of `MAX_COLUMN_BYTES + 1` bytes is refused as `TooLarge` with that byte count, on either side. Both sides at exactly the limit are accepted.
- `text_differences_equals_merge_core_compare`: the result is not empty and equals `compare(left, right)`.

**smoke_evidence**
- `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 27.56s`, with no warnings.
- `cargo test -p yamt-gitio -p yamt-compare`:
  - `Running tests/checkout.rs … test result: ok. 5 passed; 0 failed`
  - `test tests::text_differences_equals_merge_core_compare ... ok`
  - `test tests::text_differences_refuses_a_side_over_the_column_limit ... ok`
  - yamt-compare unittests `ok. 14 passed`; yamt-gitio unittests `ok. 40 passed` (the 4 `checkout::tests::*` included)
  - every other gitio and compare suite also reports `test result: ok`
- No test writes or runs a hook or script.
- `just mutants` was not run.

**deviations_from_brief**
- **`clone_shared_into` also deletes the clone's branch.** `git clone` always makes a local branch from the source's HEAD (here `refs/heads/local`), so the acceptance check "the clone's `refs/heads` holds no source branch after `remove_remote`" can't pass on clone alone. After cloning, the method points HEAD straight at its commit (`update-ref --no-deref HEAD <oid>`), then deletes each `refs/heads/*` that `for-each-ref` lists (`update-ref --stdin`). These are two runs because git refuses one transaction that updates HEAD and deletes the branch it points to ("multiple updates for 'HEAD'…"). If HEAD has no commit yet (an empty source), it does nothing.
- **A relative `into` is joined to the repository root**, because the clone runs with the root as working folder.
- **The clone's `Repo` comes from `Repo::discover(&into)`**, since `Repo`'s fields are private to `repo.rs`. This finds git on PATH a second time.
- **`run_to_success` repeats about 10 lines of `Repo::abort`'s handling** (non-zero exit → `GitFailed` with stderr). `abort_continue.rs` is outside my files, so I couldn't share it.
- **Docs and AGENTS.md not updated.** The design's build table also lists `docs/architecture.md` §3.2/§3.7 for this step, and the project map's gitio line and `crates/gitio/AGENTS.md` don't mention `checkout.rs`. None of these were mine to edit, so Main should update them.

**open_risks**
- `crates/gitio/src/checkout.rs:73-88`: two separate ref updates. If the run is killed in between, HEAD is detached but the branch is still there; running the clone again from scratch fixes it.
- `crates/gitio/tests/checkout.rs`: `Repo` runs git with the user's own config, as the other gitio tests do. A global ignore rule matching `untracked.txt` or `added.txt`, or a global post-checkout hook, could change the results.
- `crates/compare/src/lib.rs` (the column-limit test): it builds two 8 MiB strings and diffs two equal ones; this takes about 0.17 s here.

Checks for Main: `just check`, `just mutants` on `crates/gitio/src/checkout.rs` and `text_differences`, and `just arch-check` (no new dependency edges).