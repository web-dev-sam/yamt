## Design: the GitLab merge-request overview in the compare and range windows

I read the brief, the request (including your rewrite of rule 2), both scout notes, the skills it names, architecture §0/§3.2/§3.5/§3.8/§5.1/§5.4/§5.5, plan rows #94/#100/#101/#107/#112/#115/#117–#120, and the code at HEAD. I also read GitLab's GraphQL docs and source for the complexity rule, and glab's `api` docs. Nothing was edited and nothing was run.

**Answers in force:**
1. An MR's changes open in a **new window**.
2. The list is a **full page like Settings**.
3. Filters are **remembered per repository**.

Answer 2 is designed as you stated it; the rest of the design is unchanged.

### What the page form changes compared with a drop-down

- **Screen kind:** `ui/screen.ts` gains `{ kind: "mergeRequests" }`, beside `settings` and `serverLog`. Each root renders `<MergeRequestsView v-if="screen.kind === 'mergeRequests'">` in the grid cell where `SettingsView` sits. The views stay mounted but hidden, as for Settings.
- **Opening and closing:** the button in any view header opens the page. Back or Escape closes it.
  - Escape uses `ServerLogView.vue`'s rule: not when the press was already handled (an open checklist or CI box handles it first) and not while a question waits.
  - There is no outside click and no closing by the button. The headers holding the button and the gear are hidden while the page shows.
  - Showing a file (range) or picking or adding a tab (compare) also closes it; those calls already set `screen` back to `files`.
- **Focus:** Back gets the keyboard when the page opens (SettingsView and ServerLogView do this). On close, the keyboard returns to the element focused before, normally the button that opened it, if it is still connected and visible. This is `SettingsView.vue`'s `goBack` rule.
- **Which header holds Back and Refresh:** the page's own top row. Back sits at the left in Settings' place, then the heading "Merge requests", then Refresh at the right end. The filter row comes under it, then the summary, then the list, which scrolls inside the page.
- **Gone:** the 40rem width, right-aligning under the button, outside click and placement. The page is as wide as the window.
- **Unchanged:** the Assignee, Reviewer and Label checklists stay drop-downs inside the page, as rule 6 says.
- The acceptance line "opens and closes (Escape, outside click, button)" becomes "(Escape, Back)".

---

## 1. Facts I checked and inferences I rely on

**Checked:**
- **The glab runner** (`gitio/src/glab.rs:56-83`): it runs in the repository folder with a 20 s deadline and adds `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`.
- **glab's output to messages:** `review/src/glab_answer.rs:77-125` (`answer`, `first_line`, `last_line`). Logging in is checked by `send.rs:244-256`.
- **The page never receives a repository:** `RangeStart` has none.
- **The compare window manages only `TabStore`** (`window.rs:89-92`, `compare.rs:23-28`).
- **Commands are registered once for every window** (`commands.rs:15-71`).
- **yamt-app may depend on gitio or merge-core only indirectly** (`scripts/arch-check.sh`: the app's allowed list).
- **Pair locks:** `PairLock::take` refuses with `Error::Locked`, and the lock is dropped with the value (`range/src/lock.rs:24-46`).
- **`Resolved::resolve`** runs `rev-parse --verify` on each side.
- **Opened ranges line up through the commit route:** a range whose right side is a commit id is matched to its MR by that commit (`send.rs:232-242`), and two dots keep `left` as typed. So `<base_sha>..<head_sha>` passes #119 when GitLab's `base_sha` and `head_sha` are those two commits.
- **map-check** reads `src-tauri/src/*.rs` (top level only) and the four source interfaces it lists (`scripts/map-check.sh`).
- **Reusable UI pieces:** `useDropdownMenu` does not close on an item click, and its Escape and Tab call `preventDefault`. `ChoiceButtons.vue` is the generic pressed-choice group.
- **Colour tokens exist for every CI state:** `--color-success-signal`, `--color-problem-error`, `--color-problem-warning`, `--color-info-border`, `--color-fg-muted` (`style.css:44-57`).
- **The fake glab** skips the value of `-f`/`-F` and answers only REST routes (`scripts/fake-glab/glab`).
- **app-session stops processes by process group** (`processes.ts:97-121`).
- **`range-repo.sh` has no remote.**
- **`RECHECK_PAUSE_MS`** is defined in `rangeGitLab.ts:77` and used only there and in its test.
- **GitLab's complexity rule**, from GitLab master source (`types/base_field.rb`, `resolvers/base_resolver.rb`, `merge_request_type.rb`, `ci/pipeline_type.rb`, `ci/jobs_resolver.rb`):
  - A plain field costs 1 plus its children.
  - A field with an explicit complexity costs that number plus its children: `labels`, `assignees` and `reviewers` are 5.
  - A field with a resolver costs its children plus the resolver's 1 (+1 when `sort` is given), and a connection with a resolver then adds `cost × min(first, 100) × 0.01`.
  - The page size is 100, the limit 250 when logged in, the request timeout 30 s (GitLab docs 19.6, "Limits").
  - `retried: false` selects only the latest run of each job (`jobs.latest`).
- **glab api docs (19.6):** every field other than `query` is a GraphQL variable. glab uses "the GitLab authenticated host in the current directory". `--paginate` needs `$endCursor`.

**`[INFERENCE]` lines this design relies on:**
- **I1 — field ages.** No field of the query carries an "Introduced in" note in the 19.6 reference, so each predates the notes kept. I could not check first versions. If a field is missing, the whole query is refused with GitLab's message, which shows as one sentence with Retry. The owner's check records his GitLab version.
- **I2 — WebKit storage.** WebKit's localStorage is shared by every yamt process (`rangeStore.test.ts`'s shared-key note). Two windows open at once may overwrite each other's filter writes; the last write wins.
- **I3 — the opener programs.** `xdg-open` (Linux, found on PATH), `/usr/bin/open` (macOS) and `rundll32 url.dll,FileProtocolHandler <url>` (Windows) open an https address in the default browser. Only Linux can be exercised here.
- **I4 — the second process.** Starting `current_exe()` directly makes a second yamt on macOS (`.app/Contents/MacOS/yamt`), Windows and `.deb`. Under an AppImage it must be `$APPIMAGE`: the mount the running binary lives in goes away when the first process ends. A Unix child in its own process group survives the terminal closing because the shell does not know it as a job.
- **I5 — no ssh prompt.** With `SSH_ASKPASS_REQUIRE=force` and `SSH_ASKPASS=false`, OpenSSH (8.4+) asks the failing program instead of the terminal, so a passphrase or host-key prompt fails at once. The `execlp` lookup is from `readpass.c`. Older ssh falls back to the fetch deadline.
- **I6 — the real-app compare session.** tauri-driver and WebKitWebDriver start the app in tauri-driver's working folder, so a compare session "started in" a repository runs tauri-driver with that folder as its working folder.
- **I7 — GitLab keeps MR heads.** GitLab keeps `refs/merge-requests/<iid>/head` on the target project, forks included (GitLab docs, "check out merge requests locally"). The fake GitLab in `range-repo.sh` imitates it.

---

## 2. Option A (recommended): a new crate; Rust drives the paging over a Channel; one shared slice per window, reached through a seam

### 2.1 Data structures first

