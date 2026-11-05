# MrPersonDiscussionsView

Agent output (`agent://MrPersonDiscussionsView`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsView.md), collected 2026-11-05T14:43:45.623Z.

{
  "summary": "The merge-request page now has a \"Discussions\" button in its filter row. It swaps the row list for one person's discussions view and keeps the list's scroll. The view has a header (Back to list, person picker, status, reload), one alert line per failed row with Retry, and its entries. Each entry has a chevron, starter, time, MR, place and the first comment clamped to four lines, then the writers row with a +N fold and the turn word. Expanded entries show the thread inline. Shift expands. MergeRequestMenu is now generic over { label }.",
  "files_changed": [
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/MergeRequestPersonView.vue",
    "frontend/src/ui/MergeRequestPersonEntry.vue",
    "frontend/src/ui/MergeRequestPersonPicker.vue",
    "frontend/src/ui/MergeRequestWriters.vue",
    "frontend/src/ui/MergeRequestMenu.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/MergeRequestPersonViewPage.test.ts"
  ],
  "tests_added": [
    {
      "name": "an_entry_shows_its_starter_time_merge_request_place_and_first_comment",
      "proves": "D1/D2: p1 shows Anna Berg, ago with dateTimeText tip, !624 + title, Overview, the collapsed chevron, the Shift tip and li aria-keyshortcuts; the clamp box holds <strong>, code snoozeUntil, the link and the img"
    },
    {
      "name": "the_writers_row_lists_the_later_writers_oldest_first_and_none_for_a_single_comment",
      "proves": "D3: writers for p1 (Ben, Chiara, Dmitri), p3 and p6 (13 writers with Someone) in order; a one-comment discussion renders no writers row"
    },
    {
      "name": "the_turn_word_reads_from_the_persons_side",
      "proves": "B3: for Me, p2 reads 'Your turn' in TURN_MARK and others name a person; for Anna, p1/p6 read \"Anna Berg's turn\" marked, the status reads '… wait for Anna Berg', p1 is ordered before p2"
    },
    {
      "name": "an_expanded_entry_shows_the_inline_thread_and_hides_the_clamp",
      "proves": "E3: an expanded p1 has aria-expanded true and 'Hide the thread', 4 comment articles, Open on GitLab and a textarea; no clamp, Shift tip or writers row; p3 stays collapsed"
    },
    {
      "name": "two_expanded_entries_each_show_their_thread",
      "proves": "E4: p1 and p2 each show their own comments and reply field, and exactly two textareas exist"
    },
    {
      "name": "failed_rows_show_one_line_each_with_retry",
      "proves": "F2: two role=alert lines in list order, !629 (not logged in) then !615 '<title> — reason', each with Retry; the entries still show"
    },
    {
      "name": "the_loading_line_counts_the_merge_requests",
      "proves": "F1: the status reads 'Loading discussions — 0 of N merge requests', then 10 of N with some entries, then the turn summary"
    },
    {
      "name": "mergeRequestsText.test.ts: personLoadingText / foldedWritersText / personFailureText",
      "proves": "The exact words, including the singular '1 merge request' and '1 more: …'"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && lint && fmt:check && test && unused",
      "observed": "vue-tsc -b: no errors; oxlint + eslint: no output; 'All matched files use the correct format.'; Test Files 310 passed (310), Tests 4648 passed (4648); knip: no findings"
    },
    {
      "command": "just app-session start-fixture --name mpv --diff --mr list --open-mr --size 1600x1000; scroll list to 400; click Discussions",
      "observed": "status '15 of 56 wait for you', focus on 'Back to list'. Entry ids 1,3,16,4,5,18,63300,…,60201 equal MES_ORDER from mergeRequestPersonView.test.ts."
    },
    {
      "command": "view open, list Refresh clicked, status sampled every frame",
      "observed": "'Loading discussions — 0 of 29 merge requests / … 10 of 29 … / … 20 of 29 … / 15 of 56 wait for you'"
    },
    {
      "command": "read p1 (d17) collapsed",
      "observed": "clamp clientHeight 80, scrollHeight 220; strong yes, code 'snoozeUntil', link 'the import notes', img yes; writers [Ben Okafor, Chiara Rossi, Dmitri Volkov]; turn \"Ben Okafor's turn\". Shots: /tmp/mpv-collapsed-dark.png, /tmp/mpv-p1-light.png"
    },
    {
      "command": "hover p1 header, press Shift; press Shift again",
      "observed": "aria-expanded true, 4 comments, no clamp, textarea present, 1 expanded entry; after the second Shift still 'true'. Shots: /tmp/mpv-p1-dark.png, /tmp/mpv-expanded-dark.png"
    },
    {
      "command": "click p1 chevron twice",
      "observed": "'false Show the whole thread', then 'true' with 4 comments (thread read again)"
    },
    {
      "command": "click Back to list",
      "observed": "list scrollTop 400 (saved value), focus=Discussions, aria-pressed=false"
    },
    {
      "command": "person picker: open, Escape, open, pick Anna Berg",
      "observed": "Lines 'Me*, Anna Berg, Ben Okafor, Chiara Rossi, Dmitri Volkov'. Escape closed only the menu; the view stayed and focus returned to the opener. After the pick: '13 of 56 wait for Anna Berg', order 14,2,8,17,22,63501,… (ANNAS_ORDER), menu closed. Shots: /tmp/mpv-menu-dark.png, /tmp/mpv-anna-dark.png"
    },
    {
      "command": "start-fixture --name mpn --size 700x1000, Discussions, read p6 (d22)",
      "observed": "row width 273: items ['+3', Someone, Ben, Dmitri, Chiara, Anna, Ben, Someone, Dmitri, Ben, Chiara]; tip '3 more: Chiara Rossi, Dmitri Volkov, Anna Berg'. Shots: /tmp/mpv-fold-dark.png, /tmp/mpv-fold-light.png"
    },
    {
      "command": "p1 expanded, Escape in the reply field, then Escape again",
      "observed": "focus moved to 'Hide the thread' (the chevron), still expanded; after the second Escape the page and view were both still shown"
    },
    {
      "command": "chevron on p3 while p1 is expanded",
      "observed": "two expanded entries with reply fields: '17:4,19:3'"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: mergeRequestsText.ts 163 killed, 0 survived, 8 no-cov (pre-existing exhaustive default arms at :272, :294 etc., not changed lines)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Test file is ui/MergeRequestPersonViewPage.test.ts, not MergeRequestPersonView.test.ts (granted by Main). The brief's name differs only in case from the state slice's mergeRequestPersonView.test.ts, and vue-tsc failed TS1149.",
    "The person menu is ui/MergeRequestPersonPicker.vue (granted by Main). ui/MergeRequestPersonMenu.vue already exists (the people box's More menu, eb8ceaaa). I briefly overwrote it, then restored it byte-identical from HEAD. Its git status may still show it as touched; it should diff empty.",
    "Smoke p6 '+N': at 1600x1000 the p6 row is 1173 px wide and all 13 writers fit, so there is no fold (as D4 says). The fold was checked in a second 700x1000 session.",
    "Light theme in the smoke: set by writing <html data-theme=\"light\"> through app-session read, not through Settings.",
    "Added the word PEOPLE = \"People\" to mergeRequestsText.ts: it names the picker's narrowing box ('Narrow the People list'). To stay under the 300-line cap, the three new functions carry no doc comments.",
    "TURN_MARK ('font-semibold text-primary') is repeated in MergeRequestPersonEntry.vue. The original is a script-setup const in MergeRequestDiscussions.vue (not owned). Proposed: move it to a shared .ts that both import.",
    "Each entry li carries data-discussion-id (for the test and the smoke), like the box's lines.",
    "The page restores the list's scroll and focuses the Discussions button in a flush:'post' watch on personView becoming null. This covers Back to list and the button pressed again (same effect as nextTick).",
    "The Discussions button is disabled only while shownRows is empty and the view is closed, so it can still toggle back. Its tooltip sits on a wrapper span (disabled-button rule).",
    "Docs keeper: add tree.md rows for MergeRequestPersonView.vue, MergeRequestPersonEntry.vue, MergeRequestPersonPicker.vue and MergeRequestWriters.vue, plus a ui/AGENTS.md note on the view, the picker, the writers fold (useElementSize, starts at Infinity so everything shows until measured) and MergeRequestMenu now being generic over { label }."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestPersonEntry.vue (clamp div)",
      "risk": "max-h-20 is four leading-5 line heights. Paragraph margins (0.6em) mean only about three paragraphs show for p1, close to the request's 'about four lines'."
    },
    {
      "location": "frontend/src/ui/MergeRequestPersonView.vue point/focus",
      "risk": "pointed/focused hold the entry object. If an entry is removed under the pointer, no pointerleave fires, and a later Shift may expand that stale discussion (expandEntry is a no-op only once it is expanded)."
    },
    {
      "location": "frontend/src/ui/MergeRequestWriters.vue",
      "risk": "The +N chip is min-w-5, but '+13' in text-xs can be wider than one 20 px slot, so the newest picture can be clipped by a few px."
    },
    {
      "location": "frontend/src/ui/MergeRequestPersonPicker.vue opener",
      "risk": "The accessible name reads 'SWMe' in app-session (the picture's initials). MergeRequestPicture is aria-hidden; this may be app-session's name heuristic, not WebKit's."
    }
  ]
}
