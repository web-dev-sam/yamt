# RawCompareTabsR2 (3.C-tabs rework 2, board Raw compare row 4)

Block #1500 is fixed: `TabStore::add_tab` now applies the same limit `problem()` checks when reading `tabs.json`. If the new tab would bring its id or its number to `u32::MAX`, the add is refused and nothing is written. The `src-tauri/AGENTS.md` ride-along is in too. fmt, clippy and the compare tests pass, and the hand mutation makes both new tests fail.

**summary**
- One shared check, `no_room_left(next_id, highest_number)` in `crates/compare/src/index.rs`, holds the `u32::MAX` rule. `Index::problem()` (on open) and `Index::add_tab` (on add) both call it.
- `Index::add_tab` now returns `Result<()>`. It works out the new id and number first (with `saturating_add`, so it never overflows) and returns `Error::Broken { path: <dir>/tabs.json, message }` before changing anything. `TabStore::add_tab` changes a copy and writes only on success, so a refused add leaves the file and memory as they were.
- Closing the last tab adds a fresh tab, so that path gets the same refusal now.
- `src-tauri/AGENTS.md`: `` `open_store` opens `TabStore` `` is replaced by `` `manage_store_in` opens `TabStore` and manages it as `CompareState` ``. A word-diff confirms only those words changed.

**files_changed**
- `crates/compare/src/index.rs`
- `crates/compare/src/store.rs`
- `crates/compare/tests/tabs.rs`
- `src-tauri/AGENTS.md`

**tests_added** (in `crates/compare/tests/tabs.rs`)
- `a_next_id_one_below_u32_max_opens_and_refuses_a_new_tab_writing_nothing`: a `tabs.json` with `nextId` 4294967294 opens. One `add_tab` is refused as `Broken`, with path `<dir>/tabs.json` and message "`nextId` 4294967295 leaves no id for a new tab". The file on disk is byte-identical afterwards and the store still lists 1 tab.
- `a_tab_number_one_below_u32_max_opens_and_refuses_a_new_tab_writing_nothing`: the same for a tab `number` of 4294967294, with message "the tab number 4294967295 leaves no number for a new tab".
- Both use one helper, `add_refused_after_opening`.

**smoke_evidence**
- `cargo fmt --check` → no output, exit 0.
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 31.90s`, with no warnings or errors.
- `cargo test -p yamt-compare` → `ok. 11 passed`, `ok. 18 passed`, `ok. 10 passed`, `ok. 19 passed`, `ok. 0 passed`; 0 failed.
- Hand mutation (the `if let Some(message) = no_room_left(...) { return Err(...) }` block cut from `Index::add_tab`), then `cargo test -p yamt-compare --test tabs`:
  - `a_next_id_one_below_u32_max_opens_and_refuses_a_new_tab_writing_nothing ... FAILED`
  - `a_tab_number_one_below_u32_max_opens_and_refuses_a_new_tab_writing_nothing ... FAILED`
  - `test result: FAILED. 17 passed; 2 failed`
- After reverting the mutation: `cargo fmt --check` was clean and `cargo test -p yamt-compare` was all `ok` again (11/18/10/19/0 passed).

**deviations_from_brief**
- Internal signatures changed, none of them public: `Index::first(path) -> Result<Index>`, `Index::add_tab(path) -> Result<()>`, `Index::close_tab(tab, path)`. `Index` doesn't know where `tabs.json` lives, so the store passes the path in to build the `Broken` error. The store gained one private helper, `index_path()`, which `commit` also uses now.
- `problem()` now checks the limit once, against the highest tab number, right after the "tabs is empty" check. Before, it checked each tab's number inside the loop. Since any number equals `u32::MAX` exactly when the highest one does, the same files are refused.
- The brief says "unit tests". I put them in `crates/compare/tests/tabs.rs` because they open a real store in a temp folder, and the Rust conventions (RS11) put real-file tests there.

**open_risks**
- `crates/compare/AGENTS.md` lists the reasons `tabs.json` is refused as `Broken` and doesn't name the `u32::MAX` rule (this was already missing before this change). That file is outside Owned, so I didn't touch it.
- `crates/compare/src/index.rs:73-77`: closing the last tab is now refused when the replacement tab would hit the limit. This follows from the shared rule but has no test of its own, since the brief only asked for add tests.