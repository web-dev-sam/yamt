# Slice mr-fast-preview-remembered — GitLab's login and project asked once, forgotten when wrong (crate, shell, fake glab)

Feature: an instant comment preview, and GitLab's login and project asked once. Sources:

- Request `docs/slices/request-mr-fast-preview.md` part B (B1–B3) and the Rust acceptance "a second preview, a second
  thread read and a second write run no `auth status` and no project call (calls log); after a 401 the next action runs
  both again; Refresh runs both again; every failure reply keeps today's words".
- Design `docs/slices/briefs/mr-fast-preview-design.md` §1.4, §3.1 row #187, §3.2 RK75, §4.3–4.4.

Runs in round 1, beside `mr-fast-preview-corpus`, then beside `mr-fast-preview-local`. After it the orchestrator runs
`just bindings` (the new command) for `mr-fast-preview-panel`.

**Depends on an open question** (design open question 1, the anonymous read of a public project after `glab auth
logout`): build as written; if the owner asks for a check before every read, a later round adds it here.

## Target

**Owned:**

- `crates/merge-requests/src/project.rs`, `crates/merge-requests/src/detect.rs`, `crates/merge-requests/src/lib.rs`
- the 13 callers: `crates/merge-requests/src/{description,discussions,job_log,links,list,markdown_preview,open,people_change,people_search,rerequest,resolve}.rs`,
  `crates/merge-requests/src/discussion_thread/{read,write}.rs`
- unit tests beside them: `crates/merge-requests/src/{discussions,discussion_thread,links,people_change,page,query,check,picture}/tests.rs`
  (only where the move changes an expectation)
- `crates/merge-requests/tests/**` (`remembered.rs` new; `fake_glab/mod.rs`; the existing files where call counts change)
- `crates/merge-requests/AGENTS.md`
- `scripts/fake-glab/glab`, `tests/glab/README.md`, `tests/glab/mr-remembered/**` (new scenario)
- `src-tauri/src/merge_requests.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/merge_requests/tests.rs`,
  `src-tauri/src/merge_requests/tests/**` (`remembered.rs` new), `src-tauri/AGENTS.md`

**Read-only:** everything else.

- `crates/merge-requests/src/description/tests.rs`, `crates/merge-requests/src/description/tests/**`,
  `frontend/fixtures/markdown/**`: `mr-fast-preview-corpus`'s.
- `crates/gitio/**`: used as it is (`Glab::auth_status`, `HttpAnswer.glab_line`).
- `crates/merge-requests/src/page.rs`: `NO_PROJECT` used as it is.
- `frontend/**`: `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- `docs/**`, `.omp/skills/**`: lines in `deviations_from_brief` (the docs keeper writes architecture and
  `ipc-contract`).

**Non-goals:** the range window's review send (keeps its own check, B3); pictures (they never asked the login); retrying
any call after a forget (RK54); a time limit on the memory; a check before every read (open question 1).

## Contract

Fixed; you may add, never change.

```rust
// project.rs

/// glab's last line for an HTTP 401 ends so (`tests/glab/README.md`; measured again in step 1).
const UNAUTHORIZED: &str = "(HTTP 401)";
/// GitLab's words for a project it does not find or the reader may not see (`tests/glab/README.md:73-75`).
const PROJECT_NOT_FOUND: &str = "404 Project Not Found";

#[derive(Clone)]
pub(crate) struct Project { /* unchanged fields */ }
pub(crate) enum NoProject { NotLoggedIn { detail: String }, Failed { message: String } } // unchanged, and its 13 From impls

/// The project glab named for a repository while logged in, kept for the app's run (plan §2 #187). Only this module
/// reads or writes it.
#[derive(Default)]
pub(crate) struct Remembered { project: Mutex<Option<Project>> }

/// Whether a failed call's words say the login is gone or the project is missing: they end `UNAUTHORIZED`, hold
/// `PROJECT_NOT_FOUND`, or are `page.rs` `NO_PROJECT`. A 403 is not (design §1.4).
fn is_lost(words: &str) -> bool;

impl GitLabRepository {
    /// The remembered project; else `glab auth status` (logged out → NotLoggedIn with glab's first line, failed →
    /// Failed) and `glab api projects/:fullpath`, remembered when found. The lock is held while asking, so actions
    /// started together ask once; a refusal is never remembered. One `tracing::info!` per ask (outcome only).
    pub(crate) fn logged_in_project(&self, glab: &Glab) -> Result<Project, NoProject>;

    /// Forgets the remembered project (waiting for an ask in flight): the next action asks glab both again. One
    /// `tracing::info!` with the reason (`refresh`, `login`, `project`).
    pub fn forget_project(&self);

