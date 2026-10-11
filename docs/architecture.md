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
│  ├─ merge-core/             pure diff3 chunk model. NO I/O, NO git, NO tauri
│  ├─ gitio/                  git subprocess layer. NO merge logic
│  ├─ session/                MergeSession state machine; depends on merge-core + gitio
│  ├─ cli/                    headless binary (M0): classify / scan / golden tooling
│  └─ conflict-repo/          test-only: scripted conflict repos for gitio + session tests (dev-dependency)
├─ src-tauri/                 Tauri shell: commands + DTO export + DMABUF guard. Depends on session only
├─ frontend/
│  ├─ package.json            pnpm; Vite + Vue 3 + TS strict
│  ├─ src/
│  │  ├─ ipc/                 ChunkSource interface; tauri.ts (createTauriSource); fixture.ts
│  │  │  └─ bindings.ts       GENERATED from Rust (tauri-specta). Never hand-edited
│  │  ├─ model/               pure TS, framework-free: chunk state, scroll map, apply math
│  │  ├─ editor/              CodeMirror integration; exports ONLY MergeController
│  │  ├─ connectors/          pure geometry → SVG path strings
│  │  ├─ ui/                  Vue components + one store. Never imports @codemirror/*
│  │  └─ main.ts              wiring: create the source and the store, mount App (one source in M1)
│  └─ fixtures/               golden/<case>.json: the engine's output per golden (`just fixtures`); sample/ for `just smoke-cli`
└─ tests/golden/<case>/       base.<ext> local.<ext> remote.<ext> expected.json README.md  (real conflicts from public projects, plan §2 #26)
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
| `src-tauri` depends only on `session` + tauri crates; command bodies ≤ 15 lines (thin)                                                                       | `scripts/arch-check.sh` (yamt-app's direct deps); reviewer rule                                                                 |
| `ui/**` never imports `@codemirror/*`, `@tauri-apps/*`, `editor/internal/**`, `model/**` directly (only `ipc/` talks to the app)                             | oxlint `no-restricted-imports` in a per-directory `overrides` block (`/**` globs); `frontend/scripts/fences.test.ts`            |
| `model/**` and `connectors/**` import nothing from `vue`, `@vueuse/*`, `editor/`, `ui/`, `@tauri-apps/*`; `editor/**` imports nothing from `vue`/`@vueuse/*` | oxlint `no-restricted-imports` overrides; `import/no-cycle` globally                                                            |
| `ipc/bindings.ts` is generated and byte-identical to `cargo run -p yamt-app --bin export-bindings` output                                                    | `just bindings-check` diff in CI; hook blocks `edit`/`write` on the path                                                        |
| No `unwrap`/`expect`/`panic!` outside tests in Rust                                                                                                          | clippy `unwrap_used`, `expect_used`, `panic` = deny; `#[cfg(test)]` allowed                                                     |
| No `any`, no non-null assertions, no `as` casts outside `ipc/fixture.ts`                                                                                     | oxlint `no-explicit-any`, `no-non-null-assertion`, `consistent-type-assertions: never` (override for the fixture parser)        |
| Every `switch` over a union is exhaustive; every Rust `match` over a domain enum lists all variants                                                          | oxlint type-aware `switch-exhaustiveness-check`; clippy `wildcard_enum_match_arm = deny`                                        |
| No magic numbers                                                                                                                                             | oxlint `no-magic-numbers` (ignore `0, 1, -1`); Rust: reviewer rule, constants in `merge_core::Options` and module-level `const` |
| Line numbers of different spaces never mix                                                                                                                   | Rust newtypes `BaseLine`/`LocalLine`/`RemoteLine`; TS brands applied in `ipc/` (§4)                                             |

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

Output per side, `SideWordChanges<L> { changed: Vec<InlineRange<L>>, removed_at: Vec<InlinePoint<L>> }`:
`changed` = side text not in base (an unpaired side line whole; ranges on one line separated only by
whitespace joined), `removed_at` = zero-width places where base text the side removed would sit
(inside a pair, or one per run of unpaired base lines with nothing new in their place).
`InlineRange<L> { line, start, len }` and `InlinePoint<L> { line, column }` stay on one line, columns
in UTF-16 code units (the unit of JavaScript strings and CodeMirror positions). A side whose chunk
text or base text is empty gets nothing (the block tint says it all). Pure.

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
}
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
pub struct MergeSession { repo: Repo, files: Vec<FileState> /* private: captured stages, decoded content, `seen` (what the disk looked like), `settled` (last disk result + version) */ }

