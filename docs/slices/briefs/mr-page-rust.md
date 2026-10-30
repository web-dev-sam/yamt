# Slice MrPageRust — a merge request's GitLab page, offered and opened like a job's

Board "Merge-request row opens in the browser" row 1. Owner #1981: "in the MR list I want an entry to be clickable and
open the MR in the user's browser". Decision: `docs/plan.md` §2 #137 (read it; it amends #133, which you also read).
Base commit `88086cb`. The window side is the next slice (`MrPageWeb`); it starts from your committed patch and the
bindings the orchestrator regenerates from it.

Today a failed job's page is the only address yamt hands the system browser: `JobPage::built`
(`crates/merge-requests/src/job_page.rs:22`) checks it, `forward_page` (`src-tauri/src/merge_requests.rs:50`) records
every job page a list sent, `open_job_page` (`:134`) opens only a recorded one. The merge request's own page gets the
same path; one rule, two kinds of page.

## Target

Owned: `crates/merge-requests/**`, `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`,
`src-tauri/src/commands.rs`, `src-tauri/AGENTS.md`.
Read-only: everything else. `frontend/src/ipc/bindings.ts` is generated: never edit it; the orchestrator runs
`just bindings` after your patch. `tests/glab/**` and `scripts/fake-*` are read-only; if a scenario needs a change,
write it in `deviations_from_brief`.
Non-goals: anything under `frontend/`; links in threads, AI answers or Markdown (stay text, #112/#115); GraphQL query
changes (the address is built from what the crate already holds).

## Contract (fixed; you may add, never change)

In `yamt-merge-requests` (`lib.rs`, the same derives as today's `JobPage`/`JobOpened`):

```rust
/// The address of a page on the project's GitLab that this window may open in the browser: a failed job's log or
/// a merge request; only `WebPage::job` and `WebPage::merge_request` make one.
pub struct WebPage(String);            // replaces JobPage; `as_str(&self) -> &str` kept

impl WebPage {
    pub(crate) fn job(origin: &str, web_path: &str) -> Option<WebPage>;          // today's JobPage::built, unchanged rule
    pub(crate) fn merge_request(origin: &str, full_path: &str, iid: MergeRequestIid) -> Option<WebPage>;
    // = "<origin>/<full_path>/-/merge_requests/<iid>"; None unless origin passes the same https + authority check and
    //   full_path passes the same project-path check (no "..", the same allowed characters) as `job`
}

/// How asking to open a page ended.
pub enum PageOpened { Opened, NotOffered, Failed { message: String } }   // replaces JobOpened, same variants and serde

pub fn open_page(page: &WebPage) -> PageOpened;                           // replaces open_job_page, same behaviour

pub struct MergeRequestRow { /* every field as today, plus: */
    /// Its page on GitLab; `None` when GitLab is not on https.
    pub page: Option<WebPage>,
}
pub struct FailedJob { /* `page: Option<WebPage>`, otherwise as today */ }
```

In the app (`src-tauri/src/merge_requests.rs`):

- `MergeRequestState.job_pages` → `pages: Mutex<BTreeSet<WebPage>>`; `forward_page` records every row's `page` and
  every failed job's `page` before sending the page.
- Command `open_job_page` → `open_page(state, page: WebPage) -> PageOpened`: `NotOffered` (with the warning log) unless
  a list of this window sent `page`; registered in `commands.rs` in place of the old one. TS name becomes `openPage`.

Every old name (`JobPage`, `JobOpened`, `open_job_page`, `job_pages`, the `job_page` module if its name no longer fits,
log lines saying "job page" for both kinds) is gone after your patch: a clean rename, no alias. Doc comments on the
generated types are read by the window's developers: keep them true for both kinds of page.

## Change

1. Rename in the crate and the app; split the address check so `job` and `merge_request` share the origin and
   project-path checks (one rule, vision 2).
2. Build each row's `page` where rows are parsed (`page.rs`, which already receives the origin; it also needs the
   project's full path, which `list.rs` holds as `project.full_path`).
3. `forward_page` records rows' pages too.
4. Tests (`skill://rust-conventions`): the merge-request address for an https origin with a port and a nested group
   path; `None` for `http`, for a full path with `..` or a disallowed character; the existing job cases keep passing
   under the new names; in the app, a merge request's page a list sent reaches the fake opener, and one no list sent
   answers `NotOffered` (extend the existing `through_glab` opener tests in `src-tauri/src/merge_requests/tests.rs`,
   which run `scripts/fake-open` first on PATH).
5. `crates/merge-requests/AGENTS.md` and `src-tauri/AGENTS.md`: the lines naming the old types and command now name
   the new ones.

## Acceptance

- `cargo nextest run -p yamt-merge-requests` and the app's `merge_requests::` tests pass (paste the summaries),
  including the new tests named above.
- `just clippy` and `cargo fmt --all --check` clean.
- `just bindings` in your workspace produces a `bindings.ts` with `openPage: (page: WebPage) => … PageOpened`,
  `MergeRequestRow.page: WebPage | null`, and no `JobPage`/`JobOpened`/`openJobPage` (paste the grep; do not include
  the file in your patch).
- `grep -rn "JobPage\|JobOpened\|open_job_page\|job_pages" crates src-tauri` → nothing.
- `just mutants HEAD` per SP11.

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (grep it for "job page"),
`skill://verification`.
