# MrReviewModeFinal

Agent output (`agent://MrReviewModeFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeFinal.md), collected 2026-11-03T19:22:54.495Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check",
      "observed": "Ran once from the root at de3771a0 (clean tree), exit 0 in 44.6 s. Last lines: golden 'ok vueuse-use-magic-keys' …, sfc-order, hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "B1 button+picker (rmv --diff, rmr --range-case review)",
      "observed": "Order 'Assignee | Reviewer | Label | Review mode | All | Drafts | Ready'. Hover tooltip (.hover-tooltip) 'Review mode'. Picker [Me8, Anna Berg8, Ben Okafor7, Chiara Rossi7, Dmitri Volkov7]. Reviewer filter [Me8, None13, Anna Berg8, …, Dmitri Volkov7]: same order, and the picker has no None. Hovering Reviewer: 1 menu open, showing the Reviewer items. Click, then ArrowDown ×4 from Me: Me8 → Anna Berg8 → Ben Okafor7 → Chiara Rossi7 → Dmitri Volkov7; ArrowUp → Chiara Rossi7. Same in both windows.",
      "pass": true
    },
    {
      "recipe": "B2 pick Me (both)",
      "observed": "Before: Assignee: ben, search 'o'. After: menus 0, focus 'Review mode'. Chips 'Assignee', 'Reviewer: Me', 'Label', Ready pressed. Search input value 'o' kept. Rows !618 !633 !623 !622 !638 !603 !608. Icon aria-label 'Sorted for your review: due with your turn first, then fewest waiting on the author'.",
      "pass": true
    },
    {
      "recipe": "B3 pick Anna Berg (both)",
      "observed": "Rows !602 !622 !630 !612 !632 !617. Icon 'Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author'. !632 box: '1 of 2 waits for Anna Berg', Sam Weller 'Anna Berg's turn', Anna Berg 'Waiting for an answer'. Shots /tmp/rmvf/B3-632-box-rmv.png, B3-632-box-rmr.png. The chip reads 'Reviewer: anna'.",
      "pass": true
    },
    {
      "recipe": "B4 Draft → All (both)",
      "observed": "Rows !602 !622 !630 !627 !612 !632 !617 !606. The icon is still Anna Berg's.",
      "pass": true
    },
    {
      "recipe": "B5 reload+reopen (both)",
      "observed": "Reviewer: anna, All pressed, rows !602 !622 !630 !627 !612 !632 !617 !606, Anna icon. yamt.mergeRequests.filters = {\"/home/sam/taskboard/.git\":{\"assignee\":[],\"reviewer\":[\"user:anna\"],\"label\":[],\"draft\":\"all\",\"review\":\"user:anna\"}}. dueDates = {\"/home/sam/taskboard/.git\":{\"602\":\"2026-11-06\",\"618\":\"2026-11-04\",\"622\":\"2026-11-01\",\"623\":\"2026-11-05\",\"633\":\"2026-11-05\"}}.",
      "pass": true
    },
    {
      "recipe": "B6 clear filters (both)",
      "observed": "Rows !622 !618 !633 !623 !602 !640 !639 !638 … !603 !601 (40 rows: dated first, then newest). Icon: none. filters = '{}'. !632 box: '1 of 2 waits for you', Anna Berg 'Your turn', Sam Weller 'Waiting for an answer'. Shots /tmp/rmvf/B6-632-box-rmv.png, B6-632-box-rmr.png.",
      "pass": true
    },
    {
      "recipe": "B7 Chiara Rossi failure (both)",
      "observed": "Rows !638 !635 !630 !615 !614 !605. Icon svg class 'text-problem-error', colour rgb(246, 107, 113) (red in the shot). Tooltip 'Not sorted for Chiara Rossi's review: the discussions of !615 could not be read. glab failed: glab timed out'. Shots /tmp/rmvf/B7-chiara-rmv.png, B7-chiara-rmr.png.",
      "pass": true
    },
    {
      "recipe": "B8 Load lazily / Off / Load fully, with Anna (both)",
      "observed": "Before: !602 !622 !630 !612 !632 !617. Load lazily: btn false, icon 0, Reviewer: anna + Ready, rows !622 !602 !632 !630 !617 !612, filters {\"assignee\":[],\"reviewer\":[\"user:anna\"],\"label\":[],\"draft\":\"ready\"} (no review). Off: the same. Load fully: btn true, icon 0, the same rows, no review stored.",
      "pass": true
    },
    {
      "recipe": "B9 loading (diff)",
      "observed": "aria-label read right after the Refresh click: 'Sorted for your review: due with your turn first, then fewest waiting on the author (the discussions of 6 merge requests are still loading; they move when they arrive)'. 3 s later: no suffix, rows !618 !633 !623 !622 !638 !603 !608.",
      "pass": true
    },
    {
      "recipe": "B10 shots dark/light",
      "observed": "Dark (default yamt Dark): /tmp/rmvf/B10-picker-rmv-dark.png, B10-icon-rmv-dark.png, B10-picker-rmr-dark.png, B10-icon-rmr-dark.png. Light (Settings → yamt 'Light'): B10-picker-rmv-light.png, B10-icon-rmv-light.png, B10-picker-rmr-light.png, B10-icon-rmr-light.png. Viewed: the picker with ✓ Me, and the tooltip text over the icon.",
      "pass": true
    },
    {
      "recipe": "B setup: due-date read command (fixed brief)",
      "observed": "Ran verbatim in both windows → {\"value\":\"ok\"}, and the page reloaded.",
      "pass": true
    },
    {
      "recipe": "C setup",
      "observed": "local-conflicts-repo.sh /tmp/rmvf/rm OK; cargo tauri build --debug --no-bundle 'Built application at: target/debug/yamt'; start-app --diff --dir /tmp/rmvf/rm --glab mr-review-mode on display :3.",
      "pass": true
    },
    {
      "recipe": "C1 fake glab discussions call",
      "observed": "After the page opened, calls.log had exactly 1 line 'argv: api graphql -f query=query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, …', with iids=[\"97\",\"96\",\"95\",\"94\",\"93\",\"92\",\"90\"]. At the end there were 3 such lines (the first open, the C6 reload and C7's Load fully).",
      "pass": true
    },
    {
      "recipe": "C2 picker",
      "observed": "[\"Me5\",\"Anna Berg3\",\"Ben Okafor2\"]",
      "pass": true
    },
    {
      "recipe": "C3 Me",
      "observed": "Review mode Me: !94 !91 !96 !93. Normal order (Reviewer Me + Ready set by hand, no icon): !96 !94 !93 !91. !93 set to 'Wednesday, 4 November 2026' (dueDates {\"/tmp/rmvf/rm/.git\":{\"93\":\"2026-11-04\"}}, label 'Due 04.11.2026, 1 day left'): still !94 !91 !96 !93. Draft All: !95 !94 !91 !96 !93, icon kept.",
      "pass": true
    },
    {
      "recipe": "C4 Anna Berg",
      "observed": "!96 !97 !92. !96 box: '2 of 2 wait for Anna Berg', Sam Doe and Ben Okafor both 'Anna Berg's turn'. Shot /tmp/rmvf/C4-96-box.png.",
      "pass": true
    },
    {
      "recipe": "C5 Ben Okafor",
      "observed": "!91 !90. Icon svg rgb(246, 107, 113). Tooltip 'Not sorted for Ben Okafor's review: the discussions of !90 could not be read. glab failed: GitLab sent no merge request !90'. Shot /tmp/rmvf/C5-ben-error-dark.png.",
      "pass": true
    },
    {
      "recipe": "C6 reload + clear",
      "observed": "After the reload: Reviewer: ben, Ready, rows !91 !90, same error icon, filters {\"/tmp/rmvf/rm/.git\":{\"assignee\":[],\"reviewer\":[\"user:ben\"],\"label\":[],\"draft\":\"ready\",\"review\":\"user:ben\"}}. Clear filters: !93 !97 !96 !95 !94 !92 !91 !90 (8 rows, !93 first), no icon, filters {}.",
      "pass": true
    },
    {
      "recipe": "C7 setting (as B8, Anna)",
      "observed": "Before: !96 !97 !92, icon 1, review user:anna stored. Load lazily: btn false, icon 0, Reviewer: anna + Ready, rows !97 !96 !92, stored draft ready with no review. Off: the same. Load fully: btn true, icon 0, !97 !96 !92, no review.",
      "pass": true
    },
    {
      "recipe": "C8 app log + shots",
      "observed": "tauri-driver.log has 3 'INFO frontend: event=\"mergeRequests.discussions_read\" fields=answered=7 asked=7 ms=53|29|34 refused=1' lines, one per glab call. Each sits beside the backend line 'read merge requests' open discussions asked=7 answered=6 failed=1 queries=1 score=58 limit=250'. The counts differ, as in the smoke pass: the frontend says answered=7, the backend says answered=6 failed=1. Shots: /tmp/rmvf/C8-picker-dark.png, C8-icon-dark.png, C8-picker-light.png, C8-icon-light.png. Session rm stopped (folder removed).",
      "pass": true
    }
  ],
  "environment": "HEAD de3771a0; rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. WebKit MiniBrowser fixtures through just app-session (rmv, rmr), and target/debug/yamt on private display :3. Repo /tmp/rmvf/rm. Screenshots in /tmp/rmvf/. All sessions stopped."
}
