# MrStartsDocs

Agent output (`agent://MrStartsDocs`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsDocs.md), collected 2026-11-03T19:58:23.481Z.

{
  "summary": "The docs now cover the starts feature. `just map-check` passes. architecture: `--mr`/`StartScreen`, `YAMT_AI` read once in lib.rs, the WindowKind payloads, `data-open`, startScreen.ts and main.ts's `WindowStart`, the list's age, `timeTitle`, and §5.1's screen and `listedAt` rows. Map: tree rows (startScreen.ts, main.ts, app-session flags), state rows (one new start-options row), verified line at c57417bf. Also plan rows #167–#168, ui/AGENTS.md's start rule, ipc-contract's AI heading. rangeStore's internal function is not named.",
  "files_changed": [
    "docs/architecture.md",
    "docs/plan.md",
    ".omp/skills/project-map/SKILL.md",
    ".omp/skills/project-map/tree.md",
    ".omp/skills/project-map/state.md",
    ".omp/skills/ipc-contract/SKILL.md",
    "frontend/src/ui/AGENTS.md"
  ],
  "map_check": "map-check: ok",
  "left_stale": [
    ".omp/skills/verification/SKILL.md:96-97: app-session recipes lack `start-app … --mr` (the window opens on its merge-request page) and `start-fixture … --mr list --open-mr` (fixture `?open=mergeRequests`); add one line each."
  ]
}
