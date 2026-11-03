# MrPeopleRustBoundary

Agent output (`agent://MrPeopleRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleRustBoundary.md), collected 2026-11-03T22:44:31.568Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: every touched file is in Owned (crates/merge-requests/**, src-tauri merge_requests*, commands.rs list, fake glab, tests/glab). No Cargo.toml, gitio, frontend or docs edits.",
    "Contract: types, derives, camelCase, tag=kind, both From<NoProject> (project.rs:126-142), mutation texts and body as in the brief, may_rerequest doc (lib.rs:250), commands after read_discussions.",
    "Reuse: UserNode, ReviewerNode, People, Nodes, listed, graphql_data, one_per_username, warn_unknown_review_state, NO_PROJECT, NO_MERGE_REQUEST (not copied). src-tauri people.rs has discussions.rs's shape.",
    "Deviations accepted: query tests moved to query/tests.rs (same as page/check/discussions); #[expect(dead_code)] mod fake_glab (same as settings/tests); shorter fn docs; ImageMagick PNG for 7; docs-keeper lines.",
    "PM1: no new edge (gitio Glab and serde_json are already deps). info! logs only outcome/count or iid/group/action, never text or username. Query comments cite GitLab's file and the measured glab run (CP1).",
    "Fake glab: search route sits before the iid route and goes through reply (.json/.status/.err/.exit/.sleep). README graphql-page/merge-request rows exclude `search`. post-<n> row generalised; answered_posts documented."
  ],
  "findings": [
    {
      "file": "src-tauri/src/merge_requests/people.rs",
      "line": 21,
      "severity": "should",
      "problem": "search_reply and change_reply write `offered` directly, but state.md:67 and architecture §5.1 :1280 still say `offer` is the only path. tree.md:109 and src-tauri/AGENTS.md omit people.rs. The deviations name none of these, so readers trust a wrong writer list.",
      "fix": "Add docs-keeper lines for state.md:67 and architecture §5.1 (two new direct writers of `offered`, before the reply), tree.md:109 (people.rs, tests/people.rs, the two commands) and src-tauri/AGENTS.md."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 354,
      "rule_id": "RS6",
      "severity": "should",
      "problem": "merge_requests.rs is now 446 lines (it was 413) and lib.rs is 409 (it was 402); both were already over RS6's 400 and no detector catches it. Every new merge-request command and IPC type lands in these two files, so they keep growing.",
      "fix": "Have the orchestrator schedule a split by responsibility. For example, move MergeRequestRow and its neighbouring types from lib.rs into `row.rs`, and the list/forward_page code from merge_requests.rs into a submodule."
    },
    {
      "file": "crates/merge-requests/src/people_change.rs",
      "line": 12,
      "severity": "should",
      "problem": "people_change.rs imports NO_MERGE_REQUEST from rerequest.rs, so a generic answer-shape message lives in one feature's module and the next mutation would depend on rerequest too.",
      "fix": "Move NO_MERGE_REQUEST to page.rs beside NO_PROJECT and graphql_data, and import it from there in rerequest.rs and people_change.rs."
    },
    {
      "file": "scripts/fake-glab/glab",
      "line": 139,
      "severity": "nit",
      "problem": "The search route builds `graphql-people-$search` from raw text, so a search containing `/` or `..` (an app session typing freely) reads a file outside the scenario. Nothing breaks today; a future scenario could pass by accident.",
      "fix": "Before reply, add `case $search in */*) fail \"search text with / has no answer file\" ;; esac`."
    },
    {
      "file": "src-tauri/src/merge_requests/pictures.rs",
      "line": 52,
      "severity": "nit",
      "problem": "The `Pictures::offer` doc says 'the pictures a list page offered', but discussions, search and change replies now offer too. A reader looking for writers is misled; nothing else gets harder.",
      "fix": "Reword it to 'Remembers the offered uploaded pictures, each username's latest address winning.'"
    }
  ]
}
