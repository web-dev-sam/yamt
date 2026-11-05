# Slice table-alignment — a table column aligned in Markdown shows aligned in every GitLab rendering yamt draws

Request `docs/slices/request-table-alignment.md` (rules 1–2, acceptance, non-goals). Facts:
`.omp/run/notes/PlanTableAlignMeasure.md` (gitlab.com writes `align="left|center|right"` on each `th`/`td` in
`POST /markdown` and in `descriptionHtml`; no `style="text-align: …"` seen on gitlab.com). Reopens plan §2 #171's
"tables (alignment only from `text-align: left|center|right`)" and #188's "aligned table columns show left in a local
preview"; design `briefs/mr-fast-preview-design.md` §1.1 row "table alignment" and §4 item 1 (the docs keeper rewrites
them, not you).

One slice: the reducer (descriptions, comments, GitLab's preview) and the local preview read the same alignment, and
both are pinned by the one fixture both test against (`frontend/fixtures/markdown/gitlab-preview.json`), so they change
in one patch (request rule 2). No IPC type changes; `CellAlign` stays `start | center | end`.

## Target

**Owned:**

- `crates/merge-requests/src/description/element.rs` (`align`)
- `crates/merge-requests/src/description.rs` — the doc comment of `DescriptionCell` only
- `crates/merge-requests/src/description/tests.rs` — the alignment tests only
- `crates/merge-requests/src/description/tests/corpus.rs`
- `crates/merge-requests/AGENTS.md` — the sentence "the cell alignment (exactly `text-align: center`/`right`, else start)"
- `frontend/fixtures/markdown/gitlab-preview.json` — the `table_align` entry's `blocks` only
- `frontend/src/editor/internal/localPreview.ts`, `frontend/src/editor/internal/localPreview.test.ts`
- `frontend/src/editor/AGENTS.md` — the words "every table cell `start`" only
- `tests/glab/mr-description/graphql-description-52.json` — the table's cell attributes only
- `tests/glab/README.md` — the `mr-description/` sentence about the table only

**Read-only:** everything else. `frontend/src/editor/internal/markdownTable.ts` (`Align`, `Table.align`) is used as it
is. `frontend/src/ipc/bindings.ts` is generated: the orchestrator runs `just bindings` after your patch (the doc comment
changes it). `frontend/src/ui/**` already draws `CellAlign` (`MergeRequestDescriptionBlocks.vue` `ALIGN_CLASS`,
`editor/theme.css` `.markdown-align-*`); `frontend/src/ipc/fixtureMergeRequestDescriptions.ts` already has !640's
start/center/end table. `docs/**`: lines in `deviations_from_brief`.

**Non-goals** (request): any other table styling; tables in the AI chat (`markdownDom.ts` unchanged); any other verdict
of `localPreview`.

## Contract

Fixed; you may add, never change.

**Rust** `element.rs`:

```rust
/// A cell's alignment as GitLab writes it: `align="center"`/`"right"` (gitlab.com today), else the only style
/// GitLab's sanitizer keeps on a cell (`sanitization_filter.rb` `TABLE_ALIGNMENT_PATTERN`), else Start.
pub(super) fn align(cell: &NodeRef) -> CellAlign
```

- `align` attribute exactly `center` → `Center`, exactly `right` → `End`; any other `align` value (`left`, `justify`,
  empty) → read the style.
- `style` exactly `text-align: center` → `Center`, exactly `text-align: right` → `End` (unchanged); else `Start`.
- Exact strings, no case folding or trimming (GitLab writes them lower-case and bare; the existing test's
  `text-align:right; color: red` stays `Start`).

`DescriptionCell`'s doc comment names both forms in the same words.

**TypeScript** `localPreview.ts`: each cell's `align` is its column's `Table.align` entry: `"left"` and `"none"` →
`"start"`, `"center"` → `"center"`, `"right"` → `"end"`, through one exhaustive `Readonly<Record<Align, CellAlign>>`
(`CellAlign` from `../../ipc`, as the other `Description*` types). Head and body rows the same; a column with no entry
→ `"start"`. Every other verdict and block unchanged.

**Fixture** `gitlab-preview.json`: `table_align`'s `blocks` regenerated from the reducer (as the corpus brief did: run
`every_recorded_answer_reduces_to_its_blocks`, take the reduced value from the failure, paste); never hand-written. Its
`text`, `html` and `local: true` unchanged; every other entry byte-identical. `pnpm -C frontend fmt` afterwards.

**Fake glab** `graphql-description-52.json`: the table's cells in the measured form, `align="left"`, `align="center"`,
`align="right"` in place of each `style="text-align: …"` (as `PlanFastPreviewCorpus.json` `table_align` writes them).
The README's sentence says the cells carry `align=` as gitlab.com writes them (measured 2026-11-05, the note above),
replacing nothing else.

## Change

1. `align` and its doc; `DescriptionCell`'s doc; the crate guide's sentence.
2. Tests in `description/tests.rs`: `table_cells_keep_gitlabs_alignment_and_header` keeps its style cases; a new
   `table_cells_read_gitlabs_align_attribute`: `th`/`td` with `align="left"` → Start, `"center"` → Center, `"right"` →
   End, `"justify"` → Start, none → Start.
3. `corpus.rs`: `the_recorded_aligned_table_reads_start_center_end` — `described` on the `table_align` entry's `html`:
   the head row and the body row each read `[Start, Center, End]` (compare the `align` fields, typed, not JSON).
4. Regenerate `table_align`'s blocks (Contract).
5. `localPreview.ts` mapping; `localPreview.test.ts`: `a_table_reads_start_whatever_its_alignment` replaced by
   `a_table_keeps_each_columns_alignment`: `| l | c | r | n |\n| :- | :-: | -: | - |\n| 1 | 2 | 3 | 4 |` → head and
   body `start, center, end, start`, head `header: true`, body `false`. The editor guide's words.
6. The fake glab file and its README sentence.

## Acceptance

**Tests:** `cargo nextest run -p yamt-merge-requests` (hermetic prefix as `just test`) — the two new tests, every
corpus test and `tests/description.rs` green; `cargo nextest run -p yamt-app` green (it reads the same fake scenario);
`pnpm -C frontend test` — `every_local_entry_of_gitlabs_corpus_renders_to_its_blocks` (now with `table_align` at
center/end: request rule 2's detector) and `a_table_keeps_each_columns_alignment` green.

**Failing paths** (editor/ is not mutated; do each, see the named tests fail, undo, paste the failure line): map
`"center"` → `"start"` → `a_table_keeps…` and `every_local_entry…` (`table_align`) fail; map `"right"` → `"center"` →
both fail; give every cell the first column's alignment → both fail.

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `pnpm -C frontend
typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`; `just mutants HEAD` (Rust `element.rs`; editor/ is
excluded, the failing paths stand in); a test for every real survivor.

**Smoke:** paste the regenerated `table_align` blocks' six `align` values, and `localPreview` on the `table_align`
text giving the same six. The window check is the verifier's (`briefs/table-alignment-verify.md`).

## Skills

`skill://rust-conventions`, `skill://ts-conventions`, `skill://cm6-rules` (editor/), `skill://risk-register` (RK66,
RK74), `skill://verification`.
