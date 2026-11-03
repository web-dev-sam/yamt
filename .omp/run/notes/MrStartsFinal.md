# MrStartsFinal

Agent output (`agent://MrStartsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsFinal.md), collected 2026-11-03T20:11:19.189Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "B2 age ticks to \"1 minute ago\" ~61 s after load (both windows)",
      "excerpt": "Compare fixture (--diff --mr list): list loaded at 20:59 (hover \"20:59\"). The date was 21:00 just after the load. At 21:01:40 the age still read \"just now\" (≥100 s). At 21:02:26 it read \"1 minute ago\". Range fixture (--range-case review --mr list): loaded about 21:03:33 (hover \"21:03\"). Sampled every 15 s: \"just now\" at 21:04:13, 21:04:28, 21:04:43, 21:04:58, 21:05:14 and 21:05:29 (about 116 s), then \"1 minute ago\" at 21:05:44 (about 131 s). document.hasFocus() true, visibilityState \"visible\". agoText itself is right (relativeTime.test: 60 s → \"1 minute ago\"), so [INFERENCE] the timer that redraws the age fires late (it looks like about every 2 minutes, or it is reset once). Seen twice, same behaviour both times."
    },
    {
      "step": "D3 as written: --glab mr-conflicts, click Show Diff",
      "excerpt": "!32: \"glab failed: fake glab: the scenario has no answer graphql-merge-request-32.json\". !23: \"GitLab is still preparing the changes of !23; try again in a moment.\" !22: the same message. No child started (pgrep -af 'yamt --diff=' matched nothing; the only process was `target/debug/yamt --diff --mr`). This is already known (.omp/run/notes/MrAiCarry.md): the mr-conflicts scenario has no diffRefs. The brief's recipe can't be run as written. For the evidence I ran it again with scripts/range-repo.sh + --glab merge-requests; see the smoke list."
    }
  ],
  "smoke": [
    {
      "recipe": "A. just check (once, at 33fdd7a0, clean tree: git status empty)",
      "observed": "Every recipe ran through to hooks-test, the last one: golden \"ok …\" ×10, sfc-order, hooks-test \"ℹ tests 18 ℹ pass 18 ℹ fail 0\". No recipe failed (just stops at the first failure). Wall time 59.44 s.",
      "pass": true
    },
    {
      "recipe": "B1 start-fixture --name age --diff --mr list --size 1600x1000; click Merge requests",
      "observed": "Header: Back · Merge requests · \"just now\" · Refresh. Element `<span class=\"text-fg-muted\" aria-description=\"20:59\">just now</span>`, colour rgb(129,126,141), right edge 1472.4, Refresh left edge 1484.4 (12 px gap, next sibling is Refresh). Hover shows the tooltip \"20:59\" under it. Screenshot /tmp/vf/age-hover.png.",
      "pass": true
    },
    {
      "recipe": "B2 wait 61 s → \"1 minute ago\" with no click",
      "observed": "Still \"just now\" about 100–116 s after the load; changed to \"1 minute ago\" only between about 116 and 131 s (details in failures).",
      "pass": false
    },
    {
      "recipe": "B3 --mr slow: open, wait, click Refresh",
      "observed": "Before: aria-description=\"21:02\", \"just now\". Right after the click (21:03:01): still aria-description \"21:02\", \"just now\", one .animate-spin running (/tmp/vf/slow-refreshing.png). At 21:03:10: aria-description \"21:03\", \"just now\", no spinner.",
      "pass": true
    },
    {
      "recipe": "B4 header shots in Dark/Light; step 1 in the range window",
      "observed": "/tmp/vf/header-dark.png (data-theme dark) and /tmp/vf/header-light.png. For Light I set data-theme=\"light\" from the session; the muted \"just now\" sits left of Refresh in both. Range window (--range-case review --mr list): the span sits 12 px left of Refresh; hover tooltip \"21:03\" (/tmp/vf/range-hover.png, taken when it read \"1 minute ago\").",
      "pass": true
    },
    {
      "recipe": "C1 start-fixture --name open --diff --mr list --open-mr",
      "observed": "location.search \"?diff&mr=list&open=mergeRequests\". The page shows with no click: \"Back Merge requests just now Refresh … 40 of 40 merge requests … Snooze a reminder\". /tmp/vf/open-mr.png",
      "pass": true
    },
    {
      "recipe": "C2 without --open-mr; --range-case review --mr list --open-mr",
      "observed": "Without it: \"?diff&mr=list\", the compare tabs (\"Format Auto · Plain text Left Right 1 1\"). Range: \"?range=review&mr=list&open=mergeRequests\", the Files sidebar with the merge-request page and its rows (/tmp/vf/range-open-mr.png).",
      "pass": true
    },
    {
      "recipe": "C3 start-fixture --diff --open-mr without --mr",
      "observed": "\"app-session: start-fixture takes --open-mr only with --mr <script>\", recipe failed with exit code 1.",
      "pass": true
    },
    {
      "recipe": "D1 cargo tauri build --debug --no-bundle; yamt --help; yamt --repo <mr> --mr",
      "observed": "Built target/debug/yamt. Help: \"yamt --mr\", \"yamt --diff [--mr]\", \"yamt --diff=<a>..<b> [--repo <path>] [--mr]\", \"--mr  open the merge-request page at start; without --diff=<range> it means --diff\", \"--ai  … with --diff or --diff=<range>: the changes windows its merge-request page opens get it too\", \"YAMT_AI=1  in the environment: every start behaves as with --ai (unset, empty or 0: off)\". `--repo /tmp/vf/mr --mr` → \"yamt: --diff compares pasted text and takes no --repo\" + usage, exit=2.",
      "pass": true
    },
    {
      "recipe": "D2 start-app --diff --dir <mr> --glab mr-conflicts --mr; and without --mr",
      "observed": "With --mr: dataset.open \"mergeRequests\", the page at once: \"11 of 11 merge requests · Board themes !32 …\" (/tmp/vf/app-mr.png). Without it: dataset.open undefined, the compare tabs \"Format … Left Right\".",
      "pass": true
    },
    {
      "recipe": "D3 YAMT_AI=1 / YAMT_AI=0 + mr-conflicts, Show Diff",
      "observed": "Didn't run as written: there was no diff for !32, !23 or !22 (see failures).",
      "pass": false
    },
    {
      "recipe": "D3 run again: YAMT_AI=1/0, scripts/range-repo.sh /tmp/vf/plain, --glab merge-requests --mr, Show Diff on row 0",
      "observed": "YAMT_AI=1: child `target/debug/yamt --diff=531ea52…..6ea97d8… --repo /tmp/vf/plain --ai`. Private-display shot /tmp/vf/ai-child-thread.png: the child's window, docs/current.md:1, a new thread with buttons Comment / Ask AI / Cancel. YAMT_AI=0: child `… --repo /tmp/vf/plain` with no --ai.",
      "pass": true
    },
    {
      "recipe": "D4 start-app --diff --dir <git init, no remote> --mr",
      "observed": "The compare tabs (\"Format Auto · Plain text Left Right 1 1\"), no merge-request page, no role=alert/status elements (/tmp/vf/plain-mr.png). dataset.open still reads \"mergeRequests\" (the brief doesn't ask about it).",
      "pass": true
    },
    {
      "recipe": "D5 stop every session",
      "observed": "All sessions were stopped (age, rng, open, mr ×2, ai, ai0, plain); each stop reported \"session ended\" and the children were stopped. Afterwards `pgrep -af target/debug/yamt` matched nothing.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; Linux 7.2.11-arch1-1 x64. Fixtures: MiniBrowser/WebKitWebDriver via app-session. App: tauri-driver + Xvfb :3. Clicks in the child window used xdotool on :3. Commit 33fdd7a0. Scratch: /tmp/vf."
}
