# Slice MrOpenCommands — the four commands, opening an MR's changes, the job-page opener, the second window

Board "Merge requests" row 4 (R2 · B3). Rules: `docs/slices/request-merge-requests.md` (rules 1, 5, 7, 8, 9; "Reopens";
risks "Fetching", "Starting a second yamt", "Opening a browser"), `docs/plan.md` §2 #128–#135. Design (option A,
chosen): `.omp/run/notes/MrOverviewDesign.md` — §1 facts and I3–I7, §2.1 `OpenReply`/`JobOpened`/`RangeToOpen`, §2.2
`open.rs`, `remote.rs`, `job_page.rs`, "Opening an MR's changes" steps 1–6, "src-tauri (B3)", "Opener choice", §5
"R2 · B3", §6 "Fake glab (… extended by B3)", "B3 → B4 and B5", "B3 → B5 (real-app repository)", §7 Rust rows for
remote/fetch/open/src-tauri/range_window. Those sections are given; build them as written. Round 1 (`MrDetectList`,
notes `.omp/run/notes/MrDetectList.md`) built the crate's list side, the gitio glab helpers and the fake glab's GraphQL
routes; build on what is committed.

## Target

Owned: `crates/merge-requests/**`, `crates/gitio/src/{fetch.rs,lib.rs}`, `crates/gitio/tests/fetch.rs`,
`src-tauri/Cargo.toml`, `src-tauri/src/{merge_requests.rs,range_window.rs,appimage.rs,window.rs,compare.rs,range.rs,commands.rs,lib.rs}`,
`src-tauri/src/merge_requests/**`, `scripts/range-repo.sh`, `scripts/fake-open/**`, `scripts/fake-glab/glab`,
`tests/glab/README.md`, `tests/glab/merge-requests/**`.

Read-only: everything else. `frontend/src/ipc/bindings.ts` is generated: the orchestrator runs `just bindings` after
your patch. `docs/architecture.md`, the IPC-contract and risk-register skills and the project map are not yours:
put the lines they need (§3.5 commands, the #94 change, the second process; RK40–RK42 of design §9) in
`deviations_from_brief`.

Non-goals: every frontend file; `tauri-plugin-opener` or any new dependency (DR3: std's `Command`); capability or CSP
changes; `--ai` on the second window; naming the MR in the new window.

## Contract

Fixed: design §6 "B3 → B4 and B5 (generated bindings)" exactly — the four commands' names, arguments and results, the
TS type names and their fields, all tagged `kind` with camelCase variants; "B3 → B5 (real-app repository)" exactly
(`range-repo.sh` fake GitLab with `refs/merge-requests/12/head` and `13/head`, `MR13_HEAD` absent from `<dir>`,
`origin` + `insteadOf`, `scripts/fake-open/xdg-open` logging). Round 1's crate API (§6 "B1 → B3") is fixed; adding is
fine. Every existing user of `scripts/range-repo.sh` (crate tests, app-session, smoke recipes) keeps working.

## Change

1. gitio `fetch.rs`: `Repo::fetch_without_refs` with the flags, environment, closed stdin and 120 s deadline of §2.2
   step 3; failures as values with git's last stderr line.
2. Crate: `remote.rs`, `open.rs` (`prepare_open`, steps 1–6), `job_page.rs` `open_job_page`, the open-side IPC types.
3. src-tauri: `merge_requests.rs` (state, `manage`, the four commands; `job_pages` filled before a page is forwarded;
   `NotOffered` for any other address), `range_window.rs` (`program`, args, detached child, reaper thread),
   `appimage.rs` `running_appimage`, managed state for the compare window (start folder; `OWD` under an AppImage)
   and the range window (`range.root()`), commands registered once.
4. `range-repo.sh`, `scripts/fake-open/xdg-open`, the opening scenario files and fake-glab routes of §6.

## Acceptance

- The tests of design §7 for this build: `remote.rs` units; `tests/fetch.rs` (commit present after; refs, status,
  index hash, HEAD unchanged, no FETCH_HEAD; a dead `https://127.0.0.1:1/x` fails before the deadline); `tests/open.rs`
  (!13 fetched then `<base>..MR13_HEAD` and `yamt_review::check_gitlab` gives `LinedUp`; !12 with `insteadOf` removed
  opens without fetching; held `PairLock` → `AlreadyOpen`; null diff refs → `Preparing`; no matching remote →
  `NoRemote`); `src-tauri` `merge_requests/tests.rs` (pages on the Channel before the end; an address never handed out
  → `NotOffered`; a handed-out one runs the fake `xdg-open` with exactly that URL); `program` and `running_appimage`
  units.
- `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`,
  `scripts/arch-check.sh` pass; `cargo run -q -p yamt-app --features bindings --bin export-bindings --
  target/bindings-check.ts` succeeds; paste the four `commands.*` signatures from it.
- Real app, private display (`skill://verification`): a range window on `scripts/range-repo.sh` with the fake glab
  scenario `merge-requests` (fake glab and fake opener first on PATH): calling `openMergeRequest(13)` from the page's
  console starts a child `yamt --diff=<base>..<MR13_HEAD> --repo <dir>` (`/proc`), the child's window opens, and a
  second call answers `alreadyOpen`. If the app-session tool cannot reach this before B5's tooling, say so in
  `acceptance_not_run` with what you ran instead.
- `just mutants HEAD` run in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (grep rows on git subprocesses, glab,
process start), `skill://verification`.
