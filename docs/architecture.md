# 3-way merge tool — technical architecture

Companion to `docs/plan.md` (decisions, milestones, risks). That file is the
_what and why_; this one is the _how_: repository shape, module boundaries, contracts,
algorithms, toolchain, gates. Written so that every boundary here can be turned into a
lint, a test, a hook, or a skill — see `docs/ai-system.md`.

Decisions resolved since the plan: **frontend chrome = Vue 3**; **all AI tooling lives in
the repo under `.omp/`**; **one model tier (Opus) for every role**.

Name: `yamt`. Repository: `~/Projects/yamt`.

## 0. Core visions — every technical decision is derived from one of these

1. **Readable by the product owner.** TS-proficient, Rust beginner. Clever is a defect;
   a construct needs a reason a beginner can follow. Names and structure replace comments.
2. **One source of truth per fact.** Types generated, not mirrored; state owned by exactly
   one layer (§5.1); palette, gap constant, decisions — each lives in one place.
3. **Boundaries are enforced, not described.** Every rule in this document names its
   detector (lint, test, hook); a rule without one is temporary.
4. **Illegal states don't compile.** Branded line spaces, constructive ranges, exhaustive
   matches, sum types over flag bags — on both sides of the IPC.
5. **Small surface, boring design.** No abstraction without two concrete users; no
   dependency the stdlib or an already-chosen library covers; v0 scope stays v0.

When two visions conflict, the lower number wins. The orchestrator cites the vision when it
records a technical decision; a decision that cites none is a question for the human.

---

## 1. Repository layout

```
yamt/
├─ Cargo.toml                 workspace: members = crates/*, src-tauri
├─ justfile                   the ONLY task runner; CI runs `just check`
├─ rust-toolchain.toml        pinned stable
├─ deny.toml                  cargo-deny (licenses, bans, advisories)
├─ AGENTS.md                  ≤ 25 lines, points at skills (see ai-system doc)
├─ .omp/                      agents, skills, hooks, config.yml, GUARDRAILS.md
├─ docs/
│  ├─ plan.md                 moved from Desktop; decision record lives here
│  ├─ architecture.md         this file
│  └─ slices/SLICES.md        orchestrator's durable work board
├─ crates/
│  ├─ merge-core/             pure diff3 chunk model and the 2-way compare (plan §2 #95). NO I/O, NO git, NO tauri
│  ├─ gitio/                  git subprocess layer. NO merge logic
│  ├─ session/                MergeSession state machine; depends on merge-core + gitio
│  ├─ cli/                    headless binary (M0): classify / scan / golden / fixture / compare tooling
│  ├─ conflict-repo/          test-only: scripted conflict repos for gitio + session tests (dev-dependency)
│  ├─ settings/               the per-user settings file (theme — ten names, plan §2 #102 —, changed keys, its location). NO tauri, NO git
│  ├─ lsp-host/               starts language servers and frames their messages (plan §2 #70). NO yamt-*, NO tauri
│  └─ compare/                the `yamt --diff` window's stored tabs (plan §2 #97). Depends on merge-core only; NO tauri, NO git
├─ src-tauri/                 Tauri shell: commands + DTO export + DMABUF guard. Depends on session, settings, lsp-host, compare
├─ frontend/
│  ├─ package.json            pnpm; Vite + Vue 3 + TS strict
│  ├─ src/
│  │  ├─ ipc/                 ChunkSource interface; tauri.ts (createTauriSource); fixture.ts
│  │  │  └─ bindings.ts       GENERATED from Rust (tauri-specta). Never hand-edited
│  │  ├─ model/               pure TS, framework-free: chunk state, scroll map, apply math
│  │  ├─ editor/              CodeMirror integration; exports ONLY MergeController and CompareController (plan §2 #96)
│  │  ├─ connectors/          pure geometry → SVG path strings
│  │  ├─ ui/                  Vue components + one store. Never imports @codemirror/*
│  │  └─ main.ts              wiring: the merge root (source, store, App) or, for `yamt --diff`, the compare root (plan §2 #94)
│  └─ fixtures/               golden/<case>.json: the engine's output per golden (`just fixtures`); compare/<case>.json (the compare window's cases); sample/ for `just smoke-cli`
├─ tests/golden/<case>/       base.<ext> local.<ext> remote.<ext> expected.json README.md  (real conflicts from public projects, plan §2 #26)
└─ tests/compare/<case>/      left.txt right.txt: the compare window's fixture pairs (`yamt-cli compare`, plan §2 #95)
```

Two toolchains, one entry point: `just check` runs every gate below (§8).

---

## 2. Dependency direction

````mermaid
graph LR
  subgraph Rust
    core[merge-core]
    gitio[gitio]
    session[session] --> core
    session --> gitio
    cli[cli] --> session
    cli --> core
    tauri[src-tauri] --> session
    tauri --> settings[settings]
    tauri --> lsphost[lsp-host]
    tauri --> compare[compare]
    compare --> core
  end
  tauri -. generates .-> bindings[ipc/bindings.ts]
  subgraph Frontend
    bindings --> ipc[ipc/]
    editor[editor/] --> ipc
    editor --> connectors[connectors/]
    ui[ui/] --> editor
    ui --> ipc
    main[main.ts] --> ui
    main --> ipc
  end
```

Rules (each one is enforced, not advised — §8 says by what):

| rule                                                                                                                                                         | enforced by                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `merge-core` has no `std::process`, `std::fs`, `tokio`, `tauri`, `serde_json`                                                                                | clippy `disallowed_methods`/`disallowed_types` + no such deps in `Cargo.toml` (cargo-deny `bans` wildcard check per crate)      |
| `gitio` contains no diff logic (never depends on `merge-core`)                                                                                               | workspace `Cargo.toml` graph; `cargo tree -e normal -p gitio` must not list merge-core (just recipe)                            |
| `src-tauri` depends only on `session`, `settings`, `lsp-host`, `compare` + tauri crates; command bodies ≤ 15 lines (thin); `settings` and `lsp-host` depend on no `yamt-*` crate and not on tauri; `compare` depends on `merge-core` only among `yamt-*` and not on tauri | `scripts/arch-check.sh` (yamt-app's, yamt-settings', yamt-lsp-host's and yamt-compare's direct deps); reviewer rule |
| `ui/**` never imports `@codemirror/*`, `@tauri-apps/*`, `editor/internal/**`, `model/**` directly (only `ipc/` talks to the app)                             | oxlint `no-restricted-imports` in a per-directory `overrides` block (`/**` globs); `frontend/scripts/fences.test.ts`            |
| `model/**` and `connectors/**` import nothing from `vue`, `@vueuse/*`, `editor/`, `ui/`, `@tauri-apps/*`; `editor/**` imports nothing from `vue`/`@vueuse/*` | oxlint `no-restricted-imports` overrides; `import/no-cycle` globally                                                            |
| The compare window's root (`ui/Compare*.vue`, `ui/compare*.ts`, `ui/useCompare*.ts`: every compare-only file carries the prefix) never imports `ui/store.ts`, `ui/App.vue` or `lsp/` (plan §2 #94) | `frontend/scripts/fences.ts` PM7 + its failing-path test |
| Only `ui/linuxPaste.ts` reads the clipboard through WebKit: no other file reads a `clipboardData` or calls `navigator.clipboard.read`/`readText` (plan §2 #99) | `frontend/scripts/clipboardFence.ts` PM8 (called by `fences.ts`) + its failing-path test |
| `ipc/bindings.ts` is generated and byte-identical to `cargo run -p yamt-app --features bindings --bin export-bindings` output                                | `just bindings-check` diff in CI; hook blocks `edit`/`write` on the path                                                        |
| No `unwrap`/`expect`/`panic!` outside tests in Rust                                                                                                          | clippy `unwrap_used`, `expect_used`, `panic` = deny; `#[cfg(test)]` allowed                                                     |
| No `any`, no non-null assertions, no `as` casts outside `ipc/fixture.ts`                                                                                     | oxlint `no-explicit-any`, `no-non-null-assertion`, `consistent-type-assertions: never` (override for the fixture parser)        |
| Every `switch` over a union is exhaustive; every Rust `match` over a domain enum lists all variants                                                          | oxlint type-aware `switch-exhaustiveness-check`; clippy `wildcard_enum_match_arm = deny`                                        |
| No magic numbers                                                                                                                                             | oxlint `no-magic-numbers` (ignore `0, 1, -1`); Rust: reviewer rule, constants in `merge_core::Options` and module-level `const` |
| Line numbers of different spaces never mix                                                                                                                   | Rust newtypes `BaseLine`/`LocalLine`/`RemoteLine`, `LeftLine`/`RightLine` for the compare; TS brands applied in `ipc/` (§4)     |

---

## 3. Rust crates

### 3.1 `merge-core` — the IP

```rust
#![forbid(unsafe_code)]

/// 0-based line index in one specific document's line space. Newtypes so that a
/// base-space line can never be passed where a local-space line is expected.
pub struct BaseLine(pub u32);
pub struct LocalLine(pub u32);
pub struct RemoteLine(pub u32);

/// Constructive range: `start` + `len`, so an inverted range cannot be built.
pub struct LineRange<L> { pub start: L, pub len: u32 }
impl<L> LineRange<L> { pub fn end(&self) -> L; pub fn is_empty(&self) -> bool; }

pub enum ChunkKind { LocalOnly, RemoteOnly, BothSame, Conflict }

pub struct ChunkId(pub u32);  // index, stable for the file's lifetime

pub struct Chunk {
    pub id: ChunkId,
    pub kind: ChunkKind,
    pub base: LineRange<BaseLine>,     // may be empty (pure insertion)
    pub local: LineRange<LocalLine>,
    pub remote: LineRange<RemoteLine>,
}

pub struct Options { pub gap: u32 }
pub const DEFAULT_GAP: u32 = 1;   // tuned by goldens; the only tuning constant

pub fn compute_chunks(base: &str, local: &str, remote: &str, opts: &Options) -> Vec<Chunk>;

/// Expected merge text when every non-Conflict chunk is applied — used by tests and
/// by `cli classify` to cross-check against `git merge-file`.
pub fn apply_non_conflicting(base: &str, local: &str, remote: &str, chunks: &[Chunk]) -> String;
````

The chunk types (`BaseLine`, `LocalLine`, `RemoteLine`, `LineRange`, `ChunkKind`, `ChunkId`,
`Chunk`) derive `serde::Serialize` + `specta::Type` and cross the IPC as they are; `session` and
`src-tauri` reuse them instead of mirroring them (plan §2 #25). `apply_non_conflicting` keeps a
`Conflict` chunk's base lines (the result starts from base, plan §2 #9).

Algorithm (plan §4), made precise:

1. `d1 = diff(base, local)`, `d2 = diff(base, remote)` via `imara-diff` (histogram, then its
   `postprocess_lines` hunk placement; interned lines with terminators so a missing trailing
   newline is a real difference). Lines are split on `\n` only; `\r` stays in the line content,
   so CRLF↔LF shows up as a change, exactly as git sees it.
2. Each hunk → `{ base: LineRange, side: LineRange }`. Both lists are sorted by `base.start`.
3. Sweep: merge all hunks (both sides) in base order into regions. Open a region at the first
   hunk; absorb the next hunk if `next.base.start <= region.base.end + gap`. Two zero-length
   insertions at the same base line **always** merge (they are the classic add/add conflict).
4. For each region: side ranges are not the union of hunk side ranges — they are the base
   endpoints mapped through that side's edit script (`map_base_to_side(script, line)`), so a
   region that only one side touched still has a correct, possibly identical, range on the other
   side. This is what makes connectors and scroll anchors trivial.
5. Kind: hunks from one side only → `LocalOnly`/`RemoteOnly`; both → compare the side texts of
   the region; equal → `BothSame`, else `Conflict`.

Invariants (property-tested with `proptest`):

- chunks sorted by `base.start`, pairwise disjoint in base space, same for local and remote.
- when yamt finds no `Conflict` chunk **and** `git merge-file -p --diff-algorithm=histogram`
  exits 0, `apply_non_conflicting` `==` git's output (the CLI test harness shells out to git;
  `merge-core` itself never does). Equality on every triple yamt calls conflict-free is not
  achievable: imara-diff and git's xdiff place ambiguous runs of repeated lines differently, so
  the two can disagree on _whether_ a region conflicts. yamt applies nothing on its own
  (plan §2 #9), so such a region is still reviewed by the user; the test prints how often each
  side disagrees.
- for any triple, every non-Conflict chunk's text on the "other" side equals the base text
  of that region (otherwise it is by definition a conflict).
- `local == base` ⇒ every chunk is `RemoteOnly`; `local == remote` ⇒ no `Conflict`.
- `base == ""` (add/add) with `local` and `remote` both non-empty ⇒ exactly one chunk, base range
  empty at line 0, `Conflict` unless `local == remote` (then `BothSame`).
- reconstruction: base with each chunk's base range replaced by its local lines `==` local,
  byte for byte; same for remote (proves the side-range mapping of step 4).

**Word changes** (plan §2 #30, #31): `pub fn word_changes(base, local, remote, chunks: &[Chunk]) -> Vec<WordChanges>`,
one per chunk in order; each side is compared with base on its own, line by line
(`line_pairs.rs`, `word.rs`, tokens in `token.rs`):

1. anchors — the chunk's lines diffed with all whitespace removed (imara-diff histogram), so a
   re-indented line pairs with its original; exact line equality is not a separate anchor;
2. gaps between anchors — base and side lines paired in order by shared words (Dice ≥
   `MIN_SHARED_PERCENT` = 50; wordless lines by their symbols; a maximum-sum table, at most
   `MAX_GAP_COMBINATIONS` cells, above it the gap's side lines are new);
3. inside each pair — a token diff (word runs, whitespace runs, single other characters).

Output per side, `SideWordChanges<L> { changed: Vec<InlineRange<L>>, removals: Vec<Removal<L>> }`:
`changed` = side text not in base (an unpaired side line whole; ranges on one line separated only by
whitespace joined), `removals` = `Removal<L> { at: InlinePoint<L>, text: String }`, the zero-width
places where base text the side removed would sit (inside a pair, or one per run of unpaired base
lines with nothing new in their place) with that base text, line breaks as `\n`, never empty;
removals meeting at one place join in base order (plan §2 #73).
`InlineRange<L> { line, start, len }` and `InlinePoint<L> { line, column }` stay on one line, columns
in UTF-16 code units (the unit of JavaScript strings and CodeMirror positions). A side whose chunk
text or base text is empty gets nothing (the block tint says it all). Pure.

**2-way compare** (plan §2 #93, #95; `compare.rs`): `pub fn compare(left: &str, right: &str) -> Vec<Difference>` for the
`yamt --diff` window. One `compute_chunks(left, left, right, &Options { gap: COMPARE_GAP })` (`COMPARE_GAP` = 0: one
difference per hunk, as WebStorm's 2-way; with `local == base` every chunk is `RemoteOnly`, `chunk.base` the left
range, `chunk.remote` the right), then the word step's `side_word_changes` once per direction: the right against the
left lines, the left against the right lines. `Difference { left: LineRange<LeftLine>, right: LineRange<RightLine>,
words: DifferenceWords { left: SideWordChanges<LeftLine>, right: SideWordChanges<RightLine> } }` (an empty range is
an insertion point); `LeftLine`/`RightLine` are line spaces of their own. Property-tested in `tests/compare.rs`
(rebuilding the right from the left, sorted and disjoint, `compare(t, t)` empty, equal to `compute_chunks(l, l, r, gap
0)`); the line-text generators are shared with the word tests (`tests/texts/`). Measured (release): two 8 MiB texts
with 50 scattered edits 0.10 s, every line different 1.0 s.

### 3.2 `gitio` — subprocess only

```rust
pub struct Repo { root: PathBuf, git: PathBuf /* resolved `git` */ }

