# MrMentionsCoreCorrectness

Agent output (`agent://MrMentionsCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsCoreCorrectness.md), collected 2026-11-05T09:36:26.777Z.

{
  "verdict": "fail",
  "checked": [
    "mentionWordAt traced vs design §2.1: `a@b.c`, `x@y`, `@@a`, `)@a` → null; `@an|na x` → {0,5,\"an\"}; caret outside 0..length → null (mentions.test.ts:26-65)",
    "Survivors per VF7: :16 `caret<0`→`<=0` is (a) equivalent (slice(0,0) never matches); :52 `\\s+`→`\\s` is (a) equivalent (global replace with \"\"). Both reasons correct",
    "Deviations accepted: regexes moved into functions for Stryker (no behaviour change), extra test lines. Open risk (caret between surrogate halves) accepted: selectionStart never lands there",
    "Traced kills: starts before contains (:82), first-wins dedup via toBe(ANNA) (:99), 10-line cap via slice(-2) (:103), blank branch incl. \" \" (:111), row before writers and nulls (:116), spaceless name (:89)",
    "Contract signatures match the brief; PM3 holds (mentions.ts imports only ./filters, ./suggestions); peopleOnRow exported, not re-exported from index; no `as`/`!`; AGENTS.md paragraph matches rules",
    "tree.md does not yet name internal/mentions.ts (PM6): outside this slice's Owned, left to the per-feature docs keeper (orchestrate §6). No test run: findings rest on hand traces"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/mentions.test.ts",
      "line": 73,
      "severity": "block",
      "rule_id": "RK76",
      "problem": "Every person here matches by starts-with, so ranking known and found together, starts-with first, passes all tests. Under that bug a search result can appear above the merge request's own person, breaking request acceptance \"merge request's people before search results\". This test is its only evidence.",
      "fix": "Add an assertion where a known person matches only by contains and a found person matches by starts-with, e.g. `mentionLines([DSCOTT], [ANNA], \"an\")` → [\"dscott\",\"anna\"]."
    },
    {
      "file": "frontend/src/mergeRequests/internal/mentions.test.ts",
      "line": 111,
      "severity": "should",
      "problem": "No test covers a bare `@` with more than 10 known people, so nothing checks the 10-line cap on the blank-text path. If `.slice(0, MENTION_LINES)` moved into the non-blank branch, a long thread's bare `@` would list every writer and no test would fail. Nothing else gets harder to grow.",
      "fix": "Add a blank-text case with 12 distinct known people and assert `toHaveLength(MENTION_LINES)`."
    }
  ]
}
