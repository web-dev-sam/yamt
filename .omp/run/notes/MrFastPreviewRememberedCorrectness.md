# MrFastPreviewRememberedCorrectness

Agent output (`agent://MrFastPreviewRememberedCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewRememberedCorrectness.md), collected 2026-11-04T22:13:38.583Z.

{
  "verdict": "fail",
  "checked": [
    "is_lost: ends '(HTTP 401)', =='glab: Invalid token' (M2 deviation accepted), holds '404 Project Not Found', ==NO_PROJECT; 403 and plain 404 kept (project.rs:123, unit test); words are glab's last stderr line",
    "13 actions apply logged_out_after once to the reply's failure: list.rs:68, job_log.rs:91 (fork 404 risk accepted, reply stays NoLog), people_*, rerequest:124, read:114, write:146, refusal() elsewhere",
    "Lock held during the ask; forget waits on it; auth status after a forget runs outside it; no nested lock. Mid-way list NotLoggedIn shows as listFailureText like Failed (risk accepted)",
    "Tests fail if feature deleted: a_401_forgets (15 actions, argv tail [call, auth status], (3,2)), a_403_keeps, a_missing_project_forgets, refresh_asks_again (2,2) vs (1,1); scope test races ms-long fake",
    "Writes stay one send (RK54): WRITE count 1, argv tail length 2; failure_words test covers 2xx-with-line. bindings.ts in commit is orchestrator's, not in patch",
    "Kept survivors project.rs:102 checked against VF7 (see finding). No tests run by me."
  ],
  "findings": [
    {
      "file": "tests/glab/README.md",
      "line": 88,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The new line says a token-less `glab api --method POST markdown` for a public project 'answers GitLab's preview, exit 0', but the slice's M3 measured `glab: 401 Unauthorized (HTTP 401)`, exit 1. The fake's reference now records the opposite of the measurement that open question 1 and B3's exception rest on.",
      "fix": "Rewrite the line to M3's observed output (body `{\"message\":\"401 Unauthorized\"}`, stderr `glab: 401 Unauthorized (HTTP 401)`, exit 1, 2026-11-04) and correct the note's deviation entry to match."
    },
    {
      "file": "crates/merge-requests/src/people_change.rs",
      "line": 153,
      "severity": "block",
      "rule_id": "B3",
      "problem": "[INFERENCE, unmeasured] After `glab auth logout` on a public project, the anonymous GraphQL mutation of change_people and rerequest_review (rerequest.rs:123) likely fails 'The resource that you are attempting to access does not exist or you don't have permission…'. is_lost misses that, so they reply Failed, not today's NotLoggedIn.",
      "fix": "Measure a token-less `glab api graphql` mergeRequestSetReviewers mutation on the playground. If it answers that sentence, add it to is_lost (auth status decides), with a fake api-status form and remembered.rs cases for both."
    },
    {
      "file": "crates/merge-requests/src/project.rs",
      "line": 102,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Both kept survivors are called 'equivalent', but they flip the contract-fixed `reason` of the forget's info line (login↔project), a branch with an observable effect: not VF7 (a) or (c). is_login also copies is_lost's terms. As the app grows, a wrong reason in support logs goes unnoticed.",
      "fix": "Have is_lost return Option<Lost> { Login, Project }, used for both the forget and its reason, and assert the variant in is_lost_reads_glabs_words; this kills both mutants and removes the copy."
    }
  ]
}
