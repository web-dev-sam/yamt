# RangeReviewedDesign

Agent output (`agent://RangeReviewedDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedDesign.md), collected 2026-11-19T09:00:18.299Z.

{
  "options": [
    {
      "name": "A — new crate yamt-reviewed; marks keep object ids plus the right text",
      "summary": "Marks live in <data_dir>/yamt/reviewed/<repo key>/<FNV of review key>/: reviewed.json (format 1: path, both sides' {id, kind}, keptText) and texts/<blob id>. Review = side names (refs/... name, else the commit id) plus the dots, or project!iid from the new flag --review-of. State is set at open by the right side's id and kind. Each write locks, re-reads and applies one change. Four IPC commands; rangeReviewed.ts mirrors the marks in the window.",
      "visions": [
        2,
        3,
        4,
        5,
        1
      ],
      "cost": "4 build slices, about 2,900 lines [INFERENCE]. Adds one crate, 4 IPC commands, 1 CLI flag, plan rows #195/#196, risk RK79. Disk: one kept text per reviewed text file, at most 8 MiB each."
    },
    {
      "name": "B — marks inside yamt-review, blob ids only, git holds the old text",
      "summary": "A mark stores only path and {id, kind} for each side. The since-review view reads the reviewed blob back from git by its id. When git no longer has that blob, the view says so and offers Review from start.",
      "visions": [
        5
      ],
      "cost": "About 400 lines fewer than A. But it breaks the owner's own case: a merge request's commits are fetched without a ref, so git gc prunes them after 2 weeks (about 6 weeks for a rebase). yamt-review also takes on a second job."
    },
    {
      "name": "C — the window keeps marks in localStorage; Rust only names the review and diffs",
      "summary": "Marks go into localStorage under a review key that Rust sends. TS works out each file's state by hashing its right text. The since view comes from a diff command.",
      "visions": [],
      "cost": "List marks need every file's text loaded at open. localStorage size limits run into 8 MiB texts (the reason #117 rejected localStorage). Two windows race on one key. The window would own durable state."
    }
  ],
  "recommendation": "Option A. It is the only option where the since-review view still works after a push to a merge request or a rebase, whatever git gc prunes. Each fact has one owner: the store file, written by one crate and mirrored by one window module. Rule-4 refinement to confirm: both sides are recorded by git object id, but only the right side's text is copied, because no view shows the reviewed left side. Cost: one crate, 4 IPC commands, the --review-of flag, about 2,900 lines.",
  "design_doc": "docs/slices/briefs/range-reviewed-design.md",
  "briefs_written": [
    "docs/slices/briefs/range-reviewed-core.md",
    "docs/slices/briefs/range-reviewed-app.md",
    "docs/slices/briefs/range-reviewed-store.md",
    "docs/slices/briefs/range-reviewed-view.md",
    "docs/slices/briefs/range-reviewed-verify.md"
  ],
  "slice_graph": "Strictly sequential, no parallel builds: core (rust) → app (rust; runs just bindings, which the orchestrator regenerates and commits) → store (web) → view (web; WIRES THE WINDOW, smoke steps B–C follow it) → docs keeper → verify final (just check + A–D). Before core is built, the orchestrator adds root Cargo.toml member crates/reviewed and workspace dep yamt-reviewed. Proposed plan rows #195/#196 and risk RK79 are in design §3/§2 A.",
  "open_questions": [
    "A broken or newer-format marks file (for example after running a newer yamt, then an older one) stops the diff window from opening, with one line naming the file. That is what a broken comments file does today. Keep that, or open the window without marks and never write them?",
    "With two diff windows on the same review at once (one opened before a new commit on the branch, one after), both windows' clicks are saved. Each window's list shows only its own clicks until it is reopened. Is that acceptable?",
    "In a file shown 'since review', a window-wide search hit on the old (left) side cannot be shown, so yamt opens the file without jumping. Is that acceptable, or should those hits be left out of the results?"
  ]
}
