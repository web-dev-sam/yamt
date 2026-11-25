# MrHeadingDesign

Agent output (`agent://MrHeadingDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingDesign.md), collected 2026-11-25T08:34:59.723Z.

{
  "options": [
    {
      "name": "A. Names in the child's argv; Rust puts heading and totals into RangeStart",
      "summary": "The details query adds title, sourceBranch, the project ids and sourceProject.namespace.fullPath; a fork shows as ns:branch, as on GitLab. RangeToOpen.names is passed as --mr-title=/--mr-source=/--mr-target= (all or none, with --review-of). RangeStart gains heading (Typed|MergeRequest|UnnamedMergeRequest) and totals (Σ Counted, saturating u32). Title bar and line read the same RangeStart; labels untouched.",
      "visions": [
        2,
        4,
        1,
        3
      ],
      "cost": "Two builds (~31 and ~23 files), one verify. Renames MarksOf to RangeOf. open_with_data_folder's manage now returns the title. The web typecheck is red between the Rust commit and the web build."
    },
    {
      "name": "B. Names in argv; the page sums the totals and sets the title bar",
      "summary": "Same argv path and RangeHeading as A, but no Rust totals. The page sums RangeStart.files and builds the title text in TS. It sets the title through Tauri's window API after load; Rust opens the window with a placeholder title.",
      "visions": [
        2
      ],
      "cost": "Adds core:window:allow-set-title and a RangeSource method. The title bar changes after the page loads, and a failed page keeps the placeholder. Window titles would then be built in two places (Rust and TS)."
    },
    {
      "name": "C. Names handed over in a file beside the pair lock",
      "summary": "prepare_open writes heading.json in the pair folder before it spawns the child; manage_range_in reads it after taking the lock. Heading and totals work as in A, with no argv change.",
      "visions": [
        2
      ],
      "cost": "A new stored format with its refusals (RK49-style). A second writer in the pair folder. A stale file would name a later hand-typed window of the same pair, and the AI sweep walks pair folders."
    }
  ],
  "recommendation": "A. It is the path the request already sketches (--review-of beside the spec). Every name and number stays in Rust, where the title bar is built: one pure start(heading) over the immutable Range feeds both the title bar and the line, so they cannot differ. The posting check still finds the MR by commit because the labels don't change. On Linux/macOS each value reaches the child as one argv string, with no shell. On Windows, std's quoting is safe for programs that decode arguments the standard way, as yamt does. Titles are at most 255 characters and cannot hold NUL.",
  "design_doc": "docs/slices/briefs/mr-heading-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-heading-rust.md",
    "docs/slices/briefs/mr-heading-web.md",
    "docs/slices/briefs/mr-heading-verify.md"
  ],
  "slice_graph": "Strictly sequential, nothing in parallel. mr-heading-rust first (yamt-range, merge-requests + tests/glab answers, cli, src-tauri). Then the orchestrator runs `just bindings` and `just fixtures` and commits both; the web typecheck stays red until mr-heading-web lands. mr-heading-web next (ipc/, ui/, app-session flags). Then the docs keeper: tree.md, state.md, architecture §3, the ipc-contract open_range line, CHANGELOG, plan row #199, RK42/RK79 text. Then mr-heading-verify: smoke pass after web, final pass with `just check` after the docs.",
  "open_questions": [
    "The MR line is its own ~40 px row above the file views on every screen, including the MR page and settings. Keep it everywhere, or only while files are shown?",
    "A plain `yamt --diff=main...feature` window's left header changes from \"merge base of main and feature\" to \"main, where feature branched off\", the MR window's wording. Acceptable?",
    "An MR from a fork whose source project GitLab doesn't show you is named by its branch alone, so it looks like a branch of the target project. Acceptable, or mark it (e.g. \"(fork):branch\")?"
  ]
}
