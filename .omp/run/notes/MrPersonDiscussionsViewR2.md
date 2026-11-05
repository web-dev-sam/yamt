# MrPersonDiscussionsViewR2

Agent output (`agent://MrPersonDiscussionsViewR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsViewR2.md), collected 2026-11-05T15:16:13.449Z.

{
  "summary": "#2529: when an entry is expanded, its header wraps (`flex-wrap gap-y-1`). The place text is capped at the header width (`max-w-full truncate`), so a long path shortens instead of overflowing. At 560 and 700 px, in dark and light, every control in the head stays inside the entry and responds to clicks. #2530: when more than 99 writers are folded, the writers chip reads \"99+\"; at 99 or fewer it still shows \"+N\". The tooltip still names every folded writer.",
  "files_changed": [
    "frontend/src/ui/MergeRequestPersonEntry.vue",
    "frontend/src/ui/MergeRequestWriters.vue",
    "frontend/src/ui/MergeRequestPersonViewPage.test.ts"
  ],
  "tests_added": [
    {
      "name": "a_fold_above_99_writers_reads_99_plus_and_its_tip_still_names_every_one",
      "proves": "99 folded writers show \"+99\"; 100 show \"99+\" in the 20 px slot; both tooltips name every folded writer (\"N more: Someone, …\")."
    },
    {
      "name": "an_expanded_entry_shows_the_inline_thread_and_hides_the_clamp (extended)",
      "proves": "An expanded entry's header carries `flex-wrap gap-y-1`; a collapsed entry's header keeps the single-line class."
    },
    {
      "name": "an_entry_shows_its_starter_time_merge_request_place_and_first_comment (updated)",
      "proves": "The place span now has `max-w-full shrink-0 truncate`."
    }
  ],
  "smoke_evidence": [
    {
      "command": "just app-session start-fixture --name r2v --size 560x900 --diff --mr list --open-mr; click Discussions; expand all 56; probe each chevron, header span and header button: its rect inside the entry's rect, and elementFromPoint at its centre lands on it (dark)",
      "observed": "{\"controls\":459,\"entries\":56,\"overflowHeads\":0,\"withSubmit\":12,\"maxHeadRows\":5,\"theme\":\"dark\"}. All 459 controls are inside the entry rect. The 6 missed hits are disabled `Open on GitLab` buttons (no page, pointer-events-none by design). Screenshot /tmp/r2v-560-dark.png."
    },
    {
      "command": "same at 560, after document.documentElement.dataset.theme='light'",
      "observed": "{\"controls\":459,\"entries\":56,\"overflowHeads\":0,\"theme\":\"light\",\"width\":560}. Same result: only the 6 disabled Open on GitLab buttons miss a hit, all inside the entry. Screenshot /tmp/r2v-560-light.png."
    },
    {
      "command": "restarted with --size 700x900; same probe, disabled buttons counted apart (dark)",
      "observed": "{\"controls\":459,\"entries\":56,\"disabledInside\":6,\"overflowHeads\":0,\"bad\":[],\"width\":700,\"theme\":\"dark\"}. Screenshot /tmp/r2v-700-dark.png."
    },
    {
      "command": "700, light",
      "observed": "{\"controls\":459,\"entries\":56,\"disabledInside\":6,\"overflowHeads\":0,\"bad\":[],\"width\":700,\"theme\":\"light\"}. Screenshot /tmp/r2v-700-light.png: the head row is Anna Berg · 2 days ago / !637 … src/board.ts:12 / Your turn, ↗, Submit review 2 pending, all inside the entry."
    },
    {
      "command": "pnpm -C frontend fmt; typecheck; lint; test; unused",
      "observed": "fmt: Finished on 854 files. vue-tsc -b: clean. lint: oxlint + eslint clean, after moving two test helpers to function declarations. Test Files 310 passed, Tests 4655 passed. knip: clean."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"no Rust changes since HEAD\", \"no TypeScript changes since HEAD\": only .vue files and the test file changed, and .vue is not mutated",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The 99+ cap (`COUNTED_MAX = 99`) lives in MergeRequestWriters.vue, not mergeRequestsText.ts. That file is at 299 lines and the oxlint `max-lines` cap is 300 (blank lines count), so even a 4-line helper would break the lint. As a result the cap is not mutated, because .vue files are not; the new page test pins the 99/100 boundary instead.",
    "The 99+ test renders MergeRequestWriters directly with 102 and 103 unknown writers, because no fixture has more than 99 later writers."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestPersonEntry.vue:106-108",
      "risk": "The starter name and the time are still `shrink-0`. A very long display name in a narrow window could still overflow the head. Fixture names are short, so this was not observed."
    },
    {
      "location": "frontend/src/ui/MergeRequestWriters.vue:15",
      "risk": "\"99+\" at text-[0.625rem] in the 20 px slot was not seen in WebKit, because no fixture folds 100 writers. Three 10 px glyphs should fit, and the chip keeps overflow-hidden."
    }
  ]
}
