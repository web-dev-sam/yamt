# MrReviewModeSmoke

Agent output (`agent://MrReviewModeSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeSmoke.md), collected 2026-11-03T18:48:59.331Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "B1 button+picker (diff and range-case review windows)",
      "observed": "Buttons: '… Assignee | Reviewer | Label | Review mode | All | Drafts | Ready'. Hover tooltip 'Review mode'. Picker [Me8, Anna Berg8, Ben Okafor7, Chiara Rossi7, Dmitri Volkov7]; Reviewer filter [Me8, None13, Anna Berg8, …] (same order, no None in picker). Hovering Reviewer → one menu open. Parent's extra check (diff, fresh session): click → Me8, then ArrowDown ×4 → Anna Berg8, Ben Okafor7, Chiara Rossi7, Dmitri Volkov7; ArrowUp steps back. Same in range window.",
      "pass": true
    },
    {
      "recipe": "B2 pick Me (both windows)",
      "observed": "Set beforehand: Assignee: ben, search 'o'. After pick: menus 0, focus 'Review mode'. Filters: Reviewer: Me, Ready on, Assignee/Label cleared, search 'o' kept. Rows !618 !633 !623 !622 !638 !603 !608, also after clearing search. Icon: 'Sorted for your review: due with your turn first, then fewest waiting on the author'.",
      "pass": true
    },
    {
      "recipe": "B3 pick Anna Berg (both windows)",
      "observed": "Rows !602 !622 !630 !612 !632 !617. Icon: 'Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author'. !632 box: '1 of 2 waits for Anna Berg', 'Anna Berg's turn', 'Waiting for an answer'. Shots /tmp/rmv/B3-632-box.png, /tmp/rmv/B3-632-box-range.png. Note: the chip reads 'Reviewer: anna' (username, not name).",
      "pass": true
    },
    {
      "recipe": "B4 Draft → All (both)",
      "observed": "Rows !602 !622 !630 !627 !612 !632 !617 !606; icon unchanged (Anna Berg).",
      "pass": true
    },
    {
      "recipe": "B5 reload+reopen (both)",
      "observed": "Reviewer: anna, All, rows !602 !622 !630 !627 !612 !632 !617 !606, Anna icon. yamt.mergeRequests.filters = {\"/home/sam/taskboard/.git\":{\"assignee\":[],\"reviewer\":[\"user:anna\"],\"label\":[],\"draft\":\"all\",\"review\":\"user:anna\"}}",
      "pass": true
    },
    {
      "recipe": "B6 clear filters (both)",
      "observed": "Rows !622 !618 !633 !623 !602 !640 !639 … !601 (dated first, then newest). No icon. filters = \"{}\". !632 box: '1 of 2 waits for you', 'Your turn' (/tmp/rmv/B6-632-box.png, B6-632-box-range.png).",
      "pass": true
    },
    {
      "recipe": "B7 Chiara Rossi failure (both)",
      "observed": "Rows !638 !635 !630 !615 !614 !605 (normal order). Icon: 'Not sorted for Chiara Rossi's review: the discussions of !615 could not be read. glab failed: glab timed out'. Icon is red in /tmp/rmv/B7-chiara-error-dark.png.",
      "pass": true
    },
    {
      "recipe": "B8 Load lazily / Off / Load fully (both)",
      "observed": "Lazily: btn false, no icon, Reviewer: anna + Ready, rows !622 !602 !632 !630 !617 !612, stored {assignee:[],reviewer:[\"user:anna\"],label:[],draft:\"ready\"} (no review). Off: same. Load fully: btn true, no icon, same order, no review stored.",
      "pass": true
    },
    {
      "recipe": "B9 loading (diff)",
      "observed": "Read right after the Refresh click: 'Sorted for your review: due with your turn first, then fewest waiting on the author (the discussions of 6 merge requests are still loading; they move when they arrive)'. 3 s later: rows !618 !633 !623 !622 !638 !603 !608, no suffix.",
      "pass": true
    },
    {
      "recipe": "B10 shots",
      "observed": "Dark: /tmp/rmv/B10-picker-diff-dark.png, B10-icon-diff-dark.png, B10-picker-range-dark.png, B10-icon-range-dark.png. Light: B10-picker-diff-light.png, B10-icon-diff-light.png, B10-picker-range-light.png, B10-icon-range-light.png. Viewed: the picker (✓ Me) and the tooltips show. 'Light' under the yamt theme group was used for yamt Light.",
      "pass": true
    },
    {
      "recipe": "B setup: brief's due-date `read` command",
      "observed": "Verbatim, as the brief gives it: 'javascript error: Unexpected token ';'. Expected ')' to end a compound expression.' (read takes one expression). Wrapped in (()=>{…; return 'ok'})() it worked → {\"value\":\"ok\"}. The brief needs fixing.",
      "pass": false
    },
    {
      "recipe": "C1 fake glab discussions call",
      "observed": "After the page opened: 1 line 'argv: api graphql -f query=query MergeRequestDiscussions(…' with iids=[\"97\",\"96\",\"95\",\"94\",\"93\",\"92\",\"90\"]. At the end: 4 such lines (reloads/setting toggles), all with the same iids.",
      "pass": true
    },
    {
      "recipe": "C2 picker",
      "observed": "[\"Me5\",\"Anna Berg3\",\"Ben Okafor2\"]",
      "pass": true
    },
    {
      "recipe": "C3 Me",
      "observed": "Rows !94 !91 !96 !93. Due date !93 set to 'Wednesday, 4 November 2026' (dueDates {\"/tmp/rmv/rm/.git\":{\"93\":\"2026-11-04\"}}): rows still !94 !91 !96 !93. Draft All: !95 !94 !91 !96 !93. Normal order !96 !94 !93 !91 before the date: not read separately. Escape after picking the date left the MR page (returned to compare); reopened.",
      "pass": true
    },
    {
      "recipe": "C4 Anna Berg",
      "observed": "Rows !96 !97 !92. !96 box: '2 of 2 wait for Anna Berg', both 'Anna Berg's turn' (/tmp/rmv/C4-96-box.png).",
      "pass": true
    },
    {
      "recipe": "C5 Ben Okafor",
      "observed": "Rows !91 !90. Icon red: 'Not sorted for Ben Okafor's review: the discussions of !90 could not be read. glab failed: GitLab sent no merge request !90' (/tmp/rmv/C5-ben-error-dark.png).",
      "pass": true
    },
    {
      "recipe": "C6 reload + clear",
      "observed": "After the reload: Reviewer: ben, Ready, rows !91 !90, same error icon, stored review user:ben. Clear filters: !93 !97 !96 !95 !94 !92 !91 !90 (8 rows, !93 first), filters {}.",
      "pass": true
    },
    {
      "recipe": "C7 setting (as B8, Anna)",
      "observed": "Lazily: btn false, no icon, rows !97 !96 !92, stored draft ready with no review. Off: same. Load fully: btn true, no icon, !97 !96 !92.",
      "pass": true
    },
    {
      "recipe": "C8 app log + shots",
      "observed": "tauri-driver.log has 4 'INFO frontend: event=\"mergeRequests.discussions_read\" fields=answered=7 asked=7 ms=49 refused=1' lines (ms 49/34/35/40), one per backend line 'read merge requests' open discussions asked=7 answered=6 failed=1 queries=1'. The counts differ: the frontend says answered=7, the backend answered=6 failed=1. Shots: /tmp/rmv/C8-picker-dark.png, C8-icon-dark.png, C8-picker-light.png, C8-icon-light.png. Session stopped.",
      "pass": true
    }
  ],
  "environment": "HEAD 74834ac9; rustc 1.99.0, node v26.13.0, pnpm 12.0.0; WebKit MiniBrowser fixtures + target/debug/yamt (cargo tauri build --debug --no-bundle) via just app-session on private display :3; repo scripts/local-conflicts-repo.sh /tmp/rmv/rm; screenshots in /tmp/rmv/. All sessions stopped."
}
