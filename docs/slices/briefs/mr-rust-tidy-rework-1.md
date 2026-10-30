# Slice MrRustTidyR1 — two sentences in `src-tauri/AGENTS.md`

Board "Merge requests" row 6b. Round 1: `MrRustTidy` (brief `docs/slices/briefs/mr-rust-tidy.md`). Fix exactly
`#1968` and `#1970` (`just findings 1968 1970`):

1. **#1968** `merge_requests.rs` and `window.rs` (`run_compare`) entries: say what the code does — glab login check,
   the MR's commits from glab, a fetch only when a commit is missing (plan §2 #132), the pair's lock, then
   `range_window::start`; the compare window runs glab, and a fetch if needed.
2. **#1970** The `window.rs` entry's visibility note: `open_and_wait` and `context()` are private;
   `open_with_data_folder` and `window_title` are `pub(crate)` for `range.rs`.

## Target

Owned: `src-tauri/AGENTS.md`. Read-only: everything else.

## Acceptance

- Each sentence checked against the code it names (file:line in `smoke_evidence`). No code change, so no mutation run.
