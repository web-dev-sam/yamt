# MrThreadsStateIpcR1

Agent output (`agent://MrThreadsStateIpcR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateIpcR1.md), collected 2026-11-04T15:29:32.705Z.

{
  "summary": "I fixed findings #2355–#2361. `takeNote(store)` is now the only code that writes note numbers. It starts at 7000 + 10 × listedRows, above every row's notes, and no number is skipped. The rendering and the comment builder moved to the new `fixtureMergeRequestRendering.ts`. `textComment` and `replied` take object parameters. `discussionId` writes the decimal serial padded to 40 digits, so d10 is …0010 in both fixtures. Comments and drafts on !636 are refused with \"403 Forbidden\".",
  "files_changed": [
    "frontend/src/ipc/fixtureMergeRequestRendering.ts",
    "frontend/src/ipc/fixtureMergeRequestTurnCases.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
    "frontend/src/ipc/fixtureMergeRequestThreads.ts",
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
    "frontend/src/ipc/fixtureMergeRequestThreads.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "fixtureMergeRequestThreads.test: a_written_note_takes_the_next_number_above_every_listed_rows_notes",
      "proves": "d01's first note is 7000+10×500. A reply gets 12027, right after !637's 27 seeded notes, with none skipped. A submit gives the next numbers, 12028 and 12029."
    },
    {
      "name": "fixtureMergeRequestThreads.test: 636_is_locked_… (extended)",
      "proves": "A comment and a draft on !636 are both refused with \"403 Forbidden\", and the thread keeps 2 comments and 0 drafts."
    },
    {
      "name": "fixtureMergeRequestDiscussions.test: the_b_cases_answer_on_637_and_636 (ids updated)",
      "proves": "d10 is …0010, and !636's ids are …0014, …0015 and …0016 (decimal dNN, as in tests/glab/mr-threads)."
    },
    {
      "name": "fixtureMergeRequestThreads.test: a_rendered_mention_is_a_page_link_to_the_person_and_strong_text_is_strong",
      "proves": "renderedText gives a mention link of kind \"page\" to https://gitlab.com/<name>, strong text, and drops blank lines. This kills Rendering.ts:24."
    },
    {
      "name": "fixtureMergeRequestThreads.test: a_text_comment_mentions_listed_people_outside_code_on_its_note_page",
      "proves": "textComment gives the author, the ISO time, the note page and the mentions. @sam and @chiara count; a mention in code, @all and an unknown name do not."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && lint && fmt:check && unused",
      "observed": "vue-tsc: no errors; oxlint + eslint: no output; oxfmt: 'All matched files use the correct format.'; knip: no findings"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  292 passed (292) / Tests  4373 passed (4373)"
    },
    {
      "command": "just app-session start-fixture --name mtr1 --diff --mr list --size 1600x1000; click 'Merge requests'; read aria-labels",
      "observed": "rows 40; labels start \"0 open discussions\",\"1 open discussion\",\"2 open discussions\",\"13 open discussions\",\"3 open discussions\""
    },
    {
      "command": "app-session hover '13 open discussions'; count li under the header",
      "observed": "{\"header\":\"12 of 13 wait for you\",\"li\":13} (shot .omp/run/shots/mtr1-637-box.png: Anna Berg 1 hour ago src/board.ts:12 'Agreed, the second one then.' …)"
    },
    {
      "command": "app-session click 'Show description' --nth 0; read img alt and size",
      "observed": "screenshot 16x16 | outside picture 48x24 | 120 px wide 48x24 | 40 % wide 48x24 | 4000 px wide 48x24 | 60 px high 48x24"
    },
    {
      "command": "console hook, then filter fixture_discussions",
      "observed": "[info] mergeRequests.fixture_discussions {iids: \"639,638,637,636,635,633,632,630,629,627,626,624,623,621\"} (then the follow-up asks for the rest)"
    },
    {
      "command": "just app-session stop --name mtr1",
      "observed": "{\"stopped\":\"mtr1\",\"session\":\"ended\",…}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 4 TS files, 601 mutants: 429 killed, 168 survived, 4 no coverage (no Rust changes)",
    "survivors": [
      "fixtureMergeRequestRendering.ts:12-16 string/regex constants (19) — gate-covered: module-level constants, never re-evaluated by the vitest runner (#732); the rendering tests check their output",
      "fixtureMergeRequestRendering.ts:49 replace(CODE_SPANS, \"\")→\"Stryker was here!\" — equivalent: differs only when a code span is glued to an @name, which no text does",
      "fixtureMergeRequestTurnCases.ts:30-120 case/draft/place/RICH_CHANGES literals — gate-covered: module-level constants (#732), unchanged this round",
      "fixtureMergeRequestThreads.ts:28-31 NOTHING_TO_SEND/FORBIDDEN/NOT_FOUND/SENT — gate-covered: module-level constants (#732)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2356: .omp/skills/project-map/tree.md needs a row for frontend/src/ipc/fixtureMergeRequestRendering.ts: 'the fixture's GitLab rendering (renderedText, inlines, mentions) and the stored-comment builder textComment'. It is outside my globs; the docs keeper should add it.",
    "The rendering tests are in fixtureMergeRequestThreads.test.ts, because the ownership hook refused a new fixtureMergeRequestRendering.test.ts (not owned). Moving them to a test file beside the module needs that file in the globs.",
    "#2355 decided: the FIRST_STORED_NOTE constant is gone. createDiscussionStore derives nextNote = FIRST_NOTE + NOTES_PER_ROW × listedRows, so it is above every listed row's notes for any row count. turnCases' Seed now takes `takeNote: () => number` instead of `firstNote`.",
    "FixtureComment, Said and personNamed moved with the renderer to fixtureMergeRequestRendering.ts, since textComment returns FixtureComment and TurnCases' `edited` needs personNamed. FixtureDiscussion stays in TurnCases.",
    "#2361 decided: replied() checks a blank, 'refuse' or 'fail' text first, then the 404, then the lock. So 'fail…' on !636 still answers failed, and a blank text still answers 'There is nothing to send.'.",
    "#2360 grep of frontend/src/ui for hard-coded fixture discussion ids (not edited): ui/mergeRequestDiscussions.test.ts:57 and ui/mergeRequests.test.ts:1578, both \"0000000000000000000000000000000000000001\" in hand-built discussions. d01 is the same in hex and decimal, so neither changes. No other padStart/toString(16) id appears in ui/."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/fixtureMergeRequestTurnCases.ts:123",
      "risk": "Row discussion ids are now decimal (iid×100+n, e.g. …063900). A later ui test that built such ids with toString(16) would no longer match. None exists today; the state-ui slice may add one in parallel."
    },
    {
      "location": "frontend/src/ipc/fixtureMergeRequestDiscussions.ts:113",
      "risk": "!637's and !636's note numbers depend on which of them is seeded first: both take numbers from the same takeNote counter. This was already true before."
    }
  ]
}
