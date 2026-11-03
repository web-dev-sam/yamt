# MrReviewModePage

Agent output (`agent://MrReviewModePage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModePage.md), collected 2026-11-03T18:40:19.848Z.

{
  "summary": "The merge-request page now has review mode. A `user-round-search` button (`MergeRequestReviewMode.vue`) sits after the three filters and opens a `menuitemradio` picker inside the bar's one hover menu (`useHoverMenu<ListFilter | \"review\">`). An `arrow-down-wide-narrow` sort icon (`MergeRequestReviewSort.vue`) shows next to it. `MENU_ITEMS` now steps radio items. In the fixture, discussion 1's last comment is by the row's first reviewer, and the failing iid is now !615. The new `tests/glab/mr-review-mode/` scenario is in place. ui/ipc AGENTS.md are updated.",
  "files_changed": [
    "frontend/src/ui/MergeRequestReviewMode.vue",
    "frontend/src/ui/MergeRequestReviewSort.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/menuKeys.ts",
    "frontend/src/ui/menuKeys.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "tests/glab/mr-review-mode/project.json",
    "tests/glab/mr-review-mode/graphql-page-1.json",
    "tests/glab/mr-review-mode/graphql-discussions-97-96-95-94-93-92-90.json",
    "tests/glab/README.md"
  ],
  "tests_added": [
    {
      "name": "menuKeys.test.ts: a radio item is stepped: menus step over plain, checkbox and radio items",
      "proves": "MENU_ITEMS is exactly menuitem, menuitemcheckbox and menuitemradio, so arrow keys and first-item focus reach the picker's radio items."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts: both_turns_occur_for_sam_and_some_rows_wait_only (rewritten)",
      "proves": "On every two-discussion row, discussion 1 is by the row's first reviewer and is newer. For sam, rows that only wait, rows that are only his turn, and mixed rows all occur."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test.ts: the_review_orders_the_smoke_expects",
      "proves": "With the five due dates, the core's filtered/reviewing/reviewOrdered/byDueDate over ?mr=list give the design §1.9 orders exactly: Me, Anna, Anna with Draft All, and Chiara failed naming !615."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; test; fmt:check; unused; sfc-order",
      "observed": "vue-tsc -b clean. oxlint+eslint gave no output. Test Files 273 passed (273), Tests 4129 passed (4129); this includes fences.test.ts and mergeRequestTitles.test.ts. \"All matched files use the correct format.\" knip and sfc-order printed no findings."
    },
    {
      "command": "just map-check",
      "observed": "map-check: missing: frontend/src/mergeRequests/internal/reviewOrder.ts, frontend/src/ui/mergeRequestRowReplyText.ts (core's files). It did not list the two new .vue components."
    },
    {
      "command": "WebKit fixture rmp, steps 1 and 2: hover the button, read its menu, use the arrow keys, type Card, pick Me",
      "observed": "Bar order: Assignee | Reviewer | Label | Review mode. Tooltip \"Review mode\" shown. Menu: Me 8, Anna Berg 8, Ben Okafor 7, Chiara Rossi 7, Dmitri Volkov 7 (Reviewer list: Me 8 \\| None 13 \\| same). Arrows stepped Me→Anna→Chiara→Ben. After the pick: menu closed, focus on Review mode, \"Reviewer: Me\", Ready* pressed, search \"Card\" kept. After clearing the search: rows !618 !633 !623 !622 !638 !603 !608. Icon tooltip \"Sorted for your review: due with your turn first, then fewest waiting on the author\"."
    },
    {
      "command": "WebKit steps 3 and 4: pick Anna Berg, hover !632's count, then Draft → All",
      "observed": "\"Reviewer: anna\". Rows !602 !622 !630 !612 !632 !617. Tooltip \"Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author\". !632's box: \"1 of 2 waits for Anna Berg … Anna Berg's turn … Waiting for an answer\". After All: !602 !622 !630 !627 !612 !632 !617 !606, and the icon stays."
    },
    {
      "command": "WebKit steps 5 and 6: reload, reopen the page, then Clear filters",
      "observed": "After the reload: Reviewer anna, All*, the same order and the icon. Stored entry {assignee:[],reviewer:[\"user:anna\"],label:[],draft:\"all\",review:\"user:anna\"}. After Clear filters: all 40 rows !622 !618 !633 !623 !602 !640 …, 0 sort icons, the opener has no border-primary, stored \"{}\". !632's box: \"1 of 2 waits for you … Your turn … Waiting for an answer\"."
    },
    {
      "command": "WebKit steps 7 and 8: pick Chiara Rossi; then Anna, Load lazily, then Load fully",
      "observed": "Chiara: rows !638 !635 !630 !615 !614 !605, icon class text-problem-error. Tooltip \"Not sorted for Chiara Rossi's review: the discussions of !615 could not be read. glab failed: glab timed out\" (the !615 box reads \"glab failed: glab timed out\"). Lazy: no button, 0 icons, Reviewer anna + Ready, rows !622 !602 !632 !630 !617 !612, review dropped from the stored entry. Fully: the button is back; no icon; same order."
    },
    {
      "command": "WebKit step 9: shot",
      "observed": "/tmp/rmp-picker-dark.png, /tmp/rmp-icon-dark.png, /tmp/rmp-picker-light.png, /tmp/rmp-icon-light.png, /tmp/rmp-step7-failed-dark.png: picker with a check on Anna, primary-bordered opener, icon tooltips in both themes."
    },
    {
      "command": "Real app: scripts/local-conflicts-repo.sh /tmp/rmp-scratch/rm; cargo tauri build --debug --no-bundle; just app-session start-app --name rm --diff --dir /tmp/rmp-scratch/rm --glab mr-review-mode",
      "observed": "Built target/debug/yamt. The page shows !97 !96 !95 !94 !93 !92 !91 !90. calls.log has one discussions call: -F iids=[\"97\",\"96\",\"95\",\"94\",\"93\",\"92\",\"90\"] -F first=7. Picker: Me 5 \\| Anna Berg 3 \\| Ben Okafor 2."
    },
    {
      "command": "Real app: Me; set !93's due date to 04.11 through the calendar; All; Anna; Ben; Clear filters",
      "observed": "Me: !94 !91 !96 !93. With !93 due 04.11: still !94 !91 !96 !93(04.11). All: !95 !94 !91 !96 !93. Anna: !96 !97 !92, !96 box \"2 of 2 wait for Anna Berg\". Ben: !91 !90, text-problem-error, tooltip \"Not sorted for Ben Okafor's review: the discussions of !90 could not be read. glab failed: GitLab sent no merge request !90\". Clear: !93 !97 !96 !95 !94 !92 !91 !90, 0 icons."
    },
    {
      "command": "Real app: reload, setting toggles, shots, stop",
      "observed": "After the reload: Reviewer anna, All*, !96 !97 !92, the icon, review \"user:anna\" stored. Lazy: no button, no icon, !97 !96 !92, review gone. Fully: button back, no icon, !97 !96 !92. Shots /tmp/rm-ben-dark.png, /tmp/rm-picker-light.png, /tmp/rm-icon-light.png. Session stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: fixtureMergeRequestDiscussions.ts 92.71% (89 killed, 7 survived), menuKeys.ts 100% (28 killed); total 94.35%",
    "survivors": [
      "fixtureMergeRequestDiscussions.ts:32-37 LONG_TEXT/MARKUP_TEXT/SHORT_TEXTS literals (6) — gate-covered: unchanged module-level constants not re-run under vitest (#732); fixture text tests assert them",
      "fixtureMergeRequestDiscussions.ts:66:22 `?.`→`.` on fixtureRows(index + 1, 1)[0] — equivalent: unchanged line; fixtureRows always yields the row"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "map-check did not list the two new .vue components. It lists core's reviewOrder.ts and mergeRequestRowReplyText.ts as missing from tree.md. Docs keeper: add those two plus MergeRequestReviewMode.vue and MergeRequestReviewSort.vue.",
    "Decided: the picker's item key is `me` / `user:<username>`, a local keyOf (MergeRequestFilter's has the same two arms plus none/label). The opener is `rounded` with `border-primary` when active; there is no × part.",
    "menuKeys test: the node project has no DOM, so the radio-item step is proved through the selector list. stepMenuItem itself is role-free.",
    "The scenario rows' detailedMergeStatus is my choice: DISCUSSIONS_NOT_RESOLVED where discussions are open, DRAFT_STATUS for !95, MERGEABLE for !91. Note texts and note numbers (<iid><n>) are mine too.",
    "WebKit step 1 `read`: one expression, so the setItem and the reload are comma-joined (as in core).",
    "Per Main's message: ui/AGENTS.md row-details line now reads `datedFirst`, by `dueOf`, the one day lookup the review order reads too. The page spells no possessive itself; both components use the core's text functions only.",
    "The fixture test name both_turns_occur_for_sam_and_some_rows_wait_only is kept, with a new body."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:72-77",
      "risk": "menu() checks the filter bars before the picker. Only one is open at a time by construction, so the order does not matter, but a second open menu would make the picker's menu unreachable."
    },
    {
      "location": "tests/glab/mr-review-mode/",
      "risk": "No Rust test reads this scenario. It was checked only through the real-app session, with Rust answering !90 as failed when it is absent."
    }
  ]
}
