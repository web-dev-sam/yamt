# MrReviewModePageCorrectness

Agent output (`agent://MrReviewModePageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModePageCorrectness.md), collected 2026-11-03T18:45:00.373Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 3.1 is right: !93's two discussions both end with sam's notes (note_931, note_932). turnCounts={viewersTurn:0,waiting:2}, so first=false despite the due date; it stays last.",
    "Me order by hand: 94(0 waiting) 91(0) 96(1) 93(2) = !94 !91 !96 !93, unchanged with 93 due (a wrong rule would give !93 first). Draft All, Anna and Ben (!90 fails) match the brief.",
    "The scenario matches the brief's tables (reviewers, drafts, counts, currentUser sam, scores 170/58); project.json equals mr-discussions'. In the fixture, discussion 1 is now by reviewers[0] (:76) and the failing iid is 615.",
    "the_review_orders_the_smoke_expects (design §1.9) fails if the fixture change or 615 is reverted. The rewritten both_turns test fails if discussion 1 goes back to sam. menuKeys test pins the radio role.",
    "Wiring: v-if 'full' (rule 7). pick calls review(), then close() refocuses the picker's opener. menu() and opener() resolve the picker. Escape is preventDefaulted. The titles test glob covers the new .vue files. No tests were run.",
    "Survivor :66 `?.`→`.` is a correct (a): fixtureRows always yields the row. Lines 32-37 are unchanged older lines."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestReviewMode.vue",
      "line": 91,
      "severity": "should",
      "problem": "The only evidence for WebKit step 1's 'the arrow keys step through it' records 'Me→Anna→Chiara→Ben', but the same note lists the menu as Me, Anna Berg, Ben Okafor, Chiara Rossi. stepMenuItem walks the DOM order (byCountThenLabel puts Ben before Chiara), so the recorded steps contradict the code. If it stays, nothing gets harder, but the acceptance line has no consistent proof.",
      "fix": "The verifier's WebKit smoke step 1 should press ArrowDown four times from Me and record each focused item. The expected order is Me→Anna Berg→Ben Okafor→Chiara Rossi→Dmitri Volkov."
    },
    {
      "file": ".omp/run/mutants/MrReviewModePage.survivors.txt",
      "line": 2,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The reason 'fixture text tests assert them' does not cover the LONG_TEXT prefix literal at fixtureMergeRequestDiscussions.ts:32. Mutated to \"\", padEnd still gives a 400-character single line, so the_markup_text_and_a_pageless_discussion_exist would pass even if re-run. That mutant is (a) equivalent, not (b). Nothing gets harder.",
      "fix": "Split the line: label the LONG_TEXT prefix as (a) equivalent (only the length and the single line are observable), and keep (b) #732 for MARKUP_TEXT and SHORT_TEXTS."
    }
  ]
}
