# MrDiscussionsSmoke

Agent output (`agent://MrDiscussionsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsSmoke.md), collected 2026-11-03T15:42:30.068Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B6 (--diff window, session md): Off → Load fully without Refresh",
      "excerpt": "flaky: in session md (after the B4/B5 lazy→Off sequence and theme switches), I chose Settings → Off, cleared the log, chose Load fully and waited 3 s in Settings. That logged one full round: fixture_discussions 26 iids \"639,638,636,…\" / ns_read {asked: 26, answered: 10, refused: 2}, 16 iids \"624,623,…\" / {asked: 16, answered: 10}, 6 iids \"609,608,606,605,603,602\" / {asked: 6, answered: 6}. Back → Merge requests (no Refresh) then logged the same three-call round a second time (12 lines). The first B6 run in that session also showed 6 fixture_discussions lines. Reopening the page while already full gave []. It did not happen again in md2 (--range-case review) or in a fresh --diff session md3 across 3 sequences (Off→full; Off→Refresh→full; lazy→hover→Off→Refresh→full): one round each. The trigger is unknown; when it happens, every row is asked twice. Goes to mr-discussions-state/-page."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 Load fully (--diff, --range-case review)",
      "observed": "Counts>0: 639:1 638:2 636:1 635:2 633:1 … 603:1 602:2; count-0 rows (640,637,634,631,…) never asked. --diff calls: 26 iids \"639,…,602\", then 16 \"624,…,602\", then 6 \"609,…,602\": each row answered once. In range the first call is 13 iids \"639,…,621\". !638 box at once: \"1 of 2 waits for you / DV Dmitri Volkov 5 days ago Your turn Overview A single line that runs on, … on…\" then \"SW Sam Weller 5 days ago Waiting for an answer src/board/column.ts Done, see the new commit.\"",
      "pass": true
    },
    {
      "recipe": "B2 Text and links (both)",
      "observed": "!636 box innerText: \"Please RENAME this.\\n**not bold** <b>not bold</b> &amp; <script>x</script>\\nThird line…\"; b/script elements in box: 0. Clicking the line logged only fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/merge_requests/636#note_7040\"} in both windows. !639's pageless line (Chiara Rossi, src/board/card.ts:11) has 0 buttons.",
      "pass": true
    },
    {
      "recipe": "B3 Keyboard (both)",
      "observed": "Tab to \"2 open discussions\" (!638): aria-expanded=true, box \"1 of 2 waits for you\" open, focus on the opener; the next Tab is inside the box (Dmitri's line). Escape: box gone, activeElement \"2 open discussions\", aria-expanded=\"false\".",
      "pass": true
    },
    {
      "recipe": "B4 Load lazily (both)",
      "observed": "After Refresh: fixture_discussions []. A hover on !635 (seen by a MutationObserver) showed [\"Loading discussions…\",\"1 of 2 waits for you\"] and logged one line {iids: \"635\"}. The same on !638 with {iids: \"638\"}. Hovering away and back: no new line. In range-case review there is no review-mode button (the only /review/ match is the \"Reviewer\" filter).",
      "pass": true
    },
    {
      "recipe": "B5 Off (both)",
      "observed": "After Refresh: fixture_discussions []. The count is a SPAN aria-label \"2 open discussions\" and there are 0 aria-expanded openers. The hover tooltip (aria-hidden div) reads \"2 open discussions\" at opacity 1. Shot: /tmp/mdv/fixture-diff-off-tooltip.png",
      "pass": true
    },
    {
      "recipe": "B6 Switching applies at once (both)",
      "observed": "Off → Load fully → Back, with no Refresh: three calls follow, and hovering !638 shows \"1 of 2 waits for you\". Range and fresh --diff: one round. In --diff session md the round ran twice (see failures).",
      "pass": false
    },
    {
      "recipe": "B7 Failure (both)",
      "observed": "!633 (DISCUSSIONS_FAILED_IID): box \"glab failed: glab timed out\", class text-problem-error; count button \"1 open discussion\" still there; [role=alert] count 0.",
      "pass": true
    },
    {
      "recipe": "B8 shots",
      "observed": "/tmp/mdv/fixture-diff-Dark.png and /tmp/mdv/fixture-diff-Light.png show the !638 box open; /tmp/mdv/fixture-range-Light.png. Source: page (WebDriver).",
      "pass": true
    },
    {
      "recipe": "C1 Full (target/debug/yamt, --glab mr-discussions)",
      "observed": "calls.log has 2 MergeRequestDiscussions lines: -F iids=[\"82\",\"81\",\"79\",\"78\"] -F first=4; then -F iids=[\"79\"] -F first=1 -f discussionsAfter=d-2. !82 \"2 of 3 wait for you\": Anna Berg Your turn Overview; Ben Okafor Your turn src/board/dueDates.ts:6; Sam Doe Waiting for an answer src/board/card.ts:12. !81: \"Please **check** <b>THIS</b> & that…<script>alert(1)</script>\" as text (0 elements). !79: Sam Doe src/board/search.ts:3. !78: \"glab failed: GitLab sent no merge request !78\", count 1. !80: tooltip \"0 open discussions\".",
      "pass": true
    },
    {
      "recipe": "C2 Links",
      "observed": "Clicking (a) wrote `argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/82#note_103` to opened.log, which is in the session folder /tmp/yamt-app-session-mdapp-*/glab/. Per-li button flags for !82: [false,true,true]; (c) is no button.",
      "pass": true
    },
    {
      "recipe": "C3 Lazy",
      "observed": "Discussion lines: 2 before Refresh and 2 after it; 3 after hovering !81, the new one -F iids=[\"81\"]; still 3 after hovering again.",
      "pass": true
    },
    {
      "recipe": "C4 Off",
      "observed": "After Refresh: 3 lines. After hovering all five counts: still 3. Openers: 0.",
      "pass": true
    },
    {
      "recipe": "C5 The file",
      "observed": "settings.json read {\"antialiasing\":\"subpixel\",\"discussionDetails\":\"lazy\",\"theme\":\"dark\"}, then \"discussionDetails\": \"off\", then after Load fully {\"antialiasing\":\"subpixel\",\"theme\":\"dark\"} with no key.",
      "pass": true
    },
    {
      "recipe": "C6 App log and shots",
      "observed": "Three lines, one per frontend call: event=\"mergeRequests.discussions_read\" fields=answered=4 asked=4 ms=76 refused=1; answered=1 asked=1 ms=39 refused=0; answered=4 asked=4 ms=55 refused=1. Grepping the log for names and gitlab.example finds only the web_page 'opening a GitLab page' line from the click. Shots: /tmp/mdv/app-box.png, /tmp/mdv/app-Dark.png, /tmp/mdv/app-Light.png",
      "pass": true
    }
  ],
  "environment": "HEAD 96103a1f; rustc 1.99.0; node v26.13.0; pnpm 12.0.0; MiniBrowser on a private display via app-session; app built with cargo tauri build --debug --no-bundle on Xvfb :3. The fixture log was read through a console.info hook set with `read`."
}
