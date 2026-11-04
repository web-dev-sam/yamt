# MrThreadsPanelR1

Agent output (`agent://MrThreadsPanelR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanelR1.md), collected 2026-11-04T16:06:23.971Z.

{
  "summary": "All five findings are fixed. The panel works out one `writable` (read, not refreshing, not sending), used by Submit review and passed to the field for its buttons. Ctrl+Enter and Escape in the field use `boxKeydown` (isComposing checked, keys defined once). `useBesidePlacement` places the CI log and the panel. `ImageSize` is exported once. New tests cover whitespace text, Submit review during a refresh and the placement. The CI log still sits exactly left of its box in WebKit.",
  "files_changed": [
    "frontend/src/ui/useMenuPlacement.ts",
    "frontend/src/ui/useMenuPlacement.test.ts",
    "frontend/src/ui/CiStatusJobLog.vue",
    "frontend/src/ui/MergeRequestThread.vue",
    "frontend/src/ui/MergeRequestReplyField.vue",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts",
    "frontend/src/ui/mergeRequestImageSize.ts",
    "frontend/src/ui/MergeRequestDescriptionImage.vue"
  ],
  "tests_added": [
    {
      "name": "useMenuPlacement.test.ts: a_panel_beside_its_anchor_ends_at_the_anchors_left_with_tops_level",
      "proves": "#2372: besideLeft puts the panel's right edge at the anchor's left (x = left − width) and keeps its top at the anchor's top."
    },
    {
      "name": "useMenuPlacement.test.ts: the_beside_placement_puts_an_unmeasured_panel_at_its_anchor",
      "proves": "useBesidePlacement goes through the shared placement and returns px left/top (this kills the mutant that empties its body)."
    },
    {
      "name": "MergeRequestThreadPanel.test.ts: the_buttons_row_… (whitespace step added)",
      "proves": "#2376: with text \" \\n\\t \" both add buttons stay disabled and Resolve stays enabled (catches a missing .trim())."
    },
    {
      "name": "MergeRequestThreadPanel.test.ts: a_refreshing_thread_… + submit_review_shows_… (assertions added)",
      "proves": "#2370: Submit review is enabled on a read thread and disabled while it refreshes after a send, the same rule as the reply buttons."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused",
      "observed": "vue-tsc -b: no output. oxlint --type-aware && eslint: no findings. oxfmt: \"All matched files use the correct format. Finished … on 820 files\". knip --include exports,types: no findings."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  298 passed (298) / Tests  4452 passed (4452)"
    },
    {
      "command": "just app-session start-fixture --name mtp1 --diff --mr list --open-mr --size 1600x1000; hover \"Pipeline failed\" --nth 0; hover \"[role=group] li:nth-child(3)\"; press Shift; read the dialog and CI box rects",
      "observed": "dialog {label:\"Log of lint:docs\", left:498.36, right:1394.359375, top:167.234375, width:896, height:576}; CI box (group \"Pipeline failed\") {left:1394.359375, top:167.234375}. Right edge = box left, tops equal: same numbers as before the move (CiJobLogPage: 1394.36 / 167.23)."
    },
    {
      "command": "just app-session shot --name mtp1 /tmp/mtp1-joblog.png; stop --name mtp1",
      "observed": "Shot /tmp/mtp1-joblog.png: the lint:docs log panel sits directly left of the Failed jobs box, top edges level. The session stopped cleanly."
    },
    {
      "command": "just mutants HEAD",
      "observed": "2 TS files, 83 mutants: 79 killed, 2 survived, 2 no coverage, 0 errors (95.18%). useMenuPlacement.ts 17/19 killed, mergeRequestImageSize.ts 62 killed + 2 no coverage."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 79 killed, 2 survived, 2 no coverage, 0 errors (95.18%); .vue files are not mutated",
    "survivors": [
      "useMenuPlacement.ts:37 box \"border-box\" → {} / \"\" — wiring: useElementSize never measures in node. The WebKit rect check covers it (right 1394.359375 = box left exactly).",
      "mergeRequestImageSize.ts:56 never arm (NoCoverage ×2) — equivalent: unreachable once the switch is exhaustive; I did not change this line."
    ]
  },
  "acceptance_not_run": [
    "#2376 part 2: Ctrl+Enter in !636's locked field with no fixture_write. Only mr-threads-box mounts the panel and SSR cannot send keys. The keydown goes through `send`, which checks add.disabled (asserted on !636). It belongs in the verifier's WebKit step 7."
  ],
  "deviations_from_brief": [
    "#2373: MergeRequestReplyField.vue now imports `boxKeydown` from `ui/rangeKeys.ts` (Mod-Enter submits, Escape cancels, skipped while `isComposing`). This replaces the `.ctrl.enter.exact` modifier. rangeKeys.ts has the range prefix, but no fence (PM9/PM10) forbids a page file importing it. Renaming it to a neutral name would be its owner's change.",
    "Because boxKeydown stops Escape from bubbling, the field emits a new `close` event and MergeRequestThread forwards it to its own `close`. The field also gets a new `writable: boolean` prop (#2370). MergeRequestThread's props, emits and exports are unchanged.",
    "#2372 also edits useMenuPlacement.ts (+ new test) and CiStatusJobLog.vue, as the task allowed. New exports: `besideLeft` (pure) and `useBesidePlacement`. `useMenuPlacement` keeps its signature and shares a private `usePlacement`, so one useElementSize measures.",
    "Docs keeper: the project-map tree.md row for ui/useMenuPlacement.ts should name useBesidePlacement (the side panels: CI job log, thread)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue keyPressed",
      "risk": "Escape in the textarea now closes the panel through the field's `close` event, not the panel's keydown handler. stopPropagation also keeps it from document listeners, as in the range boxes. This is unproven in WebKit until the box mounts the panel."
    },
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue keyPressed",
      "risk": "Mod-Enter means Cmd+Enter on macOS, not Ctrl+Enter (GitLab accepts both). On Linux it is Ctrl+Enter as the brief says."
    }
  ]
}