pub enum Eol { Lf, CrLf, Mixed }
pub enum FileStatus { Unresolved, Resolved }
pub enum UnsupportedReason { Binary, NonUtf8, TooLarge, LocalDeleted, RemoteDeleted, Symlink, Submodule }

// DTOs (serde::Serialize + specta::Type), see §4
pub struct FileEntry { pub path: String, pub status: FileStatus, pub unsupported: Option<UnsupportedReason> }
pub struct MiddleLine(pub u32);   // a line of the middle pane's starting text
pub struct DiskVersion(pub u32);  // bumped by each settle of the file (plan §2 #53)
pub enum Middle { Stages { text: String } /* base; "" for add/add */, Disk { text: String }, DiskNotText { found: NotText } }
pub struct MergeChunk { pub chunk: Chunk, pub middle: LineRange<MiddleLine>, pub words: WordChanges }
pub struct FileMergeData { pub path: String, pub middle: Middle, pub local: String, pub remote: String,
                           pub deleted: Option<Side>, pub eol: Eol, pub chunks: Vec<MergeChunk>, pub disk_version: DiskVersion }
pub enum DiskResult { Staged, MarkersLeft { conflicts: u32 }, LeftAsIs, StageFailed { message: String } }
pub struct DiskChange { pub path: String, pub result: DiskResult }
pub struct FileList { pub files: Vec<FileEntry>, pub disk_changes: Vec<DiskChange> }
pub enum WriteReply { Written { files: Vec<FileEntry> }, ChangedOnDisk { files: Vec<FileEntry>, change: DiskChange } }

