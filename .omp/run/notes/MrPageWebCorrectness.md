# MrPageWebCorrectness

Agent output (`agent://MrPageWebCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageWebCorrectness.md), collected 2026-10-30T19:59:41.505Z.

{
  "verdict": "fail",
  "checked": [
    "CI box is a fixed div in the CI span, not a Teleport: icon, box and job clicks (enabled or disabled) stop at MergeRequestRow.vue:95. A job emits ('job', page) once; the title's .stop makes Enter/Space open once.",
    "Null page: no pointer or hover class, the title is a plain v-else span, openPage() guarded. The conversion test refuses http, //, relative and empty pages and keeps null; no WebKit step required.",
    "One pageProblem field, one pageProblemText. The tests catch a swapped NOT_OFFERED, a skipped null-on-opened and a wrong PAGE_STEPS entry; problemText has 'page'. The store test checks which page reaches openPage.",
    "Survivor mergeRequestsText.ts:128 (never arm): VF7 (b) valid; an emptied block gives TS2366 in vue-tsc. The .vue click logic has no unit test; the implementer's WebKit and real-app smoke covers it.",
    "Accepted: step 'page' in problem.ts/problemText.ts (Owned extended by Main); CiStatusBox keeps its job-only openJob; open risk 2 (text selection) is a cost of the whole-row click the owner asked for.",
    "No old names in frontend/, scripts/, crates/, src-tauri/ or justfile. Fixture rows get <ORIGIN>/-/merge_requests/<iid>, pinned by the 'every listed row' test. outside-click handlers use capture."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 101,
      "severity": "block",
      "rule_id": "MrPageWeb Behaviour 1",
      "problem": "Clicking the open-changes button while it fetches should not open the page; no guard enforces this. While the button is disabled, a click hits the spinner SVG, which is not a disabled control. [INFERENCE] In WebKit/Blink that click bubbles through the button to the li, and openPage runs. The implementer lists this as an open risk and did not test it.",
      "fix": "Wrap the open-changes button in a `<span class=\"flex shrink-0\" @click.stop>` like the CI box (or share one stopping wrapper for both). Then the exception does not depend on how the engine handles clicks on disabled controls."
    },
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 95,
      "severity": "block",
      "rule_id": "MrPageWeb Behaviour 1",
      "problem": "In a clickable row without a pipeline, the empty 28px CI slot still has `cursor-default` and `@click.stop`. Clicking there does nothing and shows an arrow cursor, but the brief says a click anywhere except the CI box opens the page.",
      "fix": "Apply `@click.stop` and `cursor-default` only when `row.pipeline !== null`, e.g. `:class`/`v-on` behind that condition, or move them onto a wrapper inside the v-if."
    },
    {
      "file": "frontend/src/ui/MergeRequestRow.vue",
      "line": 70,
      "severity": "should",
      "problem": "The inner span's `:title=\"row.title\"` covers the whole button, so Behaviour 2's tooltip \"Open !N on GitLab\" practically never shows (implementer's open risk 1). Nothing gets harder to grow, but a brief line goes unmet without a recorded decision.",
      "fix": "Remove the span's title and give the button one tooltip with both lines, `${row.title}\\n${pageTitle}`. Keep aria-label as pageTitle. Alternatively, have the orchestrator record which tooltip wins."
    }
  ]
}
