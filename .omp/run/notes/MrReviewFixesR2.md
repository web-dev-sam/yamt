# MrReviewFixesR2

Agent output (`agent://MrReviewFixesR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR2.md), collected 2026-11-05T00:27:29.731Z.

{
  "summary": "In review mode (and any order) a row now keeps its place while its discussions box or thread panel is open, and the new order applies once both close. This uses the people box's rule 9: `mergeRequestsShown.ts` `heldOf` holds the rows whose people box, discussions box or shown thread is open. A held row stays shown, and `keptInPlace` keeps it at its index in the order shown before while the other rows fill the rest. `MergeRequestDiscussions.vue` calls `discussionsBoxOpened`/`discussionsBoxClosed`. The button is unmarked at once, as before.",
  "files_changed": [
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "MergeRequestDiscussionsBox.test: a_discussion_resolved_in_the_box_unmarks_the_button_at_once_and_moves_its_row_once_box_and_panel_close",
      "proves": "Review mode Me: resolving !633's only waiting discussion unmarks its button at once. !633 stays first while box or panel is open (after closeThread too) and moves only once the box closes. Replaces R1's 'moves at once' test."
    },
    {
      "name": "MergeRequestDiscussionsBox.test: a_row_whose_thread_panel_is_open_keeps_its_index_while_rows_around_it_move",
      "proves": "With only its shown thread holding it, !638 keeps index 1 while late answers reorder the other rows. After close it moves to index 3. Kills the splice-index and keep-condition mutants."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; test; unused; sfc-order (after the last edit)",
      "observed": "vue-tsc -b clean; oxlint and eslint clean; 'All matched files use the correct format.'; 'Test Files 302 passed (302) / Tests 4514 passed (4514)'; knip clean; check-sfc-order clean."
    },
    {
      "command": "just app-session start-fixture --name r2 --diff --mr list --open-mr --size 1600x1000; Review mode → Me (dark)",
      "observed": "Order '!633@138 !618@190 !623@242 !638@295 !622@347 !603@400 !608@452'; marks '1* 1* 2* 2 1 2'."
    },
    {
      "command": "dark: hover !633's '1 open discussion', hover its line, Shift, mouse click 'Resolve thread'; read order and marks with box and panel open; shot target/r2-held-dark.png",
      "observed": "'!633@138 !618@190 … || true false* false* …' (open button no longer purple) || header='No open discussions' || box top=167 (under !633's row); panel shows 'Resolved' and 'Unresolve thread'. Screenshot: box beside its own row."
    },
    {
      "command": "dark: Escape (panel closes, box held by focus), then click the search field (box closes); shot target/r2-closed-dark.png",
      "observed": "After Escape: '!633 !618 !623 !638 !622 !603 !608 panel=false box=1' (still held). After the box closed: '!618 !623 !638 !633 !622 !603 !608 box=0'. The row moved."
    },
    {
      "command": "Settings → Theme → yamt Light; back to the page in review mode Me; same steps on !618 (first, 1 waiting); shot target/r2-held-light.png, target/r2-closed-light.png",
      "observed": "Held: '!618@138 !623@190 … || true false* false … || header=No open discussions || box top=167'. After Escape: '!618 !623 !638 !633 … box=1'. After the box closed: '!623 !638 !633 !622 !618 !603 !608 box=0 marks=2* 2 1 1 2'."
    },
    {
      "command": "just app-session stop --name r2",
      "observed": "{\"stopped\":\"r2\",\"session\":\"ended\", webdriver and vite stopped, folder removed}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → mergeRequestsShown.ts 97.62%: 82 killed, 0 timeout, 2 survived, 0 no-cov (.vue not mutated)",
    "survivors": [
      "mergeRequestsShown.ts:62 {kind:\"none\"} to {} / {kind:\"\"} — equivalent: reviewOrdered reads any kind other than read, loading or failed as NO_TURNS. The line is unchanged since R1 (same survivor)."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Holding a row in place (board item 2476) was outside the R1 brief. Every row a box holds now also keeps its index, the people box's too: one rule, `heldOf` + `keptInPlace`, not a second mechanism. A row whose discussions box or panel is open now also stays shown when a filter would drop it, as rule 9 does for people.",
    "The open discussions boxes are a new state in `shownOf` (`discussionBoxes`; its only writer is `boxesOf`, `discussionsBoxOpened`/`Closed` on `Shown`). Merging it into `openPeopleBoxes` (mergeRequestPeople.ts, not owned) would need one set keyed per box: one row may have both boxes open (a pinned panel plus a hovered people box).",
    "The thread panel's row is read from `threads.thread`, not written as a second state; `Listed` gains `threads`, which mergeRequests.ts already passes through its `...state` spread.",
    "`shown`'s computed reads its previous value (Vue 3.5 `computed(previous => …)`) to know the order shown before.",
    "Docs keeper: project-map state.md needs a row for `discussionBoxes` (owner and writer `mergeRequestsShown.ts`), and tree.md needs `heldOf`/`keptInPlace` next to mergeRequestsShown.ts. ui/AGENTS.md is updated (Discussions and People paragraphs)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestsShown.ts:99 keptInPlace",
      "risk": "A held row keeps its index, not its pixel position. A filter or reviewer change made while a pinned panel holds a row clamps the row to its old index in a shorter list, so it may sit away from where it was."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue:119",
      "risk": "The open/close wiring is checked only in WebKit. The SSR test mocks useHoverBox, so its watch never fires, and the tests call discussionsBoxOpened/Closed directly, as the people tests do."
    }
  ]
}
