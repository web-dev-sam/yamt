# MrThreadsFixturesBoundary

Agent output (`agent://MrThreadsFixturesBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsFixturesBoundary.md), collected 2026-11-04T12:39:28.468Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: every touched path is in Owned (fake glab, README, mr-threads*/**, the 4 mr-discussions/mr-review-mode discussion files, graphql-description-54.json); no Rust, TS or docs edits.",
    "Routes glab:270-278 are in the contract's order, before today's routes, each with a docs.gitlab.com comment; markdown is not counted; today's POST/GET */draft_notes stay.",
    "After-post rule glab:104-116: largest k<=n with .json, sidecars follow the chosen path, posts use respond() so are never redirected, unset state gives the base answer. The reply/respond split is accepted.",
    "Deviations accepted: empty post-5.json (204), @all data-author=4 (the note's author, Rust ignores it), refused copy of draft-notes-90, jq instead of grep -c, hasPreviousPage only in old scenarios.",
    "Spot-checked: d01 notes and edits; @ben/@all/group mentions; d10 author null; gid ids; scores 46/88; page !91 sam 3 / !90 dmitri 13; drafts 501-503 in REST shape; every mr-discussions/mr-review-mode file has the new fields.",
    "README rows and scenarios were added; tests/threads.rs is planned (mr-threads-crate.md:22). project-map tree.md:138-139 and :314 are now stale; the docs keeper updates them once per feature."
  ],
  "findings": [
    {
      "file": "scripts/fake-glab/glab",
      "line": 104,
      "severity": "nit",
      "problem": "The split leaves five answer verbs (answer, answer_file, reply, respond, serve_file), and reply vs respond does not say which follows the after-post rule. '(post calls respond)' narrates the code. A future route could pick respond and silently skip the rule.",
      "fix": "Rename respond to a name that says it ignores the state (e.g. reply_as_recorded) and drop the '(post calls respond)' parenthetical."
    }
  ]
}