    /// `words`: the failure an action is about to reply with, after the project was found — a read's `Failed`
    /// message, a write's `HttpAnswer::glab_line`, or `NO_PROJECT`. When `is_lost(words)`: forgets, then one `glab auth
    /// status`; `Some(detail)` when it says logged out (the action replies `NotLoggedIn { detail }`), else None (the
    /// action replies as today). Not lost → None, nothing forgotten, no glab run. Never repeats the action's call (RK54).
    pub(crate) fn logged_out_after(&self, glab: &Glab, words: &str) -> Option<String>;
}

// detect.rs: `GitLabRepository` gains `pub(crate) remembered: Remembered` (built `Remembered::default()` by
// `gitlab_repository`). The free `logged_in_project(glab, root)` is deleted; no caller keeps a path around the memory.
```

- **Each of the 13 actions** calls `repository.logged_in_project(glab)` where it called the free function, and applies
  `logged_out_after` exactly once, to the failure it replies with (design §1.4): `list_merge_requests` its `ListEnd::
  Failed`; `read_description` and `read_links` the description fetch's failure (`NO_PROJECT` included) and the links
  lookup's; `read_discussions` the batch's one failure, before it fans out to the rows; `read_job_log` its glab
  failure (a missing job's `(HTTP 404)` without "Project Not Found" stays as today); `search_people`, `change_people`,
  `rerequest_review`, `prepare_open`, `prepare_resolve` their GitLab call's failure; `read_discussion_thread` the
  discussions query's and the draft notes' failure; the three writes `replied`'s answer: `glab_line` of a non-2xx
  answer (`HttpCall::NotAnswered(message)` → `message`); `preview_markdown` the post's failure. `Some(detail)` →
  that reply's `NotLoggedIn { detail }`; None → the reply exactly as today.

```rust
// src-tauri/src/merge_requests.rs

/// The page's Refresh (plan §2 #187): the next GitLab action asks glab for the login and the project again; no
/// GitLab project → nothing to forget.
#[tauri::command]
#[specta::specta]
pub(crate) async fn ask_gitlab_again<R: Runtime>(window: WebviewWindow<R>) -> Result<(), IpcError>;
// blocking_reply (forgetting waits for an ask in flight); registered in commands.rs after find_gitlab_project as
// `merge_requests::ask_gitlab_again::<tauri::Wry>`; the bindings get `askGitlabAgain()` → `typedError<null, IpcError>`.
```

**Fake glab** (`scripts/fake-glab/glab`, documented in `tests/glab/README.md`'s file table and a scenario line):

- `auth-status.after-post-<k>.out` / `.exit`: once the state file counts n posts, the largest k ≤ n for which either
  file exists replaces `auth-status.out` / `.exit` (a missing one of the pair: no output / exit 0). Without such files
  `auth status` answers as today.
- `api-status.after-post-<k>`: for the largest k ≤ n with such a file — holding a status line (`401 Unauthorized`): every
  `glab api` call (any method or endpoint) answers that status with the body `{"message":"<status line>"}`, glab's
  stderr line `glab: <status line> (HTTP <code>)` and exit 1 (with `--include`, the status line and headers first, as
  for any HTTP error), and counts no post; an empty file: answers as usual. Without such files nothing changes.

**Scenario `tests/glab/mr-remembered/`**: logged in (`auth-status.out` as `mr-threads/`'s), `project.json` as
`mr-threads/`'s, `markdown.json` (a one-paragraph preview), and the `after-post` files your tests need (for example: 1 →
api `401 Unauthorized` and auth logged out as `logged-out/auth-status.out`, exit 1; 2 → api normal, auth logged in; 3 →
api `401 Unauthorized`; 4 → api `404 Project Not Found`; 5 → api `403 Forbidden`; a `graphql-description-<iid>` answer
with `project: null` at a later k). Document each k in the README's scenario list.

## Change

1. **Measure** on gitlab.com (`glab` is logged in here; an invalid token writes nothing), paste each command, its
   stderr and exit status into `smoke_evidence`:
   - M1 `GITLAB_TOKEN=glpat-yamt-invalid-token glab api projects/samubr%2Fglab-yamt-playground; echo "exit $?"` — the
     401 line (expected `glab: 401 Unauthorized (HTTP 401)`, exit 1).
   - M2 `GITLAB_TOKEN=glpat-yamt-invalid-token glab api graphql -f query='query { currentUser { username } }'; echo "exit $?"`
     — a GraphQL call's 401 line.
   - M3 (for the open question, nothing depends on it) `h=$(mktemp -d); jq -n '{text:"x", gfm:true,
     project:"samubr/glab-yamt-playground"}' | HOME=$h XDG_CONFIG_HOME=$h glab api --method POST markdown --input -;
     echo "exit $?"` — whether a preview works without a login.
     If M1 or M2 does not end `(HTTP 401)`, `UNAUTHORIZED` follows the measured line and the fake prints that form;
     report it as a deviation.
2. `Remembered`, the three methods, `is_lost`, `Project: Clone`; `detect.rs`'s field; delete the free function.
3. The 13 actions (Contract); their doc comments name the remembered project instead of "`logged_in_project`" first.
4. The fake glab's two `after-post` forms; the README; the scenario.
5. The shell command and its registration; `MergeRequestState`'s doc comment names it.
6. `crates/merge-requests/AGENTS.md` and `src-tauri/AGENTS.md`: the remembered project, what forgets it, the command.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests -p yamt-app`, hermetic prefix as `just test`), each named for the bug
it catches:

