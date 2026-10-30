---
name: ipc-contract
description: How the Rust↔frontend contract of yamt is defined, generated, changed and consumed — tauri-specta bindings, domain brands, error enum, logging channel, ChunkSource. Read before touching any type that crosses the IPC.
---

# IPC contract

One source of truth: the Rust types in `merge-core`, `session` and `src-tauri` annotated with
`#[derive(serde::Serialize, specta::Type)]`. `frontend/src/ipc/bindings.ts` is generated
from them and committed.

## Changing the contract

1. Edit the Rust type/command.
2. `just bindings` (runs `cargo run -p yamt-app --features bindings --bin export-bindings`).
3. Update `ipc/domain.ts` (`toDomain`) if a DTO shape changed — `ipc/words.ts` (`toSideWords`) for `SideWordChanges`.
4. Commit Rust + `bindings.ts` + `domain.ts` (and `words.ts`) together.

- [IPC1] `bindings.ts` is never hand-edited. Detector: hook `generated.ts`; `just bindings-check`
  diffs a fresh export against the committed file.
- [IPC2] Nothing outside `ipc/` imports `bindings.ts` or sees a DTO; consumers get domain
  types from `ipc/index.ts`. Detector: oxlint `no-restricted-imports`.
- [IPC3] Rust newtypes (`MiddleLine`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion`) arrive as `number`;
  `ipc/domain.ts` is the only place that applies the TS brands, by type guard (`n is MiddleLine`), never `as` (TS4).
- [IPC4] Errors cross as one `#[serde(tag = "kind")] enum IpcError` with structured fields
  (plan §2 #41: `Git`, `UnknownPath`, `Unsupported { path, reason }`, `WriteFailed`; #53:
  `NotAFile { path }`, `ReadFailed { path, message }`; #57: `SettingsBroken { path, message }`,
  `NotAbsolute { path }`, `NoConfigFolder`; #74: `MergeAborted`; #88/#89: `StopMovedOn`, `GitRunning`,
  `MergeFinished`, `NoOperation`; #93–#97, the compare window: `UnknownTab { tab }`, `ColumnTooLarge { limit }`,
  `WorkerStopped`; #116–#121, the range window's threads: `UnknownThread { thread }`, `UnknownMessage { message }`,
  `EmptyMessage`, `MessagePending { message }`, `SendRunning`; #108–#110, the AI: `AiOff`, `RemoveFailed { folder,
  message }`); never a string. The frontend `switch`es on
  `kind` exhaustively. A disk change is a reply (`WriteReply::ChangedOnDisk`, `Listing::Files.disk_changes`), never an error.
  GitLab, git and launch problems of the merge-request page are replies too (`ListEnd`, `OpenReply`, `PageOpened`, plan §2 #129).
- [IPC5] Commands are thin (≤ 15 lines): lock the `Mutex<Merge>` (`src-tauri/src/merge.rs`), call one `session`
  method (or one `merge.rs` function: `list_stop`, and the async `continue_operation`/`abort_operation` that run git
  on its worker), map the error — or, for settings, compute `Places` and call one `yamt_settings`
  function. No logic in `src-tauri`'s commands.
- [IPC6] Strings are UTF-8 text already validated by `session`; binary/non-UTF-8 never
  reaches the webview (`FileEntry.unsupported` carries the reason instead).

## Commands (v0)

```
list_stop()                       -> Listing   Files{files, disk_changes, operation, sides, merge_request} | MovedOn: re-reads the stop first (another → MovedOn, nothing settled); else settles disk changes, re-reads `git ls-files -u` (marks are git's view, #49/#53), `operation` = what git is doing now (OperationView, #85/#87), `sides` = both panes' names as read at open (SideNames, each Branch{name} | Commit{short_id, subject, message} | Revert{short_id, subject, message} | Patch{subject, message} or null, #87), `merge_request` = the live record of a merge yamt started here (MergeView { branch, target, returnTo, branchBefore } | null, read fresh by `find_live`, #140); in MovedOn it opens the next stop first (#89)
load_file(path)                   -> FileMergeData   `middle: Stages{text} | Disk{text} | DiskNotText{found}`, chunks with their middle range, words and `waiting` (SideLines | Markers{open, first, between, close} | AsShown | Remembered: what Save writes while a side waits, #69/#86/#90), `disk_version`; `deleted: Side | null` (#47)
finish_file(path, text, disk_version)   -> WriteReply   Written{files} | ChangedOnDisk{files, change} (old version or unseen disk change: nothing written, #53)
save_file(path, text, disk_version)     -> WriteReply   finish_file without `git add`: the file stays conflicted; the own write updates `seen` only, never a DiskChange, the disk version stays (#65/#69)
reset_file(path, disk_version)    -> WriteReply   back to this run's start: captured stages + the bytes found at open (#66/#69)
describe_file(path)               -> FileSides   what each side holds (Missing/Text/Binary/NonUtf8/TooLarge/Link/Commit), `disk_version`
take_side(path, side: Side, disk_version) -> WriteReply   resolve with one side (deleted side = git rm), plan §2 #36
continue_operation()              -> ContinueReply   Finished | ReadyToPush{branch} | Stopped{message}: git's own continue on a worker, no deadline, GIT_EDITOR=:; refused → Git{message}, the session stays; Finished → the window is destroyed, exit 0 `<operation> finished`; ReadyToPush → a merge yamt started is committed, its record gone, state Committed (not ended: the window asks to push, #141); Stopped → the next list opens the new stop (#89)
abort_operation()                 -> AbortReply   { leftovers: Leftover[] }: git's own abort for the operation (squash merge: reset --merge) on a worker, then a merge yamt started put back as its record says (#140); refused → Git{message}, the session stays; done → every merge command answers MergeAborted; no leftovers → the window is destroyed (no close question), exit 1 `<operation> aborted` (#88); leftovers (notReturned | returnRefused | branchKept | branchCheckedOut | branchRefused) → the window stays to list them
push_merged_branch()              -> PushReply   pushed | failed { message }: Committed only (else NoOperation); `git push` of the branch to the remote it came from on a worker, never forced, no prompt, 120 s; pushed → Finished, the window is destroyed, exit 0; failed → Committed stays (#141)
close_ended_merge()               -> ()          Keep Local and the leftovers' Close: Committed → Finished; destroys the window when ended, else nothing (#140, #141)
log(entry: LogEntry)              -> ()          fire-and-forget; frontend never awaits it
load_settings(current: StoredSettings)          -> SettingsRead   the file in use, created from `current` when missing, never rewritten by a read, #57
set_theme(current, theme: Theme)                -> SettingsRead   re-reads, replaces `theme`, writes; each settings command recolours the native window
set_antialiasing(current, antialiasing: Antialiasing) -> SettingsRead   re-reads, replaces `antialiasing`, writes; applied by the shell at the next start (Linux), #60
set_keys(current, changes: Vec<KeysChange>)     -> SettingsRead   re-reads, sets (`Some`) or removes (`None`) each action's entry, writes
move_settings(current, path)                   -> SettingsRead   absolute or `~/`; an existing file is used, a missing one created from `current`
set_server_answer(current, answer: RepositoryAnswer | null) -> SettingsRead   keyed by the host's repository root (`servers_context().root`); null forgets it, #67/#70
set_server_switch(current, server: String, on: bool)        -> SettingsRead   the same root; `on: false` adds the server's key to `off[root]`, `true` removes it, an emptied root goes; keys opaque to Rust, #83
set_added_servers(current, added: Vec<AddedServer>)         -> SettingsRead   replaces the servers added by hand (`{ command, fileTypes }`)
servers_context()                 -> ServerContext { root: Option<String>, process_id }   language servers (crate yamt-lsp-host, #70): root None when not UTF-8
start_server(command: ServerCommand, events: Channel<HostEvent>) -> StartReply   Started{run} | NotFound{program, searched} | SpawnFailed | OutsideRepository; events Message{text} | Log{line} | Exited{code}, Exited once and last
send_to_server(run: RunId, message) -> ()   queues one JSON-RPC body; framing is Rust's; never blocks
stop_server(run: RunId)           -> ()   signals; killed after 2 s; Exited follows on the channel
find_program(program, project, folders) -> ProgramFound   Found{path, place: Project | Path | Home} | NotFound{searched}: folders.project up to the root, then PATH, then folders.home
project_files(paths: Vec<String>) -> Vec<ProjectFile>   Missing | Folder | Text{text} (≤ 64 KiB) | TooLarge | NotText; repo-relative, outside the repository = Missing
# the compare window (`yamt --diff`, plan §2 #93–#97; state Mutex<TabStore>, crate yamt-compare)
open_compare()                    -> CompareStart { list: TabList { tabs, shown }, column_limit }
load_tab(tab: TabId)              -> TabTexts { left, right, comparison }   async: the store locked only to read, the diff on a worker after
set_column(tab, column, text, version) -> Comparison { versions, differences }   async: stores one column (a version not above the stored one stores nothing), then diffs it against the other
add_tab() / close_tab(tab) / rename_tab(tab, name) / set_tab_language(tab, language) / show_tab(tab) -> TabList
# both windows (plan §2 #99): the one way the window reads the clipboard, on Linux only
read_clipboard(selection: ClipboardSelection)    -> Option<String>   async: GTK's text request on the main thread, awaited off it; None = unreadable or no text (paste nothing); never asks for the format list (WebKitGTK 2.54 crashes on a failed one); other systems None
# settings, every window (plan §2 #113)
set_agent(current, agent: AgentSettings { command, firstMessage })   -> SettingsRead   null = the window's default; an empty command stored as null
# the range window (`yamt --diff=<a>..<b>`, plan §2 #103–#107; RangeState: the range, its PairLock, Mutex<ThreadStore>, the send guard)
open_range()                      -> RangeStart { range, sides, entries }
load_range_file(file: RangeFileId) -> RangeFile   async: both texts, MAX_TEXT_BYTES each
search_range_texts(from: RangeFileId) -> SearchTexts   async: { files: [SearchText { file, left, right, changes: LineChange[] }], next } — the text files from `from` on, pages of ~4 MiB, next null after the last; files `load` would not answer as texts left out (#127)
# its threads and GitLab (plan §2 #116–#121, crate yamt-review)
list_threads() -> ThreadList; add_thread(file, line: ThreadLine, text) -> ThreadAdded; add_note(thread, text) / queue_message(message, text) / unqueue_message(message) -> ThreadList
edit_note(message, text) / delete_message(message) -> ThreadList   an unsent Note only (#123): AiAnswer → NotANote, Pending → MessagePending; SendRunning while a send runs
set_thread_session(thread, session) / add_ai_answer(thread, session) -> ThreadList   the store numbers the AI's turns per session (#121)
check_gitlab()                    -> GitLabCheck   LinedUp { merge_request } | NotLinedUp { why } (#119)
send_queue(progress: Channel<SendProgress>) -> SendReply   async: Sent { sent, refused, list } | Stopped { reason, … } | NotLinedUp; a second send while one runs → SendRunning
# the AI (`--ai` only, plan §2 #108–#115, crate yamt-agent; Mutex<AiState>, AiState::workspace() the one AiOff mapping)
prepare_checkout() -> CheckoutReply; start_agent(command, events: Channel<HostEvent>) -> AgentStartReply (async); send_to_agent(run, message); stop_agent(run)
checkout_changes() -> CheckoutLook; discard_checkout() (async; RemoveFailed); diff_texts(old, next) -> Difference[] (merge_core::compare on a worker, #114)
# the merge-request page (compare and range windows, plan §2 #128–#143, crates yamt-merge-requests and yamt-local-merge; MergeRequestState: the GitLab project found at start, the pairs' folder, pages: Mutex<BTreeSet<WebPage>>; registered for every window, managed only for those two)
find_gitlab_project()             -> GitLabProject   none | found { repository }: decided once at start, offline, by a remote's host (#130); repository = the absolute common git dir, the filters' key
list_merge_requests(messages: Channel<ListMessage>) -> ()   async: ListMessage = Page { page: MergeRequestPage { me, rows } } | End { end: ListEnd } (tagged `kind`, camelCase): every page, then exactly one End, on the channel; a load ends on its End (or the command's IpcError), never on the command's answer (tauri delivers a message of 8 KiB or more by a later fetch); ListEnd = loaded | cut { limit: 500 } | glabMissing | notLoggedIn { detail } | failed { message } (pages sent stay); each row's `page` (WebPage | null, null off https) and each failed job's page are recorded before the page is sent (#131, #137); each row carries `size` (ChangeSize { additions, deletions, files } | null), `readiness` (ready | conflicts { also: BlockedReason[] } | needsRebase | checking | blocked { reason }) and `fromFork` (#138)
open_merge_request(iid: MergeRequestIid) -> OpenReply   async: opened (a second yamt `--diff=<base>..<head> --repo <root>` started) | alreadyOpen | preparing | notOpen | noRemote { project } | fetchFailed { message } | missingCommit { short_id } | startFailed { message } | glabMissing | notLoggedIn { detail } | failed { message } (#132)
open_page(page: WebPage)          -> PageOpened   opened | notOffered (a page no list of this window sent) | failed { message }: a merge request's or a failed job's GitLab page by the system opener (xdg-open / open / rundll32), never a page the window built (#133, #137)
resolve_merge_request(iid: MergeRequestIid) -> ResolveReply   async: started { started: Started { branch, target, conflicts } } | windowFailed { started, message } (the merge and its record stay) | refused { refusal: Refusal = alreadyMerging { iid | null } | busy | uncommittedChanges | fetchFailed { message } | localAhead { branch } | alreadyContains { branch, target } | gitRefused { message, left } | recordUnreadable { path, message } } | gitLabRefused { refusal: ResolveRefusal = notOpen | fromFork | noRemote { project } | glabMissing | notLoggedIn { detail } | failed { message } }: `prepare_resolve`, then the merge in this checkout, then `yamt --repo <root>`; started answers once the new window holds its claim (`window_is_open` every 50 ms, at most 5 s; a time-out logs a warning, the reply stays) (#139)
continue_merge_request(iid: MergeRequestIid) -> ContinueMergeReply   async: opened { branch, target } | alreadyOpen | ended | windowFailed { message }: the unfinished merge's window started again while its record is live and no window holds the claim; opened answers once the new window holds it (the same ≤ 5 s wait); nothing in git changes; no project → ended (#143)
find_local_merge()                -> LocalMerge   async: free | merging { iid, windowOpen }: a live record in this window's repository, and whether another process holds its window claim; no project or a read problem → free (#143)
```

Plan §2 #37/#41. No `quit_if_done`: after the last file the app stays open, and closing the window
exits 0 only when every file is resolved. The generated `commands` (`just bindings-check`) are the
authority. `SideContent.bytes` is `u64` exported as `number` (`#[specta(type = u32)]`).

## Frontend side

- [IPC7] `ChunkSource` (`ipc/ChunkSource.ts`; list/load/finish/save/reset/describe/take return `SourceResult`, failure =
  the generated `IpcError`) is the interface the app talks to. Two implementations: `createTauriSource`
  (`ipc/tauri.ts`, maps the generated `commands`; `forwardLog` stringifies non-finite numbers) and
  the fixture source (`ipc/fixture.ts`, valibot over `fixtures/{golden,showcase}/*.json`, the only
  runtime parse, decision 19). `import.meta.env.VITE_CHUNK_SOURCE === "tauri"` (set by the app's
  dev/build commands) is read only in `main.ts` (source) and `ipc/index.ts` (log forward). The compare window has its
  own interface, `CompareSource` (`ipc/CompareSource.ts`, extends `SettingsSource, MergeRequestSource`): `createTauriCompareSource`
  (`ipc/tauriCompare.ts`) and `createFixtureCompareSource` (`ipc/fixtureCompare.ts`, `?diff=<case>`). The range window's
  is `RangeSource` (`ipc/RangeSource.ts`, extends `SettingsSource, ReviewSource, MergeRequestSource`: `openRange`, `loadRangeFile`;
  `ReviewSource.ts` the threads and GitLab with `reviewDomain.ts`): `createTauriRangeSource` / `createFixtureRangeSource`
  (`?range=<case>`, `?threads=seeded`, `?gitlab=<script>`). `MergeRequestSource` (`ipc/MergeRequestSource.ts`:
  `findGitLabProject`, `listMergeRequests(onPage)` — every page reaches `onPage` before the promise settles, none after —,
  `openMergeRequest`, `openPage`, `resolveMergeRequest`, `continueMergeRequest`, `findLocalMerge`; shapes in `mergeRequestDomain.ts`, brands `MergeRequestIid`/`WebPage` in `domain.ts`)
  is spread into both: `createTauriMergeRequests` (`ipc/tauriMergeRequests.ts`, one `Channel<ListMessage>` per load) and
  `createFixtureMergeRequests` (`ipc/fixtureMergeRequests.ts`, `?mr=<script>`). `AgentSource` (`ipc/AgentSource.ts` + `agentDomain.ts`, the
  seven agent commands) is built only in `main.ts` with AI on (`createTauriAgentSource` / `createFixtureAgentSource`,
  `?ai[=<case>]`). Every Tauri source returns through `tauri.ts` `converted`; every brand through `validate.ts`
  `branded`. The merge window's aliases of a merge yamt started (`MergeView`, `ReturnTo`, `Leftover`, `AbortReply`,
  `PushReply`) live in `ipc/localMergeDomain.ts`; `ChunkSource` has `pushMergedBranch` and `closeEndedMerge` too, and
  `abortOperation` answers `AbortReply` (plan §2 #140, #141).
- [IPC8] `ipc/log.ts` exports `createLog(forward?: (entry: LogEntry) => Promise<unknown> | void)`;
  the logger's `debug/info/warn/error(event, fields)` print a structured console line always and
  call `forward` if given (`debug` only in DEV). The one app logger is created by its first consumer,
  the `ipc/` interface slice (Tauri: `commands.log`). Never throws or blocks, even on a rejected forward. Detector: `log.test.ts`.
- [IPC9] A new command is a decision-record-free change only if it is a pure addition and its
  DTOs are existing types; otherwise report in `deviations_from_brief`.
