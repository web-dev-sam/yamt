# GitOpsDesign — notes (designer, 3.J row 1)

Full output of the designer, verbatim. Orchestrator's choice and decisions: board "Git operations" row 1 and plan §2 #85–#90.

I couldn't run any git experiment: this session only had read, grep, glob and web search, with no shell. The installed git is **2.56.0** (`/var/lib/pacman/local/git-2.56.0-1`). Every git fact below therefore comes from git's own source at tag **v2.56.0**, checked against **v2.32.0** (yamt's floor) where it matters, and is marked "from source". The integration tests named in builds R1–R3 are the experiments that still have to run, under `/tmp` with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`.

# 3.J design: rebase, cherry-pick, revert, merge, squash and `am` as first-class

I recommend **option A**: git's state is read in one place in `gitio`, which pane shows which git side is decided once at open, each stop gets a new session, and the window clears its per-stop state without reloading the page. Nothing was built.

## Facts that change the design

1. **Continue cannot leave git to pick an editor.**
   - `rebase --continue` after a conflict always commits with an editor (`commit_staged_changes` → `run_git_commit(..., ALLOW_EMPTY | EDIT_MSG)` → `git commit -n -F rebase-merge/message -e`; `sequencer.c:5379-5552`, `1130-1185`).
   - `merge --continue` runs a plain `git commit` (`builtin/merge.c:1456-1468`).
   - With no `GIT_EDITOR`, git runs the user's `core.editor` with no terminal and hangs or fails.
   - `GIT_EDITOR=:` is read before `core.editor`, and `:` is never run (`editor.c:29`, `66`). The commit then keeps git's prepared message, with comment lines such as `# Conflicts:` stripped, exactly as saving the editor unchanged would.
   - Cherry-pick and revert already pass `--no-edit --cleanup=strip` when stdin is not a terminal (`sequencer.c:5369-5374`, the same at v2.32.0 `4591-4596`).
2. **A Continue that runs for minutes would freeze the window.** Tauri 2 runs synchronous commands on the main thread, and yamt's commands are all synchronous today. A 30 s timeout that kills git with SIGKILL in the middle of a commit leaves `index.lock` behind. So Continue and Abort run without a deadline, on a blocking worker thread, with the merge held in a `Running` state while git works.
3. **A cherry-pick or revert range has no `done` file.** `done`, `msgnum` and `end` exist only under `rebase-merge/` (`sequencer.c` `GIT_PATH_FUNC`s). A sequence keeps `sequencer/{todo,head,opts,abort-safety}`, and `todo` still holds the stopped command (`save_todo` advances only for a rebase).
   - Progress for a sequence = (commits in `sequencer/head..HEAD`) + 1, out of that count plus the lines left in `todo`.
   - A commit skipped earlier makes this count low; this is an open risk.
4. **Git's own status reader is the precedence to copy.** In `wt_status_get_state` (`wt-status.c:1935-1958`):
   - `MERGE_HEAD` comes first, plus a rebase check;
   - then `rebase-apply/`: with an `applying` file it is `am`, otherwise a rebase (`1855-1863`);
   - then `rebase-merge/`, then `CHERRY_PICK_HEAD`, then `REVERT_HEAD`, then the sequencer's last command.
   - Git does not record a squash merge as an operation. yamt adds it: `SQUASH_MSG` with no `MERGE_HEAD`; the merged tip is the first `commit <oid>` line (`builtin/merge.c:441-478`).
5. **`am` facts.**
   - Files: `rebase-apply/next` and `last` (`am.c:1107-1108`) and `final-commit`, which holds the message (`am.c:387`).
   - `REBASE_HEAD` is written only when `am` runs for a rebase (`am.c:1478-1482`).
   - The label on git's side of the markers is the patch's subject (`am.c:1642-1644`).
6. **A replayed rerere resolution can be told apart.**
   - rerere drops a replayed path from its tracking list (`rr_item->util = NULL` after "Resolved '%s' using previous resolution", `rerere.c:736-773`), and `write_rr` skips such paths (`245-270`).
   - `MERGE_RR` itself is written on every rerere run while rerere is on (`do_plain_rerere` → `write_rr`).
   - So the rule is: `MERGE_RR` exists, the path is not in it, git's output for that path had conflict markers, and the disk copy has none.
   - `git rerere remaining` cannot do this: it still lists replayed paths, because they are unmerged when `autoUpdate` is off. `git rerere status` cannot either: it prints nothing whether rerere is off or simply has nothing tracked, and its paths are separated by newlines.
7. **A squash merge's Abort (`git reset --merge`) does not apply `merge.autoStash`.** The stashed changes go to the stash list instead (`git-merge.adoc:110-114`).
8. **A write in flight must not land on the next stop.** Disk versions restart at 0 in a new session. A Save sent before the window hears "moved on" would land on the new stop's file with the same path, which is common in a rebase. So after the stop changes, the old session is dropped and every write answers `StopMovedOn` until the window has cleared its state and listed again.

## The 11 questions (option A)

### 1. Operations

```rust
// crates/gitio/src/operation.rs: the one reader of "what git is doing"
pub struct Stop { pub operation: Option<Operation>, pub head: Option<Oid> }   // PartialEq: the stop's identity
pub enum Operation {
    Merge { merging: Oid },                                 // MERGE_HEAD, no rebase directory
    SquashMerge { merging: Option<Oid> },                   // SQUASH_MSG, no MERGE_HEAD
    Rebase(Rebase),                                         // rebase-merge/, or rebase-apply/ without `applying`
    CherryPick { picking: Option<Oid>, progress: Option<Progress> },  // CHERRY_PICK_HEAD and/or sequencer/todo "pick"
    Revert { reverting: Option<Oid>, progress: Option<Progress> },    // REVERT_HEAD and/or sequencer/todo "revert"
    Am { subject: Vec<u8>, message: Vec<u8>, progress: Progress },    // rebase-apply/applying, next/last, final-commit
}
pub struct Rebase { pub branch: Option<Vec<u8>> /* head-name minus refs/heads/; "detached HEAD" → None */,
                    pub onto: Oid, pub replaying: Option<Oid> /* REBASE_HEAD */,
                    pub redoing_merge: Option<Oid> /* MERGE_HEAD inside rebase -r */, pub progress: Option<Progress> }
pub struct Progress { step: u32, total: u32 }   // Progress::new(step, total) -> Option<Self>: 1 ≤ step ≤ total
impl Repo { pub fn stop(&self) -> Result<Stop>; pub fn abort(&self, op: &Operation) -> Result<()>;
            pub fn continue_operation(&self, op: &Operation) -> Result<GitRun> }   // GitRun { succeeded, output }
```

- **One reader:** `Repo::stop()`. Callers are `MergeSession::open`, every `refresh`, and Continue/Abort, which re-read just before running git.
- **How it reads git:**
  - Refs through `rev-parse --verify --quiet <ref>^{commit}` (`commit_named`), which works with reftable and worktrees.
  - Files through one batched `rev-parse --git-path a --git-path b …` call, never a hard-coded `.git/`.
  - `rev-list --count` for the sequence count.
- **Progress:**
  - rebase, merge backend: `msgnum`/`end`, which count todo commands as git's own "Rebasing (2/5)" does (`sequencer.c` `pick_commits`);
  - rebase, apply backend, and `am`: `next`/`last`;
  - cherry-pick and revert sequences: see fact 3.
- **Stop identity:** `Stop == Stop` (operation with its ids and numbers, plus HEAD). The stop has moved on when the open stop had an operation, the new one has one too, and they differ.
- **Names carried for the top line:** ids and bytes only. `session/src/operation.rs` turns them into names.
- **Unrecorded:** stash pop and `checkout -m` give `operation: None`.
- **Each row is cited from source, not run:** wt-status order, `am.c:1083-1086` (`rebasing`/`applying`), `sequencer.c` paths, `builtin/merge.c` squash. The test matrix is in Q9.

### 2. Orientation: which pane shows which git side (rule 1)

- **Types:**
  - gitio's `Stage::{Base, Local, Remote}` is renamed `Stage::{Base, Ours, Theirs}`, git's own words.
  - session gets `GitSide { Ours, Theirs }` and a new `orientation.rs` with `struct Orientation { left: GitSide }`.
  - `Orientation::of(&Stop)` is one exhaustive match: `Rebase(Rebase { redoing_merge: None, .. })` puts theirs on the left; every other operation, and none, puts ours on the left.
  - Its methods: `git_side(Side) -> GitSide`, `pane(GitSide) -> Side`, `panes(ours, theirs) -> (left, right)`.
- **Decided once:** at open; `MergeSession.orientation`.
- **Type safety:** a pane `Side` and a `GitSide` are different types, `CapturedStages` is keyed by git (`ours`/`theirs`), and `Texts` by pane. A mix-up that skips `Orientation` does not compile. The ranges built in git order stay untyped `Range<u32>` until `Orientation` turns them into `LocalLine`/`RemoteLine`.

| consumer | today | becomes |
|---|---|---|
| `stages.rs` `CapturedStages` | local/remote = stage 2/3 | `ours`/`theirs`; `of(GitSide)` |
| `open.rs` `stored`/`content` → `Texts`, `deleted` | stage order | read in git order; `Texts {local, remote}` and `deleted` built in pane order through `Orientation` |
| `decode.rs`, chunks (`compute_chunks`), words | follow `Texts` | unchanged: already pane order |
| `session.rs` `describe` | `stages.local/remote` | `stages.of(o.git_side(pane))` |
| `writes.rs` `take(side)` → `resolve_with` | `stages.side(side)` | `stages.of(o.git_side(side))`; Keep/Delete and Take follow automatically |
| `UnsupportedReason::LocalDeleted/RemoteDeleted` | stage order | pane order, from the oriented `deleted` |
| `start.rs` (what git wrote) | git order | **stays git order**: it re-runs git's merge |
| `locate.rs` `Maps`, `seed.rs` | block's ours section ↔ `texts.local` | ours section ↔ the pane holding ours, as untyped ranges, then `o.panes()` |
| `waiting.rs` `MarkerStyle`, `block_markers` | local section written first | `Waiting::Markers { open, first: Side, between, close }`; `first = o.pane(Ours)` |
| `editor/internal/fileText.ts` | `[open, …local, …between, …remote, close]` | sections in `waiting.first` order |
| `writes.rs` `reset`, `AtOpen`, `checkout -m` | bytes and git | unchanged |
| `side_names.rs` | left = HEAD | left = the name of git's `o.left` side (Q3) |

- **What stays in git's order on disk:**
  - the index stages, where stage 2 is always HEAD;
  - conflict markers Save writes for a waiting conflict: HEAD's block first, git's labels, byte-equal to git's;
  - what Reset writes back: the at-open bytes;
  - `MERGE_MSG`.
- **Why:** `git diff`, `git checkout --conflict`, rerere and other tools read the worktree and index as git wrote them.

### 3. Names (rule 2)

- `SideName` gains `Revert { short_id, subject, message }` and `Patch { subject, message }`.
- Built in `session/src/side_names.rs` from the `Stop`. A failed read drops only that name, as in #62.

| operation | left (own work) | right |
|---|---|---|
| merge, `rebase -r` merge step | HEAD (#62) | `MERGE_HEAD` (#50) |
| squash merge | HEAD | `merging`, by #50's branch rule (`branches_at`), else its commit form |
| rebase | `REBASE_HEAD` as a commit | HEAD as a commit (detached) |
| cherry-pick | HEAD | `CHERRY_PICK_HEAD` as a commit |
| revert | HEAD | `Revert` of `REVERT_HEAD` |
| `am` | HEAD | `Patch` from `final-commit` |
| unrecorded | HEAD | none: the bare label |

Revert wording (two drafts):

- (1) "Remote (theirs): **revert of** 9b8e7d6 Add cache"
- (2) "Remote (theirs): **before** 9b8e7d6 Add cache", matching git's own label `parent of …`

The hover shows the reverted commit's full message in both. `am`: "Remote (theirs): patch: Fix typo", with the message on hover.

### 4. Top line (rule 3)

- **Where:** `App.vue`'s right column, `flex flex-col gap-island`, as its first child above `NoticeBar`. It is one row in a new `ui/OperationBar.vue`: `h-8`, `rounded-md border border-info-border bg-info px-3 text-fg truncate`, `role="status"`. The tokens already exist in both themes.
- **No operation recorded:** not rendered.
- **Hover:** the full message of what is being applied.
- **Words** (`ui/operationText.ts`):
  - "Merging feature/reminders into main"
  - "Squash-merging feature/reminders into main"
  - "Rebasing feature onto main · 2 of 5" ("Rebasing detached HEAD onto …" with no branch)
  - "Cherry-picking 3f2c1a0 Fix login · 1 of 3" (no "· …" for a single commit)
  - "Reverting 9b8e7d6 Add cache · 1 of 2"
  - "Applying patch 2 of 4: Fix typo"
  - A missing name drops that part.
- **"All resolved" banner while an operation is recorded:** "All files are resolved. Continue rebase to let git go on." For a merge: "…Commit merge to commit it."
- **Fixture mode:** `?operation=merge|squash|rebase|cherry-pick|revert|am|none` and `?remembered=<path>` (`ipc/fixtureOperations.ts`).

### 5. Abort (rule 4)

| operation | command | what the repository should look like afterwards (from source and docs) |
|---|---|---|
| merge | `merge --abort` | as before the merge; the autostash is applied |
| squash merge | `reset --merge` | merged files back to HEAD; `SQUASH_MSG`/`MERGE_MSG` removed; an autostash goes to the stash list (fact 7) |
| rebase | `rebase --abort` | branch back at `orig-head`; the autostash is applied |
| cherry-pick, revert | `cherry-pick --abort`, `revert --abort` | `reset --merge` to `sequencer/head`; a single pick resets to HEAD; if HEAD moved, git warns "Not rewinding" and exits 0 (`sequencer.c:3577-3620`) |
| `am` | `am --abort` | back to the start; if HEAD moved, git does not rewind (`am.c:2155-2194`) |

- **Id and stored choice:** the button id stays `abortMerge`, so stored hide/show decisions survive the rename (no migration).
- **Labels:** "Abort merge", "Abort squash merge", "Abort rebase", "Abort cherry-pick", "Abort revert", "Abort applying patches".
- **Question** (title = label):
  - Rebase: "The rebase stops and feature goes back to where it was before the rebase. The 1 commit already replayed, every resolution and every save at this stop are lost, and so are unsaved edits. yamt closes."
  - Sequences and `am` name their N commits or patches the same way.
  - Merge keeps #74's text.
- **stderr:** "yamt: rebase aborted" (one per operation); exit 1.
- **Merge state:** `Merge::Aborted(OperationKind)`, set only after git succeeds. Every merge command then answers `MergeAborted` and the window is destroyed, as in #74.
- **Git refusing:** "Could not abort the rebase: <git's message>".

### 6. Continue (rule 5)

- **Commands:**
  - merge: `merge --continue`
  - squash merge: `commit`, which uses `SQUASH_MSG` plus `MERGE_MSG`
  - rebase: `rebase --continue`
  - cherry-pick, revert: `cherry-pick --continue`, `revert --continue`
  - `am`: `am --continue`
- **How git runs:**
  - Every Continue runs with `GIT_EDITOR=:`, stdin closed and no deadline.
  - Hooks run as in a terminal. Git sends hook output to stderr, which yamt captures.
- **Telling the outcome apart:** after git, `Repo::stop()` is read again.
  - no operation recorded → **finished**: `Merge::Finished(kind)`, the window is destroyed, exit 0, "yamt: rebase finished", followed by git's own output (for example an autostash note);
  - the same `Stop` → **refused**: `IpcError::Git` with git's message; the session stays;
  - a different `Stop` → **stopped**: `ContinueReply::Stopped { message }`; the merge becomes `MovedOn` (old session dropped).
- **The window after "stopped":** `ui/stops.ts` `nextStop()`.
  - It marks every write claim overtaken and clears them.
  - It empties `opened` (views unmount, controllers and undo are destroyed, and the open language-server documents close; the servers keep running), `choices`, `taken`, `notices`, `active` and `problem`, and bumps `latestOpen`.
  - It sets the screen to the file list, then runs `loadFiles()`. In the `MovedOn` state that list call opens the new stop, so names and the top line arrive with it.
  - If the new list is empty, the problem bar shows git's message.
- **Moved on outside:**
  - `refresh` reads the `Stop` **before** settling. If the stop moved, it answers `Listing::MovedOn` and settles nothing, so nothing is staged into the next stop.
  - The window runs `nextStop` with the notice "The rebase moved on outside yamt; your unsaved edits in a.ts were dropped".
  - **Ended or aborted outside** keeps today's refresh: the top line, Continue and Abort go.
- **Button:**
  - A text button "Continue rebase" ("Commit merge" for a merge or squash merge), id `continue`, shown at first, right after Mark resolved, and listed in the right-click menu.
  - Disabled while files are left, with the hover "2 files are not resolved yet".
  - Disabled while a write is in flight or git runs ("Continuing…").
  - Unsaved edits ask first: "Continue the rebase without saving them?", confirm "Continue Without Saving".
- **While git runs:** the window refuses to close; other commands answer `GitRunning`.

### 7. rerere (rule 6)

- **Detection:** `Repo::rerere_tracked() -> Option<Vec<PathBuf>>` reads `MERGE_RR` through `--git-path`. Its records are `<id>[.<variant>]\t<path>\0`.
- **Where the exception lives:** `start.rs` `compare_merged` returns `StartLook::Remembered(git_output)` when all of these hold:
  - `MERGE_RR` exists;
  - the path is not in it;
  - git's re-run output for the path has blocks;
  - the disk has no markers.
- **What it sets:** `AtOpen::Remembered { disk, git_output }` and the first-seen state `Seen::ViewRemembered(disk)`. Nothing settles it, because `seen` equals the disk.
- **Outside changes:** a later disk change becomes `ViewFromDisk`, following #52.
- **What the opened file shows:** I chose view (b) below.

| view | what the user sees | cost |
|---|---|---|
| (a) today's disk view | remembered text, sides with no changes | zero lines; fails "sides show what each changed" |
| **(b) recommended** (`session/src/remembered.rs`) | remembered text as the Result (`Middle::Disk`); one waiting `Conflict` per block git wrote, its sides located exactly as in the disk view, its Result lines found by `line_map(git_output, remembered).covering(block)`; `Waiting::AsShown`, so Save keeps the remembered text | ≈120 lines; Mark resolved asks "1 unresolved conflict still remains" unless the user ignores both sides first (open question 3) |
| (c) every stage chunk mapped into the remembered text | everything, including one-sided changes | a second mapping engine; ignoring a one-sided change would contradict the text shown |

- **File-list sign:** `FileStatus::Remembered`, still unresolved for git, for `Next file` and for the exit status. New `ui/FileMark.vue` shows Lucide `history` with "remembered" and the hover "git rerere filled in a resolution you recorded before; review it, then Mark resolved".

### 8. Contract (option A)

- **`list_files`** returns `Listing`:
  - `Files { files, disk_changes, operation: Option<OperationView>, sides: SideNames }` or `MovedOn`.
  - `sides` replaces the `side_names` command; `operation` replaces `merging`.
- **New commands:**
  - `continue_operation() -> ContinueReply`: `Finished` or `Stopped { message }`; async.
  - `abort_operation() -> ()` replaces `abort_merge`; async.
- **`OperationView`** is tagged `Merge{merging, into}`, `SquashMerge{merging, into}`, `Rebase{branch, onto, applying, progress}`, `CherryPick{picking, progress}`, `Revert{reverting, progress}`, `Am{subject, message, progress}`. Names are `Option<SideName>`; `Progress{step, total}`.
- **Other DTO changes:**
  - `FileStatus` gains `Remembered`;
  - `Waiting::Markers` gains `first: Side`;
  - `SideName` gains `Revert` and `Patch`;
  - `IpcError` gains `StopMovedOn`, `GitRunning`, `MergeFinished`, `NoOperation`.
- **`src-tauri` `Merge`:** `Held(MergeSession)` | `Running(OperationKind)` | `MovedOn { root }` | `Aborted(OperationKind)` | `Finished(OperationKind)`.
- **Window side:**
  - `ipc/domain.ts` adds `toListing`; Rust guarantees `Progress` by construction, so there are no new brands and no new checks.
  - `ChunkSource`: `listFiles(): Listing`, `continueOperation()`, `abortOperation()`; `sideNames()` is removed.

### 9. Tests

**Rust** (`conflict-repo` gains `operation_repo(Run, steps)` with `Run` = Merge | SquashMerge | Rebase{apply} | RebaseMerges | CherryPick | Revert | Am | StashPop, plus `rerere_repo`):

| test | the bug it catches |
|---|---|
| `gitio/tests/operations.rs`: each `Run` reads its `Operation` with its ids, both rebase backends, `-r`, single and range picks/reverts, `am -3`; stash pop → `None` | wrong precedence, e.g. a `rebase -r` merge step read as a merge |
| progress: 3-commit rebase stopped at commit 2 → 2/3 (both backends), cherry-pick range 1/3 then 2/3, `am` 2/4 | off by one; reading `done` |
| identity: re-read equals; a terminal `--continue` differs; a refused `--continue` equals | dropped edits on a non-move, or a missed move |
| abort per `Run`: `status --porcelain`, branch tip and `stash list` as before the operation | `merge --abort` used for a squash merge |
| continue with `core.editor=false` in the fixture config: commits with git's message (no `# Conflicts`, squash step combined) | editor not suppressed → hang |
| a refusing `pre-commit` hook (merge): the hook's stderr is in the output; HEAD and the index unchanged | hook output lost |
| `session/tests/orientation.rs`: rebase load gives local = stage 3; `LocalOnly` = the replayed commit's change; `take(Local)` stages stage 3; Keep on a deleted-side file keeps own work; Save of a waiting conflict is byte-equal to git's file; a disk-view block's apply-left gives own work's section; merge and cherry-pick keep HEAD left | one consumer left in git order |
| `session/tests/side_names.rs`: every row of Q3 | names on the wrong pane |
| `session/tests/operations.rs`: a terminal continue → `MovedOn`, nothing staged | old files staged into the next stop |
| `session/tests/remembered.rs`: listed `Remembered`, unstaged after `refresh`; load shows remembered middle and chunks; finish stages; `autoUpdate=true` not listed; a hand fix with rerere off still staged (#52) | rerere staged unseen; hand fixes misread as rerere |
| `src-tauri` `merge.rs`: `Running` refuses commands; `Finished` → 0 "rebase finished"; `MovedOn` → write answers `StopMovedOn`, nothing written; the next list opens the new stop | a stale Save into the next stop |

**Node:**

| file | the bug it catches |
|---|---|
| `operationText.test.ts` | a missing name or progress in a sentence |
| `toolbarButtons.test.ts` | `continue` listed with no operation; `abortMerge` decision lost |
| `continuing.test.ts` | unsaved question skipped; a write claim racing Continue; refused not reported |
| `stops.test.ts` | any per-stop state survives |
| `listing.test.ts` | `MovedOn` not handled |
| `fileText.test.ts` | `first: remote` writes the wrong block first |
| `fixture.test.ts`, `tauri.test.ts`, `sideHeaders.test.ts`, `question.test.ts`, `problemText.test.ts`, `noticeText.test.ts` | — |

Rust and `ui/` are mutation-tested by `just mutants` (VF7).

**WebKit** (`pnpm -C frontend dev --port 5277`, `just webdriver 4447`):
1. Each `?operation=` value shows its sentence, labels and question, in both themes (j).
2. `?operation=rebase`: flipped header names; Continue disabled with the hover, enabled after the last Mark resolved (i); Continue → "2 of 3" with views reset; the last Continue logs "finished".
3. `?remembered=word-marks.ts`: the mark and the view (g).
4. `?operation=none`: no bar, no buttons (h).

**Real app** (`scripts/operations-repo.sh <run> <dir>`, debug build, `; echo EXITSTATUS $?` as in AbortMergeVerify2):
- (a) rebase, conflicts in commits 1 and 2: own work left, "1 of 3" → "2 of 3" → exit 0; `git log` shows each commit's own message; binary Take and deleted-side Keep keep own work; Save is byte-equal (`cmp` against `git checkout --conflict=merge`).
- (b) cherry-pick range; (c) revert range with the right side named.
- (d) merge: Commit merge, `git log -1` shows git's message.
- (e) Abort in each of the six operations: status, tip and stash list as before; exit 1.
- (f) `git rebase --continue` in a terminal, then focus: next stop plus the notice.
- (g) rerere; (h) stash pop.
- (i) Continue disabled while a file is left; the hook repository: message shown, nothing changes.
- (j) screenshots in both themes.

### 10. Builds

Order: R1 → R2 → (R3 ∥ W1) → W2 → W3. At most two run at once.

| build | files | lines | gives the next build |
|---|---|---|---|
| **R1** rust-impl: read operations, own work on the left, names | gitio `entry.rs`, `repo.rs`, new `operation.rs`, `lib.rs`, new `tests/operations.rs`, `tests/repo.rs`, `tests/merge_heads.rs`, `AGENTS.md`; conflict-repo `lib.rs`, `AGENTS.md`; session `stages.rs`, new `orientation.rs`, `open.rs`, `session.rs`, `writes.rs`, `locate.rs`, `seed.rs`, `waiting.rs`, `side_names.rs`, `merging.rs` (over `Operation`), `lib.rs`, new `tests/orientation.rs`, `tests/side_names.rs`, `AGENTS.md`; cli `fixture.rs`; generated: `bindings.ts`, `fixtures/{golden,showcase}/*.json` | ≈1,400 | `Repo::stop()`, `Orientation`, `Waiting.first`, `SideName::{Revert, Patch}`; the web typecheck is red until W1 |
| **R2** rust-impl: Continue, Abort, stops | gitio `run.rs` (no-deadline run, both streams), `operation.rs` (abort/continue commands, `GIT_EDITOR=:`), `repo.rs` (drop `abort_merge`, `rebase_in_progress`), `tests/abort.rs` → `tests/abort_continue.rs`; session `operation.rs` (`OperationView`), `session.rs` (`Refreshed`, stop check first, `abort_operation`, `continue_operation`), delete `merging.rs`, `lib.rs`, new `tests/operations.rs`, delete `tests/merging.rs`; src-tauri `merge.rs`, `commands.rs`, `outcome.rs`, `ipc_error.rs`, `mock_window.rs`, `AGENTS.md`; new `scripts/operations-repo.sh`; `bindings.ts` | ≈1,300 | the Q8 contract |
| **R3** rust-impl: remembered resolutions | gitio `repo.rs` (`rerere_tracked`), new `tests/rerere.rs`; conflict-repo `lib.rs` (`rerere_repo`); session `start.rs`, `open.rs`, `disk.rs`, new `remembered.rs`, `session.rs`, `lib.rs`, new `tests/remembered.rs`, `AGENTS.md`; cli `scan.rs`; `bindings.ts` | ≈700 | `FileStatus::Remembered` |
| **W1** web-impl: contract | `ipc/ChunkSource.ts`, `domain.ts`, `tauri.ts`, `fixture.ts`, new `fixtureOperations.ts`, `index.ts` (with tests); `editor/internal/fileText.ts` (with test); `main.ts`; `ipc/AGENTS.md` | ≈600 | `Listing`, `OperationView`, `continueOperation`, `abortOperation` |
| **W2** web-impl: stops and words (`.ts`) | `ui/store.ts` (`merging` → `operation`, drop `loadSideNames`, spread `createContinuing`: ≈296 lines), `listing.ts`, `aborting.ts`, new `continuing.ts`, new `stops.ts`, new `operationText.ts`, `question.ts`, `problem.ts`, `problemText.ts`, `noticeText.ts` (`Notice` gains a moved-on kind), `diskChanges.ts`, `closeGuard.ts` (no close while running), `toolbarButtons.ts` (`continue`), `sideHeaders.ts` (with tests) | ≈1,200 | `store.operation`, `continueState`, `continueOperation`, `abortOperation` |
| **W3** web-impl: chrome (`.vue`) | new `OperationBar.vue`, `OperationButtons.vue`, `StopView.vue`, `FileMark.vue`; `App.vue`, `MergeToolbar.vue`, `ToolbarMenu.vue`, `ChoiceView.vue`, `MergeView.vue`, `FileList.vue`, `FileTree.vue`, `ui/AGENTS.md` | ≈700 | — |

- `store.ts` is touched because `operation` is shared state with one writer (`listing.ts`) and many readers, the role `merging` has today. `continuing.ts` and `stops.ts` take the store's `loadFiles` through their target, so no import cycle.
- The orchestrator owns plan §2, `architecture.md` (§3.2, §3.3, §3.5, §4, §5.1, §5.4), the project-map, ipc-contract and risk-register skills, and `CHANGELOG.md`.

### 11. Plan §2 drafts

- **#85 What git is doing is read in one place** (from #1305–#1310; this design, option A).
  - `gitio::Repo::stop()` → `Stop { operation, head }`, with `Operation` as in Q1.

  - Precedence as git's `wt_status_get_state`, plus squash merge (`SQUASH_MSG`, no `MERGE_HEAD`). Read through `rev-parse --verify` and `--git-path`, never a `.git/` path.
  - Progress: `msgnum`/`end`, `next`/`last`, sequencer done+todo, git's own step count.
  - The stop's identity is `Stop` equality.
  - Re-read at open, at every list, and before Continue and Abort.
  - **Rejected:**
    - `git status --porcelain=v2` (no progress, no ids);
    - reading ref files directly (reftable);
    - a `done` file for cherry-pick and revert (it does not exist);
    - counting commits for rebase progress (git counts commands);
    - names inside gitio (UTF-8 is session's job).
  - Visions 2, 4, 3.
- **#86 Own work is on the left, decided once per stop.**
  - `Orientation` from `Stop`: theirs on the left only for a rebase replaying a commit.
  - gitio `Stage::{Base, Ours, Theirs}` and session's `GitSide` keep git's sides apart from the panes' `Side`.
  - Pane order from open on; git order only in the start check, in locating disk blocks and in Save's markers (`Waiting::Markers.first`).
  - Disk, index and Reset stay git's.
  - **Rejected:**
    - mirroring finished DTOs at the edge (option B: the same line types mean two things inside session);
    - swapping in the window (option C: the fact in two languages; exit status and stderr do not know it).
  - Visions 4, 2, 1.
- **#87 The operation at the top.** `OperationBar` in the right column's first row, words as in Q4, `bg-info` tokens, re-read with every list, none for unrecorded operations.
  - **Rejected:** the OS title only; inside the file list (Ctrl+B hides it); the toolbar (once per file view, missing when no file is shown).
  - Visions 1, 2.
- **#88 Abort for every recorded operation** (amends #74). Q5's table; id `abortMerge` kept; question and stderr per operation; `Merge::Aborted(OperationKind)`; async, no deadline, not cancellable; the button also in the header rows of choice, deleted-side and stop views.
  - **Rejected:** `merge --abort` for a squash merge (git refuses); renaming the id (loses stored decisions); keeping the 30 s timeout (a SIGKILL mid-reset leaves `index.lock`).
  - Visions 2, 4, 5.
- **#89 Continue, and a new stop is a new session.**
  - Q6's commands with `GIT_EDITOR=:`; the outcome comes from re-reading `Stop`.
  - `Merge` gets `Running`/`MovedOn`/`Finished`; the first list after a move opens the next stop; writes in between answer `StopMovedOn`.
  - The window's `nextStop` clears per-stop state (servers keep running); a move is checked before settling and gets its notice.
  - Finished → exit 0 "yamt: rebase finished".
  - **Rejected:**
    - a page reload per stop (option B: language servers restart each stop, and the notice has to survive the reload);
    - swapping the session inside `list_files` in one step (a stale Save lands on the next stop);
    - `--no-edit` (keeps `# Conflicts`, and `rebase --continue` takes no such flag);
    - the user's editor (hangs without a terminal).
  - Visions 2, 4, 1.
- **#90 A remembered resolution is reviewed** (amends #52/#53).
  - Detected through `MERGE_RR` as in Q7, as `AtOpen::Remembered`/`Seen::ViewRemembered`; never settled at start.
  - View (b); `FileStatus::Remembered`.
  - **Rejected:** `rerere remaining`/`status` (cannot tell); view (a); view (c).
  - Visions 1, 2, 4.
- **Amendments:**
  - **#41:** commands `continue_operation`, `abort_operation`, `list_files → Listing`; exit 0 after Finished with "yamt: <op> finished".
  - **#50/#62:** names per operation (Q3) and per stop; `SideNames` travels in `Listing`; `side_names` removed.
  - **#52/#53:** the rerere exception; a moved-on stop never settles its files.
  - **#74:** every operation; labels; buttons in the non-editable header rows; `merging` → `operation`.

## Option B: mirror at the edge, reload the page per stop

- **Data:** session stays entirely in git's order. A private `GitOrdered<T>` wraps `FileMergeData`, `FileSides`, `FileEntry` and `SideNames`. Only `orient(GitOrdered<T>, Orientation) -> T` unwraps it, and it mirrors texts, typed ranges, words, chunk kinds, `deleted` and `unsupported`. `take` maps the side on entry.
- **Window:** after `Stopped` or `MovedOn` it calls `location.reload()`, and `stops.ts` disappears.
- **Gains:** about 250 fewer session lines; no window clear-out code.
- **Costs:**
  - merge-core gains `Chunk::mirrored` and `WordChanges::mirrored`;
  - inside session, `LocalLine` means stage 2 while in the DTO it means the left pane;
  - every language server restarts at each stop, which matters for rust-analyzer;
  - the dropped-edits notice needs `sessionStorage` to survive the reload;
  - the window flashes.
- **Builds:** R1 shrinks; W2 loses `stops.ts`.

## Option C: the window turns the panes

- **Data:** Rust adds `orientation` to `Listing`; `ipc/domain.ts` swaps the panes in `toDomain`, and `tauri.ts` maps the side for `takeSide`.
- **Gains:** almost no change to session.
- **Costs:**
  - the fact lives in two languages (vision 2);
  - Rust's names, exit status and the cli fixtures stay unaware;
  - every new DTO must remember to swap;
  - Save's marker order is decided in the window.

## Recommendation: option A

It meets rules 1–6. A pane/git mix-up does not compile, and nothing written to disk leaves git's order. Its costs:
- the most session files touched, with typed ranges built in two steps in `locate.rs`;
- five `Merge` states;
- three new `IpcError` kinds, which the frontend must handle exhaustively;
- `store.ts` ends at about 296 of 300 lines.

## Deviations from the brief and request

1. **The git experiments were not run** (no shell). Sources are cited instead; R1–R3's integration tests are the experiments.
2. **Continue and Abort also appear in the header rows of choice, deleted-side and empty-stop views** (`OperationButtons.vue`, `StopView.vue`). Without this, a stop whose only conflict is a binary file, or a stop with no conflicts, cannot be continued. #74 said choice views have no Abort.
3. **IPC changes beyond pure additions** (IPC9): `list_files` returns `Listing`; `side_names` and `abort_merge` are removed or renamed; four `IpcError` kinds are added.
4. **Abort runs without its 30 s timeout and off the main thread.**

## Open risks

- **No experiment ran;** a source reading could be wrong for git 2.32–2.56 behaviour I did not trace.
- **Squash merge with `merge.autoStash`:** Abort sends the autostash to the stash list.
- **A stale `SQUASH_MSG`** labels a later stash pop as a squash merge, and its Abort runs `reset --merge`.
- **HEAD moved since the stop:** `am --abort` and `cherry-pick --abort` do not rewind but exit 0.
- **Cherry-pick/revert progress** undercounts after an earlier skip.
- **A stale-write guard** relies on Tauri handling commands from one window in order [INFERENCE].
- **A file rerere could not track** (for example malformed markers) and that was fixed by hand before yamt started opens as "remembered": reviewed rather than staged, the safe direction.
- **A rebase `exec` or a slow hook** keeps the window in "Continuing…", and closing is refused until git ends.

## Open questions for the product owner

1. **Reword steps:** Continue runs the rest of an interactive rebase without an editor, so a later `reword` step keeps its old message. Accept, or should yamt refuse Continue when a `reword` is still ahead?
2. **Remembered files:** Mark resolved on a file git rerere filled in asks "1 unresolved conflict still remains" unless the user first ignores both sides of each conflict. Accept this, or count rerere's choices as decided (a larger editor change)?
3. **Revert wording:** "revert of 9b8e7d6 Add cache" or "before 9b8e7d6 Add cache"?
4. **Clean stops at start:** started while a rebase waits at an `edit` stop with no conflicts, yamt says "nothing to merge" and exits 0 as today. Should it open with the top line and Continue instead?
5. **Step counts:** a rebase counts git's steps, including `exec` and `label` lines in `rebase -r` ("2 of 5" = git's own "Rebasing (2/5)"), not commits. Is that the count you want?