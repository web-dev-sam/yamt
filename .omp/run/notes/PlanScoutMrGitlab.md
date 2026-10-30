# Plan scout (merge-request overview): GitLab and glab plumbing — `ScoutGitlab`, session 37, at main `d97a270`

## Summary

- yamt reaches GitLab only through the `glab` program. The range window uses it for one job: finding the merge request (MR) that matches the window's two commits, then posting comments as draft notes. Nothing in yamt reads a remote URL or a GitLab host; glab works out the project from its `:fullpath` placeholder, run inside the repository folder.
- Nothing opens a URL in the system browser today. There is no opener plugin, shell plugin or similar crate, and the only capability is `core:event:allow-listen` and `core:window:allow-destroy`. Plan rows #112, #115 and #118 decided that links stay as text and turned down a link-opening dependency.
- A fake glab exists: the shell script `scripts/fake-glab/glab` answers from scenario folders in `tests/glab/<scenario>/`. Rust tests and `app-session start-app --glab` use it.
- A range can be given as raw commit ids. When the right side is not a branch, the MR is looked up by commit. GitLab's `base_sha...head_sha` or `base_sha..head_sha` matches as long as both commits exist locally.
- yamt never runs `git fetch`. It writes refs only inside the AI's private clone, and git's own continue/abort runs in the merge window.

## Files

