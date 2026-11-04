# MrThreadsCrate

Agent output (`agent://MrThreadsCrate`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsCrate.md), collected 2026-11-04T14:19:42.164Z.

{
  "summary": "A discussion's turn data now holds DiscussionId, the first person note's place, `earlier` (TurnComment) and mentions read from GitLab's user links. One query reads every note (`notes(first: 200)`), and a discussion with more than 200 notes fails its row. New: read_discussion_thread (same query and Fetch seam, plus the viewer's drafts), four writes (one Glab::send each), preview_markdown, and From<NoProject> for the 3 new replies. Step 1 put DISCUSSION_BATCH at 10.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/discussions.rs",
    "crates/merge-requests/src/discussions/answer.rs",
    "crates/merge-requests/src/discussions/id.rs",
    "crates/merge-requests/src/discussions/mentions.rs",
    "crates/merge-requests/src/discussions/turn.rs",
    "crates/merge-requests/src/discussions/sample.rs",
    "crates/merge-requests/src/discussions/tests.rs",
    "crates/merge-requests/src/discussion_thread.rs",
    "crates/merge-requests/src/discussion_thread/read.rs",
    "crates/merge-requests/src/discussion_thread/drafts.rs",
    "crates/merge-requests/src/discussion_thread/write.rs",
    "crates/merge-requests/src/discussion_thread/tests.rs",
    "crates/merge-requests/src/markdown_preview.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/people.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/query/rest.rs",
    "crates/merge-requests/src/query/tests.rs",
    "crates/merge-requests/tests/discussions.rs",
    "crates/merge-requests/tests/threads.rs",
    "crates/merge-requests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "discussions::mentions::tests::only_a_user_link_with_data_user_is_a_mention",
      "proves": "RK71: group, @all, data-user+data-group/project, <code>, plain text, a bad segment, no href, no data-user or no reference type all give no mention. Order and once-each are kept. The title is the name, else the username; absolute hrefs work."
    },
    {
      "name": "discussions::tests::earlier_holds_every_person_note_before_the_last_oldest_first",
      "proves": "`earlier` holds the person notes before the last, oldest first, with their mentions. The id is read. A single-note discussion has an empty `earlier`."
    },
    {
      "name": "discussions::tests::system_notes_count_in_no_turn",
      "proves": "RK61: a system note's mentions never count, and a discussion with only system notes is left out."
    },
    {
      "name": "discussions::tests::the_place_is_the_first_person_notes",
      "proves": "The place is the first person note's position, not a system note's or the last note's."
    },
    {
      "name": "discussions::tests::a_discussion_over_200_notes_fails_its_row / an_open_discussion_with_an_id_yamt_cannot_read_fails_its_row",
      "proves": "hasNextPage on an open discussion fails its row with the sentence; a resolved one does not. An unreadable id fails an open row only."
    },
    {
      "name": "discussions::id::tests::a_discussion_id_is_40_hex_or_nothing",
      "proves": "from_gid, TryFrom and serde accept only the prefix plus 40 lowercase hex digits. The id serializes as a string."
    },
    {
      "name": "discussion_thread::tests::a_comment_is_edited_only_when_gitlab_names_an_editor_after_creation",
      "proves": "No edit when lastEditedAt equals createdAt, when the editor is null (a resolve), or when the time is null. A NoteEdit only for a later time with a person."
    },
    {
      "name": "discussion_thread::tests::a_comments_html_reaches_the_window_only_as_blocks / a_planted_handler_in_a_comment_is_left_out / a_notes_image_keeps_its_size",
      "proves": "RK60/RK66: bodyHtml reaches the window only through described_on; no markup, handler, script, iframe or button text gets through. The Height 80px size is kept."
    },
    {
      "name": "discussion_thread::tests::a_thread_answered_without_its_discussion_is_not_found / a_resolved_discussions_thread_reads_resolved / a_thread_that_cannot_be_read_…",
      "proves": "A missing discussion, or one with only system notes, is NotFound with no drafts call. A resolved thread reads. The 200-note rule, a missing merge request, and a drafts error or bad drafts JSON all give Failed."
    },
    {
      "name": "discussion_thread::tests::commenting_is_allowed_locked_or_not_allowed_as_gitlab_says",
      "proves": "The createNote×discussionLocked table and mayResolve = resolvable && resolveNote."
    },
    {
      "name": "discussion_thread::tests::drafts_of_this_discussion_show_and_every_draft_counts / paginated_drafts_are_read_page_by_page",
      "proves": "Only this discussion's drafts are shown, every draft counts toward pending, and concatenated pages and empty output are both read."
    },
    {
      "name": "discussion_thread::tests::each_write_sends_one_call_with_its_body / the_drafts_and_the_preview_are_asked_as_gitlab_documents",
      "proves": "RK54: exact argv and stdin JSON of reply, draft, resolve, unresolve and submit, with the %2F path and no reviewer_state. The draft_notes and markdown argv and body are exact."
    },
    {
      "name": "discussion_thread::tests::an_empty_reply_runs_no_glab / a_4xx_is_refused_with_gitlabs_reason / no_http_answer_or_a_5xx_fails",
      "proves": "A blank reply is Refused before glab (a non-blank one reaches it). 2xx is Sent; 4xx is Refused with the message, error, glab line or HTTP code; no answer, 3xx and 5xx are Failed."
    },
    {
      "name": "markdown_preview::tests::a_blank_preview_runs_no_glab / a_previews_html_is_described_on_the_merge_requests_page",
      "proves": "A blank preview reads empty with no glab run. The html is walked on the MR page (#note_3 resolves there), and a non-string html gives None."
    },
    {
      "name": "tests/discussions.rs a_listed_rows_turn_data_arrives_with_starter_comments_and_mentions / one_row_reloads_alone",
      "proves": "!90: d01 earlier anna, sam, dmitri and last anna; d04 [sam]; d12 none; d13 self; d10 null authors. [90] makes exactly one graphql call with iids=[\"90\"]."
    },
    {
      "name": "tests/threads.rs a_thread_comes_back_whole_with_edits_and_the_viewers_drafts (+ …image_sizes_and_name_their_pages_uploads_and_pictures)",
      "proves": "d01 has 4 comments with no system note. anna edited by herself, sam's edited by dmitri. drafts [501], pending 2, may resolve, allowed. The upload is offered; sam's image is width 60%."
    },
    {
      "name": "tests/threads.rs reading_a_thread_writes_nothing / a_preview_writes_nothing / each_write_is_one_post",
      "proves": "Reads and previews leave state 0 and log no --include call. Posts 1–5 give five Sent replies; the log names each endpoint once, in order; the read afterwards ends with \"Later\" and pending 0."
    },
    {
      "name": "tests/threads.rs a_refused_write_carries_gitlabs_reason / a_write_without_an_answer_fails / a_5xx_fails / a_locked_merge_request_may_not_be_commented",
      "proves": "403 \"403 Forbidden\" and 400 \"note is missing\" are Refused. Post 3's deadline line and post 4's 500 are Failed. !91 d14 is Locked with may_resolve false."
    },
    {
      "name": "discussion_thread::tests::the_logs_name_each_outcome_by_its_kind / the_log_names_each_write_by_its_kind",
      "proves": "The logged outcome equals the serialized kind for thread and write replies. The write kinds are comment, draft, resolve, unresolve and submit."
    }
  ],
  "smoke_evidence": [
    {
      "command": "glab api 'projects/gitlab-org%2Fgitlab/merge_requests?state=opened&order_by=updated_at&per_page=100' | jq top 20 by user_notes_count",
      "observed": "[\"264854\",\"266048\",\"260773\",\"256213\",\"261725\",\"266191\",\"244580\",\"263154\",\"266419\",\"266346\",\"266721\",\"254701\",\"267518\",\"262204\",\"265645\",\"257694\",\"267232\",\"267468\",\"255040\",\"266301\"]"
    },
    {
      "command": "time glab api graphql -f query='<new discussions query>' -f fullPath=gitlab-org/gitlab -F 'iids=[those 20]' -F first=20 (logged in as samubr, glab 1.126.0)",
      "observed": "glab: Timeout on MergeRequest.iid / Timeout on BaseNoteInterface.author (×many); data null; real 0m31.663s. Over 10 s → DISCUSSION_BATCH = 10"
    },
    {
      "command": "same query, first 10 of those iids, -F first=10",
      "observed": "{\"c\":{\"score\":64,\"limit\":250},\"errors\":0,\"mrs\":10,\"discussions\":770,\"notes\":1028,\"notesMore\":0,\"bytes\":2691509} real 0m23.539s"
    },
    {
      "command": "same query, second 10 of those iids",
      "observed": "{\"c\":{\"score\":64,\"limit\":250},\"errors\":0,\"discussions\":503,\"notes\":635,\"bytes\":1719579} real 0m12.215s"
    },
    {
      "command": "today's query (notes(last: 20), no bodyHtml) on the same first 10",
      "observed": "{\"c\":{\"score\":44,\"limit\":250},\"errors\":0,\"discussions\":770,\"bytes\":980869} real 0m19.713s"
    },
    {
      "command": "new query on samubr/glab-yamt-playground -F 'iids=[\"1\"]' -F first=1",
      "observed": "score 46/250; {\"iid\":\"1\",\"discussionLocked\":false,\"userPermissions\":{\"createNote\":true}}; discussions have resolveNote true/false; unedited notes have lastEditedAt == createdAt and lastEditedBy null; real 0m0.935s"
    },
    {
      "command": "time glab api --paginate projects/samubr%2Fglab-yamt-playground/merge_requests/1/draft_notes",
      "observed": "[] real 0m1.803s (no drafts exist; creating one would write, so the id/discussion_id/note shape comes from the docs and fixture)"
    },
    {
      "command": "printf '{\"text\":\"**x** @samubr\",\"gfm\":true,\"project\":\"samubr/glab-yamt-playground\"}' | glab api --include --method POST markdown --input -",
      "observed": "HTTP/2.0 201 Created … {\"html\":\"<p …><strong …>x</strong> <a href=\\\"https://gitlab.com/samubr\\\" title=\\\"Samuel Braun\\\" class=\\\"gfm gfm-project_member js-user-link\\\" data-user=\\\"25311683\\\" … data-reference-type=\\\"user\\\">@samubr</a></p>\"} real 0m0.679s"
    },
    {
      "command": "cargo fmt --all --check; cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "FMT_OK; Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.81s (no warnings)"
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-merge-requests -p yamt-app --no-fail-fast",
      "observed": "Summary [7.778s] 531 tests run: 530 passed, 1 failed, 37 skipped. FAIL yamt-app merge_requests::tests::discussions::read_discussions_answers_through_the_command: its child test expects the old OpenDiscussion JSON, and that test belongs to mr-threads-app (see deviations)"
    },
    {
      "command": "<hermetic_git> cargo test -p yamt-merge-requests --test threads / --test discussions",
      "observed": "threads: 10 passed; discussions: 10 passed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 139 mutants; 139 tested in 12m: 3 missed, 97 caught, 39 unviable (first run: 9 missed; 6 killed by the two log-name tests)",
    "survivors": [
      "crates/merge-requests/src/markdown_preview.rs:122 replace log_read with () — wiring: log only; no crate test captures tracing, and the kind names are pinned by tests",
      "crates/merge-requests/src/discussion_thread/read.rs:248 replace log_read with () — wiring: log only, as above",
      "crates/merge-requests/src/discussion_thread/read.rs:102 replace += with *= in through_glab — wiring: `queries` feeds only the info line's count"
    ]
  },
  "acceptance_not_run": [
    "`cargo nextest run -p yamt-app` is not green: read_discussions_answers_through_the_command fails because its ignored child (src-tauri/src/merge_requests/tests/discussions.rs:128-136) asserts the old OpenDiscussion JSON. That test belongs to mr-threads-app, which the brief says to stop at."
  ],
  "deviations_from_brief": [
    "DISCUSSION_BATCH = 10, per the step 1 rule (20 busy rows: GitLab timed out at 31.7 s). For the docs keeper: docs/architecture.md:947 and :1314 still say 20, and its 58-of-250 score is now 88/64.",
    "mr-threads-app fix at src-tauri/src/merge_requests/tests/discussions.rs:128-134: add `\"mentions\": []` to `last`; the discussion becomes json!({ \"id\": \"0000000000000000000000000000000000008101\", \"place\": {\"kind\":\"overview\"}, \"earlier\": [], \"last\": last }).",
    "Files added beyond the brief's list to keep every file ≤ 400 lines: discussions/id.rs (DiscussionId), discussions/turn.rs (open_notes, person_notes, open_discussion, note_page: the one builder of turn data), query/rest.rs (the REST argv and bodies, re-exported from query.rs), discussions/sample.rs (cfg(test) answers shared by both test modules). tree.md needs these rows.",
    "Tests sit beside the files they test (RS11): the mention test is in mentions.rs, the id test in id.rs, and the preview tests in markdown_preview.rs, not in discussions/tests.rs or discussion_thread/tests.rs.",
    "Decided: an open discussion whose gid is not 40 lowercase hex fails its row (\"GitLab sent a discussion id yamt cannot read\"). The thread answers NotFound for a discussion with no person note.",
    "Added: #[expect(clippy::large_enum_variant)] on DiscussionThreadReply and #[expect(clippy::result_large_err)] on 3 private fns (repo precedent). ReplyKind also derives Copy, UserNode derives Clone, and read_discussion_thread has #[must_use].",
    "AGENTS.md: project.rs's 3 new From<NoProject> impls are stated in the new threads paragraph, not line 1. The images note's line is applied.",
    "Step 1: the draft list was measured empty (`[]`); its id, discussion_id and note shape is from docs.gitlab.com and the fixture, because making a draft writes to GitLab."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/discussions.rs:32",
      "risk": "Even 10 of the busiest gitlab-org/gitlab MRs took 23.5 s, past glab's 20 s deadline (GLAB_TIMEOUT), so such a batch fails each row. 10 is the brief's floor; an adaptive batch is a design question for Main."
    },
    {
      "location": "crates/merge-requests/src/discussion_thread/read.rs:239",
      "risk": "Edited is decided by comparing ISO strings. That holds only while GitLab sends Time to the second in UTC (as measured); a fractional-second time would compare wrong."
    },
    {
      "location": "crates/merge-requests/src/discussions/id.rs:47",
      "risk": "The lowercase-hex check is the third copy of the same small rule (description/address.rs is_secret, links/target.rs). It is not shared because description is outside this slice."
    }
  ]
}
