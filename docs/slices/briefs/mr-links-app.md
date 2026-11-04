# Slice mr-links-app — the `read_links` command and its offered pages

Feature: a merge request's epics, issues and commits, one hover away. Sources:

- Request `docs/slices/request-mr-links.md`: rules 3, 4, 6 (each line and parent opens its page) and the Rust
  acceptance.
- Design `docs/slices/briefs/mr-links-design.md` option A, §1.6.
- Proposed plan §2 #175; RK41 (amended).

Runs in wave 2, after `mr-links-rust` is committed. The orchestrator runs `just bindings` after this slice.

## Target

**Owned:**

- `src-tauri/src/merge_requests/links.rs` (new)
- `src-tauri/src/merge_requests.rs` (the `mod links;` line and nothing else)
- `src-tauri/src/commands.rs` (the one registration line)
- `src-tauri/src/merge_requests/tests.rs` (the `mod links;` line)
- `src-tauri/src/merge_requests/tests/links.rs` (new)

**Read-only:** everything else.

- `crates/merge-requests/**`: `mr-links-rust`'s; use `read_links`, `ReadLinks`, `LinksReply` as contracted.
- `tests/glab/mr-links/**`: the scenario as recorded (its README paragraph names every row).
- `frontend/src/ipc/bindings.ts`: the orchestrator's `just bindings` (PM4).
- `src-tauri/AGENTS.md`, `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** any change to `open_page`, `offer`, `MergeRequestState` or the picture scheme; the window.

## Contract

Given (`mr-links-rust`): `yamt_merge_requests::{read_links, ReadLinks, LinksReply}` and the reply types.

Fixed here:

```rust
// src-tauri/src/merge_requests/links.rs — the description's command is the model (`merge_requests/description.rs`)
/// No GitLab project → `Failed` with `NO_PROJECT`; else glab reads the links, and every line's and parent's page is
/// offered (`offer`, no pictures) before the reply is returned; never holds `pages` while glab runs.
pub(super) fn links_reply(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid) -> LinksReply;

#[tauri::command]
#[specta::specta]
pub(crate) async fn read_links<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid)
    -> Result<LinksReply, IpcError>;   // blocking_reply(move || Ok(links_reply(&window.state(), Glab::find().as_ref(), iid)))
```

- `commands.rs`: `merge_requests::links::read_links::<tauri::Wry>,` after `read_description` (`commands.rs:88`), so
  `commands.readLinks(iid)` is generated.
- The command stays ≤ 15 lines (IPC5); `links_reply` holds the only logic, as `description_reply` does
  (`merge_requests/description.rs:9-22`).

## Change

1. `merge_requests/links.rs`, the `mod` line, the registration.
2. `merge_requests/tests/links.rs` over the `mr-links` scenario, with `through_glab`'s helpers as
   `tests/description.rs` uses them (`run_with_fakes`, `open`, `opened_log`, `log_after`).

## Acceptance

**Tests** (`cargo nextest run -p yamt-app`), each named for the bug it catches:

- `a_line_and_a_parent_page_are_offered_before_the_reply` (RK41): before `read_links(62)`, `open` of
  `https://gitlab.example/taskboard/taskboard/-/work_items/12` (the `#12` line) and
  `https://gitlab.example/groups/taskboard/-/work_items/3` (its parent) answer `notOffered`; after it, both `opened`,
  each reaching the fake opener once (skip the opener part on macOS, as `tests/description.rs:73-77`).
- `a_page_the_links_reply_did_not_name_is_not_offered` (RK41): after `read_links(62)`,
  `https://evil.example/groups/x/-/work_items/1` (`web#6`'s parent on another host),
  `https://gitlab.example/taskboard/taskboard/-/milestones/1` and `https://gitlab.other/x/y/-/issues/1` answer
  `notOffered`; the opener log is empty.
- `an_unseen_things_address_is_offered` (rule 6): after `read_links(62)`,
  `https://gitlab.example/secret/vault/-/issues/9` opens.
- `no_gitlab_project_fails_the_read` (as `tests/description.rs:212-222`).
- `read_links_answers_through_the_command` (the command's JSON for !62 has `kind: "read"` and its three groups'
  lengths 3, 6, 4; for !60 `kind: "failed"` with "glab: a deadline line").

**Commands:** `cargo fmt --check`, `cargo clippy -p yamt-app --all-targets -- -D warnings`, `cargo nextest run -p
yamt-app`, `just bindings-check` reporting only the expected difference (the new types and `readLinks`; the
orchestrator regenerates): their summary lines. `just mutants HEAD` in your workspace (SP11).

**Smoke:** none beyond the tests (the window does not call it until `mr-links-state`).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK41 amended), `skill://verification`.
