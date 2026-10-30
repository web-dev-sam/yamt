# MrPage

Agent output (`agent://MrPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPage.md), collected 2026-10-30T15:11:14.809Z.

{
  "summary": "Both windows now have the merge-request page. A git-pull-request button sits directly left of the gear in every header that shows one, empty-range header included. MergeRequestsView has Back, Escape, filter checklists, Draft buttons, Clear filters and rows with a CI box. New fence PM10 lives in scripts/windowFence.ts. app-session gains `--diff --dir`, `--glab` with `--diff` (fake-open, opened.log), `start-fixture --mr`, and a stop that ends child yamt windows. map-check lists MergeRequestSource.",
  "files_changed": [
    "frontend/src/ui/MergeRequestsButton.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestFilter.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/src/ui/CompareView.vue",
    "frontend/src/ui/RangeView.vue",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/CompareApp.vue",
    "frontend/src/ui/AGENTS.md",
    "frontend/scripts/fences.ts",
    "frontend/scripts/fences.test.ts",
    "frontend/scripts/windowFence.ts",
    "frontend/scripts/app-session/args.ts",
    "frontend/scripts/app-session/args.test.ts",
    "frontend/scripts/app-session/startArgs.ts",
    "frontend/scripts/app-session/startArgs.test.ts",
    "frontend/scripts/app-session/start.ts",
    "frontend/scripts/app-session/fakeGlab.ts",
    "frontend/scripts/app-session/stop.ts",
    "frontend/scripts/app-session/processes.ts",
    "frontend/scripts/app-session/processes.test.ts",
    "scripts/map-check.sh"
  ],
  "tests_added": [
    {
      "name": "fences.test: a merge-request page file importing any window's root or lsp/ violates PM10",
      "proves": "MergeRequest*/mergeRequest*/CiStatus* files under src/ui (.ts, .vue, .test.ts) are refused for each of the 6 root files and for lsp/, each with its reason"
    },
    {
      "name": "fences.test: merge-request page files importing shared ui files, and the roots importing the page, violate nothing",
      "proves": "PM10 has no false positives: seam, ChoiceButtons, core, roots importing the page, non-matching names, ui/internal"
    },
    {
      "name": "startArgs.test: start-app --diff --dir starts the compare window in that folder and passes the app no --repo",
      "proves": "`--dir` becomes opens.startDir, and the app argv stays `--diff`"
    },
    {
      "name": "startArgs.test: start-app --dir goes only with --diff",
      "proves": "`--dir` together with --range, --repo or --fresh-repo is refused"
    },
    {
      "name": "startArgs.test: start-app --glab goes with --diff as with --range",
      "proves": "`--glab` is accepted with --diff; a scenario name that is a path is still refused"
    },
    {
      "name": "startArgs.test: start-fixture --mr adds the script…; --mr refuses the merge window",
      "proves": "produces `?diff&mr=`, `?diff=<case>&mr=`, `?range=…&gitlab=…&mr=` (encoded); `--mr` alone or without a value is refused"
    },
    {
      "name": "processes.test: environ entry matching; a running process named yamt with the entry is found",
      "proves": "stop sweeps only processes named yamt that hold the exact session entry (never a prefix), with their start time"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint / fmt:check / unused / sfc-order / test",
      "observed": "lint exit 0; 'All matched files use the correct format.'; knip and sfc-order: no findings; 'Test Files 234 passed (234) Tests 3216 passed (3216)'"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "only src/ipc/tauriMergeRequests.ts(13,11) TS2322 and (22,63) TS2345 (the channel change in ad881d5)"
    },
    {
      "command": "start-fixture --diff --mr list (mrc) and --range-case review --mr list (mrr): steps 1–3",
      "observed": "Button right 1555, gear left 1559, next sibling Settings, also with range=empty. Without mr: mr 0, gear 1. Opening gives focus Back; Escape and Back return focus to 'Merge requests'; picking a tab or file closes the page; an open checklist eats Escape. Rows newest first ('Snooze a reminder !640 created 5 hours ago 0 0'), date on hover, zeros dimmed, long title has ellipsis with the full title on hover."
    },
    {
      "command": "steps 4–5 (both windows)",
      "observed": "Failed-CI hover lists test:unit, test:e2e, then lint:docs 'allowed to fail'. The box stays on a job and closes on leaving. A running pipeline says 'Pipeline running'. Tab reaches the jobs; Escape returns to the icon. A job click logs fixture_job …/-/jobs/9001. Assignee [Me 6, None 10, …]: one click gives '6 of 40', menu stays open. Label lists None first; the narrow box (16 values, injected) is focused. Draft 5/35/40; × and Clear filters work."
    },
    {
      "command": "steps 5 (Refresh) and 6",
      "observed": "With backend checked ('8 of 40'), Refresh shows ['backend 0', checked] and '0 of 40'. After location.reload the filters come back: 'Assignee: Me' + Drafts in compare, 'Reviewer: Me' in range."
    },
    {
      "command": "steps 7–9 (both windows)",
      "observed": "!640 busy then 'Opened !640 in a new window.'; !639 already open; !638 'Could not fetch !638: fatal: …'; !637 still preparing. noGlab, loggedOut and timeout each show their sentence plus Retry, and tab/file switching still works. slow shows 20 rows (page size 20) with Refresh disabled, then 40. many shows '500 of 500 … (the newest 500; GitLab has more)'. empty shows 'No open merge requests.'"
    },
    {
      "command": "dark/light screenshots in /var/tmp/yamt-mr-shots/",
      "observed": "c2-page, c4-ci, c5-assignee, c5-narrow, c7-open, c8-timeout (dark compare); c-light-ci2 (light compare); r2-page, r3-truncated, r5-kept-zero, r1-empty-range (dark range); r-light-ci, r-light-filter (light range); app-range-page, app-compare-light (real app)"
    },
    {
      "command": "real app: --range main...feature --repo /var/tmp/yamt-mr-page/rr --glab merge-requests; --diff --dir …/rr --glab … --settings light; --diff",
      "observed": "Range and compare(--dir): button 1555 / gear 1559, theme light. The page opens with Back focused; Escape and Back return focus to the button. calls.log: auth status, projects/:fullpath, 2× graphql. The list fails with 'e.rows.map' (needs ad881d5). --diff without --dir shows no button. stop reports children:[]."
    },
    {
      "command": "just mutants HEAD",
      "observed": "All files 64.39% (733 killed, 3 timeout, 63 survived, 344 no cov); every survivor on a changed line is listed in mutation"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (web; .vue not mutated): 733 killed, 3 timeout, 63 survived, 344 no coverage; windowFence.ts 97.18%, startArgs.ts 96.98%, args.ts 92.8%",
    "survivors": [
      "windowFence.ts:44 `?.[1]?.`→`?.[1].` — equivalent: the group is required, so [1] is defined whenever exec matches (moved unchanged from fences.ts)",
      "windowFence.ts:44 `?? \"\"`→other string — equivalent: isWindowRoot is false for both",
      "processes.ts:140 PROCESS_ID filter→true — equivalent: non-numeric /proc entries are self/thread-self (comm node) or unreadable",
      "processes.ts:147 `environ !== null`/`startTicks !== null`→true — equivalent: a matching yamt has a readable environ and stat; the guards exist for the type",
      "stop.ts:21-37, fakeGlab.ts (moved), start.ts startFolder — wiring: process launch/stop, exercised by the app sessions above; runningAppsWith/holdsEntry are tested"
    ]
  },
  "acceptance_not_run": [
    "Real-app steps that need the list (5 rows, filters/CI, the opened.log job line, opening !13 with its child, alreadyOpen, refs/status/FETCH_HEAD unchanged, filters across a restart, logged-out/timeout sentences): need ad881d5. Lists fail with 'e.rows.map' here.",
    "typecheck: the two tauriMergeRequests.ts errors remain (fixed by ad881d5). The real app was built with `vite build --mode tauri` + cargo tauri build with an empty beforeBuildCommand.",
    "just map-check: red until the docs pass. map-check.sh now lists the 4 MergeRequestSource methods as missing from architecture.md."
  ],
  "deviations_from_brief": [
    "Main granted frontend/scripts/windowFence.ts: PM7/PM9/PM10 and the AI-file rule moved there, behaviour unchanged (fences.ts went from 318 to 239 lines). tree.md line: `scripts/windowFence.ts` — window-root fences PM7, PM9, PM10 (`windowFinding`), called by fences.ts.",
    "app-session/fakeGlab.ts is new (start.ts was at 302 lines): fakeGlab/glabEnv, fake-open on PATH, YAMT_FAKE_OPEN_LOG=<session>/glab/opened.log. tree.md needs a line. processes.ts gains holdsEntry/runningAppsWith; stop.ts sweeps them.",
    "Design §8 writes `start-app --range … --dir`; range keeps the existing `--repo`. `--dir` is new and goes only with `--diff` (the compare start folder = tauri-driver's cwd).",
    "The stop sweep matches `XDG_CONFIG_HOME=<state.configDir>` (= home/.config, already in the state) instead of HOME, and only processes whose comm is `yamt`.",
    "RangeApp's empty-range header is now v-if emptyText + v-show screen files, so focus can return to the button (this also fixes Settings' focus return there).",
    "The CI 'running' icon uses text-primary, not info-border: the 50%-alpha blue was barely visible in light.",
    "Five new components (VU15): each is named by design §2.3.",
    "CiStatusBox derives its aria-label from ciBox(status, [], false) narrowed; core could export a ciStatusText. MergeRequestsView repeats SettingsView's 8-line goBack rule (design says so); a composable would need a new file.",
    "Docs pass: tree.md ui lines for MergeRequestsButton/MergeRequestsView/MergeRequestRow/MergeRequestFilter/CiStatusBox.vue. Architecture §5.1 needs MergeRequestSource findGitLabProject/listMergeRequests/openMergeRequest/openJobPage. skill://verification needs --diff --dir, --glab with --diff, opened.log and --mr.",
    "args.test.ts: the --glab test now accepts --diff; appArgs calls use the new diff shape {startDir}."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/CiStatusBox.vue:120",
      "risk": "Holding relies on pointerleave of the wrapper span, whose fixed box is a DOM descendant. WebDriver hover was observed; a real mouse path when the box is clamped above the icon was not."
    },
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:33",
      "risk": "focusedBefore is document.activeElement at mount. If WebKit does not focus a clicked button (macOS), focus will not return to the button. Linux was observed."
    },
    {
      "location": "frontend/src/ui/MergeRequestFilter.vue:64",
      "risk": "Tab from the narrowing box closes the checklist (menuKey). Real typing was observed only via `type`."
    },
    {
      "location": "frontend/scripts/app-session/stop.ts:36",
      "risk": "stopProc signals the process group. A child yamt that is not its own group leader would be reported 'gone' while alive (range_window uses process_group(0))."
    }
  ]
}
