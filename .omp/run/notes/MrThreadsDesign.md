# MrThreadsDesign

Agent output (`agent://MrThreadsDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsDesign.md), collected 2026-11-04T11:46:55.046Z.

{
  "options": [
    {
      "name": "A: one discussions read for box, reload and thread; REST writes; core decides turns",
      "summary": "The discussions query gains id, bodyHtml, notes(first:200), edit fields and permissions (88/200 for 20 rows, measured). The same query for one iid gives the thread, picked by DiscussionId. Comments go through described_on and drafts come from REST draft_notes. Rust reads mentions from data-user links; the TS core works out the turn. Four REST writes and the Markdown preview go through gitio Glab::send.",
      "visions": [
        1,
        2,
        3,
        4,
        5
      ],
      "cost": "About 75 files in 10 slices; gitio gains serde_json; 5 commands; heavier discussion batches."
    },
    {
      "name": "B: Query.note thread read, GraphQL mutations, raw-text mentions",
      "summary": "The thread comes from the experimental Query.note. Replies use createNote and resolves use discussionToggleResolve; the core finds @username in the raw text.",
      "visions": [
        5
      ],
      "cost": "An experiment field; raw mentions count code spans; two answer formats. Costs visions 2 and 3."
    }
  ],
  "recommendation": "Option A: one read for the box, the reload and the thread; the TS core holds the one turn rule; four REST writes through one HTTP reader; GitLab renders comments and previews.",
  "design_doc": "docs/slices/briefs/mr-threads-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-threads-fixtures.md",
    "docs/slices/briefs/mr-threads-http.md",
    "docs/slices/briefs/mr-threads-images.md",
    "docs/slices/briefs/mr-threads-crate.md",
    "docs/slices/briefs/mr-threads-app.md",
    "docs/slices/briefs/mr-threads-state-ipc.md",
    "docs/slices/briefs/mr-threads-state-ui.md",
    "docs/slices/briefs/mr-threads-panel.md",
    "docs/slices/briefs/mr-threads-box.md",
    "docs/slices/briefs/mr-threads-verify.md"
  ],
  "slice_graph": "W1 fixtures in parallel with http (needs the serde_json edit first); W2 images; W3 crate; W4 app; then just bindings, committed with W5 state-ipc; W6 state-ui; W7 panel; W8 box (wires the window); W9 docs keeper and verify; W10 owner check.",
  "open_questions": []
}
