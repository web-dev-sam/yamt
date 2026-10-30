# MrWindowCoreCorrectness

Agent output (`agent://MrWindowCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowCoreCorrectness.md), collected 2026-10-30T13:56:09.365Z.

{
  "verdict": "pass",
  "checked": [
    "filters.test.ts: OR within / AND across ([1,2],[3],[2,3]); a literal username 'me' never matches Me (LITERAL_ME row 4); None; Draft 3 ways; Me ≠ person 'Me'; None ≠ label 'None'.",
    "choices.test.ts: Me, None, then by name; Label None first; checked missing values kept at 0. order.test.ts fails on ties sorted by ascending iid and on a dedupe keeping the current copy.",
    "relativeTime.test.ts sits exactly on the boundaries (59 s, 1 min, HOUR-1, 7 d, 30 d, 365 d), so >=→> and floor→round fail. ciBox.test.ts fails if jobs are reordered. summary.test.ts covers singular and cut.",
    "stored.test.ts: 7 kinds of junk, round trip of 'user:user:odd' and 'label:none'. mergeRequestFilters.test.ts: another repository's entry survives a write; a null repository writes nothing (the 'null' key is checked).",
    "Kept survivors: mergeRequestFilters.ts:13 and stored.ts:46 are truly equivalent (VF7 a). filters.ts:47,128 never-arms are gate-covered by vue-tsc (VF7 b). The justfile web_globs now include mergeRequests/. No test run.",
    "Glab cutover is clean (grep finds no second copy of the sentences or RECHECK_PAUSE_MS). Deviations accepted: cut text uses loaded; manual wording; serverPins pattern for the stored form; docs rows left to the keeper."
  ],
  "findings": [
    {
      "file": "frontend/scripts/fences.ts",
      "line": 40,
      "severity": "should",
      "rule_id": "VF6",
      "problem": "No committed fences.test case covers `mergeRequests: \"self-contained\"`. Deleting it, or downgrading it to framework-free, fails no test. Only fences.ts refuses `../ipc`-style imports here, and every sibling module has its PM2/PM3 cases. So a later B4/B5 import into the core could slip through unnoticed.",
      "fix": "Orchestrator (fences.test.ts is not the slice's): copy the three search tests at fences.test.ts:341-389 with src/mergeRequests paths and the reason 'mergeRequests/ imports no other src/ module'."
    },
    {
      "file": "frontend/src/ui/mergeRequestFilters.ts",
      "line": 26,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The survivor at this line is kept as (c) wiring, but no smoke observed this event. windowStorage.test asserts its own event name, not this one. Five sibling storedValue users (toolbarButtons.test.ts:286, paneSplit.test.ts:118, …) pin their event and the in-memory fallback with a throwing storage. Nothing grows harder beyond that one untested path.",
      "fix": "Add a throwing-storage test that asserts '[warn] mergeRequests.filters_storage_failed {kind: \"Unexpected\", …}' and that `filters` still follows `set`, as toolbarButtons.test.ts:286 does."
    },
    {
      "file": "frontend/src/mergeRequests/internal/choices.ts",
      "line": 82,
      "severity": "nit",
      "problem": "When a checked person is the logged-in user, their row is labelled by username ('sam') even though `people` holds their name ('Sam Lee'). Every other listed person reads by name. Nothing grows harder.",
      "fix": "Use `people.get(held.username)?.name ?? held.username` for the label and update choices.test.ts:114 to expect 'Sam Lee'."
    }
  ]
}
