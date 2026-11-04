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
├─ src-tauri/                 Tauri shell: commands + DTO export + DMABUF guard. Depends on session, settings, lsp-host, compare, range, review, agent, merge-requests, local-merge
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
├─ tests/compare/<case>/      left.txt right.txt: the compare window's fixture pairs (`yamt-cli compare`, plan §2 #95)
├─ crates/range/              yamt-range: the `--diff=<a>..<b>` range, its changed files and texts, the pair lock (§3.8)
├─ crates/review/             yamt-review: the range window's threads (`threads.json`) and posting to GitLab through glab (§3.8)
├─ crates/pipe/               yamt-pipe: the process core language servers and the AI share (§3.8)
├─ crates/agent/              yamt-agent: the AI's temporary checkout and its `omp acp` process (§3.8)
├─ crates/merge-requests/     yamt-merge-requests: the GitLab project's open merge requests through glab (people, labels, pictures' addresses), opening one's changes, job pages, resolving one, re-requesting a review, searching, adding and removing its people, reading its description (§3.9)
├─ crates/local-merge/        yamt-local-merge: the merge of a merge request yamt starts in the user's checkout, its record, Abort's restore, the push (§3.10)
├─ tests/glab/<scenario>/     the fake glab's answers (scripts/fake-glab/glab), pinned to scripts/range-repo.sh's ids
└─ tests/agent/<case>/        the fixture agent's diff pairs
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

