# Slice MrConflictsAppR2 — fix round 2: a started merge window is claimed before the row's reply

Board "Merge-request conflicts" row 5. Rounds before: `a94e4af`, `5f42b69` (notes `.omp/run/notes/MrConflictsAppR1.md`).
Smoke pass `MrConflictsSmoke` (notes `.omp/run/notes/MrConflictsSmoke.md`, step 3.2). Fix exactly this
(`just findings 2036`):

1. **#2036** In the real app, right after "Resolve conflicts of !21" (and after "Continue merging !21") the row shows
   Continue enabled although the merge window is running: the page reads `find_local_merge` right after the reply,
   before the new window has taken its claim (`claim_window` in `outcome::startup`), so `windowOpen` is still false.
   Rule 9 wants it disabled ("Its merge window is already open") from the reply on. Fix on the Rust side, keeping the
   window lock the one source: after a successful window start, `resolve_merge_request` and `continue_merge_request`
   wait until `yamt_local_merge::window_is_open(root)` is true — polling every 50 ms, at most a bounded time (name it;
   about 5 s covers a cold start) — then reply as today. Timing out replies as today (logged); it never turns a reply
   into a failure. The wait is part of the injected-window composition so tests drive it: a recording start that takes
   a `WindowClaim` (claimed → no wait beyond the first probe), one that never claims (→ the bound, reply unchanged).
   The probe must not make the starting window's `claim_window` give up (design §4.2, RK47; `window_is_open` already
   releases at once).

## Target

Owned: `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`. Read-only: everything else. No contract
change: `just bindings-check` byte-identical.

## Acceptance

- A test fails on round 1's code (a reply before the claim, read by a following `find_local_merge` as `windowOpen:
  false`); say how you checked.
- `cargo nextest run -p yamt-app` (hermetic prefix), `cargo clippy -p yamt-app --all-targets -- -D warnings`,
  `cargo fmt --check`, `just bindings-check`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK47), `skill://verification`.
