---
name: project-map
description: Where things live in yamt, which module may depend on which, who owns which state, and the five core visions every technical decision must cite. Read before touching any file.
---

# yamt — project map

Verified against commit: `109d0e4` (bootstrap; no code yet). Full text: `docs/architecture.md`.

## Core visions (ranked; lower number wins a conflict)

1. **Readable by the product owner** — TS-proficient, Rust beginner. Clever is a defect.
2. **One source of truth per fact** — generated types, single state owner, one constant per tunable.
3. **Boundaries are enforced, not described** — every rule names its detector.
4. **Illegal states don't compile** — brands, constructive ranges, exhaustive matches, sum types.
5. **Small surface, boring design** — no abstraction without two users; no dependency the chosen stack covers.

## Tree

```
crates/merge-core   pure diff3 chunk model. NO I/O, NO git, NO tauri, NO serde_json
crates/gitio        git subprocess layer (ls-files -u, cat-file --batch, update-index, add, checkout -m). NO diff logic
crates/session      MergeSession state machine; the only crate that knows both of the above
crates/cli          headless binary: classify / scan / golden / fixture
src-tauri           Tauri shell: thin commands, DTO export (tauri-specta), DMABUF guard, tracing sink
frontend/src/ipc    ChunkSource interface; bindings.ts (GENERATED); domain.ts (brands, toDomain); fixture.ts (valibot); log.ts
frontend/src/model  pure TS shared by editor/ and connectors/; exists only while both consume it
frontend/src/editor CodeMirror 6 integration; public surface = MergeController (index.ts); framework-free
frontend/src/connectors  pure band geometry → SVG path strings; no DOM
frontend/src/ui     Vue 3 chrome: App, Sidebar, Toolbar, MergeView, Banner; store.ts singleton
frontend/src/main.ts     picks ChunkSource, creates store, mounts App
tests/golden/<case>      base.txt local.txt remote.txt expected.json
docs/                    plan.md (decisions §2), architecture.md, ai-system.md, slices/SLICES.md, walkthroughs/
```

## Dependency direction (detector in brackets)

```
merge-core ◄── session ◄── cli
gitio      ◄──┘        ◄── src-tauri ─generates─► ipc/bindings.ts
ipc ◄── model ◄── editor ◄── ui ◄── main.ts
        model ◄── connectors ◄── ui
```

- [PM1] `gitio` never depends on `merge-core`; `merge-core` has no `std::process`/`std::fs`/`tauri`. Detector: `just arch-check`, clippy `disallowed_*`.
- [PM2] `ui/**` never imports `@codemirror/*`, `editor/internal/**`, `model/**`. Detector: oxlint `no-restricted-imports` overrides.
- [PM3] `editor/**`, `model/**`, `connectors/**` never import `vue`, `@vueuse/*`, `@tauri-apps/*`. Detector: oxlint overrides.
- [PM4] `ipc/bindings.ts` is generated; never hand-edited. Detector: hook `generated.ts` + `just bindings-check`.
- [PM5] No module imports a sibling's `internal/`. Detector: oxlint overrides; `import/no-cycle` everywhere.

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