- `is_lost_reads_glabs_words` (unit, `project.rs`): `glab: 401 Unauthorized (HTTP 401)` and the M1/M2 lines lost;
  `glab: 404 Project Not Found (HTTP 404)` lost; `NO_PROJECT` lost; `glab: 404 Not Found (HTTP 404)`,
  `glab: 403 Forbidden (HTTP 403)`, `glab timed out`, `""` not.
- `a_second_preview_thread_read_and_write_ask_glab_nothing` (`tests/remembered.rs`, scenario `mr-threads`): one
  repository; preview, preview, `read_discussion_thread`, `reply_to_discussion` (comment) → each answers as today; the
  calls log holds exactly one `argv: auth status` and one `argv: api projects/:fullpath`, and the preview's and the
  reply's calls once each — **owns B1**.
- `two_actions_started_together_ask_once`: two previews on one repository in `std::thread::scope` → one `auth status`,
  one `projects/:fullpath`.
- `a_401_forgets_and_answers_not_logged_in` (scenario `mr-remembered`): for **each** of the 13 actions (table-driven,
  a fresh fake per action): a preview remembers; `answered_posts(1)` (api 401, logged out); the action replies its
  `NotLoggedIn { detail }` with `logged-out`'s first line, the same words a logged-out first action gets today; the log
  holds the action's failed call once (a write's exactly once, RK54) and a second `auth status`; then
  `answered_posts(2)` (logged in again) and a preview logs `auth status` and `projects/:fullpath` again — **owns B2's
  "after a 401 the next action runs both again"**.
- `a_401_while_logged_in_keeps_todays_words`: api 401, logged in → the preview `Failed { "glab: 401 Unauthorized (HTTP
  401)" }`, a reply `Refused { "401 Unauthorized" }` (today's `replied` mapping), each followed by an action that asks
  both again — **owns B3**.
- `a_missing_project_forgets`: api `404 Project Not Found` → the preview's `Failed` with glab's line; GraphQL `project:
  null` → `read_description`'s `Failed { NO_PROJECT }`; each followed by an action that asks both again.
- `a_403_keeps_the_project`: api `403 Forbidden` → a reply `Refused { "403 Forbidden" }`; the next action logs no
  `auth status`.
- `refresh_asks_again` (`src-tauri/src/merge_requests/tests/remembered.rs`, through `invoke`, scenario `mr-threads`):
  `preview_markdown`, `ask_gitlab_again`, `preview_markdown` → two `auth status` and two `projects/:fullpath` lines;
  without `ask_gitlab_again` one — **owns "Refresh runs both again"** (the window's half: `mr-fast-preview-panel`).
- `ask_gitlab_again_without_a_project_does_nothing`: a folder with no GitLab remote → `Ok(null)`, no glab run.
- Every existing logged-out test (`tests/glab/logged-out/`) unchanged: a first action's `NotLoggedIn` words as before.
- `cargo nextest run -p yamt-gitio` green (the fake's `runner/` scenario unchanged).

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D
warnings`; the tests above; `just bindings` **locally only** to read the new binding's name (do not commit
`bindings.ts`; report it); `just arch-check`; `just mutants HEAD`.

**Smoke (real app, no window change yet):** `scripts/local-conflicts-repo.sh <scratch>/mfr`, `cargo tauri build --debug
--no-bundle`, `just app-session start-app --name mfr --diff --dir <scratch>/mfr --glab mr-threads --mr`: the page lists;
hover !90's discussions count (the box opens), open its description, Shift over d01 (the thread); then count the
session's fake glab log: exactly one `argv: auth status` and one `argv: api projects/:fullpath` for the whole session
(paste the `argv:` lines). `just app-session stop --name mfr`.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK54, RK69, RK71; RK75 proposed), `skill://verification`,
`skill://ipc-contract` (one command, no new type).
