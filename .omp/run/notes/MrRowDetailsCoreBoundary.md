# MrRowDetailsCoreBoundary

Agent output (`agent://MrRowDetailsCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsCoreBoundary.md), collected 2026-11-02T19:59:38.344Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 16 files under frontend/src/mergeRequests/**; Stryker scratch files gone (glob finds none); tree.md/state.md left to the docs keeper.",
    "PM3/PM5: new files import only sibling internal/ files; index.ts is the only surface; rowPeople stays internal (choices.ts imports it).",
    "Contract: index drops toggled, exports clicked, stateOf, Held, Mode, ChoiceState, ReviewState, Reviewer, ListedLabel and all new names; Created alias = contracted bound.",
    "Deviations accepted: 'owner answer 2104', rowPeople as the one reviewers-to-persons rule, held Me-username keeps its count, vi.stubEnv TZ, rewritten old tests; no toggled/checked left.",
    "Acceptance test names all present, incl. 'Assignee: not Me, anna' and stored input = today's JSON (ui/mergeRequests.test.ts:557).",
    "TS3/TS4/TS14/TS17: exhaustive defaults, no as or !, named constants, Readonly<Record> tables; AGENTS.md: a line per new module plus the not: words."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/dueDate.ts",
      "line": 37,
      "severity": "should",
      "rule_id": "principles §2",
      "problem": "compareDays returns a millisecond difference, and daysLeft depends on that unit by dividing it by DAY_MS (line 48). The function never states this. If someone later makes compareDays return only a sign, daysLeft breaks. AGENTS.md also says the count uses 'UTC day numbers, never milliseconds', which reads against the code.",
      "fix": "Make compareDays return whole days (divide by DAY_MS inside it), so that daysLeft becomes `compareDays(day, today)` and DAY_MS has one user."
    }
  ]
}
