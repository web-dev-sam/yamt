# MrFastPreviewRememberedR1Correctness

Agent output (`agent://MrFastPreviewRememberedR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewRememberedR1Correctness.md), collected 2026-11-04T22:29:18.252Z.

{
  "verdict": "pass",
  "checked": [
    "#2445/#2452: README.md:88-101 now gives M3 as measured (body 401, `glab: 401 Unauthorized (HTTP 401)`, exit 1, keyring caveat), curl no-token 401s, and the token-less mutation's 200 + denial",
    "#2453: lost() maps NO_PERMISSION to Lost::Login; glab.post's Err is stderr's last line `glab: <denial>` (gitio glab.rs:141), so after logout change_people/rerequest reply NotLoggedIn",
    "Logged-in denial keeps today's words: people.rs a_top_level_error_fails_and_asks_whether_the_login_is_gone pins Failed{DENIED} + 1 auth status; it and remembered.rs:303 fail if NO_PERMISSION is dropped",
    "Fake anonymous(): GET passes; non-graphql POST gets 401 (answer exits); graphql -f read passes; `--input -` gets 200 + stderr denial, exit 1, as M8 measured. reply() via after_post keeps the largest-k rule",
    "Scenario k=7: api anonymous, auth logged out (gitlab.com), reviewers read ben REVIEWED, so rerequest reaches its one mutation; test asserts MUTATION once, auth 2, project 1",
    "#2454: no survivors kept (17 mutants, 11 caught, 6 unviable, 0 missed); one Lost enum drives forget and its reason, and the unit test asserts the variant. Run known only from the note; I ran no tests"
  ],
  "findings": []
}
