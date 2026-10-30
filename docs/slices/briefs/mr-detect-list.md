# Slice MrDetectList — offline GitLab detection and the merge-request list (Rust, no commands yet)

Board "Merge requests" row 2 (R1 · B1). Rules: `docs/slices/request-merge-requests.md` (rules 1, 3, 4, 5, 8;
facts and risks), `docs/plan.md` §2 #128–#135. Design (option A, chosen): `.omp/run/notes/MrOverviewDesign.md` —
§1 facts, §2.1 the IPC types, §2.2 Rust (crate table, the list query, its score, gitio), §5 "R1 · B1", §6 "B1 → B3"
and "Fake glab (B1 …)", §7 Rust rows for detect/page/list/tests/list/gitio. Those sections are given; build them as
written. The root `Cargo.toml` already lists `crates/merge-requests` and `yamt-merge-requests` (orchestrator).

## Target

Owned: `crates/merge-requests/**`, `crates/gitio/src/{glab.rs,names.rs,lib.rs}`, `crates/gitio/tests/glab.rs`,
`crates/review/src/{glab_answer.rs,send.rs,lib.rs}`, `scripts/arch-check.sh`, `scripts/fake-glab/glab`,
`tests/glab/README.md`, `tests/glab/merge-requests/**`, `tests/glab/merge-requests-timeout/**`.

Read-only: everything else. `docs/architecture.md` and the project map are not yours (updated once at the feature's
end); put the lines they need in `deviations_from_brief`.

Non-goals (next build, B3): `open.rs`, `remote.rs`, `fetch.rs`, `open_job_page`, `OpenReply`, `JobOpened`,
`RangeToOpen`, every `src-tauri` file, the commands, `bindings.ts`, `range-repo.sh`, the scenario files for opening
(`graphql-merge-request-*.json`, REST `merge-requests.json`, `merge-request-13.json`).

## Contract

Fixed: design §6 "B1 → B3 (crate API)" exactly, the IPC types of §2.1 that the list uses (`GitLabProject`,
`MergeRequestIid`, `Person`, `CiStatus` with its mapping, `JobPage`, `FailedJob`, `Pipeline`, `MergeRequestRow`,
`MergeRequestPage`, `ListEnd`) with `yamt_review::NotLinedUp`'s serde/specta attributes, and the fake glab's routes
and scenario `merge-requests/` + `merge-requests-timeout/` of §6. B3 builds on these names; adding is fine.

## Change

1. gitio: `Glab::get`, `Glab::auth_status` + `AuthStatus`, `first_line`/`last_line`/`TIMED_OUT` public; `Repo::remote_urls`
   - `RemoteUrl` (§2.2 "gitio (B1)"). Review's `glab_answer.rs` / `send.rs` call them: a clean cutover, no second copy;
     review's existing tests stay unchanged and green.
2. Crate `yamt-merge-requests` (`Cargo.toml`, `AGENTS.md` like the other crates', `lib.rs`, `detect.rs`, `project.rs`,
   `query.rs`, `page.rs`, `list.rs`, `job_page.rs` holding only `JobPage::built`), per §2.2's table and query.
   `queryComplexity` logged at info once per load.
3. `scripts/arch-check.sh`: the crate's own rule (only `yamt-(merge-requests|range|gitio|merge-core)`), and
   `merge-requests` in yamt-app's allowed list.
4. Fake glab: field recording, POST on fields, the `projects/:fullpath` and GraphQL routes with `.sleep/.exit/.err`;
   the two scenarios; `tests/glab/README.md` documents them. Every existing scenario keeps answering as before.

## Acceptance

- The tests of design §7 for this build: `detect.rs`, `page.rs`, `list.rs` units; `tests/list.rs` against the fake glab
  (exact argv `-f fullPath=taskboard/taskboard -F first=100`, then `-f after=page-2`; working folder; env; logged out
  → `NotLoggedIn`; no glab → `GlabMissing`; timeout scenario → `Failed("glab timed out")` or the crate's timeout
  sentence); gitio `get`/`auth_status`/`remote_urls`; `cargo test -p yamt-review` unchanged and green.
- `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`,
  `scripts/arch-check.sh` pass (paste the summary lines).
- `just mutants HEAD` run in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (grep RK rows on glab and git subprocesses), `skill://verification`.
