# MrPeopleRustCorrect

Agent output (`agent://MrPeopleRustCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleRustCorrect.md), collected 2026-11-03T22:44:03.163Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 6: is_shown follows design §1.3 per group, case-insensitive; unit tests cover every cell, a group mix-up and case both ways; tests/people.rs posts 5 and 8 return unchanged with GitLab's lists (RK64).",
    "Rule 8/RK54: body is the group's mutation with usernames:[username] and APPEND/REMOVE as serde_json variables; all 4 combos tested. each_change...: 8 --input calls, no REPLACE/-X/*_ids; rerequest test only renamed.",
    "RK53: people.rs offers pictures (insert, latest wins) before returning. The shell tests see /erik 404 before the search and the PNG after; post 1 offers sam and erik. Both fail if offer is deleted.",
    "Errors: glab Err or top-level error → Failed; payload errors → Refused; no payload/MR → Failed(shared NO_MERGE_REQUEST); missing glab or logged out runs only auth status. Log has no username; outcome = serde kind.",
    "Mutants: re-listed with cargo mutants --in-diff on 6830881f~1..6830881f → 32: 19 Default:: unviable, 13 caught (is_shown 3, outcome 4, query 6). Matches the note; no kept survivors to judge.",
    "Fake glab: search route after iids, before iid; answered_posts writes the per-Fake state file; posts 2/5/7/8 and people-er match the brief. Deviations (test move, dead_code expect, docs-keeper lines) accepted."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/tests/people.rs",
      "line": 214,
      "severity": "should",
      "rule_id": "R-rule-8",
      "problem": "\"Nothing else is asked\" (brief: posts 3–4) is checked only for `argv: api graphql` lines. A regression that reads the merge request over REST before the write would still pass. Rule 8's \"nothing read before it\" then rests on a partial check as later write paths copy this one.",
      "fix": "Assert the whole `fake.logged(\"argv: \")` sequence: `auth status`, `api projects/:fullpath`, `api graphql --input -`, twice."
    }
  ]
}
