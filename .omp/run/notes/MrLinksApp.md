# MrLinksApp

Agent output (`agent://MrLinksApp`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksApp.md), collected 2026-11-04T01:51:15.567Z.

{
  "summary": "`read_links(iid) -> LinksReply` exists as an async Tauri command in `src-tauri/src/merge_requests/links.rs`. `links_reply` returns Failed{NO_PROJECT} when there is no GitLab project. Otherwise it calls the crate's `read_links` and offers every line's and parent's page through `offer` (no pictures) before replying. The command is registered after `read_description`, so `commands.readLinks(iid)` gets generated. Five tests over scenario `mr-links` pin RK41 and rule 6. The `open_page` doc comment now says 'a reply of this window sent (lists, discussions, descriptions, links)'.",
  "files_changed": [
    "src-tauri/src/merge_requests/links.rs",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/links.rs"
  ],
  "tests_added": [
    {
      "name": "merge_requests::tests::links::a_line_and_a_parent_page_are_offered_before_the_reply",
      "proves": "RK41: the #12 work-item page and its parent's groups/taskboard/-/work_items/3 page answer notOffered before read_links(62), then opened after it, each reaching the fake opener once (opener part skipped on macOS)"
    },
    {
      "name": "merge_requests::tests::links::a_page_the_links_reply_did_not_name_is_not_offered",
      "proves": "RK41: after read_links(62), web#6's parent on evil.example, the milestone and the gitlab.other issue answer notOffered and the opener log stays empty"
    },
    {
      "name": "merge_requests::tests::links::an_unseen_things_address_is_offered",
      "proves": "rule 6: secret/vault/-/issues/9 (GitLab answered null for it) opens after read_links(62) and reaches the opener"
    },
    {
      "name": "merge_requests::tests::links::no_gitlab_project_fails_the_read",
      "proves": "a folder without a GitLab remote gets {kind: failed, message: NO_PROJECT}, with no glab call"
    },
    {
      "name": "merge_requests::tests::links::read_links_answers_through_the_command",
      "proves": "through the registered command: !62 gives kind read with epics/issues/commits lengths 3, 6, 4; !60 gives failed 'glab: a deadline line'"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check",
      "observed": "no output, exit 0"
    },
    {
      "command": "cargo clippy -p yamt-app --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 37.63s (no warnings)"
    },
    {
      "command": "cargo nextest run -p yamt-app",
      "observed": "PASS links::no_gitlab_project_fails_the_read; PASS links::a_page_the_links_reply_did_not_name_is_not_offered; PASS links::a_line_and_a_parent_page_are_offered_before_the_reply; PASS links::an_unseen_things_address_is_offered; PASS links::read_links_answers_through_the_command; Summary [7.298s] 215 tests run: 215 passed, 36 skipped"
    },
    {
      "command": "just bindings-check",
      "observed": "Differences found: only the open_page doc comment change, `readLinks: (iid: MergeRequestIid) => typedError<LinksReply, IpcError>(__TAURI_INVOKE(\"read_links\", { iid }))`, and the new types DescriptionLinks, LinkedCommit, LinkedEpic, LinkedIssue, LinkedParent, LinksReply, ShownEpic, ShownIssue. These are the expected differences; the orchestrator regenerates."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 6 mutants tested in 73s: 6 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The open_page doc comment in src-tauri/src/merge_requests.rs was changed as the assignment asked; the comment also flows into bindings.ts.",
    "`mod links` is `pub(crate)`, as `description` is, because commands.rs names `merge_requests::links::read_links`.",
    "an_unseen_things_address_is_offered also checks the opener log (`argv: <page>`) and skips on macOS, as the description tests do, so the test never starts the real browser.",
    "Docs keeper (not Owned): name `read_links`/`readLinks`/`links_reply` next to the `read_description` entries in docs/architecture.md (~l.568), .omp/skills/ipc-contract/SKILL.md l.108 (a new command row), project-map/tree.md l.112 (`merge_requests/links.rs`, tests/links.rs on mr-links) and src-tauri/AGENTS.md.",
    "Docs keeper: add the two RK41 test names above to RK41's test list (risk-register/SKILL.md l.55). The MergeRequestState doc (merge_requests.rs:59-62), which lists whose pages are offered, should add 'every page `read_links` sent'. It is outside Owned and was left unchanged."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/merge_requests/links.rs:20",
      "risk": "All 6 mutants were unviable (LinksReply has no Default). Dropping the `offer` call is not a mutant cargo-mutants generates; a_line_and_a_parent_page_are_offered_before_the_reply covers it, but I did not observe that test failing with the call removed [INFERENCE]."
    }
  ]
}