impl MergeSession {
    pub fn open(cwd: &Path) -> Result<Self>;                         // captures every file's stages, decodes its blobs, reads the disk, compares it with what git wrote
    pub fn refresh(&mut self) -> Result<FileList>;                   // looks at every file, settles disk changes (stage or reopen), then re-reads `ls-files -u`
    pub fn files(&self) -> Vec<FileEntry>;
    pub fn load(&mut self, path: &str) -> Result<FileMergeData>;     // from the stages (base + compute_chunks), or from the disk (one Conflict per open block)
    pub fn finish(&mut self, path: &str, result: &str, v: DiskVersion) -> Result<WriteReply>; // look first; write worktree, git add, Resolved; on a failed add the worktree is put back
    pub fn describe(&mut self, path: &str) -> Result<FileSides>;     // per side: Missing | Text{lines} | Binary/NonUtf8/TooLarge{bytes} | Link{target} | Commit{id}
    pub fn take(&mut self, path: &str, side: Side, v: DiskVersion) -> Result<WriteReply>; // look first; resolve with one side (plan §2 #36): stage 0 first, then worktree; deleted side = git rm
    pub fn reset(&mut self, path: &str, v: DiskVersion) -> Result<WriteReply>;  // look first; restore_stages (+ checkout -m when both sides exist), Unresolved
    pub fn root(&self) -> &Path;
    pub fn remaining(&self) -> usize;
}
```

Edge cases owned here (plan §6 → code):

| case                                                           | handling                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no stage 1 (add/add)                                           | `base = ""`; chunk model yields one Conflict                                                                                                                                                                                                                                                                                                                                                 |
| no stage 2 or 3 (delete/modify)                                | kept side and base text → loads with `FileMergeData.deleted` (that side's text = base, every chunk one-sided; the window shows the kept side read-only with Keep / Delete, plan §2 #47); otherwise `unsupported: LocalDeleted / RemoteDeleted` and the two-button choice. `take`: the kept side's stage 0 + `checkout-index`, or `--force-remove` + delete (#36)                             |
| binary (NUL in first 8000 bytes, git's heuristic) or non-UTF-8 | `unsupported: Binary / NonUtf8`; the window shows each side's size and offers take left / take right (`take`, same result as `git checkout --ours/--theirs` + add), plan §2 #36                                                                                                                                                                                                              |
| line endings                                                   | `Eol` detected on the first of base, local, remote that contains a line break (none → `Lf`): `Lf`, `CrLf`, `Mixed`; `finish` writes text as given by the frontend (frontend joins with the configured separator); `Mixed` is passed through untouched with a UI warning                                                                                                                      |
| `git add` destroys stages                                      | `stages` captured in `open()`; `reset` replays them                                                                                                                                                                                                                                                                                                                                          |
| file > 8 MiB                                                   | `Unsupported(TooLarge)` — CM6 handles it, the webview IPC does not enjoy it; revisit                                                                                                                                                                                                                                                                                                         |
| a conflicted file changed on disk (plan §2 #52/#53)            | `refresh()` and each write look at the disk; no marker lines, not text, or gone → staged in one batch; markers left → the view is the disk, one `Conflict` per open block (`markers.rs`, `locate.rs`, `seed.rs`); a write with an old `DiskVersion` or after an unseen change writes nothing and replies `ChangedOnDisk`; `finish` never writes through a link or into a folder (`NotAFile`) |
| a file already changed before start                            | `start.rs`: two-sided text is compared with `git merge-file` of the stages (ours/theirs views, any conflict style), other kinds with the stage git leaves through `hash-object`; the merge driver is resolved as git does (attribute, `merge.default`, configured drivers); a differing file starts as `GitOutput` and the first `refresh()` settles it                                      |

### 3.4 `cli`

```
yamt-cli classify <base> <local> <remote> [--gap N] [--json]   # chunk table, or the chunks as JSON (§4 `Chunk[]`)
yamt-cli scan [<repo>]                                         # unmerged files + per-file chunk counts or unsupported reason
yamt-cli golden run|update [<dir>]                            # compare / rewrite every case's expected.json (default tests/golden)
yamt-cli fixture <case-dir>                                    # FileMergeData JSON for M1 (`session::merge_data`), same DTO as IPC
```

`cli` uses `merge-core` directly only for pure file classification (`classify`, `golden`);
everything that touches a repository goes through `session`. A case is
`tests/golden/<case>/{base,local,remote}.<ext>` with the original file extension (so PhpStorm
and the window highlight it), a generated `expected.json` (the chunks; written only by
`just golden-update`), and a `README.md` (source project, license, commits, original path,
how to open it in PhpStorm). `scripts/golden-repo.sh <case> <dir>` builds a git repo holding
that conflict for PhpStorm's own merge window.

M0 acceptance lives here: `just golden` (`golden run`) passes, the `git merge-file` cross-check
(RK13) passes, and the human compares the 10 goldens against PhpStorm once.

### 3.5 `src-tauri`

- One `tauri::State<Mutex<MergeSession>>`.
- Commands (thin, typed with `tauri-specta`; plan §2 #41): `list_files() -> Result<FileList>`
  (settles disk changes, then re-reads git's unmerged entries, so the marks are git's view, plan
  §2 #49/#53), `load_file(path) -> FileMergeData` (`deleted` names the deleted side of a
  deleted-on-one-side text file, whose text is base, #47; `middle` is the stages' base or the disk),
  `finish_file(path, text, disk_version) -> WriteReply`, `reset_file(path, disk_version) -> WriteReply`,
  `describe_file(path) -> FileSides`, `take_side(path, side, disk_version) -> WriteReply` (plan §2 #36;
  `ChangedOnDisk` when the disk changed first or the version is old, #53), `remote_name() ->
  Option<RemoteName>` (what is merged in, read once at open, #50), `log(entry)`. No `quit_if_done`:
  the app stays open after the last file (#37); the exit status at close goes through `refresh()`,
  so it settles disk changes and uses git's view (#49).
- Errors: one `#[serde(tag = "kind")] enum IpcError` in `ipc_error.rs` (`Git`, `UnknownPath`,
  `Unsupported`, `WriteFailed`, `NotAFile`, `ReadFailed`) mirrored into TS; no stringly errors. A disk
  change is never an error.
