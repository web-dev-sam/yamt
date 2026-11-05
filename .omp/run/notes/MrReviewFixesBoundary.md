# MrReviewFixesBoundary

Agent output (`agent://MrReviewFixesBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesBoundary.md), collected 2026-11-04T23:56:54.871Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: every changed file is in Owned or an approved deviation (two test expectations, new MergeRequestsPage.test.ts). index.ts unchanged; viewerAddressed stays internal. reviewOrder→dueDate is an edge inside the module.",
    "B1/B2: one `counts` computed (MergeRequestDiscussions.vue:79) feeds both readHeader and the mark. Nothing new is stored, so state.md needs no row. Both turnText calls (:97, :200) pass props.row.author; turnText reuses people.ts displayName.",
    "C1/C2: escapePressed only dismisses an open menu. goBack is only Back's @click (:142). `thread` is no longer destructured; `description` is still used. Grepping \"Escape\" in ui/ finds no second page handler.",
    "viewerAddressed replaces the copied you/name ternary in both texts; no authorsTurn or old D5 words left in frontend/src. Accepted deviations: palette '#2429' wording, python heredoc edit, contract doc 'as today'.",
    "Docs: ui/AGENTS.md drops 'the one after leaves the page', reads `refreshed(iid, asked?)`, and covers the mark and the page's only Escape. mergeRequests/AGENTS.md states D1–D5 and viewerAddressed.",
    "Older bug, outside the brief: the review order counts discussions resolved in the box, but header and mark skip them (mergeRequestsShown.ts reviewDetails, read-only). Not reported as a finding."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/reviewOrder.ts",
      "line": 41,
      "severity": "block",
      "rule_id": "growth: copied decision",
      "problem": "reviewFirst re-implements byDueDate's D1 rule (dated before undated, compareDays soonest first; D1 says 'as the normal order, plan #156'). The rule now has two owners, and its undated branches are unreachable: the open risk and survivors :42/:43.",
      "fix": "Export one `dueFirst(a: CalendarDay | null, b: CalendarDay | null)` from order.ts, used by byDueDate's sort and by reviewFirst (extend Owned to order.ts and order.test.ts)."
    },
    {
      "file": "frontend/src/mergeRequests/internal/discussions.ts",
      "line": 146,
      "severity": "should",
      "rule_id": "growth: copied decision",
      "problem": "D3's 'the viewer wrote in it' repeats isViewersTurn's B2.4 check (:85-87, same `[...earlier, last].some(isUser(author, viewer))`). A change to who counts as a writer (B6, bots) must be made in two places.",
      "fix": "Extract `wroteIn(discussion, viewer)` and call it from isViewersTurn (with the mention check) and from turnCounts' viewerWrote."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 82,
      "severity": "should",
      "problem": "`marked` now means 'the button's purple mark', while `unmarkedOf` (:167) and the box vocabulary ('a line marked resolved', test a_marked_row_reads_resolved…) use 'marked' for 'resolved'. One file uses the word for two opposite things, so the next reader has to trace which one is meant.",
      "fix": "Rename `marked` to `waitsForViewer`, and rename the box test's `isMarked` to match."
    },
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 264,
      "severity": "should",
      "problem": "B1's 'drawn as the turn words are' is the literal 'font-semibold text-primary' copied at :264 and :323. A restyle of the turn word would silently leave the mark behind; the box test also matches the literal.",
      "fix": "Hold the classes in one script constant (e.g. `TURN_MARK`) and bind it at both places."
    },
    {
      "file": "docs/architecture.md",
      "line": 2159,
      "severity": "should",
      "problem": "The docs-keeper list in deviations misses stale lines: architecture.md:2159 (Escape closes the page), :2267-2268 (`turnText(turn, viewer)`, 'Author's turn'), :2309 and :2365-2366 ('leaves the page'), :2422 (viewerAddressed); plan.md row 166 ('their turn'); tree.md:290 ('Back/Escape'). The full text would then contradict C1, A1 and D5.",
      "fix": "Add these lines to deviations_from_brief so the docs keeper rewrites them with the listed ones."
    }
  ]
}
