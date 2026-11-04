# Slice mr-threads-app — five commands: read a thread, reply, resolve, submit a review, preview (the shell)

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: C5, C7–C10 (the shell side) and the Rust acceptance "a thread comes back
  whole with edited times and the viewer's drafts; a reply, a draft reply, a resolve, an unresolve and a submit each
  send exactly one write (calls log), and a refused one comes back with GitLab's reason".
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.3, §3.1 rows #180–#182, §3.2 (RK41, RK53, RK54).

Runs in wave 4, after `mr-threads-crate`. After it the orchestrator runs `just bindings` and hands the file to
`mr-threads-state-ipc` (the frontend type check is red until that slice lands: commit them together).

## Target

**Owned:**

- `src-tauri/src/merge_requests.rs`
- `src-tauri/src/merge_requests/thread.rs` (new)
- `src-tauri/src/merge_requests/tests.rs`, `src-tauri/src/merge_requests/tests/thread.rs` (new),
  `src-tauri/src/merge_requests/tests/discussions.rs`, `src-tauri/src/merge_requests/tests/description.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/AGENTS.md`

**Read-only:** everything else.

- `crates/**`: use the crate as `mr-threads-crate` contracted it.
- `src-tauri/Cargo.toml`: no dependency is added.
- `tests/glab/**`, `scripts/fake-glab/glab`: `mr-threads-fixtures`'.
- `frontend/**`: `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- `docs/**`, `.omp/skills/**`: lines in `deviations_from_brief` (the docs keeper writes `docs/architecture.md` §4 and
  `ipc-contract`).

**Non-goals:** any window code; any write but the four; offering anything a reply did not name.

## Contract

Fixed; you may add, never change.

```rust
// merge_requests/thread.rs — each command: blocking_reply, Glab::find(), then the reply function; no GitLab
// project → Failed { message: NO_PROJECT } (DiscussionThreadReply, DiscussionWriteReply, MarkdownPreviewReply).

#[tauri::command] #[specta::specta]
pub(crate) async fn read_discussion_thread<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid,
    discussion: DiscussionId) -> Result<DiscussionThreadReply, IpcError>;
#[tauri::command] #[specta::specta]
pub(crate) async fn reply_to_discussion<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid,
    discussion: DiscussionId, kind: ReplyKind, text: String) -> Result<DiscussionWriteReply, IpcError>;
#[tauri::command] #[specta::specta]
pub(crate) async fn resolve_discussion<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid,
    discussion: DiscussionId, resolve: bool) -> Result<DiscussionWriteReply, IpcError>;
#[tauri::command] #[specta::specta]
pub(crate) async fn submit_review<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid)
    -> Result<DiscussionWriteReply, IpcError>;
#[tauri::command] #[specta::specta]
pub(crate) async fn preview_markdown<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid, text: String)
    -> Result<MarkdownPreviewReply, IpcError>;

/// The thread's pages are offered, then its uploads, then its pictures — each lock held alone — before the reply
/// is returned (RK41, RK53; `offer`, `offer_described`, `merge_requests.rs:96-109`).
pub(super) fn thread_reply(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid,
    discussion: &DiscussionId) -> DiscussionThreadReply;
/// The preview's pages and uploads offered before the reply, as a description's.
pub(super) fn preview_reply(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid, text: &str)
    -> MarkdownPreviewReply;
// write replies: no offers (a write answers no page).
```

- The five are registered in `commands.rs` after `merge_requests::links::read_links` as
  `merge_requests::thread::<name>::<tauri::Wry>`; the bindings get `readDiscussionThread(iid, discussion)`,
  `replyToDiscussion(iid, discussion, kind, text)`, `resolveDiscussion(iid, discussion, resolve)`,
  `submitReview(iid)`, `previewMarkdown(iid, text)`.
- A `discussion` argument that is not 40 lowercase hex fails deserialisation (the window's `IpcError`); no glab runs.
- `MergeRequestState`'s doc comment (`merge_requests.rs:60-64`) names the thread's and the preview's pages.

## Change

1. `thread.rs` with the five commands and the two offering reply functions; `merge_requests.rs` (`mod thread`, doc
   comment); `commands.rs`.
2. Tests in `tests/thread.rs` over the fake glab (`run_with_fakes`, as `tests/description.rs`); `tests/discussions.rs`
   and `tests/description.rs` adjusted only where the new fields change their expectations (the `id`, `earlier`,
   `mentions`, `size` in the JSON).
3. `src-tauri/AGENTS.md`: the five commands, their offers, the one-write rule.

## Acceptance

**Tests** (`cargo nextest run -p yamt-app`, hermetic prefix), each named for the bug it catches, over `mr-threads`
unless named:

- `a_threads_pages_and_uploads_are_offered_before_the_reply` (RK41, RK53: d01's comment pages and its
  `https://docs.example/board` link open through `open_page` after the read; its upload is served by the picture
  scheme; neither before)
- `a_previews_pages_are_offered_before_the_reply` (the `markdown.json` link)
- `read_discussion_thread_comes_back_whole_with_edits_and_drafts` (through the command: four comments, anna "edited
  by" anna, sam's by dmitri, drafts `[501]`, pending 2) — **owns the acceptance's "a thread comes back whole"**
- `each_panel_write_is_one_post` (through the commands, in order: comment, draft, resolve, unresolve, submit → each
  `Sent`; the calls log holds exactly one `POST …/discussions/<d01>/notes`, one `POST …/draft_notes`, two `PUT
  …/discussions/<d01>` with `{"resolved":true}` then `{"resolved":false}`, one `POST …/draft_notes/bulk_publish`
  with `{}`; the state file `5`; then `read_discussion_thread` answers after-post-5) — **owns "each send exactly one
  write"** (RK54)
- `a_refused_write_comes_back_with_gitlabs_reason` (`mr-threads-refused`: `Refused { "403 Forbidden" }`, `Refused
  { "note is missing" }`, then `Failed` for post-3 and post-4) — **owns "a refused one comes back with GitLab's
  reason"**
- `an_empty_reply_runs_no_glab` (the calls log stays empty)
- `a_discussion_argument_not_40_hex_is_refused_by_the_command`
- `no_gitlab_project_fails_every_thread_command`
- the existing app tests green.

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo nextest run -p
yamt-app -p yamt-merge-requests` with the hermetic prefix; `just bindings` **locally only** to see the generated
names (do not commit `bindings.ts`; report the diff's new names); `just mutants HEAD`.

**Smoke** (the window does not call the commands yet): the `run_with_fakes` tests above run each command through
Tauri's `invoke` on the fake glab, which is the shell's end-to-end proof here. Then `scripts/local-conflicts-repo.sh
<scratch>/mtapp`, `cargo tauri build --debug --no-bundle`, `just app-session start-app --name mtapp --diff --dir
<scratch>/mtapp --glab mr-threads`: the merge-requests page lists !91 and !90 and the discussions box of !90 opens
(the new query answered); paste the fake glab log's `MergeRequestDiscussions` line; `just app-session stop mtapp`.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK41, RK53, RK54), `skill://verification`,
`skill://ipc-contract` (five commands; the window sends a checked id).
