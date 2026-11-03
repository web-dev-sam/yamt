# MrReviewModeDesign

Agent output (`agent://MrReviewModeDesign`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeDesign.md), collected 2026-11-03T18:00:37.089Z.

{
  "options": [
    {
      "name": "A - review mode as a fifth field of the remembered filters; core orders shown rows at once",
      "summary": "Filters.review (me or a person) is stored as a fifth key 'review' (me / user:<name>) in the same per-repository entry, only while on. An older yamt reads its 4 keys and drops the order on its next write. Core reviewOrdered = byDueDate, then one stable sort; a failed row gives the normal order. viewerOf gives the box and the order one viewer. The rule 7 gate sits in createRememberedFilters. The picker is a second opener in the bar's one useHoverMenu (menuitemradio).",
      "visions": [
        2,
        4,
        1,
        5
      ],
      "cost": "About 22 files / 1,000 lines for core+state+box, about 12 files / 600 lines for page. No Rust or IPC. Rows jump back at each Refresh swap while details reload."
    },
    {
      "name": "B - separate review-mode module and stored key; picker inside the Reviewer checklist",
      "summary": "ui/mergeRequestReviewMode.ts owns yamt.mergeRequests.reviewMode per repository. Clear filters must clear both modules, and 'filtered' becomes filters OR mode. The picker is a second control on each Reviewer checklist item. Filters' stored form is untouched.",
      "visions": [
        2
      ],
      "cost": "Two writers and two keys for one user action, which can disagree (#155 rejected a second key). A control inside a menuitemcheckbox is invalid ARIA, adds a third gesture, and breaks rule 1's own button."
    },
    {
      "name": "C - A's storage, order frozen until all details arrive",
      "summary": "A plus a reviewSnapshot ShallowRef written by a watch when no shown row is loading. Rows keep the snapshot order and new ones follow in the normal order, so nothing moves while answers stream in.",
      "visions": [
        1
      ],
      "cost": "A second state with a watch writer (vision 2). The first order takes about 2 min on a 500-row project. It goes against rule 6 'move once they arrive'."
    }
  ],
  "recommendation": "Option A. Review mode is literally filters plus an order: cleared by NO_FILTERS, remembered in the same entry, and older yamt still reads it. The order is one pure core function over data that already exists (turnCounts, byDueDate, discussion entries), and the picker reuses the bar's one hover menu. No Rust, no IPC, no dependency. Cost: about 34 files, and one ripple: the turn words gain a viewer and Filters gains a field, so the core slice also owns the window state and the discussions box.",
  "design_doc": "docs/slices/briefs/mr-review-mode-design.md",
  "briefs_written": [
    "docs/slices/briefs/mr-review-mode-core.md",
    "docs/slices/briefs/mr-review-mode-page.md",
    "docs/slices/briefs/mr-review-mode-verify.md"
  ],
  "slice_graph": "Wave 1: core (web-impl) - the core order and words, review mode in the remembered filters with the rule 7 gate, viewer/reviewSort in mergeRequestsShown, the box's viewer, discussionsFailedText. Wave 2: page (web-impl, wires the window; needs core) - button, picker, sort icon, menuKeys, fixture discussion data, scenario tests/glab/mr-review-mode. Wave 3: docs keeper and verify smoke run side by side; verify final (just check) runs after the docs keeper. No step between slices leaves typecheck red.",
  "open_questions": [
    "One merge request whose discussions cannot be read (over 1,000 discussions, a timed-out batch) keeps that reviewer's whole list in the normal order, and the icon names it. The alternative is to sort the readable ones and put unreadable ones last, but those might be the most urgent.",
    "In review mode, every Refresh (and reopening the page after 30 s) drops all discussion details, so rows sort as if none and jump back as answers arrive (about 5 s per 20 MRs on a busy GitLab). Keeping old details until new ones arrive would change the discussions feature's 'a refresh drops them' rule."
  ]
}
