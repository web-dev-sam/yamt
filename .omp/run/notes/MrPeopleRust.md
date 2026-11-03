# MrPeopleRust

Agent output (`agent://MrPeopleRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleRust.md), collected 2026-11-03T22:38:59.217Z.

{
  "summary": "Searching a project's people and adding or removing one assignee or reviewer now work in Rust. `people_search.rs` asks GitLab's `autocompleteUsers`. `people_change.rs` sends one APPEND or REMOVE of one username and calls the result Changed or Unchanged from GitLab's answered lists. Queries are in `query.rs`. New commands `search_people` and `change_people` offer pictures before replying. The fake glab has a `search=` route; scenario `mr-people` has posts 1–8; `Fake::answered_posts` is new.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/people_search.rs",
    "crates/merge-requests/src/people_change.rs",
    "crates/merge-requests/src/people_change/tests.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/query/tests.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/rerequest.rs",
    "crates/merge-requests/tests/people.rs",
    "crates/merge-requests/tests/fake_glab/mod.rs",
    "crates/merge-requests/tests/rerequest.rs",
    "crates/merge-requests/tests/{discussions,job_log,list,local_conflicts,open,picture,resolve}.rs",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/people.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/people.rs",
    "src-tauri/src/commands.rs",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-people/** (project.json, graphql-page-1.json, graphql-people-{er,an,gh,nobody}.json, graphql-people-broken.{err,exit}, post-1..8.{json,status}, pictures/uploads/-/system/user/avatar/{1,2,7}/avatar.png)"
  ],
  "tests_added": [
    {
      "name": "query::tests::the_search_query_is_one_line_and_its_argv_is_exact",
      "proves": "The search query is one line with balanced braces, and the argv is exact, with the text passed as a raw `-f search=` field."
    },
    {
      "name": "query::tests::the_change_body_names_the_groups_mutation_with_one_username_and_the_actions_mode",
      "proves": "For all four group × action pairs: the group's own mutation text, `usernames` holding one name, and mode APPEND for add, REMOVE for remove."
    },
    {
      "name": "people_change::tests: an_added_person..., a_removed_person..., usernames_compare_without_ascii_case",
      "proves": "Design §1.3 table for both groups, with GitLab's lists carried in both replies; the person must be in the asked group, and usernames match ignoring ASCII case."
    },
    {
      "name": "people_change::tests: a_payload_error_is_refused..., no_payload_or_no_merge_request_fails, every_uploaded_picture...",
      "proves": "A payload error gives Refused with its first entry; a top-level error or glab's failure gives Failed; no payload or no merge request gives NO_MERGE_REQUEST; each picture is offered once per username."
    },
    {
      "name": "people_change::tests / people_search::tests the_log_names_each_outcome_by_its_kind",
      "proves": "For both reply enums, the outcome the log names equals the serialized `kind` of each variant."
    },
    {
      "name": "people_search::tests: found_people_keep_gitlabs_order..., no_project_fails..., glabs_failure_and_gitlabs_error...",
      "proves": "People stay in GitLab's order with uploaded pictures offered; a null project gives Failed(NO_PROJECT); a null list gives Found with nobody; an older GitLab's missing-field error and glab's words come back as Failed."
    },
    {
      "name": "tests/people.rs: a_search_asks_autocomplete_users..., a_search_writes_nothing, ...finding_nobody..., a_failed_search_keeps_glabs_words",
      "proves": "On the mr-people scenario: exact argv; erik (uploaded) then ben (gravatar); no stdin and no --input; an empty answer is Found with nobody; `broken` fails with \"glab: a deadline line\"."
    },
    {
      "name": "tests/people.rs: adding_an_assignee..., adding_a_reviewer..., removing..., an_append_gitlab_dropped..., ...refused..., a_top_level_error_fails, a_remove...",
      "proves": "Posts 1–8 reached through answered_posts: exact bodies, erik `requested`, two REMOVEs with nothing else asked, Free's dropped add Unchanged (RK64), Refused, Failed, an unmade remove Unchanged."
    },
    {
      "name": "tests/people.rs: each_change_writes_one_append_or_remove_of_one_username, glab_missing_or_logged_out_answers_before_any_query",
      "proves": "RK54: over eight changes, every body uses one of the two mutations, APPEND or REMOVE, with one username; no REPLACE, -X, reviewer_ids or assignee_ids; --input count = 8. Without glab or logged out, only `auth status` runs."
    },
    {
      "name": "src-tauri tests::people: a_searched_persons_uploaded_picture..., every_person_in_a_change_answer..., no_gitlab_project..., search_and_change...",
      "proves": "RK53: /erik is 404 before the search and the PNG after it; post 1 offers sam's and erik's pictures; with no project both fail with NO_PROJECT; through invoke, the JSON shapes and camelCase PeopleChange decode."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cd ../glab-yamt-playground && glab --version",
      "observed": "glab 1.126.0 ()"
    },
    {
      "command": "time glab api graphql -f query='query PeopleSearch(... queryComplexity { score limit } project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }' -f fullPath=gitlab-org/gitlab -f search=hamm",
      "observed": "{\"queryComplexity\":{\"score\":13,\"limit\":250}} logged in; 7 people (amuhammad6, imohammed-ext, kmuhammad-ext, malbustami1, mosumah, …); real 0m0.993s"
    },
    {
      "command": "same with -f search=@sam on gitlab-org/gitlab",
      "observed": "score 13 of 250, 20 people matching \"sam\" (mramasamy3, …, sam.figueroa, samdbeckham, …); real 0m0.902s. The text was searched as text, not read as a file."
    },
    {
      "command": "same on fullPath=samubr/glab-yamt-playground -f search=sam",
      "observed": "{\"data\":{\"queryComplexity\":{\"score\":13,\"limit\":250},\"project\":{\"autocompleteUsers\":[{\"username\":\"samubr\",\"name\":\"Samuel Braun\",\"avatarUrl\":\"/uploads/-/system/user/avatar/25311683/avatar.png?v=…\"}]}}}; real 0m0.881s"
    },
    {
      "command": "<hermetic prefix> cargo nextest run -p yamt-merge-requests",
      "observed": "PASS ... the_rerequest_path_writes_only_the_rereview_mutation; Summary 189 tests run: 189 passed, 1 skipped (people binary: 13 passed)"
    },
    {
      "command": "<hermetic prefix> cargo nextest run -p yamt-app merge_requests",
      "observed": "PASS people::no_gitlab_project_fails_search_and_change, a_searched_persons_uploaded_picture_is_offered_before_the_reply, every_person_in_a_change_answer_gets_their_picture_offered, search_and_change_answer_through_the_commands; Summary 27 tests run: 27 passed, 197 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 21.92s (no warnings)"
    },
    {
      "command": "cargo fmt --all --check; sh -n scripts/fake-glab/glab; just arch-check",
      "observed": "fmt: no output (FMT-OK); sh -n: no output (SH-OK); arch-check: ok"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-people.ts; diff -u frontend/src/ipc/bindings.ts target/bindings-people.ts",
      "observed": "The only additions are searchPeople(text) and changePeople(iid, change), plus the types MergeRequestPeople, PeopleAction \"add\"|\"remove\", PeopleChange {group, action, username}, PeopleChangeReply, PeopleGroup \"assignees\"|\"reviewers\" and PeopleSearchReply. The mayRerequest doc line is replaced."
    },
    {
      "command": "just map-check",
      "observed": "fails: commands search_people and change_people are not named in docs/architecture.md or .omp/skills/ipc-contract/SKILL.md. Both files are outside Owned; the lines are in deviations."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 32 mutants to test; 32 mutants tested in 2m: 13 caught, 19 unviable; mutants: no TypeScript changes since HEAD",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "query.rs's existing unit tests moved, unchanged, to the new src/query/tests.rs (the file pattern used by page/check/discussions). Without the move, query.rs would grow past RS6's 400 lines.",
    "The other 8 test files in crates/merge-requests/tests now declare `#[expect(dead_code, reason = \"these tests use part of the shared helpers\")] mod fake_glab;`. Without it, answered_posts, unused in those binaries, fails clippy -D warnings. Same pattern as crates/settings/tests.",
    "rerequest.rs NO_MERGE_REQUEST is now pub(crate) and people_change.rs reuses it instead of a second constant. REREQUEST_MUTATION's doc no longer says \"the only write of the crate\".",
    "The doc comments on search_people and change_people are shorter than the contract's pseudo-docs; the behaviour they describe is implemented as written.",
    "mr-people/pictures/7/avatar.png is a 4×4 PNG made with ImageMagick (`magick -size 4x4 xc:#2a7f62 -strip`). Pictures 1 and 2 are byte copies of mr-row-details' PNGs.",
    "DOCS KEEPER, docs/architecture.md (map-check): name async `search_people(text) -> PeopleSearchReply` and `change_people(iid, change: PeopleChange) -> PeopleChangeReply`. Both use blocking_reply and are in merge_requests/people.rs (search_reply/change_reply). No project → Failed(NO_PROJECT); else the crate fn, then state.pictures.offer before the reply (RK53).",
    "DOCS KEEPER, ipc-contract SKILL.md (map-check): the two commands with the types as in the bindings diff. picture-scheme row: the username may also come from a search_people or change_people reply.",
    "DOCS KEEPER, risk-register: RK53 owner gains merge_requests/people.rs and its two picture tests; RK54 test renamed to the_rerequest_path_writes_only_the_rereview_mutation, plus each_change_writes_one_append_or_remove_of_one_username; RK64 tests: an_append_gitlab_dropped_is_unchanged_with_gitlabs_lists, a_remove_gitlab_did_not_make_is_unchanged."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/query.rs:42-56",
      "risk": "The SetAssignees/SetReviewers mutation texts were never sent to a real GitLab (no writes allowed). If a field or alias is wrong, GitLab answers a top-level error, shown as Failed. The owner's real-GitLab check must confirm both."
    },
    {
      "location": "crates/merge-requests/src/lib.rs, src-tauri/src/merge_requests.rs",
      "risk": "Both files are now over RS6's 400 lines: lib.rs about 409 (it was already 402), merge_requests.rs about 440 (it was 413). The brief places the re-exports and commands there; splitting either file was outside this slice."
    },
    {
      "location": "scripts/fake-glab/glab:138-141",
      "risk": "The search route names the answer file from the raw text (`graphql-people-<text>`). A test searching text with `/` would look outside the scenario folder. No current test does."
    }
  ]
}
