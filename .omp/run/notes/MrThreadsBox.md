# MrThreadsBox

Agent output (`agent://MrThreadsBox`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBox.md), collected 2026-11-04T16:21:22.537Z.

{
  "summary": "The new turn rule (B1–B6) is in the core: `turnOf`, `discussionTurns`, `turnCounts` and `turnText`/`turnSummaryText` with five turn kinds, and `reviewOrdered` now counts \"Author's turn\" as waiting on the author. `useHoverBox` gains `pinned`. The discussions box now has rows keyed by discussion id, Shift to show a thread, the mounted thread panel, a refresh button and the Resolved mark. Two exits stay open: focus is lost after Resolve, and the panel can't be top-aligned in a 1000 px window. Escape inside the field still needs a check on R1 (4fe594c0).",
  "files_changed": [
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/discussions.test.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts"
  ],
  "tests_added": [
    {
      "name": "discussions.test: b1_* (4 cases)",
      "proves": "B1: the viewer wrote last → Author's turn; when the viewer is the author → the starter's turn, or Waiting when the author or a deleted person started it; a blank name falls back to the username"
    },
    {
      "name": "discussions.test: b2_* (5 cases)",
      "proves": "B2: the viewer started it, is mentioned by someone else, is mentioned after answering, is the author, or wrote in the middle → Your turn"
    },
    {
      "name": "discussions.test: b3_* (7 cases)",
      "proves": "B3 in order: the first mention that is not a self-mention (the author's → Author's turn), not the author's → Author's, the author answered the starter → starter's, only the author → Open"
    },
    {
      "name": "discussions.test: b4_header_counts_only_the_viewers_turn_and_orders_them_first",
      "proves": "The viewer's turn comes first, then newest first; equal times keep GitLab's order; counts are viewersTurn/authorsTurn/total; '3 of 6 wait for you'"
    },
    {
      "name": "b5_review_mode_speaks_for_the_reviewer; reviewOrder.test b5_review_order_counts_authors_turns_as_waiting_on_the_author",
      "proves": "Ben on case 6 → \"Ben Okafor's turn\" (kind viewer); the order ranks by authorsTurn on each row's own author (null author included)"
    },
    {
      "name": "discussions.test: b6_a_deleted_person_is_never_viewer_author_or_mentioned, no_viewer_is_never_the_viewers_turn",
      "proves": "A null person is never matched; a null viewer gets no viewer turn even when author is also null"
    },
    {
      "name": "useHoverBox.test: a_pinned_box_stays…, a_pinned_box_ignores_an_outside_scroll, a_press_outside_closes_a_pinned_box, an_unpinned_box_keeps_todays_rule",
      "proves": "RK73: pinned ignores leave/blur/scroll; one capture pointerdown listener on document only while open and pinned; a press outside closes, inside does not; unpinned is unchanged"
    },
    {
      "name": "MergeRequestDiscussionsBox.test (SSR): rows_are_buttons…, a_marked_row_reads_resolved…, the_refresh_button_has_its_tip, a_failed_reload_keeps_the_rows",
      "proves": "!637's 13 rows, words, order, '4 of 13'; resolved d02: check+Resolved, muted, aria-current, '4 of 12', count 13 until boxClosed → 12; refresh tip and spin; a failed reload shows the error header, keeps rows"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck / lint / fmt:check / unused / test",
      "observed": "vue-tsc -b no errors; oxlint+eslint clean; 'All matched files use the correct format' (820 files); knip no findings; Test Files 298 passed, Tests 4472 passed"
    },
    {
      "command": "just app-session start-fixture --name mtbox --diff --mr list --open-mr --size 1600x1000; hover '13 open discussions'; read rows",
      "observed": "'4 of 13 wait for you || 01 Your turn / 03 / 04 / 05 Your turn / 02 Author's turn / 06 Ben Okafor's turn / 07 Author's turn / 08 Anna Berg's turn / 09 Open / 10–13 Author's turn'; !636: '1 of 3 waits for you || 16 Your turn / 14 Anna Berg's turn / 15 Waiting for an answer'. Review mode Ben (Reviewer filter cleared): '06 Ben Okafor's turn'"
    },
    {
      "command": "C1: hover d01, press Shift; hover d02, Shift; click textarea, Shift+a; Escape, Shift+Tab×3 to d03, Shift",
      "observed": "Panel right 1235 = box left 1235; panel top 194 vs box top 324 (bottom-clamped); aria-current [01]; focus on the panel; one fixture_thread {iid: 637, discussion: …01}. d02 replaces it. Field value 'A', still 2 fixture_thread lines. Focus d03 + Shift → 3rd fixture_thread …03; Shift+Tab opened nothing"
    },
    {
      "command": "C2: hover Refresh (far away); scroll the list (scrollTop=200); click 'the docs' link; Escape; Escape; reopen + Close; reopen + click the search box",
      "observed": "Pointer far away and scroll: both kept. Link: 'fixture_page {page: \"https://docs.example/x\"}', both kept. Escape → panel gone, focus on row …01; Escape → box gone, focus on the opener. Close → panel gone, box kept, focus on row. Click outside → both gone. Escape from inside the textarea did the same two steps on 0a0e45a0"
    },
    {
      "command": "C6: type lines into d01's field and read the textarea rect",
      "observed": "2 lines: h 70 (lh 20, pad 4); 8 lines: h 170; 20 lines: h 250, scrollHeight 408, scrollTop 156, overflow auto. After closing and reopening, d01 still has 20 lines; d03 is empty (d02 holds 'A' from C1)"
    },
    {
      "command": "C10: d03 Shift → 'Resolve thread'; then click outside; reopen",
      "observed": "Button reads 'Unresolve thread'; row 'Resolved', muted, check svg; header '3 of 11'; count still '13 open discussions'. After close the count reads '11 open discussions'; reopen lists 01 04 05 … 13 (d03 gone)"
    },
    {
      "command": "D1: d01 panel open, click 'Reload discussions' (MutationObserver on the box)",
      "observed": "Seen 'spin 11' then 'still 11' (rows kept while spinning). Logs: one 'fixture_discussions {iids: \"637\"}' and one 'fixture_thread {iid: 637, discussion: …01}'"
    },
    {
      "command": "C11: Settings → Off, back to the page, hover the 13 count, Shift; then 'Load lazily'",
      "observed": "Off: 0 opener buttons, plain counts only; after Shift dialogs 0, boxes 0. Lazy: header '3 of 11 wait for you', panel 'Thread: src/due.ts:4'"
    },
    {
      "command": "just app-session shot --name mtbox .omp/run/shots/mtbox-panel-dark.png; data-theme=light, shot .omp/run/shots/mtbox-panel-light.png",
      "observed": "Dark and light: the panel sits left of the box with d01 marked in the box and the 20-line field scrolling; light dialog bg rgb(247, 248, 249)"
    },
    {
      "command": "scripts/local-conflicts-repo.sh /var/tmp/mtbox-rT5o/mtbox; cargo tauri build --debug --no-bundle; just app-session start-app --name mtboxapp --diff --dir … --glab mr-threads --mr",
      "observed": "!90: '4 of 13 wait for you', 01/03/04/05 Your turn, 02/07/10–13 Author's turn, 06 Ben Okafor's turn, 08 Anna Berg's turn, 09 Open. Shift on d01 shows 4 comments + 1 pending; '· Edited 3 days ago by Dmitri Volkov' on sam's"
    },
    {
      "command": "real app: type 'Thanks', click 'Add comment'; read calls.log; app-session stop mtboxapp",
      "observed": "calls.log has one POST: 'api --include --method POST projects/taskboard%2Ftaskboard/merge_requests/90/discussions/0000…01/notes --input -' with 'stdin: {\"body\":\"Thanks\"}'; field cleared; d01 row now 'Author's turn'. Session stopped"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — TS only (no Rust): 589 mutants, 560 killed, 17 survived, 12 no coverage (95.08%)",
    "survivors": [
      "discussions.ts:41-52 DISCUSSIONS_LABEL/UNKNOWN_AUTHOR/VIEWER/AUTHOR/WAITING/OPEN/WAITING_TEXT literals — gate-covered: module-level constants the vitest runner never re-evaluates (#732); the b* tests assert each word and kind",
      "discussions.ts:58 `username !== null` → true — equivalent: a Person's username is a string, so it never equals null",
      "discussions.ts:190, 211 exhaustive default (NoCoverage) — equivalent: unreachable by type",
      "reviewOrder.ts:23 NO_TURNS {} — gate-covered: module constant (#732)",
      "reviewOrder.ts:88, 92 viewerPossessive 'inside' — lines not changed by this slice (they only moved)",
      "useHoverBox.ts:131 `() => false` → `() => undefined` — equivalent: both are falsy at every use",
      "useHoverBox.ts:133 at {} — a line that only moved; not changed",
      "mergeRequestsText.ts:160,211,252,274 exhaustive defaults (NoCoverage) — lines not changed, unreachable by type"
    ]
  },
  "acceptance_not_run": [
    "Escape inside the field with panel R1 (4fe594c0) in place: my tree is 0a0e45a0 (Main said to proceed on it). On 0a0e45a0, two Escapes from the textarea close the panel, then the box. Verify brief step 7 checks this on R1.",
    "WebKit C10 \"close the box: !637's count reads 12\": the run showed 13 → 11, not 13 → 12. d02 had been resolved earlier in the same session and a page re-show reloaded the list count. The SSR test shows 13 → 12 on a fresh slice."
  ],
  "deviations_from_brief": [
    "SSR test is ui/MergeRequestDiscussionsBox.test.ts, not MergeRequestDiscussions.test.ts. Main approved: the brief's name differs from mergeRequestDiscussions.test.ts only in case (vue-tsc TS1149).",
    "Main granted ui/mergeRequests.test.ts for review_mode_orders_the_shown_rows… only: `later`'s discussion gained earlier:[sam]. A lone anna comment is Author's turn under B3.2.",
    "ipc/fixtureMergeRequestDiscussions.test.ts the_review_orders_the_smoke_expects: three review orders changed to what the new rule gives (single-comment fixture rows are mostly Author's turn now).",
    "RESOLVED is not duplicated into mergeRequestsText.ts: the box imports the panel slice's RESOLVED from mergeRequestThreadText.ts (one source). RELOAD_DISCUSSIONS and SHOW_THREAD_KEY are in mergeRequestsText.ts as briefed.",
    "B2 is coded as its union: viewer is the author, or wrote any comment, or is mentioned in any. B2.1 (started it) is a case of B2.4 (wrote one). The 'a comment whose author is not the viewer' guard on B2.2 is subsumed by B2.4. Results equal the brief's rule for every input.",
    "The B5 review-order test is in reviewOrder.test.ts, not discussions.test.ts (it tests reviewOrdered). b5_review_mode_speaks_for_the_reviewer is in discussions.test.ts.",
    "The box's list scrolls on its own (`ul` min-h-0 overflow-y-auto; the box is a flex column). In WebKitGTK the box's scrollbar covered the refresh button and swallowed its click.",
    "The panel's place and turn words come from the entry's discussion, else from the thread's own `discussion` (D3, when a reload dropped it).",
    "mergeRequestsShown.ts and ipc/index.ts are unchanged; MergeRequestRow already carries `author`.",
    "Docs keeper: tree.md row for ui/MergeRequestDiscussionsBox.test.ts; RK71/RK73 proving tests are named above."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue (panel slice)",
      "risk": "After 'Resolve thread' WebKit leaves focus on BODY (the pressed button is disabled or replaced). A next Escape reaches the page (it left the merge-request screen in the smoke), not the panel. The panel owner should keep focus in the panel."
    },
    {
      "location": "frontend/src/ui/MergeRequestThread.vue placement",
      "risk": "At 1600x1000 with !637's box at y=324, the 768 px panel is clamped up (top 194), so tops are not aligned. C1's 'top-aligned' holds only where it fits."
    },
    {
      "location": "frontend/src/ui/useHoverBox.ts focusInside",
      "risk": "After a window blur while pinned, focusInside is false; if the pin ends with focus inside, a later pointer leave can close the box while it has focus."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue boxed",
      "risk": "With the panel shown and details switched to 'Off', the box stays (shownId keeps `boxed`) until it closes."
    }
  ]
}
