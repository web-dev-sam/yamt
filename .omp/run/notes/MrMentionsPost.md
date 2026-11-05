# MrMentionsPost

Agent output (`agent://MrMentionsPost`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsPost.md), collected 2026-11-05T10:35:30.826Z.

{
  "summary": "The range window's \"Text to post\" box (`RangeMessageEditor.vue`, Post only) now has `@` completion. It uses `useMentions(field, () => knownMentions(linedUpRow(check, rows), []))`: the list opens with the lined-up merge request's people once its row is loaded, and otherwise shows search results only. `rangeGitLab.ts` gains `linedUpRow`. The fixture gains `?gitlab=listed`, which lines up with !640. `mergeRequestOf(script)` gives the merge request for a script, and `pendingPosting` now takes the merge request as its first argument.",
  "files_changed": [
    "frontend/src/ui/RangeMessageEditor.vue",
    "frontend/src/ui/rangeGitLab.ts",
    "frontend/src/ui/rangeGitLab.test.ts",
    "frontend/src/ipc/fixtureGitLab.ts",
    "frontend/src/ipc/fixtureGitLab.test.ts",
    "frontend/src/ipc/fixtureReview.ts",
    "frontend/src/ipc/fixtureReview.test.ts",
    "frontend/src/ipc/fixtureThreads.ts",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "rangeGitLab.test.ts the_lined_up_row_is_the_loaded_row_at_the_merge_requests_page",
      "proves": "linedUp with !640's page over the ?mr=list rows (given reversed) returns the !640 row object"
    },
    {
      "name": "rangeGitLab.test.ts no_loaded_row_or_no_lined_up_merge_request_gives_none",
      "proves": "null for: [] rows; linedUp !12 (no row at that page); notLinedUp; null check — kills linedUpRow's guards"
    },
    {
      "name": "fixtureGitLab.test.ts listed_lines_up_with_the_newest_listed_row",
      "proves": "gitLabCheck(\"listed\") → linedUp !640 with fixtureRows(0,1)[0]'s title and page; pendingPosting(mergeRequestOf(\"listed\"),\"Hi\",7) links `${page}/diffs`"
    },
    {
      "name": "fixtureGitLab.test.ts %s lines up with !12 (linedUp, checking, refusal, stopped)",
      "proves": "the existing scripts still line up with !12 unchanged"
    },
    {
      "name": "fixtureReview.test.ts ?gitlab=listed checks lined up with !640 and its send's pending posting names !640",
      "proves": "the source's check answers !640; the queued and refused notes are posted naming !640 with its /diffs link; the seeded pending note stays !12 (draftNote 101)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck / lint / fmt:check / unused / sfc-order / test",
      "observed": "vue-tsc -b clean; lint exit 0; fmt:check \"All matched files use the correct format.\"; knip clean; sfc-order clean; \"Test Files 306 passed (306) Tests 4571 passed (4571)\""
    },
    {
      "command": "1. just app-session start-fixture --name mmp --range-case review --threads seeded --gitlab listed --mr list --open-mr --size 1600x1000; click Back",
      "observed": "The merge-request page loaded its rows (buttons include \"Resolve conflicts of !640\"). Back, then board.ts opened. Send title: \"Send the 2 queued comments to your pending review on !640\"."
    },
    {
      "command": "2. click .cm-thread-count nth 3 (board.ts:102 note), click Post; read activeElement",
      "observed": "\"TEXTAREA Text to post value=\\\"Is this still used?\\\" ac=list\""
    },
    {
      "command": "3. press Ctrl+End; type ' @'; read the list and the console-hook lines",
      "observed": "{\"value\":\"Is this still used? @\",\"list\":[\"AB Anna Berg @anna\",\"SW Sam Weller @sam\"],\"lines\":[]}. !640 in fixtureRows: author anna, assignees [sam], reviewers [], approvers [], so each person shows once."
    },
    {
      "command": "4. type 'an', wait 1.5 s, read",
      "observed": "{\"value\":\"Is this still used? @an\",\"list\":[\"AB Anna Berg @anna\"],\"lines\":[\"[info] mergeRequests.fixture_people_search {text: \\\"an\\\"}\"]}"
    },
    {
      "command": "5. read the list rect vs .cm-scroller and elementFromPoint (twice: list inside the field, and the caret on the 4th line)",
      "observed": "1st: list [1121,539,1290,577] in scroller [942,82,1591,953], inside:true, centreInList:true. 2nd (text \"…\\n\\n\\n@an\"): list [1018,599,1187,637], field bottom 604, listBottomBelowField:true, inside:true, centreInList:true, bottomEdgeInList:true"
    },
    {
      "command": "6./7. ArrowDown, then Enter; then type '@', ArrowDown with two options",
      "observed": "After Enter: {\"value\":\"Is this still used? @anna \",\"active\":\"Text to post\",\"listOpen\":false}. With two options: options [\"false:AB Anna Berg @anna\",\"true:SW Sam Weller @sam\"], active \"Text to post\", file still \"M src/board/board.ts\"."
    },
    {
      "command": "8. type 'an'; Escape; Escape",
      "observed": "First Escape: {\"value\":\"Is this still used? @anna @an\",\"active\":\"Text to post\",\"listOpen\":false,\"boxes\":1}. Second Escape: {\"boxes\":0}."
    },
    {
      "command": "9. reopen Post; type '@an' on a new line; Enter; Queue; Send to GitLab (3); read the store's postings",
      "observed": "Queued: {\"kind\":\"queued\",\"text\":\"Is this still used?\\n\\n\\n@anna \"}. After Send: {\"kind\":\"pending\",\"text\":\"Is this still used?\\n\\n\\n@anna \",\"draftNote\":104,\"mergeRequest\":\"!640\",\"link\":\"https://gitlab.example/taskboard/taskboard/-/merge_requests/640/dif…\"}. Seeded note: still !12, draftNote 101."
    },
    {
      "command": "10. restart with --gitlab linedUp (--mr list --open-mr, Back), Post, Ctrl+End, type ' @', then 'an'",
      "observed": "Send title \"…on !12\". After ' @': {\"listOpen\":false,\"lines\":[]}. After 'an': {\"list\":[\"AB Anna Berg @anna\"],\"lines\":[\"[info] mergeRequests.fixture_people_search {text: \\\"an\\\"}\"]}"
    },
    {
      "command": "11. shot of step 4: /tmp/mmp-step4-dark.png; /tmp/mmp-step4-light.png (<html data-theme=\"light\"> set live)",
      "observed": "Both shots show \"Anna Berg @anna\" under the caret inside the box at board.ts:102, readable in dark and in light."
    },
    {
      "command": "12. just app-session stop --name mmp",
      "observed": "{\"stopped\":\"mmp\",\"session\":\"ended\",…,\"folder\":\"removed /tmp/yamt-app-session-mmp-gfpFah\"}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (stryker on fixtureGitLab, fixtureReview, fixtureThreads, rangeGitLab): 614 killed, 38 survived, 4 no coverage; score 93.60",
    "survivors": [
      "fixtureGitLab.ts:127 `||`→`&&` / condition→false (×4) and 127:53, 128 NoCoverage — equivalent: fixtureRows(0,1) always has a row with a page; the guard only narrows the types (noUncheckedIndexedAccess, page nullable)",
      "fixtureGitLab.ts:57 `listed: true`→false — equivalent: GITLAB_SCRIPTS is a membership table read only through Object.hasOwn",
      "fixtureThreads.ts:41 mergeRequestOf(\"linedUp\")→mergeRequestOf(\"\") — equivalent: every script except \"listed\" gives !12"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Light theme came from setting <html data-theme=\"light\"> live, as the task said. The brief's `--settings` flag is not available on start-fixture.",
    "Smoke log lines were captured by wrapping console.info through `app-session read`; the fixture does not write the browser console to the session logs. The queued and pending postings were read from the store via `import(\"/src/ui/rangeStore.ts\")` in the page. Nothing was committed for either.",
    "The textarea gained `block`. Inside the new `relative` wrapper an inline textarea leaves a baseline gap; the reply field's textarea has `block` too.",
    "`aria-autocomplete` and the other mention attributes reach the textarea through `fieldAria = computed(() => mentions?.fieldAria.value ?? {})`, so the template needs no ternary (VU6). The Edit box binds `{}`.",
    "`mergeRequestOf(\"listed\")` builds !640's ref through a private `newestListed()`, which throws if fixtureRows has no newest row with a page.",
    "\"listed\" is placed after \"linedUp\" in GitLabScript and GITLAB_SCRIPTS, so the fixture_miss test's `known` list in fixtureReview.test.ts changes to match. I also added a test that the !12 scripts still line up with !12.",
    "Step 5's \"painted over the lines below the box\" was checked with the list hanging below the textarea, over the Queue/Cancel row. It did not reach the code lines below the thread host."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/rangeGitLab.ts:183",
      "risk": "linedUpRow matches on the exact strings `row.page === webUrl`. It assumes REST `web_url` equals GraphQL `webUrl` (brief [INFERENCE]). A trailing-slash or host-case difference would quietly leave only search results."
    },
    {
      "location": "frontend/src/ui/RangeMessageEditor.vue:32",
      "risk": "useMentions runs only when box === \"post\" at setup. This depends on RangeMessage.vue mounting a fresh instance per box (v-if/v-else-if). If it is ever changed to swap `box` on a live instance, the Post box will lose its mention list."
    }
  ]
}