The range window adds (plan §2 #104, #109, #110, #117): `gitio, merge-core ◄── range ◄── review ◄── src-tauri`;
`pipe ◄── lsp-host`; `gitio, pipe, range ◄── agent ◄── src-tauri`; `settings` gains the `agent` entry. The
merge-request page adds (plan §2 #129): `gitio, range ◄── merge-requests ◄── src-tauri` (`review` only as its
dev-dependency); resolving a merge request's conflicts adds `gitio ◄── local-merge ◄── src-tauri` (§3.10). In the window:
`jsonrpc/` imports no `src/` module; `lsp/` and `agent/` reach it only through `jsonrpc/index.ts`; `agent/` imports only
the `ipc/` and `jsonrpc/` indexes and is built only in `main.ts`; the range root (`Range*.vue`, `range*.ts`, the AI views)
never imports the merge or compare roots or `lsp/` (PM9); `mergeRequests/` (the page's pure core) imports no other `src/`
module, as `search/`; the shared page files (`ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*`) import no window
root and nothing from `lsp/` (PM10).

Rules (each one is enforced, not advised — §8 says by what):

| rule                                                                                                                                                         | enforced by                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `merge-core` has no `std::process`, `std::fs`, `tokio`, `tauri`, `serde_json`                                                                                | clippy `disallowed_methods`/`disallowed_types` + no such deps in `Cargo.toml` (cargo-deny `bans` wildcard check per crate)      |
| `gitio` contains no diff logic (never depends on `merge-core`)                                                                                               | workspace `Cargo.toml` graph; `cargo tree -e normal -p gitio` must not list merge-core (just recipe)                            |
| `src-tauri` depends only on `session`, `settings`, `lsp-host`, `compare`, `range`, `review`, `agent`, `merge-requests`, `local-merge` + tauri crates; command bodies ≤ 15 lines (thin); `settings` and `lsp-host` depend on no `yamt-*` crate and not on tauri; `compare` depends on `merge-core` only among `yamt-*` and not on tauri; `merge-requests` depends on `range`, `gitio` and `merge-core` only among `yamt-*` and not on tauri; `local-merge` depends on `gitio` only among `yamt-*` and not on tauri | `scripts/arch-check.sh` (yamt-app's, yamt-settings', yamt-lsp-host's, yamt-compare's, yamt-merge-requests' and yamt-local-merge's direct deps); reviewer rule |
| `ui/**` never imports `@codemirror/*`, `@tauri-apps/*`, `editor/internal/**`, `model/**` directly (only `ipc/` talks to the app)                             | oxlint `no-restricted-imports` in a per-directory `overrides` block (`/**` globs); `frontend/scripts/fences.test.ts`            |
| `model/**` and `connectors/**` import nothing from `vue`, `@vueuse/*`, `editor/`, `ui/`, `@tauri-apps/*`; `editor/**` imports nothing from `vue`/`@vueuse/*` | oxlint `no-restricted-imports` overrides; `import/no-cycle` globally                                                            |
| The compare window's root (`ui/Compare*.vue`, `ui/compare*.ts`, `ui/useCompare*.ts`: every compare-only file carries the prefix) never imports `ui/store.ts`, `ui/App.vue` or `lsp/` (plan §2 #94) | `frontend/scripts/windowFence.ts` PM7 (called by `fences.ts`) + its failing-path test |
| The merge-request page's shared files (`ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*`) never import a window root (`store.ts`, `App.vue`, `compareStore.ts`, `CompareApp.vue`, `rangeStore.ts`, `RangeApp.vue`) or `lsp/` (plan §2 #128) | `frontend/scripts/windowFence.ts` PM10 (called by `fences.ts`, with PM7 and PM9) + its failing-path test |
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

pub struct Oid(String);                    // 40 or 64 hex chars; Oid::parse, as_str; Hash (a key of yamt-merge-requests' `MergedPairs`)
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
    // the merge-request page (plan §2 #129, #130, #132)
    pub fn remote_urls(&self) -> Result<Vec<RemoteUrl>>;          // config -z --get-regexp ^remote\..*\.url$ (one reader with merge_config, `config_entries`); RemoteUrl { name, url } bytes, config order
    pub fn fetch_without_refs(&self, remote: &str, refspecs: &[&str], timeout: Duration) -> Result<(), String>; // fetch --no-tags --no-write-fetch-head --no-recurse-submodules --no-auto-maintenance --refmap= --quiet --end-of-options: no ref, no FETCH_HEAD; GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never, SSH_ASKPASS_REQUIRE=force + SSH_ASKPASS=false (Unix; `refuse_prompts`); killed at `timeout` (FETCH_TIMEOUT 120 s); through `fetch.rs` `stdout_without_prompts`: Err = git's first stderr line, else "git <verb> failed: <status>"
    // the local conflict check (plan §2 #149; ls_remote.rs, objects.rs, merge_tree.rs)
    pub fn remote_refs(&self, remote: &str, patterns: &[&str], timeout: Duration) -> Result<Vec<RemoteRef>, String>; // ls-remote --refs --end-of-options <remote> <patterns> through `stdout_without_prompts`: RemoteRef { name: Vec<u8>, id: Oid }, git's order; nothing fetched or written; Err as fetch_without_refs, or "git ls-remote printed …"
    pub fn missing_commits(&self, ids: &[Oid]) -> Result<Vec<Oid>>; // one cat-file --batch-check (`batch_check`, `%(objecttype)`): the ids missing or not a commit, input order; no lazy fetch
    pub fn merge_tree(&self, first: &Oid, second: &Oid, run_kind: MergeTreeRun, timeout: Duration) -> Result<MergeOutcome>; // merge-tree --write-tree [--quiet]: exit 0 Clean, exit 1 with empty stderr Conflicts (git also exits 1 for a commit it cannot find, with stderr), else GitFailed; killed at `timeout` → Timeout; Quiet runs Access::Read and writes no object, Writing Access::Write and leaves unreferenced objects; no index, worktree or ref; no lazy fetch
    // the merge of a merge request in the user's checkout (plan §2 #138–#143; fetch.rs, branch.rs, push.rs): every network run goes through `fetch.rs` `run_without_prompts`
    pub fn fetch_branches(&self, remote: &str, branches: &[&str], timeout: Duration) -> Result<(), String>; // the same fetch with +refs/heads/<b>:refs/remotes/<remote>/<b> per branch: writes those remote-tracking refs only; the caller refuses a name holding ':'
    pub fn git_path(&self, name: &str) -> Result<PathBuf>;          // rev-parse --git-path <name>
    pub fn is_ancestor(&self, ancestor: &Oid, of: &Oid) -> Result<bool>; // merge-base --is-ancestor: exit 0 true, 1 false, else Err
    pub fn has_tracked_changes(&self) -> Result<bool>;               // status --porcelain=v1 -z --untracked-files=no lists anything
    pub fn checkout_branch_at(&self, branch: &str, commit: &Oid) -> Result<()>; // checkout --quiet -B <branch> <commit>; no deadline
    pub fn checkout_branch(&self, branch: &str) -> Result<()>;       // checkout --quiet --end-of-options <branch> --; no deadline
    pub fn set_upstream(&self, branch: &str, remote: &str) -> Result<()>; // config branch.<b>.remote <remote> + branch.<b>.merge refs/heads/<b> (what --track writes)
    pub fn delete_branch(&self, branch: &str) -> Result<()>;         // branch --quiet -D --end-of-options <branch> (its branch.<b>.* config goes too)
    pub fn move_branch(&self, branch: &str, commit: &Oid) -> Result<()>; // branch --quiet --force --end-of-options <branch> <commit>; refused while checked out
    pub fn reset_keep(&self, commit: &Oid) -> Result<()>;            // reset --quiet --keep <commit>: the checked-out branch; no deadline
    pub fn merge_no_commit(&self, rev: &str) -> Result<GitRun>;       // merge --no-ff --no-commit --end-of-options <rev>; no deadline; a non-zero exit is not an Err (read the stop)
    pub fn push_branch(&self, remote: &str, branch: &str, timeout: Duration) -> Result<(), String>; // push --porcelain --no-follow-tags --recurse-submodules=no --end-of-options <remote> refs/heads/<b>:refs/heads/<b>: never forced; killed at `timeout` (PUSH_TIMEOUT 120 s); Err = the ref's porcelain `!` summary (checked before the exit status), else git's first fatal:/error: line
}
pub enum Operation { Merge { merging }, SquashMerge { merging }, Rebase(Rebase { branch, onto, replaying, redoing_merge, progress, editor_steps_ahead }),
                     CherryPick { picking, progress }, Revert { reverting, progress }, Am { subject, message, progress } }
impl Stop { pub fn id(&self) -> StopId; }                          // the stop's identity: the operation's kind, its ids and HEAD, never progress or the todo (`rebase --edit-todo` is the same stop)
impl BlobReader { pub fn read(&mut self, oid: &Oid) -> Result<Vec<u8>>; }
impl MergeTreeRun { pub fn for_version(version: GitVersion) -> Option<MergeTreeRun>; } // Quiet ≥ 2.50 (FIRST_WITH_QUIET), Writing 2.38–2.49 (FIRST_WITH_WRITE_TREE), None before
pub enum MergeOutcome { Clean, Conflicts }                         // what `MergedPairs` remembers per pair
// objects.rs: `batch_check(ids, fields, LazyFetch)` (pub(crate)) is the one `cat-file --batch-check='%(objectname) <fields>' --buffer` runner, answers in input order (`blob_sizes` with `%(objecttype) %(objectsize)` and LazyFetch::Allowed, `missing_commits` with LazyFetch::Refused); `refuse_lazy_fetch` sets GIT_NO_LAZY_FETCH=1 (git 2.45+; an older git ignores it and fetches), used by `missing_commits` and `merge_tree`
impl Glab {                                                         // glab.rs: PATH lookup (`find`), GLAB_TIMEOUT 20 s per call, NO_COLOR, GIT_TERMINAL_PROMPT=0
    pub fn get(&self, cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String>; // stdout; Err = glab's last stderr line, its exit words or TIMED_OUT
    pub fn post(&self, cwd: &Path, args: &[&str], body: Vec<u8>) -> Result<Vec<u8>, String>; // the same with `body` on stdin; one failure rule with `get` (`printed_or_failure`)
    pub fn auth_status(&self, cwd: &Path) -> AuthStatus;           // `glab auth status`: LoggedIn | LoggedOut { detail: first line } | Failed { message }
}
pub fn first_line(output: &[u8]) -> Option<String>; pub fn last_line(output: &[u8]) -> Option<String>; // the one pair of glab-output helpers (TIMED_OUT the one timeout word); yamt-review's glab calls go through `get`/`auth_status` (its posts through `run`, reading GitLab's HTTP answer), yamt-merge-requests' through `get`/`post`/`auth_status`
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
  highest_disk_version } | Aborted(OperationKind) | Committed { root, offer: PushOffer } | Finished(OperationKind)`,
  plan §2 #88/#89/#141) and
  `tauri::State<Mutex<Host>>` (the language-server host, plan §2 #70), never locked together. `Merge::session()` is the
  one state → error mapping: `Running` → `GitRunning`, `MovedOn` → `StopMovedOn`, `Aborted` → `MergeAborted`,
  `Finished` and `Committed` → `MergeFinished`. Continue and Abort hand the session to a `spawn_blocking` worker (`on_worker`), so the
  main thread never waits on git; the state is `Running` meanwhile. git's refusal puts the session back (`Held`); a
  refusal that says git moved on (`StopMovedOn`, #1440) and a worker panic leave `MovedOn` (the version from before the
  hand-over) and answer `StopMovedOn`, so the window's one `nextStop` lists the stop git is at (#1435, plan §2 note
  after #91).
- Commands (thin, typed with `tauri-specta`; plan §2 #41): `list_stop() -> Result<Listing>` (`Listing = Files { files,
  disk_changes, operation, sides, merge_request } | MovedOn`; in `MovedOn` it first opens the next stop with `open_after`, then lists
  through `refresh_stop`: settles disk changes and re-reads git's unmerged entries, so the marks are git's view, plan
  §2 #49/#53; `operation` is what git is doing now, `sides` both panes' names as read at open, #85/#87;
  `merge_request: Option<MergeView>` is the merge yamt started here, read fresh by `yamt_local_merge::find_live` on
  every list, #140),
  `load_file(path) -> FileMergeData` (`deleted` names the deleted side of a
  deleted-on-one-side text file, whose text is base, #47; `middle` is the stages' base or the disk),
  `finish_file(path, text, disk_version) -> WriteReply`, `save_file(path, text, disk_version) -> WriteReply`
  (`finish_file` without `git add`: the own write updates `seen` only, the disk version stays, plan §2 #65/#69),
  `reset_file(path, disk_version) -> WriteReply` (back to this run's start: the stages captured at open and the
  bytes found at open, `FileState.at_open`, #66/#69),
  `describe_file(path) -> FileSides`, `take_side(path, side, disk_version) -> WriteReply` (plan §2 #36;
  `ChangedOnDisk` when the disk changed first or the version is old, #53), `continue_operation() -> Result<ContinueReply>`
  (`Finished` | `ReadyToPush { branch }` | `Stopped { message }`: git's continue on the worker; `Finished` →
  `Merge::Finished` and the window is destroyed; with a live record of a merge yamt started, `LiveMerge::committed()`
  removes it and the state becomes `Committed { root, offer }` (not ended: the window stays and asks whether to push,
  #141); `Stopped` → `MovedOn`, the window lists the next stop; a refusal is `Git` with git's message, #89),
  `abort_operation() -> Result<AbortReply>` (git's abort for the operation, #88, then, for a merge yamt started, the
  record's restore on the same worker, `AbortReply { leftovers: Vec<Leftover> }`, #140: on success `Aborted` and the
  calling window is destroyed when `leftovers` is empty, which emits no close request, so the page's unsaved-work
  question never runs; with leftovers the window stays to list them; a refusal is `Git` with its message and the
  session stays held), `push_merged_branch() -> Result<PushReply>` (`Committed` only, else `NoOperation`;
  `yamt_local_merge::push` on a `blocking_reply` worker while `Running`; `Pushed` → `Finished` and the window is
  destroyed; `Failed { message }` or a stopped worker → `Committed` again), `close_ended_merge() -> ()` (Keep Local and
  the leftovers' Close: `Committed` → `Finished`; destroys the window when ended, else nothing). The async commands
  destroy the window only when `has_ended()` (`Finished` or `Aborted`). `log(entry)`. No
  `quit_if_done`: the app stays open after the last file (#37); the exit status at close goes through
  `outcome::ending_when_git_is_done` (waits for a running worker, then lists through `refresh_stop`, so it settles disk
  changes and uses git's view, #49; a stop git moved on from counts the new stop's files, staging nothing); after an
  abort it is 1 with `<operation> aborted`, after a finished Continue (or a `Committed` merge) 0 with `<operation>
  finished`, nothing re-read.
- Settings commands (`settings.rs`, plan §2 #57, #60, #163), each given the window's settings in use
  (`current: StoredSettings`) and answering `SettingsRead { path, default_path, stored }`:
  `load_settings(current)`, `set_theme(current, theme)`, `set_antialiasing(current, antialiasing)`,
  `set_discussion_details(current, details)`, `set_keys(current, changes)`, `move_settings(current, path)`. Each computes `Places` from Tauri's
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
  window `UnknownTab { tab }`, `ColumnTooLarge { limit }`, `WorkerStopped`) mirrored into TS; no stringly errors
  (`yamt_local_merge::Error`, `Git` or `LockFailed`, maps to `Git` with its words). A disk
  change is never an error.
- **The compare window** (`yamt --diff`, plan §2 #93/#94; `args.rs` `Invocation::Compare { ai, start }`, `window.rs`
  `run_compare(folder, ai, start)`, `compare.rs`): never opens a `MergeSession`, never manages `Mutex<Merge>` or the
  language-server host. It runs git and glab only for the merge-request page (#94 as amended, #130): the remotes once
  at start, in its start folder (`args.rs` `START_FOLDER` through `lib.rs` `from_start_dir`, `OWD` under an AppImage),
  glab on use, a fetch only when a merge request's commit is missing (#132), and on each load the local conflict check
  (#149: `git version`, one `ls-remote`, one `cat-file --batch-check`, at most one fetch, `merge-tree` per pair). Its `ai` sets no `data-ai`; it only
  reaches `MergeRequestState`, so "Show Diff" starts the changes window with `--ai` (#144, also from a range window).
  **Start options** (plan §2 #167): `args::parse(args, ai_variable)` is pure; `lib.rs` `run` reads `YAMT_AI` (`AI_VAR`)
  once and hands its value in (unset, empty or `0`: off; any other value, non-UTF-8 too: on; `--ai` wins). `--mr` sets
  `StartScreen::MergeRequests` (`Files` otherwise), applied after every flag is read (`Window::started_on`): alone it
  means `--diff`, with `--diff=<range>` it marks the range window, with `--repo` and no range it is refused as `--diff
  --repo` is (`DIFF_WITH_REPO`). `window.rs` `WindowKind = Merge | Compare { start } | Range { ai, start }` carries
  each window's start options, the only ones its start script reads: `start_script(theme, kind)` adds
  `data-ai="on"` for `Range { ai: On }` and `data-open="mergeRequests"` for a compare or range kind with
  `MergeRequests`, never for the merge window; `open_with_data_folder(title, kind, manage, at_exit)` and
  `open_and_wait(app, title, kind)` take the kind whole.
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
- **Merge requests** (`merge_requests.rs`, crate `yamt-merge-requests`, plan §2 #128–#137, #144, #149, #152, #153, #158, #162, #169, #171–#173): `manage(app, folder,
  app_folder, ai)` runs for the compare window (its start folder, `window.rs` `open_compare`) and the range window (its
  repository, `range.rs`) and manages `MergeRequestState { gitlab: Option<GitLabRepository>, range_dir, pages:
  Mutex<BTreeSet<WebPage>>, merged: Mutex<MergedPairs>, pictures: Pictures, job_logs: JobLogs, ai: Ai }` (`gitlab_repository`: offline, once; `ai` the window's
  own `--ai`, read only by `opened` for Show Diff; `pages`, `merged`, `pictures`' shelf and `job_logs` never held together or with another `Mutex`;
  `merged`, the run's merged pairs, is locked for a whole check, so a second load's check waits and then merges no
  pair twice). Commands,
  registered for every window (the merge window never calls them): `find_gitlab_project() -> GitLabProject`
  (`none` | `found { repository }`); async `list_merge_requests(messages: Channel<ListMessage>) -> ()` sends every page
  as `ListMessage::Page { page }`, then exactly one `ListMessage::End { end: ListEnd }` on the channel (tauri 2.12
  delivers a channel message of 8 KiB or more by a later fetch, so the end cannot be the command's answer), each page's
  merge-request and failed-job pages (`row_pages`) added to `pages` and its uploaded pictures offered to `pictures` before it is sent (`merge_requests/list.rs` `forward_page`
  through `offer(state, pages, pictures)`, one of the two writer paths of `pages` with `offer_described` (below): `pages` and the pictures' shelf locked one after the other, never together); then, when the list reached
  the project (`Listed::to_check` is `Some`), it runs `check_conflicts` under `merged` and sends each row the check
  changed as `ListMessage::Checked { row: CheckedRow }` (a send failure is not logged: the check logs one line per
  load); the command answers only after the check; async
  `open_merge_request(iid) -> OpenReply` (`prepare_open`, then `second_window::start_range`); `open_page(page) -> PageOpened`
  opens only a page in `pages` (else `NotOffered`, warning "a GitLab page this window was never sent"). Resolving a merge request's conflicts in this checkout (plan §2
  #138–#143, crate `yamt-local-merge`, §3.10), each async on a `blocking_reply` worker: `resolve_merge_request(iid) ->
  ResolveReply` (`prepare_resolve`, then `yamt_local_merge::start`, then `second_window::start_merge`: `Started {
  started }` | `WindowFailed { started, message }` (the merge and its record stay) | `Refused { refusal: Refusal }` |
  `GitLabRefused { refusal: ResolveRefusal }`; a window without a project answers `GitLabRefused` `Failed`);
  `continue_merge_request(iid) -> ContinueMergeReply` (`find_live`: none, another iid's record or a read problem →
  `Ended`; `window_is_open` → `AlreadyOpen`; else `start_merge` → `Opened { branch, target }` | `WindowFailed {
  message }`; nothing in git changes; no project → `Ended`). After a window started, both answer only once it holds
  its claim (`wait_for_window_claim`: `window_is_open` every 50 ms, `CLAIM_PROBE_INTERVAL`, for at most 5 s,
  `CLAIM_WAIT`; a time-out logs a warning and the reply stays), so the page's next `find_local_merge` never reads the
  new window as closed. `find_local_merge() -> LocalMerge` (`free` | `merging {
  iid, windowOpen }`; no project → `Free`). Async `rerequest_review(iid, username) -> RerequestReply` (on a `blocking_reply`
  worker: `yamt_merge_requests::rerequest_review` with `Glab::find()`; no project → `Failed`). Async `read_job_log(page) ->
  JobLogReply` (on a `blocking_reply` worker, `merge_requests/job_logs.rs` `job_log_reply`, RK57): a page not in `pages`
  → `NotOffered` with a warning and no glab run; a `Log` kept for the page → that log, no glab run; no project →
  `Failed`; else `yamt_merge_requests::read_job_log` with `Glab::find()`, and a `Log` is kept in `job_logs` (`JobLogs`:
  `Mutex<BTreeMap<WebPage, JobLog>>`, the run's logs; a failure is never kept, so the next ask reads GitLab again;
  never locked while glab runs). Async `read_discussions(iids) -> Vec<RowDiscussions>` (#162, on a `blocking_reply`
  worker, `merge_requests/discussions.rs` `discussions_reply`, RK60): no project → `unread_discussions(iids,
  NO_PROJECT)` (each row of the batch `Failed`); else `yamt_merge_requests::read_discussions` with `Glab::find()`, then
  every answered note's `page` and the authors' uploaded pictures go through `offer` before the rows are returned
  (`pages` never held while glab runs), so a click on a comment opens through `open_page`. Async `search_people(text) ->
  PeopleSearchReply` and `change_people(iid, change: PeopleChange) -> PeopleChangeReply` (#169, on a `blocking_reply`
  worker each, `merge_requests/people.rs` `search_reply`/`change_reply`, RK53): no project → `Failed { NO_PROJECT }`;
  else `yamt_merge_requests::search_people`/`change_people` with `Glab::find()`, then the people found, or everyone in
  GitLab's answered lists, offered to `pictures` through `Pictures::offer` before the reply is returned. Async
  `read_description(iid) -> DescriptionReply` (#171–#173, on a `blocking_reply` worker, `merge_requests/description.rs`
  `description_reply`, RK41, RK53): no project → `Failed { NO_PROJECT }`; else `yamt_merge_requests::read_description`
  with `Glab::find()`, then `offer_described` remembers its linked `pages` (in `pages`) and then its uploads (through
  `Pictures::offer_uploads`), each lock held alone, before the reply is returned, so a click on a link opens through
  `open_page` and an uploaded image loads through the picture scheme. `offer` and `offer_described` are the two writers
  of `pages` and of the pictures' offered set. GitLab, git and launch problems are values (`ListEnd`, `OpenReply`,
  `PageOpened`, `ResolveReply`, `ContinueMergeReply`, `RerequestReply`, `JobLogReply`, `DiscussionsAnswer`, `PeopleSearchReply`, `PeopleChangeReply`, `DescriptionReply`), never an `IpcError`; a window without a project answers `Failed`.
- **Profile pictures and uploads** (`merge_requests/pictures.rs`, plan §2 #152, #173, RK53): the asynchronous URI scheme `yamt-picture`
  (`PICTURE_SCHEME`, registered in `commands.rs` for every window; the window's `PICTURE_SCHEME` names the same) answers
  `GET yamt-picture://localhost/<name>` on a `spawn_blocking` worker (`answer_picture`), so the webview never waits:
  `picture_answer` takes a name that is a username of `[A-Za-z0-9._-]` or an `UploadKey` (`UploadKey::is_key`:
  `upload~` and 32 lowercase hex digits) that this run offered — a username from a list, a `read_discussions` reply, a
  `search_people` or a `change_people` reply (`Pictures::offer` from `offer` or `merge_requests/people.rs`), an upload key
  from a `read_description` reply (`Pictures::offer_uploads` from `offer_described`); each name's latest `PictureAddress`
  wins — fetches it once per run through `fetch_picture` (an avatar: `glab api <address>`; an upload: its uploads API
  route, then its web path on `(HTTP 403)`/`(HTTP 404)`; failures remembered too), and answers its bytes with the sniffed
  `Content-Type` and `X-Content-Type-Options: nosniff`; anything else is 404 with an empty body and no glab run.
  `Pictures` is the one gate: a `Mutex<PictureShelf>` (offered, fetched, `running` ≤ `PICTURE_FETCHES` 4) and a `Condvar`
  the askers wait on for a running fetch of the same picture or a free turn; the shelf is never held across a glab run.
  A Gravatar picture or another site's image in a description never passes through yamt: the window loads Rust's checked
  address itself. The CSP (`tauri.conf.json` `csp` and `devCsp`): `img-src 'self' data: yamt-picture:
  http://yamt-picture.localhost https:` (Gravatar's two hosts inside `https:`); scripts, frames, media, fonts and
  `connect-src` stay the app's only (pinned by `merge_requests/tests/csp.rs`).
- **A second process** (`second_window.rs`, plan §2 #132, #138; amends "one process, one window": opening a merge
  request's changes or resolving its conflicts starts another yamt): `start_range(range)` runs `yamt --diff=<base_sha>..<head_sha>
  --repo <root>` (`range_arguments`, no `--ai`; a spawn failure → `OpenReply::StartFailed`), `start_merge(root)` runs
  `yamt --repo <root>` (`merge_arguments`: the merge window, yamt's default mode; `Err` is why it did not start); both
  through one `spawn` with cwd `root`, stdin and stdout null, stderr inherited; the program is `$APPIMAGE` when this one runs from
  an AppImage (`appimage.rs` `running_appimage`: the mount goes away with this process), else `current_exe`; in a
  process group of its own on Unix (`process_group(0)`), `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP` on Windows; a
  thread waits for its exit (`reap`).
- **A merge yamt started, at start-up** (`outcome.rs` `startup`, plan §2 #140, #143): it opens the session, then
  `claim_recorded_merge`: with a live record it takes the window claim (`yamt_local_merge::claim_window`, retrying for
  up to 1 s); another window holding it → exit 2 "the merge of !<iid> is already open in another yamt window". A live
  record opens the window even when the stop lists no file, so a clean merge can be committed. `Startup::Merge {
  session, claim }` hands the `WindowClaim` to `lib.rs` `merge()`, which holds it until `window::run` returns.
- **Pasting on Linux** (`clipboard.rs`, plan §2 #99): `read_clipboard(selection: ClipboardSelection) -> Option<String>`
  (`ClipboardSelection = Clipboard | Primary`), registered for both windows, no managed state. GTK's text request is
  started on the main thread (`run_on_main_thread`) and its answer awaited on a `spawn_blocking` thread, so a hung
  owner never blocks the window; `None` = no owner, no text, unreadable, or the main thread gone; other systems always
  `None`. Never asks GTK for the clipboard's format list: WebKitGTK 2.54.0/2.54.1 crash reading a failed one
  (`Clipboard::formats`, upstream bug 324466), which is why the window takes every paste on Linux (§5.4 `linuxPaste.ts`).
- `run()` (from `main()`): NVIDIA DMABUF guard first (`graphics.rs`, plan §2 #43), before logging and `tauri::Builder`; CLI `yamt [--repo <path>]` / `yamt --diff`
  (`--diff` with `--repo` is a usage error) / `yamt --diff=<a>..<b> [--repo <path>]`; every window's folder goes through
  `from_start_dir` (a relative path read from `OWD` under an AppImage);
  nothing to merge → message, exit 0; not a repository → message, exit 2; at close exit 0 iff
  `remaining() == 0`, else 1; after Abort exit 1 with `<operation> aborted`, after a finished Continue exit 0 with
  `<operation> finished` (#88/#89). Window title `<repository folder> — yamt`.
- `export-bindings` bin writes `frontend/src/ipc/bindings.ts`. It needs the `bindings` feature, so
  `cargo tauri build` neither builds nor bundles it: tauri bundles every bin of the package unless
  its required features are off, and the universal macOS build makes only the main binary.

### 3.6 `settings` — the per-user settings file

Plan §2 #57, #163. Owns the file, never what a key means (the window does, `frontend/src/ipc/keys.ts`).

- `Places::new(config_dir, home)`: the default file `<config>/yamt/settings.json` and the location
  file `<config>/yamt/settings-location` (one line: the file in use when it is not the default).
- `StoredSettings { theme, antialiasing, keys, languageServers, agent, discussionDetails }`: `antialiasing` is `subpixel` (default) or
  `greyscale` (#60); `keys` maps an action id to key strings, only for actions whose keys differ
  from the window's defaults; ids and key strings are opaque text here; `languageServers { repositories:
  { <root>: "start" | "dontStart" }, off: { <root>: [keys] }, added: [{ command, fileTypes }] }` (#67/#70/#83), written
  only when not empty; `off` defaults to empty (a 0.4.0 file reads with nothing off), its keys are the window's text;
  `discussionDetails` (`DiscussionDetails` `full` (default) | `lazy` | `off`, file key `"discussionDetails"`, #163: when
  the merge-request page reads each row's open discussions) is written only when not `full`, so a file without it reads
  as `full`; an unknown value is `Error::Broken`.
- `read`, `set_theme`, `set_antialiasing`, `set_keys`, `set_repository_answer`, `set_server_switch`, `set_added_servers`,
  `set_agent`, `set_discussion_details`, `relocate`, `stored_at_start`. A read never
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

### 3.8 The range window, its threads and the AI (plan §2 #103–#127, #145–#148)

- **`range` (yamt-range).** `spec` keeps `a..b` / `a...b` as typed; `open` resolves both sides (the merge base on the
  left for three dots) into `Compared` with git's `%h` short ids; `entries` reads one `diff-tree -r -z --raw --numstat
  -M --diff-algorithm=histogram --ignore-submodules=none` run into one entry per file (kind, paths, counts, binary, too
  large over `MAX_TEXT_BYTES`, submodule); `load` gives a file's two texts; `search` pages the text files' sides with
  their line changes for the window-wide search (`Range::search_texts(from)`, `SEARCH_PAGE_BYTES` ~4 MiB of blobs
  read per page, the files left out by the same `decide`/`read_sides`/`decoded` rule `load` uses; `merge-core`
  `line_changes`, which `compare` builds on, #127); `lock` takes `PairLock` on
  `<data_dir>/yamt/range/<repo key>/<left>-<right>/lock` (one window per repository and commit pair, #107;
  `PAIR_SEPARATOR`, `pair_right_commit`).
- **`review` (yamt-review).** `ThreadStore` owns `threads.json` format 2 in the pair folder (#117, #146): threads on a
  `ThreadPlace { start: DiffLine, end: ThreadLine }` (#145: the lines from `start` to `end` in GitLab's one-column
  order, both included; `DiffLine` = `Removed { left } | Added { right } | Unchanged { left, right }` carries no column,
  `end`'s `ThreadLine` decides the column of the box and the badge; a one-line thread is `ThreadPlace::one_line(line)`,
  whose start is its end's own line), messages with a `Note { text }` or `AiAnswer { session, turn }` body (#121) and a
  `Posting` (`NotQueued | Queued | Refused | Pending`). A format-1 file (`thread_file/format_1.rs`) reads as one-line
  places and is never rewritten by a read; the first change writes format 2; format > 2 is `NewerFormat`, so an older
  yamt refuses a format-2 file by name, untouched (RK49). `runs_forward` (where both ends have a left line, start's is
  not after end's; the same for right lines) refuses a backward place at `add_thread` (`BackwardPlace`, after
  `EmptyMessage` and `UnknownFile`; the app answers it as `Git` with its words) and makes a loaded one `Broken`; ends
  with no side in common are ordered only by the editor. `edit_note`/`delete_message` change only an unsent `Note`
  (#123: an edited waiting note waits with its new text; a thread emptied by a delete goes; `NotANote` for an AI
  answer); `set_session`/`add_ai_answer` (the one turn-numbering rule: the count of
  that session's answers in the thread). `check_gitlab` answers `LinedUp | NotLinedUp { why }` from the pure #119 rule.
  `send_queue` lists the user's drafts first, never lets one draft stand for two messages, re-reads each message just
  before its post (a message unqueued or edited mid-send wins), posts through `glab api` to the draft-notes route with
  an explicit position (#118), and reports progress per message. The position's `old_line`/`new_line` name the place's
  end (`gitlab_lines`, the 1-based `DiffLine::left`/`right` every end of a body uses); a one-line place posts that body
  unchanged, a range adds `position[line_range] { start, end }` (#147, `gitlab/line_range.rs`: each end
  `{ line_code, type?, old_line?, new_line? }`, `type` `old` for a removed end, `new` for an added one, left out for an
  unchanged one, absent keys never `null`). `position/line_codes.rs` numbers the ends from the file's differences,
  loaded once per range message through `Range::load` (`FileDiff`: the differences and whether each side has no line):
  `line_code` = `<SHA-1 of the new path>_<old>_<new>` by GitLab's parser (an unchanged line its own two numbers, a
  removed line the new number of the line after its difference's removed lines, an added line the old number of that
  line, 0 for a side with no line at all); a changed end inside no difference is refused, "the thread's lines are not
  in this diff any more" (RK48: yamt's differences are `merge_core::compare`'s, GitLab's git's). Drafts read back
  (`gitlab/drafts.rs`) parse `line_range` (`null` or missing: none); `same_draft` also compares both range ends by
  `type`, `old_line`, `new_line`, so a one-line draft never stands in for a range nor a range draft for one line.
- **`pipe` (yamt-pipe).** `Running::start`/`start_without(removed env)`: one supervisor, a stdin writer, a stdout
  reader per `Framing { ContentLength, Lines }`, stderr as 8 KiB log lines; `Exited` once and last; a stop is a grace,
  then a kill. `lsp-host` and `agent` both use it (#109).
- **`agent` (yamt-agent).** `Workspace` owns the AI's checkout and process (#110): a shared clone without remotes,
  branches or tags made in `checkout.partial` and renamed to `checkout`; the user's `GIT_*` repository variables never
  reach a git run on it or the agent; `look` answers `Missing | Clean | Changed { files, refs, head_moved } |
  Unreadable` (ignored-only new files are clean, #115; the AI's branches and stash are changes, #122); `discard` and
  `end` stop the agent before any removal by construction; a partial-clone source is refused by name; other pairs'
  leftovers are swept outside the window's AI lock.
- **`src-tauri`.** `args`: `Invocation::Range { spec, repo, ai, start }` (`--ai` or `YAMT_AI` accepted with every
  mode, kept for a range and by the compare window's merge-request page; `--mr` → `start`, §2 the compare window).
  `start_script` writes `data-window="range"`, `data-ai="on"` for `WindowKind::Range { ai: On, .. }` and
  `data-open="mergeRequests"` with `start: MergeRequests`. `range.rs`: `RangeState` with
  `Mutex<ThreadStore>` and the send guard (the guard `try_lock`ed for a whole send, the store locked only between glab
  calls), commands `open_range`, async `load_range_file` and async `search_range_texts(from) -> SearchTexts` (#127).
  `review.rs`: `list_threads`, `add_thread`, `add_note`,
  `queue_message`, `unqueue_message`, `edit_note`, `delete_message` (both refused with `SendRunning` while a send
  runs, #123), `set_thread_session`, `add_ai_answer`, `check_gitlab`, async `send_queue` (a
  progress `Channel`). `ai.rs`: `Mutex<AiState>` (`AiState { Off | On(Workspace) }`, `AiState::workspace()` the one
  `AiOff` mapping), commands `prepare_checkout`, async `start_agent`, `send_to_agent`, `stop_agent`,
  `checkout_changes`, `discard_checkout`, `diff_texts` (`merge_core::compare` on a worker, #114); a page load stops
  the agent (deferred while the lock is held), the exit ends the workspace. `settings.rs` gains `set_agent`.
  `IpcError` gains `AiOff`, `RemoveFailed`, `UnknownThread`, `UnknownMessage`, `EmptyMessage`, `MessagePending`,
  `NotANote`, `SendRunning`.
- **Window.** `RangeSource` extends `SettingsSource, ReviewSource, MergeRequestSource` (§4) with `openRange(): RangeStart`,
  `loadRangeFile(file)` and `searchTexts(from)` (#127); `ReviewSource`: `listThreads`, `addThread(file, place, text)`, `addNote(thread, text)`,
  `queueMessage(message, text)`, `unqueueMessage(message)`, `editNote(message, text)`, `deleteMessage(message)`,
  `setThreadSession(thread, session)`,
  `addAiAnswer(thread, session)`, `checkGitLab()`, `sendQueue(onProgress)`; `SettingsSource`/`ChunkSource` gain
  `setAgent(current, agent)`; `AgentSource` (the seven agent commands) is built only in `main.ts` with AI on.
  `jsonrpc/` is the one JSON-RPC connection; `agent/` is the ACP client (`AgentClient { ask, loadConversation,
  editDiff, isRunning, destroy }`, the permission table, the fold of a turn); `ipc/threadLine.ts` holds the domain
  `ThreadPlace`/`DiffLine` (`toThreadPlace` brands every number of both ends, `diffLineOf`, `onePlace`, `sameDiffLine`,
  `isOneLine`); `editor/range.ts` `RangeController`
  shows two read-only columns with the threads' block rows and collapses unchanged lines behind the merge window's
  wave (`options { preferences, collapsed, threads }`, `setCollapsed`; a thread's unchanged lines are never hidden,
  #126, #145), starts a thread from a drag over the line numbers (`events.startThread(place)` on release, #145, #148),
  tints the drag's, every draft's and the hovered thread's lines (§5.2) and goes to
  a search finding (`goTo({ pane, match })`, #127);
  `editor/markdown.ts` `MarkdownView` renders Markdown as DOM nodes only (`show(text)`, #112) and one code block in
  its look and the panes' colours (`showCode(language, text)`, the description panel's code, #171), reached only through
  `ui/useMarkdown.ts` (`useMarkdown`, `useMarkdownCode`). The range root (`RangeApp`, `rangeStore.ts`) owns the threads (`rangeThreads.ts`, `rangeOpen.ts` — each
  stored thread's box key and open state —, `rangeDrafts.ts`: a draft holds its `place`, and a drag of the same place
  — the same `start`, the same shown column and line of `end` — focuses it, any other opens a new draft;
  `rangeAdds.ts` the one reactive record of adds in flight, which Ask AI reads, #124), GitLab (`rangeGitLab.ts`) and the
  AI (`rangeAi.ts`: `ask(from: AskFrom, typed)` is Ask AI's one step — a non-blank typed text added first as the note
  or the new thread, then asked — and `canAsk(from, typed)` its one enabled rule, #124; `rangeAiRules.ts` the pure
  rules it reads: the prompt rule, the held tables, the replay checks; `rangeAiView.ts` the answer's view); every
  thread word is in `rangeThreadText.ts` (`threadPlaceText`: `path:N`, `path:a-b`, `path:-a to +b`, and both paths for a
  renamed file's mixed range; the box header, its label and the AI's place value use it), every AI word in `aiText.ts`; closing asks `aiMayClose` (Keep Changes
  preferred, #111).
  `AiTurn`'s "Thinking and steps" list is capped at 20rem and follows its end through `ui/useFollowEnd.ts`, the server
  log's one follow rule (#124).
  The tree's folder rows show the sum of their files' `+a −r` (#125): `rangeFolderSums.ts` `folderSums` keys git's
  counts by the folder path a row carries (through `fileTree.ts` `folderPaths`, so a joined chain finds its deepest
  folder's sum), built once per list by `RangeApp`, which fills the tree's optional `folder` slot (after the label;
  the merge window passes none) with `RangeCounts.vue`, the one `+a −r` pair of file and folder rows.

### 3.9 `merge-requests` — the GitLab project's open merge requests (plan §2 #128–#139, #149, #151–#153, #158, #162, #169, #171–#173)

Package `yamt-merge-requests`; depends on `gitio` and `range` among `yamt-*` (may use `merge-core`), never on tauri
(`scripts/arch-check.sh`); no `Mutex`; the one memory across loads is the run's `MergedPairs`, held by the shell and
lent to `check_conflicts` (plan §2 #149). Every glab call goes through `Glab::get`/`Glab::post`/`Glab::auth_status`
(§3.2); GitLab, git and launch problems are values, never errors. The writes to GitLab are the re-request mutation and,
per people change, one `APPEND` or `REMOVE` of one username (RK54).

- **Types crossing the IPC** (`lib.rs`, re-exporting `row.rs`, `people.rs`, `labels.rs`, `picture.rs`, `rerequest.rs`, `people_search.rs`, `people_change.rs`, `job_log.rs`, `discussions.rs`, `description.rs` and
  `list.rs`'s types; the list's row types live in `row.rs`): `GitLabProject` `none` | `found { repository }` (the absolute common git dir,
  the key the window remembers filters and due dates by), `MergeRequestIid`, `Person { username, name, picture:
  PersonPicture }` (`uploaded` — the window asks the scheme by username — | `gravatar { address: GravatarAddress }` |
  `none`), `Reviewer { person, state: ReviewState }` (`requested` | `reviewed` | `approved` | `changesRequested`, folded
  as GitLab's reviewer list does: `approved` first, `UNREVIEWED`/`REVIEW_STARTED`/none → requested, `REVIEWED`/`UNAPPROVED`
  → reviewed, `REQUESTED_CHANGES` → changes requested; an unknown state → requested, warned once per load), `Label {
  title, colors: LabelColors | null }` (`LabelColors { background, text }`, each `#rgb` or `#rrggbb`, else none), `CiStatus` (GitLab's
  fifteen folded into seven: `passed`, `failed`, `running`, `pending`, `canceled`, `skipped`, `manual`; an unknown one
  `pending` with a warning), `WebPage` (a string only `WebPage::job`, `WebPage::merge_request`, `WebPage::note` and `WebPage::linked` make), `FailedJob {
  name, stage, allowFailure, page }`, `Pipeline { status, failedJobs, moreFailedJobs }`, `MergeRequestRow` (`createdAt`
  as GitLab sent it, `author: Option<Person>`, `assignees`, `reviewers: Vec<Reviewer>`, `labels: Vec<Label>` in GitLab's
  order, `openDiscussions` = resolvable − resolved saturating, `approvedBy: Vec<Person>` in GitLab's order,
  `mayRerequest` (your `updateMergeRequest` permission: re-request a review, add and remove people), `page` its
  GitLab page or `None` off https, `size: Option<ChangeSize { additions, deletions, files }>` (the sums over
  `diffStats`, `files` its entry count; +0 −0 for no entries with `diffRefs` set — a computed empty diff —, none
  without `diffRefs` — not yet computed), `readiness: Readiness`, `fromFork`; #138; `hasDescription`: GitLab's
  `description` holds more than white space, #171), `RerequestReply` `requested {
  reviewers }` | `notReviewer` | `notOpen` | `glabMissing` | `notLoggedIn { detail }` | `refused { message }` | `failed
  { message }`, `PeopleSearchReply` `found { people: Person[] }` | `glabMissing` | `notLoggedIn { detail }` | `failed {
  message }`, `PeopleChange { group: PeopleGroup (assignees | reviewers), action: PeopleAction (add | remove), username }`,
  `PeopleChangeReply` `changed { people }` | `unchanged { people }` (`people: MergeRequestPeople { assignees, reviewers }`
  as GitLab answered) | `glabMissing` | `notLoggedIn { detail }` | `refused { message }` | `failed { message }`,
  `DescriptionReply` `read { description: Description { blocks } }` | `glabMissing` | `notLoggedIn { detail }` | `failed
  { message }` with `DescriptionBlock` `paragraph { inlines }` | `heading { level: HeadingLevel }` | `code { language,
  text }` | `list { numbering: ListNumbering, items: DescriptionItem { task: TaskBox, blocks }[] }` | `quote` | `rule` |
  `table { head, body: DescriptionRow { cells: DescriptionCell { header, align: CellAlign, inlines }[] }[] }` |
  `details { open, summary, blocks }`, `DescriptionInline` `text` | `emphasis` | `strong` | `strike` | `code` | `link {
  link: DescriptionLink, inlines }` | `image { image: DescriptionImage, caption }` | `lineBreak`, `DescriptionLink`
  `page { page: WebPage }` | `refused { address }`, `DescriptionImage` `uploaded { key: UploadKey }` | `web { address }`
  | `refused` (`description/address.rs`, re-exported), `Readiness` `ready` | `conflicts { also:
  BlockedReason[] }` | `needsRebase` | `checking` | `blocked { reason }` | `mergesCleanly` (yamt's own merge is clean
  while GitLab still checks or keeps a conflict), `BlockedReason` (GitLab's
  `DetailedMergeStatus` in yamt's words: `draft`, `discussions`, `approvals`, `pipelineMustPass`, …, `other { status
  }`), `MergeRequestPage { me, rows }`, `CheckedRow { iid, readiness }` (a row the local check changed), `ListEnd` `loaded` | `cut { limit }` |
  `glabMissing` | `notLoggedIn { detail }` | `failed { message }`, `OpenReply` `opened` | `alreadyOpen` | `preparing` |
  `notOpen` | `noRemote` | `fetchFailed` | `missingCommit` | `startFailed` | `glabMissing` | `notLoggedIn` | `failed`,
  `PageOpened` `opened` | `notOffered` | `failed`, `ResolveRefusal` `notOpen` | `fromFork` | `noRemote { project }` |
  `glabMissing` | `notLoggedIn { detail }` | `failed { message }`; `RangeToOpen { root, spec }` and `ResolveTarget {
  root, iid, remote, branch, target }` (not IPC). `PAGE_SIZE` 100,
  `MAX_MERGE_REQUESTS` 500, `MAX_FAILED_JOBS` 50.
- **Detection** (`detect.rs`, #130): `gitlab_repository(folder)`: `Repo::discover`, `Repo::remote_urls`,
  `Repo::common_dir`, no network and no glab; a remote is on GitLab when its URL's host (scp-like or
  `scheme://[user@]host[:port]`; never a local path, `file://` or a drive letter) is `gitlab.com`, has a dot-label
  starting with `gitlab`, or is `GITLAB_HOST`/`GL_HOST`. `GitLabRepository` holds the `Repo` and only those remotes, in
  config order (`gitlab_remotes`).
- **The list** (`project.rs`, `query.rs`, `page.rs`, `readiness.rs`, `list.rs`, #131, #138, #151): glab missing → `GlabMissing`;
  `project.rs` `logged_in_project` (the one fold of `auth_status` and `glab api projects/:fullpath` for the list, opening,
  resolving, re-requesting, the job log, the discussions, the people search and change and the description; `NoProject` → `ListEnd`/`OpenReply`/`ResolveRefusal`/`RerequestReply`/`PeopleSearchReply`/`PeopleChangeReply`/`DescriptionReply` by `From`) → `NotLoggedIn`/`Failed`, else
  `Project { full_path, web_path, web_origin }` (`web_path`:
  the `web_url` after the origin, so any sub-path GitLab is installed under stays; origin and path only on https,
  else `None` and empty); then at most 5 pages of the one single-line GraphQL query (`list_args`: `api graphql -f query=… -f
  fullPath=<path> -F first=100 [-f after=<cursor>]`; 172 of GitLab's complexity limit of 250 logged in on gitlab.com; it asks
  `description` (folded to `hasDescription`, the text never kept), `author { username name avatarUrl }`, `avatarUrl` on
  assignees, reviewers and approvers, reviewers' `mergeRequestInteraction { approved reviewState }`, `userPermissions {
  updateMergeRequest }`, labels' `color textColor`, `detailedMergeStatus conflicts diffStats { additions
  deletions } diffRefs { baseSha } sourceProjectId targetProjectId targetBranch diffHeadSha` too — never `diffStatsSummary`, beside which gitlab.com answers
  `CONFLICT` for clean merge requests in a list), each its own glab call handed to `on_page` as a `ListedPage { page,
  pictures: Vec<OfferedPicture> }` (the page's uploaded pictures, one per username, the last named) as
  it arrives; a 5th page with more to come → `Cut { limit: 500 }`; a failing page → `Failed`, the pages sent stay;
  GraphQL `errors` win over `data`; the first page's `queryComplexity` logged at info. `list_merge_requests` returns
  `Listed { end, to_check: Option<ConflictCheck> }`: `None` when no project was reached, else every sent row's iid,
  `targetBranch`, `diffHeadSha` (`None` when missing or not a commit id) and GitLab's merge (`page.rs` builds each
  row with its `RowToCheck`). `readiness.rs` `GitLabMerge::read(status, conflicts, draft)` keeps GitLab's answer once
  per row; `readiness()` folds the status and the `conflicts` flag into one state: a conflict (the flag or `CONFLICT`)
  comes first, with the status's blocked reason and then `draft` for a draft in `also`; else the status alone
  (`merge_status`: unknown → `blocked { other }` with a warning, none → `checking`); `readiness_after(MergeOutcome)`
  lets yamt's merge decide the conflict instead of the flag (`Conflicts` → `conflicts { also }`; `Clean` → `ready` for
  `MERGEABLE`, `mergesCleanly` for `CONFLICT` or not yet checked, else the status's own state). `is_from_fork`: a
  `sourceProjectId` other than the target's, or null.
- **The local conflict check** (`check.rs`, #149): `check_conflicts(repository, &ConflictCheck, &mut MergedPairs,
  on_checked) -> CheckSummary`, on the calling thread: no row with a head → nothing runs; `Repo::version` →
  `MergeTreeRun::for_version` (`None` → stop, "git X.Y cannot merge without a checkout (needs 2.38)"); `remote_for`
  (none → stop, "no remote of the repository names the project <path>"); one `Repo::remote_refs` of `refs/heads/<t>`
  per distinct target (`open.rs` `branch_ref`, a target holding `:` left out) and `refs/merge-requests/*/head`
  (`REMOTE_REFS_TIMEOUT` 20 s; a failure stops, "ls-remote: …"); per row with a head: a ref not advertised → kept,
  `refs/merge-requests/<iid>/head` (`head_ref`) other than `diffHeadSha` → moving, kept; else the pair (target tip,
  `diffHeadSha`). A pair in `MergedPairs` is decided at once (remembered); the others' commits go through one
  `Repo::missing_commits` and at most one `fetch_without_refs` of the refs whose commits are missing (`FETCH_TIMEOUT`;
  a failure, "fetch: …", drops only the rows that needed it); then each distinct pair's `Repo::merge_tree`
  (`MERGE_TIMEOUT` 10 s), `MERGES_AT_ONCE` 2 at a time in scoped threads, none started after `MERGE_PHASE_LIMIT` 60 s,
  a panic caught as a failed merge; each outcome goes into `MergedPairs` (never cleared) and each row of the pair
  whose `readiness_after` differs from `readiness()` goes to `on_checked` as a `CheckedRow`, in finishing order.
  Writes no ref, no `FETCH_HEAD`, no index, no working tree; one log line per load (`CheckSummary`: rows, merges,
  fetched refs, remembered, moving, kept, the first problem; `warn` with a problem, else `info`).
- **Opening** (`open.rs`, `remote.rs`, #132): `prepare_open(repository, glab, iid, range_dir)`: glab, logged in, the
  project, then the details query asked afresh (not `opened` → `NotOpen`, no `diffRefs` → `Preparing`); both commits
  local → no fetch, else `remote_for` (the first GitLab remote whose URL, without a final `/` and `.git`, ends in
  `/<full_path>` or `:<full_path>`, any case; none → `NoRemote`) and `Repo::fetch_without_refs` of
  `refs/merge-requests/<iid>/head` and `refs/heads/<target>` (`head_ref`, `branch_ref`: the one place each ref is
  built, shared with `check.rs`; `FetchFailed`; a target holding `:` → `Failed`, `branch_ref` through
  `require_branch_name`); then
  `Resolved::resolve` of `<base>..<head>` (`MissingCommit`, 7 characters) and a `PairLock::take` probe let go at once
  (`AlreadyOpen`); `Ok(RangeToOpen)` for the shell to start (§3.5).
- **Resolving** (`resolve.rs`, #139): `prepare_resolve(repository, glab, iid)`: glab (`GlabMissing`),
  `logged_in_project`, then the branches query asked afresh (`branches_args`: `state sourceBranch targetBranch
  sourceProjectId targetProjectId`; no merge request or not `opened` → `NotOpen`), `is_from_fork` → `FromFork`, a
  branch holding `:` → `Failed` (`require_branch_name`), `remote_for` none → `NoRemote { project }`; `Ok(ResolveTarget)`
  for the shell to hand to `yamt_local_merge::start` (§3.10). Nothing is fetched or written.
- **People and pictures** (`people.rs`, `picture.rs`, #151, #152, #173, RK53): `People` turns GraphQL user nodes into
  `Person`s and `Reviewer`s, collecting the page's `OfferedPicture`s and the review states yamt does not know.
  `avatar_source(origin, avatar_url)` is the only maker of both avatar addresses: `Uploaded(PictureAddress)` for a path
  starting with `/`, or an `https` address of the project's origin, whose path is
  `(/segment)*/uploads/-/system/user/avatar/<digits>/<file>` (segments of `[A-Za-z0-9._~-]` — `web_page.rs`
  `is_path_segment`, no `..` —, an optional query of `[A-Za-z0-9=&._-]`); `Gravatar(GravatarAddress)` for
  `https://secure.gravatar.com` or `https://www.gravatar.com` with the path `/avatar/<32 or 64 hex digits>` and a query of
  `[A-Za-z0-9=&%._-]`; anything else (`http`, another host, a custom Gravatar host, null) → none, initials. A
  description's upload address is made only by `description/address.rs` (`PictureAddress::upload(route, web)`, crate-only,
  below). A `PictureAddress` never reaches the window. `fetch_picture(glab, root, address)` (`fetched` with an injected
  getter): an avatar is `Glab::get` of `api <address>`; an upload is `api <its uploads API route>`, then, only when glab's
  line ends in `(HTTP 403)` or `(HTTP 404)` (`page.rs` `FORBIDDEN`, `NOT_FOUND`), `api <its web address>` — glab 1.126.0
  follows a GET's redirect itself, so a `glab: HTTP 3xx` yamt sees is an error, never retried —; then PNG, JPEG, GIF or
  WebP by their first bytes (`ImageKind`, its `mime`) and at most `MAX_PICTURE_BYTES` 1 MiB (an avatar) or
  `MAX_UPLOAD_BYTES` 10 MiB (an upload), else `Err` ("larger than N MiB").
- **Re-requesting a review** (`rerequest.rs`, #153, RK54): `rerequest_review(repository, glab, iid, username) ->
  RerequestReply`: glab (`GlabMissing`), `logged_in_project`, then the reviewers asked afresh (`reviewers_args`: `state
  reviewers { nodes { id username name avatarUrl mergeRequestInteraction { approved reviewState } } }`; no merge
  request or not `opened` → `NotOpen`); not among them → `NotReviewer`, nothing written; still awaiting review
  (`is_awaiting_review`) → `Requested` with the fresh reviewers, nothing written; else the one write,
  `mergeRequestReviewerRereview(projectPath, iid, userId)` through `Glab::post` with the JSON body on stdin
  (`GRAPHQL_BODY_ARGS`: `api graphql --input -`): its first `errors` entry → `Refused`, glab's failure or a top-level
  GraphQL error → `Failed`, else `Requested` with the reviewers it answered. One log line per ask (iid and outcome,
  never a name or a message). The re-request never adds a reviewer; adding and removing people is the next paragraph.
- **People** (`people_search.rs`, `people_change.rs`, #169, RK53, RK54, RK64): `search_people(repository, glab, text)
  -> FoundPeople { reply: PeopleSearchReply, pictures }`: glab (`GlabMissing`), `logged_in_project`, then one
  `query.rs` `people_search_args` call — `project(fullPath) { autocompleteUsers(search: $search) { username name
  avatarUrl } }` as GitLab's own merge-request dropdown asks (GitLab 16.3+; at most 20, GitLab's
  `Autocomplete::UsersFinder::LIMIT`), the text as `-f search=<text>`, a raw field glab never reads as `@file` —; glab's
  failure or the first GraphQL error → `Failed` (an older GitLab's "Field 'autocompleteUsers' doesn't exist" included),
  else `Found` in GitLab's order with each found person's uploaded picture (`OfferedPicture`, one per username); nothing
  is written. `change_people(repository, glab, iid, change) -> ChangedPeople { reply: PeopleChangeReply, pictures }`:
  glab, `logged_in_project`, then one `query.rs` `people_change_body` through `Glab::post` with the JSON body on stdin
  (`GRAPHQL_BODY_ARGS`), nothing read before it: `mergeRequestSetAssignees` or `mergeRequestSetReviewers` aliased
  `changed:`, `assigneeUsernames`/`reviewerUsernames: [username]` and `operationMode` `APPEND` (add) or `REMOVE`
  (remove), the username a variable, never in the query text, so GitLab applies the change to its own list at that
  moment (never `REPLACE`, never a whole list); the payload's first `errors` entry → `Refused`; glab's failure, a
  top-level GraphQL error or an answer naming no merge request (`page.rs` `NO_MERGE_REQUEST`, the re-request's too) →
  `Failed`; else both answered lists as `MergeRequestPeople` (the list's `People` fold), `Changed` when the answered
  group shows the change (`is_shown`: an added username listed, a removed one not, ASCII case ignored as GitLab's
  `unresolved_usernames` does), else `Unchanged` (GitLab Free's one assignee and one reviewer, no permission, an unknown
  user), with every uploaded picture of both lists. One `info` line each: the search's outcome and count, the change's
  iid, group, action and outcome, never a text, a username or a message.
- **A failed job's log** (`job_log.rs`, #158, RK57; GitLab's job page as the reference): `JobLog { text, cut }` (the
  log as GitLab stores it, colour codes and all, non-UTF-8 bytes as U+FFFD; `cut` when earlier lines were left out) and
  `JobLogReply` `log { log }` | `notOffered` | `noLog` | `glabMissing` | `notLoggedIn { detail }` | `failed { message }`.
  `read_job_log(repository, glab, page) -> JobLogReply`: glab (`GlabMissing`); a page that is not
  `…/-/jobs/<digits>` (`WebPage::job_parts`, the one split `WebPage::job` shares) → `NotOffered` before any glab run;
  `logged_in_project` (`NoProject` → `JobLogReply` by `From`); `trace_route` — `projects/<the page's own project path,
  "/" as "%2F">/jobs/<n>/trace`, the path after the project's origin and without the sub-path GitLab is installed under,
  so a fork's job is asked from the fork; another origin → `NotOffered` — read whole through `Glab::get` (no `Range`
  header, no `byte_offset`); an empty answer or glab's line ending in `(HTTP 404)` → `NoLog`, any other failure →
  `Failed` in glab's words; `tail`, GitLab's `Stream#limit`: at most `MAX_LOG_BYTES` (500 KiB,
  `Stream::LIMIT_SIZE`) whole, else the last 512,000 bytes from just after their first `\n` (the line the cut lands in
  dropped, even a whole one; no `\n` → empty) with `cut`; then lossy UTF-8. One `info` line per call: the page, the
  outcome's kind, the bytes read and `cut`, never the text. Nothing is kept here: the shell keeps the run's logs.
- **Open discussions** (`discussions.rs`, `discussions/answer.rs`, #162, RK60, RK61): `RowDiscussions { iid, answer }`,
  `DiscussionsAnswer` `open { discussions }` (GitLab's order) | `glabMissing` | `notLoggedIn { detail }` | `failed {
  message }`, `OpenDiscussion { place, last }`, `DiscussionPlace` `overview` | `file { path, line }` (`newLine`, else
  `oldLine`), `DiscussionNote { author: Option<Person> (People::person), createdAt (as sent), text (the raw body), page:
  Option<WebPage> }`; the shell's `ReadDiscussions { rows, pictures }`. `read_discussions(repository, glab, iids) ->
  ReadDiscussions` answers the first `DISCUSSION_BATCH` 20 distinct iids in the asked order (100 took 22.22 s, past
  glab's deadline), nothing and no glab run for none: glab missing → each `GlabMissing`; `logged_in_project` refused →
  each `NotLoggedIn`/`Failed` (`From<NoProject>`); one `query.rs` `discussions_args` call for the batch (the one-line
  `discussions_query`, `-F iids=<JSON array of strings> -F first=<count>`; 58 of 250 for 20 on gitlab.com), its failure or
  GraphQL `errors` → each `Failed`; per row, `hasNextPage` → the same query for that iid alone with `-f
  discussionsAfter=<endCursor>`, at most `MAX_DISCUSSION_PAGES` 10 pages of `DISCUSSIONS_PER_PAGE` 100 (more → "more than
  1,000 discussions"), a failing later page, a missing cursor or an iid the answer does not name fails that row alone.
  Open = `resolvable && !resolved`; the last note is the last with `system: false` of `notes(last: NOTES_READ)` (20; a
  bot's note counts); none with `hasPreviousPage` → the row `Failed`, none without → the discussion left out. A note's
  `url` is a page only through `WebPage::note`; uploaded pictures one per username (`list.rs` `one_per_username`). One
  `info` line per call (asked, answered, failed, queries, the batch's `queryComplexity`), never a name, a body or an
  address. `unread_discussions(iids, message)`: the same batch cut, each `Failed { message }`.
- **Description** (`description.rs`, `description/html.rs`, `description/address.rs`, `description/element.rs`, #171–#173,
  RK41, RK53, RK66): `read_description(repository, glab, iid) -> ReadDescription { reply: DescriptionReply, pages:
  Vec<WebPage>, uploads: Vec<OfferedUpload { key: UploadKey, address: PictureAddress }> }`: glab (`GlabMissing`),
  `logged_in_project`, then `fetch_description` (the one request for a description: `query.rs` `description_args`,
  `MergeRequestDescription { project(fullPath) { mergeRequest(iid) { descriptionHtml } } }`, 10 of 200 logged out, asked
  afresh on every call; glab's failure or a GraphQL error → `Failed` in those words, `project: null` → `NO_PROJECT`,
  `mergeRequest: null` → `NO_MERGE_REQUEST`, `descriptionHtml: null` → empty); `html.rs` `described(html, base)` parses
  it with `dom_query` and walks it on an allow-list: paragraphs (an inline run beside blocks becomes one; `div` ends a
  run), headings h1–h6, code (`element.rs` `code`: `data-canonical-lang`, else `lang`; the `<pre>`'s text, one final
  newline dropped), lists (`ol start`; `element.rs` `task_box`: GitLab's `task-list-item-checkbox` as the item's first
  element or text, or its first `<p>`'s, → `done`/`open`/`inapplicable`, else `none`), quotes, rules, tables (`align`
  only from `text-align: left|center|right`, else `start`), `<details>` (`open`, its `summary`; a `summary` elsewhere
  gives nothing); inlines text, emphasis, strong, strike, inline code, line break, links and images (`data-src` before
  `src`; the caption `alt`, else `title`, else the address as written; an image or link inside a link is lifted out
  after it, a link left with no or only white-space content dropped; a heading's anchor link leaves nothing). No
  attribute crosses but these typed fields; unknown elements give their content; `LEFT_OUT` (`script`, `style`,
  `template`, `noscript`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `video`, `audio`, `source`, `track`,
  `canvas`, `svg`, `math`, `link`, `meta`, `base`, `head`, `title`, `button`, `select`, `textarea`, `option`, `input`
  but the task box) and comments give nothing; content deeper than `MAX_NESTING` 32 is left out. `base` is the merge
  request's GitLab page (`WebPage::merge_request`; `None` off https). `address.rs` makes every address: `link_of` → an
  `http`/`https` address, absolute or `Url::join`ed on `base`, is `page { page }` through `WebPage::linked` (`url`'s
  serialisation: no space, quote or control character), anything else (`mailto:`, `file:`, `javascript:`, `data:`, a
  relative address without `base`, unreadable) `refused { address }` as written; `image_of` → blank or not `https`
  after resolving → `refused`; an upload → `uploaded { key }` plus its `OfferedUpload`; any other `https` image → `web {
  address }` (`url`'s serialisation), never fetched by yamt. An upload is only on `base`'s origin when that origin is
  exactly `https://gitlab.com` (`LOGIN_FETCHED_ORIGIN`; a self-managed GitLab may redirect an upload to object storage
  and glab, following, would carry the login there: on any other origin an upload-shaped image is `web`, loaded by the
  webview without the login, #175), with the path `/-/project/<digits>/uploads/<secret>/<file>` or `<the project's web
  path>/uploads/<secret>/<file>` (secret 32 lowercase hex digits, `file` one segment of `[A-Za-z0-9._~%+-]`, not `..`),
  query and fragment dropped: `UploadKey` `upload~<secret>` (made only here; `UploadKey::is_key` tells the shell's
  scheme a key from a username) and `PictureAddress::upload(projects/<id or encoded path>/uploads/<secret>/<file>, <the
  web address>)`. `pages` and `uploads` once each, in document order; both empty unless `Read`. One `info` line: iid,
  the reply's kind, blocks, pages, uploads and web images, never text or an address. Nothing is written.
- **Web pages** (`web_page.rs`, `description/address.rs`, #133, #137, #162, #172): `WebPage::job(origin, web_path)` (a job's `/<project>/-/jobs/<digits>`)
  and `WebPage::merge_request(origin, web_path, iid)` (`<web_path>/-/merge_requests/<iid>`) share one check,
  `project_page`: `https://<host[:port]>` plus a path of segments of `[A-Za-z0-9._~-]`, none empty or `..`; anything
  else → no page; `job_parts` splits a job page into its project address and job number; `WebPage::note(origin,
  web_path, iid, url)` accepts GitLab's note `url` only when it is exactly `WebPage::merge_request(…)` followed by
  `#note_<digits>` (GitLab's `merge_request_url(noteable, anchor: dom_id(note))`), else none; `WebPage::linked(url)`
  (crate-only, a description's link) takes an `http` or `https` `Url` as `url` serialises it. `open_page(page)`: `xdg-open
  <url>` from PATH (Linux, BSD), `/usr/bin/open` (macOS), `rundll32.exe url.dll,FileProtocolHandler` (Windows); streams
  null, a process group of its own on Unix, a thread reaps it.
- Tests: unit tests per file (`page/tests.rs` over `tests/glab/merge-requests/`'s and `tests/glab/mr-row-details/`'s
  recorded pages; `check/tests.rs` the check's steps and its scheduler; `picture/tests.rs` the address rules and
  sniffing; `job_log.rs` the cut, lossy bytes, the trace route for the project, a fork and a sub-path, 404 against
  glab's other words; `discussions/tests.rs` system notes after and between replies, open and left out, places, twenty
  system notes, a missing iid, errors, the batch cut, pictures once, ten and eleven pages, no cursor; `web_page.rs` note
  urls; `description/tests.rs` GitLab's measured snippets and planted HTML: every element of request rule 3, the
  left-out elements, `base`/`meta`, nesting past 32, the link and image address rules, uploads only on gitlab.com in
  both path forms, a self-managed origin's upload a web image, the upload key's form); `tests/fake_glab/`
  the one fake-glab helper of `tests/list.rs`, `tests/open.rs`, `tests/resolve.rs`, `tests/local_conflicts.rs`,
  `tests/picture.rs`, `tests/rerequest.rs`, `tests/people.rs`, `tests/job_log.rs`, `tests/discussions.rs` and `tests/description.rs` (`scripts/range-repo.sh`'s
  repository and its fake GitLab: !12 local, !13 fetched; `tests/resolve.rs` on scenario `tests/glab/mr-conflicts/`;
  `tests/local_conflicts.rs` on scenario `tests/glab/local-conflicts/` over `scripts/local-conflicts-repo.sh`'s
  repository: the table's rows, the moving row, a second load merging and fetching nothing, refs, status, `HEAD` and
  `FETCH_HEAD` byte-identical, an unreachable remote, a failed fetch; `tests/list.rs`, `tests/picture.rs` and
  `tests/rerequest.rs` on scenario `tests/glab/mr-row-details/`: people, labels, sizes, the pictures fetched, the
  re-request's refusals and its one write; `tests/people.rs` on scenario `tests/glab/mr-people/`: the search's raw
  field, a search writing nothing, one `APPEND` or `REMOVE` of one username per change with the exact body, an append
  GitLab dropped and a remove it did not make `unchanged` with GitLab's lists, a mutation error `refused`, a top-level
  error `failed`, glab missing or logged out before any query; `tests/job_log.rs` on scenario `tests/glab/ci-job-log/`: a log byte for
  byte, one cut at a line start, a fork's path, `NoLog` for 404 and empty, glab missing, logged out, a merge-request
  page or another GitLab's job page asking no trace; `tests/discussions.rs` on scenario `tests/glab/mr-discussions/`:
  !82's three in order, !81 alone in one call, !79's later page, markup kept, a glab failure, glab missing, logged out,
  an empty ask running no glab; `tests/description.rs` on scenario `tests/glab/mr-description/` (a gitlab.com project)
  and its nested `self-managed/`: pages and uploads, an upload through the uploads API with the login, its web path
  after a 404, missing on both, a redirect on either route refused and never retried, another site's image and a
  self-managed upload never reaching glab, the planted description, failures, `hasDescription` in the list, nothing
  written); `tests/detect.rs` over real repositories.

### 3.10 `local-merge` — the merge of a merge request yamt starts in the user's checkout (plan §2 #139–#143)

Package `yamt-local-merge`; depends on `gitio` only among `yamt-*`, never on tauri (`scripts/arch-check.sh`); serde,
serde_json, specta, thiserror, tracing. Every git run goes through `Repo` (§3.2); no state in memory: the record on
disk is read fresh by every caller.

- **Types** (`lib.rs`): `MergeRequestBranches { iid, remote, branch, target }` (not IPC); crossing the IPC: `Started {
  branch, target, conflicts }` (`conflicts: false`: GitLab's flag was stale), `Refusal` `alreadyMerging { iid: u32 |
  null }` (`null`: another start holds the start lock) | `busy` | `uncommittedChanges` | `fetchFailed { message }` |
  `localAhead { branch }` | `alreadyContains { branch, target }` | `gitRefused { message, left: Leftover[] }` |
  `recordUnreadable { path, message }`, `ReturnTo` `branch { name }` | `commit { id }` (7 hex), `Leftover`
  `notReturned { to }` | `returnRefused { to, message }` | `branchKept { branch }` | `branchCheckedOut { branch }` |
  `branchRefused { branch, message }`, `BranchBefore` `created` | `movedFrom { id }` | `unchanged`, `MergeView {
  branch, target, returnTo: ReturnTo | null, branchBefore }` (`returnTo` null when the branch itself was checked out),
  `LocalMerge` `free` | `merging { iid, windowOpen }`, `PushReply` `pushed` | `failed { message }`. Private-field
  handles: `PushOffer` (`branch()`), `LiveMerge` (`view`, `iid`, `restore`, `committed`), `WindowClaim` (dropping it, or
  the process ending, releases the claim). `Error` `Git` | `LockFailed { path, source }`.
- **The record** (`record.rs`, #140): `<git dir>/yamt-merge-request.json` through `Repo::git_path`, format 1 (`iid,
  remote, branch, target, merging, head, returnTo, branchBefore`), written to `<path>.tmp`, synced and renamed before
  the first change; live (`is_live`) only while git is in a merge of the recorded commit at the recorded head on the
  recorded branch. `find_live(root) -> Result<Option<LiveMerge>>` (an unreadable or newer record: `None` with a
  warning); `local_merge(root) -> LocalMerge` (a read problem → `Free` with a warning). The locks
  `yamt-merge-request.lock` (held by `start` while it runs) and `yamt-merge-window.lock` (`claim_window`: `try_lock`
  every 50 ms for up to 1 s, `None` when another process holds it; `window_is_open`: one `try_lock` released at once)
  live in the same git dir and are never removed (`record.rs` `hold`).
- **The start** (`start.rs`, #139): `start(root, branches) -> Result<Started, Refusal>`: the start lock
  (`AlreadyMerging { iid: None }`), the record (live → `AlreadyMerging { iid }`; unreadable → `RecordUnreadable`;
  stale → removed), `Repo::stop` (`Busy`), `has_tracked_changes` (`UncommittedChanges`), `fetch_branches` of both
  branches (`FetchFailed`), the local branch (none → created, equal → unchanged, behind → moved from it, else
  `LocalAhead`), the target already contained (`AlreadyContains`), the branch or commit to return to; any git or io
  problem before the checkout → `GitRefused { left: [] }`. Nothing in the checkout changes before the record is
  written; then `checkout_branch_at` (refused → record removed), `set_upstream` for a created branch, and
  `merge_no_commit` of `<remote>/<target>` (the full `refs/remotes/…` only when the short name is ambiguous, so git's
  message names `origin/main`); git not in that merge afterwards → `restore` and `GitRefused { message, left }`.
- **Abort's restore** (`restore.rs`, #140): after git's merge abort (or a start that failed after the checkout): back
  to the branch or commit before while HEAD is still on the branch at the recorded head (`checkout_branch` /
  `checkout_detached`; else `NotReturned`, refused → `ReturnRefused`), then a created branch deleted while it is still
  at the recorded head and not checked out (`BranchCheckedOut` while checked out), a moved one moved back
  (`move_branch`, or `reset_keep` when checked out); a branch that moved meanwhile → `BranchKept`, git's refusal →
  `BranchRefused`; the record removed. Only what still matches is put back; the rest is listed, never forced.
- **The push** (`push.rs`, #141): `LiveMerge::committed()` removes the record and gives the `PushOffer { remote,
  branch }`; `push(root, offer) -> PushReply` runs `Repo::push_branch` with `PUSH_TIMEOUT`.
- Tests: one integration binary `tests/local_merge/` (`main.rs`, `common.rs`, `start.rs`, `refusals.rs`, `abort.rs`,
  `push.rs`, `locks.rs`) over `scripts/mr-conflict-repo.sh`'s repository and its bare fake GitLab (hermetic git, RK19).

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
export type Listing = { kind: "Files"; files: FileEntry[]; disk_changes: DiskChange[]; operation: OperationView | null; sides: SideNames; merge_request: MergeView | null } | { kind: "MovedOn" }; // DiskChange = { path; result: DiskResult } (#85-#89); merge_request: the merge yamt started here (#140)
export type ContinueReply = { kind: "Finished" } | { kind: "ReadyToPush"; branch: string } | { kind: "Stopped"; message: string };
export type AbortReply = { leftovers: Leftover[] };   // empty: the window is destroyed (#88, #140)
// a merge yamt started (plan §2 #139-#143, crate yamt-local-merge)
export type MergeView = { branch: string; target: string; returnTo: ReturnTo | null; branchBefore: BranchBefore };
export type ReturnTo = { kind: "branch"; name: string } | { kind: "commit"; id: string };
export type BranchBefore = { kind: "created" } | { kind: "movedFrom"; id: string } | { kind: "unchanged" };
export type Leftover = { kind: "notReturned"; to: ReturnTo } | { kind: "returnRefused"; to: ReturnTo; message: string } | { kind: "branchKept"; branch: string } | { kind: "branchCheckedOut"; branch: string } | { kind: "branchRefused"; branch: string; message: string };
export type PushReply = { kind: "pushed" } | { kind: "failed"; message: string };
export type WriteReply = { kind: "Written"; files: FileEntry[] } | { kind: "ChangedOnDisk"; files: FileEntry[]; change: DiskChange };
export const commands: { listStop(): Promise<Listing>; loadFile(path: string): Promise<FileMergeData>; … };
// the compare window (plan §2 #93-#97): TabId, ColumnVersion, LeftLine, RightLine = number; Column = "left" | "right"
export type Difference = { left: LineRange<LeftLine>; right: LineRange<RightLine>; words: { left: SideWordChanges<LeftLine>; right: SideWordChanges<RightLine> } };
export type Comparison = { versions: { left: ColumnVersion; right: ColumnVersion }; differences: Difference[] };
export type TabLanguage = { kind: "auto" } | { kind: "picked"; name: string };
export type TabList = { tabs: { id: TabId; name: string; language: TabLanguage; holds_text: boolean }[]; shown: TabId };
export type CompareStart = { list: TabList; column_limit: number };
export type TabTexts = { left: string; right: string; comparison: Comparison };
// the merge-request page (plan §2 #128-#143, #149, #151-#153; the compare and range windows): MergeRequestIid = number, WebPage = string, GravatarAddress = string
export type ListMessage = { kind: "page"; page: MergeRequestPage } | { kind: "end"; end: ListEnd } | { kind: "checked"; row: CheckedRow }; // every page, then one end, then each row the local check changed, on the load's Channel
export type GitLabProject = { kind: "none" } | { kind: "found"; repository: string };
export type MergeRequestRow = { iid: MergeRequestIid; title: string; createdAt: string; draft: boolean; author: Person | null; assignees: Person[]; reviewers: Reviewer[]; labels: Label[]; openDiscussions: number; approvedBy: Person[]; mayRerequest: boolean; pipeline: Pipeline | null; page: WebPage | null; size: ChangeSize | null; readiness: Readiness; fromFork: boolean };
export type Person = { username: string; name: string; picture: PersonPicture };
export type PersonPicture = { kind: "uploaded" } | { kind: "gravatar"; address: GravatarAddress } | { kind: "none" }; // uploaded: the window asks yamt-picture://localhost/<username>
export type Reviewer = { person: Person; state: ReviewState }; export type ReviewState = "requested" | "reviewed" | "approved" | "changesRequested";
export type Label = { title: string; colors: LabelColors | null }; export type LabelColors = { background: string; text: string };
export type RerequestReply = { kind: "requested"; reviewers: Reviewer[] } | { kind: "notReviewer" } | { kind: "notOpen" } | { kind: "glabMissing" } | { kind: "notLoggedIn"; detail: string } | { kind: "refused"; message: string } | { kind: "failed"; message: string };
export type JobLog = { text: string; cut: boolean }; // the raw log, colour codes and all, at most MAX_LOG_BYTES (GitLab's tail); cut: earlier lines left out
export type JobLogReply = { kind: "log"; log: JobLog } | { kind: "notOffered" } | { kind: "noLog" } | { kind: "glabMissing" } | { kind: "notLoggedIn"; detail: string } | { kind: "failed"; message: string };
export type RowDiscussions = { iid: MergeRequestIid; answer: DiscussionsAnswer }; // #162: one asked row's open discussions or why they were not read
export type DiscussionsAnswer = { kind: "open"; discussions: OpenDiscussion[] } | { kind: "glabMissing" } | { kind: "notLoggedIn"; detail: string } | { kind: "failed"; message: string }; // open: GitLab's order
export type OpenDiscussion = { place: DiscussionPlace; last: DiscussionNote }; export type DiscussionPlace = { kind: "overview" } | { kind: "file"; path: string; line: number | null };
export type DiscussionNote = { author: Person | null; createdAt: string; text: string; page: WebPage | null }; // the last note by a person (system notes skipped); text is plain text, never markup; page only WebPage::note
export type DiscussionDetails = "full" | "lazy" | "off"; // StoredSettings.discussionDetails (#163)
export type ChangeSize = { additions: number; deletions: number; files: number };
export type Readiness = { kind: "ready" } | { kind: "conflicts"; also: BlockedReason[] } | { kind: "needsRebase" } | { kind: "checking" } | { kind: "blocked"; reason: BlockedReason } | { kind: "mergesCleanly" };
export type CheckedRow = { iid: MergeRequestIid; readiness: Readiness }; // sent only when yamt's own merge changes GitLab's answer
export type ResolveReply = { kind: "started"; started: Started } | { kind: "windowFailed"; started: Started; message: string } | { kind: "refused"; refusal: Refusal } | { kind: "gitLabRefused"; refusal: ResolveRefusal }; // Started = { branch; target; conflicts }
export type ContinueMergeReply = { kind: "opened"; branch: string; target: string } | { kind: "alreadyOpen" } | { kind: "ended" } | { kind: "windowFailed"; message: string };
export type LocalMerge = { kind: "free" } | { kind: "merging"; iid: number; windowOpen: boolean };
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
  continueOperation(): Promise<SourceResult<ContinueReply>>; // git's continue (#89): Finished (the app then ends), ReadyToPush { branch } (a merge yamt started is committed; the window asks to push, #141) or Stopped { message } at the next stop; fixture: ipc/fixtureOperations.ts
  abortOperation(): Promise<SourceResult<AbortReply>>; // git's abort for the operation (#88), then a merge yamt started put back (#140): no leftovers → the app ends; fixture: logs, ?leftovers answers two
  pushMergedBranch(): Promise<SourceResult<PushReply>>; // the committed merge yamt started (#141): pushed → the app ends; failed { message } → ask again; fixture: ?push=rejected fails once
  closeEndedMerge(): Promise<SourceResult<null>>; // Keep Local, or the leftovers notice's Close: the app ends
  // settings (plan §2 #57): each sends the settings in use and answers SettingsRead { path, defaultPath, stored };
  // the fixture keeps them in memory (ipc/fixtureSettings.ts, path /fixture/settings.json)
  loadSettings(current: StoredSettings): Promise<SourceResult<SettingsRead>>;
  setTheme(current: StoredSettings, theme: Theme): Promise<SourceResult<SettingsRead>>;
  setAntialiasing(
    current: StoredSettings,
    antialiasing: Antialiasing,
  ): Promise<SourceResult<SettingsRead>>; // #60: next start
  setDiscussionDetails(
    current: StoredSettings,
    details: DiscussionDetails,
  ): Promise<SourceResult<SettingsRead>>; // #163: when the merge-request page reads each row's open discussions, applied at once
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
export interface CompareSource extends SettingsSource, MergeRequestSource {
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

The merge-request page (plan §2 #128–#143, #151–#153, #158, #162, #169, #171–#173) talks to `frontend/src/ipc/MergeRequestSource.ts`, which `CompareSource` and
`RangeSource` extend:

```ts
export interface MergeRequestSource {
  findGitLabProject(): Promise<SourceResult<GitLabProject>>; // decided once at start, offline (#130)
  listMergeRequests(
    onPage: (page: MergeRequestPage) => void,
    onChecked: (row: CheckedRow) => void,
  ): Promise<SourceResult<ListEnd>>; // every page reaches onPage before the promise settles, and none after; onChecked gets this load's local results (#149), after it settled, never another load's
  openMergeRequest(iid: MergeRequestIid): Promise<SourceResult<OpenReply>>; // opened = a second yamt shows the changes (#132)
  openPage(page: WebPage): Promise<SourceResult<PageOpened>>; // a merge request's, a failed job's or a note's page, or a description's link, only one this window was sent (#133, #137, #162, #172)
  resolveMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ResolveReply>>; // the merge starts in this checkout, then its window (#139); started answers once the window holds its claim (≤ 5 s)
  continueMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ContinueMergeReply>>; // the unfinished merge's window again (#143); nothing in git changes; opened answers once the window holds its claim (≤ 5 s)
  findLocalMerge(): Promise<SourceResult<LocalMerge>>; // a merge yamt started here, and whether its window is open (#143)
  rerequestReview(iid: MergeRequestIid, username: string): Promise<SourceResult<RerequestReply>>; // GitLab's "Re-request review" (#153); requested carries the row's reviewers now
  readJobLog(page: WebPage): Promise<SourceResult<JobLogReply>>; // a failed job's raw log (#158), read only for a job page this window's list offered; a Log kept for the run
  readDiscussions(
    iids: readonly MergeRequestIid[],
  ): Promise<SourceResult<readonly RowDiscussions[]>>; // #162: a non-empty prefix of at most DISCUSSION_BATCH 20 distinct iids, in order, for a non-empty ask; the caller asks again for the rest
  searchPeople(text: string): Promise<SourceResult<PeopleSearchReply>>; // #169: the project's people whose name, username or public email matches text (GitLab's autocomplete, ≤ 20)
  changePeople(
    iid: MergeRequestIid,
    change: PeopleChange,
  ): Promise<SourceResult<PeopleChangeReply>>; // #169: one person added to or removed from one list, against GitLab's list at that moment; changed/unchanged carry both lists as GitLab answered
  readDescription(iid: MergeRequestIid): Promise<SourceResult<DescriptionReply>>; // #171: GitLab's rendering reduced by Rust, asked afresh on every call; its links and uploads offered before it answers
  uploadedImage(key: UploadKey): string; // #173: the address an uploaded description image loads from (yamt-picture://localhost/<key>), served only once a reply offered it
}
```

The brands `MergeRequestIid` and `WebPage` (an address the opener may open: `isWebPage`/`toWebPage` accept only `https://`, a GitLab page; `isLinkedPage` also `http://`, a description's link) live in `ipc/domain.ts`; the shapes and conversions in
`ipc/mergeRequestDomain.ts` (`toMergeRequestPage(raw, uploadedPicture)`: `createdAt` to ms since 1970, row and job pages branded through
`toWebPage`, each domain `Person`'s `picture` the one address its `<img>` loads — `uploaded` → `uploadedPicture(username)`,
`gravatar` → Rust's checked address as sent, `none` → `null` (initials); no other address is built; `toRerequestReply(raw,
uploadedPicture)` the same for the reviewers it carries; `toCheckedRow`: the iid branded; `toOpenReply`: `short_id` → `shortId`; `Readiness`, `Started`, `Refusal`, `ResolveRefusal`, `ResolveReply`,
`ContinueMergeReply`, `LocalMerge`, `Label`, `JobLogReply` alias the generated; `toRowDiscussions(raw, index, uploadedPicture)`: the iid branded,
an `open` answer's notes with `createdAt` in ms, `author` the domain `Person`, `page` through `toWebPage`, the refusals as
sent; `PeopleGroup` and `PeopleChange` alias the generated, `MergeRequestPeople { assignees, reviewers }` holds domain
people, `toPeopleSearchReply(raw, uploadedPicture)` and `toPeopleChangeReply(raw, uploadedPicture)` convert each person
as `toMergeRequestPage` does, other replies as sent); the description's shapes in `ipc/descriptionDomain.ts` (`toDescriptionReply`:
the generated tree, readonly, with every link's `page` at any depth branded `WebPage` by `domain.ts` `isLinkedPage`, `http://` or
`https://`, else it throws; `UploadKey` aliases the generated; `index.ts` re-exports the description types from here); the merge window's aliases `MergeView`, `ReturnTo`, `Leftover`,
`AbortReply`, `PushReply` in `ipc/localMergeDomain.ts`, which `domain.ts`'s `Listing` (`mergeRequest: MergeView | null`,
`toListing` maps `merge_request`) and `ChunkSource` import. `createTauriMergeRequests` (`ipc/tauriMergeRequests.ts`) opens one `Channel<ListMessage>` per
load; the load ends on the channel's `end` message or on the command's IPC failure, never on the command's own answer;
an unreadable page fails the load; a `checked` message goes to `onChecked` (`toCheckedRow`) whether or not the load
ended; the three resolve methods, `rerequestReview` and `readJobLog` pass the commands' replies through, `readDiscussions` converts each row by `toRowDiscussions`, `searchPeople`/`changePeople` (`peopleCalls`) by `toPeopleSearchReply`/`toPeopleChangeReply`, `readDescription` (`descriptionCalls`) by `toDescriptionReply`; its `uploadedPicture` and `uploadedImage` are both `convertFileSrc(<username or key>,
PICTURE_SCHEME)` (`PICTURE_SCHEME` = `"yamt-picture"`, Rust's `merge_requests/pictures.rs` constant: `yamt-picture://localhost/<name>`;
the CSP also admits `http://yamt-picture.localhost`, the form `convertFileSrc` gives on Windows). `createFixtureMergeRequests(log, search)` (`ipc/fixtureMergeRequests.ts` over
`ipc/fixtureMergeRequestData.ts`): `?mr=<script>` (`list`, `local`, `slow`, `many`, `empty`, `noGlab`, `loggedOut`, `timeout`,
`refused`, `pageFails`) scripts GitLab's answers (`local`: `list`'s rows and end, then 1,000 ms later `LOCAL_CHECKED`:
!640 and !635 `mergesCleanly`, !638 `conflicts`; each row's page `<ORIGIN>/-/merge_requests/<iid>`; `openPage` logs
`mergeRequests.fixture_page`; readiness by `index % 8`, size `null` when `index % 5 == 4` and +0 −0 on !635; `hasDescription` false on every 7th row from index 2 (`NO_DESCRIPTION_EVERY`, `NO_DESCRIPTION_AT`); every row an author, review
states cycling requested, reviewed, approved, changes requested, `approvedBy` the first `index % 4` people, three
reviewers on every 8th row from index 2; pictures only `data:` addresses (`fixtureUploadedPicture` stands in for the
scheme); `rerequestReview` answers after 1,000 ms and logs `mergeRequests.fixture_rerequest`: dmitri `refused`, a
non-reviewer `notReviewer`, any other reviewer `requested`; `readJobLog` logs `mergeRequests.fixture_job_log { page }`
and answers after `LOG_PAUSE_MS` 400 from `ipc/fixtureMergeRequestLogs.ts` `fixtureJobLog(page, listed)` over the
`LISTED_ROWS` 500 rows, by row and job name: every `lint:docs` a short timestamped log (`cut: false`; sections with
and without `\e[0K` before `section_start`, a `\r` progress line, `\r\n` ends, a `00O+` continuation, basic, bright,
256 and truecolor runs, an OSC title, a markup line), every `test:unit` about 9,000 lines under 512,000 bytes, built
once (`cut: true`); the `lint:docs` and `test:unit` of !632 (`NO_LOG_IID`) `noLog` and `failed` "glab timed out", of
!624 (`LOGGED_OUT_LOG_IID`) `notLoggedIn` and `glabMissing`; any other page, or a listed job of another name,
`notOffered`; `readDiscussions` (`ipc/fixtureMergeRequestDiscussions.ts` `discussionsScript(log, listedRows)`, spread into
the source) logs `mergeRequests.fixture_discussions { iids }` and answers after `DISCUSSIONS_PAUSE_MS` 400 the first
`FIXTURE_ANSWERED` 10 distinct iids by `fixtureDiscussions(iid, listed)`: each row's `openDiscussions` open ones, the
second's last comment by the row's first reviewer and newer, so turns for `sam` and for each reviewer occur both ways
(the review orders the WebKit steps expect), a markup text, !638's 400-character line, pageless notes on every 6th row, !615
(`DISCUSSIONS_FAILED_IID`) `failed`, !629 (`DISCUSSIONS_LOGGED_OUT_IID`) `notLoggedIn`, an unlisted iid `failed`; `searchPeople` and
`changePeople` (`ipc/fixtureMergeRequestPeople.ts` `peopleScript(log, listedRows)`, spread into the source): a search
logs `mergeRequests.fixture_people_search { text }` and after 300 ms finds the listed people and `SEARCH_ONLY_PEOPLE`
(erik, olga, rita) whose username or name holds the text in any case, at most 20; a change logs
`mergeRequests.fixture_people_change { iid, group, action, username }` and after 1,000 ms answers: an unlisted iid
`failed`, rita (`REFUSED_PERSON`) `refused`, a remove `changed` without them, an add of olga (`FREE_TIER_PERSON`) or of
anyone unknown `unchanged` with the lists as they are, any other add `changed` with them (a reviewer `requested`); a
`changed` reply's lists are kept per iid until the page reloads; `readDescription` and `uploadedImage`
(`ipc/fixtureMergeRequestDescriptions.ts` `descriptionScript(log, listedRows)`, spread into the source): an ask logs
`mergeRequests.fixture_description { iid }` and after `DESCRIPTION_PAUSE_MS` 400 answers `fixtureDescription(iid, firstAsk,
listed)` through `toDescriptionReply`: !640 every element of request rule 3 (pages, a refused `mailto:` and `javascript:` link, an upload that
loads, one that does not, a `data:` stand-in for another site's image, a refused image, ruby, plain and mermaid code), !639 120 paragraphs, !637
empty, !636 `failed` "glab timed out" on this window's first ask and !640's description after, !635 text that looks like
markup, a listed row without a description empty, any other "Description of !<iid>."; `uploadedImage` (`fixtureUploadedImage`)
gives a `data:` picture for `upload~0…01` and the broken picture for any other key; a resolve answers after a
second: !640 `started` with conflicts, !632 `started` clean, !624 `refused` `localAhead`, !616 `windowFailed`, any
other `started`; `findLocalMerge` is then `merging { iid, windowOpen: false }`, and after a `continueMergeRequest` of
that iid `windowOpen: true`); without `mr`, or with an unknown script (`mergeRequests.fixture_miss`), the project is
`none`. The merge window's fixture operation (`ipc/fixtureOperations.ts`) takes `?mergeRequest=created|moved|unchanged|detached|same`
with `?operation=merge` (Continue answers `ReadyToPush`), `?clean` (no file listed), `?push=rejected` (the first push
fails) and `?leftovers` (Abort leaves two).

---

## 5. Frontend modules and fences

### 5.1 State ownership — the table that prevents the classic mistake

| state                                                                                                                                        | owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | why                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| left/right/center document text                                                                                                              | CodeMirror `EditorState`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | rope, transactions, undo                                                                                                                                                                                          |
| chunk current positions in center                                                                                                            | `editor/chunkField` (`StateField`), seeded from each chunk's `middle` range (the stages' base, or the disk text, plan §2 #53)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | mapped per CM1, or set as given by `placeSpans` (an action's chained final spans, CM7; undo's snapshot through `invertedEffects`)                                                                                 |
| chunk apply status, per side (`{ local, remote }`, each `pending`/`applied`/`ignored`; plan §2 #33)                                          | same `StateField`: `setStatus` only in the throwaway steps of an action's chain (CM7); dispatched: wholesale by `placeSpans` (actions, undo/redo), or ignored on both sides when a user edit deletes an open block (CM8); side panes hold a read-only mirror the controller pushes after each center transaction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **undo must revert status together with text**                                                                                                                                                                    |
| left/right decorations                                                                                                                       | derived from the pane's fixed ranges + the mirrored status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | immutable docs                                                                                                                                                                                                    |
| find space above line 1 (while any pane's find bar is open)                                                                                  | `findSpace` field in every pane (`editor/internal/find.ts`), pushed by the controller each frame from "any pane's bar open"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | no history; same space in all three panes keeps them aligned (plan §2 #44)                                                                                                                                        |
| drag over the icons: the press, the covered changes' highlight                                                                               | the press in `editor/internal/drag.ts` (`IconDrag`); the highlight in a side-pane field (`covered.ts`), pushed by the controller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | no history; derived from the press and the pointer each frame                                                                                                                                                     |
| which side pane has the keyboard                                                                                                             | the browser's focus (CodeMirror's `cm-focused` on that pane), never copied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | an outline drawn only under it can never show where keys do not go; it hides while another app has focus (plan §2 #54)                                                                                            |
| each side's focused or remembered change                                                                                                     | `sideMarks[side]` field in that side pane's own state (`editor/internal/sideMark.ts`, `SideMark` = `change{id}` \| `alone{remembered}`), set by `setMark`, moved on by the controller's `showStatuses` push when its change stops waiting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | no history; chunk ids are fixed, so middle edits never invalidate it (plan §2 #54)                                                                                                                                |
| scroll positions                                                                                                                             | DOM (`scrollDOM.scrollTop`), driven by `editor/scrollSync`; a far scroll that shows none of a pane's rendered lines is landed exactly by that pane's `exactScroll` (`editor/internal/exactScroll.ts`, plan §2 #82)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | not state, derived                                                                                                                                                                                                |
| chunk rows, wave rows and scroll anchors                                                                                                     | one cache in `editor/internal/frame.ts` (`Frame`: rows from `lineBlockAt`, each pane's wave tops from `waveStarts`, the sync's anchors), dropped by `rowsChanged`: doc change, measured heights (`geometryChanged`), statuses, either fold field; the strips move their kept nodes per frame                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | derived, cached (plan §2 #51)                                                                                                                                                                                     |
| unchanged runs and which of their steps still hide                                                                                           | merge: the middle's `foldField` (`editor/internal/folds.ts`), value `FoldState` (= `FoldSteps<Pane>`, `foldSteps.ts`): `runs` — every level of every run for all three panes, never dropped, the middle's ranges mapped through every edit — and `hiding` — per run, how many innermost levels still hide; clicks, reveals and a delete at a wave edge only lower a count (`showFolds`), the collapse toggle sets them all to 0 or back to each run's level count (`collapseSpec`, `setHiding`); each side holds only the counts (`FoldFields.sides`, `readonly number[]`) pushed by `pushFolds` when `hiding` changes, its levels rebuilt from the fixed runs. Range: the left column's `ownerSteps` (`editor/internal/columnFolds.ts`, `FoldSteps<Column>`): runs replaced at open and at each on (`renewSpec`, from the differences and the threads then: every shown thread's unchanged lines, drafts included, are run edges — `unchangedRuns`, overlapping or touching runs joined by `joinSpans`), counts lowered by clicks and reveals; the right column's `mirrorSteps` takes the whole value from the left's update listener (`mirrorSpec`) | no history (every fold spec carries `addToHistory.of(false)`, only `placeSpans` is snapshotted); one owner per window, the others mirror it (plan §2 #63, #68, #126, #145)                                        |
| the hovered wave run                                                                                                                         | `Folding` (`editor/internal/folding.ts`), one listener set on the wave's hosts — the merge's three panes and both strips, the range's two columns and strip (`RangeFolds`, `rangeFolds.ts`); toggles `fold-wave-hover` on every `[data-fold-run]` node of that run; nodes made later ask `hovered()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | no history; pointer state only (plan §2 #63, #126)                                                                                                                                                                |
| each pane's wave phase (`--fold-wave-x`, `--fold-wave-period` on the pane hosts)                                                             | `ChainPhases` (`editor/internal/wavePhase.ts`) over a `WaveChain` (a pane, then strip–pane links): `WavePhases` for the merge's three panes, `RangeFolds` for the range's left → strip → right; written on a pane-host resize or a resolution change, only when the value changed, from the scrollers' and strips' edges rounded to device pixels; removed by `destroy()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | derived from layout, never read per scroll frame (plan §2 #51, #64, #126)                                                                                                                                         |
| the range's line-number drag (press, pointer, end, pending frame)                                                                            | `ThreadDrag` (`editor/internal/threadDrag.ts`): `#held` — the pressed `ThreadLine`, the left column's hidden lines at the press, the end, the last pointer position — set by `start`, the end moved only in its one `requestAnimationFrame` (asked by a pointer move or a column scroll) and at release; cleared with every listener at release, cancel (Escape, `pointercancel`, window blur) and `destroy`; the place goes to `RangeController` (`#dragged`) through `DragEvents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | no history; never in Vue; layout read once per frame (plan §2 #145, #148)                                                                                                                                         |
| the range thread under the pointer                                                                                                           | `RangeController.#hovered` (`editor/range.ts`): a box key written only through `ThreadHosts`' `hovered(key \| null)` from each host's `pointerenter`/`pointerleave`; dropped by `showThreads` when that key is no longer shown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | no history; never in Vue (plan §2 #145)                                                                                                                                                                           |
| the range's tinted lines                                                                                                                     | each column's `threadTint` field (`editor/internal/threadTint.ts`, read by `tintOf`), set only by the `showTint` effect `RangeController.#tint` dispatches: the union of the drag's place, every draft's and the hovered thread's (`placesTint` over `diffOrder.ts` `placeSpans`, spans joined by `joinSpans`), dispatched only when a column's spans differ from its field (`sameSpans`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | no history; `theme.css` paints `cm-thread-tint` as a translucent layer over the difference colours (plan §2 #145, #148)                                                                                           |
| file list, opened files, active file, the shown failure, notices about disk changes                                                          | `ui/store.ts` (module singleton via `useAppStore()`, no Pinia); each opened file's `MergeView` registers `{ unsaved, markSaved }` with `store.track`; the marks are git's view, re-read on window focus (plan §2 #49); `notices` (one per path) set by `ui/diskChanges.ts` from Rust's `DiskChange`s (#52)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | chrome only; what the disk looked like lives in Rust's `MergeSession`                                                                                                                                             |
| saved point per opened file (the dot)                                                                                                        | `MergeController`'s `SavedPoint` (`editor/internal/savedPoint.ts`): the Result's text, every change's statuses and which text was written (`fileText` or `asShown`), set at open, by each Save and by Mark resolved; `useMergeController.unsaved` follows `onUnsavedChange`; `ui/saving.ts` holds the per-file write claims and the last format outcome per file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | one place decides "unsaved work" (plan §2 #37, #65, #69, #71)                                                                                                                                                     |
| language-server problems in the Result                                                                                                       | `@codemirror/lint`'s field plus `problemsField` (`editor/internal/problems.ts`: each server's answer, the versions still answerable) in the middle pane; counts out through `onProblemsChange` into `useMergeController.problems`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | the lsp client owns the order of answers; the editor only maps them (plan §2 #70)                                                                                                                                 |
| language servers: specs, runs, states, logs                                                                                                  | the app's one `LanguageServers` (`lsp/`), built in `main.ts` and held by the store; `serverViews` mirrors `views()` on `onChange` (`ui/servers.ts`); processes are Rust's `Host` (`yamt-lsp-host`); the per-repository answer, the found servers switched off per repository (`off`, plan §2 #83) and the added servers are the settings file's `languageServers`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | one owner per fact; Vue holds a mirror only (plan §2 #67, #70, #83)                                                                                                                                               |
| servers found in this repository, the repository root                                                                                        | `ui/serverSetup.ts` (`found`, `root`; read as `foundServers`, `serverRoot`), written only by its detection in `startUp` (after the file list and the settings) and `refocus`; it hands `setSpecs` the found servers not switched off (`offServers`: the settings file's `off[root]`) plus the added servers and applies the answer the settings file holds; `switchServer` writes a switch and applies again                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | one sequence owner and one place off is applied; the question is asked only by `startUp` and lists only the shown servers (plan §2 #70, #71, #83)                                                                 |
| pinned language servers                                                                                                                      | `ServerPins` (`ui/serverPins.ts`, created by `createServerSetup`, which owns the root): `pinnedServers` for this root, changed only by `togglePin`; localStorage `yamt.servers.pinned` = { root: [server keys] }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a window choice like #58; pins never read `off`, so a server switched on again is pinned again (plan §2 #83)                                                                                                      |
| choice per file the editor cannot show (its sides); the side taken (choice and deleted-side text files)                                      | `choices` shallowRef in `ui/store.ts`: set by describe, dropped and described again by reset; one `taken` map (`Taken`: by a side, or by the disk) set by `takeSide` and by a disk change that staged a choice file; a deleted-side file "resolved on disk" comes from its `middle` kind; deleted by reset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | the index decides "resolved"; `taken` only picks the view's line and the middle pane's content (plan §2 #36, #47, #52)                                                                                            |
| summary counts of the open file                                                                                                              | `shallowRef` in `useMergeController`, fed by `MergeController.onSummaryChange`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | per controller                                                                                                                                                                                                    |
| what the files' grid cell shows                                                                                                              | `screen` shallowRef in `ui/store.ts` (`Screen` = files \| settings \| serverLog{name} \| mergeRequests, the last only in the compare and range windows): the gear (`openSettings`), "Back" (`closeSettings`, `closeServerLog`), Show log (`showServerLog`), a file picked in the list (`pick`); `openSettings`/`closeSettings` are `ui/screen.ts` `settingsScreen(screen)`, the one pair all three stores spread; never by the app's own `open`; a compare or range window started with `--mr` (`WindowStart.screen` `mergeRequests`) is put on its merge-request page only by `ui/startScreen.ts` `openAtStart`, through the slice's `show`, once `findProject` answered `found` (plan §2 #167)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | the files stay mounted and only hide, so their text, undo history and scroll stay (plan §2 #56, #70)                                                                                                              |
| the settings in use (theme, key bindings, the file's path)                                                                                   | `settings` shallowRef in `ui/store.ts`, changed only by the replies of the four settings calls (`ui/settings.ts`), re-read on window focus with the file list; `preferences` is computed from it and handed to every opened file's controller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | the file is the truth (Rust `yamt-settings`); a failed call keeps the settings in use (plan §2 #57)                                                                                                               |
| the page's theme attribute (`<html data-theme>`) and `color-scheme`                                                                          | set before the first frame by the shell's start script; `main.ts` reads it as the start theme through `themeOf` (an unknown value → `dark`); afterwards written only by `useThemeAttribute()` (`ui/settingsStore.ts`, called by both roots) from the registered store's `settings.theme`, with `documentElement.style.colorScheme` from `themeKind` (plan §2 #102)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | one palette per theme: `style.css` `@theme` (yamt Dark) and `themes/<name>.css` (plan §2 #57, #102)                                                                                                               |
| each pane's dark flag and key bindings                                                                                                       | CodeMirror compartments in each pane, reconfigured by `MergeController.setPreferences`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | no history; the same preferences reach every opened file, shown or hidden (plan §2 #57)                                                                                                                           |
| toolbar buttons the user hid                                                                                                                 | `HiddenButtons` (`ui/toolbarButtons.ts`, `storedValue` from `ui/windowStorage.ts`) held by the store: read as `hiddenButtons`, changed only by `toggleButton` from the toolbar's right-click menu; Abort merge, Undo and Redo hidden at first (`HIDDEN_AT_FIRST`, one start state per id); stored in localStorage `yamt.toolbar.hidden` as an object of the buttons the user decided (id → hidden); an array stored before #74 (hidden ids) reads as decisions for the seven ids it can name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | one choice for every file, remembered across restarts; a button added later keeps its own start state until decided (plan §2 #58, #74, #1091)                                                                     |
| whether unchanged lines collapse                                                                                                             | `Collapsing` (`ui/collapsing.ts`, `storedValue`), one per window store (merge `store.ts`, range `rangeStore.ts`): read as `collapsing`, flipped only by `toggleCollapsing` from the merge toolbar's or the range header's "Collapse unchanged fragments" button (`COLLAPSE_LABEL`); stored in localStorage `yamt.collapse.unchanged`, the same key for both windows, anything but `"false"` is on; each `MergeView` passes it to `useMergeController`'s `collapsed` option and `useRangeController` reads the range store's, each watch calling `setCollapsed` on every live controller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | one choice for every file of both windows, remembered across restarts; never part of `Preferences`, so re-applying preferences cannot reset shown runs (plan §2 #68, #126)                                        |
| whether the file list shows                                                                                                                  | `fileListShown` shallowRef in `ui/store.ts`, true at every start (never stored); flipped only by the store's `fileListKey`, which `App.vue` calls from a window `keydown`: nothing on a press already handled, while a question waits, or for a key not bound to "Toggle file list" (`pressesKey`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `App.vue` hides `FileList` with `v-show`, so its width, view and closed folders survive (plan §2 #61)                                                                                                             |
| the window-wide search (query, Match Case, pane filters, results, closed groups, dismissals, the go-to request, shown, the new-search count) | one `Searching` per window store (`ui/searching.ts` `createSearching`; merge `store.ts` over `mergeSearch.ts`, range `rangeStore.ts` over `rangeSearch.ts`); the runner (`searchRun.ts`) writes only `results`/`running`; `fullRuns` counts new searches, written only by `searching.ts`'s `onFullRun` callback; results are previews and line/column numbers, never document text or a position; the merge window reads an opened file's live Result only through `LiveResults` (`track`/`untrack` by each `MergeView`, its handle's `lineUp()`) at the moment it searches that file; a go-to request is consumed once by the shown view on its path (`took`); the results list's scroll position and keyboard row: `SearchResults.vue` only (top on each new search, clamped to the end when rows shrink)                                                                                                                                                                                                                                                                                                                                           | remembered while the panel is hidden, never stored; a new stop clears it and searches the new stop's files again (`stops.ts`); a Result change or a disk change re-searches that file after 300 ms (plan §2 #127) |
| the file list's view (list or tree), its width and its closed folders                                                                        | `FileList.vue`'s own state: the view from `createFileListMode` (`ui/fileListMode.ts`, `storedValue`, localStorage `yamt.files.view`, anything but `tree` is the list); the width from `createFileListWidth` (`ui/fileListWidth.ts`, localStorage `yamt.files.width` in px, `FILE_LIST_BOUNDS` 160 px … half the window, the CSS and the clamp from the same constants; a double-click on its handle forgets it); closed folder paths in a session-only `shallowRef`, the shown file's folders opened whenever `active` changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | one reader and one writer, both in `FileList`; the view and the width are remembered across restarts like #58, folders are not (plan §2 #61, #84)                                                                 |
| the three panes' split                                                                                                                       | `PaneSplitState` (`ui/paneSplit.ts`, `storedValue`) held by the store: `paneSplit` = Local's and Remote's shares (Result the rest), written only by `setPaneSplit` from a divider drag (`usePaneDividers`: `dragged` over the widths measured at the press) and `resetPaneSplit` from a double-click; localStorage `yamt.panes.split`, anything invalid reads as thirds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | one value for the window; every MergeView and ChoiceView derives its grid (`paneColumns`), no copy per file (plan §2 #84)                                                                                         |
| what git is doing, the merge yamt started and both panes' names                                                                              | `operation`, `mergeRequest` (`MergeView \| null`, the merge of a merge request yamt started here, plan §2 #140) and `sideNames` shallowRefs in `ui/store.ts`, written only by `refreshFiles` (`ui/listing.ts`) from each `listStop` reply (at start, on every focus and after every action), the one reply that also carries the files; `nextStop` (`ui/stops.ts`) on `MovedOn`; Abort's question and leftovers notice (`ui/aborting.ts`) and the push offer (`ui/pushing.ts`) read `mergeRequest`, never write it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | one source: git's view now, plan §2 #85, #87; the file list's tag (`OperationLabel`, #92), both headers and the buttons read the same reply; the record is Rust's (`yamt-local-merge`), read fresh on every list  |
| the stop the window shows and its per-stop state                                                                                             | the store's `stop` token (`ui/currentStop.ts` `Stop`: `{ dropped }`), replaced only by `nextStop` (`ui/stops.ts`), which clears opened views, choices, taken sides, write claims, format notes, the stop's questions, `stopMessage` (git's message for a stop without conflicts, set only there) and lists as at start; a reply is applied only through `landed(stop, call)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | one place a stop ends (plan §2 #89); a late reply from an old stop changes nothing; a `StopMovedOn` always goes there                                                                                             |
| whether git is running (Continue, Abort, Push) and the two buttons                                                                           | `running` in `createGitRun` (`ui/gitRun.ts`), the one writer: set for the call, cleared unless the reply ends the app; Continue's `ReadyToPush` and Abort's leftovers keep it set (the window is ended for every reader while the push question or the leftovers notice shows; `ui/pushing.ts` runs the push and `closeEndedMerge` through it); `AbortState` (`ui/aborting.ts`) and `ContinueState` (`ui/continuing.ts`: noOperation \| filesLeft \| writing \| ready \| running) computed from it, the operation and the files; `MergeToolbar`/`ToolbarMenu` list them by `listedButtons(operation)` (`ui/toolbarButtons.ts`); the close guard refuses while running                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | one owner for "git runs" (plan §2 #88, #89, #141); a success that ends the app keeps it `running` while Rust ends the window                                                                                      |
| disk versions across the stops of one run                                                                                                    | Rust: `MergeSession.first_disk_version` (from `open_after(root, highest)`), `Merge::MovedOn.highest_disk_version` in `src-tauri/src/merge.rs`; a write below the session's first version answers `StopMovedOn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | versions never repeat within a run, so an old stop's write never lands on the next stop's file (#1383)                                                                                                            |
| the merge this run holds, a committed merge yamt started                                                                                     | Rust `Merge` in `src-tauri/src/merge.rs` (`Mutex<Merge>`): `Committed { root, offer: PushOffer }` set only by `continue_operation` after a live record's `committed()`, left for `Finished` only by `push_merged_branch` (`Pushed`) and `end_committed` (`close_ended_merge`); a failed push keeps it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | the push needs the root and the offer after the record is gone (plan §2 #141)                                                                                                                                     |
| the merge of a merge request yamt started (its record)                                                                                       | Rust `yamt-local-merge`: `<git dir>/yamt-merge-request.json` (format 1), written only by `start` (sync + rename, before the first change), removed by `start` (stale, or a refused checkout), `LiveMerge::restore` and `LiveMerge::committed`; never held in memory: every list, Continue, Abort, `find_local_merge` and start-up read it fresh (`find_live`, `local_merge`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | lives exactly as long as the checkout; a restart or a plain `yamt` finds it (plan §2 #140)                                                                                                                        |
| the start lock and the window claim                                                                                                          | Rust `yamt-local-merge` (`record.rs` `hold`): `<git dir>/yamt-merge-request.lock` held by `start` while it runs; `<git dir>/yamt-merge-window.lock` held by the merge window's `WindowClaim` (`claim_window` in `outcome.rs` `startup`, kept by `lib.rs` `merge()` until `window::run` returns), probed by `window_is_open`; the files are never removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | one start and one window per checkout; the OS releases a lock on any exit (plan §2 #139, #143)                                                                                                                    |
| whether the minimap shows (Alt held)                                                                                                         | `useAltHold()` (`ui/altHold.ts`), one instance in `App.vue`: a `shallowRef` set by Alt's own key press and cleared by its release, another key, window blur, the page hidden or a key/pointer event reporting Alt up (`heldAfter`, pure, fed by `useKeyHold`'s listeners in `ui/keyHold.ts`); pointer listeners exist only while held; never stored. `App.vue` passes it to every `MergeView` as `minimap`; MergeView hands `shown && minimap` and the Result shown as text (`showsMinimap`, the rule `centerLine` also uses) to `useMergeController`'s `minimap` option → `MergeOptions.minimap` / `showMinimap` (plan §2 #80 hold, #81)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | one window-wide fact, one writer; hidden files never get it, so they compute nothing                                                                                                                              |
| the Result's minimap (code tiles, slider, edge marks)                                                                                        | `Minimap` (`editor/internal/minimap.ts`), owned by `Frame`: one `.minimap` box in the right pane's `view.dom`, `display: none` while not shown; code rows in `MinimapTiles` (128 rows each) dropped by `staleTiles` and outside the window, all dropped while hidden; slider and canvas window from `minimapLayout` per frame while shown; edge marks from `Frame`'s rows and the Result's diagnostics, dropped when rows move or problems arrive; theme colours read when shown or after the dark flag changed; no history (plan §2 #81)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | derived from the one geometry cache, the one tint rule (`paneTone`) and the one syntax table (`SYNTAX_COLOURS`); nothing to keep                                                                                  |

The compare window (`yamt --diff`, plan §2 #93–#97) has its own rows:

| state                                                                           | owner                                                                                                                                                                                                                                                       | why                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| each column's text while its tab is mounted                                     | that column's CodeMirror `EditorState` (`CompareController`); Vue never holds it: a column's text passes once, from `settled`/`settleNow` into `saveColumn` → `setColumn`                                                                                   | as the merge window's documents                      |
| the stored copy of every tab's texts, the tab list, names, languages, shown tab | Rust `yamt-compare` `TabStore` (`<data_dir>/yamt/compare/`, `CompareState = Mutex<TabStore>`); the window's `tabs`/`shown` in `ui/compareStore.ts` are written only from its replies                                                                        | survives a restart, a crash and a kill (plan §2 #97) |
| each column's version, the columns edited since their last send                 | `Settle` (`editor/internal/compareSettle.ts`), from the versions `loadTab` returned; Rust stores a column only for a higher version, `showComparison` applies a reply only when both versions are current                                                   | a late reply never tints changed text (plan §2 #95)  |
| the differences shown                                                           | each column's `differenceField` (`editor/internal/compareFields.ts`): set by a reply, mapped through edits until the next                                                                                                                                   | built once per reply, never per key (plan §2 #96)    |
| Auto's finding per tab                                                          | the controller (`compareLanguage.ts`), reported through `detected` to `compareStore.detected` (names only)                                                                                                                                                  | the toolbar's "Auto · JSON"                          |
| the compare window's notices, problem, question, screen, tab panel shown        | `ui/compareStore.ts` + `ui/compareNotices.ts` (notices), `fileListKey` the one writer of `fileListShown`; settings through the seam `ui/settingsStore.ts`, which the merge store registers too; the screen also by the merge-request slice's `show`/`close` | one store per root (plan §2 #94)                     |

The merge-request page (plan §2 #128–#143, #149, #151–#157; the compare and range windows) has its own rows:

| state                                                                                                                                                                             | owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | why                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the window's GitLab project, the pairs' folder, the pages a list, a discussions reply or a description reply handed out, the window's `--ai`, the run's merged pairs              | Rust `MergeRequestState` (`src-tauri/src/merge_requests.rs`), managed once per compare or range window: `gitlab` set at start only (`gitlab_repository`, offline); `pages: Mutex<BTreeSet<WebPage>>` (every row's and failed job's page, every answered note's page, every description link's page) written only through `offer`, from `merge_requests/list.rs` `forward_page` before each page is sent and from `discussions_reply` (`merge_requests/discussions.rs`) before its rows are returned, and through `offer_described`, from `description_reply` (`merge_requests/description.rs`) before its reply is returned; read only by `open_page` and `read_job_log` (`job_logs.rs` `job_log_reply`); `merged: Mutex<MergedPairs>` (each merged (target, source) pair's `MergeOutcome`, never cleared) written only by `yamt_merge_requests::check_conflicts`, locked by `list` for the whole check, never held with `pages`; `ai` set at start only by `manage`, read only by `opened` (Show Diff passes `--ai` on, #144)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | the window can open or read the log of only an address this window was sent (plan §2 #133, #137, #158, #162, #172); no pair is merged twice in a run (#149)                                                                                                    |
| the uploaded pictures a list, a discussions reply, a people search or a people change offered, the uploads a description reply offered, the pictures fetched, the fetches running | Rust `MergeRequestState.pictures: Pictures` (`src-tauri/src/merge_requests/pictures.rs`), the one gate: `Mutex<PictureShelf>` + `Condvar`; `offered` (a username or an `UploadKey` → `PictureAddress`, the latest) written only by `Pictures::offer` (usernames), called by `offer` (from `forward_page` before each page is sent, from `discussions_reply` before its rows are returned) and by `merge_requests/people.rs` `search_reply`/`change_reply` (the people found, or everyone in GitLab's answered lists, before the reply is returned), and by `Pictures::offer_uploads` (upload keys), called by `offer_described` (from `description_reply`, after its pages, before the reply is returned); `fetched` (address → running \| done, failures too) and `running` (≤ `PICTURE_FETCHES` 4) only by `picture_answer` through `turn`/`done`; never locked with another `Mutex` nor across a glab run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | the window can load only a picture or upload this window was offered, each fetched once per run, at most 4 glab runs at once (plan §2 #152, #169, #173, RK53)                                                                                                  |
| the run's job logs                                                                                                                                                                | Rust `MergeRequestState.job_logs: JobLogs` (`src-tauri/src/merge_requests/job_logs.rs`): `Mutex<BTreeMap<WebPage, JobLog>>`, written only by `job_log_reply` after `yamt_merge_requests::read_job_log` answers `Log` (a failure is never kept); read by `job_log_reply` before any glab run; never locked while glab runs nor with `pages`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | a log is read from GitLab once per run; a failed read asks again on the next Shift (plan §2 #158, #161)                                                                                                                                                        |
| the project, the rows, `me`, the load, the openings, the row actions, the local merge, the page problem                                                                           | one `MergeRequests` slice per window (`ui/mergeRequests.ts` `createMergeRequests`), built by `compareStore.ts` / `rangeStore.ts` through `ui/mergeRequestsStore.ts` `windowMergeRequests` and read only through `useMergeRequests()`: `project` written only by `findProject` (at start-up; `repository` computed from it, shared by the filters and the due dates); `rows`/`me` only by a load's pages (`ui/mergeRequestsList.ts` `loadList`: a load with no rows shown streams them; a refresh over shown rows buffers them and swaps at its end) and `rows`' readiness also by its `checked` results (`rechecked`), only for the load whose rows are shown (`shown`: set at a first load's start and at a refresh's swap, cleared when a first load fails; a buffering refresh writes its buffer; other results are dropped; `close()` changes nothing); a row's `assignees`/`reviewers` also by `withPeople`, the one row-people writer (a `requested` re-request reply's reviewers, a `changed` or `unchanged` people reply's two lists: `rows` and, while a refresh buffers, the buffer of `running` — the load in flight, written only by `loadList`); `listing` (`ListLoad` = notLoaded \| loading{first} \| done{end, at}) only by `loadList` (first opening, an opening 30 s after the last load, Refresh); `listedAt` (when the list now on screen finished loading: the header's age) only by `mergeRequestsList.ts` `ended`, on an end without a failure text (the end that swaps the rows in), null until then; a refresh in flight, a thrown call and a failure end keep it (plan §2 #167); `failure` derived from the last end through `listFailureText`; `openings` per iid only by `openChanges`; `actions` (`RowActing` per iid = running \| replied{`RowReply` resolve \| continue}) only by `resolve`/`continueMerge` and `localMerge` (`LocalMerge`, `free` at first) only by `checkLocalMerge` (at `show()`, on the window's focus while the page shows, after every resolve or continue reply; a failed read keeps the last value), all three in `ui/mergeRequestActions.ts` `createRowActions`, held by the slice, whose `setRow`/`claimRow` are the one per-row write and busy guard of `actions`, `openings`, the re-request asks and the people asks; `pageProblem` only by `openPage` and `dismissPageProblem`; `screen` `mergeRequests` only by `show` (also at start through `openAtStart`), `files` by `close` | one list and one filter state for every mounted header button and the page (#128); whether a merge is in progress is Rust's record (`yamt-local-merge`), the slice holds only the last answer (#143); a row shows only the people GitLab answered (#169, RK64) |
| the remembered filters, review mode included                                                                                                                                      | `ui/mergeRequestFilters.ts` `createRememberedFilters(repository, reviewable)`, created by `ui/mergeRequestsShown.ts` `shownOf` (`reviewable`: the slice's `discussionDetails()` is `"full"`) and held by the slice: `filters` read per repository, written only by its `set` (`filterActions`' `click(filter, value, shift)`, `setDraft`, `clear`, `clearAll`, `review(who)` = core `reviewing(who)`, and the gate's watch); `filters.review` (`ReviewFor` me \| user, or null) reads null while `!reviewable()`, and `reviewable` turning false with a stored review writes the entry once without it, Reviewer and Draft kept (RK62); localStorage `yamt.mergeRequests.filters` = `{ [repository]: StoredFilters }` (an excluded value's word prefixed `not:`; a fifth key `review`, `"me"` or `"user:<username>"`, present only while review mode is on), an entry back at no filter removed, other repositories' kept                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | survives a restart per repository; two windows: the last write wins; an older yamt reads the four other keys and drops `review` at its next write (#134, #155, #165)                                                                                           |
| the search text                                                                                                                                                                   | the slice's `search` (`ui/mergeRequests.ts`), written only by `setSearch` (`MergeRequestSearch.vue`'s input, Escape and ×, through the View) and `show` (empties it); kept across Refresh and Clear filters; never stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | empty on each visit (#2150)                                                                                                                                                                                                                                    |
| the due dates                                                                                                                                                                     | `ui/mergeRequestDueDates.ts` `createDueDates(repository)`, held by the slice: `dates` read per repository, written only by `set` (the slice's `setDueDate`) and `keepOnly` (a load that ended `loaded`, not `cut`, drops the dates of merge requests it no longer lists); localStorage `yamt.mergeRequests.dueDates` = `{ [repository]: { [iid]: "YYYY-MM-DD" } }` through `storedRecord`, an empty entry removed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | local to this machine, per repository and merge request (#156)                                                                                                                                                                                                 |
| the due-date box: open, the typed draft, the refused text, the calendar's focused day                                                                                             | `MergeRequestDueDate.vue`'s own `open` (toggled by the opener, closed by Escape, a save, a click or a scroll outside), `draft` (the text field's `v-model`, set to the shown date at each opening, so a refused Enter keeps what was typed) and `refused` (Enter on a draft `typedDay` refuses; cleared by typing or opening); `MergeRequestCalendar.vue`'s `focused` day (the chosen day, else today, at mount), written only by its keys (core `movedDay`) and chevrons; the shown month is `monthOf(focused)`, never stored apart                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | the open box only                                                                                                                                                                                                                                              |
| whether Shift is held, and the count of Shift taps (a filter list's `circle-minus` icons; the CI box's log)                                                                       | `useShiftHeld.ts`'s one `ShiftState` per window (`up \| held { alone }`, both with `taps`; `createSharedComposable`), shared by every `MergeRequestFilter` through `useShiftHeld()` and every `CiStatusBox` through `useShiftTaps()`: a `shallowRef` written only by `useKeyHold`'s listeners in `ui/keyHold.ts` through the pure `shiftAfter` — held at Shift's keydown, up at Shift's keyup (by key name), counting a tap only when no other key and no pointer press came between; up without a tap on window blur, the page hidden or a pointer event without `shiftKey`; pointer listeners exist only while held; never stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | the WebKitGTK/X11 release reports Shift still set, so only the key name tells; Shift+Tab, Shift+click or a capital is no tap (RK59)                                                                                                                            |
| the re-request asks                                                                                                                                                               | `ui/mergeRequestRerequests.ts` `createRerequests`, held by the slice: `rerequests` (`RerequestAsk` running \| refused, per iid and username) written only by `rerequestReview` through `setRow` (a press while that ask runs sends nothing; `requested` clears it and hands the reviewers to the slice's `replaced`, `withPeople`) and `dismissRerequestRefusals` (the people box closed: refusals dropped, running asks kept)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | a refusal stays under its reviewer until the box closes (#153, #157)                                                                                                                                                                                           |
| the people search                                                                                                                                                                 | `ui/mergeRequestPeople.ts` `createPeopleChanges`, spread into the slice: `peopleSearch` (`PeopleSearch` empty \| searching { text, people } \| found \| refused \| failed, a `shallowRef`, one per window) written only by `searchPeople` ("" after core `searchedText` → empty at once; else `searching` with the last answer's people, asked `SEARCH_PAUSE_MS` 250 after the last call; an answer written only when no later call came) and `endPeopleSearch` (empty, an answer in flight dropped)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | GitLab's own pause; a slow answer never replaces a newer search (#169, RK65)                                                                                                                                                                                   |
| the people changes per merge request                                                                                                                                              | `ui/mergeRequestPeople.ts` `createPeopleChanges`: `peopleAsks` (`RowPeopleAsks { queue, notDone }` per iid, a `shallowRef`, an empty entry removed) written only through `setRow` by `changePeople` (an equal change queued sends nothing; else appended, that person's `notDone` dropped), the private `answer` (the answered change leaves `queue`; `unchanged`, `refused` or a failure joins `notDone`; a `changed` or `unchanged` reply's lists go to `withPeople`) and `peopleBoxClosed` (`notDone` dropped, the queue kept); the private `lastTurns` chains each iid's changes so one runs at a time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | one write per change against GitLab's list at that moment, in the order made; a change not made says so until the box closes (#169, RK64)                                                                                                                      |
| the rows whose people box is open                                                                                                                                                 | `ui/mergeRequestPeople.ts` `createPeopleChanges`: `openPeopleBoxes` (`ReadonlySet<MergeRequestIid>`) written only by `peopleBoxOpened`/`peopleBoxClosed`, which `MergeRequestPeople.vue` calls when its hover box opens and when it closes or unmounts open; read by `shownOf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | a row stays shown while its box is open, even when a change takes it out of the filters or the search (request rule 9, #170)                                                                                                                                   |
| the people box's add field: which group, the text, the highlight                                                                                                                  | `MergeRequestPeople.vue`'s own `adding` (`PeopleGroup \| null`, one field per box: toggled by the add buttons, cleared by the field's Escape and the box's close); `MergeRequestPeopleSearch.vue`'s own `text` (cleared after an answered add only when unchanged since the pick) and `highlight` (`steppedHighlight` on arrows, `keptHighlight` when the lines change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | the open box only (#170)                                                                                                                                                                                                                                       |
| the shown job log (the window's one log box)                                                                                                                                      | `ui/mergeRequestJobLogs.ts` `createJobLogs`, spread into the slice: `jobLog` (`ShownJobLog { job: { name, page }, load: loading \| shown { view, cut } \| refused { reply } \| failed { cause } } \| null`, a `shallowRef`) written only by `showJobLog` (the same page while loading or shown changes nothing; else a new `loading` entry, and the reply written only into the entry it was asked for, the view parsed once by `mergeRequests/` `jobLogView`) and `closeJobLog` (null); `CiStatusBox.vue` calls both                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | one log box per window; a late reply for another job is dropped (plan §2 #160)                                                                                                                                                                                 |
| the shown description (the window's one description panel)                                                                                                                        | `ui/mergeRequestDescriptions.ts` `createDescriptions`, spread into the slice: `description` (`ShownDescription { row: { iid, title }, load: loading \| shown { description } \| refused { reply } \| failed { cause } } \| null`, a `shallowRef`) written only by `toggleDescription` (the open row's button closes it; any other row a new `loading` entry, asked afresh), `retryDescription` (a new `loading` entry for the open row; nothing when none is open) and `closeDescription` (null); a reply written only into the entry it was asked for; a list load or refresh never writes it; `MergeRequestRow.vue` (the info button), `MergeRequestDescription.vue` (close, Retry) and `MergeRequestsView.vue` (close at unmount) call them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | one panel per window; a late reply for a closed or replaced panel is dropped; a refresh leaves an open panel as loaded, its title as opened (plan §2 #171, #174, RK67)                                                                                         |
| the remembered job-log search texts                                                                                                                                               | `ui/mergeRequestJobLogs.ts` `createJobLogs` through `storedRecord`: localStorage `yamt.mergeRequests.jobSearches` = `{ [jobName]: text }`, no repository key, read by `jobSearch`, written only by `setJobSearch` (`CiStatusJobLog.vue`'s field; "" removes the name)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | a job's text per name, in every repository (plan §2 #160, request rule 7)                                                                                                                                                                                      |
| each row's open discussions, the queue of rows to ask, the call in flight                                                                                                         | `ui/mergeRequestDiscussions.ts` `createDiscussions`, held by the slice as `discussionQueue` and exposed only through `discussionsOf` (`discussions`, `discussionDetails`, `askDiscussions`): `discussions` (`ReadonlyMap<MergeRequestIid, DiscussionLoad>`, `DiscussionLoad` = loading \| read { discussions } \| refused { answer } \| failed { cause }, a `shallowRef`) and the private `queued`, `unhovered`, `running` and `generation` written only by the queue's own functions: `listed` (from the slice's `received`: with "full", each row with `openDiscussions > 0` and no entry queued), `replaced` (at a refresh's swap with the new rows, and with none when a first load fails: generation raised, every entry, the queue and `unhovered` dropped, then `listed`), `askDiscussions` (with "lazy", the row first unless it has an entry; a row in `unhovered` taken out of it instead), the mode's watch (`full` lists the missing rows; `lazy` drops the unsent asks and keeps the running call's iids in `unhovered`, each dropped at settle unless hovered since or answered; `off` drops everything and raises the generation) and `settle` (a call's answer, only for the current generation: each answered row's entry, every asked row `failed` on a source failure; answered rows leave the queue). One call at a time with every queued iid; the next sent until the queue is empty. The box asks through `useRowDiscussions(discussions, iid, open)`, which asks whenever the box opens or loses its entry while open; the mode comes from the window's `settings.discussionDetails` (`mergeRequestsStore.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | one load path for every setting; never an ask with "off", nor an answer kept across a swap or "off" (plan §2 #162, #164, RK61)                                                                                                                                 |
| what the shown list is (filtered and searched rows, dated first or in the review order, choices, summary, viewer, sort state)                                                     | `computed` in `ui/mergeRequestsShown.ts` `shownOf` (spread into the slice) from `rows`, `filters`, `me`, `search`, `openPeopleBoxes`, the due dates and, in review mode, `discussions`, through `frontend/src/mergeRequests/` (`filtered`, `searched`, plus every row whose people box is open, in list order; with no `filters.review` `datedFirst` — `byDueDate` by `dueOf` —, else `reviewOrdered(rows, viewer.username, dueOf, details)`; `choicesOf` — `personChoices`/`labelChoices`, by count, over every loaded row, never the search, and `reviewChoices`, the picker's —, `summaryText`); `viewer` = `viewerOf(filters.review, me, rows)`; `reviewSort` (`ReviewSort` sorted { loading } \| failed { iid, failure }, null without review mode); never stored                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | derived, nothing to keep; rows move at each discussions answer (#165); an open people box keeps its row (#170)                                                                                                                                                 |
| the page's tooltip                                                                                                                                                                | `ui/tooltip.ts`, one singleton per window: the tip element, its `phase` (waiting \| shown) and `closedAt`, written only by the `vTooltip` directive's own handlers; each bound element's text in a `WeakMap`; never in Vue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | one tip at a time, the warm 300 ms across elements (#154)                                                                                                                                                                                                      |
| which filter list or the review-mode picker is open, and whether focus moved into it                                                                                              | the View's one `useHoverMenu<ListFilter \| "review">` (`ui/useHoverMenu.ts` over `useDropdownMenu`'s `opened` = `{ which, focus: kept \| moved }`): hovering opens with focus kept, a click on the opener pins it (moved), leaving closes after 300 ms through `dismiss`, a pick closes the picker; each menu's narrowing text is `MergeRequestMenu.vue`'s own `typed`, emptied at each opening                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | one list open by construction (#155, #165)                                                                                                                                                                                                                     |

The window's storage is read and written in one way, `storedValue(key, fallback, { read, write }, warnEvent)`
(`ui/windowStorage.ts`): synchronous writes, defaults never written, failures logged under the caller's event. A
per-key record (pins per repository root, merge-request filters and due dates per repository) goes through `storedRecord(key,
warnEvent)` on top of it: `entryAt(at)`, `set(at, entry)`, `remove(at)`, an unreadable record read as empty.

Rule: **Vue state never holds an `EditorView`, a position, or document text.** The text to write passes through
once, from `snapshot().fileText()` or `asShown()` to `source.saveFile`/`finishFile` (`ui/saving.ts`), and the written
snapshot then marks its own saved point (`markSaved`).

### 5.2 `editor/` — public surface is one class

```ts
export class MergeController {
  constructor(data: FileMergeData, hosts: MergeHosts, options: MergeOptions); // left, center, right + strips: [SVGSVGElement, SVGSVGElement]; MergeOptions = { readOnly (plan §2 #47), preferences, collapsed (plan §2 #68), minimap (the Result's minimap shown at build, plan §2 #81), servers: LanguageServers | null (plan §2 #70) }
  setPreferences(preferences: Preferences): void; // Preferences = { theme, keys: KeyBindings }: reconfigures the theme compartment (dark flag from `themeKind`, the `themeName` facet the minimap redraws on) and the side, find and middle keymaps in all three panes (plan §2 #57, #102)
  setCollapsed(on: boolean): void; // the collapse toggle: off shows every hidden line, on hides every run back to its start; keeps the middle's top line, re-aligns the sides at once; not in history (plan §2 #68)
  goTo(target: MergeGoTo): void; // { pane, match: { line, from, to } | null }: find's selectMatch (a centred scrollIntoView, #82) then focus; a stale match is clamped; the selection's own fold reveal shows a collapsed stretch; with a match, the go-to's pane then leads the scroll sync (`Frame.realign(pane)`), so the other panes' height-keeping scrolls after a reveal never pull it back (#1745); `match: null` only focuses (plan §2 #127)
  lineUp(): ResultLineUp; // the Result's text and each change's live Result lines with the sides' fixed lines, sorted and disjoint (internal/lineUp.ts)
  onResultChange(listener: (() => void) | null): void; // after each Result transaction that changed its text (own update listener)
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
  `syntaxColourClasses` (the one code-colour table the pane's highlights are built from: Lezer tags → 39
  `--color-syntax-*` tokens and their font-style variables; `paletteHighlight` sets colours with containers before
  inner tokens, `fontHighlight` font styles with link and url before the containers, so nested Markdown takes the inner
  colour and the container's style; the minimap takes the token latest in the table as the text's CSS does, plan §2
  #102) and from the theme (`readLook`, only when shown or
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
  next sync to write the others anyway; a followed pane stays the source until that sync, so another pane's scroll
  event in between (a column the toggle shrank fires a clamped one) never leads (`Frame.realign`,
  `CompareFrame.realign`, after the collapse toggle, plan §2 #68, #126; `Frame.realign(pane)` also after a merge
  go-to that selected a match, #1745).
- `foldRuns.ts`, `foldSteps.ts`, `folds.ts`, `foldSelection.ts`, `foldView.ts`, `folding.ts`, `wavePhase.ts`,
  `columnFolds.ts`, `rangeFolds.ts` — collapsed unchanged lines (plan §2 #63, #64, #68), one core for the merge
  window's three panes and the range window's two columns (#126). `foldRuns.ts` is WebStorm's
  `FoldingBuilderBase`: every run outside the changes, per pane, with up to three nested levels keeping 4, 8, 16
  lines next to each change (`Fold<P>`, `FoldLevel<P>` = one range or none per pane key, `displayed`, `waveStartsIn`
  — where a pane draws each run's wave, for both windows), one private
  `runLevels` behind `foldRuns` (`Chunk`s) and `columnRuns` (`ColumnChange`s, branded line spaces kept).
  `foldSteps.ts` is the pure step state generic over the pane key (`FoldSteps` {runs, hiding}: `shown` only ever
  shows, `revealed` applies a selection's reveals in the same transaction, `leaveCollapsed`/`leaveCollapsedAfter`
  the cursor rule of a toggle and of a mirror copy). `folds.ts` holds the merge's middle `foldField` (`FoldState` =
  `FoldSteps<Pane>`, every level mapped; `collapseSpec` turns collapsing off or back on to every run's start), the
  sides' count mirror (`FoldFields`, `pushFolds`, `sideFoldPush`), `revealOnOwner` (a selection on hidden lines in a
  non-owner pane revealed through the owner — the merge's sides through `sideReveals`, the range's right column),
  the delete filter (`waveDeletes`: a delete from a cursor that would remove a hidden character shows the next step
  instead) and `waveStarts` (each pane's displayed wave starts, the one reader the frame uses). `foldSelection.ts` is
  pure: `revealKeep` (which levels a selection strictly inside hidden lines opens) and `leaveHidden`/`leaveAllHidden`
  (IntelliJ's `onFoldProcessingEnd`: a cursor inside lines that get hidden moves to the wave line's start, a
  selection with an end inside is dropped). `foldView.ts` `paneFoldView` draws a run as one inline
  `Decoration.replace` over whole lines — not `block: true`, whose widgets the arrow keys skip — that is also the
  atomic range, and the wave as a line-number gutter marker spanning the visible pane (a CSS mask of one 64-wave
  `waveTile(64)`, positioned and sized by the pane's phase properties); `Folds` wires the merge's fields, views,
  `Folding` and `WavePhases` and runs its toggle (`setCollapsed`: one transaction with a `scrollSnapshot` of the
  middle). `columnFolds.ts` is the range's state: the left column's `ownerSteps` owns runs and counts (no column
  is the "middle"; the left is the base), the right's `mirrorSteps` copies the whole value through the left's
  update listener; `rangeRuns` makes every shown thread's unchanged lines (`diffOrder.ts` `unchangedRuns`, one change
  per stretch between differences, drafts included; overlapping or touching runs joined by `foldRuns.ts` `joinSpans`) a
  change in both columns, so no line of a thread's range that is unchanged is hidden; `hiddenIn` gives a column's
  shown folds, `hiddenLeft` the left column's hidden lines as spans. `rangeFolds.ts` `RangeFolds`
  wires one `Folding` over both columns and the strip, the left → strip → right `ChainPhases`, and `renew` (open,
  on, off: one transaction on the left with its `scrollSnapshot`); `columnWaves` gives the strip's joins through
  `waveStartsIn` and `geometry.ts` `waveTops` (the merge's `waveRows` uses the same). `folding.ts` is the one pointer
  owner over a window's wave hosts (hover, a click shows the next step, presses on a wave keep the keyboard where it
  was; a press on a range wave's gutter cell starts no thread). `wavePhase.ts` pins each pane's wave at the strips'
  `<svg>` edges (WebStorm's start phase: out of a pane on the centre line heading down, into one heading up; the
  merge's middle stretched to k+½ waves): `layoutOf` reads the scrollers' and strips' edges rounded to device
  pixels, `chainEnds` turns a `WaveChain` (a pane, then strip–pane links) into each pane's ends, the private
  `chainPhases` turns ends and scroller edges into phases (`paneEnds`/`panePhases` the merge's `STRIP_PANES` case),
  `ChainPhases` is one `ResizeObserver` on the pane hosts plus a `matchMedia` resolution listener writing two custom
  properties, `WavePhases` its three-pane case. The strips' wave joins are one `WaveLayer` (`strips.ts`, from
  `gap.ts` `joinPaints`) in the merge's `GapStrip` and, given `hovered`, in `CompareStrip`; `CompareFrame` takes an
  optional `waves` part and `realign(source)`; the compare window passes neither.
- `diffOrder.ts`, `threadAnchor.ts`, `threadDrag.ts`, `threadTint.ts`, `threadNumbers.ts`, `threadRows.ts`,
  `threadHosts.ts` — the range window's threads on line ranges (plan §2 #116, #145, #148). `diffOrder.ts` is pure:
  GitLab's one-column order over the differences (an unchanged line once, a change's removed lines, then its added
  ones), one walk whose segments carry their difference; `segmentAt` is the one rule for whether a column line is
  inside a difference and for an unchanged line's partner, which `threadAnchor.ts` (`linePlace`, `anchorAt`) builds
  on; `orderIndex`/`lineAtIndex`, `placeBetween` (the earlier of press and pointer is `start`, the later `end`, which
  keeps the column it was picked in; the same index is the press's one-line place), `shownEnd` (the pointer clamped
  to the shown lines around the press, so a drag stops before a wave), `placeSpans` (each column's lines of a place)
  and `unchangedRuns`. `threadNumbers.ts`: a press on a line number returns `true` from the gutter's `mousedown` (no
  text selection starts) and starts a drag; the count badge toggles that line's threads (`lineCounts` by
  `place.end`). `threadDrag.ts` `ThreadDrag` holds capture-phase listeners on `document` (`pointermove`,
  `pointerup`, `pointercancel`, `keydown` — Escape cancels and is taken by the drag alone), `scroll` on both
  scrollers and window `blur`, all removed at release, cancel and `destroy`; a move or a scroll asks for one
  `requestAnimationFrame`, which reads the line under the last pointer position after each column's own measure;
  release reads it once more and hands `placeBetween(press, shownEnd(…))` to `RangeEvents.startThread`. The pointer's
  column is the one on its side of the strip's middle; over a thread row, below the last line or in an empty column
  it is the other column's line at that height; no automatic scroll. `threadTint.ts` is a per-column field of tinted
  spans (`showTint`, `tintOf`; `cm-thread-tint` on lines and gutter cells, `theme.css` mixing `--color-selection` at
  45 % with transparent so a difference keeps its colour in every theme); `RangeController` sets it to the drag's,
  every draft's and the hovered thread's place. `threadRows.ts` places a row by `place.end`, so threads ending on one
  line share a row; `threadHosts.ts` reports `hovered(key | null)` from each host's `pointerenter`/`pointerleave`, so
  the hover never crosses into Vue.
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
  (#1240). The pure `farTop` decides from the visible span and the rendered lines' span, and `movedFarTop` only for a
  `scrollTop` that moved since the pane's last scroll event (a viewport CodeMirror already moved to a scroll target
  is not a far scroll, #1693); then a CodeMirror scroll request with a `scrollHandler` writes that exact `scrollTop`
  after CodeMirror has rendered the target. Callers keep writing `scrollTop`. The wave's width is a CodeMirror
  measure (`--fold-wave-width`), never a CSS size container: WebKitGTK pulls a far `scrollTop` back to the top of a
  scroller holding `cqi` units (#1693).

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

Components: `App.vue`, `SideColumn.vue` (the left column: the file list's width and handle below, plan §2 #84, and the
window-wide search's `SearchPanel.vue` — box, Match Case, pane toggles, summary — with `SearchResults.vue`, its virtual
list of groups and places, on top, plan §2 #127), `FileList.vue` (the file list panel: its width — dragged on its handle, remembered through
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
plan §2 #58); `keyHold.ts` (`useKeyHold(hold: KeyHold<S>, pointerEvents)`, generic over its state: a held key's window
listeners — keys in capture, window blur and a hidden page as leaving, the pointer events only while `hold.holding(state)`,
passive — feeding the pure `hold.after`, whose answer is the state, from `hold.start`); `altHold.ts` (`useAltHold`, called
once by `App.vue`: whether Alt is held for the minimap, the pure `heldAfter` as a `KeyHold<boolean>` on `useKeyHold`,
pointer events and wheel, plan §2 #80, #81),
`ProblemBar.vue` (failures, words from `problemText.ts`; the `Problem` vocabulary, `attempt` and
`report` — log it and show it — in `problem.ts`), `QuestionDialog.vue` ("Unprocessed Changes" / "Cancel File Merge";
what is asked in `question.ts`, its words in `questionText.ts`; `cancel: null` draws one button), `ChoiceView.vue` (two-button choice for a file the editor cannot show,
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

**The merge window of a merge request yamt started** (plan §2 #139–#143): the listed `mergeRequest` (`MergeView`,
written only by `listing.ts`) changes Abort and Continue. `aborting.ts` asks `{ kind: "abort", operation, mergeRequest }`
(the words by `returnTo`/`branchBefore`: "… and return to develop?", "yamt deletes feature/x, which it created for
this merge."); an `AbortReply` with leftovers asks the one-button `abortLeftovers` notice (each line from
`leftoverText.ts`, which the page's `gitRefused` reply line uses too), then `closeEndedMerge`. `continuing.ts` hands
`ReadyToPush` to `pushing.ts` (`createPushing`, built by `store.ts` into `createContinuing(state, pushing)`): the
`push` question (Push / Keep Local; Escape keeps it local, RK45), a `failed` push asks `pushFailed` with git's words
(Push Again / Keep Local), Keep Local closes once through `closeEnded` (`pushing.ts`: the one close of an ended
recorded merge, `closeEndedMerge` through `gitRun`, which `aborting.ts` uses after the leftovers too). Problems: a failed push IPC call is `{
action: "push", branch }` ("Could not push <branch>"), a failed `closeEndedMerge` after the push offer or Abort's
leftovers `{ action: "closeMerge", merge }` ("Could not close the merge of <target> into <branch>"); `mergeOfText`
(`operationText.ts`) is the one "merge of <target> into <branch>".

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
(fixture), with `ui/compareStore.ts` (`createCompareStore(source, start)`, `useCompareStore()`; tabs and the shown
tab mirrored from Rust's replies, column sends with `track`/`flushAll`, the close question, `fileListKey`, notices
through `ui/compareNotices.ts`, words in `ui/compareText.ts`, the visited tabs in `visited`) and no `LanguageServers`.
`CompareApp.vue`: `CompareTabList.vue` in the file list's place ("+", rows with the name and `languageLabel`, × with
the close question, rename by double-click; its width, drag and dots through `usePanelWidth.ts` and `PanelWidthHandle.vue`,
shared with `FileList.vue` and its stored width), one `CompareView.vue` per visited tab (inside `PaneFrame.vue`, the view
shell `MergeView.vue` uses too; unmounted on close: Format, `CompareLanguagePicker.vue`, the change arrows and the gear;
"Left"/"Right"; two hosts and the strip from
`compareColumns()`), `NoticeBar`, `ProblemBar`, `QuestionDialog`, and `SettingsView` without the language-server
section, `MergeRequestDiscussionSetting.vue` in its slot (the settings seam `ui/settingsStore.ts`, which both stores register); `onWindowClose` sends every unsent
column first. `ui/useCompareController.ts` is the compare root's only `editor/` importer (settle → `saveColumn` →
`showComparison`, Format failures → `reportFormat`, `track`).

**The merge-request page** (plan §2 #128–#143, #149, #151–#157, #162–#174; the compare and range windows; fence PM10 in `scripts/windowFence.ts`:
`ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*` import no window root and no `lsp/`): `compareStore.ts` and
`rangeStore.ts` each build one slice through `ui/mergeRequestsStore.ts` `windowMergeRequests(source, { screen, problem,
settings })` (`createMergeRequests` + `registerMergeRequests`; the slice reads the discussion mode as
`settings.discussionDetails`; failures reach the window's problem bar as `{ action:
"mergeRequests", step: "find" | "list" | "open" | "job" | "mergeRequest" | "resolve" | "continue" | "localMerge" | "rerequestReview" | "jobLog" | "discussion" }`;
the steps `discussions`, `searchPeople`, `changePeople` and `description` name a failure in its box or panel only; `link`, a
description link's open, words the page problem line as the other `openPage` kinds, `PageKind` `job` | `mergeRequest` |
`discussion` | `link`) and run `ui/startScreen.ts`
`openAtStart(mergeRequests, screen)` beside `loadSettings()` at start-up; every page file reads it through
`useMergeRequests()`, as Settings reads `useSettingsStore()`. **The start screen** (plan §2 #167): both stores take one
`WindowStart { theme, screen }` (`StartScreen` = `Extract<Screen["kind"], "files" | "mergeRequests">`), which `main.ts`
builds per compare or range window from the shell's `<html data-open>` (app) or the fixture's `?open=mergeRequests`
through `startScreenOf` (only the word `mergeRequests` means the page; anything else, absent included, the files).
`openAtStart` awaits `findProject()` and opens the page through the slice's `show` only when started on it and the
project is `found`: no project or a failed lookup keeps the window on its files (the lookup's problem as before).
**The list's age** (plan §2 #167): left of Refresh, in one `ml-auto` group with it, the header shows
`agoText(listedAt, now)` in `text-fg-muted` (nothing while `listedAt` is null) on its own clock, `ui/useListAge.ts`: `now`
is read at each `listedAt` change and each whole minute after it, so "just now" lasts under a minute (the rows keep the
page's minute `useNow`); with
core `timeTitle(at, now)` as its `v-tooltip`: `HH:MM` on now's local day, else `dateTimeText`. `listedAt`'s writers are
§5.1's row.
`MergeRequestsButton.vue` (Lucide `git-pull-request`, only while `project.kind === "found"`) sits directly before
the gear in `CompareView`, `RangeView` and the range window's empty-range header (kept mounted with `v-show`, so the
keyboard can return to it). `MergeRequestsView.vue` is a screen like Settings (`screen.kind === "mergeRequests"`,
where each root mounts `SettingsView`): Back (focused at mount) and Escape by `ServerLogView.vue`'s rule close it and
return the keyboard to the element focused before; the filter bar holds, first, `MergeRequestSearch.vue` (the search
field, below) then three `MergeRequestFilter.vue` checklists, with "Load fully" the review-mode button and, in review
mode, its sort icon (below), and the Draft
`ChoiceButtons`; the list scrolls inside, one `MergeRequestRow.vue` per shown row with its open-changes sentence. A
row with a page opens it on a click anywhere but its controls (CI, people, labels, due date, the action and
open-changes buttons), which stop the click; its
title is a button (`openPageTitle`: "Open !N on GitLab: <title>") for the keyboard; a page-less row is plain. Both a
row's, a failed job's and a comment's click go through the slice's `openPage(kind, page)` (`PageKind` `job` | `mergeRequest` | `discussion`):
an IPC failure reaches the problem bar at that step; an answer sets `pageProblem` to `pageProblemText` (`null` when
opened, a sentence for `notOffered`/`failed`), one line above the list with Dismiss.

A row, left to right (plan §2 #151, #157): `MergeRequestPicture.vue` of the author (24 px: `initials` on `bg-primary`
turned by `hue-rotate(pictureHue)`, the domain `picture` as an `img` over them shown only once loaded and removed on
error, `referrerpolicy="no-referrer"` set before `src`; nobody is the muted `user-round`; tooltip `authorText`); the
text column — the title, then the muted `!iid · created …` (its tooltip `dateTimeText` of the creation, "05.10.2026, 11:00":
the local day first, a 24-hour time) with the size (`sizeParts`: `+X` green, `−Y` red, `N files`
in the text colour; tooltip `sizeTitle`) and at its end `MergeRequestLabels.vue` (the first chip in GitLab's colours, a
plain chip without them, and "+N" with a hover box of the rest, `labelsShown`); `MergeRequestPeople.vue` (`peopleStack`:
3 overlapping pictures and "+N"; its hover box lists Assignees, then Reviewers each with the state icon and, when
`mayRerequest` and `reviewDone`, GitLab's re-request button `rotate-ccw` — a spinner while the ask runs, `aria-disabled`
so focus stays on it; when a reply removes the focused button, focus moves to the box itself —; a refusal stays under
its reviewer until the box closes, which calls `dismissRerequestRefusals`; adding and removing people below); `MergeRequestDueDate.vue` (a muted
calendar, or the date `dueDateText` "03.11.2026" (DD.MM.YYYY) over the days left — `daysLeftText`, the error colour when
overdue; the opener, `aria-haspopup="dialog"`, opens a `role="dialog"` box "Choose a due date", shadcn-style, with no
native date field: a DD.MM.YYYY text field (its own `draft`, set to the shown date at each opening) read by `typedDay` on
Enter (day first only, one separator throughout or eight digits, a four-digit year; a refused text is marked
`aria-invalid` with the error border, kept as typed, and nothing is saved), `MergeRequestCalendar.vue` and the footer's
Today (`PICK_TODAY`, `localDay` of now) and Clear. The calendar shows `monthCaption`
(`aria-live`) between the Previous/Next month chevrons and a Monday-first `role="grid"` of `monthGrid`, labelled by the
caption: `aria-selected` on the chosen day's gridcell, `aria-current="date"` on today, each day button named by
`dayName`, one roving tab stop on the focused day, moved by the WAI-ARIA date-picker keys (core `movedDay`: arrows,
Home/End, PageUp/PageDown, Shift+PageUp/PageDown a year; `addDays`, `addMonths` clamped; other keys move nothing) and
focused on mount. The box saves only
on Enter, a day click or a footer button, never on blur, and closes on a save, Escape, a click or a scroll outside,
focus back on the opener); the open discussions (`MergeRequestDiscussions.vue`, below); the approvals (`approversText` as the tooltip, one name per line); the CI box;
`MergeRequestReadiness.vue` (the Lucide icon of `readinessIcon`, `circle-dashed-check` for `mergesCleanly`; tooltip and
accessible name `readinessText`); the row's one action (`rowAction`: Resolve on a conflicts row, Continue on the merging row
whatever its readiness, disabled while its window is open, a fork or another unfinished merge disabling Resolve) with
its reply line (`rowReplyText` in `ui/mergeRequestRowReplyText.ts`, `role="status"`, the error colour only for refusals); the open-changes button.
`MergeRequestsView.vue` passes `localMerge`, each row's `actions` entry, due date and re-request asks, and re-reads
the local merge on the window's `focus` (plan §2 #138, #143). Shown rows (`ui/mergeRequestsShown.ts` `shownOf`, spread
into the slice: the remembered filters, `shownRows` = `datedFirst(searched(filtered(…)))` or, in review mode,
`reviewOrdered` over the same rows, `choices` over every loaded row, `summary` "N of M", `viewer`, `reviewSort`): dated
first by day, equal days newest first, then the rest newest first (`datedFirst` by `DueDates.dueOf`, the one due-day
lookup, #156).

**People** (plan §2 #169, #170, RK64, RK65; request `docs/slices/request-mr-people.md`): on a row with `mayRerequest`
`MergeRequestPeople.vue`'s box always shows both groups ("None" when one is empty; a row with nobody opens the box from
its dimmed icon), each header with a Lucide `user-plus` add button ("Add assignee"/"Add reviewer") that toggles
`MergeRequestPeopleSearch.vue` under it (one field per box, the box's own `adding`). The field is a focused
`role="combobox"` over a `role="listbox"` of `mergeRequestPeopleLines.ts` `pickList`: while empty the core's
`peopleSuggestions` (Me, the row's own people, then everyone on the loaded rows by count, at most 20), else the slice's
`peopleSearch` people with "Searching…" over the last results, "No one found", or a refused or failed search in the
error colour; people already in the group are `aria-disabled` "Already an assignee/reviewer", a queued add spins.
Typing calls `searchPeople` (core `searchedText`, `SEARCH_PAUSE_MS` 250 after the last key, an older answer dropped);
arrows move over the addable lines (`steppedHighlight`), the highlight back on the first addable line whenever the lines
change (`keptHighlight`); Enter or a click (its `mousedown` prevented) calls `changePeople`, the line spinning until the
add is answered; then the field clears if its text is unchanged since the pick and takes focus back only from the
page body, never from another control. Escape closes the field (focus to its add button, `endPeopleSearch`), a second
Escape the box. Each person ends
with `MergeRequestPersonMenu.vue`: Lucide `ellipsis-vertical` "More" and one `useDropdownMenu<true>` menu, `position:
fixed` inside the box so the hover box holds it, with "Remove assignee"/"Remove reviewer"; while that remove is queued or
running the spinner, `aria-disabled` and no menu. The slice (`ui/mergeRequestPeople.ts`) runs one change per merge
request at a time, in order, an equal one queued once; a `changed` or `unchanged` reply writes both answered lists into
the row through `withPeople`; a change GitLab did not make is one `peopleChangeText` sentence until the box closes
(under the person for a remove still listed, else under the group: "GitLab did not add @olga as assignee (GitLab Free
allows one assignee per merge request).", "GitLab still lists Anna Berg as reviewer.", GitLab's refusal, or the failure
through `problemText` at step `changePeople`). The box calls `peopleBoxOpened` when it opens and `peopleBoxClosed` when
it closes or unmounts open, so `shownRows` keeps its row until then (request rule 9). Every control of a line carries
`data-control`; when a reply removes the focused one, focus moves to the box.

**Review mode** (plan §2 #165, #166, RK62, RK63): `filters.review` (`ReviewFor`: Me or a person, never "None") is a
field of the remembered filters, so it is stored with them and read as null unless "Discussion details" is "Load
fully" (§5.1). `MergeRequestReviewMode.vue` (shown only with "Load fully") is the button, Lucide `user-round-search`
named and tooltipped `REVIEW_MODE`, `border-primary` while on; it is a second opener of the bar's one `useHoverMenu`
(`"review"`), and its menu (`MergeRequestMenu.vue`, the filters' box) lists `choices.review` (core `reviewChoices`: the
Reviewer filter's choices without "None", in their order, narrowed above `NARROW_FROM`) as `menuitemradio` items, the
chosen one checked. A pick calls `review(who)` (core `reviewing`: Reviewer = who, Draft = ready, every other filter
off, the search kept) and closes the menu; every other filter edit keeps the order; only Clear filters (`NO_FILTERS`)
ends it. The shown rows are then core `reviewOrdered(rows, viewer.username, dueOf, detailsOf)`: the normal order
(`byDueDate`), then one stable sort — due rows with at least one discussion that is the reviewer's turn first, the
rest by fewest discussions waiting on the author; details not arrived count as none, so rows move at each answer. A
refused or failed shown row keeps the whole list in the normal order and names the first such row.
`MergeRequestReviewSort.vue` is the sort icon (Lucide `arrow-down-wide-narrow`, `role="img"`, the primary colour, the
error colour when failed): its tooltip and name are `reviewSortedText(viewer, loading)` ("Sorted for your review: due
with your turn first, then fewest waiting on the author", plus the count still loading) or `reviewFailedText(viewer,
iid, discussionsFailedText(failure))`. `viewer` (core `viewerOf`: Me, or a person named by the first row reviewer's
display name, else the username; a person who is `me` is Me) is the one viewer of the order and the discussions box.

**Open discussions** (plan §2 #162–#164, RK60, RK61): `MergeRequestDiscussions.vue` is the row's count. With "Off" or a
count of 0 it is the plain count (`vTooltip` `discussionsText`, muted at 0), no box and no ask; else the people box's
shape (`useHoverBox`, an opener button named by `discussionsText`, no tooltip, #154), its entry from
`ui/mergeRequestDiscussions.ts` `useRowDiscussions`, which calls `askDiscussions` when the box opens and again when an
open box loses its entry at a swap. Its `role="status"` header: `DISCUSSIONS_LOADING` with no entry or while loading,
`turnSummaryText(turnCounts(…, viewer.username), viewer)` once read ("1 of 2 waits for you" / "… for Anna Berg"), else
`discussionsFailedText` (`ui/mergeRequestsText.ts`: a refusal's `glabRefusalText` — the one home of the glab words of
the list, the box and a re-request reply — or `problemText` at step `discussions`; the sort icon's reason too), in the
error colour, never the problem bar. Its lines are `discussionTurns(…, viewer.username)` (core `mergeRequests/`: the
viewer's turn first, newest last comment first within each, ties in GitLab's order); each is a button calling
`openPage("discussion", page)` when the last note has a page, else a `div`: the author's `MergeRequestPicture` and
`noteAuthorName`, `agoText`, `turnText(turn, viewer)` ("Your turn", "Anna Berg's turn", "Waiting for an answer"), `placeText`, and
`noteExcerpt` (three lines, 280 code points, then "…") clamped to three lines; every text interpolated, never
`v-html`. The queue that fills the entries is §5.1's row. `MergeRequestDiscussionSetting.vue` is Settings → "Discussion
details" (`DISCUSSION_DETAILS_OPTIONS` "Load fully" / "Load lazily" / "Off" through `ChoiceButtons`,
`setDiscussionDetails` on the settings seam); the compare and range roots put it into `SettingsView`'s slot; the merge
window has no such section.

**Description** (plan §2 #171–#174, RK66, RK67; request `docs/slices/request-mr-description.md`): the row's info column
(`w-7`, between the approvals and the CI box, always rendered so the icons stay aligned) holds Lucide `info` (tooltip and
name `SHOW_DESCRIPTION` "Show description", `data-description-opener="<iid>"`) only when `row.hasDescription`; it calls
`toggleDescription({ iid, title })` (§5.1). `MergeRequestsView.vue` renders the one `MergeRequestDescription.vue` after
the list while `description` is set, keyed by the iid (a replace mounts a new panel: focus, scroll top), passes it
`asking` (a question is open), and calls `closeDescription` when it unmounts. The panel is a non-modal `role="dialog"`,
about `min(64rem, 100vw − 4rem)` wide and up to `85vh`, centred, its content scrolling inside; it takes focus on mount;
Escape (a window `keydown` listener in the bubble phase, only for an Escape nothing took (`defaultPrevented`), skipped
while `asking`; MergeRequestsView's own window listener runs first, closes an open filter menu, and otherwise leaves
Escape to the panel while a description is shown) and its close button call
`closeDescription` and return focus to the row's opener when still listed; a press outside it closes it
(`onClickOutside`, ignoring `[data-description-opener]` and `[data-refreshes-list]` — Refresh and the list failure's
Retry —, so a refresh leaves it as loaded); a page scroll leaves it. Its header is the title as opened; its body
"Loading…", `NO_DESCRIPTION` "No description." for no blocks, `descriptionRefusalText` or `problemText` at step
`description` with Retry (`retryDescription`), or the blocks. Renderers use text interpolation only, never `href`,
`v-html` (`vue/no-v-html` an ESLint error), `innerHTML` or `title`: `MergeRequestDescriptionBlocks.vue` and
`MergeRequestDescriptionInlines.vue` each render nested content through themselves with `editor/theme.css`'s
`markdown-*` classes (table alignment `markdown-align-center`/`-right`); a link is an `a` with `role="link"`,
`tabindex="0"` and no `href` whose click or Enter calls `openPage("link", page)` for a `page` link and nothing for a
`refused` one, each link's tooltip its address; task boxes are Lucide icons with `role="img"` and their word (`TASK_DONE`,
`TASK_OPEN`, `TASK_INAPPLICABLE`); `MergeRequestDescriptionImage.vue` loads the slice's `imageAddress(image)` (the
source's `uploadedImage(key)` for an upload, the address for another site's, null when refused) `max-w-full` with
`referrerpolicy="no-referrer"` and shows the caption (else the `web` address, else `IMAGE_STAND_IN` "picture") when it
is null or fails; `MergeRequestDescriptionCode.vue` hosts one `MarkdownView` through `useMarkdownCode` (`showCode`, the
panes' colours, plan #112's one colour table). The words are `ui/mergeRequestDescriptionText.ts`.

Search (#2150): `MergeRequestSearch.vue` (Lucide `search` inside on the left, `aria-label` "Search merge requests",
placeholder "Search title or !number", `type="text"`) shows the slice's `search` and sends each input to `setSearch`.
A row is shown when it passes the filters AND matches the search (core `searched`): its title, "Draft: " included,
contains the trimmed text in any case, or any number in the text equals its iid — a number is a run of ASCII digits
with no letter or digit beside it, so `!630`, `#630`, `MR 630 fix` and a pasted `…/merge_requests/630` name 630,
`v2`/`abc123` name nothing, `0042` names 42 —; blank text matches every row. The checklists' counts ignore the search;
Clear filters keeps it. Escape in the field with text empties it (and calls `preventDefault`, so the page stays);
in an empty field it leaves the page; the × (`Clear search`, shown only with text) empties it and keeps the focus in
the field. The text is kept across Refresh, emptied by `show`, never stored.

Hover (plan §2 #154, #155): every hover text on the page is `v-tooltip` (`ui/tooltip.ts`): one tip element per window,
400 ms, at once within 300 ms of the last, above at the anchor's left or below when it does not fit
(`operationTooltip.ts` `tooltipPlacement`), gone on leave, scroll, Escape or a press; the text mirrored to
`aria-description` unless it equals the `aria-label`; no page component has a `title` (`mergeRequestTitles.test.ts`).
WebKit sends no pointer events to a disabled button, so a control that can be disabled carries its tip on a wrapper.
Rich content is a box the pointer enters, `useHoverBox` (`ui/useHoverBox.ts`: open at once on hover or focus,
`position: fixed`, not teleported, so Tab reaches it, held while pointer or focus is in opener or box, closed by
leaving both, by Escape or by a scroll outside, `useScrollOutside`): `CiStatusBox.vue`'s failed jobs, the people and
the labels boxes. The filter bar holds one `useHoverMenu<ListFilter | "review">` (`ui/useHoverMenu.ts` over
`useDropdownMenu`): hovering an opener opens its list with focus kept, leaving closes it after 300 ms (`dismiss`: focus
returns to the opener only from inside), a click pins it and moves focus in (the narrowing box when there is one),
Escape with a list open closes the list, not the page. Every menu is `MergeRequestMenu.vue` (the box, its narrowing
input above `NARROW_FROM` values and the typed text, emptied at each opening; the items through a scoped slot); arrows
step `menuKeys.ts` `MENU_ITEMS` (`menuitem`, `menuitemcheckbox`, `menuitemradio`). Each checklist (`menuitemcheckbox`
items keep it open, × clears) lists "Me", "None", then the values by count, then by name; a click includes or
clears a value, Shift+click excludes it (`filterActions` `click(filter, value, shift)`, core `clicked`); while Shift
is held every value shows `circle-minus`, and an excluded one keeps it in the error colour with its label struck, named
`not <label>`. "Held" is `useShiftHeld()` (`ui/useShiftHeld.ts`: one `ShiftState` per window, `up` or `held { alone }`,
both with a `taps` count, shared by the three filters and every CI box through `createSharedComposable`; the pure rule
`shiftAfter` on `useKeyHold`, `ui/keyHold.ts`): held at Shift's keydown, up at Shift's keyup, both told by the key
name, never by `shiftKey`/`getModifierState`, because WebKitGTK on X11 reports Shift still set on Shift's own release;
up too on window blur, the page hidden, or a pointer event without `shiftKey` (a release the page never saw; pointer
listeners exist only while held), none of which counts a tap. Other keys keep it held, so capitals can be typed in the
narrowing box.

The job log (plan §2 #158–#161, RK57, RK59): a Shift tap (`useShiftTaps()`: Shift down then up with no other key and
no pointer press between, so Shift+Tab, Shift+click and a typed capital never count) over a failed job's row, or on
its focused button, opens that job's log while the CI box is open, the job has a page and focus is in no text field
(`ui/typingTarget.ts` `isTypingTarget`; the log's own field included, so Shift there types a capital). `CiStatusBox.vue`
watches the tap count, tracks the pointed job (its `<li>`, since a disabled button gets no pointer events) and the
focused one, forgets both when the box closes, and calls the slice's `showJobLog` (`ui/mergeRequestJobLogs.ts`: Shift
over the job already loading or shown does nothing; a refused or failed one asks again). `CiStatusJobLog.vue` is a DOM
child of the CI box's hover area, so `useHoverBox`'s one inside rule holds both and a scroll inside the log closes
nothing; it sits left of the CI box, tops level, clamped (`useMenuPlacement`), 56rem × 36rem at most the window less
2rem, and closes with the CI box. Escape inside the log is the log's: it prevents the default and closes, and the CI
box puts focus on the job's button (found by `data-job-page`); `useHoverBox` ignores an Escape already
`defaultPrevented`, so a second Escape closes the CI box. A refused or failed load moves focus from the field to the
log body. Lines are static: one `div` per line, one `span` per run with `ui/mergeRequestLogLook.ts` `runClasses` and the
run's text as text, never markup (no `v-html`); a run with an ANSI background takes `text-panel` as its text colour
(every `--color-ansi-*` is ≥ 4.5:1 against `--color-panel`); a cut log starts with "Earlier lines are on GitLab." and
"Open the whole log on GitLab"; the log opens at its end (`useFollowEnd`). The search field (its text per job name,
`setJobSearch`, filled, selected and searched on open) runs `search/` `matcherOf` (case-insensitive) over the view's
`text`; `hitPlaces` maps the hits onto runs, painted as CSS Custom Highlights `job-log-match` and `job-log-current` with
no DOM change. Every hit counts and is stepped (Enter / Shift+Enter, the first current the last), but `job-log-match`
holds only the hits on lines in view ± one screen (`firstLineBelow` on the lines' `offsetTop`, `placesOnLines`),
rebuilt at once on a search and once per animation frame on a scroll or a step, since tens of thousands of live
ranges cost seconds per paint in WebKitGTK; the current hit is centred by `scrollTop` only; both highlights are
deleted on unmount. Words: `ui/mergeRequestLogText.ts`; a job's hover in the CI box names Shift.

The pure core is `frontend/src/mergeRequests/` (`index.ts` the only surface; framework-free and self-contained like
`search/`): `filters` (`Held { value, mode }`, `passes`, `filtered`, `stateOf`, `clicked` and the other edits, `reviewing`, `ReviewFor`, `filterLabel`), `choices` (`personChoices`, `labelChoices`,
`reviewChoices`, `narrowed`), `order` (`merged`: one row per iid, newest first; `byDueDate`), `reviewOrder` (`reviewOrdered`, `reviewSortedText`, `reviewFailedText`; RK63), `discussions` (`discussionTurns`, `turnCounts`, `viewerOf`, `viewerPossessive` — the one spelling of "Your"/"Anna Berg's" —, `turnText`, `turnSummaryText`), `dueDate` (`CalendarDay`, `daysLeft` from
`localDay`, `compareDays` in whole days pinned to UTC, RK56; `typedDay`, `dueDateText` DD.MM.YYYY, `dateTimeText`
"DD.MM.YYYY, HH:MM" local, `timeTitle` the list age's tooltip, `HH:MM` alone on now's local day), `calendar` (`monthGrid`, `addDays`, `addMonths`, `movedDay`, `monthCaption`, `dayName`),
`people` (`peopleStack`, `initials`, `pictureHue`,
`reviewDone`, `reviewStateText`, `authorText`, `approversText`), `labels` (`labelsShown`, `moreText`), `summary`, `search` (`searched`), `relativeTime` (`createdAgo`), `ciBox`, `stored`
(`filtersFrom`/`storedFilters`, the remembered form, `not:` for an excluded value, `review` a fifth key only while on; RK55, RK62), `size` (`sizeParts`, `sizeTitle`), `readiness` (`readinessText`,
`readinessIcon`, `rechecked`: a checked row's readiness put into the rows), `rowAction`, and the job log (`jobLog`:
`jobLogView(raw)` → styled `LogLine`s by GitLab's job-page rules and the shown `text`, `hitPlaces`; `sgr`: `penAfter`,
GitLab's SGR code table; `ansiColours`: `AnsiColour`, `basicColour` 256 → nearest of 16 on xterm's palette;
`jobLogSearch`: `firstHit`, `steppedHit`, `hitCountText`, `NO_RESULTS`, `firstLineBelow`, `placesOnLines`). Words:
`ui/mergeRequestsText.ts` (the page's, `REVIEW_MODE` and `discussionsFailedText` too), `ui/mergeRequestRowReplyText.ts` (`rowReplyText`) and `ui/glab.ts`
(`GLAB_MISSING_TEXT`, `glabNotLoggedInText`, `glabFailedText` and `RECHECK_PAUSE_MS`, shared with the range window's
GitLab check).

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
  `serde_json` at run time only in `cli`, `settings` (plan §2 #57), `compare` (plan §2 #97), `review` (#117),
  `merge-requests` (glab's GraphQL answers, #131) and `local-merge` (its record, #140). Crates: merge-core, gitio,
  session, cli, conflict-repo (dev-only), settings, lsp-host, compare, range, review, pipe, agent, merge-requests,
  local-merge, src-tauri. `merge-requests` also takes `dom_query` 0.28 (parsing GitLab's description HTML) and `url`
  2.5 (resolving and serialising its addresses), both already in the app's build through tauri (#171).
- **Readable-by-a-Rust-beginner rules** (the product owner reads this code; cleverness is a
  defect): owned types at crate boundaries (`String`, `Vec<T>`, `PathBuf`); no lifetimes in
  public signatures beyond `&str`/`&[T]`/`&Path` parameters; a generic needs two concrete
  uses, a trait needs two implementations, else write the concrete thing; derive macros only
  (`serde`, `thiserror`, `specta`), no `macro_rules!`; iterator chains of at most three
  adapters, otherwise a `for` loop; no `Rc`/`RefCell`/`Arc` outside `src-tauri`'s `Mutex`es
  (`Merge` = the held `MergeSession` or none after an abort, #74; the language-server `Host`, plan §2 #70; the compare
  window's `TabStore`, #97; the range window's `ThreadStore` and send guard, #117; `AiState`, #110; the merge-request
  job pages a list handed out, #133; its run's merged pairs, #149; its picture shelf with the `Condvar` its askers wait on, #152; never held together) and `yamt-compare`'s `Arc<str>` columns (a reply's diff runs outside the
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
  `define-macros-order`, `block-order`, type-based props/emits declarations, `require-typed-ref`; `vue/no-v-html` an
  error, pinned by `frontend/scripts/eslintRules.test.ts`, RK66). No typescript-eslint, no Prettier.
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
