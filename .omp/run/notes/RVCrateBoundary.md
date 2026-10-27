```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "RS6",
      "file": "crates/range/tests/range.rs",
      "line": 468,
      "problem": "The test file is 541 lines, which is over RS6's 400-line limit. It holds two jobs: what a range lists and loads, and the pair lock. Each new lock test that B or C adds (threads in the pair folder, the checkout) will land in a file that is already 35 % over the limit, as happened with cli/tests/commands.rs (#1468).",
      "fix": "Move `pair_folder`, `LOCK_FILE` and the three lock tests (`the_same_pair_twice_…`, `another_worktree_…`, `a_different_pair_…`) into `crates/range/tests/lock.rs`. It is inside the Owned glob `crates/range/**`, and the shared helpers (`repo_with`, `resolved`, `rev_parse`, `short_id`) are small enough to copy."
    },
    {
      "severity": "should",
      "rule_id": "RS8",
      "file": "crates/range/src/load.rs",
      "line": 63,
      "problem": "`u32::try_from(MAX_TEXT_BYTES).unwrap_or(u32::MAX)` is a fallback that can never run. Its mutant survives, which is the implementer's open risk. If `MAX_TEXT_BYTES` ever grew past `u32::MAX`, the window would silently be told a 4 GiB limit instead of failing to compile.",
      "fix": "Add `const TOO_LARGE_LIMIT: u32 = { assert!(MAX_TEXT_BYTES <= u32::MAX as usize); MAX_TEXT_BYTES as u32 };` next to `decide` and use it for `limit`. The proof then happens at compile time, and the fallback and its surviving mutant both go away."
    },
    {
      "severity": "should",
      "rule_id": "principles §2",
      "file": "crates/range/src/entries.rs",
      "line": 53,
      "problem": "The rule \"a gitlink side has no blob, so it gets no size\" is written twice: `blob_ids` skips `mode != GITLINK_MODE`, and `blob_at` (line 85) skips `mode == GITLINK_MODE`. The two must stay in lockstep, or every later file is handed another file's size. Only a unit test and a doc comment on `files_at` tie them together.",
      "fix": "Add one `fn has_blob(side: &TreeSide) -> bool { side.mode != GITLINK_MODE }` and call it from both `blob_ids` and `blob_at`, so the order rule depends on one predicate."
    },
    {
      "severity": "should",
      "rule_id": "DR5",
      "file": "docs/plan.md",
      "line": 139,
      "problem": "Row #107, and design §8, still say \"repo key = the work tree folder's name + FNV-1a 64 …\". The accepted deviation names the key after the common git dir's folder (its parent's when it is `.git`). Slices B and C read #107 to find the pair folder, so they would be reading a rule the code no longer follows.",
      "fix": "The orchestrator amends #107 to read \"repo key = the common git dir's folder name (its parent's for `.git`) + `-` + FNV-1a 64 of the absolute common git dir\" (agents never edit plan.md, DR5)."
    }
  ],
  "checked": [
    "Ownership: every touched file is inside Owned (`crates/range/**`, src-tauri/Cargo.toml one line, scripts/arch-check.sh, merge-core lib.rs constant only, session decode.rs, compare lib.rs pin test plus its stale doc line). Cargo.lock and the root Cargo.toml members/dependency lines are the orchestrator's, as the brief says.",
    "Dependencies (PM1): crates/range/Cargo.toml normal deps are yamt-gitio, yamt-merge-core, serde, specta, thiserror; dev deps are yamt-conflict-repo and tempfile. No tauri, no serde_json, no new external crate (DR3). The arch-check.sh range rule copies the yamt-compare rule's shape, and yamt-app's allowed list gains yamt-range.",
    "Contract: every type in lib.rs matches design §9 field for field, with serde `tag = \"kind\"` / `rename_all = \"camelCase\"` where §9 has them. RangeFileId also derives Deserialize. The messages for Error and SpecError match §9 and §1's table word for word (spec.rs `each_error_is_its_usage_line`, range.rs Display asserts).",
    "Public functions match the brief: RangeSpec::parse/text, Resolved::resolve/root/list(self), PairLock::take/folder, Range::start/load. Range is Send + Sync (range.rs `a_range_is_shared_between_threads`).",
    "spec.rs follows §1's reading rule: split at the first `..`, a following `.` means three dots, then refuse a leading `.` or any `..` in the right side, refuse a leading `-` on either side, and read an empty side as HEAD. All four valid examples are tested.",
    "open.rs order: discover → two commit_named → merge_base only for Three (NoMergeBase on None) → two commit_summary; the MergeBase label carries both sides with HEAD filled in. list: one changed_files, then sort, then one blob_sizes over blob_ids. Gitlinks are never sent to it, which agrees with gitio blob.rs:12's doc.",
    "load.rs decide follows #105's order: submodule → kind change (is_link differs) → mode only (same oid, kinds differ) → numstat Binary → size > MAX_TEXT_BYTES; only then one BlobReader reads at most two blobs. An added side reads as \"\", a deleted side as \"\", a rename puts the old blob left, and mode_change goes in the header. Tests delete loose objects to prove the listing answers without a read.",
    "lock.rs: the folder is `<range_dir>/<key>/<left oid>-<right oid>/lock`; File::try_lock with WouldBlock → Locked {root, both short ids}, other errors → LockFailed. FNV-1a is a named 8-line function with the vector \"a\" → af63dc4c8601ec8c pinned. The comment cites flock(2)/LockFileEx (CP1). The lock code is a copy of compare/files.rs take_lock, as the design asks; range may not depend on compare, so this is not a second home for a shared rule.",
    "Repo key bytes: `as_encoded_bytes` is stable here. On unix gitio's path_from_git builds the path from git's raw bytes, and on other systems from lossy UTF-8 (entry.rs:150-160), so the hash input is the same bytes across Rust releases.",
    "Accepted deviations noted, not findings: the repo key name comes from the common dir; FileAt keeps no path bytes; RangeSpec sides are String with HEAD; ModeOnly compares kinds (only File/Executable reach that check after the kind-change test); session/decode.rs uses `pub(crate) use yamt_merge_core::MAX_TEXT_BYTES` for merge_data.rs/sides.rs; compare's MAX_COLUMN_BYTES doc line was corrected.",
    "MAX_TEXT_BYTES: the one usize constant is in merge-core with a /// doc (missing_docs). session decode.rs uses it, and compare has the `the_column_limit_is_merge_core_s_text_limit` pin test (plan #104).",
    "Implementer's open risks accepted: arch-check has no failing-path test, like every existing per-crate rule; the criss-cross test relies on git's first merge base, the same rule gitio's merge_base doc states; every GitFailed from discover counts as not-a-repository, but discover runs only rev-parse --show-toplevel, so git's first stderr line is the true reason.",
    "Growth: each module has one job (spec parsing; resolve/list/Range; entries from the listing; the load decision; the pair lock). `Range` and `Resolved` are immutable after construction, so the shell needs no new Mutex (RS5). No new state rows are needed outside the crate. crates/range/AGENTS.md matches the code.",
    "Comments: /// one-liners on public items and the CP1 lock/FNV sources. No narrating comments, TODOs or section headers. Integration tests start with `#![cfg(test)]` like their sibling crates. Widening `as u64` in is_too_large follows the repo's existing practice (sides.rs:77).",
    "All 16 test names from design §10 are present in tests/range.rs, and the unit tests are in spec.rs, entries.rs and lock.rs.",
    "Docs outside Owned (project map tree/PM1/dependency diagram, architecture §7) were listed by the implementer for the docs step. PM6 map-check does not scan crates/range. No test or gate was run."
  ]
}
```