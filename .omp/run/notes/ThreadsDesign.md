# Design 3.RV-B: threads in the range window and posting them to GitLab

I recommend **option A**. Each thread box is a CodeMirror block row in both columns. The editor keeps one host element per thread, and Vue teleports the box into it. The threads are stored in A's crate `yamt-range`, in `threads.json` in A's pair folder. Posting goes through `glab api` to GitLab's draft-notes route, naming the three commits. `yamt-gitio` runs glab with a deadline, as it runs git.

What it costs is under **Recommendation**. In short: A's crate takes on a second job, three of A's contracts change, two Mutexes are added, and the work is about 95 files and 9,000 changed lines in 9 builds.

**What was checked:**
- **CodeMirror 6.43.14** (`node_modules/@codemirror/view/dist/index.js`):
  - A widget ignores every event by default (`ignoreEvent() { return true }`, :161).
  - The editor's key and selection handling skip such widgets (:4903, :7276).
  - CodeMirror sets `contentEditable="false"` on a widget's DOM (:2183).
  - It observes only `scrollDOM` for resizes (:7208), so a growing widget must call `requestMeasure` itself.
  - It re-measures heights when the content's height changes (:6363).
  - `lineNumbers()` merges `domEventHandlers` across configs (:11806–11866).
  - A `lineNumberMarkers` marker with `toDOM` replaces the number (:11836).
- **GitLab docs 19.6:**
  - Draft notes API: `POST …/draft_notes` with `position[base_sha|start_sha|head_sha|old_path|new_path|old_line|new_line]`, plus `GET …/draft_notes`.
  - Discussions API: an added line needs `new_line` only, a removed line `old_line` only, an unchanged line both (lines 1166–1171).
  - `glab api`: `--input -`, `--paginate`, `--method`, the `:fullpath` placeholder; fields become query parameters on a GET.
  - `glab auth status`: `--hostname`.
