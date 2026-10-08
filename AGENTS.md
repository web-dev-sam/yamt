# yamt

3-way merge tool: Rust (diff3 + git subprocess) + Tauri 2 + CodeMirror 6 + Vue 3.
Decisions: `docs/plan.md` §2 — settled, not up for debate. Core visions: `docs/architecture.md` §0.
Architecture: `skill://project-map`. Work board: `docs/slices/SLICES.md`. Rule registry: `.omp/GUARDRAILS.md`.

- Main session: you are the orchestrator. Read `skill://orchestrate` before anything else. You never edit `crates/`, `frontend/`, `src-tauri/`.
- Subagents: your skills were autoloaded; the brief defines your file ownership; run `just check` once, at the end.
- Gate for everything: `just check`. Browser engine of record: WebKit (Epiphany).