- `crates/gitio/src/glab.rs:10-84` — `GLAB_TIMEOUT` (20 s), `Glab { program, timeout }`, `GlabRun { Printed | Failed | TimedOut }`, `find`, `at`, `with_timeout`, `run`.
- `crates/gitio/src/run.rs:155-203` — `run_with_deadline`, `spawn_piped` (stdin is empty unless a body is given), `wait_with_deadline` (kills the process at the deadline).
- `crates/gitio/src/program.rs:5-26` — `program_in`: searches only absolute PATH folders and needs an execute bit (on Windows, the `.exe` name).
- `crates/gitio/src/lib.rs:75-79` — `Error::GlabIo { program, source }`.
- `crates/gitio/src/names.rs:47-60` — `symbolic_full_name` and `remote_names`.
- `crates/review/src/lib.rs:21-163` — `MergeRequestRef`, `LookedAt`, `NotLinedUp`, `GitLabCheck`, `SendProgress`, `SendReply`, and the re-export of `Glab`.
- `crates/review/src/send.rs:25-36, 40-54, 206-260` — `check_gitlab`, `send_queue`, `lined_up`, `lookup`, `require_logged_in`, `failed`.
- `crates/review/src/gitlab.rs:7-60, 62-116, 119-226` — the GitLab data types, the glab argument builders, and the JSON parsers.
- `crates/review/src/lines_up.rs:7-89` — the pure matching rule (#119).
- `crates/review/src/right_branch.rs:9-44` — which branch the right side names.
- `crates/review/src/glab_answer.rs:7-119` — how glab's output is turned into results and messages.
- `crates/review/src/position.rs:21-88` — the GitLab position for a comment.
- `src-tauri/src/review.rs:19-25, 137-170` — `send_guard`, async `check_gitlab`, async `send_queue`.
- `src-tauri/src/ipc_error.rs:8-84, 178-196` — `IpcError`, `blocking_reply`, `From<yamt_review::Error>`.
- `src-tauri/src/range.rs:19-25, 28-66` — `RangeState`, `run_range`, `manage_range_in`.
- `frontend/src/ui/rangeGitLab.ts` — `createGitLabCheck`, `GitLabState`, `RECHECK_PAUSE_MS`.
- `frontend/src/ui/rangeThreadText.ts:66-137` — `notLinedUpText`, `twoDotsHint`, the send/post labels.
- `frontend/src/ui/RangeSendButton.vue`, `RangeView.vue:107-108`, `RangeMessage.vue:54-56, 200-212`, `RangeApp.vue:61-71, 120`, `rangeStore.ts:161, 279`.
- `frontend/src/ipc/ReviewSource.ts:15-16`, `tauriReview.ts:39-45`, `reviewDomain.ts:24-25, 44-46, 147-153`, `fixtureGitLab.ts`.
- `scripts/fake-glab/glab`, `tests/glab/README.md`, `tests/glab/<scenario>/`.
- `frontend/scripts/app-session/start.ts:70-109`, `startArgs.ts:112-132`.

## Architecture

1. The range window's frontend (`rangeGitLab.ts`) goes through `ReviewSource.checkGitLab()` and `sendQueue()`, which call the Tauri commands `check_gitlab` and `send_queue` (`review.rs`).
2. Those commands run on a `spawn_blocking` worker via `blocking_reply`. Each call looks glab up on PATH again with `Glab::find()`.
3. They call `yamt_review::check_gitlab` or `send_queue`. Both go through the private `lined_up`: `glab auth status` → `right_branch` → one list call → up to 5 detail calls → the pure `lines_up` rule.
4. Every glab call goes through `Glab::run`.
5. GitLab problems never become `IpcError`s. They come back as values (`GitLabCheck::NotLinedUp { why }` or `SendReply::NotLinedUp / Stopped`).
6. Dependencies: `yamt-review` may depend only on range, gitio and merge-core among yamt crates, and never on tauri (`scripts/arch-check.sh:58-63`). It uses `serde_json` (`crates/review/Cargo.toml`).

## Report

### 1. glab plumbing (`crates/`)

**How glab is run**

- `Glab::find()` returns the first runnable `glab` on PATH, or `None` (`glab.rs:36-39` → `program.rs:5-11`).
- `Glab::run(cwd, args, stdin)` (`glab.rs:56-83`):
  - working folder is `range.root()`, the work tree root;
  - the user's full environment, plus `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`;
  - stdin is empty unless a body is given (`run.rs:176-188`);
  - the process is killed at the 20 s deadline and the result is `TimedOut` (`run.rs:190-203`);
  - exit 0 → `Printed { stdout }`; any other exit → `Failed { status, stdout, stderr }`;
  - a failure to start or talk to the process → `Error::GlabIo`, whose text is "i/o error while running {program}: {source}" (`lib.rs:75-79`).
- The deadline can be changed with `Glab::with_timeout` (tests only, `review/tests/review.rs:377`).

**How errors become messages** (`glab_answer.rs`)

- `run` (98-107) turns a `GlabIo` error into its message text.
- `answer` (76-88), used for GET calls:
  - `Printed` → the stdout bytes;
  - `Failed` → the last non-empty stderr line, or "glab exited with status N" / "glab was stopped by a signal";
  - `TimedOut` → "glab timed out".
- Callers map these messages to `NotLinedUp::Failed { message }` (`send.rs:258-260`).
- `posted` (26-52), used for the POST, reads the HTTP status from `--include` output (`http_answer_from` 56-73):
  - 2xx → `Drafted(id)`;
  - 401, 403 or 429 → `Stop`;
  - any other 4xx → `Refused` (GitLab's `message` or `error`, else the last stderr line, else "HTTP n");
  - anything else → `Stop`;
  - no HTTP status line in the output → `Stop` with the last stderr line, or "glab printed no HTTP answer".

**Commands and routes used** (`gitlab.rs`)

- `glab auth status` (`send.rs:245`).
- `glab api --method GET projects/:fullpath/merge_requests -f state=opened -f source_branch=<branch>` (62-73).
- `glab api projects/:fullpath/repository/commits/<sha>/merge_requests` (75-80).
- `glab api projects/<project_id>/merge_requests/<iid>` (82-85, 105-107).
- `glab api --paginate projects/<pid>/merge_requests/<iid>/draft_notes` (87-90).
- `glab api --include --method POST projects/<pid>/merge_requests/<iid>/draft_notes --input -`, with the JSON body on stdin (92-103; body built in `position.rs:47-78`).
- Nothing else. No `glab mr …`, `glab repo view`, `--hostname` or `-R` (grep of `crates` and `src-tauri/src` for `get-url|remote\.origin|GITLAB_HOST|--hostname|-R` finds nothing in yamt code).

**How the project and host are identified**

- The first call uses glab's `:fullpath` placeholder, run in the repository folder. Later calls use the numeric `project_id` from the answers (`Listed.project_id`, `MergeRequest.project_id`).
- yamt never parses a remote URL. `remote_names` is used only to strip a remote prefix from a remote-tracking name (`right_branch.rs:26-32`).
- [INFERENCE] glab picks the project and host from the git remotes of the folder it runs in.

**Fields read from GitLab's JSON**

- List (`listed_from` 119-130): `project_id`, `iid`, `state` (equal to "opened"), `sha`.
- Details (`merge_request_from` 132-152): `project_id`, `iid`, `references.short`, `title`, `web_url`, `diff_refs.{base_sha, start_sha, head_sha}`; `diff_refs` null → `None`.
- Nothing else is parsed: no draft, labels, assignees, reviewers, `created_at`, notes/discussions count, pipeline or approvals.

**The #119 "lines up" rule** (`send.rs:206-229`, `lines_up.rs`)

1. Steps:
   1. `require_logged_in`.
   2. `Repo::discover(root)`.
   3. `right_branch(repo, compared.right_label)`.
   4. `lookup`: a branch → `LookedAt::Branch { name }` with the branch route; `None` → `LookedAt::Commit { short_id }` with the commit route on the full right id (`send.rs:232-242`).
   5. `listed_from`.
   6. `candidates` (`lines_up.rs:25-35`): the branch route keeps every listed MR; the commit route keeps only open MRs whose `sha` equals the right commit. At most `MAX_MERGE_REQUESTS_CHECKED = 5` are kept.
   7. One details call per candidate.
   8. The pure `lines_up` rule.
2. Input: `Compared { left, right, left_short_id, right_short_id, right_label }` (from `Range::compared`, `range/src/open.rs:124-132`) plus `Found { looked_at, merge_requests }`.
3. The first MR whose `diff_refs.base_sha == left` and `head_sha == right` is `LinedUp { merge_request, diff_refs }`. `start_sha` is not compared (`lines_up.rs:37-48`).
4. When none matches:
   - no MRs → `NoMergeRequest { looked_at }`;
   - several → `Several { looked_at, references }`;
   - exactly one → `why_it_does_not` (67-84):
     - `diff_refs` null → `Preparing`;
     - head differs → `Moved { gitlab_head, shown_head }`;
     - otherwise → `OtherBase { gitlab_base, shown_base }`.
   - GitLab's ids are cut to the length of the window's short ids (`as_long_as` 87-89).
5. Output: `GitLabCheck::LinedUp { merge_request: MergeRequestRef }` or `NotLinedUp { why }` (`send.rs:25-36`).
6. `send_queue` runs `lined_up` again before posting, and the post uses those `diff_refs` (`send.rs:50-53`, `position.rs`).

**glab missing or not logged in**

- `glab: None` → `NotLinedUp::GlabMissing` (`send.rs:27`, `47`).
- `require_logged_in` (`send.rs:244-256`):
  - `glab auth status` exits 0 → OK;
  - any non-zero exit → `NotLoggedIn { detail }`, where `detail` is the first non-empty stderr line, else stdout (`first_line`, `glab_answer.rs:109-113`);
  - a timeout → `Failed("glab timed out")`.
- The real glab 1.124 output recorded in `tests/glab/logged-out/auth-status.out` ends with "could not authenticate to one or more of the configured GitLab instances". So a failure on any configured host counts as not logged in.

### 2. Tauri commands, `IpcError`, frontend

**Commands** (`src-tauri/src/review.rs`)

- `check_gitlab<R>(window)` (137-148): `blocking_reply`, then `yamt_review::check_gitlab(&state.range, Glab::find().as_ref())`. It always answers `Ok(GitLabCheck)`.
- `send_queue<R>(window, progress: Channel<SendProgress>)` (152-170): takes the send guard with `try_lock` (19-25) and holds it for the whole send; the threads lock is taken only between glab calls.
- Both are registered in the one specta builder shared by every window kind (`commands.rs:62-63`). [INFERENCE] In a compare window `window.state::<RangeState>()` would panic, which `blocking_reply` turns into `WorkerStopped`.
- `range.rs` has no GitLab code. `RangeState { range, threads: Mutex<ThreadStore>, sending: Mutex<()>, _lock }` (19-25).

**`IpcError` variants around GitLab** (`ipc_error.rs`)

- `SendRunning` (66): a second send.
- `WorkerStopped` (52): a worker panicked (`blocking_reply` 75-84).
- The thread-store errors `UnknownThread`, `UnknownMessage`, `EmptyMessage`, `MessagePending`, `NotANote`, `UnknownRangeFile`, `WriteFailed`, and `Git { message }` for read/broken/newer files (178-196).
- There is no GlabMissing-style `IpcError`; those reasons are values inside `NotLinedUp`.

**Frontend**

- `rangeGitLab.ts` `createGitLabCheck(source, threads, report, start)` gives `check`, `checking`, `sending`, `result`, the computed `sendButton`, `postButton(message, body)`, `checkNow`, `checkOnFocus`, `send`, `dismissResult`.
- `gate()` makes the buttons blocked with `CHECKING_TEXT` until the first answer, or with `notLinedUpText(why, start)`.
- When checks run:
  - at start, together with the thread list: `Promise.all([threads.load(), gitlab.checkNow()])` (`rangeStore.ts:279`);
  - on window focus when at least `RECHECK_PAUSE_MS = 30_000` ms have passed since the last check ended (`RangeApp.vue:67-71`);
  - one check at a time.
- A failure at the IPC level → `report({ action: "threads", step: "check" | "send" })`, shown in the ProblemBar.
- A `notLinedUp` send reply replaces `check`.
- Where GitLab state is visible:
  - no separate status widget;
  - `RangeSendButton.vue` (label "Send to GitLab (n)", the reason in its hover title, disabled), placed at `RangeView.vue:107` just left of `<SettingsButton />` (108);
  - each message's Post title;
  - the posting label "Queued for GitLab" / "Refused by GitLab: …" / "Pending on GitLab";
  - the Pending link as selectable text plus a Copy button (`RangeMessage.vue:200-212`);
  - the send result as a NoticeBar row (`RangeApp.vue:61-64, 120`).
- All wording is in `rangeThreadText.ts`. `notLinedUpText` (75-104) has one sentence per `NotLinedUp` kind; `twoDotsHint` (66-73) adds a "three dots" hint for `a..b`.
- `CompareView.vue:89` has only `<SettingsButton class="ml-auto" />`. The compare window has no GitLab code.

### 3. Opening URLs in the system browser

- Nothing does this today:
  - `src-tauri/Cargo.toml` and the workspace `Cargo.toml` have no `tauri-plugin-*`, `open` or `webbrowser`;
  - `Cargo.lock` has no `tauri-plugin-*`, `open`, `opener` or `webbrowser` package;
  - `frontend/package.json` has no `@tauri-apps/plugin-*`;
  - `capabilities/main.json` grants only `core:event:allow-listen` and `core:window:allow-destroy`;
  - there are no `xdg-open` calls, no `<a href>` in `frontend/src`, and no `on_navigation` handler.
- The CSP is `default-src 'self'; connect-src 'self' ipc: http://ipc.localhost` (`tauri.conf.json`), so the page cannot call GitLab directly.
- Links today:
  - the MR link is `web_url + "/diffs"` (`send.rs:21, 167-175`);
  - it is shown as selectable monospace text with Copy (`RangeMessage.vue:200-212`, title "Copy the link to the merge request's changes");
  - Markdown links render as their text plus the address in a `span.markdown-address`, and are never clickable (`markdownDom.ts:100-114`).
- Plan decisions:
  - #112 rejects "clickable links (a dependency on the opener; the page or the agent's turn lost by a stray click)";
  - #115 says "links stay text";
  - #118 rejects "opening links (#115)" and says the link is "shown as text with Copy (#112)".

### 4. Fake glab

- `scripts/fake-glab/glab` (POSIX sh) imitates glab 1.124.0.
- Variables: `YAMT_FAKE_GLAB` (the scenario folder, required), `YAMT_FAKE_GLAB_STATE` (post counter, required for posts), `YAMT_FAKE_GLAB_LOG`. Unset ones are read from a `glab.env` beside `$0`.
- It answers only `auth status` (`auth-status.out` printed on stderr, plus `auth-status.exit`) and `api`:
  - GET `…/merge_requests` and `commits/<id>/merge_requests` → `merge-requests.json`;
  - GET `…/merge_requests/<iid>` → `merge-request-<iid>.json`, else `merge-request.json`;
  - GET `…/draft_notes` → `draft-notes.json`;
  - POST `…/draft_notes` → `post-<n>.{json,status,err,exit,sleep}`;
  - any other route → 404 `{"message":"404 Not Found"}`;
  - any other command → exit 2.
- It logs argv, cwd, `NO_COLOR` / `GIT_TERMINAL_PROMPT`, and stdin.
- The layout and the measured real glab output are documented in `tests/glab/README.md`.
- Scenarios: `runner`, `lined-up`, `two-dots`, `moved`, `other-base`, `preparing`, `several`, `several-none`, `no-merge-request`, `commit-route`, `logged-out`, `drafted`, `refusal`, `timeout`, `slow-post`.
- Users:
  - `crates/gitio/tests/glab.rs` (`Fake`: a symlink plus `glab.env`, 55-91);
  - `crates/review/tests/review.rs:61-84`;
  - `src-tauri/src/review/tests.rs:217-343` (`run_with_fake_glab`: a child process with PATH starting at `scripts/fake-glab`);
  - `frontend/scripts/app-session/start.ts:88-109` together with `startArgs.ts:112-132` (`start-app --glab <scenario>`, only with `--range`; links `<folder>/glab/scenario`).
- Unit tests in `lines_up.rs` read the `tests/glab/*/merge-request*.json` files directly.
- `scripts/range-repo.sh` makes fixed commit ids that these scenarios pin.
- A separate fake runs in the browser fixture mode: `frontend/src/ipc/fixtureGitLab.ts`, with `?gitlab=<script>` scripts `linedUp|checking|noGlab|loggedOut|noMergeRequest|noBranch|moved|otherBase|several|preparing|failed|refusal|stopped`.

### 5. Plan §2 rows on GitLab/glab (`docs/plan.md`)

- **#112**: Markdown links are shown as text with their address and are never navigable. Rejected: clickable links, because they need an opener dependency.
- **#115**: "links stay text" (an orchestrator default).
- **#116**: The `ThreadLine` anchor is 0-based; +1 only in the GitLab position.
- **#117**: Threads and posting live in the crate `yamt-review`, which depends on range and gitio (for glab). `threads.json` format 1 has the posting states `notQueued | queued | refused | pending`. The threads mutex and the send guard are never held across a glab call.
- **#118**: Posting goes through `glab api` to the draft-notes route with an explicit position.
  - glab is run from PATH, 20 s per call, stdin closed except for the body, with `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0`, in the repository folder.
  - The position uses `base_sha` / `start_sha` / `head_sha` from the `diff_refs` just checked.
  - Messages are sent one at a time; existing drafts are reused; a 4xx refusal keeps that message queued.
  - A timeout, 401/403/429, 5xx or a missing glab stops the send.
  - The link is shown as text with Copy.
  - Rejected: `glab mr note draft create`, a Rust GitLab client, opening links.
- **#119**: Posting is allowed only when GitLab's diff is exactly the window's.
  - Rule: glab is found and `auth status` exits 0. Candidates come from the right side's branch, or, when the range names no branch, the open MRs whose head is the right commit. `base_sha` must equal the left commit and `head_sha` the right one; `start_sha` is ignored.
  - Checks run at start, on focus 30 s or more after the last one, and inside every Send.
  - Rejected: matching on the branch name alone.
- **#120**: The orchestrator's defaults with the threads design (the owner may veto):
  - a right side given as a commit id posts to the one open MR ending at that commit;
  - "Pending on GitLab" stays after you publish in GitLab, because yamt never reads GitLab back;
  - its "no edit or delete" default was later changed by #123.
- **#123**: A note can be edited or deleted until it is `Pending` on GitLab.

### 6. Raw SHAs, branch matching, and lining up

- `RangeSpec::parse` (`range/src/spec.rs:35-65`) takes any text on each side and only checks the dots and a leading `-`. `Resolved::resolve` (`open.rs:37-66`) resolves each side with `rev-parse --verify --quiet <name>^{commit}` (`gitio/repo.rs:73-77`). The usage text says either side may be a commit id (`args.rs:14-16`).
- A side that is not available locally is refused with `UnknownName`, as one line and exit 2, before any window opens (`open.rs:154-158`, `range.rs:28-32`).
- Threads are stored per commit pair, `<left oid>-<right oid>` (`range/src/lock.rs:25-31`). [INFERENCE] So the same commits named by SHA or by branch share one `threads.json`.
- Matching uses the right side's branch name when it has one: `right_branch` reads the right side's label as typed (always `Named`, `open.rs:57`) through `symbolic_full_name`:
  - `refs/heads/x` → `x`;
  - `refs/remotes/<remote>/x` → `x`, longest remote name wins (`right_branch.rs:9-44`);
  - anything else → `None`, which means the commit route.
- A bare SHA on the right goes by commit. This is tested: `main...<FEATURE sha>` lines up through `commits/<sha>/merge_requests` (`review/tests/review.rs:657-678`, `lines_up.rs` test `a_commit_id_side_uses_the_merge_request_ending_at_it`). `symbolic_full_name(<sha>)` returns `None` (`gitio/tests/glab.rs:317-327`).
- `<base_sha>...<head_sha>` lines up when both commits are local. [INFERENCE] The left side is `merge-base(base_sha, head_sha)`, which equals `base_sha` because GitLab's `base_sha` is an ancestor of `head_sha`. `<base_sha>..<head_sha>` lines up directly.
- `refs/merge-requests/<iid>/head` [INFERENCE, untested]: if the ref exists locally, `symbolic_full_name` returns that full ref name. It starts with neither `refs/heads/` nor `refs/remotes/`, so the commit route is used, and it lines up when the MR's head is that commit.
- Trap [INFERENCE from `right_branch.rs:26-32`]: a fetch refspec that maps MR heads to `refs/remotes/origin/merge-requests/<iid>` would turn into the branch name `merge-requests/<iid>`. The branch route would then find no MR (`NoMergeRequest`).

### 7. `git fetch` and ref writes

- No `git fetch` anywhere in `crates`, `src-tauri/src` or `scripts`. The only "fetch" hits are a doc comment and demo TypeScript.
- Ref writes happen only in the AI's checkout clone (`crates/agent/src/checkout.rs:48-51`):
  - `git clone --shared --no-checkout --no-tags --origin origin` (`gitio/checkout.rs:27-48`);
  - `update-ref --no-deref HEAD <oid>` and `update-ref --stdin` deleting every branch (`checkout.rs:121-143`);
  - `remote remove origin` (`checkout.rs:51-56`);
  - `checkout --detach` (`checkout.rs:59-63`).
- The merge window writes the index (`update-index`, `checkout -m`, `add`; `repo.rs:126-171`). Its git-owned continue/abort can move refs (`merge/rebase/cherry-pick/revert/am --continue|--abort`, `commit`, `reset --merge`; `abort_continue.rs:38-56`).
- The range window and `yamt-review` write no git state.

**Also relevant**

- The compare window has no repository: `Invocation::Compare` has no repo field, and `--diff` with `--repo` is refused with "--diff compares pasted text and takes no --repo" (`args.rs:13, 26, 33-37`).
- Each process opens one window with label `WINDOW_LABEL` (`window.rs:133`). Nothing in `src-tauri` starts another yamt process: `current_exe` is used only in `appimage.rs`.
