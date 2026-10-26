**Verdict: pass.** I found nothing at block level. There are 3 `should` findings and 2 nits, listed below. Gates were not run (RV6): `just map-check` (finding 3) and RS6's 400-line file limit (finding 2) are judged by reading only.

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "docs/plan.md",
      "line": 149,
      "rule_id": "DR5",
      "problem": "Row #117 says the shell's range state gains `Mutex<ThreadStore>` and a send guard, \"taken in that order\". Read literally, threads come first, but the code takes `sending` first with `try_lock` and locks `threads` only between glab calls. The code is the design's rule (ThreadsDesign option A \"Shell\": sending, then threads inside it, \"always in that order\"), and src-tauri/src/range.rs:16-17 and src-tauri/AGENTS.md say so too. The decision record and the code now give opposite orders for one lock rule. A later slice that follows the row could hold `threads` across a whole send, which blocks every thread command while glab runs, or nest the two mutexes the other way round.",
      "fix": "The orchestrator rewords row #117 to \"the send guard (try_lock, held for the whole send), then `Mutex<ThreadStore>` only between glab calls\". The implementer already flagged this in deviations_from_brief, as DR5 asks."
    },
    {
      "severity": "should",
      "file": "src-tauri/src/review.rs",
      "line": 253,
      "rule_id": "RS11",
      "problem": "The tests for `From<yamt_review::Error> for IpcError` (`review_json`, `each_review_error_has_its_kind_and_a_write_failure_names_the_file`, `a_start_only_review_error_is_its_line`) live in review.rs. The mapping itself is in ipc_error.rs:186. The mapping tests for session, settings, compare, range and ai are all in ipc_error.rs:215+. The tests were moved only to dodge the 400-line limit, and ipc_error.rs is over it anyway: 417 lines at the patch, 468 now (RS6). As it stands, whoever adds the next error mapping finds two homes for these tests, and the file-length rule stays broken.",
      "fix": "Move ipc_error.rs's `mod tests` into `src-tauri/src/ipc_error/tests.rs`, following the `merge/tests.rs` precedent. Put the three review mapping tests there next to `range_json`, so review.rs keeps only tests of its commands."
    },
    {
      "severity": "should",
      "file": "docs/architecture.md",
      "line": 436,
      "rule_id": "PM6",
      "problem": "Several docs do not name what this patch added: (a) the seven commands, `list_threads`…`send_queue`, are in neither architecture.md nor ipc-contract's command list; (b) IPC4's variant list lacks the five new `IpcError` kinds; (c) the state-ownership table has no row for `RangeState.threads`/`sending`; (d) RS5 in rust-conventions still says \"two Mutexes … never held together\", although #117 amended it. map-check.sh:24-28 requires every `#[tauri::command]` to be named in both docs, so `just map-check` will fail inside `just check` (`open_range`/`load_range_file` already fail it). Until this is fixed, nothing written down says who owns the thread store.",
      "fix": "Before the verifier runs, the orchestrator syncs: architecture.md (range/review window paragraph, the IpcError line, a §5.1 row 'review threads and the send guard → `RangeState.threads: Mutex<ThreadStore>` (written through review.rs commands and `yamt_review::send_queue` only) and `sending`'), the ipc-contract command list and IPC4, project-map's src-tauri line (range.rs, review.rs), and RS5's text per #117."
    },
    {
      "severity": "nit",
      "file": "src-tauri/src/review.rs",
      "line": 14,
      "rule_id": "RS16",
      "problem": "The poison-tolerant lock helper is called `locked` here. Every other shell module calls it `lock` (ai.rs:35, compare.rs:17, merge.rs:57, servers.rs:16), so a grep for the shell's lock helpers misses this one. Nothing else gets harder.",
      "fix": "Rename `locked` to `lock`, as in the sibling modules."
    },
    {
      "severity": "nit",
      "file": "src-tauri/src/review.rs",
      "line": 38,
      "rule_id": "R-open-1",
      "problem": "The `#[expect(clippy::unnecessary_wraps)]` reason, \"every command answers a Result the window checks\" (copied from compare.rs:79), is untrue in this window: `open_range` (range.rs:78) answers a bare `RangeStart`. Nothing gets harder; the reason just misleads a reader.",
      "fix": "State the real reason, e.g. `reason = \"the thread commands share one Result shape the window's thread source handles alike\"`."
    }
  ],
  "checked": [
    "Contract: all seven signatures match the brief (`list_threads`/`add_thread`/`add_note`/`queue_message`/`unqueue_message` with `State<'_, RangeState>`; async `check_gitlab(window)` and `send_queue(window, progress: Channel<SendProgress>)` on `blocking_reply`, a panic → `WorkerStopped`). The regenerated bindings.ts:44-50 have `listThreads`…`sendQueue(progress: Channel<SendProgress>)`, and bindings.ts:278 has the five new IpcError kinds.",
    "IpcError gains exactly `UnknownThread{thread}`, `UnknownMessage{message}`, `EmptyMessage`, `MessagePending{message}`, `SendRunning` (ipc_error.rs:53-63). `From<yamt_review::Error>` is exhaustive with no wildcard (RS9). `WriteFailed` reuses the existing variant. The start-only `ReadFailed`/`Broken`/`NewerFormat` map to `Git{message}`, as yamt_range's do, per the brief and design §7.",
    "PM1: src-tauri's Cargo.toml has `yamt-review.workspace = true` and no yamt-gitio. arch-check.sh:58-63 and :75 list yamt-review for both the review crate and yamt-app. The `pub use yamt_gitio::Glab` re-export (crates/review/src/lib.rs:25) is the option the brief offered; it is the only gitio type the shell names (accepted deviation).",
    "Ownership: the patch touches only the brief's Owned files plus src-tauri/src/lib.rs (`mod review;`) and crates/review/src/lib.rs (one re-export). Both were granted by Main and listed in deviations_from_brief (accepted).",
    "State: `threads` is written only through `ThreadStore` methods, called from review.rs commands and `yamt_review::send_queue` (send.rs:47-75 locks it only between glab calls through its own `locked`). `sending` is taken only by `send_guard` (`try_lock`, `WouldBlock` → `SendRunning`, poison recovered like every other shell lock). No lock is held across glab. Lock order guard → threads matches ThreadsDesign option A; that cannot deadlock because the guard is never waited for.",
    "Before any window: `manage_range_in` (range.rs:42-63) opens `ThreadStore` after `PairLock::take` and listing, and before `ai::manage`/`app.manage`. window.rs:105-113 returns `Ending::failure` before `WebviewWindowBuilder` (window.rs:133), so a broken/newer/unreadable file gives one `yamt:` line and exit 2 (#117, #120).",
    "`unlisted_paths` is logged once with `tracing::warn!` when non-empty (range.rs:53-56), as the contract asks.",
    "Commands are thin (IPC5): each sync command is one lock plus one `ThreadStore` call plus `?`. The async ones call one `yamt_review` function on the worker; `Glab::find()` per call is the documented deviation (picks up a glab installed later; accepted).",
    "The tauri-macros comment above `check_gitlab` (review.rs:88-89) is CP1 with a source, and the same line already sits in ai.rs, commands.rs, compare.rs and range.rs (existing convention).",
    "Test-support visibility (`pub(crate) mod tests`, `RangeWindow` fields, `open_range_window`) follows the `frontend_log::tests::logged` precedent. AGENTS.md describes it, and review.rs/ai.rs reuse the mock window.",
    "`#[expect(clippy::too_many_lines)]` on `specta_builder` has a reason and is a flat command list, not logic (RS6: split by responsibility, not count; accepted).",
    "Growth check: review.rs has one job (the thread and GitLab commands, plus the guard and progress forwarding they need, each with one caller and a test). range.rs's start-up assembly gains the store open and the unlisted-path log, both part of making RangeState. No new frontend edges. No second copy of a thread rule in the shell: validation and posting rules stay in yamt-review.",
    "src-tauri/AGENTS.md now has the range.rs threads open, the review.rs commands and the guard-then-threads order.",
    "Mutation run: `.omp/run/mutants/RVReviewShell.survivors.txt` reports no survivors; correctness lens not applied (boundary review)."
  ]
}
```