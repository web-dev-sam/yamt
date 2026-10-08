---
name: project-map
description: Where things live in yamt, which module may depend on which, who owns which state, and the five core visions every technical decision must cite. Read before touching any file.
---

# yamt — project map

Verified against commit: `588abc9` (slice 0.0: walking skeleton). Full text: `docs/architecture.md`.
Package names (`cargo -p`, `just`, arch-check) are in parentheses. "(planned)" = not in the tree yet.

## Core visions (ranked; lower number wins a conflict)

1. **Readable by the product owner** — TS-proficient, Rust beginner. Clever is a defect.
2. **One source of truth per fact** — generated types, single state owner, one constant per tunable.
3. **Boundaries are enforced, not described** — every rule names its detector.
4. **Illegal states don't compile** — brands, constructive ranges, exhaustive matches, sum types.
5. **Small surface, boring design** — no abstraction without two users; no dependency the chosen stack covers.

## Tree

```
crates/merge-core   (yamt-merge-core) pure diff3 chunk model. NO I/O, NO git, NO tauri, NO serde_json, NO tokio
crates/gitio        (yamt-gitio) git subprocess layer (ls-files -u, cat-file --batch, update-index, add, checkout -m). NO diff logic
crates/session      (yamt-session) MergeSession state machine; the only crate that knows both of the above
crates/cli          (yamt-cli, bin yamt-cli) headless binary: classify / scan / golden / fixture
src-tauri           (yamt-app) bins `yamt` (shell; thin commands, DMABUF guard, tracing sink) and `export-bindings`
                    (specta + specta-typescript + specta-serde → ipc/bindings.ts; only DTO today: `Ping`). No tauri dep yet
scripts/arch-check.sh    PM1: cargo tree edges, std::fs/process grep in merge-core, clippy threshold parity
root config         clippy.toml (too-many-lines 40, unwrap/expect/panic allowed in tests), crates/merge-core/clippy.toml
                    (disallowed_*; shadows root, keys duplicated), deny.toml, rust-toolchain.toml, Cargo.toml [workspace.lints]
frontend/src/ipc    public surface ipc/index.ts (planned); bindings.ts (GENERATED); log.ts (+ log.test.ts);
                    planned: ChunkSource, domain.ts (brands, toDomain), fixture.ts (valibot)
frontend/src/model  pure TS shared by editor/ and connectors/; exists only while both consume it (planned)
frontend/src/editor CodeMirror 6 integration; public surface = MergeController (index.ts); framework-free (planned; engine.test.ts WebKit probe)
frontend/src/connectors  pure band geometry → SVG path strings; no DOM (planned)
frontend/src/ui     Vue 3 chrome: App.vue; planned: Sidebar, Toolbar, MergeView, Banner, store.ts singleton
frontend/src/main.ts     picks ChunkSource, creates store, mounts App (today: mounts App)
frontend/scripts    check-sfc-order.ts + .test.ts (VU2); fences.test.ts (PM2/PM3/PM5, planned)
frontend/fixtures   fixture JSON for FixtureChunkSource (empty)
frontend/tsconfig   tsconfig.app.json: src/**, types [vite/client] — no Node globals in webview code;
                    tsconfig.node.json: scripts/**, vite.config.ts, types [node]. typecheck = `vue-tsc -b`
frontend/vite.config.ts  Vitest projects: `node` (model, connectors, ipc, scripts) = `pnpm test`;
                    `browser` (editor, Playwright WebKit) = `pnpm test:browser`, not in `just check`
tests/golden/<case>      base.txt local.txt remote.txt expected.json (planned)
docs/                    plan.md (decisions §2), architecture.md, ai-system.md, slices/SLICES.md, slices/briefs/, walkthroughs/
AGENTS.md                root, plus one per module: crates/*, src-tauri, frontend/src/*
```

## Dependency direction (detector in brackets)

```
merge-core ◄── session ◄── cli
gitio      ◄──┘        ◄── src-tauri ─generates─► ipc/bindings.ts
ipc ◄── model ◄── editor ◄── ui ◄── main.ts
        model ◄── connectors ◄── ui
```

- [PM1] `gitio` never depends on `merge-core`; `merge-core` has no `std::process`/`std::fs`/`tauri`/`serde_json`/`tokio`. Detector: `just arch-check` (`cargo tree --target all --all-features`; std::fs/process grep), clippy `disallowed_*`.
- [PM2] `ui/**` never imports `@codemirror/*`, `editor/internal/**`, `model/**` (at any depth). Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (planned).
- [PM3] `editor/**`, `model/**`, `connectors/**` never import `vue`, `vue/*`, `@vue/*`, `@vueuse/*`, `@tauri-apps/*`. Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (planned).
- [PM4] `ipc/bindings.ts` is generated; never hand-edited. Detector: hook `generated.ts` + `hooks.test.ts`, oxlint/oxfmt `ignorePatterns`, `just bindings-check` (diffs a fresh export in `target/`).
- [PM5] No module imports a sibling's `internal/` (bare `**/internal` included); no import cycles. Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (planned); `import/no-cycle` everywhere.

## State ownership (vision 2)

| state | owner |
|---|---|
| document text (all three panes) | CodeMirror `EditorState` |
| chunk current positions (center) | `editor/chunkField` StateField, remapped via `tr.changes.mapPos` |
| chunk apply status | same StateField, changed only by a `StateEffect` registered with `invertedEffects` (undo restores it) |
| left/right decorations | computed once per file; docs are immutable |
| scroll positions | DOM, driven by `editor/scrollSync` |
| connector geometry | derived per frame, never stored |
| file list, active file, summary counts, busy, error | `ui/store.ts` singleton via `useAppStore()` |
| captured index stages (for reset) | `session::FileState.stages`, captured at `open()` |

Vue state never holds an `EditorView`, a position, or document text.

## Where does X go?

| X | place |
|---|---|
| a new git operation | `gitio::Repo` method; bytes in/out; integration test with a real tempdir repo |
| a new chunk property | `merge_core::Chunk` → regenerate bindings → `ipc/domain.ts` |
| a new IPC command | `src-tauri/src/commands.rs` (≤ 15 lines, delegates to `session`) → `just bindings` |
| an editor behaviour (apply, undo, decorations, gutter) | `editor/internal/*`, exposed only through `MergeController` |
| a new chrome widget | `ui/<Name>.vue`, state in `store.ts`, actions in `store.ts` |
| a tunable number | one `const` next to its only user, or `merge_core::DEFAULT_GAP` |
| a cross-cutting decision | `docs/plan.md` §2 row citing a vision |

## Line spaces (vision 4)

`BaseLine`, `LocalLine`, `RemoteLine` are Rust newtypes and TS brands (created only in `ipc/domain.ts`); `DocPos` is a CM offset brand created only in `editor/`. `LineRange<L> = { start: L, len }`. Mixing any two is a type error by design.
