---
name: project-map
description: Where things live in yamt, which module may depend on which, who owns which state, and the five core visions every technical decision must cite. Read before touching any file.
---

# yamt — project map

Verified against commit: `abcb805` (the merge-request page in the compare and range windows, plan §2 #128–#137: a row opens its GitLab page; `map-check` ok). Full text: `docs/architecture.md`. Package names (`cargo -p`, `just`, arch-check) are in parentheses.

## Core visions (ranked; lower number wins a conflict)

1. **Readable by the product owner** — TS-proficient, Rust beginner. Clever is a defect.
2. **One source of truth per fact** — generated types, single state owner, one constant per tunable.
3. **Boundaries are enforced, not described** — every rule names its detector.
4. **Illegal states don't compile** — brands, constructive ranges, exhaustive matches, sum types.
5. **Small surface, boring design** — no abstraction without two users; no dependency the chosen stack covers.

## Finding a file or a state owner

Two sibling files hold the detail. They are not loaded with this skill; read them by section, never whole:

- `skill://project-map/tree.md` — every source file a reader must find, by module (PM6):
  `grep -n '<name>' .omp/skills/project-map/tree.md`, then `read` around the hit.
- `skill://project-map/state.md` — each piece of state, its one owner and only writer (vision 2):
  `grep -n '<state or file>' .omp/skills/project-map/state.md`.

Vue state never holds an `EditorView`, a position, or document text. A change that adds a file, a state or a writer
updates the matching row; the docs keeper does it once per feature (`skill://orchestrate` §6).

## Dependency direction (detector in brackets)

```
merge-core ◄── session ◄── cli   (cli also uses merge-core directly)
gitio      ◄──┘        ◄── src-tauri ─generates─► ipc/bindings.ts
merge-core ◄── compare ◄── src-tauri   (settings, lsp-host ◄── src-tauri too)
gitio, range ◄── merge-requests ◄── src-tauri   (range, review, agent ◄── src-tauri too; §2 of architecture)
ipc ◄── editor ◄── ui ◄── main.ts      (ui reaches editor only through useMergeController and, for the compare root, useCompareController; ui also imports ipc: types, logger, source)
ipc ◄── lsp ◄── editor, ui, main.ts   (lsp imports only ipc; editor and ui reach it only through lsp/index.ts)
connectors ◄── editor                 (model/ is empty and unused)
```

- [PM1] `gitio` never depends on `merge-core`; `merge-core` has no `std::process`/`std::fs`/`tauri`/`serde_json`/`tokio`; `src-tauri` (yamt-app) depends on `session`, `settings`, `lsp-host`, `compare`, `range`, `review`, `agent` and `merge-requests` only, never directly on `gitio`/`merge-core`; `compare` depends on `merge-core` only among `yamt-*`, never on tauri; `merge-requests` depends on `range`, `gitio` and `merge-core` only among `yamt-*`, never on tauri. Detector: `just arch-check` (`cargo tree --target all --all-features`; yamt-app's and each library crate's direct deps; std::fs/process grep), clippy `disallowed_*`.
- [PM2] `ui/**` never imports `@codemirror/*`, `@tauri-apps/*` (only `ipc/` talks to the app), `editor/internal/**`, `model/**` (at any depth); `lsp/**` never imports `editor/`, `ui/`, `model/`, `connectors/`. Detector: oxlint overrides (`/**` globs: oxlint 1.87 does not match nested specifiers with `/*`) + `frontend/scripts/fences.test.ts`.
- [PM3] `editor/**`, `model/**`, `connectors/**`, `lsp/**`, `jsonrpc/**`, `agent/**`, `search/**`, `mergeRequests/**` never import `vue`, `vue/*`, `@vue/*`, `@vueuse/*`, `@tauri-apps/*`, or `~icons/*` without `?raw`; `jsonrpc/`, `search/` and `mergeRequests/` import no other `src/` module. Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (`~icons/*` and the self-contained rule: `fences.ts` only).
- [PM4] `ipc/bindings.ts` is generated; never hand-edited. Detector: hook `generated.ts` + `hooks.test.ts`, oxlint/oxfmt `ignorePatterns`, `just bindings-check` (diffs a fresh export in `target/`).
- [PM5] No module imports a sibling's `internal/` (bare `**/internal` included); no import cycles. Detector: oxlint overrides + `frontend/scripts/fences.test.ts`; `import/no-cycle` everywhere.
- [PM6] Every non-test source file under `frontend/src/` (except `ipc/bindings.ts`), `frontend/scripts/`, `scripts/`, `crates/merge-core/src/` is named in this map (`tree.md`), and every IPC command / ChunkSource, CompareSource, RangeSource, ReviewSource and MergeRequestSource method is named in architecture (and ipc-contract). Detector: `just map-check`.
- [PM7] The compare window's root (`ui/Compare*.vue`, `ui/compare*.ts`, `ui/useCompare*.ts`: every compare-only file carries the prefix) never imports `ui/store.ts`, `ui/App.vue` or `lsp/` (plan §2 #94). Detector: `frontend/scripts/windowFence.ts` (called by `fences.ts`) + `fences.test.ts`.
- [PM8] Only `ui/linuxPaste.ts` reads the clipboard through WebKit: no other file reads a `clipboardData` or calls `navigator.clipboard.read`/`readText` (plan §2 #99: WebKitGTK 2.54 crashes reading an unreadable clipboard; writes stay free; its node test, which reads its fakes' data, is exempt too). Detector: `frontend/scripts/clipboardFence.ts` (called by `fences.ts`) + its failing-path test.
- [PM9] The range root (`ui/Range*.vue`, `ui/range*.ts`, `ui/useRange*.ts`) and the AI views never import the merge or compare roots or `lsp/`; the AI views are the range window's only (plan §2 #103, #108). Detector: `frontend/scripts/windowFence.ts` + `fences.test.ts`.
- [PM10] The merge-request page's shared files (`ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*`) never import a window root (`store.ts`, `App.vue`, `compareStore.ts`, `CompareApp.vue`, `rangeStore.ts`, `RangeApp.vue`) or `lsp/`; they reach their window's slice through `useMergeRequests()` (plan §2 #128). Detector: `frontend/scripts/windowFence.ts` + `fences.test.ts`.

## Where does X go?

| X                                                            | place                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| a new git operation                                          | `gitio::Repo` method; bytes in/out; integration test with a real tempdir repo      |
| a new chunk property                                         | `merge_core::Chunk` → regenerate bindings → `ipc/domain.ts`                        |
| a new IPC command                                            | `src-tauri/src/commands.rs` (≤ 15 lines, delegates to `session`) → `just bindings` |
| an editor behaviour (apply, undo, decorations, strip arrows) | `editor/internal/*`, exposed only through `MergeController`                        |
| a new chrome widget                                          | `ui/<Name>.vue`, state in `store.ts`, actions in `store.ts`                        |
| a tunable number                                             | one `const` next to its only user, or `merge_core::DEFAULT_GAP`                    |
| a cross-cutting decision                                     | `docs/plan.md` §2 row citing a vision                                              |

## Line spaces (vision 4)

`BaseLine`, `MiddleLine`, `LocalLine`, `RemoteLine` are Rust newtypes; the window brands `MiddleLine`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion` (created only in `ipc/domain.ts`; base lines do not reach the window, plan §2 #53); `DocPos` is a CM offset brand created only in `editor/`. `LineRange<L> = { start: L, len }`. Mixing any two is a type error by design.
