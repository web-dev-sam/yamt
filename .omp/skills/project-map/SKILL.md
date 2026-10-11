---
name: project-map
description: Where things live in yamt, which module may depend on which, who owns which state, and the five core visions every technical decision must cite. Read before touching any file.
---

# yamt — project map

Verified against commit: `dd9abc4` (v0 retro applied: desktop shell, take a side, choice panel, release). Full text: `docs/architecture.md`. Package names (`cargo -p`, `just`, arch-check) are in parentheses.

## Core visions (ranked; lower number wins a conflict)

1. **Readable by the product owner** — TS-proficient, Rust beginner. Clever is a defect.
2. **One source of truth per fact** — generated types, single state owner, one constant per tunable.
3. **Boundaries are enforced, not described** — every rule names its detector.
4. **Illegal states don't compile** — brands, constructive ranges, exhaustive matches, sum types.
5. **Small surface, boring design** — no abstraction without two users; no dependency the chosen stack covers.

## Tree

```
crates/merge-core   (yamt-merge-core) pure diff3 chunk model and per-side word changes: chunk, compute, apply, line (InlineRange/InlinePoint),
                    token (tokenizer), line_pairs (line pairing, Dice ≥ 50 %), word (`word_changes`). NO I/O, NO git, NO tauri, NO serde_json, NO tokio
crates/gitio        (yamt-gitio) git subprocess layer (ls-files -u/-s, cat-file --batch, update-index incl. --index-info/--force-remove, add, checkout -m, checkout-index: take, rollback). NO diff logic
crates/session      (yamt-session) MergeSession state machine; describe/take (`sides.rs`); finish/take all-or-nothing; the only crate that knows both of the above
crates/cli          (yamt-cli, bin yamt-cli) headless binary: classify / scan / golden / fixture
crates/conflict-repo (yamt-conflict-repo) dev-only: temp git repos whose merge stops with scripted conflicts (regular, symlink, gitlink); dev-dependency of gitio, session, cli
src-tauri           (yamt-app) lib.rs (`run`, `export_bindings`: one tauri-specta builder for both bins) + graphics (NVIDIA guard, the one `unsafe`, plan §2 #43),
                    args, outcome (start-up decision, exit status), window (close fallback when the page is gone), commands (IpcError), frontend_log,
                    appimage (a relative repo path is resolved against OWD only when the running binary lives under $APPDIR with APPIMAGE set; never chdir);
                    bins `yamt` and `export-bindings` (→ ipc/bindings.ts); tauri.conf.json (bundles: AppImage, deb, app, dmg); icons/icon.svg source (plan §2 #41)
release             README.md, LICENSE (MIT), CHANGELOG.md, THIRD_PARTY_NOTICES.md, THIRD_PARTY_LICENSES.txt (GENERATED, in every bundle), docs/screenshot.png, .github/workflows/release.yml (draft release on `v*`; plan §2 #38)
scripts/arch-check.sh    PM1: cargo tree edges, std::fs/process grep in merge-core, clippy threshold parity, `unsafe` only in src-tauri/src/graphics.rs
scripts/map-check.sh     PM6 (`just map-check`): every source file is named in this map
scripts/test-screen.sh   `place`: KWin rules put test windows on the Samsung screen when one is connected; `check` = `just test-window-check` (VF8, plan §2 #40)
scripts/conflict-repo.sh `<dir>`: smoke repository with 7 conflicts (3 goldens .ts/.vue/.tsx, CRLF, add/add, binary, deleted on one side), no user git config
scripts/git-sandbox.sh   sourced by conflict-repo.sh and golden-repo.sh: die, non-empty refusal, git ≥ 2.32 gate, user/system git config isolation (RK19), repo_git, golden_file_path
scripts/third-party-licenses.sh  `just third-party-licenses`: THIRD_PARTY_LICENSES.txt from `cargo metadata` + `pnpm licenses list --prod` + licence files on disk (jq);
                    `ubuntu-versions` appends the AppImage's library versions and the GNU GPL/LGPL texts (Linux job); both release jobs regenerate and `git diff --exit-code` it
root config         clippy.toml (too-many-lines 40, unwrap/expect/panic allowed in tests), crates/merge-core/clippy.toml
                    (disallowed_*; shadows root, keys duplicated), deny.toml, rust-toolchain.toml, Cargo.toml [workspace.lints], .cargo/mutants.toml
frontend/src/ipc    index.ts (public surface + the one app logger); domain.ts (brands by type guard, toDomain); ChunkSource.ts; fixture.ts (fixture mode (browser without the app): valibot over
                    fixtures/{golden,showcase}/*.json); bindings.ts (GENERATED); log.ts; tauri.ts (`createTauriSource` over `commands`); window.ts (close-request guard, the only `@tauri-apps/api/window` importer)
frontend/src/model  empty and unused (AGENTS.md only); reserved for pure TS shared by more than one module
frontend/src/editor CodeMirror 6 integration; public surface = MergeController(FileMergeData, hosts incl. two strip <svg>s, options? { readOnly }): undo, redo, resultText, summary, onSummaryChange,
                    applyAllNonConflicting, destroy; types `Side`, `MergeSummary`, `MergeOptions`. internal/: pane, chunkField, status, sideStatus, apply, decorations, words, language, indent, side,
                    tone, lineSpan, geometry, strips, drag (icon press/drag on the persistent strips, plan §2 #45), covered (drag highlight, no history), modClick (Ctrl/Cmd+click, #46),
                    find (find bar per pane on @codemirror/search, #44), scrollSync; theme.css; framework-free (all `*.test.ts` in `node`; `engine.browser.test.ts` is the WebKit probe)
frontend/src/icons.d.ts  types `~icons/*?raw` (string, editor/) and `~icons/*` (Vue component, ui/); plan §2 #34
frontend/src/connectors  index.ts: Span, Band, bandPath — pure band geometry → SVG path strings; no DOM
frontend/src/ui     Vue 3 chrome: App, FileList (emits select; vscode-icons via fileIcon.ts, plan §2 #39), MergeToolbar (emits applyLeft/applyRight/undo/redo/reset/finish), summaryLabel.ts, MergeView,
                    useMergeController (only ../editor importer), store.ts singleton; problem.ts (Problem types, attempt) + ProblemBar + problemText.ts (failures in words, 2.1);
                    QuestionDialog + question.ts (Mark resolved / quit confirmations: words and decisions, 2.K); one MergeView per opened file (inactive = `invisible`);
                    ChoiceView + choiceText.ts (two-button choice for files the editor cannot show: sentences, labels, resolved line, plan §2 #36);
                    sideHeaders.ts (the "Local (yours)" / "Remote (theirs)" column headers, read by MergeView and ChoiceView)
frontend/src/main.ts     picks the source by `VITE_CHUNK_SOURCE` (`"tauri"` in the app, fixtures otherwise; typed in src/env.d.ts), creates the store, loads the file list, mounts App
frontend/src/style.css   the one colour palette: Tailwind `@theme static` with stock colours reset (`--color-*: initial`), plan §2 row 24
frontend/scripts    check-sfc-order.ts (VU2); fences.ts (PM2/PM3/PM5, plus `~icons/*` without `?raw` in framework-free modules); palette.ts (VU17) — each with a .test.ts that reads src/ itself
frontend/fixtures   sample/{base,local,remote}.ts.txt (`just smoke-cli`); golden/<case>.json GENERATED by `just fixtures`, checked by `just fixtures-check`;
                    showcase/<case>.json GENERATED from `tests/showcase/<case>/` by `just fixtures` (demo cases, not goldens)
frontend/tsconfig   tsconfig.app.json: src/**, types [vite/client] (no Node globals in webview code); tsconfig.node.json: scripts/**, vite.config.ts, types [node]; typecheck = `vue-tsc -b`
frontend/vite.config.ts  Vitest projects: `node` (model, connectors, ipc, ui, editor `*.test.ts`, scripts) = `pnpm test`;
                    `browser` (`editor/**/*.browser.test.ts`, Playwright WebKit) = `pnpm test:browser`, not in `just check`
tests/golden/<case>      base.<ext> local.<ext> remote.<ext> README.md, expected.json (generated, `just golden-update`); scripts/golden-repo.sh rebuilds a case as a repo
tests/showcase/<case>    hand-written base/local/remote demo (`word-marks`), source of `fixtures/showcase`
docs/                    plan.md (decisions §2), architecture.md, ai-system.md, slices/SLICES.md, slices/briefs/, walkthroughs/
AGENTS.md                root, plus one per module: crates/*, src-tauri, frontend/src/*
```

