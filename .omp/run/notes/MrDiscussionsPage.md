# MrDiscussionsPage

Agent output (`agent://MrDiscussionsPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsPage.md), collected 2026-11-03T15:29:32.197Z.

{
  "summary": "Each merge-request row's discussion count now opens a hover box (`MergeRequestDiscussions.vue`). It asks for the row's discussions on open, shows a whose-turn header (or the loading/refused/failed words) and lists lines, the viewer's turn first. A line with a page opens the comment. With \"Off\" or a count of 0 the row keeps the plain count. Settings has a \"Discussion details\" section in the compare and range roots. New words, two problem steps and the settings seam action are in, with tests.",
  "files_changed": [
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestDiscussionSetting.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/settingsStore.ts",
    "frontend/src/ui/settingsStore.test.ts",
    "frontend/src/ui/CompareApp.vue",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "mergeRequestsText.test.ts: a refused discussions answer %j reads %j, the list's words (catches the two drifting apart)",
      "proves": "All three refused answers (glabMissing, notLoggedIn, failed) read as the list's glab words, ending with 'then Refresh.'."
    },
    {
      "name": "mergeRequestsText.test.ts: the discussion box's and setting's words are the request's (a renamed choice or hint)",
      "proves": "DISCUSSIONS_LOADING, DISCUSSION_DETAILS, the three options with their labels in order, and the hint, word for word."
    },
    {
      "name": "mergeRequestsText.test.ts: the answer %j for a %s page shows %j (+ notOffered/discussion row)",
      "proves": "A comment page GitLab did not list says \"This comment's page was not listed by GitLab, so yamt did not open it.\""
    },
    {
      "name": "problemText.test.ts: a failed merge-request call at %s says what failed (+ discussions, discussion rows)",
      "proves": "\"Could not read the discussions: …\" and \"Could not open the comment's page: …\""
    },
    {
      "name": "settingsStore.test.ts: the settings view's Discussion details choice reaches the window's action (a seam that drops it)",
      "proves": "useSettingsStore().setDiscussionDetails('lazy') reaches the registered store's action."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint && pnpm -C frontend typecheck",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" / $ vue-tsc -b — no findings, exit 0"
    },
    {
      "command": "pnpm -C frontend test; pnpm -C frontend fmt:check; pnpm -C frontend unused",
      "observed": "Test Files 271 passed (271) / Tests 4069 passed (4069), including mergeRequestTitles.test.ts and the fence tests. 'All matched files use the correct format.' knip: clean."
    },
    {
      "command": "just map-check",
      "observed": "missing: fixtureMergeRequestDiscussions.ts, ui/mergeRequestDiscussions.ts (project-map); command read_discussions and set_discussion_details (architecture.md, ipc-contract); ChunkSource.setDiscussionDetails; MergeRequestSource.readDiscussions. All are the state slice's names, for the docs keeper. My new .vue files are untracked, so it does not list them yet."
    },
    {
      "command": "app-session start-fixture --name md --diff --mr list --size 1600x1000; hover the '2 open discussions' opener, nth 0 (!638)",
      "observed": "The header showed '1 of 2 waits for you' at once. Line 1: 'Dmitri Volkov · 5 days ago · Your turn · Overview', with the 400-char excerpt ending in '…'. Line 2: 'Sam Weller · 5 days ago · Waiting for an answer · src/board/column.ts'. Each line has a picture (initials)."
    },
    {
      "command": "read in !632's box: innerText, b and script elements",
      "observed": "has '<b>not bold</b>': true, has '**not bold**': true, b: 0, script: 0. Light screenshot: \"**not bold** <b>not bold</b> &amp; <script>x</script>\" shown as typed."
    },
    {
      "command": "console capture: the first fixture_discussions lines after opening the page (full)",
      "observed": "iids \"639,638,636,635,633,632,630,629,627,626,624,623,621\" → answered 10; then \"624,…,602\" (16) → 10; then \"609,…,602\" (6). No count-0 iid (640, 637, 634, 631, …) is ever asked. Calls carry more than 10 iids, and the unanswered rest is sent again; see acceptance_not_run."
    },
    {
      "command": "hover !635's box, click 'div[tabindex].fixed li button' nth 0",
      "observed": "Log: [info] mergeRequests.fixture_page {page: \"…/merge_requests/635#note_7050\"} and no other page open. !627's pageless line is a <li> div with no button, cursor default."
    },
    {
      "command": "Settings → Load lazily → Back → Merge requests → Refresh; hover !638, then !635",
      "observed": "No discussion line after the Refresh. A MutationObserver recorded the header as 'Loading discussions…' then '1 of 2 waits for you'. Lines: fixture_discussions {iids: \"638\"}, then {iids: \"635\"}."
    },
    {
      "command": "lazy: hover away (Refresh) and back to !635; then focus !632's due-date button and press Tab",
      "observed": "Hover back: still 2 fixture_discussions lines. Tab: active = '2 open discussions:!632', aria-expanded true, new line {iids: \"632\"}."
    },
    {
      "command": "Settings → Off → Back → Refresh; hover a count. Then Settings → Load fully → Back, with no Refresh",
      "observed": "Off: log [], 0 aria-expanded openers, tooltip ['2 open discussions']. Load fully: three fixture_discussions/discussions_read pairs (26→10, 16→10, 6→6) and no list reload; a hover shows '1 of 2 waits for you'."
    },
    {
      "command": "hover !633 (DISCUSSIONS_FAILED_IID) and !629 (logged out); shot /tmp/md-638-dark.png, md-633-dark.png, md-box-light.png, md-box-light2.png",
      "observed": "!633 header: 'glab failed: glab timed out' in the error colour, count '1' still shown. !629: 'glab is not logged in: … — run glab auth login in a terminal, then Refresh.' Boxes look right in yamt Dark and yamt Light."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: no Rust changes; Stryker 96.42% (458 killed, 1 survived, 16 no coverage). mergeRequestsText.ts 93.78%, problem.ts 100%, problemText.ts 97.02%, settingsStore.ts 100%",
    "survivors": [
      "problemText.ts:169 ArrayDeclaration `found ?? []` — line not changed by this slice (brokenText). The 16 no-coverage mutants are existing exhaustive `default:` blocks, also on lines this slice did not change."
    ]
  },
  "acceptance_not_run": [
    "Smoke 1 'calls of at most 10 iids, each made once' fails: the state queue (read-only here) sends every queued iid per call (13, 16, 6), the fixture answers 10, and the rest is resent. Each iid is answered once; no count-0 iid is asked."
  ],
  "deviations_from_brief": [
    "mergeRequestsText.ts was at 291 lines and the cap is 300. `discussionsRefusedText` is now the one home of the list's glab words. `listFailureText` returns null for loaded/cut, otherwise `discussionsRefusedText(end)`. `rerequestReplyText`'s glabMissing/notLoggedIn cases call it too, so `glabMissingListText`/`notLoggedInListText` are gone. Same words; the tests still pass.",
    "`discussionsRefusedText` has no `default: never` block; tsgolint switch-exhaustiveness-check covers it (TS3 allows both forms), to stay ≤ 300 lines.",
    "The header is `text-fg-muted` while loading or read, and `text-problem-error` when refused or failed (the brief named no colour).",
    "Each line is a `<component :is>`: `button` (type=button, cursor-pointer, hover:bg-hover) when it has a page, `div` otherwise. Inner rows are spans (no block elements inside a button). The excerpt uses `wrap-break-word` (the repo's Tailwind v4 class) instead of `break-words`. The opener is `flex items-center gap-1 rounded p-0.5 hover:bg-hover`.",
    "No edit to ipc/index.ts was needed: the box takes no DiscussionPlace/DiscussionNote type by name.",
    "ui/AGENTS.md: a new Discussions paragraph holds the state slice's ui lines too. The compare root's sentence 'SettingsView has no slot here' now says the slot holds only MergeRequestDiscussionSetting.",
    "Docs keeper: tree.md rows for MergeRequestDiscussions.vue and MergeRequestDiscussionSetting.vue, plus the map-check names listed in smoke_evidence."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestDiscussions.ts (send)",
      "risk": "Calls carry more than 10 iids, and an unanswered tail is sent again (the acceptance line above). With Rust's 10-per-call limit this is more traffic than the brief's 'at most 10, each once'."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue (lines key)",
      "risk": "Lines are keyed by index, since a discussion has no id. A new answer for the same open box re-renders the lines in place; harmless because they are static."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue (box placement)",
      "risk": "An open box covers the rows below it. A pointer moving straight onto a lower row's count stays inside this box's area, the people box's behaviour too. Seen only with the scripted hover, not by hand."
    }
  ]
}
