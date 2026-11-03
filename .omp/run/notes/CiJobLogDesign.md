# CiJobLogDesign

Agent output (`agent://CiJobLogDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogDesign.md), collected 2026-11-03T10:06:42.309Z.

{
  "options": [
    {
      "name": "A: raw tail over IPC, TS core parses, static lines + CSS highlights",
      "summary": "Rust reads an offered job's /trace, cuts it like GitLab's Stream#limit (last 500 KiB from a line start, flagged) and sends the raw text. A framework-free mergeRequests/ core parses it with the job page's Ansi2json rules into styled runs. The page renders the lines once and paints matches with two CSS Custom Highlight API highlights. A Shift tap is read from keyHold.ts's one listener set. The search text is a storedRecord keyed by job name.",
      "visions": [
        1,
        2,
        3,
        5
      ],
      "cost": "Five implementer runs in three waves plus the verifier. No new dependency, CSP change or gitio change. Risk: WebKit must ship Highlight (the page slice checks this first)."
    },
    {
      "name": "B: as A, but matches as <mark> segments re-rendered per query",
      "summary": "Same Rust, core and state as A. The core splits runs at the hits, and each line re-renders with v-memo on its hit list. There is no Highlight API.",
      "visions": [
        1
      ],
      "cost": "A broad query rebuilds tens of thousands of elements on every keystroke, and re-rendering drops any text selection. This is the fallback only if WebKit lacks Highlight."
    },
    {
      "name": "C: Rust parses the log, IPC carries styled lines",
      "summary": "Rust strips timestamps and sections and parses SGR into typed runs (specta enums), so the window only renders.",
      "visions": [
        4
      ],
      "cost": "The owner reads TypeScript, not Rust (vision 1). The fixture would test a different parser than the app (vision 2). The IPC payload would be several times larger than the raw text."
    }
  ],
  "recommendation": "Option A. Rust stays a thin, offered-only reader with GitLab's 500 KiB cut, and keeps fetched logs per run. The parsing rules live in tested TypeScript that the owner reads, and the fixture runs the same parser. Static lines plus CSS highlights keep typing cheap. 256 colours map to the nearest of 16 per-theme tokens, held at ≥ 4.5:1 contrast by a themes.ts rule. Cost: rust, core, palette, state and page slices plus the verifier. Proposed plan rows #158–#161 and risks RK57–RK59. If WebKit lacks Highlight, the page slice stops and B applies.",
  "design_doc": "docs/slices/briefs/ci-job-log-design.md",
  "briefs_written": [
    "docs/slices/briefs/ci-job-log-rust.md",
    "docs/slices/briefs/ci-job-log-core.md",
    "docs/slices/briefs/ci-job-log-palette.md",
    "docs/slices/briefs/ci-job-log-state.md",
    "docs/slices/briefs/ci-job-log-page.md",
    "docs/slices/briefs/ci-job-log-verify.md"
  ],
  "slice_graph": "Wave 1: rust ∥ core (palette may join if 3 implementers fit). Then `just bindings`. Wave 2: state (needs rust + bindings + core) ∥ palette (needs nothing). Wave 3: page (needs state + palette; wires the window; its step 0 checks WebKit Highlight). Verify: a smoke pass after page commits, and a final pass with `just check` after the docs keeper (plan rows, architecture, project-map, RK57–59, CHANGELOG). Owned globs are pairwise disjoint; bindings.ts and docs/** are owned by no slice.",
  "open_questions": [
    "While the cursor is in the log's search field, Shift types capitals and never switches logs. To switch jobs with the pointer, the owner clicks into the log text (or presses Escape) before pressing Shift over the next job. Keyboard users press Escape, move to the job, and press Shift.",
    "A 256-colour code shows as the nearest of the theme's 16 terminal colours (e.g. an orange shows as the theme's yellow), so every colour stays readable in light themes; GitLab's dark job page shows the exact shade."
  ]
}
