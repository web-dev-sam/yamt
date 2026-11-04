# MrThreadsBoxR1

Agent output (`agent://MrThreadsBoxR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR1.md), collected 2026-11-04T16:54:46.978Z.

{
  "summary": "Fix round 1 of mr-threads-box. After a send, focus stays in the panel: the field, or the panel itself in Preview and for Submit. Escape now closes the panel, not the page. The box closes its thread and calls boxClosed on unmount, and closes when another row's thread is shown. The page Refresh doesn't close a pinned box. sfc-order passes. `isPerson` is now the boolean `isUser`. Fixture due rows mention their reviewer, so the design's review orders return.",
  "files_changed": [
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestReplyField.vue",
    "frontend/src/ui/MergeRequestThread.vue",
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts"
  ],
  "tests_added": [
    {
      "name": "useHoverBox.test: a_press_on_a_list_refresh_keeps_a_pinned_box",
      "proves": "#2392/#2397: a pointerdown on a [data-refreshes-list] element leaves a pinned box open; a press elsewhere outside still closes it"
    },
    {
      "name": "fixtureMergeRequestDiscussions.test: every_discussion_id_is_40_hex_and_unique_and_only_the_due_rows_ask_their_reviewer (renamed)",
      "proves": "#2387: only !633/!623/!618 (@sam) and !602 (@anna) carry a mention, with its text; no generated row has earlier comments"
    },
    {
      "name": "fixtureMergeRequestDiscussions.test: the_review_orders_the_smoke_expects (expectations restored)",
      "proves": "#2387: Me !618 !633 !623 !622 !638 !603 !608 and Anna !602 !622 !630 !612 !632 !617 (design table): due rows with the reviewer's turn first, soonest first, equal-day tie, !622 sorted with the rest"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend sfc-order / typecheck / lint / fmt:check / unused / test",
      "observed": "sfc-order exit 0 (#2378); vue-tsc -b no output; lint exit 0; 'All matched files use the correct format' (821 files); knip no findings; Test Files 299 passed, Tests 4475 passed"
    },
    {
      "command": "start-fixture --name mtr1 --diff --mr list --open-mr --size 1600x1000 (dark). Step 3: hover 13 count, hover d01, Shift; d02 Shift; field Shift+a; lone Shift over d03; Escape, Tab, Shift",
      "observed": "box [1235,324..1578,902], panel [595,194..1235,962] (right=box left; top clamped, innerHeight 962); current ['01']; d02 → 'Thread: Overview', 1 fixture_thread …02; field 'A', current ['02'], still 1 fixture_thread; Escape → focus row 02; Tab → row 06, Shift → fixture_thread …06"
    },
    {
      "command": "Step 3 #2385: !637 d01 panel open; hover '1 open discussion' (!639, box 1235,219..1542,322), hover its row 063900, Shift",
      "observed": "{expanded:['1 open discussion'], dialogs:['Thread: src/board/card.ts:11'], current:['063900'], active:'DIV dialog'}, so !637's box and panel closed; log fixture_thread {iid: 639 …063900}"
    },
    {
      "command": "Step 7 C8: d01 type Thanks + Add comment; Later + Add review; Ctrl+Enter 'Once more'; 'refuse it'; Escape",
      "observed": "fixture_write comment; field ''; row01 'Sam Weller just now Author's turn … Thanks'; active TEXTAREA after each send. draft → 'PendingLater', header '…Submit review3 pending'. Ctrl+Enter → one more comment write. refuse → alert 'Could not add the comment: 403 Forbidden', field 'refuse it'. Escape → dialog null, focus row …0001, page true"
    },
    {
      "command": "Step 7 !636: d14 Shift, field 'hi', Ctrl+Enter, Escape",
      "observed": "'Add review (disabled) tip=Comments on this merge request are locked to project members.', same for Add comment, 'Resolve thread (disabled) tip=You may not resolve this thread.'; fixture_write count stayed 10; Escape → dialog 0, focus row 14, page true"
    },
    {
      "command": "Step 8 C9: d01 Submit review (aria-description read), click, Escape",
      "observed": "tip 'Publish your 3 pending comments on this merge request'; fixture_write {kind: \"submit\", iid: 637}; fixture_discussions {iids: \"637\"}; no Submit button; Pending articles 0; active 'DIV Thread: src/board.ts:12'. Escape → dialog null, focus row …0001, page true (#2395)"
    },
    {
      "command": "Step 9 C10: d02 Resolve; Unresolve; Resolve; Escape; Escape; reopen",
      "observed": "'Unresolve thread', row02 'Resolved', muted, check; header '2 of 12'; opener 13; active TEXTAREA. Unresolve → 'Author's turn', '2 of 13'. Resolve again → Escape: dialog null, focus row 02, page true (#2396); Escape → opener '12 open discussions'. Reopen ids 03,04,01,05…13 (no 02)"
    },
    {
      "command": "Step 9/10 Preview-mode resolve: d03 Shift, Preview, Resolve thread, Escape",
      "observed": "'Unresolve thread', active 'DIV Thread: Overview' (the panel); Escape → dialog null, focus row 03, page true (#2383/#2389)"
    },
    {
      "command": "Step 10 C2: pointer on h2; click 'the docs'; Close; Shift on focused row; page Refresh; press on the list",
      "observed": "pointer away: box+panel stay; link: fixture_page {page: \"https://docs.example/x\"}, both stay; Close → dialog [], box stays, focus 000001; Refresh → expanded ['13 open discussions'], dialog stays, fixture_thread 6→7 (…01), fixture_discussions ×3 (#2392/#2397); list press → expanded [], dialogs []"
    },
    {
      "command": "Step 10 unmount: panel open (d04 resolved), Back clicked by script (no pointerdown), MutationObserver, 'Merge requests'",
      "observed": "opener seen ['10 open discussions','13 open discussions']: boxClosed ran on unmount (count dropped), then the re-listed fixture row gave 13 again; no dialog, aria-current 0; hover → ids 04,01,05…13 (d02 and d03 gone), no panel (#2379/#2384/#2390)"
    },
    {
      "command": "Step 10/#2384 Off: panel open on d05, Back by script, Settings → Off, return",
      "observed": "{discussionOpeners:0, dialogs:0, counts:['SPAN 0 open discussions','SPAN 2 …','SPAN 13 open discussions','SPAN 3 …']}: !637 is a plain count, no box"
    },
    {
      "command": "just app-session shot --name mtr1 .omp/run/shots/mtbox-r1-panel-dark.png; stop",
      "observed": "Dark shot, file .omp/run/shots/mtbox-r1-panel-dark.png: the panel sits beside !636's box with its row marked. Session stopped; folder removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (TS only): 496 killed, 29 survived, 7 no coverage, 93.23 %; a rerun on the same code showed the same survivors",
    "survivors": [
      "fixtureMergeRequestDiscussions.ts:54 ASKED literals ({} and each \"\") — gate-covered: a module constant the runner never re-evaluates (#732); the_review_orders_the_smoke_expects and …only_the_due_rows_ask_their_reviewer assert every entry",
      "fixtureMergeRequestDiscussions.ts:92 `person === null` → false; NoCoverage on `[]` — equivalent: every ASKED username is in PEOPLE, so personNamed is never null there; the arm only keeps the type total",
      "discussions.ts:58 `username !== null` → true — equivalent: a Person's username is a string, never null (line renamed only)",
      "Not changed this round (shown because the files are diffed against HEAD): fixtureMergeRequestDiscussions.ts:43-48, 97, 149, 157-158; discussions.ts:47-52, 190, 211; useHoverBox.ts:134, 136"
    ]
  },
  "acceptance_not_run": [
    "Light theme: the assignment named WebKit dark for steps 3, 7–10, so I ran only dark.",
    "Step 10 'count dropped' after return: observed 13→10 while away (boxClosed ran), then the re-list reset it to 13. The fixture listing's !637 count is fixed (fixtureMergeRequestData.ts, not mine); real app not run."
  ],
  "deviations_from_brief": [
    "useHoverBox `pinned`: a pointerdown on an element inside `[data-refreshes-list]` no longer closes a pinned box (verify step 10 amendment, #2392). The contract line 'a pointerdown outside the area closes it' gains this exception. MergeRequestsView.vue needed no change: Refresh and Retry already carry the attribute.",
    "Two box behaviours added beyond the brief. On unmount while open, the box runs the same close path as the open watch (closeThread if its thread is shown, then boxClosed). When the shown thread's iid becomes another row's while this box is open, this box calls the hover box's close() (#2385).",
    "MergeRequestReplyField emits a new `focusPanel` (in Preview the field is hidden). MergeRequestThread handles it, and its Submit now goes through `publish()`, which focuses the panel first.",
    "Fixture: an ASKED table (618/633/623 → sam, 602 → anna) prefixes the first discussion with an @mention. Anna's 'Draft All' order is now !602 !622 !630 !627 !612 !606 !632 !617, not the design's …!632 !617 !606. Under B5 (authorsTurn), !606 waits on fewer threads than !632/!617; the due-first part matches the table.",
    "Docs keeper, ui/AGENTS.md:61: a press on `[data-refreshes-list]` keeps the pinned box; unmount closes the thread and calls boxClosed; another row's thread closes this box; sends keep focus (field, or panel in Preview; Submit → panel).",
    "Docs keeper, ui/AGENTS.md:73: name useHoverBox's pinned rule as a second reader of `data-refreshes-list`. mr-review-mode-design.md 'Expected orders': the Anna Draft All row under B5 and the ASKED mentions."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestThread.vue Retry button",
      "risk": "Retry is removed when the thread loads, so its focus likely falls to BODY and the next Escape may leave the page. Same defect as #2383, not listed, not fixed."
    },
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:161 Refresh :disabled",
      "risk": "After a pointer Refresh, focus sat on the Refresh button (observed). An Escape there is the page's and leaves the page, even with the panel open."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestData.ts OPEN_DISCUSSIONS",
      "risk": "The fixture list count ignores resolved threads in the store, so any re-list shows 13 for !637 again. Verify step 10's 'count dropped after coming back' can't be seen in the fixture."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue (overlapping boxes)",
      "risk": "At 1600x1000 a pinned !637 box covers the next rows' counts. Hovering them reaches !637's box, so the #2385 check needs a row whose box fits above (!639)."
    }
  ]
}
