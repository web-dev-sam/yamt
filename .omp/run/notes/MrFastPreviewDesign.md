# MrFastPreviewDesign

Agent output (`agent://MrFastPreviewDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewDesign.md), collected 2026-11-04T21:31:25.325Z.

{
  "options": [
    {
      "name": "A: the window decides and draws, over yamt's own Markdown subset",
      "summary": "A new `localPreview(text): Description | null` in editor/ is the only place that decides local vs GitLab, with every trigger rule. It builds the blocks from yamt's parser in a new CommonMark flanking mode; the AI chat keeps its current mode. The panel calls it before GitLab and keeps one Preview state. GitLab's recorded answers, run through the one Rust reducer, are the fixture that both the Rust and TS tests check. Part B: GitLabRepository remembers the project.",
      "visions": [
        1,
        3,
        4,
        5
      ],
      "cost": "About 1,300 lines over 4 slices, no new dependency. A second builder of Description blocks, bounded by the corpus tests. After a logout, a public project's pages still load anonymously (open question 1)."
    },
    {
      "name": "B: Rust decides and draws with comrak through the one reducer",
      "summary": "`preview_markdown` checks the triggers in Rust. A safe text is rendered to HTML by comrak and then reduced by `described`, so there is one reducer; the window is unchanged.",
      "visions": [
        2,
        3
      ],
      "cost": "Adds a dependency (needs a plan row and licence review). The window still waits on IPC, so 'Loading…' flashes unless a timer hides it. Fixture mode can't run Rust: either a second trigger owner in TS or the WebKit acceptance fails."
    },
    {
      "name": "C: the window decides, Rust draws",
      "summary": "The trigger check is in TS; safe texts go to a new `render_markdown` command (comrak plus `described`).",
      "visions": [
        2
      ],
      "cost": "One decision split across two languages, plus B's dependency, an IPC hop, and a stand-in renderer in the fixture, so WebKit never shows the real path."
    }
  ],
  "recommendation": "Option A. `localPreview` beside yamt's parser decides and draws; the panel asks it first and calls GitLab only on null. 44 of the 62 recorded texts render locally; 25 more get recorded by the corpus slice, and 2 of their verdicts depend on what GitLab answers. Part B: GitLabRepository holds the project in a lock-guarded memory only project.rs writes. A 401, a '404 Project Not Found', a missing project, or the new `ask_gitlab_again` (Refresh) clears it. After that one `glab auth status` gives today's 'not logged in' words; the failed call is never repeated.",
  "design_doc": "docs/slices/briefs/mr-fast-preview-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-fast-preview-corpus.md",
    "docs/slices/briefs/mr-fast-preview-remembered.md",
    "docs/slices/briefs/mr-fast-preview-local.md",
    "docs/slices/briefs/mr-fast-preview-panel.md",
    "docs/slices/briefs/mr-fast-preview-verify.md"
  ],
  "slice_graph": "Round 1: corpus (rust-impl) and remembered (rust-impl) in parallel. Round 2: local (web-impl) starts once corpus is committed, beside remembered. The orchestrator runs `just bindings` after remembered (new askGitlabAgain). Round 3: panel (web-impl) after local, remembered and bindings; it wires the window, so it starts the smoke pass. Then the docs keeper runs beside the verify smoke pass; verify's final pass follows the docs keeper; the owner check is last. Never more than two implementers.",
  "open_questions": [
    "If you log glab out in a terminal while yamt runs, a public project's merge-request page keeps loading what anyone may see until you press Refresh. Posting, threads and private projects still say 'not logged in'. Accept, or re-check the login before every read again (about 0.6 s slower each)?",
    "Columns aligned with :---: show left-aligned in yamt's previews, and probably in posted comments and descriptions, because yamt ignores the way GitLab now marks alignment. Fix that as its own small change, or leave it?"
  ]
}