pub struct Oid(String);                    // 40 or 64 hex chars; Oid::parse, as_str
pub enum Stage { Base, Local, Remote }     // index stages 1, 2, 3 — no stage 0 or 4 can be built
pub struct StageEntry { pub mode: u32, pub oid: Oid, pub stage: Stage, pub path: PathBuf }

impl Repo {
    pub fn discover(cwd: &Path) -> Result<Repo>;                 // rev-parse --show-toplevel
    pub fn root(&self) -> &Path;
    pub fn unmerged(&self) -> Result<Vec<StageEntry>>;            // ls-files -u -z
    pub fn blob_reader(&self) -> Result<BlobReader>;              // cat-file --batch, long-lived
    pub fn restore_stages(&self, entries: &[StageEntry]) -> Result<()>; // update-index -z --index-info
    pub fn checkout_merge(&self, path: &Path) -> Result<()>;      // checkout -m -- <path>
    pub fn add_paths(&self, paths: &[&Path]) -> Result<()>;       // add -- <paths> (one call for a batch)
    pub fn resolve_with(&self, entry: &StageEntry) -> Result<()>; // update-index --index-info: one stage-0 record replaces every stage
    pub fn remove_paths(&self, paths: &[&Path]) -> Result<()>;    // update-index --force-remove -- <paths>
    pub fn checkout_from_index(&self, path: &Path) -> Result<()>; // checkout-index -u --force -- <path> (links, exec bit, filters, fresh stat)
    pub fn index_records(&self, path: &Path) -> Result<Vec<u8>>;  // ls-files -s -z -- <path>: opaque snapshot before a take
    pub fn restore_index_records(&self, path: &Path, records: Vec<u8>) -> Result<()>; // puts that snapshot back (or --force-remove when empty)
    // what git wrote at start (plan §2 #53)
    pub fn version(&self) -> Result<GitVersion>;                  // `git version` (Apple and Windows suffixes parsed)
    pub fn attributes(&self, paths: &[&Path]) -> Result<Vec<MergeAttributes>>; // check-attr -z --stdin conflict-marker-size merge working-tree-encoding
    pub fn merge_config(&self) -> Result<MergeConfig>;            // config -z --get-regexp: merge.default + configured merge.<name>.driver names
    pub fn hash_objects(&self, paths: &[&Path]) -> Result<Vec<Oid>>; // hash-object --stdin-paths (clean filters per path)
    pub fn merge_file(&self, scratch: &Path, base: &[u8], local: &[u8], remote: &[u8], options: &MergeFileOptions) -> Result<Vec<u8>>; // merge-file -p; exit 0..127 = conflict count
    pub fn submodule_head(&self, path: &Path) -> Result<Option<Oid>>; // rev-parse HEAD inside a checked-out submodule
    // the sides' names (plan §2 #50, #62)
    pub fn commit_named(&self, name: &str) -> Result<Option<Oid>>; // rev-parse --verify --quiet <name>^{commit}; missing → None
    pub fn branches_at(&self, commit: &Oid) -> Result<Vec<Vec<u8>>>; // for-each-ref --points-at refs/heads refs/remotes, symbolic refs skipped
    pub fn merge_message(&self) -> Result<Option<Vec<u8>>>;        // MERGE_MSG through rev-parse --git-path
    pub fn commit_summary(&self, commit: &Oid) -> Result<CommitSummary>; // log -1 %h %s %B
    pub fn current_branch(&self) -> Result<Option<Vec<u8>>>;      // branch --show-current; detached (empty output) → None
    // what git is doing (plan §2 #85, #91; operation.rs, sequence.rs, todo.rs): git's `wt_status_get_state` order plus a squash merge
    pub fn stop(&self) -> Result<Stop>;                            // Stop { operation: Option<Operation>, head }; state files through one batched rev-parse --git-path, refs through rev-parse --verify
    // Abort and Continue (plan §2 #88, #89; abort_continue.rs): git's own command per operation, no deadline, the user's locale, stdin closed
    pub fn abort(&self, operation: &Operation) -> Result<()>;       // merge/rebase/cherry-pick/revert/am --abort, a squash merge reset --merge; a refusal is GitFailed with git's stderr
    pub fn continue_operation(&self, operation: &Operation) -> Result<GitRun>; // GIT_EDITOR=: (git keeps its prepared message); GitRun { succeeded, output } (stdout then stderr)
    pub fn rerere_tracked(&self) -> Result<Option<Vec<PathBuf>>>;  // MERGE_RR's paths (`--git-path`); None while rerere is not enabled (rerere.c `is_rerere_enabled`) or nothing is recorded (plan §2 #90)
}
pub enum Operation { Merge { merging }, SquashMerge { merging }, Rebase(Rebase { branch, onto, replaying, redoing_merge, progress, editor_steps_ahead }),
                     CherryPick { picking, progress }, Revert { reverting, progress }, Am { subject, message, progress } }
impl Stop { pub fn id(&self) -> StopId; }                          // the stop's identity: the operation's kind, its ids and HEAD, never progress or the todo (`rebase --edit-todo` is the same stop)
impl BlobReader { pub fn read(&mut self, oid: &Oid) -> Result<Vec<u8>>; }
```

- Every git call: explicit argv, `-c core.quotepath=false`, `LC_ALL=C`, `GIT_OPTIONAL_LOCKS=0`
  for reads, cwd = repo root, timeouts, stderr captured into the error.
- Bytes in, bytes out. No UTF-8 assumptions here; `session` decides.
- Integration tests build real repos in `tempdir` with a scripted conflict (crate
  `yamt-conflict-repo`, `conflict_repo(files)`, shared with `session`'s tests), including
  add/add, delete/modify, and a CRLF file. These tests are the only place `git` runs during `just check`.

### 3.3 `session` — the state machine

```rust
pub struct MergeSession { repo: Repo, stop: Stop /* read at open, plan §2 #85 */, orientation: Orientation /* which git side each pane shows, #86 */, side_names: SideNames /* read at open, #87 */, first_disk_version: DiskVersion, files: Vec<FileState> /* private: captured stages, decoded content, `at_open` (the entry this run found, set once, #66), `seen` (what the disk looked like), `settled` (last disk result + version) */ }

pub enum Eol { Lf, CrLf, Mixed }
pub enum FileStatus { Unresolved, Remembered /* unmerged for git, git rerere's replayed resolution on disk, not reviewed yet, #90 */, Resolved }
pub enum UnsupportedReason { Binary, NonUtf8, TooLarge, LocalDeleted, RemoteDeleted, Symlink, Submodule }

// DTOs (serde::Serialize + specta::Type), see §4
pub struct FileEntry { pub path: String, pub status: FileStatus, pub unsupported: Option<UnsupportedReason> }
pub struct MiddleLine(pub u32);   // a line of the middle pane's starting text
pub struct DiskVersion(pub u32);  // bumped by each settle of the file (plan §2 #53); a session git moved on from hands its highest to the next (`open_after`), so versions never repeat within one run (#1383)
pub enum Middle { Stages { text: String } /* base; "" for add/add */, Disk { text: String }, DiskNotText { found: NotText } }
pub struct MergeChunk { pub chunk: Chunk, pub middle: LineRange<MiddleLine>, pub words: WordChanges, pub waiting: Waiting }
pub enum Waiting { SideLines, Markers { open: String, first: Side, between: Vec<String>, close: String }, AsShown, Remembered } // what Save writes while a side waits (#69): the side applied; git's marker lines copied from the file's first block (`MarkerStyle`, size, labels, diff3 base section; `first`: the pane git's first section is, #86) or a disk block's own; the Result as shown; a rerere-replayed block as shown (#90)
pub struct FileMergeData { pub path: String, pub middle: Middle, pub local: String, pub remote: String,
                           pub deleted: Option<Side>, pub eol: Eol, pub chunks: Vec<MergeChunk>, pub disk_version: DiskVersion }
pub enum DiskResult { Staged, MarkersLeft { conflicts: u32 }, LeftAsIs, StageFailed { message: String } }
pub struct DiskChange { pub path: String, pub result: DiskResult }
pub enum Refreshed { Files(StopList), MovedOn }                    // MovedOn: git is at another stop now, nothing was settled (#89)
pub struct StopList { pub files: Vec<FileEntry>, pub disk_changes: Vec<DiskChange>, pub operation: Option<OperationView>, pub sides: SideNames }
pub enum OperationView { Merge { merging, into }, SquashMerge { merging, into }, Rebase { branch, onto, replaying, progress, editor_steps_ahead },
                         CherryPick { picking, progress }, Revert { reverting, progress }, Am { subject, message, progress } } // names as SideName (#87), progress { step, total }
pub enum Continued { Finished { kind: OperationKind, output: String }, Stopped { message: String } }
pub enum WriteReply { Written { files: Vec<FileEntry> }, ChangedOnDisk { files: Vec<FileEntry>, change: DiskChange } }

impl MergeSession {
    pub fn open(cwd: &Path) -> Result<Self>;                         // reads the stop, decides the orientation, captures every file's stages, decodes its blobs, reads the disk, compares it with what git wrote
    pub fn open_after(cwd: &Path, previous: DiskVersion) -> Result<Self>; // the next stop of one run: disk versions start above `previous` (#1383)
    pub fn refresh_stop(&mut self) -> Result<Refreshed>;             // reads the stop first (another → MovedOn); else settles disk changes (stage or reopen), re-reads `ls-files -u`, the operation as now, the names as at open
    pub fn stop(&self) -> &Stop;
    pub fn highest_disk_version(&self) -> DiskVersion;
    pub fn files(&self) -> Vec<FileEntry>;
    pub fn load(&mut self, path: &str) -> Result<FileMergeData>;     // from the stages (base + compute_chunks), or from the disk (one Conflict per open block)
    pub fn finish(&mut self, path: &str, result: &str, v: DiskVersion) -> Result<WriteReply>; // look first; write worktree, git add, Resolved; on a failed add the worktree is put back
    pub fn save(&mut self, path: &str, text: &str, v: DiskVersion) -> Result<WriteReply>; // finish without git add (#65/#69): look first; skips identical bytes; the own write updates `seen` only, no DiskChange, the disk version stays
    pub fn describe(&mut self, path: &str) -> Result<FileSides>;     // per side: Missing | Text{lines} | Binary/NonUtf8/TooLarge{bytes} | Link{target} | Commit{id}
    pub fn take(&mut self, path: &str, side: Side, v: DiskVersion) -> Result<WriteReply>; // look first; resolve with one side (plan §2 #36): stage 0 first, then worktree; deleted side = git rm
    pub fn reset(&mut self, path: &str, v: DiskVersion) -> Result<WriteReply>;  // look first; restore_stages, then the at-open bytes (`AtOpen::reset_to`, #66); checkout -m only for a link, submodule, other entry or unread file; all or nothing
    pub fn root(&self) -> &Path;
    pub fn remaining(&self) -> usize;
    pub fn operation_kind(&self) -> Option<OperationKind>;          // the stop's operation as read at open
    pub fn abort_operation(&mut self) -> Result<OperationKind>;      // re-reads the stop (none → NoOperation, another → StopMovedOn), then git's abort (#88)
    pub fn continue_operation(&mut self) -> Result<Continued>;       // re-reads the stop, then git's continue; a refusal → GitRefused { message }, nothing settled (#89)
}
```

Edge cases owned here (plan §6 → code):

| case                                                           | handling                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no stage 1 (add/add)                                           | `base = ""`; chunk model yields one Conflict                                                                                                                                                                                                                                                                                                                                                                                                                          |
| no stage 2 or 3 (delete/modify)                                | kept side and base text → loads with `FileMergeData.deleted` (that side's text = base, every chunk one-sided; the window shows the kept side read-only with Keep / Delete, plan §2 #47); otherwise `unsupported: LocalDeleted / RemoteDeleted` and the two-button choice. `take`: the kept side's stage 0 + `checkout-index`, or `--force-remove` + delete (#36)                                                                                                      |
| binary (NUL in first 8000 bytes, git's heuristic) or non-UTF-8 | `unsupported: Binary / NonUtf8`; the window shows each side's size and offers take left / take right (`take`, same result as `git checkout --ours/--theirs` + add), plan §2 #36                                                                                                                                                                                                                                                                                       |
| line endings                                                   | `Eol` detected on the first of base, local, remote that contains a line break (none → `Lf`): `Lf`, `CrLf`, `Mixed`; `finish` writes text as given by the frontend (frontend joins with the configured separator); `Mixed` is passed through untouched with a UI warning                                                                                                                                                                                               |
| `git add` destroys stages                                      | `stages` captured in `open()`; `reset` replays them                                                                                                                                                                                                                                                                                                                                                                                                                   |
| file > 8 MiB                                                   | `Unsupported(TooLarge)` — CM6 handles it, the webview IPC does not enjoy it; revisit                                                                                                                                                                                                                                                                                                                                                                                  |
| a conflicted file changed on disk (plan §2 #52/#53)            | `refresh_stop()` and each write look at the disk; no marker lines, not text, or gone → staged in one batch; markers left → the view is the disk, one `Conflict` per open block (`markers.rs`, `locate.rs`, `seed.rs`); a write with an old `DiskVersion` or after an unseen change writes nothing and replies `ChangedOnDisk`; a version from before this session (an older stop) → `StopMovedOn`; `finish` never writes through a link or into a folder (`NotAFile`) |
| a file already changed before start                            | `start.rs`: two-sided text is compared with `git merge-file` of the stages (ours/theirs views, any conflict style), other kinds with the stage git leaves through `hash-object`; the merge driver is resolved as git does (attribute, `merge.default`, configured drivers); a differing file starts as `GitOutput` and the first `refresh_stop()` settles it                                                                                                          |
| a resolution git rerere replayed (plan §2 #90)                 | `start.rs`: rerere enabled, the path in `MERGE_RR` (`rerere_tracked`), git's output had conflict blocks, the disk has none → `AtOpen::Remembered`, `Seen::ViewRemembered`: never settled, so never staged at open; `remembered.rs` shows the remembered text as the Result, each block git wrote a `Waiting::Remembered` conflict at the lines `line_map` finds (one text rule with the disk view, `locate::mapped_text`); Mark resolved stages it                    |
| a rebase replays the user's own commit (plan §2 #86/#91)       | `orientation.rs`: `Orientation` from the `Stop`, once per stop: git's theirs on the left only for `Rebase { replaying: Some(_), redoing_merge: None }`; every consumer of git's sides (describe, take, Keep/Delete, names, line ranges) goes through it; disk and index stay in git's order, so Save writes git's own bytes                                                                                                                                           |
| git moved on to another stop (plan §2 #89)                     | every list, Continue and Abort re-reads `Repo::stop()` first; another `StopId` → `Refreshed::MovedOn` / `StopMovedOn`, nothing settled or staged; the app opens the next stop with `open_after`                                                                                                                                                                                                                                                                       |

### 3.4 `cli`

```
yamt-cli classify <base> <local> <remote> [--gap N] [--json]   # chunk table, or the chunks as JSON (§4 `Chunk[]`)
yamt-cli scan [<repo>]                                         # unmerged files + per-file chunk counts or unsupported reason
yamt-cli golden run|update [<dir>]                            # compare / rewrite every case's expected.json (default tests/golden)
yamt-cli fixture <case-dir>                                    # FileMergeData JSON for M1 (`session::merge_data`), same DTO as IPC
yamt-cli compare <case-dir>                                    # { left, right, differences } of <case-dir>/{left,right}.txt (`merge_core::compare`), the compare window's fixtures
```

`cli` uses `merge-core` directly only for pure text work (`classify`, `golden`, `compare`);
everything that touches a repository goes through `session`. A case is
`tests/golden/<case>/{base,local,remote}.<ext>` with the original file extension (so PhpStorm
and the window highlight it), a generated `expected.json` (the chunks; written only by
`just golden-update`), and a `README.md` (source project, license, commits, original path,
how to open it in PhpStorm). `scripts/golden-repo.sh <case> <dir>` builds a git repo holding
that conflict for PhpStorm's own merge window.

M0 acceptance lives here: `just golden` (`golden run`) passes, the `git merge-file` cross-check
(RK13) passes, and the human compares the 10 goldens against PhpStorm once.

### 3.5 `src-tauri`

- `tauri::State<Mutex<Merge>>` (`merge.rs`: `Merge = Held(Box<MergeSession>) | Running(OperationKind) | MovedOn { root,
  highest_disk_version } | Aborted(OperationKind) | Finished(OperationKind)`, plan §2 #88/#89) and
  `tauri::State<Mutex<Host>>` (the language-server host, plan §2 #70), never locked together. `Merge::session()` is the
  one state → error mapping: `Running` → `GitRunning`, `MovedOn` → `StopMovedOn`, `Aborted` → `MergeAborted`,
  `Finished` → `MergeFinished`. Continue and Abort hand the session to a `spawn_blocking` worker (`on_worker`), so the
  main thread never waits on git; the state is `Running` meanwhile. git's refusal puts the session back (`Held`); a
  refusal that says git moved on (`StopMovedOn`, #1440) and a worker panic leave `MovedOn` (the version from before the
  hand-over) and answer `StopMovedOn`, so the window's one `nextStop` lists the stop git is at (#1435, plan §2 note
  after #91).
- Commands (thin, typed with `tauri-specta`; plan §2 #41): `list_stop() -> Result<Listing>` (`Listing = Files { files,
  disk_changes, operation, sides } | MovedOn`; in `MovedOn` it first opens the next stop with `open_after`, then lists
  through `refresh_stop`: settles disk changes and re-reads git's unmerged entries, so the marks are git's view, plan
  §2 #49/#53; `operation` is what git is doing now, `sides` both panes' names as read at open, #85/#87),
  `load_file(path) -> FileMergeData` (`deleted` names the deleted side of a
  deleted-on-one-side text file, whose text is base, #47; `middle` is the stages' base or the disk),
  `finish_file(path, text, disk_version) -> WriteReply`, `save_file(path, text, disk_version) -> WriteReply`
  (`finish_file` without `git add`: the own write updates `seen` only, the disk version stays, plan §2 #65/#69),
  `reset_file(path, disk_version) -> WriteReply` (back to this run's start: the stages captured at open and the
  bytes found at open, `FileState.at_open`, #66/#69),
  `describe_file(path) -> FileSides`, `take_side(path, side, disk_version) -> WriteReply` (plan §2 #36;
  `ChangedOnDisk` when the disk changed first or the version is old, #53), `continue_operation() -> Result<ContinueReply>`
  (`Finished` | `Stopped { message }`: git's continue on the worker; `Finished` → `Merge::Finished` and the window is
  destroyed; `Stopped` → `MovedOn`, the window lists the next stop; a refusal is `Git` with git's message, #89),
  `abort_operation() -> Result<()>` (git's abort for the operation, #88: on success `Aborted` and the calling window is
  destroyed, which emits no close request, so the page's unsaved-work question never runs; a refusal is `Git` with
  its message and the session stays held). The two async commands destroy the window only when `has_ended()`. `log(entry)`. No
  `quit_if_done`: the app stays open after the last file (#37); the exit status at close goes through
  `outcome::ending_when_git_is_done` (waits for a running worker, then lists through `refresh_stop`, so it settles disk
  changes and uses git's view, #49; a stop git moved on from counts the new stop's files, staging nothing); after an
  abort it is 1 with `<operation> aborted`, after a finished Continue 0 with `<operation> finished`, nothing re-read.
- Settings commands (`settings.rs`, plan §2 #57, #60), each given the window's settings in use
  (`current: StoredSettings`) and answering `SettingsRead { path, default_path, stored }`:
  `load_settings(current)`, `set_theme(current, theme)`, `set_antialiasing(current, antialiasing)`,
  `set_keys(current, changes)`, `move_settings(current, path)`. Each computes `Places` from Tauri's
  path resolver, calls one `yamt_settings` function and applies the returned theme to the native
  window background (`window::show_theme`); no settings state lives in the shell. At start
  `window.rs` reads `stored_at_start` once before building the window: its background and an
  initialization script that sets `<html data-theme>` before the first frame, and on Linux
  `font_rendering::apply(antialiasing)` on GTK's own settings (`gtk-xft-antialias`, `gtk-xft-rgba`)
  before the webview exists (WebKitGTK fixes its subpixel layout at start, #60); a changed
  antialiasing takes effect at the next start. Three more answer `SettingsRead` for the language servers (plan §2 #67,
  #70, #83): `set_server_answer(current, answer: "start" | "dontStart" | null)` (keyed by the host's repository root, the
  string `servers_context().root` gives; `null` forgets it), `set_server_switch(current, server, on)` (the same root;
  `on: false` adds the server's key to that root's set, `true` removes it, an emptied root goes) and
  `set_added_servers(current, added)`; the file's entry is `languageServers { repositories, off: { <root>: [keys] },
  added: [{ command, fileTypes }] }` (`off` defaults to empty, so a 0.4.0 file reads with nothing off).
- Language-server commands (`servers.rs`, crate `yamt-lsp-host`, plan §2 #70; Rust never parses a server message):
  `servers_context() -> ServerContext { root, process_id }`, `start_server(command: ServerCommand { program, args,
  project, folders }, events: Channel<HostEvent>) -> StartReply` (`Started{run}` | `NotFound{program, searched}` |
  `SpawnFailed` | `OutsideRepository`; events `Message{text}` | `Log{line}` | `Exited{code}`, `Exited` once and last),
  `send_to_server(run, message)`, `stop_server(run)` (signals; the child is killed 2 s later if it has not exited),
  `find_program(program, project, folders: ProgramFolders { project, home }) -> ProgramFound` (each `folders.project`
  entry in the project and its parents up to the root, then PATH, then each `folders.home` entry in the home folder,
  place `Project` | `Path` | `Home`; the window chooses the folders, plan §2 #72; `searched` in order),
  `project_files(paths) -> Vec<ProjectFile>` (repo-relative, text up to 64 KiB). A
  page load stops the previous page's runs (`on_page_load` in `with_session`); `stop_all` after `run_return` leaves no
  child.
- Errors: one `#[serde(tag = "kind")] enum IpcError` in `ipc_error.rs` (`Git`, `UnknownPath`,
  `Unsupported`, `WriteFailed`, `NotAFile`, `ReadFailed`, `SettingsBroken`, `NotAbsolute`,
  `NoConfigFolder`, `MergeAborted`, `StopMovedOn`, `GitRunning`, `MergeFinished`, `NoOperation`, and for the compare
  window `UnknownTab { tab }`, `ColumnTooLarge { limit }`, `WorkerStopped`) mirrored into TS; no stringly errors. A disk
  change is never an error.
