# MrThreadsStateIpc

Agent output (`agent://MrThreadsStateIpc`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpc.md), collected 2026-11-04T15:11:17.785Z.

{
  "summary": "The IPC layer now carries discussion threads: five new MergeRequestSource methods with their Tauri calls, and a new discussionDomain.ts (DiscussionId brand, earlier/mentions, thread/write/preview replies and converters). toDescription(raw, field) is shared by descriptions, comments and previews; image size passes through. The fixture keeps one discussion store per source: !637/!636 hold the B cases, d01 is the rich thread, writes and previews answer as scripted and show in the next read. !640 gets four sized images.",
  "files_changed": [
    "frontend/src/ipc/domain.ts",
    "frontend/src/ipc/discussionDomain.ts",
    "frontend/src/ipc/discussionDomain.test.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/descriptionDomain.ts",
    "frontend/src/ipc/descriptionDomain.test.ts",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestDescriptions.ts",
    "frontend/src/ipc/fixtureMergeRequestDescriptions.test.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
    "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
    "frontend/src/ipc/fixtureMergeRequestThreads.ts",
    "frontend/src/ipc/fixtureMergeRequestThreads.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestDiscussions.test.ts",
    "frontend/src/ui/MergeRequestDescription.test.ts"
  ],
  "tests_added": [
    {
      "name": "discussionDomain.test: toRowDiscussions_brands_ids_and_keeps_earlier_and_mentions",
      "proves": "Every discussion id is branded, and earlier authors are converted to domain Persons with mentions kept as sent."
    },
    {
      "name": "discussionDomain.test: a_discussion_id_not_40_hex_throws (8 cases)",
      "proves": "Empty, short, long, uppercase, non-hex, gid:// and padded ids throw with their field path."
    },
    {
      "name": "discussionDomain.test: toDiscussionThreadReply_converts_times_people_pages_and_bodies (+ bad-field table, thread id, refusals)",
      "proves": "edited.at is in ms, edited.by is a domain Person, a body link page is branded; a bad time, page or body link throws naming thread.comments[i]."
    },
    {
      "name": "descriptionDomain.test: an_images_size_passes_as_sent, a_comment_body_names_its_field_when_a_link_is_not_http",
      "proves": "ImageSize passes through unchanged; toDescription prefixes its field to link.page errors."
    },
    {
      "name": "tauriMergeRequests.test: each_thread_method_calls_its_command_with_its_arguments (+ failures, bad page/id)",
      "proves": "Each of the five commands gets its exact arguments; replies are converted and IPC failures come back unchanged."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test: the_b_cases_answer_on_637_and_636, the_b_cases_are_two_days_old_…",
      "proves": "For every case: authors in order, last and earlier mentions, ids d01–d16, places, and last comments 1–13 hours old."
    },
    {
      "name": "fixtureMergeRequestThreads.test: a_comment_shows_in_the_next_read_and_the_rows_discussions",
      "proves": "A reply becomes the thread's and the row's `last` (sam, now), and its body is rendered."
    },
    {
      "name": "fixtureMergeRequestThreads.test: a_draft_counts_pending_and_submit_publishes_every_draft",
      "proves": "A draft raises pending to 3; submit publishes d01, d03 and d05's drafts as sam's comments and empties pending."
    },
    {
      "name": "fixtureMergeRequestThreads.test: a_resolved_discussion_leaves_the_next_discussions_read",
      "proves": "Resolve drops d01 from readDiscussions (12 left) and the thread reads resolved; unresolve brings it back."
    },
    {
      "name": "fixtureMergeRequestThreads.test: refuse_and_fail_texts_answer_as_scripted, a_blank_preview_has_no_blocks, a_preview_is_a_paragraph_per_line…",
      "proves": "Blank, refuse and fail give their scripted replies for comments and drafts, and the store is unchanged; previews render as scripted."
    },
    {
      "name": "fixtureMergeRequestThreads.test: the_fixture_logs_no_text, reads_answer_after_400_ms, d01_is_the_rich_thread, comments_are_an_hour_apart, 636_is_locked",
      "proves": "Log lines and pauses match the brief; d01's bodies, sizes and edits; note pages unique and increasing; !636 locked with mayResolve false and resolve 403; notFound/404; one store per source."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && pnpm -C frontend lint && pnpm -C frontend fmt:check && pnpm -C frontend unused",
      "observed": "vue-tsc: no errors; oxlint + eslint: no errors; oxfmt: 'All matched files use the correct format.'; knip: no findings"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  292 passed (292) / Tests  4370 passed (4370)"
    },
    {
      "command": "just app-session start-fixture --name mtipc --diff --mr list --size 1600x1000; click 'Merge requests'; hover '13 open discussions'",
      "observed": "The list renders 40 rows. !637's count reads 13 (aria-labels include '13 open discussions' and '3 open discussions'). Its box lists 13 entries (li count 13) under the header '12 of 13 wait for you' (shot .omp/run/shots/mtipc-637-box.png)."
    },
    {
      "command": "app-session click 'Show description' --nth 0 (!640); read img alts and sizes",
      "observed": "'screenshot 16x16 | outside picture 48x24 | 120 px wide 48x24 | 40 % wide 48x24 | 4000 px wide 48x24 | 60 px high 48x24': the new images render with today's sizing (shot .omp/run/shots/mtipc-640-description.png)."
    },
    {
      "command": "app-session read (console.info hook) then click Refresh; filter fixture_discussions",
      "observed": "[info] mergeRequests.fixture_discussions {iids: \"639,638,637,636,635,633,632,630,629,627,626,624,623,621,620,618,617,615,614,612,611,609,608,606,605,603,602\"} (then the follow-up asks for the rest)"
    },
    {
      "command": "just app-session stop --name mtipc",
      "observed": "{\"stopped\":\"mtipc\",\"session\":\"ended\",…}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 13 TS files, 1840 mutants: 1493 killed, 338 survived, 11 no coverage (no Rust changes)",
    "survivors": [
      "fixtureMergeRequestTurnCases.ts:41-123 case/draft/place/RICH_CHANGES literals — gate-covered: module-level constants the vitest runner never re-evaluates (#732); the_b_cases… and d01_… assert them",
      "fixtureMergeRequestTurnCases.ts:23-39 HEX/serial/size constants — gate-covered: module-level constants (#732)",
      "fixtureMergeRequestData.ts:17-25 THREADS_IID/OPEN_DISCUSSIONS — gate-covered: module-level constants (#732); asserted by fixtureMergeRequests.test row counts",
      "fixtureMergeRequestThreads.ts:31-34 NOTHING_TO_SEND/FORBIDDEN/NOT_FOUND/SENT — gate-covered: module-level constants (#732); refuse_and_fail… asserts each word",
      "fixtureMergeRequestDescriptions.ts:28-31 NARROW_PX…LOW_PX — gate-covered: module-level constants (#732); the_rich_description… asserts the sizes",
      "fixtureMergeRequestDiscussions.ts:50-52 SHORT_TEXTS — gate-covered: module-level constants (#732)",
      "fixtureMergeRequestThreads.ts:49 `?? []`→`?? [\"Stryker was here\"]` — equivalent: a string has no matching .id, so the answer is notFound either way",
      "fixtureMergeRequestDiscussions.ts:136-137 empty-comments throw — equivalent: no stored discussion is ever empty (NoCoverage)",
      "fixtureMergeRequestTurnCases.ts:183-184 unknown-person throw — equivalent: the fixture only names people in PEOPLE (NoCoverage)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Split approved by Main: the discussion types, toRowDiscussions, toDiscussionThreadReply and toMarkdownPreviewReply live in a new ipc/discussionDomain.ts (+ test), not mergeRequestDomain.ts, which would pass max-lines 300. mergeRequestDomain now exports toPerson, toTime and UploadedPicture for it. Later briefs should point at discussionDomain.ts.",
    "Split approved by Main: a new ipc/fixtureMergeRequestTurnCases.ts holds the !637/!636 B cases, d01's rich comments and the text renderer and comment builder. The DiscussionStore lives in fixtureMergeRequestDiscussions.ts so imports stay acyclic; threadsScript(log, store) takes it as the brief says.",
    "DiscussionId is written `string & { readonly __brand: \"DiscussionId\" }`, the repo's brand form (domain.ts has no Brand<> helper).",
    "index.ts re-exports only the thread types that already have an importer: DiscussionsAnswer, OpenDiscussion, RowDiscussions and isDiscussionId. Re-exporting the rest now would turn `pnpm unused` (knip, TS16) red. mr-threads-state-ui adds each one when it first imports it.",
    "Decided: a write to an unknown iid or discussion answers refused \"404 Not Found\", because DiscussionWriteReply has no notFound. A blank text is refused before that check, as in Rust.",
    "Decided: a fixture comment's mentions are the @usernames of PEOPLE in its text, outside code spans, so @all and @group mention nobody. Comment and preview @-links point to https://gitlab.com/<name>, as the brief gives for the preview.",
    "Main widened my globs: ui/MergeRequestDescription.test.ts (7 images; size: null) and ui/mergeRequestDiscussions.test.ts (637 now asked; log counts 5 and 2; DISCUSSION id/earlier/mentions). ui/mergeRequests.test.ts `lastBy` also gained these fields, beyond the five source members.",
    "Needed outside my globs (docs keeper): `just map-check` fails on the five MergeRequestSource methods missing from docs/architecture.md. .omp/skills/project-map/tree.md needs rows for discussionDomain.ts, fixtureMergeRequestThreads.ts and fixtureMergeRequestTurnCases.ts."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/fixtureMergeRequestThreads.ts:89-107",
      "risk": "!636 is `locked`, but the fixture still accepts comments and drafts there; only resolve is refused (403), as the brief lists. GitLab would refuse the comment too. The UI should never offer it."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestDiscussions.ts:120-123",
      "risk": "B-case times are relative to the store's creation (Date.now() when the source is made), so 'last 1–13 hours ago' drifts as the window stays open; other rows keep fixed 2026-10 dates."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts the_review_orders_the_smoke_expects",
      "risk": "The review orders pass unchanged under today's turn rule. When mr-threads-box changes the core rule, !637/!636's B cases will change those orders and this test will need new expectations."
    }
  ]
}
