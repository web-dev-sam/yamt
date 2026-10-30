# Slice MrRustTidy — module notes and one copied constant left by the merge-request build

Board "Merge requests" row 6b. The documentation pass (`MrDocs`, notes `.omp/run/notes/MrDocs.md`, field `left_stale`)
found stale text in module notes no build owned, and one constant the commands fix round copied
(`MrOpenCommandsR1Boundary` open risk). Fix exactly these:

1. `src-tauri/AGENTS.md`: the compare window no longer "never runs git": it reads its start folder's remotes at start
   and runs glab and the fetch for the merge-request page (plan §2 #94 amended, #130, #132). Add `merge_requests.rs`,
   `range_window.rs`, `appimage.rs` `running_appimage`, `lib.rs` `from_start_dir`, `window.rs` `run_compare(folder)`,
   in the file's existing style.
2. `crates/gitio/AGENTS.md`: `fetch.rs` (`fetch_without_refs`, `FETCH_TIMEOUT`), `names.rs` `remote_urls`/`RemoteUrl`,
   `merge_config.rs` `config_entries`, `glab.rs` `Glab::get`/`auth_status`/`AuthStatus`/`first_line`/`last_line`/
   `TIMED_OUT`, in the file's existing style.
3. `src-tauri/src/lib.rs:45` `COMPARE_FOLDER` repeats `args.rs`'s private `CURRENT_DIR` and shares a name with
   `compare.rs:12`'s `COMPARE_FOLDER`: one constant for "the folder yamt was started in", used by both `args.rs` and
   `lib.rs`; no name clash. Behaviour unchanged.

## Target

Owned: `src-tauri/AGENTS.md`, `crates/gitio/AGENTS.md`, `src-tauri/src/{lib.rs,args.rs}`. Read-only: everything else.

## Acceptance

- `cargo test -p yamt-app`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check` pass.
- `grep -n '"\."' src-tauri/src/lib.rs src-tauri/src/args.rs` shows one definition.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://comment-policy`.
