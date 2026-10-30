# MrFinal

Agent output (`agent://MrFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrFinal.md), collected 2026-10-30T15:52:42.231Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (once, repository root)",
      "observed": "Every recipe ran to the end. The last ones: golden `ok vue-core-compiler-von … ok vueuse-use-magic-keys`, then check-sfc-order, then hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`. Wall time 53.37 s. just stops at the first failing recipe, so reaching hooks-test means every recipe exited 0.",
      "pass": true
    },
    {
      "recipe": "fixture step 1: button left of the gear (--diff/--range-case review/--range-case empty with --mr list; none without mr)",
      "observed": "All three --mr cases, dark and light: `adjacent=true mR=1555 sL=1559`, top 11/11. `--diff` alone and `--range-case review` alone: `noButton settings=true`.",
      "pass": true
    },
    {
      "recipe": "fixture step 2: open/close (both windows, dark+light)",
      "observed": "Click: focus on Back. Escape: focus back on `Merge requests` and the page closes. Back: pageAfterBack=false. New tab while the page is open closes it. With the Assignee checklist open, Escape closed only the checklist: {menu:0,page:true}.",
      "pass": true
    },
    {
      "recipe": "fixture step 3: rows",
      "observed": "Newest first: !640 `Snooze a reminder` (span.truncate with title equal to the full title), `created 6 hours ago` with title `Oct 30, 2026, 10:00 AM`, then !639 and !638. A 0 count is rgb(129,126,141) (muted); a non-zero count is rgb(214,212,221). Each row has a CI button labelled Pipeline failed/passed/running/etc., or none.",
      "pass": true
    },
    {
      "recipe": "fixture step 4: CI hover (both windows, dark+light)",
      "observed": "Hover gives aria-expanded=true with `Failed jobs|test:unit|test|test:e2e|test|lint:docs|lint|allowed to fail`. With the pointer on a job button it stays true. Hovering Refresh gives false. Running pipeline shows `Pipeline running`. Focus on the icon, then Tab, lands on `Open the log of test:unit on GitLab`; Escape returns focus to `Pipeline failed` (expanded false).",
      "pass": true
    },
    {
      "recipe": "fixture step 5: filters",
      "observed": "Assignee: `Me 6, None 10, Anna Berg…`. Me gives `6 of 40` with the menu still open. Reviewer: `Me, None 14…`. Label: `None 8, backend, bug 11…`. bug gives `2 of 40`. Drafts/Ready/All: 0/2/2 (range: 5/35/40). × Label gives `6 of 40`; Clear filters gives `40 of 40`. Refresh with backend checked: `backend0=true`, `0 of 40`. Not shown: the narrowing box above 8 values, because no fixture script has more than 6 values per checklist (`many` Assignee: 6 items, no input). It is covered only by the choices.test.ts unit test.",
      "pass": false
    },
    {
      "recipe": "fixture step 6: filters remembered after reload",
      "observed": "Compare: Me + Drafts, then reload, gives `1 of 40`, pressed=Drafts, Assignee × still present. Range: Reviewer None + Ready, then reload, gives `12 of 40 pressed=Ready`. (The fixture's theme went back to dark after the reload.)",
      "pass": true
    },
    {
      "recipe": "fixture step 7: open changes (both windows)",
      "observed": "While working, the button is disabled with aria-busy=true. Then: `Opened !640 in a new window.` / `!639 is already open in another yamt window.` / `Could not fetch !638: fatal: unable to access 'https://gitlab.example/taskboard/taskboard.git/': Could not resolve host: gitlab.example` / `GitLab is still preparing the changes of !637; try again in a moment.`",
      "pass": true
    },
    {
      "recipe": "fixture step 8: noGlab / loggedOut / timeout (both windows)",
      "observed": "`glab is not installed (not found on PATH) — install glab, then Refresh. | Retry`; `glab is not logged in: gitlab.example: No token found (…) — run glab auth login in a terminal, then Refresh. | Retry`; `glab failed: glab timed out | Retry`. Retry after loggedOut: a MutationObserver saw `Loading merge requests` before the sentence came back. With noGlab showing, New tab works, and Back in the range window shows the file list.",
      "pass": true
    },
    {
      "recipe": "fixture step 9: slow / many",
      "observed": "slow, observer sequence: `0:Loading merge requests… | 20:20 of 20 | 40:40 of 40`. The partial list had 20 rows, not the 25 the design says (fixture LIST_PAGE=20), and there was no loading hint while page 2 was pending. many: `rows=500 500 of 500 merge requests (the newest 500; GitLab has more)`, in both windows.",
      "pass": true
    },
    {
      "recipe": "real app: range window --repo /tmp/yamt-mrf/rr --glab merge-requests --home /tmp/yamt-mrf/home",
      "observed": "Button adjacent to the gear. `5 of 5 merge requests`: !13, !12, !11 (Draft), !9, !8. CI hover: `Failed jobs|unit tests|test|lint|test|allowed to fail`. Clicking a job writes the opened.log line `argv: https://gitlab.example/taskboard/taskboard/-/jobs/301`. Assignee: Me 2, None 1, Anna Berg 1, Lee Park 1. Me+Drafts gives `0 of 5`; Ready gives `4 of 5`.",
      "pass": true
    },
    {
      "recipe": "real app: open !13, /proc child, repo unchanged, again → already open, stop",
      "observed": "`Opened !13 in a new window.` calls.log has the MergeRequestDetails query iid=13, auth status, commits/6ea97d8…/merge_requests, merge_requests/13. /proc: pid 273420 cwd=/tmp/yamt-mrf/rr `yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 --repo /tmp/yamt-mrf/rr`. REFS_SAME, STATUS_SAME, no .git/FETCH_HEAD. Opening again: `!13 is already open in another yamt window.` stop reports `yamt child pid 273420 stopped`; then pgrep gives NO_YAMT_LEFT.",
      "pass": true
    },
    {
      "recipe": "real app: restart same --home, --settings theme light",
      "observed": "`4 of 5 merge requests pressed=Ready theme=light`: the filter was remembered. CI box works in light. Screenshot /tmp/yamt-mrf/range-light.png (page).",
      "pass": true
    },
    {
      "recipe": "real app: compare --diff --dir /tmp/yamt-mrf/rr --glab merge-requests; --diff alone",
      "observed": "With --dir: the button is adjacent to the gear and the page lists `5 of 5 merge requests`. --diff alone: `noButton settings=true`. Afterwards pgrep gives NO_YAMT_LEFT.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; Linux 7.2.11-arch1-1 x64. MiniBrowser through app-session on private displays. Debug build: `cargo tauri build --debug --no-bundle`. Repository at /tmp/yamt-mrf/rr, not /var/tmp: the ownership hook refused writes outside tmpdir. Page screenshots: /tmp/mrf-{compare,range}-{dark,light}.png."
}