**Rust, crate `yamt-merge-requests`, `lib.rs`.** These types cross IPC. They use the serde/specta attributes of `yamt_review::NotLinedUp`, so the TS names come out camelCase.

```rust
/// Whether the window shows the button: decided once at start, offline.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitLabProject {
    None,                          // no repository, or no remote on a GitLab host
    Found { repository: String },  // the absolute common git dir (lossy UTF-8): the key filters are remembered by
}

pub struct MergeRequestIid(pub u32);           // Clone, Copy, Ord, Serialize, Deserialize, Type
pub struct Person { pub username: String, pub name: String }

#[serde(rename_all = "camelCase")]
pub enum CiStatus { Passed, Failed, Running, Pending, Canceled, Skipped, Manual }
// SUCCESS→Passed, FAILED→Failed, RUNNING→Running,
// CREATED|WAITING_FOR_RESOURCE|PREPARING|WAITING_FOR_CALLBACK|PENDING|SCHEDULED→Pending,
// CANCELED|CANCELING→Canceled, SKIPPED→Skipped, MANUAL→Manual,
// any other value→Pending plus tracing::warn

pub struct JobPage(String);   // Ord, Serialize, Deserialize, Type. Only JobPage::built makes one:
                              // "https://<host[:port]>" + web path matching ^/[A-Za-z0-9._~/-]+/-/jobs/[0-9]+$,
                              // no ".." segment

pub struct FailedJob { pub name: String, pub stage: String, pub allow_failure: bool,
                       pub page: Option<JobPage> }   // None: GitLab is not on https, or an odd path
pub struct Pipeline { pub status: CiStatus, pub failed_jobs: Vec<FailedJob>, pub more_failed_jobs: bool }

pub struct MergeRequestRow {
    pub iid: MergeRequestIid,
    pub title: String,
    pub created_at: String,       // GitLab's ISO 8601 time, as sent
    pub draft: bool,
    pub assignees: Vec<Person>,
    pub reviewers: Vec<Person>,
    pub labels: Vec<String>,
    pub open_discussions: u32,    // resolvable − resolved, saturating; null → 0
    pub approvals: u32,           // approvedBy nodes
    pub pipeline: Option<Pipeline>,
}
pub struct MergeRequestPage { pub me: Option<String>, pub rows: Vec<MergeRequestRow> }

#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ListEnd { Loaded, Cut { limit: u32 }, GlabMissing, NotLoggedIn { detail: String },
                   Failed { message: String } }  // pages already sent stay

#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenReply { Opened, AlreadyOpen, Preparing, NotOpen, NoRemote { project: String },
                     FetchFailed { message: String }, MissingCommit { short_id: String },
                     StartFailed { message: String }, GlabMissing, NotLoggedIn { detail: String },
                     Failed { message: String } }

#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JobOpened { Opened, NotOffered, Failed { message: String } }

pub struct RangeToOpen { pub root: PathBuf, pub spec: String }   // "<base_sha>..<head_sha>", not IPC
```

**Window.**
- `ipc/domain.ts` gains the brands `MergeRequestIid` and `JobPage`, applied through `branded`.
- `ipc/mergeRequestDomain.ts` converts `createdAt` to ms since 1970 with `Date.parse`. A value it cannot read is a conversion failure, as with every invalid IPC value.
- Pure core types (`frontend/src/mergeRequests/`, self-contained like `search/`):

```ts
export type DraftFilter = "all" | "drafts" | "ready";
export type PersonValue = { readonly kind: "me" } | { readonly kind: "none" }
                        | { readonly kind: "person"; readonly username: string };
export type LabelValue  = { readonly kind: "none" } | { readonly kind: "label"; readonly title: string };
export type Filters = { readonly assignee: readonly PersonValue[]; readonly reviewer: readonly PersonValue[];
                        readonly label: readonly LabelValue[]; readonly draft: DraftFilter };  // [] = filter not set
export type ListFilter = "assignee" | "reviewer" | "label";
export type Choice<V> = { readonly value: V; readonly label: string; readonly count: number; readonly checked: boolean };
```

**Remembered form:** localStorage key `yamt.mergeRequests.filters`, value `{ [repository]: { assignee: string[], reviewer: string[], label: string[], draft: "all"|"drafts"|"ready" } }`.
- Person values are stored as `"me" | "none" | "user:<username>"`, labels as `"none" | "label:<title>"`.
- Unreadable entries are dropped. Other repositories' entries are kept as written (the `serverPins.ts` pattern).

### 2.2 Rust

**Crate.** `crates/merge-requests`, package `yamt-merge-requests`. It depends on `yamt-gitio` and `yamt-range` (which brings merge-core), plus serde, serde_json and specta; its dev-dependencies include `yamt-review`. It is a new crate rather than a module of `yamt-review` for #117's reason: a component with a second job is growth harm (`yamt-review` is threads and posting for one range). arch-check gets a rule allowing only `yamt-(merge-requests|range|gitio|merge-core)` for it and adds `merge-requests` to yamt-app's allowed list.

| file | holds |
|---|---|
| `detect.rs` | `gitlab_repository(folder: &Path) -> Option<GitLabRepository>`. Offline: `Repo::discover`, then gitio's new `Repo::remote_urls()`, which runs `config -z --get-regexp ^remote\..*\.url$`; exit 1 means none. Pure `remote_host(url)` handles scp-like `user@host:path`, `scheme://[user@]host[:port]/…`, and returns `None` for local paths, `file://` and Windows drive letters. Pure `is_gitlab_host(host, glab_host)`: the host is `gitlab.com`, or one of its dot-labels starts with `gitlab`, or it equals the host in `GITLAB_HOST`/`GL_HOST` (glab's own variables; the env read carries `#[expect(…, reason)]`). `GitLabRepository::project()` gives `GitLabProject`. |
| `project.rs` | `glab api projects/:fullpath` → `Project { full_path: path_with_namespace, web_origin: Option<String> }`. The origin is kept only when `web_url` is https. One call per load or open; nothing cached, so no Mutex in the crate (RS5). |
| `query.rs` | `LIST_QUERY` and `DETAILS_QUERY` (below); `list_args(full_path, after)` and `details_args(full_path, iid)`. |
| `page.rs` | Parses one GraphQL answer into `ParsedPage { me, rows, next: Option<String>, complexity }`. A non-empty `errors` becomes `Err(first message)`. Holds the CiStatus mapping and `JobPage::built`. Logs `queryComplexity` at info once per load, which is the measurement on a real GitLab. |
| `list.rs` | `list_merge_requests(repo: &GitLabRepository, glab: Option<&Glab>, on_page: &dyn Fn(MergeRequestPage)) -> ListEnd`. It checks glab, then `auth_status`, then the project, then at most 5 pages of 100 via the private loop `pages(fetch: &mut dyn FnMut(Option<&str>) -> Result<ParsedPage, String>, on_page)`, so it can be tested without glab. A 6th page means `Cut { limit: 500 }`; a failure after some pages means `Failed` (the sent pages stay). |
| `open.rs` (B3) | `prepare_open(repo, glab, iid, range_dir) -> Result<RangeToOpen, OpenReply>`; steps below. |
| `remote.rs` (B3) | Pure `remote_for(remotes, full_path) -> Option<&Remote>`: the first remote in config order whose URL, without a trailing `/` and `.git`, ends in `/<full_path>` or `:<full_path>`, compared case-insensitively. |
| `job_page.rs` | B1: `JobPage::built`. B3 adds `open_job_page(page) -> JobOpened` (`Opened` or `Failed`). Linux and BSD run `xdg-open <url>` from PATH; macOS `/usr/bin/open <url>`; Windows `rundll32.exe url.dll,FileProtocolHandler <url>`. stdin, stdout and stderr are null; a waiter thread reaps the process. The URL's characters are limited by `built`, so no quoting problem arises on Windows. |

