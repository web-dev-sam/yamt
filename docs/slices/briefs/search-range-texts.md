# Slice SearchRangeTexts — the range window's searched texts: one paged command, line changes without word diffs

Board "Search" row 4 (session 35). Request `docs/slices/request-search.md` (rules 6 and 12 for the range window);
decision `docs/plan.md` §2 **#127**. Design: `.omp/run/notes/SearchDesign.md` option A §3.2 (IPC), §3.6 "Rust tests
(B1)" (given facts; re-check only `[INFERENCE]`). You build the designer's "B1". Read `skill://ipc-contract` (the
contract-change workflow) and `skill://rust-conventions`.

## Target

Owned: `crates/merge-core/src/compare.rs`, `crates/merge-core/src/lib.rs`, `crates/range/src/lib.rs`,
`crates/range/src/load.rs`, `crates/range/src/open.rs`, `crates/range/src/search.rs` (new), `crates/range/tests/*.rs`
(add a `search.rs` or extend `range.rs`), `src-tauri/src/range.rs`, `src-tauri/src/commands.rs`,
`frontend/src/ipc/rangeDomain.ts`, `rangeDomain.test.ts`, `RangeSource.ts`, `tauriRange.ts`, `tauriRange.test.ts`,
`fixtureRange.ts`, `fixtureRange.test.ts`, `index.ts` (all under `frontend/src/ipc/`), `crates/range/AGENTS.md`.

Generated: `frontend/src/ipc/bindings.ts` — run `just bindings` in your copy so the TypeScript side typechecks; the
orchestrator regenerates it on the main checkout (patches never carry it). Read-only: everything else. Docs
(`docs/architecture.md` §3.8/§4, the ipc-contract skill, the project map) are the orchestrator's: list the names they
need in `deviations_from_brief`.

Non-goals: any search logic (matching, places) — the window does it; the merge window (no Rust change there); caching
texts in Rust.

## Contract (fixed; you may add, never change)

```rust
// crates/merge-core/src/compare.rs — compare() builds on line_changes: one chunk→range rule
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct LineChange { pub left: LineRange<LeftLine>, pub right: LineRange<RightLine> }
#[must_use] pub fn line_changes(left: &str, right: &str) -> Vec<LineChange>; // no word diffs

// crates/range/src/lib.rs
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SearchText { pub file: RangeFileId, pub left: String, pub right: String, pub changes: Vec<LineChange> }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SearchTexts { pub files: Vec<SearchText>, pub next: Option<RangeFileId> }
// impl Range { pub fn search_texts(&self, from: RangeFileId) -> Result<SearchTexts> } — crates/range/src/search.rs
// const SEARCH_PAGE_BYTES: usize = 4 * 1024 * 1024; a page reads at least one file

// src-tauri/src/range.rs, registered in commands.rs beside load_range_file
#[tauri::command] #[specta::specta]
pub(crate) async fn search_range_texts<R: Runtime>(window: WebviewWindow<R>, from: RangeFileId) -> Result<SearchTexts, IpcError>;
// blocking_reply on a worker, as load_range_file; errors: the existing UnknownRangeFile { file } and Git { message }
```

```ts
// frontend/src/ipc/rangeDomain.ts
export type LineChange = { readonly left: LineRange<LeftLine>; readonly right: LineRange<RightLine> };
export type SearchText = { readonly file: RangeFileId; readonly left: string; readonly right: string; readonly changes: readonly LineChange[] };
export type SearchTexts = { readonly files: readonly SearchText[]; readonly next: RangeFileId | null };
export function toSearchTexts(raw: Generated.SearchTexts): SearchTexts;
// frontend/src/ipc/RangeSource.ts
searchTexts(from: RangeFileId): Promise<SourceResult<SearchTexts>>;
// tauriRange.ts maps the command through `converted`; fixtureRange.ts answers one page from its cases' texts
// (changes = each difference's { left, right }, next: null); index.ts exports the new types
```

## Change

Design §3.2 "Page rules": files from `from` on, one `BlobReader` per page; every file whose `load` would not answer
`Texts` left out (submodule, kind change, mode only, binary, too large, not UTF-8) by splitting `load.rs` so `decide`
and the read-and-UTF-8 step are shared by `load_file` and `search_texts` (one rule); `next = None` after the last
file; `from` past the end → `Error::UnknownFile`.

## Acceptance

- Rust tests (design §3.6 "Rust tests (B1)"): `line_changes` equals `compare`'s ranges and is empty for equal texts;
  `search_texts` skips binary, too large, submodule, mode-only, kind-change and not-UTF-8 files; a page reads at least
  one file and stops after about 4 MiB; `next` is `None` at the end; `from` past the end → `UnknownFile`; texts equal
  what `load` gives. `cargo nextest run -p yamt-merge-core -p yamt-range -p yamt-app` (or the crates' test recipes),
  `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check`.
- TS: `rangeDomain.test.ts`/`tauriRange.test.ts`/`fixtureRange.test.ts` cover the conversion (brands made by the
  domain guard, never `as`), the command mapping and the fixture page; `pnpm -C frontend typecheck`, `lint`, `test`,
  `fmt:check` pass with your locally generated bindings. `just bindings-check` passes in your copy.
- Real app (`scripts/range-repo.sh` repository, `just app-session start-app --range main...feature --repo …`): call
  the command from the page (`__TAURI__` invoke or a probe through the source) for `from: 0` → the text files with
  their changes, `next` null for this small range; paste the reply's file ids and change counts.

## Skills

`skill://ipc-contract`, `skill://rust-conventions` (plus your autoloaded ones).
