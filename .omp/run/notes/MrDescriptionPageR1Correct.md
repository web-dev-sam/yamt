# MrDescriptionPageR1Correct

Agent output (`agent://MrDescriptionPageR1Correct`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionPageR1Correct.md), collected 2026-11-04T01:16:17.030Z.

{
  "verdict": "fail",
  "checked": [
    "#2294/#2298 fixed: panel listens in bubble phase (:36). Search field with text, focused people/CI box and job log (focused at mount) preventDefault on their own element first, so the panel skips; empty search field leaves Escape to it.",
    "Order: view's window listener is set up before the v-if panel mounts, so it runs first: closes a filter menu (:105-108), returns while description set (:110-112), else goes back. Notes' smoke: menu, panel, page. Untested; in ui/AGENTS.md.",
    "Accepted keeping `asking`: QuestionDialog.vue:29 closes only via @cancel (keydown's default action), never preventDefault, so without it the panel would close behind a question. The view has the same guard (:102).",
    "Accepted: a pointer-opened hover box with focus in the panel doesn't take Escape (element-level handler), so the panel closes and the box stays. Matches design §1.7 and pre-fix page behaviour. tooltip hide doesn't preventDefault.",
    "#2299 fixed: tauriMergeRequests.test.ts:429 pins the literal yamt-picture://localhost/upload~… and the convertFileSrc mock builds from the real constant. Rust side pinned by src-tauri/tests/csp.rs:59.",
    "Moves: isLinkedPage now domain.ts:206, toSettingsRead in settingsRead.ts (one caller tauri.ts, no cycle, named in tree.md:150). R1 mutation: no survivors on changed lines; 4 on unchanged lines are below the RV8 bar."
  ],
  "findings": [
    {
      "file": "docs/architecture.md",
      "line": 2030,
      "severity": "block",
      "rule_id": "PM6",
      "problem": "Architecture still says the panel's Escape is 'a window keydown listener in the capture phase', which is the opposite of the fixed code. The next implementer who reads it would bring back #2294/#2298. The docs commit f81acbcf came before this fix, and the fix did not update it.",
      "fix": "Say it is a bubble-phase window listener for an Escape nothing took, not while `asking`. Add that the page's listener closes a filter menu first, then leaves Escape to the panel while `description` is set."
    },
    {
      "file": ".omp/skills/project-map/tree.md",
      "line": 288,
      "severity": "block",
      "rule_id": "PM6",
      "problem": "The project map's MergeRequestDescription row still says 'Escape on window in the capture phase (not while `asking`)'. Every session reads this map first, so it contradicts the fixed code and the updated ui/AGENTS.md.",
      "fix": "Replace 'in the capture phase' with 'in the bubble phase, only on an Escape nothing took (`defaultPrevented`)', and mention that MergeRequestsView's listener runs first and leaves Escape to the panel while a description is shown."
    }
  ]
}