- **The compare window** (`yamt --diff`, plan §2 #93/#94; `args.rs` `Invocation::Compare`, `window.rs` `run_compare`,
  `compare.rs`): never opens a `MergeSession`, never runs git, never manages `Mutex<Merge>` or the language-server host.
  `compare::manage_store_in(app, data_dir)` opens `yamt_compare::TabStore` in `<data_dir>/yamt/compare/` and manages it
  as `CompareState = Mutex<TabStore>` (the third `Mutex`, never held with another, plan §2 #97); a failure ends before
  any window with exit 2 and one line (`another yamt --diff window is open (<folder>)`, the crate's `Broken`/`NewerFormat`
  words, `no data folder: …`). Both windows go through one `open_and_wait`; the start script sets `<html data-window=
  "merge|compare">` beside `data-theme`; the compare window is titled `Compare — yamt` and ends with exit 0, no question.
  Commands: `open_compare() -> CompareStart`, `load_tab(tab) -> TabTexts` and `set_column(tab, column, text, version) ->
  Comparison` (async: the store is locked only to call it, the reply's diff runs on a `spawn_blocking` worker after the
  lock is released; a worker panic answers `WorkerStopped` and the lock recovers), `add_tab`, `close_tab(tab)`,
  `rename_tab(tab, name)`, `set_tab_language(tab, language)`, `show_tab(tab)` (each `-> TabList`). The merge commands are
  registered there too and answer Tauri's "state not managed"; the compare page never calls them.
- **Pasting on Linux** (`clipboard.rs`, plan §2 #99): `read_clipboard(selection: ClipboardSelection) -> Option<String>`
  (`ClipboardSelection = Clipboard | Primary`), registered for both windows, no managed state. GTK's text request is
  started on the main thread (`run_on_main_thread`) and its answer awaited on a `spawn_blocking` thread, so a hung
  owner never blocks the window; `None` = no owner, no text, unreadable, or the main thread gone; other systems always
  `None`. Never asks GTK for the clipboard's format list: WebKitGTK 2.54.0/2.54.1 crash reading a failed one
  (`Clipboard::formats`, upstream bug 324466), which is why the window takes every paste on Linux (§5.4 `linuxPaste.ts`).
- `run()` (from `main()`): NVIDIA DMABUF guard first (`graphics.rs`, plan §2 #43), before logging and `tauri::Builder`; CLI `yamt [--repo <path>]` / `yamt --diff`
  (`--diff` with `--repo` is a usage error);
  nothing to merge → message, exit 0; not a repository → message, exit 2; at close exit 0 iff
  `remaining() == 0`, else 1; after Abort exit 1 with `<operation> aborted`, after a finished Continue exit 0 with
  `<operation> finished` (#88/#89). Window title `<repository folder> — yamt`.
- `export-bindings` bin writes `frontend/src/ipc/bindings.ts`. It needs the `bindings` feature, so
  `cargo tauri build` neither builds nor bundles it: tauri bundles every bin of the package unless
  its required features are off, and the universal macOS build makes only the main binary.

### 3.6 `settings` — the per-user settings file

Plan §2 #57. Owns the file, never what a key means (the window does, `frontend/src/ipc/keys.ts`).

- `Places::new(config_dir, home)`: the default file `<config>/yamt/settings.json` and the location
  file `<config>/yamt/settings-location` (one line: the file in use when it is not the default).
- `StoredSettings { theme, antialiasing, keys, languageServers }`: `antialiasing` is `subpixel` (default) or
  `greyscale` (#60); `keys` maps an action id to key strings, only for actions whose keys differ
  from the window's defaults; ids and key strings are opaque text here; `languageServers { repositories:
  { <root>: "start" | "dontStart" }, off: { <root>: [keys] }, added: [{ command, fileTypes }] }` (#67/#70/#83), written
  only when not empty; `off` defaults to empty (a 0.4.0 file reads with nothing off), its keys are the window's text.
- `read`, `set_theme`, `set_antialiasing`, `set_keys`, `set_repository_answer`, `set_server_switch`, `set_added_servers`, `relocate`,
  `stored_at_start`. A read never
  rewrites an existing file; a change re-reads the file, changes one entry, and writes `theme` and
  `antialiasing` always, `keys` when not empty and every other entry as it was, through a temporary
  file and a rename (the end of a symlink chain is written, the links stay); broken JSON →
  `Error::Broken` with line and column, and nothing is written; `relocate` takes an absolute or
  `~/` path, uses an existing file or creates a missing one from the window's settings, then
  records it. `stored_at_start` never writes and falls back to the defaults.
- Dependencies: `serde`, `serde_json` (line/column errors and kept entries), `specta`,
  `thiserror`.

### 3.7 `compare` — the compare window's stored tabs

Plan §2 #93, #97. Package `yamt-compare`; depends on `merge-core` only among `yamt-*`, never on tauri or git
(`scripts/arch-check.sh`). Owns what is stored, never what a language name means (the window does).

- Files in the folder the shell passes (`<data_dir>/yamt/compare/`): `tabs.json` = `{ format: 1, shown, nextId, tabs:
  [{ id, number, name, language: { kind: "auto" } | { kind: "picked", name } }] }`, `<id>-left.txt`/`<id>-right.txt`
  (plain UTF-8; missing = an empty column; the one name rule `column_file_name`, also used to recognise them), `lock`.
  Every write is a temp file + rename; `tabs.json` only on add, close, rename, language and shown, a column file only
  by `set_column` for that column.
- `TabStore::open(dir)`: reads `tabs.json` before writing anything (unreadable → `ReadFailed`, not format 1, no tabs, a
  repeated id, an id at or above `nextId`, a shown tab not listed, `nextId` or a number at `u32::MAX` → `Broken` with
  line and column, format > 1 → `NewerFormat`; in each case nothing in the folder changes), then `File::try_lock` on
  `lock` for the store's life (`Locked`; the OS releases it on any exit), first use → "Compare 1", orphan column and
  temp files removed.
- Tabs: a new tab's number is 1 + the highest, its name `Compare <number>`, its id `nextId` (ids never repeat), added
  last and shown; closing writes the index first, then deletes the files; the shown tab closed → the next, else the
  previous; the last closed → a fresh "Compare 1"; a rename is trimmed, empty keeps the old name; an add (or the last
  close) that would bring an id or number to `u32::MAX` is refused as `Broken`, nothing written (`no_room_left`, the one
  rule `open` also checks).
- Columns: `Arc<str>` in memory; versions in memory only (0 per tab at open); `load_tab` reads the files once;
  `set_column` with a version not above the stored one stores nothing and returns the stored texts and versions;
  `MAX_COLUMN_BYTES` = 8 MiB (`TooLarge`); a failed write changes nothing in memory. `LoadedTab` shares the `Arc`s, so
  `comparison`/`tab_texts` (`merge_core::compare`) run after the caller released the store's lock.
- Dependencies: `serde`, `serde_json`, `specta`, `thiserror`, `yamt-merge-core`.

---

## 4. IPC contract (generated, the single source of truth)

```ts
// bindings.ts — GENERATED
export type LineRange<L> = { start: L; len: number };     // L is a branded number
export type ChunkKind = "LocalOnly" | "RemoteOnly" | "BothSame" | "Conflict";
export type Chunk = { id: ChunkId; kind: ChunkKind; base: LineRange<BaseLine>; local: LineRange<LocalLine>; remote: LineRange<RemoteLine> };
export type Eol = "Lf" | "CrLf" | "Mixed";
export type UnsupportedReason = "Binary" | "NonUtf8" | "TooLarge" | "LocalDeleted" | "RemoteDeleted" | "Symlink" | "Submodule";
export type FileEntry = { path: string; status: "Unresolved" | "Resolved"; unsupported: UnsupportedReason | null };
export type InlineRange<L> = { line: L; start: number; len: number };   // UTF-16 columns, one line
export type InlinePoint<L> = { line: L; column: number };               // zero-width, UTF-16 column
export type Removal<L> = { at: InlinePoint<L>; text: string };          // removed base text, `\n` breaks (plan §2 #73)
export type SideWordChanges<L> = { changed: InlineRange<L>[]; removals: Removal<L>[] };
export type WordChanges = { chunk: ChunkId; local: SideWordChanges<LocalLine>; remote: SideWordChanges<RemoteLine> };
export type MergeChunk = { chunk: Chunk; middle: LineRange<MiddleLine>; words: WordChanges }; // plan §2 #53
export type Middle = { kind: "Stages"; text: string } | { kind: "Disk"; text: string } | { kind: "DiskNotText"; found: NotText };
export type FileMergeData = { path: string; middle: Middle; local: string; remote: string; deleted: Side | null; eol: Eol; chunks: MergeChunk[]; disk_version: DiskVersion };
export type DiskResult = { kind: "Staged" } | { kind: "MarkersLeft"; conflicts: number } | { kind: "LeftAsIs" } | { kind: "StageFailed"; message: string };
export type Listing = { kind: "Files"; files: FileEntry[]; disk_changes: DiskChange[]; operation: OperationView | null; sides: SideNames } | { kind: "MovedOn" }; // DiskChange = { path; result: DiskResult } (#85-#89)
export type ContinueReply = { kind: "Finished" } | { kind: "Stopped"; message: string };
export type WriteReply = { kind: "Written"; files: FileEntry[] } | { kind: "ChangedOnDisk"; files: FileEntry[]; change: DiskChange };
export const commands: { listStop(): Promise<Listing>; loadFile(path: string): Promise<FileMergeData>; … };
// the compare window (plan §2 #93-#97): TabId, ColumnVersion, LeftLine, RightLine = number; Column = "left" | "right"
export type Difference = { left: LineRange<LeftLine>; right: LineRange<RightLine>; words: { left: SideWordChanges<LeftLine>; right: SideWordChanges<RightLine> } };
export type Comparison = { versions: { left: ColumnVersion; right: ColumnVersion }; differences: Difference[] };
export type TabLanguage = { kind: "auto" } | { kind: "picked"; name: string };
export type TabList = { tabs: { id: TabId; name: string; language: TabLanguage; holds_text: boolean }[]; shown: TabId };
export type CompareStart = { list: TabList; column_limit: number };
export type TabTexts = { left: string; right: string; comparison: Comparison };
```

Brands: specta emits the Rust newtypes as plain `number`, so the generated DTOs are
unbranded. `ipc/domain.ts` owns the domain types (`MiddleLine = number & { readonly __brand:
"MiddleLine" }`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion`, and `Chunk`/`FileMergeData` built on them)
and one `toDomain(dto: Generated.FileMergeData): FileMergeData` mapping; word marks and removals convert in
`ipc/words.ts` (`toSideWords`, with the line guard `domain.ts` passes in, plan §2 #73). Both `ChunkSource`
implementations return domain types; nothing outside `ipc/` sees a generated DTO. `DocPos`
(a CodeMirror offset) is a fourth brand created only inside `editor/`. Mixing any two is a
type error, which is the point: base-vs-local-vs-doc confusion is the merge tool's native bug.

Runtime parsing: Tauri payloads come from our own Rust at the same commit through generated
types — trusted, no runtime parse (deliberate deviation from parse-at-boundary). Fixture JSON
is external and is parsed with `valibot` in `ipc/fixture.ts`, the only file allowed `as`.

Logging crosses the boundary too: `commands.log(entry: LogEntry)` where
`LogEntry = { level: "debug"|"info"|"warn"|"error"; event: string; fields: Record<string, string | number | boolean> }`.
Frontend code calls `log.warn("scroll.drift", { lines })` on the one logger that `ipc/` creates
with `createLog(forward)` (`log.ts` exports the factory, not an instance); `log.ts` is the only file that
may touch `console.*` (oxlint `no-console` with a file override): every entry is mirrored to
the webview console as a structured line (`[warn] scroll.drift {lines: 3}`) so devtools in
Epiphany/Tauri show it live, and forwarded to Rust fire-and-forget. Rust forwards to
`tracing`; `--log <file>` / `YAMT_LOG` select sink and level. Debug level is console-only
unless `import.meta.env.DEV`; the IPC call never blocks or throws into caller code.

Workflow for changing it: edit Rust types → `just bindings` → commit both. Hand edits are
blocked by a hook and caught by `just bindings-check`.

`frontend/src/ipc/ChunkSource.ts`:

```ts
export type SourceResult<T> = { ok: true; value: T } | { ok: false; failure: SourceFailure }; // SourceFailure = IpcError
export interface ChunkSource {
  listStop(): Promise<SourceResult<Listing>>; // settles disk changes, then re-reads git: marks are git's view (plan §2 #49/#53); the operation, both panes' names (#85-#87); MovedOn: git is at another stop (#89)
  loadFile(path: string): Promise<SourceResult<FileMergeData>>; // domain Chunk: { id, kind, middle, local, remote, words, waiting }; base is not shown, so not carried; waiting = what Save writes while a side waits (#69)
  finishFile(request: {
    path: string;
    text: string;
    diskVersion: DiskVersion;
  }): Promise<SourceResult<WriteReply>>;
  saveFile(request: {
    path: string;
    text: string;
    diskVersion: DiskVersion;
  }): Promise<SourceResult<WriteReply>>; // writes without staging (#65); the file stays conflicted in git
  resetFile(path: string, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>; // the window reloads the file
  describeFile(path: string): Promise<SourceResult<FileSides>>; // a file the editor cannot show; carries its diskVersion
  takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>; // stage one side as the result
  continueOperation(): Promise<SourceResult<ContinueReply>>; // git's continue (#89): Finished (the app then ends) or Stopped { message } at the next stop; fixture: ipc/fixtureOperations.ts
  abortOperation(): Promise<SourceResult<null>>; // git's abort for the operation (#88); the app then ends; fixture: logs, answers null
  // settings (plan §2 #57): each sends the settings in use and answers SettingsRead { path, defaultPath, stored };
  // the fixture keeps them in memory (ipc/fixtureSettings.ts, path /fixture/settings.json)
  loadSettings(current: StoredSettings): Promise<SourceResult<SettingsRead>>;
  setTheme(current: StoredSettings, theme: Theme): Promise<SourceResult<SettingsRead>>;
  setAntialiasing(
    current: StoredSettings,
    antialiasing: Antialiasing,
  ): Promise<SourceResult<SettingsRead>>; // #60: next start
  setKeys(
    current: StoredSettings,
    changes: readonly KeysChange[],
  ): Promise<SourceResult<SettingsRead>>;
  moveSettings(current: StoredSettings, path: string): Promise<SourceResult<SettingsRead>>;
  // language servers (plan §2 #67/#70/#83): the answer and the switched-off found servers keyed by the host's
  // repository root (null forgets the answer; the fixture keys both by /fixture/repository) and the servers added by hand
  setServerAnswer(
    current: StoredSettings,
    answer: RepositoryAnswer | null,
  ): Promise<SourceResult<SettingsRead>>;
  setServerSwitch(
    current: StoredSettings,
    server: string,
    on: boolean,
  ): Promise<SourceResult<SettingsRead>>;
  setAddedServers(
    current: StoredSettings,
    added: readonly AddedServer[],
  ): Promise<SourceResult<SettingsRead>>;
}
```

The fixture source reads `frontend/fixtures/golden/*.json` — the engine's output for each
golden case — and `frontend/fixtures/showcase/*.json` — hand-written demo cases from
`tests/showcase/<case>/` (e.g. `word-marks.ts`, every kind of word change) — both written by
`just fixtures` and kept current by `just fixtures-check` in `check`; `finishFile` stores results
in memory and logs the text. `createTauriSource` (2.1) maps the generated `commands`. `main.ts`
picks one by `import.meta.env.VITE_CHUNK_SOURCE` (`"tauri"` from the app's dev and build
commands); a failure reaches the window's problem bar through `ui/problemText.ts`.

The compare window (plan §2 #94) talks to its own interface, `frontend/src/ipc/CompareSource.ts`:

```ts
export interface CompareSource extends SettingsSource {
  openCompare(): Promise<SourceResult<CompareStart>>; // the tabs and the column limit (8 MiB, UTF-8 bytes)
  loadTab(tab: TabId): Promise<SourceResult<TabTexts>>; // both texts and their comparison
  setColumn(write: ColumnWrite): Promise<SourceResult<Comparison>>; // ColumnWrite { tab, column, text, version }: stores, then diffs; a stale version stores nothing
  addTab(): Promise<SourceResult<TabList>>;
  closeTab(tab: TabId): Promise<SourceResult<TabList>>;
  renameTab(tab: TabId, name: string): Promise<SourceResult<TabList>>;
  setTabLanguage(tab: TabId, language: TabLanguage): Promise<SourceResult<TabList>>;
  showTab(tab: TabId): Promise<SourceResult<TabList>>;
}
```

Domain shapes and conversions in `ipc/compareDomain.ts` (camelCase `holdsText`/`columnLimit`); the brands `TabId`,
`ColumnVersion`, `LeftLine`, `RightLine` and `nextColumnVersion` in `ipc/domain.ts` (IPC3); `Column` and `TabLanguage`
alias the generated unions. `createTauriCompareSource` (`ipc/tauriCompare.ts`) maps the eight commands;
`createFixtureCompareSource(log, search)` (`ipc/fixtureCompare.ts`, in memory) starts with one "Compare 1", `?diff=<case>`
puts `frontend/fixtures/compare/<case>.json` (written by `just fixtures` from `tests/compare/<case>/`) into tab 1, mirrors
`yamt-compare`'s tab rules, and answers a column with a case's differences only when both texts equal that case's, else
none and an `info` log `compare.fixture_miss`; both fixture sources parse through one `parsedFixture` (`ipc/fixture.ts`).

---

## 5. Frontend modules and fences

### 5.1 State ownership — the table that prevents the classic mistake

| state                                                                                                   | owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | why                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| left/right/center document text                                                                         | CodeMirror `EditorState`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | rope, transactions, undo                                                                                                                                                  |
| chunk current positions in center                                                                       | `editor/chunkField` (`StateField`), seeded from each chunk's `middle` range (the stages' base, or the disk text, plan §2 #53)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | mapped per CM1, or set as given by `placeSpans` (an action's chained final spans, CM7; undo's snapshot through `invertedEffects`)                                         |
| chunk apply status, per side (`{ local, remote }`, each `pending`/`applied`/`ignored`; plan §2 #33)     | same `StateField`: `setStatus` only in the throwaway steps of an action's chain (CM7); dispatched: wholesale by `placeSpans` (actions, undo/redo), or ignored on both sides when a user edit deletes an open block (CM8); side panes hold a read-only mirror the controller pushes after each center transaction                                                                                                                                                                                                                                                                                                  | **undo must revert status together with text**                                                                                                                            |
| left/right decorations                                                                                  | derived from the pane's fixed ranges + the mirrored status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | immutable docs                                                                                                                                                            |
| find space above line 1 (while any pane's find bar is open)                                             | `findSpace` field in every pane (`editor/internal/find.ts`), pushed by the controller each frame from "any pane's bar open"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | no history; same space in all three panes keeps them aligned (plan §2 #44)                                                                                                |
| drag over the icons: the press, the covered changes' highlight                                          | the press in `editor/internal/drag.ts` (`IconDrag`); the highlight in a side-pane field (`covered.ts`), pushed by the controller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | no history; derived from the press and the pointer each frame                                                                                                             |
| which side pane has the keyboard                                                                        | the browser's focus (CodeMirror's `cm-focused` on that pane), never copied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | an outline drawn only under it can never show where keys do not go; it hides while another app has focus (plan §2 #54)                                                    |
| each side's focused or remembered change                                                                | `sideMarks[side]` field in that side pane's own state (`editor/internal/sideMark.ts`, `SideMark` = `change{id}` \| `alone{remembered}`), set by `setMark`, moved on by the controller's `showStatuses` push when its change stops waiting                                                                                                                                                                                                                                                                                                                                                                         | no history; chunk ids are fixed, so middle edits never invalidate it (plan §2 #54)                                                                                        |
| scroll positions                                                                                        | DOM (`scrollDOM.scrollTop`), driven by `editor/scrollSync`; a far scroll that shows none of a pane's rendered lines is landed exactly by that pane's `exactScroll` (`editor/internal/exactScroll.ts`, plan §2 #82)                                                                                                                                                                                                                                                                                                                                                                                                | not state, derived                                                                                                                                                        |
| chunk rows, wave rows and scroll anchors                                                                | one cache in `editor/internal/frame.ts` (`Frame`: rows from `lineBlockAt`, each pane's wave tops from `waveStarts`, the sync's anchors), dropped by `rowsChanged`: doc change, measured heights (`geometryChanged`), statuses, either fold field; the strips move their kept nodes per frame                                                                                                                                                                                                                                                                                                                      | derived, cached (plan §2 #51)                                                                                                                                             |
| unchanged runs and which of their steps still hide                                                      | the middle's `foldField` (`editor/internal/folds.ts`), value `FoldState`: `runs` — every level of every run for all three panes, never dropped, the middle's ranges mapped through every edit — and `hiding` — per run, how many innermost levels still hide; clicks, reveals and a delete at a wave edge only lower a count (`showFolds`), the collapse toggle sets them all to 0 or back to each run's level count (`collapseSpec`, `setHiding`); each side holds only the counts (`FoldFields.sides`, `readonly number[]`) pushed by `pushFolds` when `hiding` changes, its levels rebuilt from the fixed runs | no history (the toggle carries `addToHistory.of(false)`, only `placeSpans` is snapshotted); one owner, the sides mirror counts as they mirror statuses (plan §2 #63, #68) |
| the hovered wave run                                                                                    | `Folding` (`editor/internal/folding.ts`), one listener set on the three pane hosts and both strips; toggles `fold-wave-hover` on every `[data-fold-run]` node of that run; nodes made later ask `hovered()`                                                                                                                                                                                                                                                                                                                                                                                                       | no history; pointer state only (plan §2 #63)                                                                                                                              |
| each pane's wave phase (`--fold-wave-x`, `--fold-wave-period` on the pane hosts)                        | `WavePhases` (`editor/internal/wavePhase.ts`): written on a pane-host resize or a resolution change, only when the value changed, from the scrollers' and strips' edges rounded to device pixels; removed by `destroy()`                                                                                                                                                                                                                                                                                                                                                                                          | derived from layout, never read per scroll frame (plan §2 #51, #64)                                                                                                       |
| file list, opened files, active file, the shown failure, notices about disk changes                     | `ui/store.ts` (module singleton via `useAppStore()`, no Pinia); each opened file's `MergeView` registers `{ unsaved, markSaved }` with `store.track`; the marks are git's view, re-read on window focus (plan §2 #49); `notices` (one per path) set by `ui/diskChanges.ts` from Rust's `DiskChange`s (#52)                                                                                                                                                                                                                                                                                                        | chrome only; what the disk looked like lives in Rust's `MergeSession`                                                                                                     |
| saved point per opened file (the dot)                                                                   | `MergeController`'s `SavedPoint` (`editor/internal/savedPoint.ts`): the Result's text, every change's statuses and which text was written (`fileText` or `asShown`), set at open, by each Save and by Mark resolved; `useMergeController.unsaved` follows `onUnsavedChange`; `ui/saving.ts` holds the per-file write claims and the last format outcome per file                                                                                                                                                                                                                                                  | one place decides "unsaved work" (plan §2 #37, #65, #69, #71)                                                                                                             |
| language-server problems in the Result                                                                  | `@codemirror/lint`'s field plus `problemsField` (`editor/internal/problems.ts`: each server's answer, the versions still answerable) in the middle pane; counts out through `onProblemsChange` into `useMergeController.problems`                                                                                                                                                                                                                                                                                                                                                                                 | the lsp client owns the order of answers; the editor only maps them (plan §2 #70)                                                                                         |
| language servers: specs, runs, states, logs                                                             | the app's one `LanguageServers` (`lsp/`), built in `main.ts` and held by the store; `serverViews` mirrors `views()` on `onChange` (`ui/servers.ts`); processes are Rust's `Host` (`yamt-lsp-host`); the per-repository answer, the found servers switched off per repository (`off`, plan §2 #83) and the added servers are the settings file's `languageServers`                                                                                                                                                                                                                                                 | one owner per fact; Vue holds a mirror only (plan §2 #67, #70, #83)                                                                                                       |
| servers found in this repository, the repository root                                                   | `ui/serverSetup.ts` (`found`, `root`; read as `foundServers`, `serverRoot`), written only by its detection in `startUp` (after the file list and the settings) and `refocus`; it hands `setSpecs` the found servers not switched off (`offServers`: the settings file's `off[root]`) plus the added servers and applies the answer the settings file holds; `switchServer` writes a switch and applies again                                                                                                                                                                                                      | one sequence owner and one place off is applied; the question is asked only by `startUp` and lists only the shown servers (plan §2 #70, #71, #83)                         |
| pinned language servers                                                                                 | `ServerPins` (`ui/serverPins.ts`, created by `createServerSetup`, which owns the root): `pinnedServers` for this root, changed only by `togglePin`; localStorage `yamt.servers.pinned` = { root: [server keys] }                                                                                                                                                                                                                                                                                                                                                                                                  | a window choice like #58; pins never read `off`, so a server switched on again is pinned again (plan §2 #83)                                                              |
| choice per file the editor cannot show (its sides); the side taken (choice and deleted-side text files) | `choices` shallowRef in `ui/store.ts`: set by describe, dropped and described again by reset; one `taken` map (`Taken`: by a side, or by the disk) set by `takeSide` and by a disk change that staged a choice file; a deleted-side file "resolved on disk" comes from its `middle` kind; deleted by reset                                                                                                                                                                                                                                                                                                        | the index decides "resolved"; `taken` only picks the view's line and the middle pane's content (plan §2 #36, #47, #52)                                                    |
| summary counts of the open file                                                                         | `shallowRef` in `useMergeController`, fed by `MergeController.onSummaryChange`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | per controller                                                                                                                                                            |
| what the files' grid cell shows                                                                         | `screen` shallowRef in `ui/store.ts` (`Screen` = files \| settings \| serverLog{name}): the gear (`openSettings`), "Back" (`closeSettings`, `closeServerLog`), Show log (`showServerLog`), a file picked in the list (`pick`); never by the app's own `open`                                                                                                                                                                                                                                                                                                                                                      | the files stay mounted and only hide, so their text, undo history and scroll stay (plan §2 #56, #70)                                                                      |
| the settings in use (theme, key bindings, the file's path)                                              | `settings` shallowRef in `ui/store.ts`, changed only by the replies of the four settings calls (`ui/settings.ts`), re-read on window focus with the file list; `preferences` is computed from it and handed to every opened file's controller                                                                                                                                                                                                                                                                                                                                                                     | the file is the truth (Rust `yamt-settings`); a failed call keeps the settings in use (plan §2 #57)                                                                       |
| the page's theme attribute (`<html data-theme>`) and `color-scheme`                                     | set before the first frame by the shell's start script; `main.ts` reads it as the start theme through `themeOf` (an unknown value → `dark`); afterwards written only by `useThemeAttribute()` (`ui/settingsStore.ts`, called by both roots) from the registered store's `settings.theme`, with `documentElement.style.colorScheme` from `themeKind` (plan §2 #102)                                                                                                                                                                                                                                                | one palette per theme: `style.css` `@theme` (yamt Dark) and `themes/<name>.css` (plan §2 #57, #102)                                                                       |
| each pane's dark flag and key bindings                                                                  | CodeMirror compartments in each pane, reconfigured by `MergeController.setPreferences`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | no history; the same preferences reach every opened file, shown or hidden (plan §2 #57)                                                                                   |
| toolbar buttons the user hid                                                                            | `HiddenButtons` (`ui/toolbarButtons.ts`, `storedValue` from `ui/windowStorage.ts`) held by the store: read as `hiddenButtons`, changed only by `toggleButton` from the toolbar's right-click menu; Abort merge, Undo and Redo hidden at first (`HIDDEN_AT_FIRST`, one start state per id); stored in localStorage `yamt.toolbar.hidden` as an object of the buttons the user decided (id → hidden); an array stored before #74 (hidden ids) reads as decisions for the seven ids it can name                                                                                                                      | one choice for every file, remembered across restarts; a button added later keeps its own start state until decided (plan §2 #58, #74, #1091)                             |
| whether unchanged lines collapse                                                                        | `Collapsing` (`ui/collapsing.ts`, `storedValue`) held by the store: read as `collapsing`, flipped only by `toggleCollapsing` from the toolbar's "Collapse unchanged fragments" button; stored in localStorage `yamt.collapse.unchanged`, anything but `"false"` is on; each `MergeView` passes it to `useMergeController`'s `collapsed` option, whose watch calls `setCollapsed` on every live controller                                                                                                                                                                                                         | one choice for every file, remembered across restarts; never part of `Preferences`, so re-applying preferences cannot reset shown runs (plan §2 #68)                      |
| whether the file list shows                                                                             | `fileListShown` shallowRef in `ui/store.ts`, true at every start (never stored); flipped only by the store's `fileListKey`, which `App.vue` calls from a window `keydown`: nothing on a press already handled, while a question waits, or for a key not bound to "Toggle file list" (`pressesKey`)                                                                                                                                                                                                                                                                                                                | `App.vue` hides `FileList` with `v-show`, so its width, view and closed folders survive (plan §2 #61)                                                                     |
| the file list's view (list or tree), its width and its closed folders                                   | `FileList.vue`'s own state: the view from `createFileListMode` (`ui/fileListMode.ts`, `storedValue`, localStorage `yamt.files.view`, anything but `tree` is the list); the width from `createFileListWidth` (`ui/fileListWidth.ts`, localStorage `yamt.files.width` in px, `FILE_LIST_BOUNDS` 160 px … half the window, the CSS and the clamp from the same constants; a double-click on its handle forgets it); closed folder paths in a session-only `shallowRef`, the shown file's folders opened whenever `active` changes                                                                                    | one reader and one writer, both in `FileList`; the view and the width are remembered across restarts like #58, folders are not (plan §2 #61, #84)                         |
| the three panes' split                                                                                  | `PaneSplitState` (`ui/paneSplit.ts`, `storedValue`) held by the store: `paneSplit` = Local's and Remote's shares (Result the rest), written only by `setPaneSplit` from a divider drag (`usePaneDividers`: `dragged` over the widths measured at the press) and `resetPaneSplit` from a double-click; localStorage `yamt.panes.split`, anything invalid reads as thirds                                                                                                                                                                                                                                           | one value for the window; every MergeView and ChoiceView derives its grid (`paneColumns`), no copy per file (plan §2 #84)                                                 |
| what git is doing and both panes' names                                                                 | `operation` and `sideNames` shallowRefs in `ui/store.ts`, written only by `refreshFiles` (`ui/listing.ts`) from each `listStop` reply (at start, on every focus and after every action), the one reply that also carries the files; `nextStop` (`ui/stops.ts`) on `MovedOn`                                                                                                                                                                                                                                                                                                                                       | one source: git's view now, plan §2 #85, #87; the file list's tag (`OperationLabel`, #92), both headers and the buttons read the same reply                               |
| the stop the window shows and its per-stop state                                                        | the store's `stop` token (`ui/currentStop.ts` `Stop`: `{ dropped }`), replaced only by `nextStop` (`ui/stops.ts`), which clears opened views, choices, taken sides, write claims, format notes, the stop's questions, `stopMessage` (git's message for a stop without conflicts, set only there) and lists as at start; a reply is applied only through `landed(stop, call)`                                                                                                                                                                                                                                      | one place a stop ends (plan §2 #89); a late reply from an old stop changes nothing; a `StopMovedOn` always goes there                                                     |
| whether git is running (Continue, Abort) and the two buttons                                            | `running` in `createGitRun` (`ui/gitRun.ts`), the one writer: set for the call, cleared unless the reply ends the app; `AbortState` (`ui/aborting.ts`) and `ContinueState` (`ui/continuing.ts`: noOperation \| filesLeft \| writing \| ready \| running) computed from it, the operation and the files; `MergeToolbar`/`ToolbarMenu` list them by `listedButtons(operation)` (`ui/toolbarButtons.ts`); the close guard refuses while running                                                                                                                                                                      | one owner for "git runs" (plan §2 #88, #89); a success that ends the app keeps it `running` while Rust ends the window                                                    |
| disk versions across the stops of one run                                                               | Rust: `MergeSession.first_disk_version` (from `open_after(root, highest)`), `Merge::MovedOn.highest_disk_version` in `src-tauri/src/merge.rs`; a write below the session's first version answers `StopMovedOn`                                                                                                                                                                                                                                                                                                                                                                                                    | versions never repeat within a run, so an old stop's write never lands on the next stop's file (#1383)                                                                    |
| whether the minimap shows (Alt held)                                                                    | `useAltHold()` (`ui/altHold.ts`), one instance in `App.vue`: a `shallowRef` set by Alt's own key press and cleared by its release, another key, window blur, the page hidden or a key/pointer event reporting Alt up (`heldAfter`, pure); pointer listeners exist only while held; never stored. `App.vue` passes it to every `MergeView` as `minimap`; MergeView hands `shown && minimap` and the Result shown as text (`showsMinimap`, the rule `centerLine` also uses) to `useMergeController`'s `minimap` option → `MergeOptions.minimap` / `showMinimap` (plan §2 #80 hold, #81)                             | one window-wide fact, one writer; hidden files never get it, so they compute nothing                                                                                      |
| the Result's minimap (code tiles, slider, edge marks)                                                   | `Minimap` (`editor/internal/minimap.ts`), owned by `Frame`: one `.minimap` box in the right pane's `view.dom`, `display: none` while not shown; code rows in `MinimapTiles` (128 rows each) dropped by `staleTiles` and outside the window, all dropped while hidden; slider and canvas window from `minimapLayout` per frame while shown; edge marks from `Frame`'s rows and the Result's diagnostics, dropped when rows move or problems arrive; theme colours read when shown or after the dark flag changed; no history (plan §2 #81)                                                                         | derived from the one geometry cache, the one tint rule (`paneTone`) and the one syntax table (`SYNTAX_COLOURS`); nothing to keep                                          |

The compare window (`yamt --diff`, plan §2 #93–#97) has its own rows:

| state                                                                           | owner                                                                                                                                                                                                     | why                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| each column's text while its tab is mounted                                     | that column's CodeMirror `EditorState` (`CompareController`); Vue never holds it: a column's text passes once, from `settled`/`settleNow` into `saveColumn` → `setColumn`                                 | as the merge window's documents                      |
| the stored copy of every tab's texts, the tab list, names, languages, shown tab | Rust `yamt-compare` `TabStore` (`<data_dir>/yamt/compare/`, `CompareState = Mutex<TabStore>`); the window's `tabs`/`shown` in `ui/compareStore.ts` are written only from its replies                      | survives a restart, a crash and a kill (plan §2 #97) |
| each column's version, the columns edited since their last send                 | `Settle` (`editor/internal/compareSettle.ts`), from the versions `loadTab` returned; Rust stores a column only for a higher version, `showComparison` applies a reply only when both versions are current | a late reply never tints changed text (plan §2 #95)  |
| the differences shown                                                           | each column's `differenceField` (`editor/internal/compareFields.ts`): set by a reply, mapped through edits until the next                                                                                 | built once per reply, never per key (plan §2 #96)    |
| Auto's finding per tab                                                          | the controller (`compareLanguage.ts`), reported through `detected` to `compareStore.detected` (names only)                                                                                                | the toolbar's "Auto · JSON"                          |
| the compare window's notices, problem, question, screen, tab panel shown        | `ui/compareStore.ts` + `ui/compareNotices.ts` (notices), `fileListKey` the one writer of `fileListShown`; settings through the seam `ui/settingsStore.ts`, which the merge store registers too            | one store per root (plan §2 #94)                     |

The window's storage is read and written in one way, `storedValue(key, fallback, { read, write }, warnEvent)`
(`ui/windowStorage.ts`): synchronous writes, defaults never written, failures logged under the caller's event.

Rule: **Vue state never holds an `EditorView`, a position, or document text.** The text to write passes through
once, from `snapshot().fileText()` or `asShown()` to `source.saveFile`/`finishFile` (`ui/saving.ts`), and the written
snapshot then marks its own saved point (`markSaved`).

### 5.2 `editor/` — public surface is one class

```ts
export class MergeController {
  constructor(data: FileMergeData, hosts: MergeHosts, options: MergeOptions); // left, center, right + strips: [SVGSVGElement, SVGSVGElement]; MergeOptions = { readOnly (plan §2 #47), preferences, collapsed (plan §2 #68), minimap (the Result's minimap shown at build, plan §2 #81), servers: LanguageServers | null (plan §2 #70) }
  setPreferences(preferences: Preferences): void; // Preferences = { theme, keys: KeyBindings }: reconfigures the theme compartment (dark flag from `themeKind`, the `themeName` facet the minimap redraws on) and the side, find and middle keymaps in all three panes (plan §2 #57, #102)
  setCollapsed(on: boolean): void; // the collapse toggle: off shows every hidden line, on hides every run back to its start; keeps the middle's top line, re-aligns the sides at once; not in history (plan §2 #68)
  showMinimap(shown: boolean): void; // the Result's minimap while Alt is held: shown paints in the next frame, hidden takes it out of layout and drops its tiles (plan §2 #81)
  applyAllNonConflicting(side: Side): void; // one undo step
  undo(): boolean;
  redo(): boolean;
  historyKey(event: KeyboardEvent): boolean; // the bound Undo/Redo keys (default Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y) from anywhere in the shown file's window, unless already handled (the middle's own keymap) or typed in a text field (plan §2 #54, #57)
  moveToChange(direction: Direction): void; // the toolbar arrows: Up/Down on the side that has the keyboard, else the left side takes it first (plan §2 #56)
  snapshot(): ResultSnapshot; // { asShown(), fileText() (what Save writes: git's markers for waiting conflicts, #69), unsaved, markSaved("asShown" | "fileText") } — state.sliceDoc()/state.lineBreak, NEVER doc.toString()
  onUnsavedChange(listener: (unsaved: boolean) => void): void; // the dot (#65)
  format(): Promise<FormatOutcome>; // the formatter's answer as paired line edits, one `yamt.format` undo step; never touches a change that still waits or its edge lines (#70/#71); never rejects
  problems(): ProblemCounts; // { errors, warnings, other } in the Result
  onProblemsChange(listener: (counts: ProblemCounts) => void): void;
  summary(): MergeSummary; // { changes, conflicts, remembered }: still to decide; a remembered conflict (rerere, plan §2 #90) counted apart
  onSummaryChange(listener: (s: MergeSummary) => void): void;
  destroy(): void;
}
```

The compare window's class (plan §2 #96), `editor/compare.ts`, beside it:

```ts
export class CompareController {
  constructor(texts: TabTexts, hosts: CompareHosts, options: CompareOptions, events: CompareEvents); // hosts { left, right, strip }; options { preferences, language: TabLanguage, columnLimit }; events { settled(columns), detected(language | null), refused(column) }
  showComparison(comparison: Comparison): boolean; // false = versions not current, dropped
  setLanguage(language: TabLanguage): void; // both columns
  setPreferences(preferences: Preferences): void;
  formatLanguage(): "JSON" | "XML" | null; // the pick, else Auto's finding; null = Format disabled
  format(): FormatReport; // per column formatted | unchanged | failed { message, line }; one `yamt.format` whole-document replace each
  moveToChange(direction: Direction): void; // the toolbar arrows, no wrap
  historyKey(event: KeyboardEvent): boolean; // undo/redo in the column that has the keyboard
  holdsText(): boolean;
  settleNow(): readonly ColumnText[]; // the unsent columns (close, tab close)
  destroy(): void;
}
```

Two `"center"` panes (own history, keymap, find, theme and language compartments), one strip of bands (`CompareStrip`,
the same `placedBand` rule as the merge strips), the locked scroll through the generalised `ScrollSync<P>`, the colours
from `changeTone` (WebStorm's 2-way rule). Format and Auto are the pure scanners of plan §2 #98.

Per-change apply/ignore is internal: its callers are the icons in the strips (a click or a drag over
several, plan §2 #45; with Ctrl/Cmd both sides of a conflict, #55), Ctrl/Cmd+click and
Ctrl/Cmd+right-click on a side change (#46, #55) and the side-pane keys (#54).

Internals (`editor/internal/`, not importable from `ui/`):

- `pane.ts` — shared extensions (bundled font theme, line numbers, Lezer highlight from `syntax.ts` with the
  language compartment, the theme compartment — CodeMirror's dark flag from `themeKind` and the `themeName` facet,
  plan §2 #102 —, `EditorState.lineSeparator` for CRLF, a highest-precedence selection mark
  so selected text shows over block tints and word marks), `readOnly` + `editable(false)` for
  sides (focusable through `tabindex` so find works), `history()` and Tab / Shift+Tab
  (`indentWithTab`) for center only, with the indent unit guessed from the starting text by
  `indent.ts` (plan §2 #35); the center also gets `readOnly` in the controller's read-only mode
  (plan §2 #47); the find bar in every pane.
- `language.ts` — the file's language from its base name via `@codemirror/language-data` (plan §2 #29).
- `chunkField.ts` — the center `StateField` + effects described above (CM1, CM2, CM8).
- `status.ts`, `apply.ts` — every status rule (a side still open, resolved, append or replace,
  status after apply / ignore, whether a Ctrl/Cmd click also decides the other side:
  `decidesOtherSide`; plan §2 #33, #55) and the steps for apply, ignore and bulk apply, sent one
  dispatch each through `dispatchSteps`: (1) a cursor move to the block (bulk: to the first visible
  line, only if the cursor is off screen), outside history, no scroll — undo returns there; (2) the
  action: each side decision built on the document the previous one produced (`chainedChanges`,
  CM7; a Ctrl/Cmd decision on a conflict adds the opposite decision on the other side while it
  waits, `Reach`), composed into one ChangeSet with the chain's final spans as `placeSpans`; (3) the
  same cursor again as a selection step history records — redo returns there, and typing right
  after an apply starts its own undo step. After a strip action or a Ctrl/Cmd click the middle pane
  takes focus only when no pane has it (a side holding the keyboard keeps it, plan §2 #54), without
  scrolling.
- `decorations.ts`, `side.ts`, `tone.ts`, `sideStatus.ts` — line colours per tone and status; one
  rule per side pane (that side still open) decides which blocks are tinted and feeds the line
  bands, the word marks and the removal bars; the middle pane draws bands only, until both sides
  are handled (plan §2 #31, #33). `tone.ts` `paneTone(chunk, status, pane)` is that one tint rule for
  bands, strips and the minimap's right edge. `sideStatus.ts` `pushStatuses` sends the middle's statuses
  to both sides (`showStatuses`) when one changed.
- `minimap.ts` + `minimapLayout.ts`, `minimapGlyphs.ts`, `minimapPixels.ts`, `minimapRows.ts`, `minimapTiles.ts`,
  `minimapMarks.ts`, `minimapPointer.ts` — the Result's minimap while Alt is held (plan §2 #81). `Minimap`, owned
  by `Frame`, keeps one `.minimap` box (a `<canvas>` and a `.minimap-slider`) in the right pane's `view.dom`
  (outside `scrollDOM`/`contentDOM`, so no pane handler sees its presses), `display: none` while not shown, and
  then does nothing. While shown it paints in `Frame`'s frame after `ScrollSync.sync`: `minimapLayout` (pure,
  VS Code's proportional `MinimapLayout.create`, the find space as top padding; `rowOfTop`/`topOfRow` the one
  row rule, `canvasHeight` the one canvas size) places the slider every frame; the canvas is redrawn only when
  its window, padding rows, size, tiles or edges changed. Code rows come from `MinimapTiles` (128 Result rows
  per detached canvas, dropped by `staleTiles` — document, folds, theme, language, parse growth — and when
  outside the window), each row painted by `minimapPixels.ts` (VS Code's prebaked glyphs from `minimapGlyphs.ts`,
  copied with its MIT notice) in the colours `minimapRows.ts` reads from the syntax tree through `syntax.ts`
  `syntaxColourClasses` (the one code-colour table the pane's highlight is built from: Lezer tags → 39
  `--color-syntax-*` tokens and their font-style variables, containers before inner tokens, the minimap taking the
  token latest in the table as the text's CSS does, plan §2 #102) and from the theme (`readLook`, only when shown or
  after the `themeName` facet changed, two dark themes included); a collapsed run is one row in the wave colour.
  `minimapMarks.ts` gives the edges: the Result's errors over warnings on the left, every change `paneTone(…,
  "center")` still tints on the right, 4 CSS px wide, never under 4 tall; dropped when the rows move or problems
  arrive. `MinimapPointer` takes the presses: `mousedown` prevented and stopped (focus and selection stay), a
  press on a row puts its line in the middle (`centredScrollTop`, VS Code's `'mouse'` reveal), a slider drag
  scrolls by `draggedScrollTop`, a wheel scrolls the Result; each then `ScrollSync.follow("center")`; hiding ends
  a drag.
- `words.ts` — side-pane word marks and removal bars (`RemovalPoint` widgets: zero width, a bright
  bar where the side removed text, carrying that text; `removalAt` reads it back) from `chunk.words`
  (plan §2 #30, #31). `removalTooltip.ts` shows a bar's text on hover (`hoverTooltip`, only while the
  bar itself is hovered, closed when the bar goes; tooltips in `document.body` on every pane), what it
  shows decided by the pure `removalText.ts` (plan §2 #73).
- `geometry.ts` (where each chunk sits in each pane, each run's wave top per pane — `waveRows` — and
  `STRIP_PANES`, the two panes each strip sits between), `gap.ts` (what a strip shows: the bands that
  cross it, the wave joins of runs both its panes fold — `wavePaints` —, each open change's icon row in
  document space, its hover titles — with the Ctrl/⌘+click line while the click also decides the other
  side, plan §2 #55 — and whether a drawn row can be kept, `keepsArrowRow`), `strips.ts` (keeps the
  nodes of what is in the strip — bands, wave joins with a wide transparent hit path, icon rows, one
  keyed scheme `dropMissing` — and moves them per frame), `stripIcons.ts` (builds an icon row) — bands,
  wave joins and the apply/ignore buttons in the two `<svg>` strips (SVG groups at the side pane's
  edge; a CodeMirror gutter on the inner edge missed clicks in WebKit). Icons are Lucide SVG markup
  imported as strings (`~icons/lucide/<name>?raw`), parsed once and cloned per button (plan §2 #34);
  the apply button turns into "add below" while the other side is applied. A button press only starts
  a press; none are drawn in read-only mode (the wave joins are).
- `drag.ts`, `covered.ts` — the press and drag over the icons (plan §2 #45): pointer capture on the
  persistent `<svg>` strips (a button row exists only while it is in the strip and its side is open;
  its position is updated per frame), the changes covered between the press
  and the pointer, highlighted through a side-pane effect outside history; release sends one
  `ChunkAction` with every covered chunk, and Ctrl/Cmd held at release decides both sides of each
  covered conflict (#55), one undo step (CM7).
- `modClick.ts` — what Ctrl/Cmd means with the mouse (`isModHeld`, the key's name for hints) and
  Ctrl/Cmd+click / Ctrl/Cmd+right-click on a waiting change in a side pane, found by the same hit
  test as a plain press (`changeAt`): apply / ignore that side (plan §2 #46, #55); the right-click
  opens no menu.
- `find.ts` — the find bar of each pane on `@codemirror/search` (plan §2 #44): our panel floating over
  the pane's top right (it never resizes the scroller, so scroll sync is untouched), the count
  ("k of N" / "N results" / "No results"), next/previous with wrap; while any pane's bar is open all
  three panes get the bar's height as space above line 1 (`findSpace`), so a match on line 1 shows
  below the bar and the panes stay aligned. Its keys are the bound Find / Find next / Find previous /
  Close find (the Close button's title names the bound key); the box's own Enter / Shift+Enter stay.
  `findMatch.ts` holds the match helpers (count, label, step, select).
- `keys.ts` (`cmKey`: a `Key` from `ipc/keys.ts` → CodeMirror's key string; Shift+letter alone is
  the upper-case name; a macOS-only ⌃ key is not bound on Linux) and `sideKeys.ts` (the side
  keymap from the bound Apply / Ignore / Next / Previous / Left / Right keys): every keymap of the
  three panes sits in a compartment, with the dark flag, and `setPreferences` reconfigures them
  (plan §2 #57). The middle's yamt keymap (Undo, Redo, Indent, Outdent) is `Prec.high` over
  `defaultKeymap`; of `historyKeymap` only the selection undo/redo stays.
- `navigation.ts`, `sideMark.ts`, `sideFocus.ts`, `viewport.ts`, `wheel.ts`, `historyKey.ts` — keyboard
  focus in the side panes (plan §2 #54). `navigation.ts` holds the rules as pure functions over the
  chunk states and rows (step to the next/previous change still waiting on a side, cross to the other
  side, the pick after a decision, the first change on screen, the click hit test, and what follows a
  decision: hand over when it emptied the focused side, otherwise reveal a newly focused change, otherwise
  stay). `sideMark.ts` is each side's `SideMark` field. `sideFocus.ts`
  binds the side keymap (`sideKeys.ts`; defaults Enter/Space apply, Backspace/Delete/x ignore, arrows), the press that
  sets a mark (scrollbar presses excluded; a press `modClick.ts` acts on is skipped by asking its
  `modClickAction`), the focus WebKit gives a side's scroller on a scrollbar press handed back to its
  content, Ctrl/Cmd+wheel over a side and the toolbar arrows (`moveToChange`: both take the keyboard
  for the side first when it lacks it, the arrows choosing the left when no side has it, plan §2 #56),
  and the reveal: only the
  focused side's `scrollTop` is written, with WebStorm's placement from `viewport.ts`
  (`SyncScrollSupport.getTargetOffsets`), nothing when the change is fully visible; the other panes
  follow through the sync. `wheel.ts` turns wheel bursts into steps (the first event of a burst steps
  at once, then one per 90 px — under one 96 px X11 notch). `historyKey.ts` asks `pressesKey`
  (`ipc/keys.ts`, the one "is this press one of these keys" match, shared with the store's file-list
  key, #61) for the bound Undo/Redo keys; `keyOfEvent` falls back to the physical key only when
  the layout gives a single non-Latin letter or combining mark; `ui/MergeView.vue` calls `historyKey`
  from a window `keydown` only while its file is shown and no question is open.
- `scrollSync.ts` — one pure function `targets(anchors, source, y)` using piecewise-linear
  interpolation between chunk anchor pixel positions (`lineBlockAt`), reference point the middle
  of the viewport. Swapping to chunk-anchored hold later = replacing this one function (plan
  decision #12). Re-entrancy: the follower panes written by a sync ignore their echo for one
  frame; a source whose `scrollTop` did not change does not re-sync, unless `follow(pane)` asked the
  next sync to write the others anyway (`Frame.realign`, after the collapse toggle, plan §2 #68).
- `foldRuns.ts`, `folds.ts`, `foldSelection.ts`, `foldView.ts`, `folding.ts`, `wavePhase.ts` —
  collapsed unchanged lines (plan §2 #63, #64, #68). `foldRuns.ts` is WebStorm's `FoldingBuilderBase`
  as one pure function: every run outside the changes, per pane, with up to three nested levels
  keeping 4, 8, 16 lines next to each change (`Fold`, `FoldLevel` = one range or none per pane,
  `displayed`). `folds.ts` holds the middle's `foldField` (`FoldState`: every level mapped, plus the
  steps still hiding per run; `showFolds` only ever shows; `collapseSpec` turns collapsing off or back
  on to every run's start), the sides' count mirror (`FoldFields`, `pushFolds`, `sideFoldPush`, which
  also moves a side's cursor out of lines that get hidden), the reveal of a selection on hidden lines
  (a side's through `sideReveals` to the middle), the delete filter (`waveDeletes`: a delete from a
  cursor that would remove a hidden character shows the next step instead) and `waveStarts` (each
  pane's displayed wave starts, the one reader the frame uses). `foldSelection.ts` is pure: `revealKeep`
  (which levels a selection strictly inside hidden lines opens) and `leaveHidden`/`leaveAllHidden`
  (IntelliJ's `onFoldProcessingEnd`: a cursor inside lines that get hidden moves to the wave line's
  start, a selection with an end inside is dropped). `foldView.ts` draws a run as one inline
  `Decoration.replace` over whole lines — not `block: true`, whose widgets the arrow keys skip — that is
  also the atomic range, and the wave as a line-number gutter marker spanning the visible pane (a CSS
  mask of one 64-wave `waveTile(64)`, positioned and sized by the pane's phase properties); `Folds`
  wires both fields, the views, `Folding` and `WavePhases` for the controller and runs the toggle
  (`setCollapsed`: one transaction with a `scrollSnapshot` of the middle). `folding.ts` is the one
  pointer owner over the five hosts (hover, a click shows the next step, presses on a wave keep the
  keyboard where it was). `wavePhase.ts` pins each pane's wave at the strips' `<svg>` edges (WebStorm's
  start phase: out of a pane on the centre line heading down, into one heading up; the middle
  stretched to k+½ waves): `layoutOf` reads the scrollers' and strips' edges rounded to device pixels,
  `paneEnds`/`panePhases` turn them into phases through `STRIP_PANES`, `WavePhases` is one
  `ResizeObserver` on the pane hosts plus a `matchMedia` resolution listener writing two custom
  properties.
- `frame.ts` — the once-per-frame paint (`Frame`): find space, the layout cache, scroll sync, the
  covered highlight, the strips and the minimap (`Minimap`, `showMinimap`); moved out of
  `index.ts`. `paneDocs.ts` builds the three `Text`s once with the file's line separator (the views,
  the runs and the tests use them); `docPos.ts` is the `DocPos` brand (chunk spans and hidden ranges).
- `cutOnce.ts` — every pane takes one `cut` event per task: WebKitGTK 2.54 runs its Cut command twice
  for one Ctrl+X on an empty selection (two `cut` events inside the keydown's task), which cut two
  lines and defeated the wave line's delete filter (#849). The gate reopens on a 0 ms timer, so it
  needs no `keydown` and separate presses cut again.
- `exactScroll.ts` — every pane lands a far scroll where it was sent (plan §2 #82): WebKitGTK 2.54 pulls back a
  `scrollTop` that shows none of the rendered lines while CodeMirror swaps its viewport in its scroll handler
  (#1240). The pure `farTop` decides from the visible span and the rendered lines' span; then a CodeMirror scroll
  request with a `scrollHandler` writes that exact `scrollTop` after CodeMirror has rendered the target. Callers
  keep writing `scrollTop`.

### 5.3 `connectors/` — pure geometry

```ts
export type Span = { readonly top: number; readonly bottom: number }; // px from the strip's top; top === bottom is an insertion point
export type Band = { readonly left: Span; readonly right: Span };
export function bandPath(band: Band, width: number): string; // closed path, cubic top/bottom edges, control points at width / 2
export function waveTile(periods: number): string; // `periods` 20×8 periods of the unchanged-lines wave as one stroke (plan §2 #63): four quadratic quarter-curves each, step 5, half-height 3
export function waveCenterY(lineHeight: number): number; // the wave's centre in a line: 10 for 20 px
export function waveJoinPath(join: { left: number; right: number }, width: number): string; // WebStorm's drawConnectorLine: a wave when level (slope < 0.2), an S-curve otherwise
export type WaveEnds =
  | { kind: "leaves"; at }
  | { kind: "enters"; at }
  | { kind: "through"; enters; leaves }; // where a pane meets its strips
export function wavePhase(waveLeft: number, ends: WaveEnds): WavePhase; // { offset, period } of a pane's mask (plan §2 #64): on the centre line heading down at a strip it leaves into (WAVE_DOWN_X = 5), heading up where it enters (WAVE_UP_X = 15); "through" stretches to k+½ waves, the period rounded so MASK_PERIODS (64) waves are whole CSS px, pinned at the middle of the span
// WAVE_STROKE_PX = 1, WAVE_HOVER_STROKE_PX = 2: the wave's strokes in the panes and the strips
```

`editor/internal/geometry.ts` turns chunk ranges into `Span`s and each run's displayed wave into a top
(via `lineBlockAt`); `Frame` caches these rows with the scroll sync's anchors until the document, the
measured heights, the statuses or the fold steps change (plan §2 #51). `editor/internal/gap.ts` picks
the bands and wave joins that cross each strip and the open changes' icon rows; `editor/internal/strips.ts`
places them, keeps the nodes of what is in the strip and moves them once per animation frame, after any
pane scroll, center edit or geometry change. Each strip is its own compositing layer (plan §2 #51).
`connectors/` is unit-tested on numbers, no DOM.

### 5.3b `lsp/` — yamt's own language-server client

Framework-free like `editor/` (PM3); imports only `ipc/` (the `ServerHost` interface and its generated types); the
editor and the chrome reach it only through `lsp/index.ts` (plan §2 #70, #71).

```ts
export class LanguageServers {
  constructor(host: ServerHost | null, timers?: Timers); // null in fixture mode: every server "Runs only in the app"
  setSpecs(specs: readonly ServerSpec[], options: { startOnOpen: boolean }): void; // reconciles: an unchanged spec keeps its run
  start(name) / stop(name) / restart(name); haltAll(): void; // halts every run, none counts as stopped by the user
  views(): readonly ServerView[]; log(name): readonly LogLine[]; // last 2,000 lines
  onChange(listener): () => void; serving(path): boolean; open(doc: ResultDocument): OpenDocument; destroy(): Promise<void>;
}
export function detect(paths, lookups, root): Promise<readonly ServerSpec[]>; // lookups: the host's findProgram/projectFiles; every preset per project of its ecosystem; install hints
export function addedSpecs(added, taken, root): readonly ServerSpec[]; // a hand-added server matching a preset's command gets its rules
export function presetChoices(): readonly PresetChoice[]; // Settings' "From the list": each preset's server command and file types
```

- **One server** (`internal/server.ts`): its run is one sum type (`run.ts`: idle, launching, starting, running,
  halting) — the only answer to "is it running"; one process run (`attempt.ts`) routes its messages; `handshake.ts`
  sends `initialize` (processId, rootUri and one workspace folder = the project, `positionEncodings: utf-16`) and keeps
  the `Capabilities`; `connection.ts` owns request ids and time-outs; server requests are answered from one table
  (`answers.ts`: configuration from the spec, file watching accepted and ignored).
- **Documents** (`documents.ts`, `serverDocs.ts`): every opened editable Result is open on every server that serves
  it (extension and project folder, `spec.ts`), synced as full text 300 ms after typing stops; `problems.ts`
  (`DocProblems`) puts pushed and pulled problems into one slot per server and never shows an answer older than the
  last one shown.
- **Formatting** (`formatting.ts`): the first running spec that may format and offers it; 5 s in total; the edits are
  applied to the text sent (`edits.ts`) and handed back as `{ sent, result }` — the editor turns them into its own line
  diff (`editor/internal/format.ts`).
- **Detection** (plan §2 #72; pure over the host's `findProgram` and `projectFiles`): `ecosystems.ts` is the one table of
  ecosystems (node, python, rust, go, php, clang) — each one's project rule (the nearest manifest; a Cargo workspace, a
  `go.work`, `build/compile_commands.json`) and its `ProgramFolders` (`node_modules/.bin`; `.venv`/`venv`; `vendor/bin`;
  home `go/bin`, `.cargo/bin`, `.local/bin`, Composer's) — and the only folder walking; a path joins only the
  ecosystems with a preset serving its file type. `presets.ts` is the one tool table (formatters first; Deno and
  bash-language-server list-only) in the vocabulary of `tool.ts`; `candidates.ts` names every file detection reads;
  `project.ts` answers per project (files, program lookups, nearest file); `install.ts` builds the `InstallHint` sum
  (node with its package manager, python with uv/Poetry/PDM from the lock file, rustup, go, download, system);
  `integrations.ts` turns Phpactor's PHPStan, Psalm, PHP-CS-Fixer and phpcs on from the project's own tool and config;
  `vue.ts` adds `@vue/typescript-plugin` to a TypeScript 5/6 server, or a "Vue" spec to install it, or a note for
  TypeScript 7; `choices.ts` lists each preset's server for Settings; `added.ts` matches hand-added servers to presets
  and looks for their programs in every ecosystem's folders. A found preset server carries `help`, its install hint,
  for when it exits while starting.
- **Rust side**: `yamt-lsp-host` (§3.5) starts the programs, frames `Content-Length` messages and stops them; it never
  parses a message and never learns a server's or an ecosystem's name: the window passes the folders to search.

### 5.4 `ui/` — Vue 3

Components: `App.vue`, `FileList.vue` (the file list panel: its width — dragged on its handle, remembered through
`fileListWidth.ts`, a double-click back to 240 px, plan §2 #84 — the "View as tree/list" button,
the flat list — paths, `FileMark.vue`'s mark (resolved, or "remembered", plan §2 #90), vscode-icons — or `FileTree.vue`'s rows built by the pure
`fileTree.ts` (`treeRows`: folders first, natural order, compact folder chains; `revealed`: the closed
set without the shown file's folders, the same set when nothing opens), folder icons from
`folderIcon.ts` (`folderIcon(path, open)`), both icon tables over `iconTable.ts` (rows of an icon and
its space-separated names; `nameKey`: a path's last segment in lower case), plan §2 #61), `MergeView.vue`
(toolbar + three `<div>` hosts + two `<svg>`, each in a bordered wrapper on its own compositing layer;
its grid from the window's one split (`paneColumns`), the header cell above each strip a `PaneDivider.vue` and the strip
wrapper the same divider (`usePaneDividers`), plan §2 #84;
one per opened file, inactive ones `invisible` plus `content-visibility: hidden` — no layout or
paint, editors, scroll positions and work kept, plan §2 #51;
creates its `MergeController` through `useMergeController`, which recreates it when the file's
data object changes and destroys it with the component), `PaneDivider.vue` (one pane divider: separator role, its name
per side, `ResizeDots.vue`'s three dots; MergeView's header cells and ChoiceView's gutters), `MergeToolbar.vue` (Continue right after "Mark
resolved" — shown at first, labelled per operation, ready once every file is resolved, #89 —, then Abort — hidden at first,
shown from the right-click menu, both listed only while git records an operation, disabled while git runs; Abort asks once,
naming what is lost, #74/#88 —, previous/next change
arrows that keep the side's keyboard on a pointer press, the "Collapse unchanged fragments" toggle —
`aria-pressed` while on, keeps the keyboard too, #68 —, bulk apply left/right, undo/redo — hidden
at first, shown from the right-click menu, #58 —, counts, finish, reset — `MergeView` calls the store's
`finish`/`reset`), `OperationLabel.vue` (the gray tag at the bottom of `FileList.vue`: `MERGE`, `REBASE`, `CHERRY-PICK`, …; its own tooltip, open the moment the pointer is on it, no `title`: what git applies onto what, how far, the commit message, plan §2 #92, #100),
`OperationButtons.vue` (Continue and Abort where no toolbar is: choice, deleted-side and empty-stop header rows),
`StopView.vue` (the merge area for a stop without conflicts, with git's message, #89), `SettingsButton.vue` (the gear at the
right end of every file's header row: toolbar, read-only header, choice header), `SettingsView.vue`
(the settings screen in the files' grid cell: a centred column with "Back", then Theme (five labelled groups from
`themeRows()` — yamt, WebStorm, VS Code, Zed, Atom — each its Dark and Light, one pressed across all, plan §2 #102),
Antialiasing (Subpixel/Greyscale, Linux only by `showsAntialiasing`, applied at the next start, #60),
Keymap and the settings file field with Use/Default; keyboard to "Back" on open and back to its
opener on "Back", plan §2 #56, #57), `ChoiceButtons.vue` (one pressed-choice button group: Theme and
Antialiasing), `KeymapList.vue` (the actions' rows by group with their key
labels, WebStorm's Keymap edit menu per row), `PresetPicker.vue` (Settings → Language servers → "From the list":
`presetChoices()` fills Command and File types through `addedServerFields`, plan §2 #72; its drop-down, the key
list's row menus and the "Servers" drop-down share `useDropdownMenu.ts`, which also closes on window blur),
`LanguageServerSettings.vue` (this repository's answer; a `role="switch"` button per found server, its state only from
the settings file's `off`, plan §2 #83; the servers added by hand), `ServerStatus.vue` and `ServerGroup.vue` (left of
the gear in all three header rows: the counts, the format note, the pinned servers' own buttons, then one "Servers"
button with the most urgent dot whose drop-down holds a row and a pin per shown server; a row opens that server's
`ServerMenu.vue` in the list's place, plan §2 #71, #83) and `KeyRecorder.vue` (WebStorm's Keyboard Shortcut
dialog: records a key, a "+" menu for Enter/Escape/Tab/Shift+Tab, a live "Already used by" line),
`ToolbarMenu.vue` (the toolbar's right-click menu: one check per icon button of `listedButtons` — `TOOLBAR_BUTTONS`
order, Abort merge only while git has a merge to abort —, toggles through the store, teleported to the body and placed by
`menuPosition.ts`; closes on Escape, another key, a press elsewhere, a choice or window blur, never moving the keyboard,
plan §2 #58); `altHold.ts` (`useAltHold`, called once by `App.vue`: whether Alt is held for the minimap,
the pure `heldAfter` rule, plan §2 #80, #81),
`ProblemBar.vue` (failures, words from `problemText.ts`; the `Problem` vocabulary, `attempt` and
`report` — log it and show it — in `problem.ts`), `QuestionDialog.vue` ("Unprocessed Changes" / "Cancel File Merge", words and
decisions in `question.ts`), `ChoiceView.vue` (two-button choice for a file the editor cannot show,
one sentence per side from `choiceText.ts`, plan §2 #36; its three columns on the same split, its 1 px gutters the
dividers, #84). Names are multi-word (the Vue linter's
`multi-word-component-names`; `App` exempt).

`store.ts` — one module-level singleton, reached through a composable, never provide/inject:
`createAppStore(source, startTheme, servers, host)` once in `main.ts` (then `startUp`), `useAppStore()` in components; state: the file list,
the opened files (each loaded once per session; reset replaces it in place), the choices (one per
opened file the editor cannot show), the active path, the problem, the open question, whether
settings show, and the settings in use (`settings`, `preferences`); actions: load the list, open (a later open wins; re-clicking the shown file does
nothing; a file the editor cannot show is described instead of loaded), pick (a file chosen in the
list: closes settings, then opens), finish (asks when work is left), take a side, reset, open/close
settings, toggle a toolbar button (the hidden set lives in `toolbarButtons.ts`, persisted), toggle
collapsing (`collapsing.ts`, persisted), the
window-close check, and the settings actions in `settings.ts` (load on mount and on window focus,
set the theme, add/change/remove/remove all/reset an action's keys, move the file; each sends the
settings in use and adopts the reply; a failure keeps them). `keymapEdit.ts` holds the pure key-edit
rules (a key another action holds → the "Key Already in Use" question, Move/Cancel; a list equal to
the defaults is sent as `null`); `keyText.ts` the actions' names, places and groups, and the words
built from data: the Keymap edit menu (`keymapMenu`), the "+" menu (`setKeyMenu`) and the conflict
line (`usedByText`). `keymapEdit.ts` also owns `keyOwners` (which other actions hold a key), used by
the clash question and the dialog's live warning; `menuKeys.ts` (`stepMenuItem`) is the one keyboard
rule of both menus; `keyField.ts` (`fieldKey`) decides what a key does in the dialog's field, after
WebStorm's `ShortcutTextField`.

The Vue↔editor seam is one adaptable composable:

```ts
export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: MergeHosts,
  options: {
    readOnly: MaybeRefOrGetter<boolean>; // MergeView's one rule: deleted side or a middle that is not text on disk
    preferences: MaybeRefOrGetter<Preferences>; // the store's; a change reaches the controller through setPreferences, no rebuild (plan §2 #57)
    collapsed: MaybeRefOrGetter<boolean>; // the store's collapse toggle; read when a controller is built, a change reaches every live one through setCollapsed (never through Preferences, plan §2 #68)
    minimap: MaybeRefOrGetter<boolean>; // MergeView's `shown && minimap` and the Result shown as text (Alt held, `ui/altHold.ts`); read when a controller is built, a change reaches it through showMinimap, no rebuild (plan §2 #81)
  },
): {
  summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting;
  undo;
  redo;
  historyKey; // MergeView's window keydown, only while its file is shown and no question is open (plan §2 #54)
  moveToChange; // the toolbar arrows (plan §2 #56)
  resultText;
};
```

It creates/destroys the non-reactive `MergeController` in a `watch(toRef(data), readOnly)`, pipes
`onSummaryChange` into a `shallowRef`, and is the merge root's only place `editor/` is imported from `ui/` (the compare
root's is `useCompareController.ts`).

**The compare window's root** (`yamt --diff`, plan §2 #94; fence PM7: these files never import `store.ts`, `App.vue` or
`lsp/`): `main.ts` mounts `CompareApp.vue` instead of `App.vue` when `<html data-window="compare">` (app) or `?diff`
(fixture), with `ui/compareStore.ts` (`createCompareStore(source, startTheme)`, `useCompareStore()`; tabs and the shown
tab mirrored from Rust's replies, column sends with `track`/`flushAll`, the close question, `fileListKey`, notices
through `ui/compareNotices.ts`, words in `ui/compareText.ts`, the visited tabs in `visited`) and no `LanguageServers`.
`CompareApp.vue`: `CompareTabList.vue` in the file list's place ("+", rows with the name and `languageLabel`, × with
the close question, rename by double-click; its width, drag and dots through `usePanelWidth.ts` and `PanelWidthHandle.vue`,
shared with `FileList.vue` and its stored width), one `CompareView.vue` per visited tab (inside `PaneFrame.vue`, the view
shell `MergeView.vue` uses too; unmounted on close: Format, `CompareLanguagePicker.vue`, the change arrows and the gear;
"Left"/"Right"; two hosts and the strip from
`compareColumns()`), `NoticeBar`, `ProblemBar`, `QuestionDialog`, and `SettingsView` without the language-server
section (the settings seam `ui/settingsStore.ts`, which both stores register); `onWindowClose` sends every unsent
column first. `ui/useCompareController.ts` is the compare root's only `editor/` importer (settle → `saveColumn` →
`showComparison`, Format failures → `reportFormat`, `track`).

**Pasting on Linux** (plan §2 #99; both windows): `main.ts` calls `takeLinuxPastes(window, readClipboard)`
(`ui/linuxPaste.ts`) when the Tauri source runs and `isLinux(navigator.platform)` (`ipc/keys.ts`, beside `isMac`; also
behind `showsAntialiasing`). A capture-phase `paste` listener cancels and stops every trusted paste without touching
its `clipboardData` (WebKitGTK 2.54 crashes reading a pasteboard whose formats GTK cannot list, and every WebKit paste
fires this event before that read), reads `"primary"` when the paste follows a middle-button `mouseup` in the same task
and `"clipboard"` otherwise, and — once the text arrives, only if the element focused at the paste still has the focus
and is not `<body>` — dispatches a new bubbling `ClipboardEvent("paste")` with the text in memory on the paste's target
(or, when CodeMirror has rebuilt that node meanwhile, on the focused element), so CodeMirror's own paste (undo, `transactionFilter`s
such as the 8 MiB column limit) runs unchanged; an `<input>`/`<textarea>` nobody handled gets `insertText`. `null`,
`""` or a failed read (logged `paste.read_failed`) pastes nothing. Fence PM8 (`scripts/clipboardFence.ts`): no other file
reads `clipboardData` or `navigator.clipboard.read*`.

### 5.5 Frontend file and component conventions (house rules)

File structure is Rust-typical: `editor/index.ts` is the `lib.rs` (sole public surface),
submodules are `editor/<name>.ts`, tests sit next to the code as `<name>.test.ts`, types live
with the module that owns them. No `types/`, `utils/`, `helpers/`, `common/` directories.

Every `.vue` file: `<script setup lang="ts">` → `<template>` → `<style>` (Tailwind v4
classes in templates; a `<style>` block only for things Tailwind cannot express). Script
section order, enforced by `scripts/check-sfc-order.ts` in `just check`:

```
imports → types → macros (defineProps / defineEmits<…>() / defineModel) → ref/reactive/useTemplateRef
→ computed → watch → lifecycle hooks → function declarations
```

- Top-level functions are `function` declarations (hoisted); no `const f = () =>` at top level
  (oxlint `func-style: declaration` in the `*.vue` override).
- `useTemplateRef<HTMLDivElement>("left")` for DOM hosts, never `ref<HTMLElement | null>()`.
- `defineEmits<{ select: [path: string] }>()` and `defineProps<…>()` type-based only
  (`vue/define-emits-declaration`, `vue/define-props-declaration`).
- `@vueuse/core` before any hand-rolled listener/observer/debounce — in `ui/` only.
  `editor/` stays framework-free (plain `addEventListener` + explicit `destroy()`).
- No provide/inject anywhere in v0 (there is no layout component that needs it).
- Split components by responsibility, not by section count: `FileList`, `MergeToolbar`, `MergeView`,
  `WarningBanner`, `App` is the expected set for v0; a sixth needs a one-line justification in the PR.
- CodeMirror decorations use semantic classes (`.chunk-local`, `.chunk-conflict`, …) whose
  colours are `var(--color-…)` from the palettes: yamt Dark in the `@theme` block of `frontend/src/style.css`
  (plan §2 #24), every other theme in one `:root[data-theme="<name>"]` block in `frontend/src/themes/<name>.css`
  defining the same variables (#57, #102; checked by `frontend/scripts/themes.ts`); the editor's highlight in
  `editor/internal/syntax.ts` reads the same variables.

---

## 6. Core algorithm details not in the plan

**Applying a chunk** when the user already edited inside it: the mapped range may have
grown/shrunk; replacement still targets the current mapped range (IntelliJ behaviour). If the
range collapsed to empty because the user deleted it, every side becomes `ignored` and the
buttons disappear.

**Conflicts, side by side** (plan §2 #33, IntelliJ `MergeConflictModel`): each side is applied or
ignored on its own. Applying a side replaces the block's current range, or appends after it when
the other side was applied before ("apply both": local text followed by remote text, the
IntelliJ default; the user edits from there). Applying a side while the other side's lines are
empty resolves the whole conflict.

**Bulk apply**: one transaction containing all `LocalOnly` (or `RemoteOnly`) + `BothSame`
`Pending` chunks, built back-to-front so earlier ranges are not invalidated — or simpler and
correct: build with `state.changes([...])` which takes original-space ranges and composes
them. One undo step.

**Scroll anchors**: for pane pair (A, B) the anchor list is
`[(0,0)] + for each chunk: (A.start, B.start), (A.end, B.end) + (A.lines, B.lines)` in
_pixel_ coordinates via `lineBlockAt(line).top/bottom`; interpolate linearly inside each
segment. Center-pane anchors use the current mapped chunk ranges, so they stay correct after
edits. Collapsed unchanged runs (plan §2 #63) need no extra anchors: `lineBlockAt` sees each run's
inline replace as one 20 px line, and a run hidden at the same step shows the same height in every
pane that hides it (kept lines on both ends plus the wave line), so the segment between two chunk
anchors stays a pure offset; a pane whose run hides nothing at that step stretches linearly, as
unequal runs always did.

**Language detection** (plan §2 #29): in `editor/`, from the file name of `FileMergeData.path`
(basename) through `@codemirror/language-data`'s own table; the grammar loads on demand the first time
a file of that language opens, and the three panes are recoloured when it arrives. No language in the
IPC; Rust does not know languages. Unknown → no highlighting.

---

## 7. Toolchain

### Rust

- edition 2024, pinned stable via `rust-toolchain.toml`.
- Workspace `[lints]`: `clippy::pedantic = warn`, `clippy::unwrap_used/expect_used/panic = deny`,
  `clippy::wildcard_enum_match_arm = deny`, `clippy::disallowed_methods` (per crate in
  `clippy.toml`), `missing_docs = warn` on `merge-core` public items only, `unsafe_code = deny`
  (libraries `forbid`; the one exception is the NVIDIA start-up guard, plan §2 #43, checked by `arch-check`).
- `cargo nextest`, `insta` (goldens), `proptest` (invariants), `cargo-deny`, `tracing` for logs.
- deps: `imara-diff`, `thiserror`, `serde`, `specta` + `tauri-specta`, `tauri 2`, `tracing`;
  `serde_json` at run time only in `cli`, `settings` (plan §2 #57) and `compare` (plan §2 #97). Crates: merge-core,
  gitio, session, cli, conflict-repo (dev-only), settings, lsp-host, compare, src-tauri.
- **Readable-by-a-Rust-beginner rules** (the product owner reads this code; cleverness is a
  defect): owned types at crate boundaries (`String`, `Vec<T>`, `PathBuf`); no lifetimes in
  public signatures beyond `&str`/`&[T]`/`&Path` parameters; a generic needs two concrete
  uses, a trait needs two implementations, else write the concrete thing; derive macros only
  (`serde`, `thiserror`, `specta`), no `macro_rules!`; iterator chains of at most three
  adapters, otherwise a `for` loop; no `Rc`/`RefCell`/`Arc` outside `src-tauri`'s three `Mutex`es
  (`Merge` = the held `MergeSession` or none after an abort, #74; the language-server `Host`, plan §2 #70; the compare
  window's `TabStore`, #97; never held together) and `yamt-compare`'s `Arc<str>` columns (a reply's diff runs outside the
  store's lock without a copy, plan §2 #97); no async (git subprocesses and
  diffs are synchronous and fast; the language-server host uses std threads and channels).
  Per milestone the orchestrator writes `docs/walkthroughs/M<n>.md`: what was built and the
  handful of non-obvious Rust constructs, with the reason each was chosen.

### Frontend

- pnpm, Vite, Vue 3.5+, TypeScript strict + `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; `vue-tsc --noEmit` for SFC types.
- **oxlint** with `oxlint-tsgolint` (`typeAware: true`): `no-restricted-imports` overrides (fences),
  `import/no-cycle`, `no-magic-numbers`, `no-console`, `func-style`, `no-explicit-any`,
  `no-non-null-assertion`, `consistent-type-assertions`, type-aware `switch-exhaustiveness-check`,
  `no-unnecessary-condition`, `strict-boolean-expressions`, `no-floating-promises`.
- **oxfmt** for all formatting incl. `.vue` (native script-block formatting), `sortImports` and
  `sortTailwindcss` enabled — import order and class order are formatter output, never a review topic.
- **ESLint** only with `eslint-plugin-vue`, only on `*.vue`, only `vue/*` rules (template safety,
  `define-macros-order`, `block-order`, type-based props/emits declarations, `require-typed-ref`).
  No typescript-eslint, no Prettier.
- `scripts/check-sfc-order.ts` (`@vue/compiler-sfc` + TS AST, ~60 lines) enforces §5.5 order.
- Vitest: node environment for `model/` and `connectors/`; **browser mode on WebKit**
  (`@vitest/browser` + Playwright `webkit`) for `editor/` tests that need layout
  (`lineBlockAt`, scroll sync). Fallback if Playwright WebKit won't run on Arch: jsdom for
  transaction-level tests, layout tests marked `@browser` and run manually in Epiphany.
- Bundled JetBrains Mono via `@fontsource`.

### `justfile` (the gate)

The file itself is the reference; this is its shape (verified at commit `588abc9`+):

```
check:          fmt-check clippy test deny bindings-check web-lint web-typecheck web-test web-unused arch-check golden sfc-order hooks-test
fmt-check:      pnpm -C frontend fmt:check && cargo fmt --all --check
clippy:         cargo clippy --workspace --all-targets -- -D warnings
test:           {{ hermetic_git }} cargo nextest run --workspace   (no user/system git config, RK19)
deny:           cargo deny check --warn unmaintained
bindings:       cargo run -p yamt-app --features bindings --bin export-bindings
bindings-check: export to target/ and `diff -u` against the committed frontend/src/ipc/bindings.ts
web-*:          delegate to the package scripts in frontend/package.json (lint, typecheck, test, unused, sfc-order); `unused` = exports nobody imports
arch-check:     scripts/arch-check.sh — gitio ↛ merge-core; merge-core ↛ serde_json/tokio/tauri; no std::{fs,process} in merge-core
golden:         yamt-cli golden run — every tests/golden case still produces its committed expected.json
hooks-test:     node:test over .omp/hooks/test/*.test.ts (the agent safety hooks are code)
golden-update:  rewrites expected.json (orchestrator only, PM4); golden-show <case>, golden-repo <case> <dir> for the PhpStorm comparison
dev-web / dev-app / smoke-cli (classify on the window's sample) as before
```

Implementers run their own layer's commands while working; the integrated `just check` runs
once per feature, by the verifier, alone, on the merged tree. Nothing in `check` may pass by skipping.

---

## 8. Testing strategy per layer

| layer                   | kind                                                                                                                                                                                                                                                            | oracle                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `merge-core`            | proptest invariants (§3.1), insta goldens                                                                                                                                                                                                                       | `git merge-file -p` for conflict-free triples (run from the `cli` test crate so core stays pure); PhpStorm by human, once per golden |
| `gitio`                 | integration, real git in tempdir                                                                                                                                                                                                                                | git's own index after each operation (`ls-files -u`, `cat-file`)                                                                     |
| `session`               | integration with a scripted conflict repo                                                                                                                                                                                                                       | reset ⇒ `ls-files -u` identical to before `finish`; finish ⇒ stage 0 only, worktree bytes == result (CRLF preserved)                 |
| `model/`, `connectors/` | Vitest unit, numbers only                                                                                                                                                                                                                                       | hand-computed expectations                                                                                                           |
| `editor/`               | Vitest `node` on `EditorState` (mapping, undo of ranges, decorations per pane; later apply → undo restores text **and** status, bulk apply is one undo step, CRLF `resultText()`); layout only in WebKit smoke (`*.browser.test.ts` project cannot launch here) | assertions on `EditorState`; hand failing-path proofs (not mutated)                                                                  |
| `ui/`                   | Vitest `node`: store actions against a fake `ChunkSource` (later open wins, failed load keeps the file)                                                                                                                                                         | hand-written expectations; manual smoke in Epiphany with the fixture source                                                          |
| end-to-end              | manual: M2 on a 16-file real merge, M3 on macOS                                                                                                                                                                                                                 | human                                                                                                                                |

Explicitly not tested: wiring, Vue templates, Tauri command plumbing (covered by M2 smoke).

Test strength: `just mutants <base>` mutates the lines changed since `<base>` (cargo-mutants for
Rust, StrykerJS with `--ignoreStatic` for the `node` Vitest project) and lists surviving mutants;
the orchestrator runs it after each slice, beside the reviews, and the verifier once per feature
as confirmation, outside `check` (`skill://verification` VF7). `editor/` (WebKit project) is not
mutated and keeps hand failing-path proofs.

---

## 9. Milestones → slices

A _slice_ is one agent task: single owner, disjoint files, fixed contract, observable
acceptance. Ordering within a milestone = dependency order; slices on the same row run in
parallel.

**M0 — Rust, headless**

| #    | slice                                                                                                     | owner     | files                                                             | acceptance                                                                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.0  | walking skeleton: workspace, crates (empty), justfile, lints, deny, CI, pnpm scaffold, `just check` green | 1 agent   | everything (only time one agent owns the whole tree)              | `just check` passes on empty crates                                                                                                                    |
| 0.1  | `merge-core` types + `compute_chunks` + proptests                                                         | rust-impl | `crates/merge-core/**`                                            | invariants §3.1 green; 5 synthetic triples match hand-written expected chunks (Rust literals; the `expected.json` form arrives with `classify` in 0.3) |
| 0.1' | `gitio`                                                                                                   | rust-impl | `crates/gitio/**`                                                 | integration tests incl. add/add, CRLF                                                                                                                  |
| 0.2  | `session`                                                                                                 | rust-impl | `crates/session/**`                                               | finish/reset round-trip test                                                                                                                           |
| 0.3  | `cli` classify/scan/golden/fixture + `git merge-file` cross-check; `session::merge_data`                  | rust-impl | `crates/cli/**`, `crates/session/src/**`                          | golden tooling tested on synthetic cases; RK13 cross-check proptest green                                                                              |
| 0.3' | 10 real goldens from public TS/TSX/Vue projects + `scripts/golden-repo.sh`                                | rust-impl | `tests/golden/**` (not `expected.json`), `scripts/golden-repo.sh` | cases committed with attribution; `just golden` green; owner's PhpStorm comparison deferred to the window (M1, after strips)                           |

**M1 — frontend in a browser, fixture JSON**

| #   | slice                                                                            | files                                                                      | acceptance                                                                                                   |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1.0 | `ipc/` interface + fixture source + bindings pipeline; store + file list         | `frontend/src/ipc/**`, `src-tauri/src/**`, `frontend/src/ui/**`, `main.ts` | `just bindings-check` + `fixtures-check` green; the 10 fixtures listed and opened in WebKit                  |
| 1.1 | `editor/internal/chunkField.ts` + chunk colours; `FileMergeData` seam            | `frontend/src/editor/**`, `ui/MergeView.vue`, `ui/useMergeController.ts`   | mapping tests; chunk colours visible in all three panes                                                      |
| 1.2 | `connectors/` geometry + `strips.ts` + `scrollSync.ts` (the novel part)          | `frontend/src/connectors/**`, `frontend/src/editor/**`, `ui/MergeView.vue` | band paths tested on numbers; Epiphany screenshot of 3 panes + bands; drift ≤ 1 line                         |
| 1.4 | apply: gutter, chunk status + undo, bulk apply, dismiss; toolbar, counts, finish | `frontend/src/editor/**`, `frontend/src/ui/**`                             | apply/undo + one-undo-step bulk apply tests; fixture merge completed in Epiphany; `finishFile` logs the text |

(Re-cut during M1: store and file list moved into 1.0; `apply.ts` moved from 1.1 to 1.4, the
first slice with a caller; 1.1' connectors folded into 1.2, their only user; toolbar, counts and
finish from 1.3 into 1.4.)

**M2 — Tauri shell**: 2.0 commands + state + error enum; 2.1 `TauriChunkSource`; 2.2 sidebar
reset/finish wired; 2.3 exit code + `--repo`. Acceptance: a real 16-file merge resolved,
`git status` clean of unmerged paths, reset of a resolved file restores markers.

**M3 — hardening**: DMABUF guard, font bundling, macOS build, startup measurement script.
**M4**: `gmt` function.

---

## 10. Open product questions (for the product owner; the technical consequence is spelled out)

Technical detail decisions (type shapes, library picks, algorithms) are made by the orchestrator
and recorded in `docs/plan.md` §2 with rationale. Questions to the human are phrased as
product or codebase consequences. Current open ones:

1. **How aggressively should nearby edits be grouped into one chunk?** Tight grouping (gap 0–1)
   shows more, smaller chunks with finer-grained accept buttons; loose grouping (gap 3+) shows
   fewer, larger chunks that are easier to scan but force all-or-nothing on neighbouring
   changes. The goldens compared against PhpStorm will decide; default starts at 1.
2. **"Apply both" on a conflict: your side's text first, then theirs?** That is IntelliJ's
   order and what muscle memory expects; the alternative (theirs first) is only better when
   merging upstream into a feature branch. Default: local then remote.
3. ~~Files the tool cannot show in v0~~ — answered 2026-10-10: two buttons in the middle pane in
   v0 (plan §2 #36).
4. ~~After the last file is finished, close or stay open~~ — answered 2026-10-10: stays open,
   resolved files can be reopened, the top bar says everything is resolved (plan §2 #37).