**The list query.** One shape; Rust drives the paging with `-f after=` instead of `--paginate`, so each page is its own 20 s glab call and arrives on its own:

```graphql
query MergeRequestPage($fullPath: ID!, $first: Int!, $after: String) {
  queryComplexity { score limit }
  currentUser { username }
  project(fullPath: $fullPath) {
    mergeRequests(state: opened, sort: CREATED_DESC, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        iid title createdAt draft
        labels { nodes { title } }
        assignees { nodes { username name } }
        reviewers { nodes { username name } }
        approvedBy { nodes { username } }
        resolvableDiscussionsCount resolvedDiscussionsCount
        headPipeline { status
          jobs(statuses: [FAILED], retried: false, first: 50) {
            pageInfo { hasNextPage } nodes { name allowFailure webPath stage { name } } } }
      }
    }
  }
}
```

argv: `api graphql -f query=<LIST_QUERY> -f fullPath=<full path> -F first=100`, plus `-f after=<cursor>` from the second page on. The full path comes from the REST project call, because glab's docs list `:fullpath` as a field placeholder only in one JSON example.

**Score by GitLab's rule:**

| part | cost |
|---|---|
| `iid`, `title`, `createdAt`, `draft` | 4 |
| `labels` | 5 + 2 = 7 |
| `assignees`, `reviewers` | 8 each |
| `approvedBy` | 1 + 2 = 3 |
| the two discussion counts | 2 |
| `jobs` | children 2 + 6 = 8, + resolver 1 = 9, × (1 + 50 × 0.01) = 13 |
| `headPipeline` | 1 + 1 + 13 = 15 |
| one node | 47; `nodes` 48; `pageInfo` 3 |
| `mergeRequests` | (51 + 2 for `sort`) × (1 + 100 × 0.01) = 106 |
| `project` | 107 |
| `currentUser` and `queryComplexity` | about 5 |
| **total** | **about 112 of 250** |

So the failed jobs come with the list; nothing extra runs on hover, and 100 per page fits.

`approvedBy { nodes }` stands in for `{ count }` because I could not check that `UserCoreConnection` has `count`. `diffRefs` is left out: opening an MR asks again, so a push made since the list loaded is honoured.

**Opening an MR's changes (`prepare_open`):**
1. glab: missing → `GlabMissing`; `auth_status` → `NotLoggedIn` or `Failed`; the project call; then the details query:
   ```graphql
   query($fullPath: ID!, $iid: String!){ project(fullPath:$fullPath){ mergeRequest(iid:$iid){ state targetBranch diffRefs{ baseSha headSha } } } }
   ```
   It answers `NotOpen` (the state is not `opened`) or `Preparing` (`diffRefs` is null).
