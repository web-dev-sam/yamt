# LineRangesDesign

Agent output (`agent://LineRangesDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesDesign.md), collected 2026-10-31T11:38:10.762Z.

{
  "options": [
    {
      "name": "A — one ThreadPlace with two ends; GitLab numbers from the file's differences at send",
      "summary": "ThreadPlace { start: DiffLine, end: ThreadLine } replaces ThreadLine everywhere. A one-line thread is a place whose start is its end's own line. threads.json moves to format 2: format 1 is read as one-line places and is written as 2 at the first change. GitLab's one-column order is one pure editor module (diffOrder.ts). Rust builds line_range from Range::load's differences, using GitLab's parser rule and a SHA-1 of the new path. Hover reaches the editor through its own hosts.",
      "visions": [
        4,
        2,
        1
      ],
      "cost": "About 3,000 changed lines (Rust ~900, web ~2,100, half of it mechanical line-to-place in tests), the new crate sha1 0.10, one file-format step, five builds."
    },
    {
      "name": "B — every end carries GitLab's two numbers",
      "summary": "Each end is stored as GitLab's (kind, old_pos, new_pos), plus a column for an unchanged end. Order can be checked in Rust (componentwise), and line codes need no diff at send. But a format-1 removed or added line has no partner number. Making one means diffing every file with threads when the store opens, or keeping two stored shapes.",
      "visions": [
        4
      ],
      "cost": "A's files plus the store's open path. Either a git diff at every start, or two code paths for one concept."
    },
    {
      "name": "C — an optional range start beside today's line",
      "summary": "Thread { line, from: Option<DiffLine> }, still format 2. The least churn: one-line code and tests keep line. But tint, folds, text, drafts and GitLab each branch on the Option, and Some(from) equal to the line is a second value for a one-line thread, so they all need a normalising step.",
      "visions": [
        5
      ],
      "cost": "About 30% fewer changed lines than A. Illegal state can be represented, and the normalising step is needed everywhere."
    }
  ],
  "recommendation": "A. One place shape keeps every consumer on one path and makes equal ranges equal values (vision 4). GitLab's numbering lives in one Rust function fed by differences the range already computes, and GitLab's order lives in one editor module (vision 2). Format 2 is the only safe way to add data, because an older yamt drops unknown fields when it rewrites the file. B needs git at store open or two shapes; C needs two shapes and normalising. Cost: ~3,000 lines, the sha1 crate (new plan row 147), five builds.",
  "design_doc": "docs/slices/briefs/line-ranges-design.md",
  "briefs_written": [
    "docs/slices/briefs/line-ranges-rust.md",
    "docs/slices/briefs/line-ranges-domain.md",
    "docs/slices/briefs/line-ranges-editor.md",
    "docs/slices/briefs/line-ranges-window.md",
    "docs/slices/briefs/line-ranges-verify.md"
  ],
  "slice_graph": "Before rust: orchestrator adds sha1 0.10 to root Cargo.toml workspace deps and records row 147. rust, then just bindings, then domain (ipc types and fixtures; split off because window+domain is 28 files), then editor and window in parallel. Each tolerates the other layer's type errors until both land. Smoke pass after both. Docs keeper adds tree.md rows for 3 new editor files and design section 6. Final verify: just check, then all steps.",
  "open_questions": [
    "A range starting on an unchanged line shows in GitLab as 'Comment on lines 201 to +204' (no sign, as GitLab's own form does; recommended) or '-197 to +204' (old number, the API docs' 'otherwise old'). Your '+a to +b' check holds only for ranges of added lines. Which should you see?",
    "After this version changes a pair's threads (any add, edit or send), an older yamt refuses that pair's threads by name until upgraded, even with no range threads. Acceptable, or should range-free files stay readable by older versions at the cost of a second file writer?"
  ]
}
