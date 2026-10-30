# MrSmoke

Agent output (`agent://MrSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrSmoke.md), collected 2026-10-30T15:15:20.278Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "2. row shows 'working' before 'opened'",
      "excerpt": "Not observed, so not counted as a pass. I read the row 0.3 s, 1 s and 3 s after clicking 'Open the changes of !13'. Every read already said 'Opened !13 in a new window.' Each read takes longer than the working state lasted, so the working state was never seen."
    }
  ],
  "smoke": [
    {
      "recipe": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b ; EXIT=0 (8.3 s)",
      "pass": true
    },
    {
      "recipe": "1. start-app --range main...feature --repo /var/tmp/yamt-mr/rr --glab merge-requests: button placement",
      "observed": "Toolbar buttons: 'Send to GitLab (0)' x=1366, 'Merge requests' x=1527, 'Settings' x=1559. The Merge requests button sits directly left of the gear.",
      "pass": true
    },
    {
      "recipe": "1. list rows",
      "observed": "'5 of 5 merge requests', newest first. !13 'Snooze a reminder', created 2 days ago, 0 open discussions, 0 approvals, Pipeline failed. !12, 1 week ago, 1 discussion, 2 approvals, Pipeline passed. !11 Draft, 2 weeks ago, 1 discussion, 0 approvals, Pipeline running. !9, 4 weeks ago, 0, 0, no CI icon. !8, 1 month ago, 0, 1, Pipeline waiting for a manual job.",
      "pass": true
    },
    {
      "recipe": "1. filter click narrows the list and updates the count",
      "observed": "Clicked 'Drafts': the summary reads '1 of 5 merge requests' and only !11 is shown.",
      "pass": true
    },
    {
      "recipe": "1. CI hover on !13",
      "observed": "A popover titled 'Failed jobs' lists 'unit tests test', then 'lint test allowed to fail'; the allowed-to-fail job is last. Screenshot: /tmp/yamt-mr-ci-dark.png",
      "pass": true
    },
    {
      "recipe": "1. job click opens its URL",
      "observed": "Clicked 'Open the log of unit tests on GitLab'. opened.log: 'argv: https://gitlab.example/taskboard/taskboard/-/jobs/301'",
      "pass": true
    },
    {
      "recipe": "2. open !13 changes: child process",
      "observed": "/proc shows pid 33386 with cwd=/var/tmp/yamt-mr/rr running 'target/debug/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 --repo /var/tmp/yamt-mr/rr'. These are the base_sha and head_sha in merge-request-13.json. The parent process, pid 29912, runs in the session folder.",
      "pass": true
    },
    {
      "recipe": "2. child's own GitLab calls",
      "observed": "calls.log after the parent's 'api graphql … MergeRequestDetails … iid=13': 'auth status', 'api projects/:fullpath/repository/commits/6ea97d8…/merge_requests', 'api projects/7/merge_requests/13'. Every call has cwd /var/tmp/yamt-mr/rr.",
      "pass": true
    },
    {
      "recipe": "2. repository unchanged",
      "observed": "for-each-ref before and after shows the same 2 refs: feature 9c1ba3f…, main 4378055…. 'git status --porcelain' is empty both times. .git/FETCH_HEAD is absent both times ('No such file or directory').",
      "pass": true
    },
    {
      "recipe": "2. open !13 again",
      "observed": "The row says '!13 is already open in another yamt window.' and the yamt process count stays at 2.",
      "pass": true
    },
    {
      "recipe": "3. start-app --diff --dir rr --glab merge-requests",
      "observed": "The 'Merge requests' button is present. Clicking it lists the same 5 rows: !13, !12, !11, !9, !8, '5 of 5 merge requests'.",
      "pass": true
    },
    {
      "recipe": "3. start-app --diff (no --dir)",
      "observed": "The window's buttons are: New tab, Close Compare 1, Format covers JSON and XML only, Language, Previous change, Next change, Settings. There is no Merge requests button.",
      "pass": true
    },
    {
      "recipe": "4. restart with the same --home /var/tmp/yamt-mr/home",
      "observed": "The page opens with Drafts aria-pressed=true and All=false, 'Clear filters' visible, and '1 of 5 merge requests' showing !11. Drafts was the last filter set in step 1.",
      "pass": true
    },
    {
      "recipe": "5. --glab logged-out",
      "observed": "The page says 'glab is not logged in: gitlab.com — run glab auth login in a terminal, then Refresh.' with a Retry button. Back and Next change both responded; the file list still showed 'config' selected.",
      "pass": true
    },
    {
      "recipe": "5. --glab merge-requests-timeout (waited 23 s)",
      "observed": "The page says 'glab failed: glab timed out' with a Retry button. Back returned to the diff view: file list plus config 'Changed from a file to a symbolic link.' (/tmp/yamt-mr-timeout-back.png). My follow-up click on the file name failed because I chose a bad locator; this is not a finding.",
      "pass": true
    },
    {
      "recipe": "6. light theme (--settings '{\"theme\":\"light\"}'), list and CI box",
      "observed": "The same 5 rows and '5 of 5'. The CI hover shows 'Failed jobs: unit tests test / lint test allowed to fail' in a light popover. Screenshots: light /tmp/yamt-mr-ci-light.png, dark /tmp/yamt-mr-ci-dark.png",
      "pass": true
    },
    {
      "recipe": "7. stop ends the step-2 child window",
      "observed": "'stop --name mr1' reported \"children\":[] (the child was not listed). Afterwards 'pgrep -a yamt' printed 'no yamt process'. After the last session: 'no yamt process'.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. target/debug/yamt built with 'cargo tauri build --debug --no-bundle' (exit 0). All windows ran on private display :3 through just app-session. The repo is fresh from scripts/range-repo.sh /var/tmp/yamt-mr/rr. Commit ad881d5 could not be confirmed in HEAD: bash-guard blocked git in the repo root."
}