2. If both commits are already local (`commit_named`), skip the fetch.
3. Otherwise `remote_for` (`NoRemote { project }`), then gitio's new `Repo::fetch_without_refs(remote, &["refs/merge-requests/<iid>/head", "refs/heads/<target>"])`:
   - `git fetch --no-tags --no-write-fetch-head --no-recurse-submodules --no-auto-maintenance --refmap= --quiet --end-of-options <remote> <refspecs>`;
   - `Access::Write`, `LC_ALL=C`, stdin closed;
   - env `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, and on Unix `SSH_ASKPASS_REQUIRE=force`, `SSH_ASKPASS=false` (I5);
   - deadline `FETCH_TIMEOUT` 120 s.
   - `--refmap=` with refspecs that name no destination writes no ref and skips the opportunistic remote-tracking update. Every flag exists from git 2.29, and yamt already needs 2.31 (`--path-format`).
   - A failure or timeout gives `FetchFailed` with git's last stderr line.
4. `Resolved::resolve(root, "<base>..<head>")`. A side git does not know gives `MissingCommit { short_id }`, for example after the target branch was force-pushed.
5. `PairLock::take(range_dir, &resolved)`: `Locked` → `AlreadyOpen`; on success the lock is dropped at once.
6. `Ok(RangeToOpen)`. Lining up holds by construction: the right side is a commit id (commit route), two dots keep the left side as GitLab's `base_sha`, and the right is GitLab's `head_sha`.

**gitio (B1).**
- glab.rs gains `Glab::get(cwd, args) -> Result<Vec<u8>, String>` and `Glab::auth_status(cwd) -> AuthStatus { LoggedIn | LoggedOut { detail } | Failed { message } }`, plus `pub fn first_line` and `last_line` and `TIMED_OUT`.
- These moved out of review's `glab_answer.rs` (`answer`, `first_line`, `last_line`, `exit_words`) and `send.rs` (`require_logged_in`). Both now call gitio: a clean cutover with no second copy.
- names.rs gains `remote_urls`. fetch.rs is B3's.

**src-tauri (B3).**
- `merge_requests.rs`:
  - `MergeRequestState { gitlab: Option<GitLabRepository>, range_dir: PathBuf, job_pages: Mutex<BTreeSet<JobPage>> }`, plus `manage(app, folder: Option<&Path>, app_folder)`.
  - The compare window passes `appimage::repo_from_start_dir(".")` on Linux (its start folder, `OWD` under an AppImage) or `.` elsewhere. The range window passes `range.root()`.
  - Four thin commands:
    - `find_gitlab_project(state) -> GitLabProject`.
    - async `list_merge_requests(window, pages: Channel<MergeRequestPage>) -> Result<ListEnd, IpcError>`, through `blocking_reply`. It adds every `FailedJob.page` to `job_pages` before forwarding the page.
    - async `open_merge_request(window, iid) -> Result<OpenReply, IpcError>`: `prepare_open`, then `range_window::start`.
    - `open_job_page(state, page: JobPage) -> JobOpened`: a page not in `job_pages` is `NotOffered`, else `yamt_merge_requests::open_job_page`.
  - So the command opens only an address Rust itself built from a GitLab job's `webPath` in this run.
- `range_window.rs`:
  - Pure `program(appimage: Option<PathBuf>, exe: PathBuf) -> PathBuf`, with `appimage.rs`'s new `running_appimage()` giving `$APPIMAGE` when inside one.
  - Args `--diff=<spec> --repo <absolute root>` (absolute, so `OWD` is irrelevant); working folder = root.
  - stdin and stdout null, stderr inherited.
  - Unix: `process_group(0)`. Windows: `creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)`. Both are std and safe.
  - A waiter thread reaps the child, so the child outlives the parent.
  - No `--ai`: the request says "behaves as one started with `yamt --diff=<base>..<head>`".
- No new `IpcError`: GitLab, git and launch problems are values. No capability or CSP change: the opener runs from Rust, and the page still reaches GitLab only through Rust.

**Opener choice (DR3).** std's `Command` covers xdg-open, `open` and rundll32, so no `tauri-plugin-opener`. It also gives the test stand-in for free: a fake `xdg-open` first on PATH, as the fake glab is.

### 2.3 Window

- **Pure core** `frontend/src/mergeRequests/` (index.ts + `internal/`): filters, choices, order, summary, relativeTime, ciBox, stored (signatures in §6). It is self-contained: it imports no other `src/` module, like `search/`. It is listed in `fences.ts FRAMEWORK_FREE_MODULES`, `.oxlintrc.json`'s framework-free list and the Vitest node include list.
- **One slice per window:** `ui/mergeRequests.ts`, `createMergeRequests({ source, screen, report })`, created by `compareStore.ts` and `rangeStore.ts`, each passing its own `screen`.
- **The shared seam:** `ui/mergeRequestsStore.ts` (`registerMergeRequests` / `useMergeRequests`), exactly as `settingsStore.ts` is for Settings. The button in up to 16 mounted headers and the one page all read the window's single slice, so the list and filter state exist once per window.
- **Remembered filters:** `ui/mergeRequestFilters.ts` (`storedValue`, keyed by `GitLabProject.repository`).
- **Words:** `ui/mergeRequestsText.ts`, plus `ui/glab.ts`, which now holds the glab sentences the Send button uses and `RECHECK_PAUSE_MS`, moved out of the range files.
- **Components:** `MergeRequestsButton.vue`, `MergeRequestsView.vue` (the page), `MergeRequestRow.vue`, `MergeRequestFilter.vue` (one `useDropdownMenu<ListFilter>` checklist with `menuitemcheckbox` items and the narrowing box above 8 values), `CiStatusBox.vue`, and the existing `ChoiceButtons` for the three-way Draft.
- **The CI box:**
  - It opens on `pointerenter` or focus of the icon button, with no delay (#100).
  - It is `position: fixed`, placed with no gap by `useMenuPlacement` + `belowLeft`, and not teleported, so Tab moves from the icon into the jobs in DOM order.
  - It stays while the pointer or focus is in the icon or the box. It closes on leaving both, on Escape (which returns focus to the icon and calls `preventDefault`) and on list scroll.
- **Sources:** `ipc/MergeRequestSource.ts`; `CompareSource` and `RangeSource` extend it. `tauriMergeRequests.ts` uses one `Channel` per load. `fixtureMergeRequests.ts` + `fixtureMergeRequestData.ts` script answers with `?mr=<script>` beside `?diff` or `?range=<case>`; without `mr` the project is `none`, so existing fixture pages are unchanged.
- **Problems:** `problem.ts` gains `{ action: "mergeRequests"; step: "find"|"list"|"open"|"job"; cause }` for IPC failures, shown in the ProblemBar. GitLab's answers are values and appear in the page.
- **New fence PM10** (`fences.ts`): files under `src/ui/` matching `MergeRequest*`, `mergeRequest*`, `CiStatus*` import no root (`store`, `App`, `compareStore`, `CompareApp`, `rangeStore`, `RangeApp`) and nothing from `lsp/`.

---

## 3. Option B (not recommended): grow `yamt-review`; the window drives the paging; state passed by props

**Data structures, where they differ from A:**
- `list_merge_request_page(after: Option<PageCursor>) -> PageReply`, where `PageReply` is `Page { me, rows, next: Option<PageCursor> } | GlabMissing | NotLoggedIn | Failed`.
- `PageCursor` is an opaque branded string.
- No Channel and no Rust paging loop. Logging in is checked only when `after` is `None`.

**Rust:** a module `review/src/merge_requests/`. The opener is `tauri-plugin-opener`, called from Rust (`OpenerExt::open_url`) with the same `job_pages` set. Fetch and launch are as in A.

**Window:** the slice is the same, but the 500 cap, the cursor and dropping stale pages live in TS. There is no seam: each root passes the page its state as props, and each `CompareView`/`RangeView` calls its own store's `showMergeRequests`.

**Cost:**
- `yamt-review` takes a second job (#117's growth harm).
- A dependency the stack does not need (DR3; `std::process` covers it), and the fake-opener stand-in then depends on the plugin's own lookup.
- GitLab's paging protocol is known in two places, Rust and TS (vision 2).
- Props through every view, against the settings-seam precedent.

**Benefit:** about 3 fewer Rust files, and partial lists tested only in TS.

## 4. Recommendation: Option A

**Serves:** vision 2 (one place knows GitLab's protocol, one slice per window, one opener rule), vision 3 (arch-check rule, PM10, a refusal for job pages Rust did not hand out), vision 4 (sum types for every outcome, `JobPage` built in one place), vision 5 (no dependency).

**Costs:**
- A ninth library crate, and arch-check and §7 entries.
- A `Channel` per load.
- Rust state for handed-out job pages (a `Mutex<BTreeSet>`).
- A refactor of review's glab helpers into gitio, with review's existing tests as the guard.
- One test hook in app-session: a stop that sweeps the child windows.
- The `Screen` union gains a kind the merge window never sets. `serverLog` is already shared that way.

---

## 5. Builds: disjoint ownership per round, dependency order, size

The order is **R1: B1 ∥ B2 → R2: B3 ∥ B4 → R3: B5 → verifier.** Never more than two side by side. Within a round no file has two owners; a later round may edit an earlier round's files.

**R1 · B1 rust-impl: offline detection and the list.** About 24 files, about 1,350 lines.
- `Cargo.toml` (member + dep)
- `crates/merge-requests/{Cargo.toml, AGENTS.md, src/lib.rs, src/detect.rs, src/project.rs, src/query.rs, src/page.rs, src/list.rs, tests/list.rs}`. `job_page.rs` holds only `JobPage::built` here, with its tests.
- `crates/gitio/src/{glab.rs, names.rs}`, `crates/gitio/tests/glab.rs`
- `crates/review/src/{glab_answer.rs, send.rs}` (the cutover)
- `scripts/arch-check.sh`, `scripts/fake-glab/glab`
- `tests/glab/README.md`, `tests/glab/merge-requests/{project.json, graphql-page-1.json, graphql-page-2.json}`, `tests/glab/merge-requests-timeout/{project.json, graphql-page-1.json, graphql-page-1.sleep}`
- `docs/architecture.md` (§3.9 crate, §7 crate list)
- No src-tauri, no bindings.

**R1 · B2 web-impl: the pure core and the shared words.** About 24 files, about 1,450 lines.
- `frontend/src/mergeRequests/{index.ts, AGENTS.md, internal/filters.ts, internal/choices.ts, internal/order.ts, internal/summary.ts, internal/relativeTime.ts, internal/ciBox.ts, internal/stored.ts}` + 7 `*.test.ts`
- `frontend/src/ui/{glab.ts, mergeRequestFilters.ts, mergeRequestFilters.test.ts, rangeThreadText.ts, rangeGitLab.ts, rangeGitLab.test.ts}`
- `frontend/scripts/fences.ts` (FRAMEWORK_FREE_MODULES), `frontend/.oxlintrc.json`, `frontend/vite.config.ts`
- `.omp/skills/project-map/SKILL.md`, including B1's crate line, written from this contract.

**R2 · B3 rust-impl: commands, opening, the opener, the launch.** About 27 files, about 1,450 lines.
- `crates/merge-requests/src/{lib.rs, open.rs, remote.rs, job_page.rs}`, `crates/merge-requests/tests/open.rs`, `crates/merge-requests/Cargo.toml` (dev-dep yamt-review)
- `crates/gitio/src/{fetch.rs, lib.rs}`, `crates/gitio/tests/fetch.rs`
- `src-tauri/Cargo.toml`, `src-tauri/src/{merge_requests.rs, merge_requests/tests.rs, range_window.rs, appimage.rs, window.rs, range.rs, commands.rs, lib.rs}`
- `scripts/range-repo.sh` (fake GitLab, !13), `scripts/fake-open/xdg-open`
- `tests/glab/merge-requests/{graphql-merge-request-12.json, graphql-merge-request-13.json, merge-requests.json, merge-request-13.json}`, `tests/glab/README.md`
- `frontend/src/ipc/bindings.ts` (generated)
- `docs/architecture.md` (§3.5 commands, the #94 change, the second process), `.omp/skills/ipc-contract/SKILL.md`, `.omp/skills/risk-register/SKILL.md`

**R2 · B4 web-impl: sources, domain, slice, stores.** About 27 files, about 1,500 lines. It codes against B3's contract (§6).
- `frontend/src/ipc/{MergeRequestSource.ts, mergeRequestDomain.ts, mergeRequestDomain.test.ts, tauriMergeRequests.ts, fixtureMergeRequests.ts, fixtureMergeRequests.test.ts, fixtureMergeRequestData.ts, domain.ts, index.ts, CompareSource.ts, RangeSource.ts, tauriCompare.ts, tauriRange.ts, fixtureCompare.ts, fixtureRange.ts}`
- `frontend/src/ui/{screen.ts, mergeRequests.ts, mergeRequests.test.ts, mergeRequestsStore.ts, mergeRequestsText.ts, mergeRequestsText.test.ts, problem.ts, problemText.ts, compareStore.ts, rangeStore.ts}`
- `.omp/skills/project-map/SKILL.md`, including B3's lines for `range_window.rs`, `fake-open` and `range-repo.sh`, written from the contract.

**R3 · B5 web-impl: page, components, wiring, real-app tooling, docs.** About 22 files, about 1,150 lines.
- `frontend/src/ui/{MergeRequestsButton.vue, MergeRequestsView.vue, MergeRequestRow.vue, MergeRequestFilter.vue, CiStatusBox.vue, CompareView.vue, RangeView.vue, RangeApp.vue, CompareApp.vue, AGENTS.md}`
- `frontend/scripts/{fences.ts, fences.test.ts}` (PM10)
- `frontend/scripts/app-session/{startArgs.ts, startArgs.test.ts, start.ts, stop.ts, fixture.ts}`
- `scripts/map-check.sh` (adds `MergeRequestSource`)
- `docs/architecture.md` (§5.1 rows, §5.4), `.omp/skills/project-map/SKILL.md`, `CHANGELOG.md`

**Between rounds:**
- `vue-tsc` is red for B4 until B3's `bindings.ts` lands. B4's node tests do not need it (esbuild drops types; fixture sources only).
- map-check is green only after B5 has named `MergeRequestSource`'s methods in the architecture.
- The verifier runs once after R3.

---

## 6. Contracts between builds, in full

**B1 → B3 (crate API).**

```rust
pub fn gitlab_repository(folder: &Path) -> Option<GitLabRepository>;
impl GitLabRepository {
    pub fn project(&self) -> GitLabProject;
    pub fn root(&self) -> &Path;
    pub(crate) fn remotes(&self) -> &[Remote];
    pub(crate) fn repo(&self) -> &Repo;
}
pub(crate) struct Remote { pub name: String, pub url: String }   // lossy UTF-8 of git's bytes
pub fn list_merge_requests(repository: &GitLabRepository, glab: Option<&Glab>,
                           on_page: &dyn Fn(MergeRequestPage)) -> ListEnd;
