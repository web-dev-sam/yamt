# Slice comment-queue-rust — send one queued message to GitLab

Request `docs/slices/request-comment-queue.md` rule 3; plan §2 **#198** (read it whole), which amends #118 (read
#117–#119 for the send's rules). Base: main at spawn.

Facts (given):

- `crates/review/src/send.rs`: `pub fn send_queue(range, glab, threads, progress) -> Result<SendReply>` checks
  `lined_up` again, then `post_queue` snapshots `store.queued(range)` and `store.pending_draft_notes()`, lists the
  user's GitLab drafts once (`draft_notes`/`draft_notes_from`, `unowned`), and runs `send_one` per message with a
  `Tally` (`done`/`of`/`sent`/`refused`; `stopped`/`sent` build the reply). Re-exported in `crates/review/src/lib.rs:21`.
- `src-tauri/src/review.rs:152` `send_queue` command: `blocking_reply`, `send_guard(&state.sending)` (answers
  `SendRunning` while another send holds it), `forward_progress`, `Glab::find()`. Registered in
  `src-tauri/src/commands.rs:71`. Tests: `crates/review/tests/review.rs` (fake glab, `send_queue` at :208, :635),
  `src-tauri/src/review/tests.rs` (:154 a second send answers `SendRunning`).
- `SendReply` = `NotLinedUp { why }` | `Sent { list, sent, refused }` | `Stopped { list, sent, refused, reason }`.

## Target

Owned: `crates/review/src/send.rs`, `crates/review/src/lib.rs`, `crates/review/tests/review.rs`,
`src-tauri/src/review.rs`, `src-tauri/src/review/tests.rs`, `src-tauri/src/commands.rs`.

Read-only: everything else (`crates/review/src/thread_store.rs` included; a needed store change goes to
`deviations_from_brief`). `frontend/src/ipc/bindings.ts` is generated: the orchestrator runs `just bindings` after
your patch. Docs are the orchestrator's: needed lines in `deviations_from_brief`.

Non-goals: any change to `send_queue`'s behaviour or signature; adding or queueing (the frontend chains the existing
`add_thread`/`add_note` → `queue_message` → `send_message`); any frontend file.

## Contract (fixed; you may add, never change)

```rust
// crates/review/src/send.rs, re-exported from lib.rs beside send_queue
pub fn send_message(
    range: &Range,
    glab: Option<&Glab>,
    threads: &Mutex<ThreadStore>,
    message: MessageId,
    progress: &dyn Fn(SendProgress),
) -> Result<SendReply>;

// src-tauri/src/review.rs, registered in commands.rs right after send_queue
#[tauri::command]
#[specta::specta]
pub(crate) async fn send_message<R: Runtime>(
    window: WebviewWindow<R>,
    message: MessageId,
    progress: Channel<SendProgress>,
) -> Result<SendReply, IpcError>;
```

## Change

1. `send_message` is `send_queue` restricted to one message: the same glab-missing and `lined_up` answers
   (`NotLinedUp`), the same draft listing and matching, `send_one`, refusal kept queued, stop reasons, progress. One
   path, not a copy: `send_queue` and `send_message` share `post_queue` (e.g. it takes which messages to send); the
   growth question is "a copied rule".
2. An id the store does not know → the store's existing unknown-message error, before any glab call. A known message
   that does not wait (a note not queued, a pending one) → `Sent { sent: 0, refused: 0 }` with the current list and
   no glab call after the check. `of` in progress is the number of messages this send covers (1 or 0).
3. Every other queued message stays exactly as it was (queued, refused) — the core rule of #198.
4. The command holds the same `send_guard` as `send_queue`: while either runs, the other answers `SendRunning`.

## Acceptance

- `crates/review/tests/review.rs`: with two queued messages, `send_message` posts only the named one (pending, the
  fake glab saw one draft POST), the other stays queued; a refusal leaves it refused-queued; a stop (e.g. 5xx) gives
  `Stopped` with it still queued; an existing unowned GitLab draft with its text is taken instead of posting again;
  not lined up / no glab → `NotLinedUp`; unknown id → the error, no glab call; a note not queued → `Sent` 0/0.
- `src-tauri/src/review/tests.rs`: `send_message` while a send runs → `SendRunning` (both directions if cheap).
- `cargo test -p yamt-review`, `cargo test -p yamt` (the src-tauri crate; name per its Cargo.toml), `cargo clippy
  --workspace --all-targets -- -D warnings`, `cargo fmt --check`; `just mutants HEAD` with survivors on changed lines
  killed or kept with a reason.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://verification` (plus your autoloaded ones).
