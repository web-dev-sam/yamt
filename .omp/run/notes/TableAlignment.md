# TableAlignment

Agent output (`agent://TableAlignment`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-01-09-442Z_01a1aab9-db42-7214-86d7-c22d4308e026/TableAlignment.md), collected 2026-11-05T08:20:02.510Z.

{
  "summary": "The Rust reducer `element.rs` `align` now reads GitLab's `align=\"center\"`/`\"right\"` attribute first. If the attribute is missing or holds another value, it reads the exact `text-align: center|right` style, and anything else gives Start. `localPreview` now gives each table cell its column's alignment through an exhaustive `CELL_ALIGN` record. Both are pinned by `table_align` in `gitlab-preview.json`, whose blocks came from the reducer and now read start/center/end. Fake glab !52 cells use `align=`; doc comment and both crate guides updated.",
  "files_changed": [
    "crates/merge-requests/src/description/element.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/src/description/tests/corpus.rs",
    "crates/merge-requests/AGENTS.md",
    "frontend/fixtures/markdown/gitlab-preview.json",
    "frontend/src/editor/internal/localPreview.ts",
    "frontend/src/editor/internal/localPreview.test.ts",
    "frontend/src/editor/AGENTS.md",
    "tests/glab/mr-description/graphql-description-52.json",
    "tests/glab/README.md"
  ],
  "tests_added": [
    {
      "name": "description::tests::table_cells_read_gitlabs_align_attribute",
      "proves": "th/td align left→Start, center→Center, right→End, justify→Start, none→Start; align=\"left\" with style text-align: right→End (another align value falls back to the style)"
    },
    {
      "name": "description::tests::corpus::the_recorded_aligned_table_reads_start_center_end",
      "proves": "described() on the recorded table_align html: head and body rows each read typed [Start, Center, End]"
    },
    {
      "name": "localPreview.test.ts a_table_keeps_each_columns_alignment (replaces a_table_reads_start_whatever_its_alignment)",
      "proves": "| :- | :-: | -: | - | → head and body start, center, end, start; head header:true, body header:false"
    }
  ],
  "smoke_evidence": [
    {
      "command": "jq -c '.entries[]|select(.name==\"table_align\")|[.blocks[0].head[0].cells[].align,.blocks[0].body[0].cells[].align]' frontend/fixtures/markdown/gitlab-preview.json",
      "observed": "[\"start\",\"center\",\"end\",\"start\",\"center\",\"end\"]"
    },
    {
      "command": "node + vite ssrLoadModule('/src/editor/internal/localPreview.ts'): localPreview(table_align text), the six cells' align",
      "observed": "[\"start\",\"center\",\"end\",\"start\",\"center\",\"end\"]"
    },
    {
      "command": "hermetic cargo nextest run -p yamt-merge-requests -p yamt-app --no-fail-fast",
      "observed": "PASS table_cells_read_gitlabs_align_attribute, the_recorded_aligned_table_reads_start_center_end, table_cells_keep_gitlabs_alignment_and_header, every_recorded_answer_reduces_to_its_blocks, all tests/description.rs; Summary 558 tests run: 558 passed, 46 skipped"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 302 passed (302); Tests 4515 passed (4515) — incl. every_local_entry_of_gitlabs_corpus_renders_to_its_blocks and a_table_keeps_each_columns_alignment"
    },
    {
      "command": "failing path: CELL_ALIGN center→\"start\"",
      "observed": "× every_local_entry_of_gitlabs_corpus_renders_to_its_blocks → table_align: expected { blocks: [...] } to deeply equal ...; × a_table_keeps_each_columns_alignment; Tests 2 failed | 4 passed (undone)"
    },
    {
      "command": "failing path: CELL_ALIGN right→\"center\"",
      "observed": "× every_local_entry… → table_align: expected … to deeply equal …; × a_table_keeps_each_columns_alignment; Tests 2 failed | 4 passed (undone)"
    },
    {
      "command": "failing path: align[column]→align[0] (every cell takes column 0's alignment), run on the final code shape",
      "observed": "× every_local_entry… → table_align: …; × a_table_keeps_each_columns_alignment; Tests 2 failed | 4 passed (undone)"
    },
    {
      "command": "cargo fmt --all --check; cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "fmt: no output (FMT_OK); clippy: Finished `dev` profile, no warnings"
    },
    {
      "command": "pnpm -C frontend typecheck / lint / fmt:check",
      "observed": "TYPECHECK_OK; LINT_OK (after the restructure below fixed max-lines); 'All matched files use the correct format.'"
    },
    {
      "command": "before regenerating the fixture: cargo nextest run -p yamt-merge-requests",
      "observed": "FAIL every_recorded_answer_reduces_to_its_blocks: left has align center/end, right has start everywhere. Only table_align's 4 align lines were then edited to match (git diff: gitlab-preview.json 4 lines changed)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 3 mutants to test; 3 mutants tested in 32s: 2 caught, 1 unviable; mutants: no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`CellAlign` is not exported from `../../ipc` (`descriptionDomain.ts` keeps it as a local type), and `ipc/` is read-only. `CELL_ALIGN` is typed `Readonly<Record<Align, DescriptionCell[\"align\"]>>` instead, derived per TS6. Exporting `CellAlign` from `ipc/index.ts` would let the record name it directly.",
    "`localPreview.ts` would have gone over the 300-line `max-lines` cap (308) with a three-parameter `describedRow`. It is now a nested function in `describedTable` that reads the destructured `align` and walks `[...cells.entries()]`; `allOrNull` is unchanged; the file is 299 lines. Splitting the table code out would need a new file outside Owned.",
    "The fixture's blocks were regenerated by editing only the four `align` values to match the reducer's failure output, not by pasting the whole value. The JSON is equal, the formatting is kept, and `every_recorded_answer_reduces_to_its_blocks` passes.",
    "`table_cells_read_gitlabs_align_attribute` has one case beyond the brief's list: `align=\"left\"` with `style=\"text-align: right\"` gives End. It pins the contract rule that any other align value falls back to the style.",
    "README: replacing the sentence pushed the next lines past the wrap width, so the following link/image sentence was re-wrapped with no words changed.",
    "Docs the docs keeper must rewrite (outside Owned): docs/architecture.md:1087; docs/plan.md §2 #171 (line 203) and #188 (line 220); briefs mr-description-design.md:39,332, mr-description-rust.md:82, mr-fast-preview-design.md:291 and §1.1/§4.1.",
    "The orchestrator must run `just bindings`, because the `DescriptionCell` doc comment changed."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/description/element.rs:74-85",
      "risk": "If a cell has align=\"center\"/\"right\" and also a different text-align style, align wins. GitLab is not known to write both, so this case is unmeasured."
    },
    {
      "location": "tests/glab/mr-description/graphql-description-52.json",
      "risk": "The `align=` attribute was put where `style=` was, before `data-sourcepos`. gitlab.com writes it after `data-sourcepos`. The order does not change the parse."
    }
  ]
}
