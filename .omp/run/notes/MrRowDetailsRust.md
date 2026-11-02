# MrRowDetailsRust

Agent output (`agent://MrRowDetailsRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsRust.md), collected 2026-11-02T20:33:07.325Z.

{
  "summary": "Rows now carry author, reviewers with a four-state review fold (`approved` first), approvers (replacing `approvals`), coloured labels, `mayRerequest`, and a zero size for an empty diff with `diffRefs`. New: `picture.rs` (address checks, image sniffing, `fetch_picture`), `rerequest.rs` (fresh reviewers, then the Rereview mutation, the only write) and `ListedPage`. Shell: the `yamt-picture` scheme (offered only, one fetch per address, at most 4 at once), `rerequest_review` and the CSP. Fake glab and scenario updated.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/people.rs",
    "crates/merge-requests/src/labels.rs",
    "crates/merge-requests/src/picture.rs",
    "crates/merge-requests/src/picture/tests.rs",
    "crates/merge-requests/src/rerequest.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/web_page.rs",
    "crates/merge-requests/AGENTS.md",
    "crates/merge-requests/tests/fake_glab/mod.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/rerequest.rs",
    "crates/merge-requests/tests/picture.rs",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/pictures.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/picture_scheme.rs",
    "src-tauri/src/merge_requests/tests/rerequest.rs",
    "src-tauri/src/merge_requests/tests/csp.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/tauri.conf.json",
    "scripts/fake-glab/glab",
    "scripts/gitlab-playground.sh",
    "tests/glab/README.md",
    "tests/glab/mr-row-details/** (project.json, graphql-page-1.json, graphql-merge-request-52.json, graphql-merge-request-50.json, post-1.json/.status, post-2.json/.status, pictures/…/1,2/avatar.png, crowd/**)"
  ],
  "tests_added": [
    {
      "name": "page/tests.rs: an_empty_diff_with_diff_refs_is_a_zero_size, no_files_and_no_diff_refs_is_no_size, files_count_whatever_diff_refs_says",
      "proves": "The size rule: `[]` with `diffRefs` gives 0/0/0, without `diffRefs` gives None, and files always count whatever `diffRefs` says."
    },
    {
      "name": "page/tests.rs: review_states_fold_into_four_and_an_unknown_one_is_requested, approved_true_reads_approved_whatever_the_review_state",
      "proves": "Every GitLab state, null and missing fold correctly; an unknown state is Requested and collected once; `approved: true` wins over any state."
    },
    {
      "name": "page/tests.rs: approvers_reach_the_row_by_name…, a_label_colour_that_is_not_hex_is_no_colour, a_null_author_is_none, the_update_permission_is_may_rerequest",
      "proves": "Approvers arrive as people and no `approvals` key remains. Only `#rgb`/`#rrggbb` pairs become colours. A null author is None. A missing permission is false."
    },
    {
      "name": "page/tests.rs: each_person_s_uploaded_picture_is_offered_and_a_gravatar_or_none_is_not",
      "proves": "Only uploaded avatars are offered (in the order named); Gravatar and custom hosts never are; the pictures serialize as uploaded, gravatar or none."
    },
    {
      "name": "picture/tests.rs: only_an_uploaded_avatar_on_the_projects_origin_is_an_uploaded_address, an_uploaded_avatar_keeps_the_port_of_a_project_on_one",
      "proves": "Accepted: a path, the same https origin, a sub-path, a query. Refused: http, another host, a look-alike host, a port, `//host`, `..`, other paths, `%`, odd queries, no origin."
    },
    {
      "name": "picture/tests.rs: only_gravatars_avatar_path_on_its_two_hosts_is_a_gravatar_address",
      "proves": "Accepted: both hosts, MD5 and SHA-256 hashes, upper case, a `%` query. Refused: http, gravatar.com without a subdomain, look-alike hosts, a port, other paths, wrong lengths, Libravatar, quote/`#`/space in the query."
    },
    {
      "name": "picture/tests.rs: a_picture_that_is_not_png_jpeg_gif_or_webp_is_refused, a_picture_over_one_mib_is_refused, each_kind_names_its_media_type",
      "proves": "Sniffing by first bytes (HTML, SVG, truncated headers, RIFF WAVE refused); exactly 1 MiB passes and 1 MiB + 1 is refused; each kind's mime."
    },
    {
      "name": "list.rs: a_page_offers_one_picture_per_username_the_last_one_named, each_unknown_review_state_is_new_once_per_load",
      "proves": "Pictures are deduplicated by username with the last one winning; an unknown state is warned of once per load."
    },
    {
      "name": "query.rs: the_list_query_asks_people_with_pictures…, the_reviewers_query_…_argv_is_exact, the_rerequest_body_names_the_rereview_mutation…",
      "proves": "The exact new fields, the exact reviewers argv, and the exact JSON body (the id is a variable)."
    },
    {
      "name": "tests/list.rs: the_details_scenario_brings_author_pictures_approvers_states_and_label_colours, a_gravatar_person_is_never_fetched_through_glab",
      "proves": "Whole rows compared as JSON; offered pictures are anna and sam only; no glab argv names gravatar after the list or after fetching every offered picture."
    },
    {
      "name": "tests/rerequest.rs: the six acceptance tests + glab_missing_or_logged_out_answers_before_any_query",
      "proves": "Exact body with `gid://gitlab/User/4`; no `stdin:` line for NotReviewer, an awaited reviewer or NotOpen; the only bodies are the Rereview mutation; `Refused { \"Reviewer not found\" }`."
    },
    {
      "name": "tests/picture.rs: a_listed_picture_is_fetched_through_glab_byte_for_byte",
      "proves": "Listed PNGs (which contain NUL bytes) come back byte for byte through `fetch_picture` and the fake's `cat` route."
    },
    {
      "name": "src-tauri picture_scheme: only_an_offered_username_gets_a_picture, a_picture_is_fetched_once_per_run, at_most_four_pictures_are_fetched_at_once",
      "proves": "200 with mime and nosniff only for offered names, 404 otherwise. One glab run per address across asks and lists (failures too). Exactly 4 fetches overlap at most in the log."
    },
    {
      "name": "src-tauri: rerequest_review_answers_through_the_command (child rerequest_review_replies_on_paths_glab), the_csp_admits_the_scheme_and_gravatars_two_hosts_only",
      "proves": "The command replies requested, notReviewer, notOpen, and failed without a project. `img-src` is exactly the contracted list in both `csp` and `devCsp`."
    }
  ],
  "smoke_evidence": [
    {
      "command": "step 1: cd ../glab-yamt-playground && glab api graphql -f query='<new list query>' -f fullPath=samubr/glab-yamt-playground -F first=100 | jq …",
      "observed": "queryComplexity {score:170,limit:250}. !4 DRAFT_STATUS conflicts:false diffRefs{baseSha:1732ffd…} diffStats:1 pipeline:null updateMergeRequest:true. !3 MERGEABLE, 1 file. !2 MERGEABLE, 1 file. !1 CONFLICT conflicts:true, 2 files. avatarUrl \"/uploads/-/system/user/avatar/25311683/avatar.png?v=1793647454\". Reviewers {approved:false, reviewState:UNREVIEWED} on !3 and REVIEWED on !1. No approvers, no labels."
    },
    {
      "command": "step 1: the same query without the new fields",
      "observed": "score 136/250; statuses unchanged: !4 DRAFT_STATUS, !3 MERGEABLE, !2 MERGEABLE, !1 CONFLICT (conflicts true). The new fields do not disturb detailedMergeStatus."
    },
    {
      "command": "step 1: glab api 'https://gitlab.com/uploads/-/system/user/avatar/25311683/avatar.png?v=1793647454' | od -An -tx1 -N8; … | wc -c",
      "observed": "89 50 4e 47 0d 0a 1a 0a ; 43090 bytes (a PNG, raw)"
    },
    {
      "command": "step 1: glab api graphql -f query='{ a: user(username: \"test\") { avatarUrl } … }'",
      "observed": "\"https://secure.gravatar.com/avatar/f660ab912ec121d1b1e928a0bb4bc61b15f5ad44d5efdc4e1c92a25e99b8e44a?s=80&d=identicon\": gitlab.com answers secure.gravatar.com with a 64-digit SHA-256. The playground has no empty merge request, so its node is absent; the owner's check runs the extended playground script."
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [2.129s] 117 tests run: 117 passed, 1 skipped"
    },
    {
      "command": "(hermetic) cargo nextest run -p yamt-app merge_requests",
      "observed": "Summary [6.101s] 14 tests run: 14 passed, 177 skipped"
    },
    {
      "command": "(hermetic) cargo nextest run --workspace",
      "observed": "Summary [12.126s] 1230 tests run: 1230 passed, 30 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings; cargo fmt --all --check; just arch-check",
      "observed": "Finished `dev` profile …; FMT-OK; arch-check: ok"
    },
    {
      "command": "is_username mutant (&& → ||) applied by hand, then cargo nextest run -p yamt-app picture_scheme; reverted",
      "observed": "FAIL a_picture_is_fetched_once_per_run (picture_scheme.rs:105). After the revert: 3 passed."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 158 tested in 20m, 4 missed, 90 caught, 59 unviable, 5 timeouts (caught). Both is_username misses killed later by the plus+one test (by hand).",
    "survivors": [
      "src-tauri/src/merge_requests/pictures.rs:60 replace answer_picture with () — wiring: the async scheme handler around picture_answer; tauri's UriSchemeResponder cannot be built in tests, and picture_answer is fully tested",
      "crates/merge-requests/src/people.rs:174 replace warn_unknown_review_state with () — wiring: one tracing::warn! line; no subscriber in tests. Which states it warns of is pinned by each_unknown_review_state_is_new_once_per_load"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Type placement: Person, PersonPicture, ReviewState, Reviewer in people.rs; Label, LabelColors in labels.rs; RerequestReply in rerequest.rs; ListedPage, OfferedPicture in list.rs. All are re-exported from lib.rs with unchanged signatures, so lib.rs stays ≤ 400 lines (RS6).",
    "Gate: the 4-fetch limit is `PictureShelf.running` under the shelf's Mutex plus `MergeRequestState.picture_turns: Condvar`, not a separate Mutex<usize>. The shelf also tracks in-flight fetches, so concurrent asks for one picture run one glab.",
    "The text-file picture (avatar/3) and the six slow pictures live in a nested scenario `tests/glab/mr-row-details/crowd/`. The main scenario must offer anna and sam only. crowd also has a `plus+one` user to pin the username rule.",
    "The fake glab's picture route also honours `<file>.sleep` and logs `answered: <address>` before answering, so the overlap is measurable. Documented in tests/glab/README.md.",
    "UserNode.name is `#[serde(default)]`: older recorded scenarios name approvers by username only.",
    "Re-request glab failure with empty stderr returns the crate's own sentence GLAB_FAILED, because gitio's `exit_words` is private. Suggest exposing a `Glab::run`-with-stdin → Result<Vec<u8>, String> in gitio.",
    "a_gravatar_person_is_never_fetched_through_glab covers the list plus fetching every offered picture. Asking the scheme for ben (404, no gravatar in the log) is asserted in src-tauri `only_an_offered_username_gets_a_picture`.",
    "rerequest_review_replies_on_paths_glab sits in src-tauri/src/merge_requests/tests/rerequest.rs, run by rerequest_review_answers_through_the_command via through_glab::run_with_fakes, so tests.rs stays ≤ 400. run_with_fakes and the crate's Fake now set YAMT_FAKE_GLAB_STATE.",
    "web_page.rs: `is_path_segment` extracted and made pub(crate) with `is_web_path` and `is_number`; picture.rs reuses that segment rule.",
    "Docs keeper: architecture §2 (people, labels, picture, rerequest) and §3 (scheme, CSP); IPC command `rerequest_review` (map-check fails until named); plan #151–#153; tree.md rows for new files; state.md MergeRequestState.pictures (writers: pictures::offer, picture_answer); RK53/RK54 test names; src-tauri/AGENTS.md.",
    "The orchestrator must run `just bindings`: MergeRequestRow, Person, PersonPicture, Reviewer, ReviewState, Label, LabelColors, GravatarAddress, RerequestReply, commands.rerequestReview."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/rerequest.rs rereviewed / query.rs GRAPHQL_BODY_ARGS",
      "risk": "The real `glab api graphql --input -` write was never run against GitLab (writes forbidden). The body shape and glab's content type for --input are [INFERENCE] from the design's reading of glab's source."
    },
    {
      "location": "scripts/gitlab-playground.sh open_merge_request feature/empty",
      "risk": "[INFERENCE] GitLab may refuse `glab mr create` for a branch equal to main's tip (no changes). The owner's run will tell."
    },
    {
      "location": "src-tauri/src/merge_requests/pictures.rs answer_picture / turn",
      "risk": "Each scheme request takes a blocking-pool thread, and waiters park on the Condvar while 4 fetch. Hundreds of img elements asking at once could hold many pool threads for a few seconds."
    },
    {
      "location": "crates/merge-requests/src/picture.rs fetch_picture",
      "risk": "glab.get reads the whole body before the 1 MiB check, so a huge answer is held in memory once before it is refused."
    },
    {
      "location": "crates/merge-requests/src/picture.rs avatar_source",
      "risk": "A GitLab on a port gets addresses with `:port`. Whether glab then picks the right host and token is [INFERENCE]; if not, those people show initials."
    }
  ]
}