- Plan §2 already has C's rows #108–#115. #112 and #115 say links stay text, so B's links do too. B's rows start at #116.
- A's files do not exist in this tree yet. I designed against A's recorded contract (`RangeDesign.md` §3–§12, rows #103–#107).

---

## Common answers (the same in every option unless an option says otherwise)

### 1. Where a thread is anchored

**One sum type** — Rust in `yamt-range`, generated into TypeScript, branded in the window through the existing `LeftLine`/`RightLine`:

```rust
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ThreadLine {
    Removed { left: LeftLine },                            // a left line inside a difference: GitLab old_line only
    Added { right: RightLine },                            // a right line inside a difference: GitLab new_line only
    UnchangedOnLeft { left: LeftLine, right: RightLine },  // an unchanged line, box in the left column: both lines
    UnchangedOnRight { left: LeftLine, right: RightLine }, // the same line, box in the right column
}
```

- The column that shows the box is decided by the variant. There is no `Column` field and no flag, so "removed, shown on the right" cannot be built.
- Lines are 0-based, as A's columns are. One function adds 1 when the GitLab position is built (`position.rs`).

**The file:**
- On the wire: `file: RangeFileId`.
- In storage: the entry's path, because a stored file id could point at another file if the list changes between runs (rename detection follows `diff.renameLimit`).
- Paths for GitLab come from A's `RangeEntry`:

  | entry | `old_path` | `new_path` |
  |---|---|---|
  | renamed | `old_path` | `path` |
  | added | `path` | `path` |
  | deleted | `path` | `path` (GitLab needs both) |

- A path that is not UTF-8 (shown lossily by A) is refused when posting, with the reason "the path is not UTF-8"; the thread itself works.

**From a click to the anchor:**
- The editor owns the rule, because the same rule also places the gap in the other column (vision 2).
- `editor/internal/threadAnchor.ts`, pure: `anchorAt(differences, column, line) → ThreadLine`.
  - Walk the reply's `Difference`s in order.
  - A line inside `difference[column]` gives `Removed` (left) or `Added` (right).
  - A line before the next difference is unchanged. Its partner line is `line ± Σ(right.len − left.len)` over the differences above it, giving `UnchangedOn<column>`.
- The press comes from the line-number gutter's `mousedown` (point 2). The editor reports `startThread(line: ThreadLine)`.
- Rust stores what it is given (decision 19: trusted IPC from our own window).

### 2. Thread boxes inside the columns

These are the parts every option shares.

**Rows:**
- A row is one aligned place: how many lines sit above it in each column, `Readonly<Record<Column, number>>`.
  - A box below line L sits at L+1.
  - The gap for a removed line goes after the end of its difference on the right. For a pure deletion, that is the insertion point.
  - Added lines mirror this.
  - The gap for an unchanged line sits after its partner line.
- Threads with the same place share a row. So two threads on one unchanged line, one shown in each column, sit side by side, as in GitLab's parallel view.
- In each column, a row's cell holds the boxes shown there, in creation order. The other cell is empty.
- Both cells take the row's height: the larger of the two columns' summed box heights. Code after the row therefore stays aligned, and inside a difference both spans grow by the same amount.

**Collapsed threads:**
- A collapsed thread has no row.
- Its line number carries a count mark: open and collapsed threads shown on that line in that column.
- Pressing the mark opens or collapses those threads. The box header also has a collapse button.

**The hover comment button:**
- On a number of either column, CSS `:hover` on the number cell shows a comment icon in the cell's reserved left padding. The icon is a mask in `editor/theme.css`, coloured with `--color-fg-muted`, so there is no colour literal (VU17).
- A press on the number (merged `lineNumbers({ domEventHandlers: { mousedown } })`) starts a thread.
- A press on the count badge toggles that line's threads.
- The badge is a `lineNumberMarkers` marker that draws the number plus a badge positioned in the left padding, so the gutter's width never changes.

**Keys:**
- CodeMirror's keymaps, find keys and selection never see events inside a widget, because widgets ignore them by default.
- In the box, Ctrl/Cmd+Enter submits and Escape cancels. Both call `preventDefault` and `stopPropagation`.
- The window-level `shownKeydown` (A's `RangeView`, through `PaneFrame`) returns early when `isTypingTarget(event.target)` (`ui/rangeKeys.ts`, pure). The change-arrow keys therefore never move the code while you type.
- Ctrl/Cmd+B still toggles the list from a text box, as #61 says for find boxes.
- Pasting goes through `takeLinuxPastes` ("a field nobody handles gets `insertText`", #99).

**One source of truth (vision 2):**
- Rust's `ThreadStore` holds which threads exist and what they say.
- The range store mirrors its replies.
- The window holds which threads are open and the text not yet added.
- The editor shows only what `showThreads` gives it. Vue never holds an `EditorView`.

**The thread-to-AI seam (C):**
- A message's body is `note { text }` or `aiAnswer { turn }`. A thread record carries `session: string | null`. Both are in format 1 now, so C needs no format change.
- B creates only `note`.
- B shows an `aiAnswer` as one line, "An AI answer — start yamt with --ai to see it". Its Post stays disabled, because it has no text without C.
- C replaces that branch of `RangeThreadBox.vue`'s exhaustive `switch` with `<AiTurn :turn :end>`. It queues `TurnView.answer` through B's unchanged `queueMessage(message, text)`.
- B computes `RELATIVE_FILE_PATH_WITH_LINE` with `threadPlaceText(entry, line)` (`ui/rangeThreadText.ts`), which the box header already uses: `src/board.ts:12`, or the old path and old line for a removed line.

**Open or collapsed when the range opens again: collapsed.**
- The line marks and the per-file counts show where every thread is. Opening one is a deliberate act.
- With `--ai` that act loads that thread's conversation (#115), which first makes the AI's checkout. That takes seconds on a large repository. A window that came back with many threads open would start that at once without being asked.
- Whether a thread is open is never stored. New threads and threads with a draft open.

### 3. The thread store (Rust, beside A's lock)

**Owner:** `yamt-range`'s `ThreadStore` (option B: `yamt-review`). The file is `<PairLock::folder()>/threads.json`, held by the shell as `Mutex<ThreadStore>` in A's `RangeState`. A's pair lock already makes this its only writer.

**Format 1:**
```json
{ "format": 1, "nextThread": 4, "nextMessage": 9,
  "threads": [ { "id": 1, "path": "src/board.ts",
                 "line": { "kind": "unchangedOnRight", "left": 11, "right": 12 },
                 "session": null,
                 "messages": [ { "id": 1, "body": { "kind": "note", "text": "Why 300?" },
                                 "written": 1761300000,
                                 "posting": { "kind": "queued", "text": "Why 300 ms?" } } ] } ] }
```

**Posting:**

| kind | fields | in the send count? |
|---|---|---|
| `notQueued` | — | no |
| `queued` | `text` (the edited text) | yes |
| `refused` | `text`, `reason` (GitLab's words) | yes, it stays queued |
| `pending` | `text`, `draftNote` (GitLab's id), `mergeRequest` ("!12"), `link` | no |

**Other fields:**
- `written`: seconds since 1970, stamped by Rust. Stored as `u64`, exported as `number` as `SideContent.bytes` is.
- `ThreadId` and `MessageId` are `u32` counters that never repeat (`nextThread`, `nextMessage`, like `tabs.json`'s `nextId`). They are branded in `ipc/domain.ts` (IPC3).

**Reading:**
- At window start, in `run_range` after `PairLock::take` and before any window.
- A missing file is an empty store; nothing is written.
- Each of the following ends with exit 2 before any window and leaves the file unchanged — the line names the file:
  - unreadable → `ThreadsReadFailed`;
  - not JSON, or a repeated id, an id at or above its counter, a thread without messages, or a counter at `u32::MAX` → `ThreadsBroken` with line and column;
  - format above 1 → `ThreadsNewer`.
- This is #93's rule for `tabs.json`.

**Writing:**
- On every change: add thread, add note, queue, unqueue, and after each sent message.
- Through a temporary file and a rename (`yamt-compare`'s `write_atomically` pattern).
- A failed write changes nothing in memory and answers `WriteFailed { path, message }`.
- Threads whose path is not in this range's list are kept on every write and left out of replies; a `warn` log line names them.

**Counts per file for the list:** derived in the window from the mirrored list (`threadCounts`), shown by A's `RangeFileRow` as a muted speech-bubble count. Never stored.

### 4. "Post" and the queue

- **Post on a message** opens `RangePostEditor` in the message's place. It is a text box filled with the message's text (for C, `TurnView.answer`), with **Queue** (Ctrl/Cmd+Enter) and **Cancel** (Escape).
- **Queue** calls `queue_message(message, text)` and the posting becomes `queued { text }`. The message shows "Queued for GitLab"; a refused one shows "Refused by GitLab: <reason>".
- **The same button then reads "Unqueue"** and calls `unqueue_message(message)`, which sets `notQueued`.
- **A pending message** shows "Pending on GitLab", its link as selectable text and a Copy button. Links stay text (#112, #115); clipboard writes are free under PM8. Its Post button is disabled with the hover "Pending on GitLab".
- **One message is one new GitLab discussion**, its text sent as written (GitLab Markdown).
- **Empty or blank text** is refused in the window (the button is disabled) and in Rust (`EmptyMessage`).

### 5. "Send to GitLab (n)"

**Route: `glab api` against the draft-notes REST route with an explicit position**, not `glab mr note draft create`:
- The draft command is EXPERIMENTAL.
- It "targets the latest merge request diff version", so an MR pushed between the check and the post places the comment on whatever line that number has now, silently.
- With the API, the position names `base_sha`, `start_sha` and `head_sha` from the `diff_refs` just checked. A moved MR cannot misplace a comment; at worst GitLab refuses it, with a reason.
- The draft-notes API is documented REST (GitLab 19.6), not experimental.

**The glab calls** (working folder = the repository root):

| step | command |
|---|---|
| auth | `glab auth status` |
| MR by branch | `glab api --method GET projects/:fullpath/merge_requests -f state=opened -f source_branch=<branch>` |
| MR by commit | `glab api projects/:fullpath/repository/commits/<right id>/merge_requests` (point 6) |
| the MR's `diff_refs` | `glab api projects/<project_id>/merge_requests/<iid>` |
| existing drafts | `glab api --paginate projects/<project_id>/merge_requests/<iid>/draft_notes` |
| post | `glab api --include --method POST projects/<project_id>/merge_requests/<iid>/draft_notes --input -`, stdin `{"note": text, "position": {"position_type":"text", base/start/head, old_path, new_path, old_line?, new_line?}}` |

`<project_id>` is the MR's `project_id`: the project the MR lives in, which is not necessarily the folder's origin.

**One send, sequential:**
1. Take the send guard; while one runs, a second answers `SendRunning`.
2. Re-check that it lines up. If not, reply `NotLinedUp { why }`; nothing is sent.
3. Take a snapshot of the queued and refused messages under the threads lock, then release it.
4. List the user's existing draft notes on the MR. A queued message with exactly the same note text, paths, lines and `head_sha` as a draft is recorded as `pending` with that draft's id, without posting again. This covers a post whose answer timed out after GitLab stored it, and a crash after a post.
5. Post each remaining message in thread order, then message order:
   - an HTTP 2xx gives `pending { draftNote: body.id, link: <web_url>/diffs }`;
   - a 4xx other than 401/403/429 gives `refused { reason: body.message }`, and the send continues;
   - a timeout, glab gone, 401/403/429 or a 5xx stops the send: that message and the rest stay as they were, and the reply is `Stopped { reason }`.

   After each message the store is locked, the result written to `threads.json`, and progress sent.
6. Reply `Sent { list, sent, refused }` or `Stopped { …, reason }`.

**Why sequential:** the drafts keep thread order in GitLab's review, rate limits are respected, and a stop leaves a clean "rest still queued".

**The link** is the MR's Changes page (`web_url + "/diffs"`), where your pending comments show. **[INFERENCE]** A draft note has no URL of its own.

**Where glab runs:** `yamt-gitio` gains `glab.rs`, bytes in and out (RS14), reusing `run.rs`'s deadline runner.
- `GLAB_TIMEOUT` is 20 s per call (network).
- stdin is closed, except the JSON body on a POST.
- The environment is the user's: glab needs `HOME`/`XDG_CONFIG_HOME` and `GITLAB_TOKEN`/`GITLAB_HOST`. yamt adds `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`.
- glab is found on PATH by the same lookup gitio uses for git (`git_in` becomes `program_in(path, name)`, its second user).
- PM1's edges do not change.

**Progress:** one `Channel<SendProgress { done, of }>` per send, as language servers use. The button reads "Sending 3 of 7…".

### 6. Only when it lines up

**`check_gitlab` in Rust** answers one sum. The rule is a pure function, `lines_up(compared, found)`, over the parsed glab JSON:

```rust
pub enum GitLabCheck { LinedUp { merge_request: MergeRequestRef }, NotLinedUp { why: NotLinedUp } }
pub enum LookedAt { Branch { name: String }, Commit { short_id: String } }
pub enum NotLinedUp {
    GlabMissing,
    NotLoggedIn { detail: String },                     // glab's first output line, which names the instance
    NoMergeRequest { looked_at: LookedAt },
    Several { looked_at: LookedAt, references: Vec<String> },   // none of them lines up
    Moved { merge_request: MergeRequestRef, gitlab_head: String, shown_head: String },
    OtherBase { merge_request: MergeRequestRef, gitlab_base: String, shown_base: String },
    Preparing { merge_request: MergeRequestRef },       // diff_refs still null
    Failed { message: String },                         // timeout, unexpected JSON (names the field), glab's error
}
pub struct MergeRequestRef { pub reference: String /* "!12" */, pub title: String, pub web_url: String }
```

**Which merge request:**
- **The right side names a branch.** `git rev-parse --symbolic-full-name <right as typed>`: `refs/heads/x` gives `x`; `refs/remotes/<remote>/x` gives `x` (the remote names come from `git remote`); an empty side or `HEAD` gives the current branch. The candidates are the open MRs with `source_branch = x`.
- **A commit id or `HEAD~2` names no branch.** The candidates are the open MRs among the commit's MRs whose head `sha` is the right commit. This is a default the owner may veto (open question 3).
- For each candidate (at most 5, `MAX_MERGE_REQUESTS_CHECKED`), fetch its `diff_refs`. It lines up when `base_sha = left commit` and `head_sha = right commit`.
  - Exactly one candidate that does not line up gives `Moved` (head first) or `OtherBase`.
  - Several, none lining up, gives `Several`.
- `start_sha` is not part of the rule. The target branch moving does not change GitLab's diff (base → head); `start_sha` is only sent in the position.

**`a...b` and `a..b`:** the rule is one comparison of the two resolved commits, whichever dots were typed.
- `main...dev` lines up while the MR from `dev` is current: the left is the merge base, the same as `diff_refs.base_sha`.
- `main..dev` lines up only when `main` is exactly the merge base: `main` has not moved since `dev` branched, or `a` names the fork point. Otherwise it is `OtherBase`, and the hover suggests the three-dot form. The window tells the dots from A's `RangeSideLabel`: `mergeBase` means three dots.

**When it is checked:**
- At window start, in the background after the list shows.
- On window focus, when the last check finished 30 s or more ago (`RECHECK_PAUSE_MS`) and none is running.
- Inside every Send.
- One check at a time.

**How long:** auth, list and MR are three calls, typically 1–2 s; each is capped at 20 s, so a dead network shows `Failed` in about a minute.

**What the buttons show:**
- Before the first answer, Post and Send are disabled with the hover "Checking GitLab…".
- During a re-check, the last answer stays in force. Send re-checks anyway, so nothing flickers.
- Send is also disabled with "Nothing queued" when n = 0.
- Unqueue stays enabled whatever GitLab says. That is a deviation, below.

**Hover sentences** (`ui/rangeThreadText.ts`, one exhaustive `switch`):

| case | sentence |
|---|---|
| `GlabMissing` | "glab is not installed (not found on PATH)" |
| `NotLoggedIn` | "glab is not logged in: `<glab's line naming the instance>`" |
| `NoMergeRequest`, branch | "no open merge request from dev" |
| `NoMergeRequest`, commit | "no open merge request ends at 2b3b4b5 (the range names no branch)" |
| `Moved` | "the merge request !12 is at def1234, this window shows abc4567" |
| `OtherBase` | "the merge request !12 starts from 1a2b3c4, this window from 5d6e7f8" + with two dots " — main...dev compares from where dev branched off" |
| `Several` | "several open merge requests from dev (!12, !14); none compares 5d6e7f8 with abc4567" |
| `Preparing` | "GitLab is still preparing the changes of !12" |
| `Failed` | "glab failed: `<message>`" |
| lined up, Send | "Send the 3 queued comments to your pending review on !12" |
| lined up, Post | "Queue this message as its own comment on !12" |

### 7. IPC

**Rust types** (`yamt-range`, or `yamt-review` in option B; `#[derive(Serialize, Deserialize, Type)]`; `serde(tag = "kind", rename_all = "camelCase")` on sums, snake_case fields as in A):

```rust
pub struct ThreadId(pub u32);  pub struct MessageId(pub u32);
pub enum ThreadLine { /* point 1 */ }
pub enum MessageBody { Note { text: String }, AiAnswer { turn: u32 } }
pub enum Posting { NotQueued, Queued { text: String }, Refused { text: String, reason: String },
                   Pending { text: String, draft_note: u64 /* specta number */, merge_request: String, link: String } }
pub struct Message { pub id: MessageId, pub body: MessageBody, pub written: u64 /* specta number */, pub posting: Posting }
pub struct Thread { pub id: ThreadId, pub file: RangeFileId, pub line: ThreadLine, pub messages: Vec<Message>, pub session: Option<String> }
pub struct ThreadList { pub threads: Vec<Thread> }
pub struct ThreadAdded { pub thread: ThreadId, pub list: ThreadList }
pub enum GitLabCheck { /* point 6 */ }
pub struct SendProgress { pub done: u32, pub of: u32 }
pub enum SendReply { NotLinedUp { why: NotLinedUp },
                     Sent { list: ThreadList, sent: u32, refused: u32 },
                     Stopped { list: ThreadList, sent: u32, refused: u32, reason: String } }
```

**Commands** (`src-tauri/src/review.rs`, each ≤ 15 lines):

```rust
list_threads(state) -> Result<ThreadList, IpcError>
add_thread(state, file: RangeFileId, line: ThreadLine, text: String) -> Result<ThreadAdded, IpcError>
add_note(state, thread: ThreadId, text: String) -> Result<ThreadList, IpcError>
queue_message(state, message: MessageId, text: String) -> Result<ThreadList, IpcError>
unqueue_message(state, message: MessageId) -> Result<ThreadList, IpcError>
async check_gitlab(window) -> Result<GitLabCheck, IpcError>                      // spawn_blocking; a panic → WorkerStopped
async send_queue(window, progress: Channel<SendProgress>) -> Result<SendReply, IpcError> // send guard; SendRunning
```

**`IpcError` gains** `UnknownThread { thread }`, `UnknownMessage { message }`, `EmptyMessage`, `MessagePending { message }` (queue or unqueue on a pending message) and `SendRunning`.
- A store write failure maps to the existing `WriteFailed { path, message }`.
- The read refusals at start never reach the IPC. The `From<yamt_range::Error>` mapping stays exhaustive, as A's start-only variants are.

**Generated TypeScript (`bindings.ts`):**

```ts
export type ThreadId = number; export type MessageId = number;
export type ThreadLine = { kind: "removed"; left: LeftLine } | { kind: "added"; right: RightLine }
  | { kind: "unchangedOnLeft"; left: LeftLine; right: RightLine } | { kind: "unchangedOnRight"; left: LeftLine; right: RightLine };
export type MessageBody = { kind: "note"; text: string } | { kind: "aiAnswer"; turn: number };
export type Posting = { kind: "notQueued" } | { kind: "queued"; text: string } | { kind: "refused"; text: string; reason: string }
  | { kind: "pending"; text: string; draft_note: number; merge_request: string; link: string };
export type Message = { id: MessageId; body: MessageBody; written: number; posting: Posting };
export type Thread = { id: ThreadId; file: RangeFileId; line: ThreadLine; messages: Message[]; session: string | null };
export type ThreadList = { threads: Thread[] };  export type ThreadAdded = { thread: ThreadId; list: ThreadList };
export type MergeRequestRef = { reference: string; title: string; web_url: string };
export type LookedAt = { kind: "branch"; name: string } | { kind: "commit"; short_id: string };
export type NotLinedUp = { kind: "glabMissing" } | { kind: "notLoggedIn"; detail: string }
  | { kind: "noMergeRequest"; looked_at: LookedAt } | { kind: "several"; looked_at: LookedAt; references: string[] }
  | { kind: "moved"; merge_request: MergeRequestRef; gitlab_head: string; shown_head: string }
  | { kind: "otherBase"; merge_request: MergeRequestRef; gitlab_base: string; shown_base: string }
  | { kind: "preparing"; merge_request: MergeRequestRef } | { kind: "failed"; message: string };
export type GitLabCheck = { kind: "linedUp"; merge_request: MergeRequestRef } | { kind: "notLinedUp"; why: NotLinedUp };
export type SendProgress = { done: number; of: number };
export type SendReply = { kind: "notLinedUp"; why: NotLinedUp }
  | { kind: "sent"; list: ThreadList; sent: number; refused: number }
  | { kind: "stopped"; list: ThreadList; sent: number; refused: number; reason: string };
// IpcError gains | { kind: "UnknownThread"; thread } | { kind: "UnknownMessage"; message } | { kind: "EmptyMessage" }
//               | { kind: "MessagePending"; message } | { kind: "SendRunning" }
// commands.listThreads, addThread, addNote, queueMessage, unqueueMessage, checkGitlab, sendQueue(progress: TAURI_CHANNEL<SendProgress>)
```

**Window side:**
- `ipc/threadLine.ts`: the domain `ThreadLine` with branded lines, and `shownColumn(line): Column`.
- `ipc/domain.ts`: the `ThreadId`/`MessageId` brands by type guard.
- `ipc/reviewDomain.ts`: camelCase shapes (`draftNote`, `mergeRequest`, `webUrl`, `lookedAt`, `shortId`) and `toThreadList`, `toGitLabCheck`, `toSendReply`.

```ts
// ipc/ReviewSource.ts
export interface ReviewSource {
  listThreads(): Promise<SourceResult<ThreadList>>;
  addThread(file: RangeFileId, line: ThreadLine, text: string): Promise<SourceResult<ThreadAdded>>;
  addNote(thread: ThreadId, text: string): Promise<SourceResult<ThreadList>>;
  queueMessage(message: MessageId, text: string): Promise<SourceResult<ThreadList>>;
  unqueueMessage(message: MessageId): Promise<SourceResult<ThreadList>>;
  checkGitLab(): Promise<SourceResult<GitLabCheck>>;
  sendQueue(onProgress: (progress: SendProgress) => void): Promise<SourceResult<SendReply>>;
}
// A's RangeSource becomes: interface RangeSource extends SettingsSource, ReviewSource { openRange; loadRangeFile }
```

**Fixture mode** (`ipc/fixtureReview.ts`, built into `createFixtureRangeSource`):
- Threads live in memory.
- `?threads=seeded` adds one thread of each `ThreadLine` kind on the `review` case, plus one queued, one refused, one pending and one `aiAnswer` message.
- `?gitlab=<script>` scripts GitLab: `linedUp` (default), `checking` (answers after 3 s), `noGlab`, `loggedOut`, `noMergeRequest`, `noBranch`, `moved`, `otherBase`, `several`, `preparing`, `failed`, `refusal` (the second queued message is refused: "400 Bad request - Note {:line_code=>["can't be blank"]}"), `stopped` (a timeout after the first).
- Progress is sent per message with a 300 ms pause.
- `map-check.sh`'s loop gains `ReviewSource`.

### 8. Tests

**Editor node tests.** `editor/` is not mutated (VF7), so each test names the bug it catches and a one-line hand mutation that must make it fail.

| test | bug it catches | hand mutation |
|---|---|---|
| `threadAnchor`: a left line inside a modified difference is `removed` | a removed line posted as unchanged with a wrong `new_line` | `line < start + len` → `line < start` |
| `threadAnchor`: an unchanged right line after two differences pairs with its left line | a comment on an unchanged line gets the wrong `old_line` | `offset += right.len - left.len` → `offset = right.len - left.len` |
| `threadAnchor`: a line just past a pure insertion is unchanged, the last inserted line `added` | off-by-one at the insertion's end | `<` → `<=` at the end test |
| `threadRows`: a removed line's gap sits after the difference's right lines | the gap opens inside the other column's hunk, so the code below drifts | place the gap with `anchorAt`'s unchanged pairing |
| `threadRows`: an unchanged line's threads from both columns share one row | two rows double the gap | row key built from place + shown column |
| `threadRows`: rows at one place keep their order by the other column's place | rows swap between renders | drop the secondary sort key |
| `threadRows`: collapsed threads place no row, drafts do | a collapsed thread still opens a gap | treat `collapsed` like `open` |
| `threadRows`: a row's height is the larger column's sum | both columns grow by the total, so a gap shows under the box | `Math.max(a, b)` → `a + b` |
| `threadField`: a row widget with the same keys `eq`s the old one, so its DOM is kept when heights change | typing that grows the box blurs the text box | add `this.height === other.height` to `eq` |
| `threadNumbers`: the count mark counts open and collapsed threads shown in this column, not drafts | a draft shows "1" before anything is added | count `draft` too |
| `threadNumbers`: a press on the badge reports the line's keys; a press on the number starts a thread | the badge opens a second thread | swap the two branches |
| `compareFrame`: an unchanged-line row adds the lines around it as anchors in both columns | scroll sync drifts past a tall box | drop `threadAnchors` from `measure` |
| `compareFrame`: merged anchors stay sorted in both columns | a jump while scrolling past a row | concatenate without sorting |

**WebKit probe** `editor/rangeThreads.browser.test.ts` (not in `just check`):
- A host growing by 200 px moves the next line in both columns by 200 px, and the band's edges move with it.
- Typing in a teleported textarea leaves both documents unchanged, and Ctrl+F there opens no find bar.
- Scrolling 10,000 px away and back gives the same host node with the textarea's text and focus kept.
- Horizontal scroll leaves the box in place (sticky).

**Rust behaviour tests** (mutated):
- `yamt-gitio/tests/glab.rs` (`#[cfg(unix)]`, the fake below):
  - `glab_missing_on_path_is_none`
  - `stdin_reaches_glab_and_stdout_comes_back`
  - `a_failing_glab_keeps_its_exit_stdout_and_stderr`
  - `a_hanging_glab_times_out`
  - `glab_runs_in_the_repository_with_no_color_and_stdin_closed`
  - `branch_names_from_heads_and_remote_tracking_and_none_for_a_commit_id`
- `yamt-range/tests/threads.rs`:
  - `a_missing_file_is_an_empty_store_and_nothing_is_written`
  - `format_1_round_trips_every_body_and_posting_kind_and_a_session`
  - `a_broken_file_names_line_and_column_and_is_left_unchanged`
  - `a_newer_format_is_refused_and_left_unchanged`
  - `repeated_ids_ids_at_or_above_next_and_threads_without_messages_are_broken`
  - `adding_writes_the_thread_with_its_first_message_and_new_ids`
  - `ids_never_repeat_after_reopening`
  - `blank_text_is_refused_and_nothing_written`
  - `queue_keeps_the_edited_text_and_unqueue_drops_it`
  - `a_pending_message_cannot_be_queued_or_unqueued`
  - `a_failed_write_changes_nothing_in_memory`
  - `threads_on_paths_no_longer_listed_are_kept_on_every_write`
  - `a_leftover_temp_file_is_ignored`
- `lines_up.rs` unit tests over recorded JSON in `tests/glab/*/`:
  - `three_dots_lines_up_when_base_and_head_are_the_two_commits`
  - `two_dots_lines_up_only_when_the_left_is_the_merge_base`
  - `a_moved_head_names_both_short_ids`
  - `another_base_names_both_short_ids`
  - `no_open_merge_request_from_the_branch`
  - `several_open_merge_requests_take_the_one_that_lines_up`
  - `a_commit_id_side_uses_the_merge_request_ending_at_it`
  - `null_diff_refs_is_preparing`
  - `unexpected_json_is_failed_naming_the_field`
- `position.rs`:
  - `removed_added_and_unchanged_give_one_based_old_and_new_lines`
  - `renamed_added_and_deleted_files_give_both_paths`
- `yamt-range/tests/review.rs` (`#[cfg(unix)]`, fake glab):
  - `sending_posts_in_thread_order_and_records_pending_with_the_link`
  - `a_refused_message_keeps_its_reason_and_stays_queued_while_the_others_are_sent`
  - `a_timeout_stops_the_send_and_leaves_the_rest_queued`
  - `a_message_already_among_the_drafts_is_recorded_without_posting_again`
  - `send_rechecks_and_posts_nothing_when_the_merge_request_moved`
  - `the_post_body_names_the_three_commits_and_the_position`
- `src-tauri`:
  - `a_second_send_while_one_runs_answers_send_running`
  - `a_broken_threads_file_ends_before_any_window_with_exit_2`
  - `IpcError` mapping for each new kind

**`ui/` and `ipc/` node tests** (Stryker-mutated):
- `rangeThreads.test.ts`:
  - a draft's Comment adds the thread and its key becomes the stored id with the text kept;
  - a second press on a line with an open draft focuses it, with no second draft;
  - open and collapse, per thread and per line;
  - counts per file ignore drafts;
  - blank text is never sent;
  - a reply arriving after the view unmounted is applied to the store only.
- `rangeGitLab.test.ts`:
  - checked at start;
  - focus within 30 s does not re-check;
  - no overlapping checks;
  - disabled until the first answer;
  - the last answer is kept during a re-check;
  - Send's `notLinedUp` replaces the check;
  - the progress label;
  - the result notice "5 sent, 1 refused".
- `rangeThreadText.test.ts`: every `NotLinedUp` sentence (exhaustive), the posting labels, `threadPlaceText` for each `ThreadLine`, the two-dots hint.
- `rangeKeys.test.ts`.
- `reviewDomain.test.ts`.
- `fixtureReview.test.ts`: each script.

**Fake glab:**
- `scripts/fake-glab/glab` (POSIX sh) answers from `$YAMT_FAKE_GLAB` (a folder under `tests/glab/<scenario>/`: `auth-status.{out,exit}`, `merge-requests.json`, `merge-request.json`, `draft-notes.json`, `post-<n>.{json,err,exit,sleep}`).
- It counts posts in `$YAMT_FAKE_GLAB_STATE` and logs every argv and stdin to `$YAMT_FAKE_GLAB_LOG`.
- The same fake serves the Rust tests and the real app.

**WebKit steps** (`just webdriver`, `?range=review&gitlab=…&threads=…`), one per acceptance line:
1. Hovering a number in each column shows the icon. A press opens a box under the line; the other column's next line moves by the same height.
2. Type, then Ctrl/Cmd+Enter: the message shows, the mark reads 1, the list row reads 1.
3. In the box, arrows, Ctrl+A, Ctrl+C and Escape on an empty draft stay in the box; Escape removes the empty draft.
4. A 15-line message keeps both columns aligned and the bands correct.
5. Collapse and open by the header and by the mark.
6. Removed, added and unchanged lines, each on its side (`seeded`).
7. Post → edit → Queue gives "Queued", Send (1); Unqueue gives Send (0).
8. Send gives "Sending 1 of 1…", then "Pending on GitLab", the link and Copy.
9. `refusal`: one refused with its reason, the others pending, n = 1 left.
10. Each not-lined-up script: both buttons disabled, with its sentence.
11. `checking`: "Checking GitLab…".
12. `seeded`: the `aiAnswer` line.
13. Find in a column still works with the keyboard in the code.

**Real-app steps** (`scripts/range-repo.sh /var/tmp/rr`, then `just app-session start-app --repo /var/tmp/rr --range main...feature --glab <scenario>`; W3b adds `--glab`, which prefixes PATH with `scripts/fake-glab` and sets `YAMT_FAKE_GLAB`):
1. Threads on each kind; close; reopen: they come back collapsed, with counts and queued states; `threads.json` is format 1.
2. A broken or newer `threads.json` gives exit 2 with the line, and the file unchanged.
3. `lined-up`: Send; the fake's log shows the body with the three ids and the position.
4. `refusal`, `timeout` (sleep 25: stopped), then re-Send with `drafted`: no second post.
5. No glab on PATH: "glab is not installed".
6. Switch the scenario to `moved`, focus after 30 s: disabled with the sentence.

**What only a real GitLab can prove** (the owner, once):
- In a throwaway project, push `main` and a `dev` with a change, a deletion, a rename and a far unchanged line, and open an MR from `dev`. Run `glab auth login`, then `yamt --diff=main...dev`.
- Make threads on a removed line, an added line, an unchanged line far from any change, and a line of the renamed file. Queue all four and Send.
- In GitLab's Changes view each pending comment sits on the same line as in yamt. Publish.
- Push one more commit, focus yamt: disabled with "!N is at …".
- This proves the positions, `diff_refs` semantics, the `:fullpath` lookup and glab's output on an HTTP error, which the fake only imitates.

### 9 and 10: per option below.

---

## Option A (recommended): editor-owned rows that Vue fills; the review lives in `yamt-range`

**Data structures first.**

Editor:
```ts
// editor/range.ts (public): A's surface + B
export type ShownThread = {
  readonly key: string;                               // opaque, built by ui (`thread-12`, `draft-3`)
  readonly line: ThreadLine;
  readonly shown: "open" | "collapsed" | "draft";     // draft: a row, no count; collapsed: a count, no row
};
export type RangeEvents = {
  readonly startThread: (line: ThreadLine) => void;          // a press on a line number
  readonly toggleThreads: (keys: readonly string[]) => void; // a press on a count mark: that line's threads in that column
  readonly hosts: (hosts: ReadonlyMap<string, HTMLElement>) => void; // after each showThreads that adds or drops a key
};
export class RangeController {
  constructor(texts: RangeTexts, hosts: CompareHosts, options: RangeOptions, events: RangeEvents); // events: new
  setPreferences(preferences: Preferences): void;
  moveToChange(direction: Direction): void;
  showThreads(threads: readonly ShownThread[]): void;                                          // new
  destroy(): void;                                                                             // also drops every host
}
// editor/index.ts adds: export type { ShownThread, RangeEvents } from "./range";
```

Internal (`editor/internal/`):
- `threadRows.ts` (pure): `ThreadRow = { place: Readonly<Record<Column, number>>; keys: Readonly<Record<Column, readonly string[]>> }`, and `threadRows(spans, shown)`.
- `threadField.ts`: one `StateField<readonly ThreadRow[]>` per column, set by `showThreadRows`, providing `Decoration.widget({ block: true, side: 1 + k })` at the end of line `place − 1` (`side: -1` at 0 for place 0).
- `threadWidget.ts`: `ThreadRowWidget` `eq`s by row key and keys only. `toDOM` makes `div.cm-thread-row` with its height from the shared `RowHeights` and appends that column's persistent hosts. `estimatedHeight` reads `RowHeights`. `destroy` keeps the hosts.
- `threadHosts.ts`: `ThreadHosts` keeps `Map<key, HTMLElement>` for the controller's life.
  - One `ResizeObserver` on every host. In its callback it computes the row heights, writes the changed `style.height` on both cells, then calls `requestMeasure()` on both views.
  - It writes `--thread-left` and `--thread-width` (the gutters' width and the scroller's client width) on each column host, so the sticky row stays put under horizontal scroll.
- `threadNumbers.ts`:
  - `lineNumbers({ domEventHandlers: { mousedown } })`, merged into the panes' own number gutter;
  - `lineNumberMarkers` computed from the field (number + count badge);
  - the hover icon's mask variable, built from `~icons/lucide/message-square-plus?raw`.
- `threadAnchor.ts`: point 1.

`CompareFrame` takes `{ views, strip, fields, anchors }`. The compare window passes `[differenceField]` and no extra anchors. The range window passes `[differenceField, threadField]` and `threadAnchors` (for rows outside differences: the bottom of the line above and the top of the line below, in both columns).

**Rust (`yamt-range`, new modules):**
- `thread_types.rs`: the IPC types.
- `thread_file.rs`: format 1, its refusals, `write_atomically`.
- `thread_store.rs`: `ThreadStore::{open, list, add_thread, add_note, queue, unqueue}`, plus `pub(crate)` `queued`, `record`.
- `right_branch.rs`.
- `gitlab.rs`: REST shapes `MergeRequest { iid, project_id, sha, web_url, title, references.short, diff_refs }`, `DraftNote`, and the endpoint builders.
- `lines_up.rs`: pure.
- `position.rs`: the post body and `same_draft`.
- `review.rs`: `check_gitlab(range: &Range) -> GitLabCheck` and `send_queue(range: &Range, threads: &Mutex<ThreadStore>, progress: Sender<SendProgress>) -> Result<SendReply>`.

**`yamt-gitio`:**
```rust
pub struct Glab { program: PathBuf }
pub enum GlabRun { Printed { stdout: Vec<u8> }, Failed { status: Option<i32>, stdout: Vec<u8>, stderr: Vec<u8> }, TimedOut }
impl Glab { pub fn find() -> Option<Glab>; pub fn at(program: PathBuf) -> Glab;
            pub fn run(&self, cwd: &Path, args: &[&str], stdin: Option<Vec<u8>>) -> Result<GlabRun>; }
impl Repo { pub fn symbolic_full_name(&self, name: &str) -> Result<Option<Vec<u8>>>; pub fn remote_names(&self) -> Result<Vec<Vec<u8>>>; }
```

**Shell:** A's `RangeState { range, _lock }` gains `threads: Mutex<ThreadStore>` and `sending: Mutex<()>`.
- `sending` is taken with `try_lock` for a whole send.
- `threads` is taken briefly inside it, always in that order.
- `threads` is never held across glab.

**Window:**
- `ui/rangeThreads.ts` (`createRangeThreads(source, report)`): `list`, `open` (set of `ThreadId`), `drafts` (new-thread drafts and reply text, kept across the 16-view eviction), `counts`, `shownFor(file)`, and the actions.
- `ui/rangeGitLab.ts` (`createGitLabCheck`): `check`, `checking`, `sending: { done, of } | null`, `checkNow`, `checkOnFocus`, `send`.
- Both are held by `rangeStore`.
- `useRangeController` passes `shownFor(file)` through a watch into `showThreads`. It returns `threadHosts` (a `shallowRef<ReadonlyMap>`) and wires `startThread` and `toggleThreads` to the store.
- `RangeView` renders `RangeThreadLayer`, which teleports each key's `RangeThreadBox` into its host.

**Visions:**
- 2: one thread store, one anchor rule placing both the anchor and the gap, one deadline runner.
- 4: `ThreadLine`, `Posting`, `GitLabCheck`/`NotLinedUp` and `SendReply` are sums, and `ShownThread.shown` is a closed union.
- 1: a box is an ordinary Vue component; every module is named for what it owns.
- 5: no new crate and no dependency.

**Builds** (at most one Rust and one web build at once; C = create, M = change; each file's owner named; a file touched again later is touched only after the earlier build is committed):

| build | needs | files | ≈ lines |
|---|---|---|---|
| **D0** docs | A's D0 | M `docs/architecture.md` (§1, §3.2 glab, §3.5 review commands + RS5 text, §3.8 range: threads and review, §4, §5.1 rows, §5.2 `RangeController`, §5.4, §7 `serde_json` in yamt-range, §8), `.omp/skills/{project-map,ipc-contract,risk-register,rust-conventions,cm6-rules}/SKILL.md` (CM15: block rows from a field, persistent hosts, widgets ignore events), `crates/{range,gitio}/AGENTS.md`, `frontend/src/{editor,ui,ipc}/AGENTS.md`, `README.md`, `CHANGELOG.md`; names every planned file, command and `ReviewSource` method | 15 / 550 |
| **R2** rust: thread store | D0, A's R2 | C `crates/range/src/{thread_types,thread_file,thread_store}.rs`, `crates/range/tests/threads.rs` · M `crates/range/src/lib.rs`, `crates/range/Cargo.toml` (+`serde_json`), `Cargo.lock` | 7 / 1,100 |
| **W1** web: editor ∥ R2/R1/R3 | D0, A's W1 | C `editor/internal/{threadAnchor,threadRows,threadField,threadWidget,threadHosts,threadNumbers}.ts`, `editor/internal/{threadAnchor,threadRows,threadField,threadNumbers}.test.ts`, `editor/rangeThreads.browser.test.ts`, `ipc/threadLine.ts` · M `editor/range.ts`, `editor/index.ts`, `editor/compare.ts`, `editor/internal/compareFrame.ts`, `editor/internal/compareFrame.test.ts`, `editor/theme.css`, `ipc/index.ts` | 19 / 1,450 |
| **R1** rust: glab and branch reads | R2 | C `crates/gitio/src/glab.rs`, `crates/gitio/tests/glab.rs`, `scripts/fake-glab/glab`, `tests/glab/runner/*` · M `crates/gitio/src/{lib,repo,names}.rs` | 8 / 600 |
| **R3** rust: lines-up and send | R1 | C `crates/range/src/{right_branch,gitlab,lines_up,position,review}.rs`, `crates/range/tests/review.rs`, `tests/glab/{lined-up,two-dots,moved,other-base,several,preparing,no-merge-request,commit-route,logged-out,refusal,timeout,drafted}/*` (recorded JSON) · M `crates/range/src/lib.rs` | 7 code + data / 1,350 |
| **R4** contract | R3, A's R3a | C `src-tauri/src/review.rs` · M `src-tauri/src/{range,commands,ipc_error}.rs`, `frontend/src/ipc/bindings.ts` (generated), `frontend/src/ui/{problemText,problemText.test}.ts` | 7 / 500 |
| **W2** ipc | R4, W1, A's W3 | C `ipc/{ReviewSource,reviewDomain,reviewDomain.test,tauriReview,fixtureReview,fixtureReview.test}.ts` · M `ipc/{domain,RangeSource,tauriRange,fixtureRange,index}.ts`, `scripts/map-check.sh` | 12 / 800 |
| **W3a** ui state | W2, A's W4 | C `ui/{rangeThreads,rangeThreads.test,rangeGitLab,rangeGitLab.test,rangeThreadText,rangeThreadText.test}.ts` · M `ui/{rangeStore,rangeStore.test,useRangeController,useRangeController.test}.ts` | 10 / 1,100 |
| **W3b** ui components | W3a | C `ui/{RangeThreadLayer,RangeThreadBox,RangeMessage,RangePostEditor,RangeSendButton}.vue`, `ui/{rangeKeys,rangeKeys.test}.ts` · M `ui/{RangeView,RangeFileRow,RangeApp}.vue`, `frontend/scripts/app-session/{args,args.test,start}.ts` (`--glab <scenario>`) | 13 / 1,150 |
| verify | all | `just check`, `just mutants <base>`, browser probe, WebKit, real app (fake glab), the owner's real-GitLab check | |

```
D0 ─┬─ R2 ── R1 ── R3 ── R4 ─┬─ W2 ── W3a ── W3b ── verify
    └─ W1 (beside R2 … R3) ──┘
```

Critical path: D0 → R2 → R1 → R3 → R4 → W2 → W3a → W3b, 8 builds. Files touched by two builds in sequence: `crates/range/src/lib.rs` (R2, R3), `ipc/index.ts` (W1, W2), `Cargo.lock` (R2, R4). No two running builds share a file.

**Contracts each build fixes for the next:**

| build | fixes |
|---|---|
| R2 | the thread IPC types and the `ThreadStore` API |
| R1 | `Glab`, `GlabRun`, `Repo::symbolic_full_name`/`remote_names`, the fake's scenario layout |
| R3 | `check_gitlab`, `send_queue`, `GitLabCheck`, `SendReply` |
| R4 | `bindings.ts`, the five `IpcError` kinds, `RangeState`'s new fields |
| W1 | the `RangeController` surface above, `ShownThread`, `RangeEvents`, `ThreadLine` (domain), `CompareFrame`'s `{ fields, anchors }` |
| W2 | `ReviewSource`, the domain types, the fixture scripts |
| W3a | `createRangeThreads` / `createGitLabCheck` and their store fields |

**Changes to A's contracts (named, with cost):**

| A's contract | change | cost |
|---|---|---|
| `RangeController` | constructor gains `events`; new `showThreads` | `useRangeController` and its test change |
| `CompareFrame` | takes `fields` + `anchors` | the compare window passes the defaults; 2 lines in `compare.ts` |
| `RangeSource` | `extends ReviewSource` | the Tauri and fixture factories each spread one more object |
| `RangeState` | gains two Mutexes | `run_range` opens the store after the lock; one more start failure line |
| `RangeFileRow` | gains `threads: number` | — |
| `RangeView` | gains the layer, the Send button and the typing guard | — |
| `yamt-range` | a second responsibility and `serde_json` | — |

## Option B: the same window; the review is its own crate `yamt-review`

**Data structures:** the same types, in `crates/review` (`yamt-review`).
- Modules: `lib`, `thread_types`, `thread_file`, `thread_store`, `right_branch`, `gitlab`, `lines_up`, `position`, `send`.
- Tests: `tests/{threads,review}.rs`.
- Dependencies: `yamt-range` (for `Range`, `RangeFileId`, `RangeEntry`, the pair folder), `yamt-gitio` (`Glab`, `Repo`), `serde`, `serde_json`, `specta`, `thiserror`.

A's crate keeps its one job but must widen its public surface: `Range::entry(file) -> Option<RangeEntry>`, `Range::compared() -> Compared { left: Oid, right: Oid, right_label: RangeSideLabel }`, and `Range::root() -> PathBuf` (B opens its own `Repo`). `arch-check.sh` gains "yamt-review depends on yamt-range and yamt-gitio only among yamt crates", and yamt-app's allowed list gains it.

**Window, gitio, IPC and tests:** as A. The Rust tests move to `crates/review/tests/`.

**Builds:** R2′ = new crate + threads (+ A's accessors in `crates/range/src/lib.rs`, `scripts/arch-check.sh`, root `Cargo.toml`), about 11 files / 1,250 lines. R3′ = review modules in `yamt-review`. The rest as A.

**Visions:** 2 and 1 (each crate one job: "what changed" and "your review of it"), 3 (only `yamt-review` reaches glab, checked by arch-check). It costs vision 5: a crate for one user, §7 and arch-check entries, three new public accessors on A's crate, and a fifth crate in mutation runs.

## Option C: Vue boxes in an overlay over spacer rows; Rust as A

**Data structures:**
- The editor keeps `threadRows` and `threadField`, but every row is a plain spacer widget in both columns with `height = row height`; there are no hosts.
- `RangeController` reports `rowBoxes(column, boxes: { key, top, height }[])` per frame from `CompareFrame`'s paint.
- `RangeView` renders one absolutely positioned, clipped overlay per column (a sibling of the editor host, leaving the scrollbar's width free). Each `RangeThreadBox` sits in it with `transform: translateY(top − scrollTop)`, written by the editor per frame on elements Vue registers by key (`setBoxElement(key, el)`).
- Wheel events over the overlay are forwarded to the column's `scrollDOM` (`scrollBy`).
- Box heights reach the editor through `boxHeight(key, px)` from a Vue `useResizeObserver`.

**What differs:**
- The box is never inside CodeMirror's content: no `contentEditable` island, no persistent-host trick, no sticky width.
- It costs:
  - per-frame transform writes for every visible box (#51's paint budget, measured on the owner's machine for the strips);
  - a one-frame lag behind the code on fast scrolls;
  - forwarded wheel scrolling that loses WebKitGTK's own smooth or inertial scrolling over a box;
  - a second geometry path (box positions) beside the bands;
  - text selection can no longer run from code into a box.

**Builds:** W1 changes `threadWidget.ts`/`threadHosts.ts` into `threadSpacer.ts` + overlay positioning in `compareFrame.ts`. W3b adds `RangeThreadOverlay.vue` in place of `RangeThreadLayer.vue`. About the same size.

**Visions:** 1 (no CodeMirror event subtleties). It costs vision 2 (box positions computed twice) and #51's budget.

---

## Recommendation: option A

- **It follows the structure A and C already fixed.** A's recorded seam (#106 "a per-column block-widget field plus anchors in `CompareFrame`"; #107 "that pair folder is where B keeps its threads"; `RangeDesign` "`crates/range/src/threads.rs` (B)") and C's recorded seam (`<AiTurn>` is a Vue component, so the box must be Vue).
- **One rule for both sides of a row.** `anchorAt` and `threadRows` place both the anchor GitLab gets and the gap that keeps the columns aligned.
- **Scrolling stays as fast as CodeMirror makes it.** The boxes scroll as part of CodeMirror's content: no per-frame box writes and no wheel forwarding.
- **Comments cannot land on the wrong lines.** Posting names the three commits it checked.

**Its cost:**
- `yamt-range` takes a second job (threads and posting) and `serde_json`: about 2,400 more lines in one crate, every file under 400. Option B is the answer if that is judged a vision-2 breach.
- RS5 is amended: two more `Mutex`es in `RangeState` (`threads`, and the `sending` guard held across a send with `threads` taken inside it, always in that order).
- A's contracts change in seven places (the table above).
- About 700 lines of the trickiest editor code: persistent hosts that must survive CodeMirror's redraws, a sticky row, and a row height synced from a `ResizeObserver`. It is proven only by the WebKit probe and the WebKit steps, since `editor/` is not mutated.
- glab's output on an HTTP error is **[INFERENCE]** until R3 records it with the 1.124 archive; the owner's one real-GitLab run is the final proof.
- Total: about 98 files (data included) and 9,000 changed lines over 9 builds. The critical path is 8 builds, and every build waits for its counterpart in A.

**Plan §2 rows** (DR5: proposed, the orchestrator records them):

- **#116 Threads sit in the columns as block rows that Vue fills** (request B rules 1–3; design `briefs/3.RV-threads-design.md` option A).
  - The anchor is `ThreadLine` = `Removed { left }` | `Added { right }` | `UnchangedOnLeft { left, right }` | `UnchangedOnRight { left, right }` (0-based; +1 only in the GitLab position). It is computed in the editor by `anchorAt` from the reply's differences, the same rule that places the gap.
  - A row is one aligned place; threads with the same place share it. Each column gets one block widget per row from a per-column `threadField`; both cells take the larger column's summed height.
  - The boxes are Vue components teleported into host elements the editor keeps per thread for its life, so CodeMirror's redraws and virtualisation keep their DOM, focus and typed text.
  - Widgets ignore every event; the window's keydown skips typing targets; a `ResizeObserver` on the hosts calls `requestMeasure`.
  - `CompareFrame` counts `threadField` in `rowsChanged`, and rows outside differences become scroll anchors.
  - The line numbers carry a count mark (open or collapse) and a hover comment icon; rows stay put under horizontal scroll (sticky).
  - Threads come back collapsed (C's conversation loads when one is opened, #115).
  - *Rejected:* a Vue overlay over spacer rows (per-frame transforms, wheel forwarding, a one-frame lag: option C); boxes built by the editor (C's `AiTurn` is Vue: rework); a thread panel below the columns (rule 1: "inside the code"); one row per thread (both-sided rows on one line would stack).
  - **Visions 2, 4, 1.**
- **#117 Threads are stored by `yamt-range` in the pair folder** (`threads.json` format 1: per thread its path, `ThreadLine`, `session`, messages with `note` or `aiAnswer` body, written time and posting state `notQueued | queued | refused | pending`; `ThreadId`/`MessageId` counters that never repeat).
  - Written through a temporary file and a rename on every change and after each sent message.
  - Unreadable, broken or newer: exit 2 before any window, the file untouched (#93's rule).
  - Threads on paths no longer listed are kept.
  - Which threads are open and text not yet added are the window's, never stored.
  - Amends RS5 (`RangeState` gains `Mutex<ThreadStore>` and the send guard, taken in that order) and §7 (`serde_json` in `yamt-range`).
  - *Rejected:* localStorage (#97's size reason, #107's pair folder); file ids as keys (the list order can change between runs); storing the AI's answers (omp's session is their truth, #110); a separate crate (option B: a crate for one user and three new accessors on A's crate).
  - **Visions 2, 3, 4, 5.**
- **#118 Posting goes through `glab api` to the draft-notes route with an explicit position.**
  - `yamt-gitio` runs glab (PATH, 20 s per call, stdin closed except the JSON body, the user's environment plus `NO_COLOR`, the repository as working folder).
  - The position names `base_sha`/`start_sha`/`head_sha` from the `diff_refs` just checked, plus both paths and GitLab's lines.
  - Sends are sequential in thread order. Existing drafts are listed first and a matching one is recorded instead of posted again.
  - A GitLab 4xx refusal stays queued with GitLab's message while the rest continue. A timeout, auth failure, 429, 5xx or a missing glab stops the send with the rest queued.
  - Progress goes through a `Channel`. The link is the MR's Changes page, shown as text with Copy (#112, #115).
  - *Rejected:* `glab mr note draft create` (EXPERIMENTAL; aims at the MR's latest diff version, so a push between check and post moves comments silently); parallel sends (order, rate limits); a GitLab client in Rust (token handling, a dependency); opening links (#115).
  - **Visions 4, 3, 2, 5.**
- **#119 Posting is enabled only when GitLab's diff is exactly the window's.**
  - `check_gitlab` answers `LinedUp { merge_request }` | `NotLinedUp { why }`, from a pure `lines_up` over glab's JSON.
  - glab is found and `glab auth status` exits 0.
  - The candidates are the open MRs from the right side's branch (`rev-parse --symbolic-full-name`, a remote-tracking name stripped of its remote), or, when the range names no branch, the open MRs whose head is the right commit.
  - One lines up when `diff_refs.base_sha` = the left commit and `head_sha` = the right commit. `a...b` holds while the MR is current; `a..b` only when `a` is the merge base.
  - Checked at start, on focus 30 s or more after the last check, and inside every Send; one at a time; buttons disabled until the first answer and kept during re-checks; every sentence in `ui/rangeThreadText.ts`.
  - *Rejected:* checking only at Send (Post enabled while not lined up); the branch name alone (a stale local branch posts onto wrong lines); `start_sha` in the rule (a moved target does not change the diff).
  - **Visions 4, 2, 1.**
- **#120 Defaults decided with the threads design** (OR13, the owner may veto):
  - threads come back collapsed;
  - a commit-id right side posts to the one open MR ending at that commit;
  - Unqueue stays enabled when posting is disabled;
  - text typed but not added is not kept;
  - "Pending on GitLab" stays after you publish in GitLab;
  - a thread or message cannot be deleted or edited.

  **Visions 5, 1.**

**Risks to register:**

| id | risk | proving test |
|---|---|---|
| RK32 | comments land on wrong lines in GitLab | `lines_up` tests, `position` tests, the owner's real-GitLab check |
| RK33 | a send retried after a timeout duplicates a draft | `a_message_already_among_the_drafts_is_recorded_without_posting_again` |
| RK34 | columns or bands misalign after a box grows | the browser probe + WebKit step 4 |
| RK35 | typing in a box loses focus or reaches the editor | the `threadField` `eq` test + the browser probe |
| RK36 | `threads.json` overwritten after a failed read | `a_broken_file_…_is_left_unchanged`, `a_newer_format_…` |

Also noted, without a proving test of their own:
- A fork's MR lives in the upstream project, which glab's `:fullpath` lookup from the folder may not find. It shows "no open merge request from dev".
- glab inherits AppImage variables, as git does (RK21).

## Open questions for the product owner

1. **Threads when a range opens again.** Right now they come back collapsed: you see a count on each line and on each file, and opening one shows it. With `--ai`, opening one is also what loads its AI conversation, which takes seconds on a large repository. The other way: they come back as you left them, open ones open, and with `--ai` every open thread starts loading at once.
2. **A threads file yamt cannot read** (damaged, or written by a newer yamt). Right now the window does not open; a message names the file, which is left untouched, as the pasted-text window does. The other way: the window opens with comments switched off and the file untouched, so you can still look at the changes.
3. **A range whose right side is a commit id or `HEAD~2`.** Right now posting works when exactly one open merge request ends at that commit. The other way: posting only when the range names the branch (`main...dev`). Then every review typed with ids can never post.
4. **Deleting or editing your own comments** is not in the rules. Right now a comment cannot be removed or changed once added; a typo stays until you fix it in GitLab after sending. Should you be able to delete or edit a comment that is not yet pending on GitLab?
5. **Text you typed but did not add** (no Ctrl/Cmd+Enter yet) is lost without a question when the window closes. Should closing ask first?
6. **After you publish in GitLab**, yamt still shows "Pending on GitLab" on those messages, because it never reads GitLab's comments back (non-goal). Is that wording acceptable, or should it say "Sent to GitLab"?

## Where this departs from the brief

- **Unqueue stays enabled when posting is disabled.** Rule 7 says both buttons are disabled. Taking a message out of the queue never touches GitLab, and without this a queued message could not be removed while the MR does not line up.
- **"glab is not logged in to <host>"** reads "glab is not logged in: <glab's own line naming the instance>". Pulling the host out of glab's text output would be a fragile parse.
- **The link** opens nothing. It is shown as text with Copy (#112, #115), and it is the MR's Changes page, because a pending comment has no address of its own **[INFERENCE]**.
- **The `aiAnswer` body and `session` are in format 1 now,** so C reads and writes the same file without a format change. B creates neither and shows an AI answer as one line.
- **Not yet verified, to confirm in the builds:**
  - `glab api --include` printing the status line on an HTTP error, and GET fields becoming query parameters on glab 1.124. R1 checks against `glab api --help` from the archive; R3 records the outputs.
  - Draft notes accepting an unchanged line far from any change. The owner's real-GitLab check covers it.