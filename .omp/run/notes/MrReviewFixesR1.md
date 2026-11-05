# MrReviewFixesR1

Agent output (`agent://MrReviewFixesR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR1.md), collected 2026-11-05T00:17:17.939Z.

{
  "summary": "All eight findings are addressed. One due-day rule, `dueFirst` (order.ts), serves `byDueDate` and D1. One `wroteIn` serves B2.4 and D3. One `unmarkedOf` (mergeRequestDiscussionRows.ts) feeds the header, the mark, `boxClosed` and review order, so a resolve in the box unmarks the button and moves the row together. The mark is renamed `waitsForViewer` and its classes are one constant, `TURN_MARK`. #2474: a click inside the 400 ms pause lands on the disabled button.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/order.ts",
    "frontend/src/mergeRequests/internal/order.test.ts",
    "frontend/src/mergeRequests/internal/reviewOrder.ts",
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/mergeRequestDiscussionRows.ts",
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "order.test: due_first_puts_dated_before_undated_and_the_sooner_day_first",
      "proves": "`dueFirst`: a dated day sorts before none and in both argument orders, two undated give 0, the sooner day goes first, the same day gives 0."
    },
    {
      "name": "MergeRequestDiscussionsBox.test: a_discussion_resolved_in_the_box_moves_its_row_in_review_order_as_it_unmarks_the_button",
      "proves": "Review mode Me: !633 starts first and marked. After its only discussion is resolved: line still shown, header 'No open discussions', button unmarked, !633 no longer first. Fails with the old reviewDetails (seen)."
    },
    {
      "name": "MergeRequestThreadPanel.test: while_the_thread_loads_every_write_button_is_disabled_and_a_resolve_sends_nothing",
      "proves": "While the thread loads, Add review, Add comment and Resolve thread are all disabled, and a resolve sends nothing. After the read all three are enabled and the thread is still unresolved."
    },
    {
      "name": "MergeRequestDiscussionsBox.test: a_row_with_the_viewers_turn_has_a_marked_button (changed)",
      "proves": "The helper is renamed `waitsForViewer`. A 'Your turn' line has the same classes the button's mark checks for."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; test; unused; sfc-order",
      "observed": "vue-tsc -b clean; oxlint and eslint clean; 'All matched files use the correct format.'; 'Test Files 302 passed (302) / Tests 4513 passed (4513)'; knip clean; check-sfc-order clean."
    },
    {
      "command": "just app-session start-fixture --name r1 --diff --mr list --open-mr --size 1600x1000; event listeners in the capture phase; hover !639's line; synthetic Shift tap, then a click on 'Resolve thread' 208 ms later",
      "observed": "'113824 shift / 114032 pointerdown target=SPAN:Resolve thread resolveBtn=disabled / 114037 click target=SPAN … disabled'; the header still reads \"Anna Berg's turn\". The click landed in the 400 ms pause on the disabled button (pointer-events-none), so the span under it got it."
    },
    {
      "command": "same session: Shift, then a click 554 ms or 700 ms later (two tries)",
      "observed": "'pointerdown/click target=BUTTON:Resolve thread resolveBtn=enabled'; the header reads 'Resolved', the button 'Unresolve thread', the box 'No open discussions'."
    },
    {
      "command": "shot /tmp/r1-loading.png during the pause",
      "observed": "The panel shows 'Loading…'. Add review, Add comment and Resolve thread are all drawn muted (disabled)."
    },
    {
      "command": "review mode Me (dark); hover !633, Shift, click 'Resolve thread' by mouse; read the order and mark colours with the box still open",
      "observed": "Before: '633:1* 618:1* 623:2* 638:2 603:1 608:2'. After: '618:1*/rgb(119,76,213) 623:2*/rgb(119,76,213) 638:2/rgb(214,212,221) 633:1/rgb(214,212,221) 603 608'; panel 'Resolved', box 'No open discussions' (/tmp/r1-after-resolve.png)."
    },
    {
      "command": "just app-session stop --name r1",
      "observed": "{\"stopped\":\"r1\",\"session\":\"ended\", webdriver and vite stopped, folder removed}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 441 killed, 0 timeout, 17 survived, 6 no-cov; order.ts 100%, mergeRequestsShown.ts 96.15%, discussions.ts 93.07%, reviewOrder.ts 95%",
    "survivors": [
      "mergeRequestsShown.ts:57 {kind:\"none\"} to {} or {kind:\"\"} — equivalent: reviewOrdered reads any kind other than read, loading or failed as NO_TURNS. The line is unchanged, only moved.",
      "discussions.ts:42-53, :59, :201, :221; reviewOrder.ts:24, :93, :97; mergeRequestDiscussionRows.ts:60 — unchanged lines (the round-1 survivors, moved)."
    ]
  },
  "acceptance_not_run": [
    "Light theme was not re-checked this round; the WebKit re-checks of B2 and of the mark and order were done in dark only."
  ],
  "deviations_from_brief": [
    "#2474/#2475: not a lost click on an enabled button. A click inside the pause hits Resolve thread while it is disabled, and drawn muted, because `writable` is false while the thread loads. So 'disabled while it cannot act' already holds and the code is unchanged; a test now pins it.",
    "Main extended Owned to ui/mergeRequestDiscussionRows.ts: `unmarkedOf` lives there, next to `DiscussionLoad.resolved`, and `boxClosed` uses it too. The .vue and mergeRequestsShown.ts import it directly, not through the mergeRequestDiscussions.ts re-export, which is not owned.",
    "`reviewDetails` is now a switch with no default (tsgolint checks it is exhaustive), so the `case \"loading\"` mutant is killed.",
    "The test name a_row_with_the_viewers_turn_has_a_marked_button is kept because the brief names it; only the helper is renamed to `waitsForViewer`.",
    "`TURN_MARK` sits after defineProps, because vue/define-macros-order rejects it before. The test keeps the literal as `TURN_LOOK` and asserts that a 'Your turn' line carries it.",
    "Docs keeper: docs/architecture.md review order (D1 is `dueFirst`; the order counts the unmarked discussions) and project-map tree.md (order.ts `dueFirst`, mergeRequestDiscussionRows.ts `unmarkedOf`) need the matching lines."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue:268 (box placement)",
      "risk": "In review mode, the resolved row moves down while its box and panel stay open, and the box stays at the old place (/tmp/r1-after-resolve.png: the box sits over !618's row). The owner (#2436) asked for the move; a box left away from its row may confuse."
    },
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue:63",
      "risk": "During the load pause, a disabled button is shown only by muted text with the same border. The verifier read it as a lost click; a stronger disabled look, or a busy cue, is an owner choice."
    }
  ]
}
