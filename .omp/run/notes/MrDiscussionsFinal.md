# MrDiscussionsFinal

Agent output (`agent://MrDiscussionsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsFinal.md), collected 2026-11-03T16:14:37.893Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check (HEAD 2fe58a24, clean tree)",
      "observed": "Ran once: vitest 'Test Files 271 passed (271) / Tests 4076 passed (4076)'; 'arch-check: ok'; 'map-check: ok'; golden 'ok …' x10; hooks-test 'pass 18 fail 0'; EXIT=0 (74.9 s).",
      "pass": true
    },
    {
      "recipe": "B1 Load fully (--diff and --range-case review, --mr list)",
      "observed": "Openers !639:1 !638:2 … !602:2 (26 rows). Calls in sequence: 'fixture_discussions {iids: \"639,…,621\"}' (13) answered 10 refused 2; '624,…,602' (16) answered 10; '609,608,606,605,603,602' answered 6. 26 answered once each, no count-0 row asked. !638 box at once: '1 of 2 waits for you | DV Dmitri Volkov | 5 days ago | Your turn | Overview | A single line … on…' then 'SW Sam Weller | Waiting for an answer | src/board/column.ts'.",
      "pass": true
    },
    {
      "recipe": "B2 Text and links (both windows)",
      "observed": "!636 box: b=0 script=0; text 'Please RENAME this. | **not bold** <b>not bold</b> &amp; <script>x</script> | Third line…'. Line click logged only 'fixture_page {page: \".../merge_requests/632#note_7081\"}' (diff) and '.../638#note_7021' (review); no row-page open. !639's line is a DIV, not a button.",
      "pass": true
    },
    {
      "recipe": "B3 Keyboard (both windows)",
      "observed": "Tab from 'Set a due date': active '1 open discussion', aria-expanded true, box '1 of 1 waits for you / CR Chiara Rossi'. Focus stays on the opener inside the hover area. Escape: {box:false, activeIsOpener:true, exp:'false'}.",
      "pass": true
    },
    {
      "recipe": "B4 Load lazily (both windows)",
      "observed": "After Refresh: no log lines. Hover !635: box texts ['Loading discussions…','1 of 2 waits for you / BO Ben Okafor'], one line 'fixture_discussions {iids: \"635\"}'. Hover away (box closed) and back: no new line. Review window has no review-mode button (buttons: Match case, merge base…, feature, View as tree, Prev/Next change, Collapse unchanged fragments, Send to GitLab (0), Merge requests, Settings). Absence recorded.",
      "pass": true
    },
    {
      "recipe": "B5 Off (both windows)",
      "observed": "After Refresh and hover: log []. Plain tooltip DIV 'pointer-events-none fixed z-500…: 2 open discussions'; 0 aria-expanded discussion openers. /tmp/md-off-tooltip.png",
      "pass": true
    },
    {
      "recipe": "B6 Switching applies at once (both windows)",
      "observed": "Off → Load fully → Back, no Refresh: 'fixture_discussions' with all 26 iids answered 10 refused 2, then 16 answered 10, then 6 answered 6. One round, no second. Hover showed '1 of 2 waits for you'.",
      "pass": true
    },
    {
      "recipe": "B7 Failure (both windows)",
      "observed": "!633 box 'glab failed: glab timed out', count 1 still shows; no 'Could not read' text, [role=alert] [] (problem bar empty).",
      "pass": true
    },
    {
      "recipe": "B8 shots yamt Dark/Light",
      "observed": "/tmp/md-diff-box-Dark.png, /tmp/md-diff-box-Light.png, /tmp/md-review-box-Dark.png, /tmp/md-review-box-Light.png (viewed: !638 box open, readable in both themes).",
      "pass": true
    },
    {
      "recipe": "C1 Real app full (fake glab mr-discussions)",
      "observed": "calls.log: '-F iids=[\"82\",\"81\",\"79\",\"78\"] -F first=4', then '-F iids=[\"79\"] -F first=1 -f discussionsAfter=d-2', no other. !82 '2 of 3 wait for you': Anna Berg Your turn Overview; Ben Okafor Your turn src/board/dueDates.ts:6; Sam Doe Waiting for an answer src/board/card.ts:12. !81 b=0 script=0 'Please **check** <b>THIS</b> & that … <script>alert(1)</script>'. !79 one (search.ts:3). !78 'glab failed: GitLab sent no merge request !78', count 1. !80 tooltip '0 open discussions'.",
      "pass": true
    },
    {
      "recipe": "C2 Links",
      "observed": "!82 lines [DIV:Anna Berg, BUTTON:Ben Okafor, BUTTON:Sam Doe]. Clicking Sam's line wrote to opened.log 'argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_103'. opened.log is in <session>/glab/, not <scratch>/md/glab as the brief says.",
      "pass": true
    },
    {
      "recipe": "C3 Lazy",
      "observed": "After Refresh the discussions argv count stayed 2. Hover !81 added one line '-F iids=[\"81\"] -F first=1'. Hovering again: count stayed 3.",
      "pass": true
    },
    {
      "recipe": "C4 Off",
      "observed": "After Refresh, hovers on all 5 counts (plain spans, 0 aria-expanded): the discussions argv count stayed 3.",
      "pass": true
    },
    {
      "recipe": "C5 Settings file",
      "observed": "settings.json while Off: {\"antialiasing\":\"subpixel\",\"discussionDetails\":\"off\",\"theme\":\"dark\"}. After Load fully: {\"antialiasing\":\"subpixel\",\"theme\":\"dark\"}.",
      "pass": true
    },
    {
      "recipe": "C6 App log and shots",
      "observed": "4 lines, one per read (each full read covers the 82,81,79,78 and d-2 argv pair): 'event=\"mergeRequests.discussions_read\" fields=answered=4 asked=4 ms=73 refused=1', 'answered=1 asked=1 ms=39 refused=0', '…ms=56 refused=1', '…ms=55 refused=1'. The 4th follows a list reload on returning (#2217). No body, name or address in them. Shots /tmp/md-app-box-Dark.png, /tmp/md-app-box-Light.png.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0, node v26.13.0, pnpm 12.0.0, Linux 7.2.11-arch1-1. Fixture: WebKitWebDriver+MiniBrowser on a private display. App: target/debug/yamt (cargo tauri build --debug --no-bundle) on Xvfb :3. Scratch repo /tmp/mdvf-vw2P/md."
}