- `run()` (from `main()`): NVIDIA DMABUF guard first (`graphics.rs`, plan §2 #43), before logging and `tauri::Builder`; CLI `yamt [--repo <path>]`;
  nothing to merge → message, exit 0; not a repository → message, exit 2; at close exit 0 iff
  `remaining() == 0`, else 1. Window title `<repository folder> — yamt`.
- `export-bindings` bin writes `frontend/src/ipc/bindings.ts`.

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
export type SideWordChanges<L> = { changed: InlineRange<L>[]; removed_at: InlinePoint<L>[] };
export type WordChanges = { chunk: ChunkId; local: SideWordChanges<LocalLine>; remote: SideWordChanges<RemoteLine> };
export type MergeChunk = { chunk: Chunk; middle: LineRange<MiddleLine>; words: WordChanges }; // plan §2 #53
export type Middle = { kind: "Stages"; text: string } | { kind: "Disk"; text: string } | { kind: "DiskNotText"; found: NotText };
export type FileMergeData = { path: string; middle: Middle; local: string; remote: string; deleted: Side | null; eol: Eol; chunks: MergeChunk[]; disk_version: DiskVersion };
export type DiskResult = { kind: "Staged" } | { kind: "MarkersLeft"; conflicts: number } | { kind: "LeftAsIs" } | { kind: "StageFailed"; message: string };
export type FileList = { files: FileEntry[]; disk_changes: DiskChange[] };     // DiskChange = { path; result: DiskResult }
export type WriteReply = { kind: "Written"; files: FileEntry[] } | { kind: "ChangedOnDisk"; files: FileEntry[]; change: DiskChange };
export const commands: { listFiles(): Promise<FileList>; loadFile(path: string): Promise<FileMergeData>; … };
```

Brands: specta emits the Rust newtypes as plain `number`, so the generated DTOs are
unbranded. `ipc/domain.ts` owns the domain types (`MiddleLine = number & { readonly __brand:
"MiddleLine" }`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion`, and `Chunk`/`FileMergeData` built on them)
and one `toDomain(dto: Generated.FileMergeData): FileMergeData` mapping. Both `ChunkSource`
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
  listFiles(): Promise<SourceResult<FileList>>; // settles disk changes, then re-reads git: marks are git's view (plan §2 #49/#53)
  loadFile(path: string): Promise<SourceResult<FileMergeData>>; // domain Chunk: { id, kind, middle, local, remote, words }; base is not shown, so not carried
  finishFile(
    path: string,
    text: string,
    diskVersion: DiskVersion,
  ): Promise<SourceResult<WriteReply>>;
  resetFile(path: string, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>; // the window reloads the file
  describeFile(path: string): Promise<SourceResult<FileSides>>; // a file the editor cannot show; carries its diskVersion
  takeSide(path: string, side: Side, diskVersion: DiskVersion): Promise<SourceResult<WriteReply>>; // stage one side as the result
  remoteName(): Promise<RemoteName | null>; // what is merged in, for the right header (#50); fixture: null
}
```

The fixture source reads `frontend/fixtures/golden/*.json` — the engine's output for each
golden case — and `frontend/fixtures/showcase/*.json` — hand-written demo cases from
`tests/showcase/<case>/` (e.g. `word-marks.ts`, every kind of word change) — both written by
`just fixtures` and kept current by `just fixtures-check` in `check`; `finishFile` stores results
in memory and logs the text. `createTauriSource` (2.1) maps the generated `commands`. `main.ts`
picks one by `import.meta.env.VITE_CHUNK_SOURCE` (`"tauri"` from the app's dev and build
commands); a failure reaches the window's problem bar through `ui/problemText.ts`.

---

## 5. Frontend modules and fences

### 5.1 State ownership — the table that prevents the classic mistake

| state                                                                                                   | owner                                                                                                                                                                                                                                                                                                      | why                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| left/right/center document text                                                                         | CodeMirror `EditorState`                                                                                                                                                                                                                                                                                   | rope, transactions, undo                                                                                                            |
| chunk current positions in center                                                                       | `editor/chunkField` (`StateField`), seeded from each chunk's `middle` range (the stages' base, or the disk text, plan §2 #53)                                                                                                                                                                              | mapped every transaction per CM1 (`-1`; `to` `+1` only when a range ends mid-line); restored on undo by an `invertedEffects` effect |
| chunk apply status, per side (`{ local, remote }`, each `pending`/`applied`/`ignored`; plan §2 #33)     | same `StateField`, changed only via `StateEffect` registered with `invertedEffects`; side panes hold a read-only mirror the controller pushes after each center transaction                                                                                                                                | **undo must revert status together with text**                                                                                      |
| left/right decorations                                                                                  | derived from the pane's fixed ranges + the mirrored status                                                                                                                                                                                                                                                 | immutable docs                                                                                                                      |
| find space above line 1 (while any pane's find bar is open)                                             | `findSpace` field in every pane (`editor/internal/find.ts`), pushed by the controller each frame from "any pane's bar open"                                                                                                                                                                                | no history; same space in all three panes keeps them aligned (plan §2 #44)                                                          |
| drag over the icons: the press, the covered changes' highlight                                          | the press in `editor/internal/drag.ts` (`IconDrag`); the highlight in a side-pane field (`covered.ts`), pushed by the controller                                                                                                                                                                           | no history; derived from the press and the pointer each frame                                                                       |
| scroll positions                                                                                        | DOM (`scrollDOM.scrollTop`), driven by `editor/scrollSync`                                                                                                                                                                                                                                                 | not state, derived                                                                                                                  |
| chunk rows and scroll anchors                                                                           | one cache in `MergeController` (rows from `lineBlockAt` + the sync's anchors), dropped by `rowsChanged`: doc change, measured heights (`geometryChanged`), statuses; the strips move their kept nodes per frame                                                                                            | derived, cached (plan §2 #51)                                                                                                       |
| file list, opened files, active file, the shown failure, notices about disk changes                     | `ui/store.ts` (module singleton via `useAppStore()`, no Pinia); each opened file's `MergeView` registers `{ unsaved, markSaved }` with `store.track`; the marks are git's view, re-read on window focus (plan §2 #49); `notices` (one per path) set by `ui/diskChanges.ts` from Rust's `DiskChange`s (#52) | chrome only; what the disk looked like lives in Rust's `MergeSession`                                                               |
| saved baseline per opened file (loaded text, then the last text marked resolved)                        | non-reactive `let` in `useMergeController`, set when the controller is built, replaced by `markSaved` after a successful finish                                                                                                                                                                            | one place decides "unsaved work" (plan §2 #37)                                                                                      |
| choice per file the editor cannot show (its sides); the side taken (choice and deleted-side text files) | `choices` shallowRef in `ui/store.ts`: set by describe, dropped and described again by reset; one `taken` map (`Taken`: by a side, or by the disk) set by `takeSide` and by a disk change that staged the file, deleted by reset                                                                           | the index decides "resolved"; `taken` only picks the view's line and the middle pane's content (plan §2 #36, #47, #52)              |
| summary counts of the open file                                                                         | `shallowRef` in `useMergeController`, fed by `MergeController.onSummaryChange`                                                                                                                                                                                                                             | per controller                                                                                                                      |

Rule: **Vue state never holds an `EditorView`, a position, or document text.** The result
text passes through once, from `resultText()` to `store.finish` (and back into that file's own
baseline in `useMergeController`).

### 5.2 `editor/` — public surface is one class

```ts
export class MergeController {
  constructor(data: FileMergeData, hosts: MergeHosts, options?: MergeOptions); // left, center, right + strips: [SVGSVGElement, SVGSVGElement]; MergeOptions = { readOnly } (plan §2 #47)
  applyAllNonConflicting(side: Side): void; // one undo step
  undo(): boolean;
  redo(): boolean;
  resultText(): string; // state.sliceDoc() — respects lineSeparator; NEVER doc.toString()
  summary(): MergeSummary; // { changes, conflicts } still to decide
  onSummaryChange(listener: (s: MergeSummary) => void): void;
  destroy(): void;
}
```

Per-change apply/ignore is internal: its callers are the icons in the strips (a click or a drag over
several, plan §2 #45) and Ctrl/Cmd+click on a side block (#46).

Internals (`editor/internal/`, not importable from `ui/`):

- `pane.ts` — shared extensions (bundled font theme, line numbers, Lezer highlight with the
  language compartment, `EditorState.lineSeparator` for CRLF, a highest-precedence selection mark
  so selected text shows over block tints and word marks), `readOnly` + `editable(false)` for
  sides (focusable through `tabindex` so find works), `history()` and Tab / Shift+Tab
  (`indentWithTab`) for center only, with the indent unit guessed from the starting text by
  `indent.ts` (plan §2 #35); the center also gets `readOnly` in the controller's read-only mode
  (plan §2 #47); the find bar in every pane.
- `language.ts` — the file's language from its base name via `@codemirror/language-data` (plan §2 #29).
- `chunkField.ts` — the center `StateField` + effects described above (CM1, CM2, CM8).
- `status.ts`, `apply.ts` — every status rule (a side still open, resolved, append or replace,
  status after apply / ignore; plan §2 #33) and the steps for apply, ignore and bulk apply, sent
  one dispatch each through `dispatchSteps`: (1) a cursor move to the block (bulk: to the first
  visible line, only if the cursor is off screen), outside history, no scroll — undo returns
  there; (2) the action: current mapped range from `chunkField`, replacement text from
  `data.local/remote` sliced by the chunk's fixed side range, plus the status effect; (3) the same
  cursor again as a selection step history records — redo returns there, and typing right after
  an apply starts its own undo step. After a strip action the middle pane takes focus if it had
  none, without scrolling.
- `decorations.ts`, `side.ts`, `tone.ts`, `sideStatus.ts` — line colours per tone and status; one
  rule per side pane (that side still open) decides which blocks are tinted and feeds the line
  bands, the word marks and the removal bars; the middle pane draws bands only, until both sides
  are handled (plan §2 #31, #33).
- `words.ts` — side-pane word marks and removal bars (`RemovalPoint` widgets: zero width, a bright
  bar where the side removed text) from `chunk.words` (plan §2 #30, #31).
- `geometry.ts` (where each chunk sits in each pane), `gap.ts` (what a strip shows: the bands that
  cross it and each open change's icon row in document space), `strips.ts` (places the icon rows,
  keeps the nodes of what is in the strip and moves them per frame) — bands and the apply/ignore
  buttons in the two `<svg>` strips
  (SVG groups at the side pane's edge; a CodeMirror gutter on the inner edge missed clicks in
  WebKit). Icons are Lucide SVG markup imported as strings (`~icons/lucide/<name>?raw`), parsed
  once and cloned per button (plan §2 #34); the apply button turns into "add below" while the
  other side is applied. A button press only starts a press; none are drawn in read-only mode.
- `drag.ts`, `covered.ts` — the press and drag over the icons (plan §2 #45): pointer capture on the
  persistent `<svg>` strips (a button row exists only while it is in the strip and its side is open;
  its position is updated per frame), the changes covered between the press
  and the pointer, highlighted through a side-pane effect outside history; release sends one
  `ChunkAction` with every covered chunk, one undo step (CM7).
- `modClick.ts` — Ctrl/Cmd+click on a line of an open block in a side pane sends that change's apply
  action (plan §2 #46).
- `find.ts` — the find bar of each pane on `@codemirror/search` (plan §2 #44): our panel floating over
  the pane's top right (it never resizes the scroller, so scroll sync is untouched), the count
  ("k of N" / "N results" / "No results"), next/previous with wrap; while any pane's bar is open all
  three panes get the bar's height as space above line 1 (`findSpace`), so a match on line 1 shows
  below the bar and the panes stay aligned.
- `scrollSync.ts` — one pure function `targets(anchors, source, y)` using piecewise-linear
  interpolation between chunk anchor pixel positions (`lineBlockAt`), reference point the middle
  of the viewport. Swapping to chunk-anchored hold later = replacing this one function (plan
  decision #12). Re-entrancy: the follower panes written by a sync ignore their echo for one
  frame; a source whose `scrollTop` did not change does not re-sync.

### 5.3 `connectors/` — pure geometry

```ts
export type Span = { readonly top: number; readonly bottom: number }; // px from the strip's top; top === bottom is an insertion point
export type Band = { readonly left: Span; readonly right: Span };
export function bandPath(band: Band, width: number): string; // closed path, cubic top/bottom edges, control points at width / 2
```

`editor/internal/geometry.ts` turns chunk ranges into `Span`s (via `lineBlockAt`); `MergeController`
caches these rows with the scroll sync's anchors until the document, the measured heights or the
statuses change (plan §2 #51). `editor/internal/gap.ts` picks the bands that cross each strip and the
open changes' icon rows; `editor/internal/strips.ts` places the rows, keeps the nodes of what is in
the strip and moves them once per animation frame, after any pane scroll, center edit or geometry
change. Each strip is its own compositing layer (plan §2 #51). `connectors/` is unit-tested on
numbers, no DOM.

### 5.4 `ui/` — Vue 3

Components: `App.vue`, `FileList.vue` (file list, resolved mark, vscode-icons), `MergeView.vue`
(toolbar + three `<div>` hosts + two `<svg>`, each in a bordered wrapper on its own compositing layer;
one per opened file, inactive ones `invisible` plus `content-visibility: hidden` — no layout or
paint, editors, scroll positions and work kept, plan §2 #51;
creates its `MergeController` through `useMergeController`, which recreates it when the file's
data object changes and destroys it with the component), `MergeToolbar.vue` (bulk apply
left/right, undo/redo, counts, finish, reset — `MergeView` calls the store's `finish`/`reset`),
`ProblemBar.vue` (failures, words from `problemText.ts`; the `Problem` vocabulary and `attempt` in
`problem.ts`), `QuestionDialog.vue` ("Unprocessed Changes" / "Cancel File Merge", words and
decisions in `question.ts`), `ChoiceView.vue` (two-button choice for a file the editor cannot show,
one sentence per side from `choiceText.ts`, plan §2 #36). Names are multi-word (the Vue linter's
`multi-word-component-names`; `App` exempt).

`store.ts` — one module-level singleton, reached through a composable, never provide/inject:
`createAppStore(source)` once in `main.ts`, `useAppStore()` in components; state: the file list,
the opened files (each loaded once per session; reset replaces it in place), the choices (one per
opened file the editor cannot show), the active path, the problem and the open question; actions:
load the list, open (a later open wins; re-clicking the shown file does nothing; a file the editor
cannot show is described instead of loaded), finish (asks when work is left), take a side, reset,
the window-close check.

The Vue↔editor seam is one adaptable composable:

```ts
export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: MergeHosts,
  readOnly: MaybeRefOrGetter<boolean>, // MergeView's one rule: deleted side or a middle that is not text on disk
): {
  summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting;
  undo;
  redo;
  resultText;
};
```

It creates/destroys the non-reactive `MergeController` in a `watch(toRef(data), readOnly)`, pipes
`onSummaryChange` into a `shallowRef`, and is the only place `editor/` is imported from `ui/`.

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
  colours are `var(--color-…)` from the one palette, the `@theme` block in `frontend/src/style.css`
  (plan §2 #24); the editor theme in `editor/internal/pane.ts` reads the same variables.

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
edits. Collapsed-regions (`Decoration.replace({block:true})`) are v1; `lineBlockAt` already
accounts for them when they arrive.

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
- deps: `imara-diff`, `thiserror`, `serde`, `specta` + `tauri-specta`, `tauri 2`, `tracing`.
- **Readable-by-a-Rust-beginner rules** (the product owner reads this code; cleverness is a
  defect): owned types at crate boundaries (`String`, `Vec<T>`, `PathBuf`); no lifetimes in
  public signatures beyond `&str`/`&[T]`/`&Path` parameters; a generic needs two concrete
  uses, a trait needs two implementations, else write the concrete thing; derive macros only
  (`serde`, `thiserror`, `specta`), no `macro_rules!`; iterator chains of at most three
  adapters, otherwise a `for` loop; no `Rc`/`RefCell`/`Arc` outside `src-tauri`'s single
  `Mutex<MergeSession>`; no async (git subprocesses and diffs are synchronous and fast).
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
bindings:       cargo run -p yamt-app --bin export-bindings
bindings-check: export to target/ and `diff -u` against the committed frontend/src/ipc/bindings.ts
web-*:          delegate to the package scripts in frontend/package.json (lint, typecheck, test, unused, sfc-order); `unused` = exports nobody imports
arch-check:     scripts/arch-check.sh — gitio ↛ merge-core; merge-core ↛ serde_json/tokio/tauri; no std::{fs,process} in merge-core
golden:         yamt-cli golden run — every tests/golden case still produces its committed expected.json
hooks-test:     node:test over .omp/hooks/test/*.test.ts (the agent safety hooks are code)
golden-update:  rewrites expected.json (orchestrator only, PM4); golden-show <case>, golden-repo <case> <dir> for the PhpStorm comparison
dev-web / dev-app / smoke-cli (classify on the window's sample) as before
```

Implementers run their own layer's commands while working; the integrated `just check` runs
once per wave, by the verifier, on the merged tree. Nothing in `check` may pass by skipping.

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
Rust, StrykerJS for the `node` Vitest project) and lists surviving mutants; the verifier runs it
once per wave, outside `check`. `editor/` (WebKit project) is not mutated and keeps hand
failing-path proofs.

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
