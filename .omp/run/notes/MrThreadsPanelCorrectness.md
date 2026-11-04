# MrThreadsPanelCorrectness

Agent output (`agent://MrThreadsPanelCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanelCorrectness.md), collected 2026-11-04T16:00:03.948Z.

{
  "verdict": "pass",
  "checked": [
    "imageStyle matches each contract case (px/% width capped, px height before/after load, both px ratio, % width+px height natural ratio, % height ignored); tests pin each; images in both panels get :size",
    "SSR tests catch .vue bugs: crown only on dmitri, 'by' vs the comment author, iid filter, resolved/turn, Submit count/tip, disabled + reason rules, failure line, preview states, load/refusal + Retry",
    "Failure words go through problemText steps (problemText.ts:91-97): one source; tips and editedText with and without 'by' tested; platform-arg deviation accepted",
    "Survivors: the 6 NoCoverage mutants are `never` defaults (ImageSize.ts:56, ThreadText.ts:80,104), unreachable by type: VF7 (a), accepted. I mutated the .vue logic by hand",
    "Client-only paths are proved later and accepted: field height (box step 4), Escape/focus/Close (verify 10), Ctrl+Enter success (verify 7), caret (verify 6). Deviations accepted",
    "RK60/RK66: drafts are plain interpolation; style built from typed numbers; test asserts no script/href/on*. No test run needed (no block)"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 61,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "No test exercises the header's 'Open on GitLab' (C3: the first comment's page through openPage). The SSR test only shows it is enabled, and verify step 4 clicks a comment link, not this button, so `comments.at(-1)` or a deleted openThread would pass. As the panel grows, this C3 behaviour stays unguarded.",
      "fix": "Add a click on 'Open on GitLab' to verify brief step 4 that expects one `fixture_page` naming d01's first note page, or move the page choice into a tested pure helper."
    },
    {
      "file": "frontend/src/ui/MergeRequestReplyField.vue",
      "line": 131,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The `send` guard is the only thing that stops Ctrl+Enter from posting on a locked thread (the state's `write` never checks `commenting`), and nothing tests it. The `.trim()` at :58 is also uncaught: no test checks that whitespace-only text keeps the add buttons disabled.",
      "fix": "In the_buttons_row test, set '   ' and assert both add buttons are disabled; in verify step 7, press Ctrl+Enter in !636's field and expect no `fixture_write`."
    }
  ]
}
