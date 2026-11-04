# MrLinksRustCorrect

Agent output (`agent://MrLinksRustCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksRustCorrect.md), collected 2026-11-04T01:51:58.425Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 2: grouped() sends Epic to Epics, other types to Issues, unseen group to Epics, unseen project to Issues (tested). is_same merges #12 written 3 ways, epics/3 with work_items/3, and a short sha (same project only).",
    "Rule 4: Shown::Epic carries no parent; only the hierarchy widget's parent is read. linked_parent needs https, the origin and an Item. Tested: an_epics_own_parent_is_dropped, a_parent_on_another_host_gets_no_button.",
    "Rule 6: a null part, a null workItems and a missing iid each give 'not shown', never an error. Unit test plus !59 Free (group nodes [], parent null). glab Err or a GraphQL error fails and stops later calls (asked==1).",
    "RK41: pages_of offers each line's and each parent's page once, and is empty unless Read. Parent pages pass target_of. The unit test and the !62 integration test pin the order and dedupe; failed and logged-out replies have no pages.",
    "Budget: calls() packs greedily at 25+n per part, chunks of 100, exact sizes pinned. links_args argv is exact, k from 0 per call. Measured 124 vs estimate 125; !62 is one call.",
    "Deviations and open risks accepted (described_on, commit_title, Default, Server::of None, strict nodes). The 6-7 s group timing and the unconfirmed Free check go to the orchestrator."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/links.rs",
      "line": 162,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "When a lookup fails, the log shows calls=0 and score=None even though a call was made (or several before the failing one). The Contract's log line then hides that the lookup ran, which is exactly what you need when diagnosing a glab deadline. Nothing else builds on it.",
      "fix": "Return calls and score alongside the Err from links_of/looked_up and log them for the failed outcome; assert it in each_call_is_counted…."
    },
    {
      "file": ".omp/run/mutants/MrLinksRust.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The log_read→() survivor is kept as (c) wiring, but VF7 (c) needs the log line observed in a smoke and named. No smoke shows the 'read a merge request's links' line, so its field mapping (e.g. epics/issues swapped) is unverified. Nothing else builds on it.",
      "fix": "Paste a smoke run showing the info line and its fields (the fake mr-links scenario with RUST_LOG=info through the app, or mr-links-app's smoke) and name it in the reason."
    },
    {
      "file": "crates/merge-requests/src/links/tests.rs",
      "line": 567,
      "severity": "should",
      "problem": "No packing case lands exactly on LOOKUP_BUDGET: 179+27=206 is the closest. So `<=`→`<` or a +1 slack in lookup.rs:104 survives the test. Users won't see it while calls stay under GitLab's 250.",
      "fix": "Add parts summing to exactly 200 (100 iids = 125, plus 50 iids = 75) and assert one call, and a 51-iid variant and assert two calls."
    }
  ]
}
