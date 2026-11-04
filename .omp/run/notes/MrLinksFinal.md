# MrLinksFinal

Agent output (`agent://MrLinksFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksFinal.md), collected 2026-11-04T02:41:44.224Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check (worktree @ f2deacf5)",
      "observed": "Exit 0, 176 s. Last lines: golden 'ok vueuse-use-magic-keys', check-sfc-order, then hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "B.1 column (diff+range, dark+light)",
      "observed": "All 4 runs: '!640 info1357 links1397 ci1437, !639 info1357 links1397 ci1437, !638 info- links- ci1437, !637 info1357 links1397 ci-'. !637 has no pipeline box. No fixture_links line before the first hover (console hook added after load).",
      "pass": true
    },
    {
      "recipe": "B.2 hover opens",
      "observed": "Observer: [\"Loading…\",\"Epics…\"]. One 'mergeRequests.fixture_links {iid: 640}' and 'links_read {iid: 640, kind: \"read\", epics: 3, issues: 4, commits: 3, hidden: 3, ms: 401}'. Pointer on '&3 Board redesign': still open. Pointer outside both: aria-expanded 'false', box gone. Hover again and click the button: no new fixture_links, no fixture_page, href unchanged.",
      "pass": true
    },
    {
      "recipe": "B.3 groups and lines",
      "observed": "'Epics / &3 / Board redesign / &4 / Old board / Closed / design&2 / Not found or no access / Issues / #12 / … / #13 / … / other/lib#5 / Fix date parsing / Closed / secret/vault#9 / Not found or no access / Commits / fa3335f3 / Backfill due dates / a1b2c3d4…e5f6a7b8 / Commits a1b2c3d4 through e5f6a7b8 / secret/vault@0badc0de / Not found or no access'. Icons: epic path M12.83…, issue circle r=1, commit circle r=3.",
      "pass": true
    },
    {
      "recipe": "B.4/B.5 lines and parents",
      "observed": "fixture_page: '…/taskboard/taskboard/-/work_items/12', '…/secret/vault/-/issues/9', 'https://gitlab.example/groups/taskboard/-/work_items/3' (Open parent: &3 Board redesign), '…/-/work_items/12' (Open parent: #12 Snooze a reminder). Box stayed open and href was unchanged. Only 2 parent buttons, on #12 and #13. Both windows.",
      "pass": true
    },
    {
      "recipe": "B.6/B.7 empty and failure",
      "observed": "!639: 'No linked epics, issues or commits.' !636: 'Could not read the links: glab timed out / Retry'. Retry showed !640's lines, with a second fixture_links {iid: 636}. !634: 'glab is not logged in: gitlab.example: No token found (…). — run glab auth login in a terminal, then Retry. / Retry'. Hovering again asked again (2× fixture_links {iid: 634}, kind notLoggedIn).",
      "pass": true
    },
    {
      "recipe": "B.8 refresh",
      "observed": "After Refresh and hovering !640: [\"Loading…\",\"Epics…\"], with a new 'fixture_links {iid: 640}' and 'links_read … ms: 400'. Both windows.",
      "pass": true
    },
    {
      "recipe": "B.9 keyboard",
      "observed": "Tab order: links button (expanded true), &3, &4, design&2, #12, 'Open parent: &3 Board redesign', #13, 'Open parent: #12 Snooze a reminder', other/lib#5, secret/vault#9, fa3335f3, a1b2c3d4…e5f6a7b8, secret/vault@0badc0de. Enter logged fixture_page '…/secret/vault/-/commit/0badc0de'. Escape: 0 boxes, focus on the links button.",
      "pass": true
    },
    {
      "recipe": "B.10 shots",
      "observed": "~/Projects/yamt-verify-links-shots/B-{diff,range}-{dark,light}-{box,row}.png (8 files). Viewed diff dark and light boxes: box under !640's link icon, group icons, parent arrows on #12 and #13.",
      "pass": true
    },
    {
      "recipe": "C.1 real app list",
      "observed": "'!62 links, !61 links, !60 links, !59 links, !58 links, !57 none'. calls.log before hover: auth status, api projects/:fullpath, MergeRequestPage. No MergeRequestLinks.",
      "pass": true
    },
    {
      "recipe": "C.2 !62",
      "observed": "&3 Board redesign; &4 Old board Closed; design&2 Design system; #12 (+Open parent: &3); #13 (+Open parent: #12); other/lib#5 Closed; web#6 Web card (no parent); secret/vault#9 and #99 Not found or no access; fa3335f3 Backfill due dates; 6ea97d8c Snooze a reminder; a1b2c3d4…e5f6a7b8; secret/vault@0badc0de Not found. opened.log: '…/groups/taskboard/-/work_items/3', '…/merge_requests/62/diffs?commit_id=6ea97d8c1111222233334444555566667777aaaa', '…/secret/vault/-/issues/9'.",
      "pass": true
    },
    {
      "recipe": "C.3/C.4 !59 !61 !58 !60",
      "observed": "!59: '&8 Not found or no access ; #20 Free issue ; #21 Free task ; Open parent: #20 Free issue', no error. !61: empty sentence. !58: 'Commits / fa3335f3 / Not found or no access / secret/vault@0badc0de / Not found or no access' (its fixture has only plain links without titles), with no MergeRequestLinks call. !60: 'Could not read the links: glab: a deadline line / Retry'.",
      "pass": true
    },
    {
      "recipe": "C.5 logs",
      "observed": "calls.log for !62: auth status, projects/:fullpath, MergeRequestDescription, one MergeRequestLinks with -f path0..path5. stdin:/-X count: 0. Rust: 'INFO yamt_merge_requests::links: read a merge request's links iid=62 outcome=\"read\" epics=3 issues=6 commits=4 not_shown=3 calls=1 score=50'. App: 'INFO frontend: event=\"mergeRequests.links_read\" fields=commits=4 epics=3 hidden=3 iid=62 issues=6 kind=\"read\" ms=52'. Each ask has one line, with no titles or addresses.",
      "pass": true
    },
    {
      "recipe": "C.6 shots",
      "observed": "~/Projects/yamt-verify-links-shots/C-dark-box.png, C-dark-row59.png, C-light-box.png. Viewed C-light-box: light theme, !62 box with 3 epics, 6 issues, 4 commits.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; WebKitGTK MiniBrowser and xvfb available. Worktree ../yamt-verify-links @ f2deacf5, removed. Scratch repo ~/Projects/yamt-verify-links-scratch left: the guard blocked rm -rf outside /tmp. Page console captured by wrapping console.info after load."
}
