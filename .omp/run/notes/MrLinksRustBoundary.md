# MrLinksRustBoundary

Agent output (`agent://MrLinksRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksRustBoundary.md), collected 2026-11-04T01:48:49.299Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all touched files fall within the Owned globs (crates/merge-requests/** except Cargo.toml, fake-glab, tests/glab/mr-links, README). Cargo, lock and src-tauri are untouched; fetch_description and Described match the Contract.",
    "IPC types: derives, camelCase and tag=\"kind\", docs, lib.rs re-exports and From<NoProject> for LinksReply match the Contract. read_links logs only counts, calls and score, never a title, reference or address.",
    "No copied decisions: described_on gives description and links one walk base; part_name is the one alias; graphql_data/listed/count/Nodes/Complexity are reused; Fetch follows the discussions.rs dyn FnMut pattern.",
    "RS6: html.rs is 394 lines. RS8: no unwrap outside tests (short() uses get). RS9: LinksReply/Target/Namespace matches list every variant. The fragment names no epic/hasEpic/hasParent/onlyTypes/reference.",
    "Fake glab: the links route is first in graphql() and reply always exits, so nothing falls through. Comment, README row and Scenarios entry are present, and every Acceptance test name exists in all three test files.",
    "Deviations accepted: described_on, commit_title, Default, unseen group item epic rule, web_path mismatch → none, log_read survivor. Forwarded per DR5: 6–7 s gitlab-org lookup vs rule 5's 'about a second'; Free work items unconfirmed."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/AGENTS.md",
      "line": 1,
      "severity": "should",
      "problem": "Line 1 is in this slice's Owned glob but is now stale. Its project.rs `From<NoProject>` list leaves out LinksReply and reading links, and its query.rs list leaves out links_args. As the crate grows, the next feature will copy a list that is already wrong.",
      "fix": "In line 1, add `LinksReply` and 'reading links' to project.rs's From list and its prelude list, and add the links lookup (`links_args`) to the query.rs list."
    },
    {
      "file": "crates/merge-requests/src/links/target.rs",
      "line": 91,
      "severity": "should",
      "rule_id": "R-open-1",
      "problem": "target_of compares Url's normalised origin string with project.rs's raw web_url authority, but description/address.rs compares `url.origin()` values. That is two 'same origin' rules in one crate. With an upper-case host or an explicit :443 in web_url, every link is silently dropped.",
      "fix": "Store a `url::Origin` in `Server` (parsed from `web_origin` in `Server::of`). Compare `url.origin() != server.origin` as address.rs does."
    },
    {
      "file": "crates/merge-requests/src/links.rs",
      "line": 178,
      "severity": "nit",
      "problem": "Off https, `read` still spends one glab call on fetch_description although links_of then returns empty groups. Nothing gets harder to grow, but each such hover waits for a useless call.",
      "fix": "In `read`, check `Server::of(&project)` before `fetch_description` and answer the empty `Read` without fetching."
    }
  ]
}