## Dependency direction (detector in brackets)

```
merge-core ◄── session ◄── cli   (cli also uses merge-core directly)
gitio      ◄──┘        ◄── src-tauri ─generates─► ipc/bindings.ts
ipc ◄── editor ◄── ui ◄── main.ts      (ui reaches editor only through useMergeController; ui also imports ipc: types, logger, source)
connectors ◄── editor                 (model/ is empty and unused)
```

- [PM1] `gitio` never depends on `merge-core`; `merge-core` has no `std::process`/`std::fs`/`tauri`/`serde_json`/`tokio`; `src-tauri` (yamt-app) depends on `session` only, never directly on `gitio`/`merge-core`. Detector: `just arch-check` (`cargo tree --target all --all-features`; yamt-app's direct deps; std::fs/process grep), clippy `disallowed_*`.
- [PM2] `ui/**` never imports `@codemirror/*`, `@tauri-apps/*` (only `ipc/` talks to the app), `editor/internal/**`, `model/**` (at any depth). Detector: oxlint overrides (`/**` globs: oxlint 1.87 does not match nested specifiers with `/*`) + `frontend/scripts/fences.test.ts`.
- [PM3] `editor/**`, `model/**`, `connectors/**` never import `vue`, `vue/*`, `@vue/*`, `@vueuse/*`, `@tauri-apps/*`, or `~icons/*` without `?raw`. Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (`~icons/*`: `fences.test.ts` only).
- [PM4] `ipc/bindings.ts` is generated; never hand-edited. Detector: hook `generated.ts` + `hooks.test.ts`, oxlint/oxfmt `ignorePatterns`, `just bindings-check` (diffs a fresh export in `target/`).
- [PM5] No module imports a sibling's `internal/` (bare `**/internal` included); no import cycles. Detector: oxlint overrides + `frontend/scripts/fences.test.ts`; `import/no-cycle` everywhere.
- [PM6] Every non-test source file under `frontend/src/` (except `ipc/bindings.ts`), `frontend/scripts/`, `scripts/`, `crates/merge-core/src/` is named in this map, and every IPC command / ChunkSource method is named in architecture (and ipc-contract). Detector: `just map-check`.

## State ownership (vision 2)

| state                                                              | owner                                                                                                                                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| document text (all three panes)                                    | CodeMirror `EditorState`                                                                                                                                          |
| chunk current positions (center)                                   | `editor/chunkField` StateField, mapped per CM1 (applied span pushes later ones; `to` capped at the next `from`); restored on undo by an `invertedEffects` effect  |
| chunk apply status                                                 | same StateField: per-side status (`pending\|applied\|ignored`, plan §2 #33), changed only by a `StateEffect` registered with `invertedEffects` (undo restores it) |
| left/right decorations                                             | fixed side ranges + a read-only status mirror pushed by the controller (no history)                                                                               |
| drag over the icons (press, covered highlight)                     | press in `editor/internal/drag.ts`; highlight in a side-pane field (`covered.ts`) pushed by the controller (no history, plan §2 #45)                              |
| scroll positions                                                   | DOM, driven by `editor/scrollSync`                                                                                                                                |
| connector geometry                                                 | derived per frame, never stored                                                                                                                                   |
| file list, opened files, active file                               | `ui/store.ts` singleton via `useAppStore()`; each opened file's `MergeView` owns its controller and registers `{ unsaved, markSaved }` with `store.track`         |
| saved baseline per opened file                                     | non-reactive `let` in `useMergeController`: set when the controller is built, replaced by `markSaved` after a successful finish                                   |
| choice per file the editor cannot show (its sides, the side taken) | `choices` shallowRef in `ui/store.ts`: set by describe, `taken` set by `takeSide`, dropped and described again by reset; Rust's index is the truth for "resolved" |
| failure shown in the window                                        | `problem` shallowRef in `ui/store.ts`; cleared by the next success or `dismissProblem()`; words only in `ui/problemText.ts`                                       |
| question waiting for an answer                                     | `asking` shallowRef in `ui/store.ts`; words in `ui/question.ts`                                                                                                   |
| summary counts of the open file                                    | `shallowRef` in `useMergeController`, fed by `MergeController.onSummaryChange`                                                                                    |
| captured index stages (for reset)                                  | `session::FileState.stages`, captured at `open()`                                                                                                                 |

Vue state never holds an `EditorView`, a position, or document text.

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

`BaseLine`, `LocalLine`, `RemoteLine` are Rust newtypes and TS brands (created only in `ipc/domain.ts`); `DocPos` is a CM offset brand created only in `editor/`. `LineRange<L> = { start: L, len }`. Mixing any two is a type error by design.