pub(crate) fn project(glab: &Glab, root: &Path) -> Result<Project, String>;
pub(crate) struct Project { pub full_path: String, pub web_origin: Option<String> }
impl JobPage { pub(crate) fn built(origin: &str, web_path: &str) -> Option<JobPage>; pub fn as_str(&self) -> &str; }
// lib.rs constants
pub const PAGE_SIZE: u32 = 100;
pub const MAX_MERGE_REQUESTS: u32 = 500;
const MAX_FAILED_JOBS: u32 = 50;
// gitio
impl Glab {
    pub fn get(&self, cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String>;
    pub fn auth_status(&self, cwd: &Path) -> AuthStatus;
}
pub enum AuthStatus { LoggedIn, LoggedOut { detail: String }, Failed { message: String } }
impl Repo { pub fn remote_urls(&self) -> Result<Vec<RemoteUrl>>; }
pub struct RemoteUrl { pub name: Vec<u8>, pub url: Vec<u8> }
```

**Fake glab (B1, extended by B3).**
- `api` records the values of `-f`/`--raw-field`/`-F`/`--field` as `name=value`. Any field makes the method POST unless `-X` is given.
- New routes:
  - `GET projects/:fullpath` → `project.json`.
  - `POST graphql` with a field `iid=<n>` → `graphql-merge-request-<n>.json`.
  - `POST graphql` without `iid` → `graphql-page-1.json` when there is no `after`, `graphql-page-<n>.json` for `after=page-<n>`. The scenario's `endCursor`s are `"page-<n>"`.
- Each `graphql-*` file may have `.sleep`, `.exit` and `.err`, with post semantics.
- Scenario `merge-requests/`:
  - project `{"id":7,"path_with_namespace":"taskboard/taskboard","web_url":"https://gitlab.example/taskboard/taskboard"}`, me `sam`;
  - page 1: !13 (failed pipeline: two failed jobs, one `allowFailure`), !12 (passed, approvals 2, open discussions 1), a draft "Draft: …" with a running pipeline; `hasNextPage` true, `endCursor` `page-2`;
  - page 2: two rows (no pipeline; manual), `hasNextPage` false;
  - B3 adds `graphql-merge-request-12.json` (base `531ea52d…`, head `9c1ba3fc…`, target `main`), `graphql-merge-request-13.json` (base `531ea52d…`, head `MR13_HEAD`), `merge-requests.json` (REST commit route: `[{iid:13, project_id:7, state:"opened", sha: MR13_HEAD, …}]`) and `merge-request-13.json` (REST details with `diff_refs`).
- `merge-requests-timeout/` sleeps 25 s on page 1.

**B3 → B4 and B5 (generated bindings).**
- `commands.findGitlabProject(): Promise<GitLabProject>`
- `commands.listMergeRequests(pages: Channel<MergeRequestPage>): Promise<Result<ListEnd, IpcError>>`
- `commands.openMergeRequest(iid: number): Promise<Result<OpenReply, IpcError>>`
- `commands.openJobPage(page: string): Promise<JobOpened>`
- The TS types `GitLabProject`, `MergeRequestPage`, `MergeRequestRow` (`iid`, `title`, `createdAt`, `draft`, `assignees`, `reviewers`, `labels`, `openDiscussions`, `approvals`, `pipeline: Pipeline | null`), `Pipeline` (`status`, `failedJobs`, `moreFailedJobs`), `FailedJob` (`name`, `stage`, `allowFailure`, `page: string | null`), `CiStatus` (`"passed" | "failed" | "running" | "pending" | "canceled" | "skipped" | "manual"`), `ListEnd`, `OpenReply`, `JobOpened`, all tagged `kind` with camelCase variants as in §2.1.
- The commands are registered for every window. State is managed for compare and range only; the merge window never calls them.

**B3 → B5 (real-app repository).**
- `scripts/range-repo.sh <dir>` also makes:
  - a bare fake GitLab at `<dir>/.git/fake-gitlab.git`, cloned from the repository, with `refs/merge-requests/12/head` = `9c1ba3fc…` and `refs/merge-requests/13/head` = `MR13_HEAD`. That commit is "Snooze a reminder", dated 2026-10-08T10:00:00+02:00 on top of `feature`, made in a scratch clone and **absent from `<dir>`**;
  - `remote origin https://gitlab.example/taskboard/taskboard.git`;
  - `url.<bare path>.insteadOf https://gitlab.example/taskboard/taskboard.git`.
- No fetch, so no `refs/remotes`. B3 pins `MR13_HEAD` in its tests and the scenario JSON.
- `scripts/fake-open/xdg-open`: appends `argv: <args>` to `$YAMT_FAKE_OPEN_LOG`, or to the `glab.env`-style `open.env` beside it, and exits 0.

**B2 → B4 and B5 (`mergeRequests/index.ts`).**

```ts
export type ListedRequest = { readonly iid: number; readonly createdAt: number; readonly draft: boolean;
  readonly assignees: readonly Person[]; readonly reviewers: readonly Person[]; readonly labels: readonly string[] };
export type Person = { readonly username: string; readonly name: string };
export const NO_FILTERS: Filters;
export const NARROW_FROM = 8;
export function passes(row: ListedRequest, filters: Filters, me: string | null): boolean;
export function filtered<R extends ListedRequest>(rows: readonly R[], filters: Filters, me: string | null): readonly R[];
export function personChoices(rows: readonly ListedRequest[], field: "assignees" | "reviewers",
  me: string | null, checked: readonly PersonValue[]): readonly Choice<PersonValue>[];
  // Me first (when me is known), None, then others by name; counts over the whole loaded list; a checked value not found → count 0
export function labelChoices(rows: readonly ListedRequest[], checked: readonly LabelValue[]): readonly Choice<LabelValue>[];
export function narrowed<V>(choices: readonly Choice<V>[], typed: string): readonly Choice<V>[];
export function toggled(filters: Filters, filter: ListFilter, value: PersonValue | LabelValue): Filters;
export function withDraft(filters: Filters, draft: DraftFilter): Filters;
export function cleared(filters: Filters, filter: ListFilter): Filters;
export function isFiltered(filters: Filters): boolean;
export function filterLabel(filter: ListFilter, filters: Filters): string;   // "Reviewer: Me, anna" (usernames); "Reviewer" when unset
export function merged<R extends ListedRequest>(current: readonly R[], page: readonly R[]): readonly R[];  // dedupe by iid, newest first, ties by iid desc
export function summaryText(shown: number, loaded: number, cut: boolean): string;  // "12 of 40 merge requests"; cut: "… (the newest 500; GitLab has more)"
export function createdAgo(createdAt: number, now: number): string;  // "created just now" under a minute; else Intl.RelativeTimeFormat("en") largest whole unit: minute, hour, day, week, month (30 d), year (365 d)
export type CiBoxView<J> = { readonly kind: "jobs"; readonly jobs: readonly J[]; readonly more: boolean }
                         | { readonly kind: "status"; readonly text: string };   // "Pipeline running", "Pipeline passed", …
export function ciBox<J extends { readonly allowFailure: boolean }>(status: CiStatusName,
  jobs: readonly J[], more: boolean): CiBoxView<J>;   // allow-failure jobs last, GitLab's order kept otherwise
export type CiStatusName = "passed" | "failed" | "running" | "pending" | "canceled" | "skipped" | "manual";
export function filtersFrom(stored: unknown): Filters;
export function storedFilters(filters: Filters): StoredFilters;  // the remembered form, §2.1
// ui/glab.ts (B2)
export const GLAB_MISSING_TEXT: string;   // "glab is not installed (not found on PATH)"
export function glabNotLoggedInText(detail: string): string;
export function glabFailedText(message: string): string;
export const RECHECK_PAUSE_MS = 30_000;
// ui/mergeRequestFilters.ts (B2)
export function createRememberedFilters(repository: Readonly<Ref<string | null>>, storage?: StorageLike):
  { readonly filters: Readonly<Ref<Filters>>; set(next: Filters): void };
```

**B4 → B5 (sources, slice, seam).**

```ts
export interface MergeRequestSource {
  findGitLabProject(): Promise<SourceResult<GitLabProject>>;
  listMergeRequests(onPage: (page: MergeRequestPage) => void): Promise<SourceResult<ListEnd>>;
  openMergeRequest(iid: MergeRequestIid): Promise<SourceResult<OpenReply>>;
  openJobPage(page: JobPage): Promise<SourceResult<JobOpened>>;
}
export type Listing = { readonly kind: "notLoaded" } | { readonly kind: "loading"; readonly first: boolean }
                    | { readonly kind: "done"; readonly end: ListEnd; readonly at: number };
export type Opening = { readonly kind: "fetching" } | { readonly kind: "opened" }
                    | { readonly kind: "refused"; readonly reply: Exclude<OpenReply, { readonly kind: "opened" }> };
export type MergeRequests = {
  readonly project: Readonly<ShallowRef<GitLabProject>>; readonly me: Readonly<ShallowRef<string | null>>;
  readonly rows: Readonly<ShallowRef<readonly MergeRequestRow[]>>; readonly listing: Readonly<ShallowRef<Listing>>;
  readonly filters: Readonly<Ref<Filters>>; readonly shownRows: ComputedRef<readonly MergeRequestRow[]>;
  readonly choices: ComputedRef<Readonly<{ assignee: readonly Choice<PersonValue>[]; reviewer: readonly Choice<PersonValue>[]; label: readonly Choice<LabelValue>[] }>>;
  readonly summary: ComputedRef<string>; readonly openings: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Opening>>>;
  readonly jobProblem: Readonly<ShallowRef<string | null>>;
  findProject(): Promise<void>;
  show(): void;     // screen → mergeRequests; first show loads; a show ≥ RECHECK_PAUSE_MS after the last load ended reloads in the background
  close(): void;    // screen → files
  refresh(): Promise<void>;
  toggle(filter: ListFilter, value: PersonValue | LabelValue): void; setDraft(draft: DraftFilter): void;
  clear(filter: ListFilter): void; clearAll(): void;
  openChanges(iid: MergeRequestIid): Promise<void>; openJob(page: JobPage): Promise<void>; dismissJobProblem(): void;
};
export function createMergeRequests(deps: { readonly source: MergeRequestSource; readonly screen: ShallowRef<Screen>;
  readonly report: (problem: Problem) => void; readonly storage?: StorageLike }): MergeRequests;
export function registerMergeRequests(slice: MergeRequests): void;   // ui/mergeRequestsStore.ts
export function useMergeRequests(): MergeRequests;
```

- **Rules of the slice:**
  - The first load shows its pages as they arrive.
  - A reload keeps the old rows until its own end, then swaps them in. A failed reload keeps the old rows and sets the sentence.
  - A load id drops pages from an older load. One load runs at a time; Refresh is disabled while one runs.
- **Wiring:** `compareStore.ts` and `rangeStore.ts` add `mergeRequests: MergeRequests`, register it, and call `findProject()` in `startUp` beside the existing calls.
- **Words** (`mergeRequestsText.ts`):
  - `LOADING_TEXT` "Loading merge requests…", `NONE_TEXT` "No open merge requests.";
  - `listEndText(end)`: missing and logged-out glab use B2's sentences plus "— install glab, then Refresh." / "— run glab auth login in a terminal, then Refresh.";
  - `openReplyText(reply, iid)`, one sentence per kind ("!13 is already open in another yamt window.", …);
  - `jobOpenedText`.
- **Fixture scripts** (`?mr=`): `list` (40 rows, 2 pages; a second load drops one label, for "kept at 0"), `slow` (pages 1 s apart), `many` (5 pages then `cut`), `empty`, `noGlab`, `loggedOut`, `timeout`, `refused`, `pageFails`. Open replies are set per iid in the data: opened, alreadyOpen, fetchFailed, preparing. Job opens are logged as `mergeRequests.fixture_job`.

---

## 7. Tests per layer, and the bug each catches

**Rust**

| test | catches |
|---|---|
| `detect.rs` unit: `remote_host` for scp-like, ssh with port, https with credentials, `file://`, a local path, `C:\repo`; `is_gitlab_host` for `gitlab.com`, `gitlab.example`, `my-gitlab.com` (false), `GITLAB_HOST` | the button showing on GitHub; a local path or a drive letter read as a host |
| `page.rs` unit over recorded JSON | "x/y" or negative counts; null counts; unknown CI status; a GraphQL `errors` body read as a page; a job page built from `http://`, `//evil`, `..`, a query string or a foreign path |
| `list.rs` unit with an injected fetcher | paging past 500; losing the sent pages when a later page fails; a cursor not passed on |
| `tests/list.rs` (fake glab) | the exact argv (`-f fullPath=taskboard/taskboard -F first=100`, then `-f after=page-2`), the working folder, the env; logged-out → `NotLoggedIn`; no glab → `GlabMissing`; `with_timeout` + `.sleep` → `Failed("glab timed out")` |
| gitio `glab.rs` tests for `get`/`auth_status`; the existing review tests unchanged | a regression from the cutover |
| gitio `remote_urls` | no remotes treated as an error |
| `remote.rs` unit: scp, https, trailing slash, case; `taskboard/taskboard-fork` does not match | fetching from the wrong remote |
| `tests/fetch.rs` (temporary bare repository with an MR ref) | after the fetch the commit exists; `for-each-ref`, `git status --porcelain`, the index's hash, HEAD and FETCH_HEAD are unchanged; a non-listening `https://127.0.0.1:1/x` fails before the deadline; catches moved refs, FETCH_HEAD writes, hangs |
| `tests/open.rs` (range-repo + fake glab) | !13 fetched then `MERGE_BASE..MR13_HEAD`, and `yamt_review::check_gitlab` on that range gives `LinedUp` (#119 broken); !12 opens with origin's `insteadOf` removed, so a fetch attempt would fail (fetching when not needed); a held `PairLock` → `AlreadyOpen`; null diff refs → `Preparing`; no matching remote → `NoRemote` |
| `src-tauri merge_requests/tests.rs` (mock window, fake glab and fake xdg-open on PATH in a child, as `review/tests.rs` does) | pages arrive on the Channel before the end; a job page never handed out → `NotOffered`, a handed-out one runs xdg-open with exactly that URL (the opener as an open-anything hole) |
| `range_window.rs` `program` unit; `appimage.rs` `running_appimage` unit | the AppImage child started from a mount that disappears |

**Frontend (node)**

| test | catches |
|---|---|
| core: any value within one filter, all filters across; Me resolves to the logged-in user; None; Draft three ways; a checked value kept at 0; counts; order with ties; `merged` drops duplicates | rows hidden or doubled at page boundaries; Me matching a username literally |
| core: `createdAgo` at 59 s, 1 min, 23 h, 1 d, 6 d, 7 d, 29 d, 30 d, 364 d, 365 d | wrong unit or rounding |
| core: `ciBox` | allow-failure jobs not last; an empty box for a running pipeline |
| core: `stored` | junk in storage breaking the page |
| `mergeRequestFilters.test` | another repository's filters lost |
| `mergeRequestDomain.test` | brands, ms times |
| `fixtureMergeRequests.test` | every script answers |
| `mergeRequests.test` | no reload before 30 s; a reload dropping the rows; stale pages from an older load applied; open states; an IPC failure not reported |
| `mergeRequestsText.test` | a kind without a sentence; glab words differing from the Send button's |
| `fences.test` | PM10 |
| `startArgs.test` | `--diff --dir`, `--glab` with `--diff`, `--mr` |

---

## 8. Acceptance steps

**WebKit fixture (MiniBrowser through `just app-session start-fixture`).** Each step runs in both windows (`--diff --mr …` and `--range-case review --mr …`), in dark and light.
1. **The button sits left of the gear only in a GitLab repository.** With `mr=list`, `[aria-label="Merge requests"]` comes immediately before `[aria-label="Settings"]` in DOM order and by its rectangles, including `--range-case empty`. Without `mr` there is no button.
2. **The page opens and closes.**
   - A click shows the section "Merge requests" with Back focused.
   - Escape closes it and focus returns to the button.
   - Back closes it.
   - Picking a file or tab closes it.
   - An open checklist eats Escape (the page stays).
3. **Rows** show the title cut with the full title on hover, `!iid`, "created N … ago" with the date on hover, the two counts (a 0 dimmed) and the CI icon, newest first.
4. **CI hover:**
   - Hovering opens the box at once with failed jobs only, allowed-to-fail last.
   - The pointer moves into the box and the box stays; leaving both closes it.
   - A running pipeline says "Pipeline running".
   - Tab reaches the jobs; Escape returns to the icon.
5. **Filters:**
   - Assignee lists Me first, then None; one click narrows the list and the checklist stays open; the summary reads "n of 40".
   - Reviewer, then Label with None first; the narrowing box appears above 8 values.
   - All, Drafts, Ready; × clears one filter; Clear filters clears all.
   - Refresh with a label checked that the second load drops: it shows 0 and stays checked.
6. **Remembered:** reload the page and the filters come back.
7. **Open changes:** the row shows working, then "Opened in a new window"; alreadyOpen, fetchFailed and preparing show their sentences on their rows.
8. **Failures:** `mr=noGlab`, `loggedOut` and `timeout` each show their sentence with Retry, and switching tabs or files still works.
9. **Partial lists:** `mr=slow` shows 25 rows while the second page is loading; `mr=many` says the list was cut.

**Real app.**
- Repository: `scripts/range-repo.sh /var/tmp/yamt-mr/rr`. glab: `--glab merge-requests`, which also puts `scripts/fake-open` on PATH and logs to `<session>/glab/opened.log`.
- Range window: `start-app --range main...feature --dir …/rr --glab merge-requests`.
  - The button sits left of the gear; the page lists 5 rows; filters and CI hover work.
  - Clicking a failed job writes `https://gitlab.example/taskboard/taskboard/-/jobs/<id>` to `opened.log`.
  - Opening !13: the fake glab log shows the details query, then `/proc` shows a child `yamt --diff=531ea52…..<MR13_HEAD> --repo …/rr` working in `rr`.
  - The fake glab log then shows the child's `commits/<MR13>/merge_requests` and `merge_requests/13` calls (its #119 check, proved `LinedUp` by `tests/open.rs`).
  - `git for-each-ref`, `git status` and the absence of `.git/FETCH_HEAD` are the same as before; opening !13 again gives "already open".
  - `stop` also ends the child: it sweeps processes whose `/proc/<pid>/environ` holds this session's `HOME`.
- Compare window: `start-app --diff --dir …/rr --glab merge-requests` starts tauri-driver in `rr` (I6) and shows the button; `--diff` with no `--dir` shows none.
- Restart with `--home <same>`: the filters are remembered.
- `--glab logged-out` and `--glab merge-requests-timeout` (after 20 s) each show their sentence.
- Repeat with `--settings '{"theme":"light"}'`.
- Owner's check: one real project on his GitLab, recording his GitLab version and the logged `queryComplexity` score.

---

## 9. Proposed `docs/plan.md` §2 rows (DR5: text for the orchestrator)

- **#94 replaced:** "**The compare window is its own mode end to end**" (… as before …). **Amended (owner 2026-10-30, #1765):** the compare window looks for a repository once at start, in its start folder (`OWD` under an AppImage), and runs git and glab only for the merge-request page: remotes at start, glab and the fetch on use. `--diff --repo` stays refused (#101). *Rejected:* `--repo` for `--diff` (#101); the compare window without the page (owner). *Visions 3, 2, 1.*
- **#112, #115, #118 link rule replaced:** "Links in threads, AI answers and Markdown stay text, never navigable. The one exception is a failed CI job on the merge-request page: a click hands `https://<the project's host>/<path>/-/jobs/<id>` to the system browser. The address is built only by `JobPage::built` from GitLab's `webPath` and the project's https origin, and opened only by `open_job_page` when this window's list handed it out." *Rejected:* `tauri-plugin-opener` (`std::process` runs xdg-open, `open` and rundll32, DR3); the page passing an address; http GitLab pages. *Visions 4, 3, 5.*
- **New: the crate `yamt-merge-requests`** (gitio + range; amends §7 and PM1/arch-check). It holds offline detection, the one GraphQL list query, Rust-driven paging (100 per page, at most 5 pages, `Cut` after 500, pages on a `Channel`), preparing an open, and job pages. glab's output helpers move to `yamt-gitio`. *Rejected:* a module of `yamt-review` (#117, a second job); window-driven paging (GitLab's protocol in two places). *Visions 2, 3, 5.*
- **New: "a GitLab project", offline.** A remote's configured URL host is `gitlab.com`, or has a dot-label starting with `gitlab`, or equals `GITLAB_HOST`/`GL_HOST`. It is decided once at start, with no network and no glab run. *Rejected:* `glab auth status` (network); parsing glab's config file (a format yamt does not own). *Visions 1, 5.*
- **New: the list query.** Fields as in §2.2. Failed jobs come with the list (score about 112 of 250 by GitLab's rule). `queryComplexity` is logged. A field an older GitLab lacks refuses the query, and that shows as one sentence with Retry. *Rejected:* failed jobs on hover (an extra call per hover, not needed); `--paginate` (one 20 s deadline for 5 pages, no partial lists). *Visions 2, 5.*
- **New: opening an MR's changes.**
  - Fresh diff refs; no fetch when both commits are local.
  - Otherwise `git fetch --no-tags --no-write-fetch-head --no-recurse-submodules --no-auto-maintenance --refmap= <remote> refs/merge-requests/<iid>/head refs/heads/<target>` from the remote whose URL ends in the project's path, with no prompt, within 120 s.
  - Then resolve and check the pair lock, then a new process `yamt --diff=<base>..<head> --repo <root>` (`$APPIMAGE` under an AppImage, else `current_exe`), detached and in its own process group.
  - Amends architecture §3.5's "one process, one window, nothing starts another yamt".
  - *Rejected:* `refs/remotes/<r>/merge-requests/<iid>` (read as a branch, no MR found, `right_branch.rs`); a `refs/yamt/*` ref (a write in the user's repository); waiting for the child's exit (a healthy child never exits). *Visions 4, 2, 1.*
- **New: the page.** `Screen` gains `mergeRequests`. One slice per window store through the seam `ui/mergeRequestsStore.ts` (as `settingsStore.ts`). The pure core is `frontend/src/mergeRequests/` (self-contained). Fence PM10 covers the shared page files. *Rejected:* a drop-down (owner, answer 2); props through every view. *Visions 2, 3.*
- **New: remembered filters.** localStorage `yamt.mergeRequests.filters`, keyed by the absolute common git dir. *Rejected:* the settings file (UI state, new commands, the `current` round trip; #97's size reason does not apply). *Visions 5, 2.*
- **New: orchestrator defaults** (the owner may veto):
  - checklist counts are over the whole loaded list, so they stay put while you click;
  - filter buttons name usernames;
  - "created just now" under a minute; weeks are a unit;
  - an unknown CI status shows as pending;
  - at most 50 failed jobs per box, then "more on GitLab";
  - the CI box closes on scroll;
  - the opened window's title shows both full commit ids;
  - Refresh is disabled while a load runs.
- **New risk-register rows:**
  - RK40, a fetch that moves a ref or waits on a prompt (`tests/fetch.rs`);
  - RK41, the opener opening an address GitLab did not list (`NotOffered` test, `JobPage::built` tests);
  - RK42, the second window started from a mount that disappears (`program` unit test + AppImage manual check).

## 10. Open questions for the product owner

1. **Self-hosted GitLab hosts.** If your GitLab's host name has no label starting with "gitlab" (for example `git.company.com`), the button does not show unless `GITLAB_HOST` names that host. Should yamt also read the hosts glab is logged in to from glab's config file, offline at window start? The cost is that yamt depends on a file format glab owns and may change.
2. **ssh passphrases.** Opening an MR's changes fails, with git's sentence on the row, when fetching needs a typed ssh passphrase or a confirmation that the host is new: there is no prompt by design. An ssh agent or a credential helper works. Is that acceptable, or should yamt wait up to 2 minutes for a prompt in the terminal it was started from?

## 11. Open risks and deviations from the brief

- **Deviation:** five builds, not four. The window is split into B4 (sources and state) and B5 (components and tooling) to stay at about 25 files per build. Still at most two side by side.
- **Deviation:** all four commands land in B3, so `vue-tsc` is red for B4 alone until B3's bindings land. The verifier checks after R3.
- **Risk:** I1, the field ages. Only the owner's GitLab can confirm them.
- **Risk:** I5. On ssh older than OpenSSH 8.4, a prompt waits until the 120 s deadline.
- **Risk:** objects fetched without a ref can be pruned by `git gc` after about two weeks. A later open simply fetches again.
- **Risk:** macOS and Windows behaviour of the launch and the opener (I3, I4) cannot be exercised here; only CI builds them.