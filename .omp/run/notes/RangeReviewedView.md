# RangeReviewedView

Agent output (`agent://RangeReviewedView`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedView.md), collected 2026-11-19T10:07:45.970Z.

{
  "summary": "The range window is now wired for Reviewed marks. Each header starts with a Reviewed button in the Mark resolved look: filled with aria-pressed when the file is reviewed, disabled while busy. An \"N of M reviewed\" count follows the collapse toggle. Each list row ends with a check (name muted) or a refresh-ccw-dot. A file changed since review opens the since view: the reviewed text on the left, a note and Review from start, no threads, no number drag. `RangeController` gains `startsThreads`. useRangeController gains RangeShown, wholeShown, sinceShown, viewKind and viewParts.",
  "files_changed": [
    "frontend/src/editor/range.ts",
    "frontend/src/editor/range.browser.test.ts",
    "frontend/src/editor/rangeThreads.browser.test.ts",
    "frontend/src/ui/useRangeController.ts",
    "frontend/src/ui/useRangeController.test.ts",
    "frontend/src/ui/RangeView.vue",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/RangeFileRow.vue",
    "frontend/src/ui/rangeText.ts",
    "frontend/src/ui/rangeText.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/index.ts"
  ],
  "tests_added": [
    {
      "name": "useRangeController.test a_since_review_view_loads_load_since_review_and_shows_reviewed_left_current_right",
      "proves": "since parts load loadSinceReview (never loadFile); built texts are reviewed left, current right, its differences; header note null"
    },
    {
      "name": "useRangeController.test a_since_review_view_shows_no_threads_and_builds_with_starts_threads_false",
      "proves": "since view builds before the thread list (listed true), with threads [] and startsThreads false; the whole view of the same file has the seeded threads"
    },
    {
      "name": "useRangeController.test a_no_text_since_reply_is_the_since_sentence",
      "proves": "logo.png's noText reply shows SINCE_NO_TEXT, builds nothing; sinceShown maps texts and noText"
    },
    {
      "name": "useRangeController.test the_whole_view_is_unchanged",
      "proves": "whole parts call loadFile once, build the file's texts with its threads and startsThreads true"
    },
    {
      "name": "useRangeController.test a failed since load answers null and reports it; a failed whole load answers null",
      "proves": "null paths of both loads; the since failure reports a reviewed problem"
    },
    {
      "name": "useRangeController.test wholeShown / viewKind cases",
      "proves": "texts keep mode note, other kinds their sentence; only changedSinceReview opens sinceReview"
    },
    {
      "name": "rangeThreads.browser.test a_number_drag_starts_no_thread_when_starts_threads_is_false",
      "proves": "with startsThreads false a number drag shows no tint and starts nothing on release (existing drag cases run with true)"
    },
    {
      "name": "rangeText.test reviewed count and mark words",
      "proves": "\"0 of 13 reviewed\", \"13 of 13 reviewed\"; REVIEW_MARK_WORDS"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend test; oxfmt --check; pnpm sfc-order; pnpm unused",
      "observed": "vue-tsc clean; oxlint+eslint clean; Test Files 314 passed, Tests 4706 passed; all files formatted; sfc-order and knip silent"
    },
    {
      "command": "just app-session start-fixture --name rv --range-case review --reviewed seeded --threads seeded --size 1600x1000; read rows",
      "observed": "\"Rdocs/keys.md… | renamed,reviewed\" (label span `truncate text-fg-muted`), \"Mpublic/logo.png | modified,changed since reviewed\", \"Msrc/board/board.ts 6+44−21 | modified,6 threads,changed since reviewed\"; status \"1 of 13 reviewed\"; Reviewed:aria-pressed false on config"
    },
    {
      "command": "click board.ts row; read headings; shot /tmp/yamt-rv/board-dark.png",
      "observed": "header: Reviewed, src/board/board.ts, \"Changed since you reviewed it\", \"Review from start\"; columns \"As you reviewed it\" | \"feature (9c1ba3f)\"; screenshot shows right 41–43 added (green), left 40→41 gap, no thread boxes"
    },
    {
      "command": "drag '.cm-lineNumbers .cm-gutterElement' --nth 17 --dy 40 (right 41→43, since view)",
      "observed": "{textareas:0, tinted:0} — no draft; control: same drag in the whole view opened a \"Write a comment…\" textarea"
    },
    {
      "command": "click logo.png row; read sentence",
      "observed": "\"This file changed since you reviewed it, and one of the two versions is not text. Review from start shows the whole change.\""
    },
    {
      "command": "click config row, click Reviewed",
      "observed": "selected → \"Adata/big.txt+1−0\"; config row `truncate text-fg-muted`, marks \"modified,reviewed\"; status \"2 of 13 reviewed\"; back on config Reviewed aria-pressed true (filled, /tmp/yamt-rv/config-light.png)"
    },
    {
      "command": "board.ts → click \"Review from start\"; shot /tmp/yamt-rv/board-whole-dark.png",
      "observed": "headings \"merge base of main and feature (531ea52)\" | \"feature (9c1ba3f)\"; row marks [\"modified\",\"6 threads\"] (no review mark); whole change with the seeded thread badges"
    },
    {
      "command": "Settings → Light → shots board-whole-light.png, config-light.png, logo-light.png",
      "observed": "data-theme light; filled Reviewed blue, outlined on logo, warning-coloured refresh mark and muted check legible in light; dark shots start-dark.png, board-dark.png, after-toggle-dark.png"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 208 killed, 6 survived, 7 no coverage, 1 error (ipc/index.ts, ui/rangeText.ts, ui/useRangeController.ts)",
    "survivors": [
      "src/ui/useRangeController.ts:287-295 useRangeController body/hosts/build NoCoverage — wiring: needs the store singleton and a CodeMirror RangeController (DOM); viewParts holds its logic and is tested; smoke covers the wiring",
      "src/ui/useRangeController.ts:198 flush \"post\" survivors and src/ipc/index.ts:214/218 IN_APP survivors — not on changed lines (unchanged code in a touched file)"
    ]
  },
  "acceptance_not_run": [
    "Browser tests (rangeThreads/range .browser.test.ts, new drag test): Playwright WebKit cannot launch here (#1242), vitest --project browser fails at start. Verifier runs them via MiniBrowser. Fixture smoke saw the same: since-view drag started nothing.",
    "Disabled look while the first marks list fails (busy stays true) not seen on screen: the fixture has no failing-list switch. Classes at RangeView.vue:111/125."
  ],
  "deviations_from_brief": [
    "frontend/src/ipc/index.ts: added `ReviewMark` to the reviewedDomain type export; the brief's given fact was false. Main granted it.",
    "The drag test is in rangeThreads.browser.test.ts, not range.browser.test.ts. The drag helpers and the DRAG probe live there. `opened(probe, { collapsed, startsThreads })` became an object parameter (TS7: two booleans). range.browser.test.ts only gains `startsThreads: true`.",
    "Added `viewParts(store, file, view)` and `viewKind(mark)` exports in useRangeController.ts so the since/whole rules can be tested without the store singleton. RangeApp's `viewOf` calls viewKind.",
    "Reviewed button adds `disabled:border-control-border disabled:bg-transparent disabled:text-fg-muted` (the house filled-button disabled look) so busy looks disabled even when filled. Review from start adds `shrink-0 disabled:text-fg-muted`.",
    "RangeFileRow's mark is a `role=img` span wrapping the lucide svg, with title and aria-label on the span (a WebKit svg title attribute shows no tooltip), and `flex shrink-0`. refresh-ccw-dot exists in @iconify-json/lucide.",
    "Smoke started with `--threads seeded` added so Review from start shows the seeded threads."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/RangeView.vue:87-92",
      "risk": "The left-pane search rule (taken without moving) is in the component and is not mutated or unit-tested; only reasoned. It is observable only with a since view and a left-only hit."
    },
    {
      "location": "frontend/src/ui/RangeView.vue:107-117",
      "risk": "During a toggle, busy briefly turns a filled Reviewed button outlined/muted (disabled look). This may flash on each click."
    }
  ]
}
