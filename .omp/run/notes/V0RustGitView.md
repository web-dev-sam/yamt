# Implementer report V0RustGitView

## deviations_from_brief
[
  "IPC type changed: `pub struct FileMergeData` gains `pub deleted: Option<Side>`, placed between `remote` and `eol` (TS `deleted: Side | null`). `merge_data(path, base, local, remote)` keeps its signature and returns `deleted: None`; `MergeSession::load` overrides it from the stored texts.",
  "IPC command changed: `fn list_files(state: State<'_, SessionState>) -> Result<Vec<FileEntry>, IpcError>` (was `-> Vec<FileEntry>`). The generated `commands.listFiles` will become a typedError result, so `ipc/tauri.ts` and `ChunkSource.listFiles` need to follow.",
  "IPC command added: `fn remote_name(state: State<'_, SessionState>) -> Option<RemoteName>`, registered in `specta_builder` after `take_side`.",
  "IPC type added: `#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)] #[serde(tag = \"kind\")] pub enum RemoteName { Branch { name: String }, Commit { short_id: String, subject: String, message: String } }` in `yamt_session` (crates/session/src/remote_name.rs).",
  "New session API: `pub fn refresh_statuses(&mut self) -> Result<()>` and `#[must_use] pub fn remote_name(&self) -> Option<RemoteName>`. `outcome::ending_on_close` now takes `&mut MergeSession`.",
  "New gitio methods: `pub fn commit_named(&self, name: &str) -> Result<Option<Oid>>` (`rev-parse --verify --quiet <name>^{commit}`; a silent exit 1 means None). `pub fn branches_at(&self, commit: &Oid) -> Result<Vec<Vec<u8>>>` (`for-each-ref --format=%(if)%(symref)%(then)%(else)%(refname:short)%(end) --points-at <oid> refs/heads refs/remotes`; symbolic refs print empty lines and are skipped). `pub fn merge_message(&self) -> Result<Option<Vec<u8>>>` (`rev-parse --git-path MERGE_MSG`, then read; missing gives None). `pub fn commit_summary(&self, commit: &Oid) -> Result<CommitSummary>` (`log -1 --no-show-signature --format=%h%x00%s%x00%B <oid> --`). New `pub struct CommitSummary { short_id, subject, message: Vec<u8> }`. Per RS14 gitio returns bytes; session decodes them lossily for display.",
  "For files with no stage 2 and no stage 3 (only possible in rename conflicts), the reason is still LocalDeleted, as before.",
  "A deleted file whose decode fails reports LocalDeleted/RemoteDeleted (named by the deleted side) instead of the decode reason (Binary/NonUtf8/TooLarge). This keeps them \"exactly as today\". Symlink and submodule are checked first and keep their own reasons.",
  "Moved `CapturedStages` and `group_by_path` unchanged from `session.rs` into the new `crates/session/src/stages.rs` (fields now `pub(crate)`) to keep `session.rs` under 400 lines (RS6).",
  "Added `yamt_conflict_repo::diverged_repo(files)` (the three committed branches, not merged); `conflict_repo` now calls it and then merges.",
  "No case found where git's view and the session's statuses disagreed after the app's own finish/take/reset. Disagreement comes only from changes made outside the app, and `refresh_statuses` now adopts git's view in those cases.",
  "For the orchestrator, outside my Owned globs: `skill://risk-register` RK3 still says delete/modify is `UnsupportedReason::{LocalDeleted, RemoteDeleted}` and needs rewording to: text loads with `deleted`, a non-text kept side stays unsupported, proven by `session/tests/deleted_side.rs`. The architecture doc and ipc-contract need `remote_name`, the `list_files` Result, and `FileMergeData.deleted` (PM6)."
]

## open_risks
[
  {
    "location": "frontend/src/ipc/fixture.ts:80-88",
    "risk": "After `just bindings`, `FILE_MERGE_DATA ... satisfies SchemaOf<Generated.FileMergeData>` will fail typecheck until the valibot schema gains `deleted`. Runtime parsing of the regenerated fixtures works (`v.object` strips unknown keys). `listFiles` becoming a Result also breaks `ipc/tauri.ts` and `ChunkSource.listFiles` until the frontend slice adapts."
  },
  {
    "location": "crates/session/src/session.rs:315-345 (read_content)",
    "risk": "`docs/removed.md` and similar files now have `unsupported: null`. With the current frontend they open in the normal three-pane editor rather than the choice view, until the window's read-only mode for the deleted side (plan §2 #47) lands."
  },
  {
    "location": "crates/session/tests/remote_name.rs:118-127",
    "risk": "`an_unreadable_merge_message_drops_the_name` uses chmod 000 on MERGE_MSG. If the tests run as root the file stays readable and the test fails (here uid 1000)."
  },
  {
    "location": "crates/gitio/src/repo.rs:56-66 (commit_named)",
    "risk": "\"Head missing\" is detected as `GitFailed { status: Some(1), stderr: \"\" }` (observed on git 2.56). Because of `--quiet`, a malformed revision also exits 1 silently and would read as None. The revisions are fixed names, so this only matters if a future caller passes user input."
  },
  {
    "location": "crates/session/src/session.rs:127-138 (refresh_statuses)",
    "risk": "For each session file it scans the whole `ls-files -u` list, so cost is O(files × entries). That is fine for merges of tens or hundreds of files; it was not measured on very large conflicts."
  }
]
