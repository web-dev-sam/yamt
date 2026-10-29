# Slice SearchRangeTextsR1 — fix round 1: the 4 MiB page boundary pinned; one copy of the test helpers and of the line-range conversion

Board "Search" row 4, fix round 1 (session 35). Round 1: `SearchRangeTexts`, commit `3570a76` (bindings `8626df4`),
brief `docs/slices/briefs/search-range-texts.md` (its Contract holds), notes `.omp/run/notes/SearchRangeTexts.md`.
Boundary passed with two promoted `should`s; correctness failed. Verbatim:

1. **#1710 (correctness, block)** `crates/range/tests/search.rs:117` — "`a_page_reads_at_least_one_file_and_ends_after_about_4_mib`
   is the only test for "stops after about 4 MiB", and it passes for any budget in (1 MiB, 5 MiB]. The surviving
   mutant `search.rs:9:36` (`4 * 1024 * 1024` → `4 + 1024 * 1024`, a budget of about 1 MiB) passes it … A `>=` → `>`
   slip at exactly 4 MiB would also pass." Fix: pin both sides of the boundary in the second page: after the 5 MiB
   file, sides summing to 4 MiB − 2 bytes (e.g. 2 MiB and 2 MiB − 2), then a 2-byte file, then one more file; assert
   the page holds the first three and `next` is the fourth's id.
2. **#1708 (boundary, should → promoted)** `crates/range/tests/search.rs:10` — "This new test file makes a third copy of
   `FIRST_COMMIT`, `LINK_MODE`, `changed`, `repo_with`, `commit` and `stage_link`. Copies already exist in
   `tests/listing_answers.rs:10-68` and `tests/range.rs:13-121`." Fix: move the tests into
   `crates/range/tests/listing_answers.rs` (reuse its helpers and its every-kind repository), delete
   `tests/search.rs`, update `crates/range/AGENTS.md`.
3. **#1709 (boundary, should → promoted)** `frontend/src/ipc/rangeDomain.ts:101` — "`toLineChange` repeats the two
   `toRange` calls in `toDifferences` (`compareDomain.ts:80-81`). The TS `LineChange` type also repeats the
   `left`/`right` fields of `Difference`." Fix: `LineChange` and `toLineChange` in `compareDomain.ts` next to
   `Difference`; `Difference` typed as `LineChange & { readonly words: … }`; `toDifferences` built on `toLineChange`;
   `rangeDomain.ts` imports both (exports from `ipc/index.ts` unchanged in name).

## Target

Owned: `crates/range/tests/*.rs`, `crates/range/AGENTS.md`, `frontend/src/ipc/compareDomain.ts`,
`compareDomain.test.ts`, `rangeDomain.ts`, `rangeDomain.test.ts`, `index.ts` (under `frontend/src/ipc/`). Read-only:
everything else (`crates/range/src/**` too: no product change is asked). Generated files are the orchestrator's.

## Acceptance

- Item 1: the new assertion fails with the budget mutated to `4 + 1024 * 1024` and with `>=` → `>` (paste both),
  passes as is. `cargo nextest run -p yamt-range`, clippy, fmt clean.
- Item 2: `tests/search.rs` gone; the three tests pass in `listing_answers.rs`; no helper defined twice across the
  range test files you touched (grep pasted).
- Item 3: grep shows one `toRange` pair for a change's two sides; `pnpm -C frontend typecheck`, `lint`, `test`,
  `fmt:check` pass; Stryker on `compareDomain.ts`/`rangeDomain.ts` keeps 100 %.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://ts-conventions` (plus your autoloaded ones).
