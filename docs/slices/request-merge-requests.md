# Request — the GitLab project's open merge requests in the diff windows: an overview, quick filters, open an MR's changes

Owner request 2026-10-30 (#1765), planned in session 37 on branch `feat/merge-requests` off main `d97a270` (the 0.7.x
line). Status: intent captured; three product questions asked (table below); details decided by the orchestrator as
owner (OR13), marked "(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule.
Facts with `path:line` at `d97a270`: `.omp/run/notes/PlanScoutMrGitlab.md`, `.omp/run/notes/PlanScoutMrChrome.md`.

## Owner's words

> "I want an overview over the MRs like in gitlab that I can open in --diff and --diff=... modes and if there is a
> gitlab project in the current repo. The overview is an icon button on top right next to the settings button. The
> list is filterable on assignees, draft yes/no, label, reviwers. Each item shows only the number of remaining open
> discussions (not x/y) and the amount of approvals (also not x/y) and CI status (hovering it shows only the jobs that
> failed and clicking on that job opens gitlab in a browser tab (outside the application to that failed jobs logs. An
> item shows the title, MR number (as !XXXX), created x ago, and a button that opens the diff of that MR. No sorting
> options yet, but sort by created_at by default where the newest MRs are on top. The filters should be really easy and
> fast to set, unlike in gitlab where there is one input and you have to find category, operator, value, press enter,
> ... While gitlab has a powerful filter. My filter will be less powerful but easier to interact with and specialized
> for reviewing."

Reading (orchestrator): "--diff" is the compare window (pasted texts), "--diff=..." the range window; the merge window
gets nothing. "The current repo": the range window's repository; for the compare window, which has none today, the
folder yamt was started in. "Approvals": approvals given. "Open discussions": resolvable threads not yet resolved.
"CI status": the MR's latest pipeline. "The diff of that MR": exactly what GitLab's Changes tab shows for its latest
version, so comments posted from that window line up with the MR (plan §2 #119).

## Questions (asked 2026-10-30)

| question                                    | options                                                                                                                                          | answer |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Where does an MR's "open changes" go?       | **a new window; the current one stays as it is (recommended)** · the range window you are in switches to it (the compare window opens a new one) | —      |
| How does the list open?                     | **a drop-down under the button, over the code (recommended)** · a full page in place of the code, like Settings, with Back                       | —      |
| Are the filters remembered across restarts? | **yes, per repository (recommended)** · only while the window is open                                                                            | —      |

## Rules

1. **The button.** In the compare window and the range window, an icon-only button (Lucide `git-pull-request`, title
   "Merge requests") directly left of the gear, in every header that shows the gear (also the range window's
   empty-range header). Shown only when the window's repository is a GitLab project: the range window's repository;
   for the compare window, the git repository holding the folder yamt was started in (under an AppImage, the start
   folder it records). No repository or no GitLab remote: no button, nothing else changes. Showing the button never
   waits on the network (orchestrator).
2. **The panel** (question 2; the recommended form): a click opens the overview under the button, right-aligned to it,
   about 40rem wide (narrower in a narrow window), as tall as the window allows, scrolling inside. Escape, a click
   outside or the button again close it; the keyboard goes back where it was. One panel per window, whichever header's
   button opened it; its list and filters stay while it is closed.
3. **What it lists.** The project's open merge requests, drafts included (GitLab's "Open" tab), newest created first;
   no sort choice. Up to 500 (orchestrator); beyond, the summary says the list was cut. Loaded on the first opening;
   opening again 30 seconds or more after the last load reloads in the background while the list stays (the range
   window's GitLab re-check pause, `RECHECK_PAUSE_MS`); a Refresh button in the panel's top row reloads at once.
   While the first load runs: "Loading merge requests…"; none: "No open merge requests."
4. **A row** (owner: exactly these): the title (one line, cut with "…", whole in its hover text; GitLab's own "Draft: "
   prefix as GitLab writes it); `!1234`; "created 3 days ago" (the largest whole unit, English; the date and time on
   hover); an icon and the number of open discussions; an icon and the number of approvals; one CI status icon (passed,
   failed, running, pending, canceled, skipped, manual; no pipeline → no icon); the open-changes button (Lucide
   `file-diff`, title "Open the changes of !1234"). Counts are single numbers, never "x/y"; a zero is dimmed
   (orchestrator).
5. **CI hover** (owner). Hovering the CI icon opens at once a small box listing only the pipeline's failed jobs, the
   latest run of each (a failure since retried is not listed): job name and stage; jobs allowed to fail come last,
   marked "allowed to fail" (orchestrator). No failed job: the box says the status in words ("Pipeline running"). The
   box stays open while the pointer moves into it. A click on a job opens that job's log page on GitLab in the system
   browser, outside yamt; nothing else in the panel opens a browser.
6. **Filters** (owner: "really easy and fast to set"). One row under the top row, always visible, in this order:
   Assignee, Reviewer, Label, Draft.
   - Assignee, Reviewer, Label: a button opening a checklist of the values found in the loaded list, each with its
     number of MRs. Assignee and Reviewer list "Me" (the logged-in GitLab user) first, then "None", then the others by
     name; Label lists "None" first. A box at the top narrows the checklist as you type when it holds more than 8
     values (orchestrator). One click toggles a value and the list follows at once: no Enter, no Apply; the checklist
     stays open for the next click; Escape or a click outside closes it.
   - Draft: three buttons side by side, "All · Drafts · Ready"; one click.
   - Inside one filter, any checked value matches; across filters, every filter must match.
   - A set filter shows its values in its button ("Reviewer: Me, anna") with a × that clears it; "Clear filters"
     shows while any filter is set. A summary line reads "12 of 40 merge requests".
   - A checked value no longer in a reloaded list stays checked, shown with 0, until unchecked (orchestrator).
   - Remembered per question 3.
7. **Opening an MR's changes** (question 1; the recommended form). The button first fetches the MR's commits from
   GitLab into the repository's git storage — no branch created or moved, no checkout, the working tree and the
   staged files untouched (orchestrator) — then opens a new range window on the MR's latest version exactly (GitLab's
   base and head commits), so threads posted there line up with that MR. The button shows that it works while fetching;
   a failure is one sentence on the row. The MR already open in another window: the row says so. The new window
   behaves as one started with `yamt --diff=<base>..<head>` in that repository; the current window stays as it is.
8. **Failures.** glab missing or logged out: the panel says so with what to run, in the words the range window's Send
   button already uses. GitLab unreachable, too slow, or refusing: one sentence and Retry. The rest of the window works.
9. **Unchanged.** The merge window; the range window's threads, Send and its GitLab check; the compare window's tabs;
   `--diff` with `--repo` stays a usage error (#101).

## Acceptance

WebKit fixture pages of both windows with scripted GitLab answers, and the real app on `scripts/range-repo.sh` in both
windows with the fake glab: the button sits left of the gear only in a GitLab repository; the panel opens and closes
(Escape, outside click, button); rows show title, `!iid`, created ago, open discussions, approvals and the CI icon,
newest first; the CI hover lists only failed jobs, allowed-to-fail last; a click on a job hands its GitLab address to
the system browser (observed through a stand-in opener in the real app); each filter narrows with one click, Me first,
None, the three-way Draft, × and Clear filters, the summary counts; filters remembered across a restart (if question 3
says so); open changes fetches and opens a range window whose GitLab check says it lines up with the MR; glab missing,
logged out and a timeout each show their sentence. Filters, order, counts, relative time and the CI box's contents are
tested as pure code. `just check` passes; dark and light. The owner's check: one real project on his GitLab.

## Non-goals

Merged and closed MRs; sort choices; text search; avatars; labels, assignees, reviewers or branches on a row (filters
only); opening the MR page itself in the browser; acting on an MR (approve, merge, resolve, retry a job); refreshing on
a timer; the merge window; GitHub; a key for the panel; required approvals or total discussions ("not x/y"); naming
the MR in the opened window's title or headers.

## Reopens (DR4: the owner's changed requirement)

- **#94** "the compare window … never runs git": the compare window now looks for a repository in its start folder and
  runs git (remotes, the fetch of rule 7) and glab, only for this panel.
- **#112, #115, #118** "links shown as text, never navigable; no link-opening dependency": a failed job's link opens in
  the system browser (owner's words). Only this panel's job links; links in threads and AI answers stay text.
- **One process, one window, nothing starts another yamt** (architecture §3.5, scout Q4): opening an MR's changes starts
  a second yamt process (rule 7, question 1's recommended answer).

## Facts for the design (sourced)

- **glab is the only way to GitLab** (`crates/gitio/src/glab.rs:10-84`): found on PATH per call, 20 s deadline, the
  repository as working folder, `NO_COLOR=1`, `GIT_TERMINAL_PROMPT=0`; GitLab problems come back as values, never as
  `IpcError`s (`crates/review/src/send.rs:25-36,244-256`); messages for missing / logged out in
  `frontend/src/ui/rangeThreadText.ts:75-104`. yamt never parses a remote URL; glab picks host and project from the
  folder's remotes (`:fullpath`). Every route used today is REST; none lists MRs with the fields this panel needs.
- **One GraphQL query carries every field** (GitLab GraphQL reference, `MergeRequest`, docs 19.6): `iid`, `title`,
  `createdAt`, `draft`, `webUrl`, `diffRefs { baseSha headSha startSha }`, `labels`, `assignees`, `reviewers`
  (connections with `username`/`name`), `approvedBy { count }`, `resolvableDiscussionsCount` and
  `resolvedDiscussionsCount` (open = the difference), `headPipeline { status, jobs(statuses: [FAILED], retried: false)
  { nodes { name, stage { name }, allowFailure, webPath } } }`; `currentUser { username }` names "Me". `glab api graphql
  --paginate` needs `$endCursor` and `pageInfo { hasNextPage endCursor }` (glab docs, `glab api`). Limits: 100 nodes a
  page, query complexity 250 when logged in, 30 s request timeout (GitLab GraphQL docs, "Limits") — nested job lists
  per MR may push a page over the complexity limit: measure; failed jobs may need their own call on hover.
- **Lining up** (#119, `crates/review/src/lines_up.rs`, `right_branch.rs`): a right side given as a commit id finds its
  MR by commit; `<base_sha>..<head_sha>` lines up when both commits are local (`review/tests/review.rs:657-678` tests
  the commit route). A ref under `refs/remotes/<remote>/merge-requests/<iid>` would be read as branch
  `merge-requests/<iid>` and find no MR [INFERENCE, `right_branch.rs:26-32`].
- **Nothing fetches** (`git fetch` appears nowhere in `crates`, `src-tauri`, `scripts`); GitLab keeps every MR's head
  at `refs/merge-requests/<iid>/head` on the target project, forks included [GitLab docs, "merge requests: check out
  locally"; to verify in the design]. The base commit lives on the target branch.
- **Compare window** (`src-tauri/src/args.rs:26,103-104`, `window.rs:73-94`): no repository, `--repo` refused, one
  window per data folder (`crates/compare/src/files.rs:27-42`). Under an AppImage the working folder is `$APPDIR/usr`
  and the start folder is in `OWD` (`src-tauri/src/appimage.rs:4-11`), read today only for merge and range.
- **Range window** (`src-tauri/src/range.rs:20-75`): one per repository and commit pair (`crates/range/src/lock.rs`);
  the page never receives the repository root (`RangeStart`, `ipc/bindings.ts:540-545`).
- **Starting yamt again**: nothing does (`current_exe` only in `appimage.rs:17`); under an AppImage the running binary
  lives in a mount that goes when the first process ends [INFERENCE].
- **No opener**: no plugin, crate or `xdg-open` call; capabilities `core:event:allow-listen`, `core:window:allow-destroy`
  (`src-tauri/capabilities/main.json`); CSP `connect-src 'self' ipc: http://ipc.localhost; img-src 'self' data:`
  (`tauri.conf.json:14`) — the page reaches GitLab only through Rust; remote avatars would not load.
- **Headers**: one `SettingsButton.vue` per mounted view (`CompareView.vue:89`, `RangeView.vue:108`,
  `RangeApp.vue:133-141`; up to 16 range views, one per visited compare tab); no gear while the range window has not
  opened (`RangeApp.vue:123,134`). Settings is a screen in each store (`ui/screen.ts`, `settingsStore.ts:11-38`).
- **Menus**: `useDropdownMenu`, `useMenuPlacement`, `menuPosition`, `menuKeys` are generic; the ready menus import the
  merge window's store. `ServerMenu.vue` is the one popover that stays open for clicks (teleported, fixed). No tooltip
  can be clicked into; `OperationLabel.vue` + `operationTooltip.ts` open at once on hover but ignore the pointer.
- **No relative-time formatter, checkbox list or user chip** in `frontend/src/ui/`.
- **Per-repository memory**: `serverPins.ts` keeps `yamt.servers.pinned` keyed by repository root in localStorage
  (`windowStorage.ts:15-31`); the settings file's per-repository entries are written only from the merge window.
- **Fake glab** (`scripts/fake-glab/glab`, `tests/glab/<scenario>/`): answers `auth status` and REST GETs/POSTs from
  scenario files; any other route → 404. Browser fixtures script GitLab through `?gitlab=` (`ipc/fixtureGitLab.ts`).

## Risks

- **Query limits**: one page of MRs with their failed jobs may exceed GitLab's complexity limit; a self-hosted GitLab
  may lack a field (check each field's first version against the owner's GitLab).
- **Fetching**: which remote is the GitLab project (glab knows, yamt never parsed URLs); a password prompt must fail fast
  (`GIT_TERMINAL_PROMPT=0`), never hang; the base commit may be missing after a force-push of the target branch.
- **Starting a second yamt**: the right program path under an AppImage, a macOS bundle and Windows; the new window must
  outlive the old one; its refusal (the pair is already open) must reach the row.
- **Opening a browser**: only addresses on the project's own GitLab host, built from GitLab's job path, never a
  string from elsewhere (security review).
- **Many views, one panel**: the gear exists once per mounted view; the panel and its state must exist once per window.
- **Many MRs**: 500 MRs are 5 pages at 100; each glab call has 20 s; the list shows what arrived so far.

## Slice graph (proposal; refined after the design)

| row | slice                                                                                                                                                                                 | owner     | owns (coarse)                                                                       | needs |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- | ----- |
| 1   | design: GitLab detection without network, the one GraphQL query and its paging, where MR code lives, fetch and start a range window, the opener, the panel and its state in two roots | designer  | read-only                                                                           | —     |
| 2   | Rust: detection, the MR list and "Me" through glab, commands for both windows, fake-glab GraphQL scenarios                                                                            | rust-impl | a crate per the design, `src-tauri` commands, `scripts/fake-glab`, `tests/glab`     | 1     |
| 3   | Rust: open an MR's changes (fetch, start a range window) and open a job's page in the system browser                                                                                  | rust-impl | `crates/gitio` fetch, `src-tauri` launch and opener, capabilities                   | 1, 2  |
| 4   | window core, framework-free: filters (values, counts, Me, None, any/all), order, summary, relative time, CI box contents, remembered filters                                          | web-impl  | a new module per the design                                                         | 1     |
| 5   | window: the button beside the gear in both windows, the panel, rows, checklists, CI box, sources (app and fixture), both stores                                                       | web-impl  | new `ui/` files, `CompareView.vue`, `RangeView.vue`, `RangeApp.vue`, stores, `ipc/` | 2, 4  |
| 6   | final run: `just check`, WebKit both windows, real app with the fake glab, dark and light                                                                                             | verifier  | —                                                                                   | 3, 5  |

At most two implementers live (OR10): 2 ∥ 4, then 3 ∥ 5 with 3's contract fixed in 5's brief.
