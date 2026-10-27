Both blocks from fix round 1 are fixed, and every acceptance check passes. The range repository gets the same five commit ids, and both range fixtures come out byte-identical.

**summary**
- `crates/cli/tests/range.rs` no longer has its own `git()` helper. It builds its repository with `yamt_conflict_repo::diverged_repo` and ranges `main..local`, like `crates/range/tests/range.rs` does.
- `scripts/git-sandbox.sh` now has the one `put <layer> <paths…>` (the caller sets `files=`). `range-repo.sh` uses it and its own copy is gone; the GitLab round's header line is kept.
- `demo-repo.sh` calls a wrapper, `put_recorded`, which runs the shared `put` and then fills `was_put` for `require_all_put`.

**files_changed**
- `crates/cli/tests/range.rs`
- `scripts/git-sandbox.sh`
- `scripts/demo-repo.sh`
- `scripts/range-repo.sh`

**tests_added**
- No new tests. Two existing tests now run on the `diverged_repo` repository:
  - `range_prints_the_start_and_every_file_at_its_id` (`main..local`) still checks ids 0, 1, 2 → `a.txt`, `b.txt`, `c.bin` and each file's content.
  - `an_unknown_name_exits_2_with_the_range_error` now uses `nope..local`.
- Both now get git's isolation from `yamt_conflict_repo`: `LC_ALL`, `core.attributesFile=/dev/null`, the `GIT_CONFIG_PARAMETERS`/`GIT_CONFIG_COUNT` removal and `init.defaultBranch`.

**smoke_evidence**
- `bash -n scripts/git-sandbox.sh && bash -n scripts/demo-repo.sh && bash -n scripts/range-repo.sh && echo ok && cargo fmt --check && echo fmt-ok` → `ok`, `fmt-ok`
- `scripts/range-repo.sh /tmp/rvfx/range && git -C /tmp/rvfx/range log --all --format='%H %s'`, into an empty folder:
  ```
  437805506eab02eaba409bdeffd00e0383476e35 README: swimlanes
  9c1ba3fc606a3776061d23006b83e2af2a357112 New logo, staging config and release tools
  7685b254e6e1b9199692006c4d3bcd647ca7f914 Reminders before a card is due
  531ea52dfb892e20206010fb6cd6161d9c88964a Build tools, the old notes and the vendored UI kit
  5f9d381d2306ae5110df08ef1fa0d0cbd04edb3b Taskboard: board model, API client and the logo
  ```
- `target/debug/yamt-cli range /tmp/rvfx/range main...feature > /tmp/rvfx/review.json; cmp /tmp/rvfx/review.json frontend/fixtures/range/review.json && echo cmp-identical` → `cmp-identical`
- `target/debug/yamt-cli range /tmp/rvfx/range feature..feature | cmp - frontend/fixtures/range/empty.json && echo empty-identical` → `empty-identical`
- `scripts/demo-repo.sh /tmp/rvfx/demo` → `demo-repo: /tmp/rvfx/demo is mid-merge (main merging feature/reminders); conflicted files:` followed by the same 7 files: `docs/shortcuts.md`, `public/logo.png`, `src/api/client.ts`, `src/api/mockBoards.ts`, `src/board/board.ts`, `src/board/card.ts`, `src/ui/cardView.ts`. All three `require_all_put` checks passed.
- `cargo clippy -q --workspace --all-targets -- -D warnings && echo clippy-ok` → `clippy-ok`
- `cargo test -q -p yamt-cli` → every binary `test result: ok` (17, 2, 4, 4 passed, 0 failed); `--test range` → `4 passed; 0 failed`

**deviations_from_brief**
- In `range.rs`, the unknown-name test's comment now reads "Catches a range git cannot resolve exiting 1 like a read failure." This is the correctness review's nit, in an owned file.
- The demo wrapper is named `put_recorded`; the brief left the name open. Every `put` call in `demo-repo.sh` now calls it, and one long line was reflowed.
- The `git-sandbox.sh` header now lists `range-repo.sh` among the scripts that source it (the boundary review's PM6 point for that file). The map's git-sandbox line is still the orchestrator's docs pass.
- I didn't change `commit_at` in `range-repo.sh`: the boundary review's nit (dates only) and the `commit_as` copy are outside this brief.
- `demo-repo.sh` needs `frontend/node_modules`, so I ran `pnpm -C frontend install --offline --frozen-lockfile` in the worktree. It only touches gitignored files.

**open_risks**
- `scripts/demo-repo.sh:39-47`: `put_recorded` records paths only after `put` returns. Under `set -e` a failed copy stops the script anyway, so this has no effect today.
- The `cmp` checks ran `yamt-cli` without the justfile's `{{ hermetic_git }}`. Both files still matched on this machine; `just fixtures-check` runs them isolated.