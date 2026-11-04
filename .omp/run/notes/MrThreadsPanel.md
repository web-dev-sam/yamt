# MrThreadsPanel

Agent output (`agent://MrThreadsPanel`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanel.md), collected 2026-11-04T15:54:55.273Z.

{
  "summary": "The thread panel is built and tested but not yet mounted (mr-threads-box mounts it). `MergeRequestThread.vue` shows the header, every comment in GitLab's rendering, pending drafts, the loading/refused/failed states with Retry, and Escape closing it. `MergeRequestThreadComment.vue` draws one comment's header. `MergeRequestReplyField.vue` holds Write/Preview, the growing textarea, Ctrl+Enter and the buttons row with its failure sentence. Words live in `mergeRequestThreadText.ts`. `imageStyle` now sizes description and comment images.",
  "files_changed": [
    "frontend/src/ui/mergeRequestImageSize.ts",
    "frontend/src/ui/mergeRequestImageSize.test.ts",
    "frontend/src/ui/MergeRequestDescriptionImage.vue",
    "frontend/src/ui/MergeRequestDescriptionInlines.vue",
    "frontend/src/ui/mergeRequestThreadText.ts",
    "frontend/src/ui/mergeRequestThreadText.test.ts",
    "frontend/src/ui/MergeRequestThreadComment.vue",
    "frontend/src/ui/MergeRequestReplyField.vue",
    "frontend/src/ui/MergeRequestThread.vue",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestImageSize.test.ts: the six named tests (width, percent width, height alone, both, percent height, wider than the column) + no size",
      "proves": "A1/A2: imageStyle for every ImageSize form, before and after load, % capped at 100, % height ignored, 0×0 natural size treated as unknown"
    },
    {
      "name": "mergeRequestThreadText.test.ts (7 tests incl. 5 per write kind)",
      "proves": "Every fixed word; pendingText/submitTip singular and plural; editedText with and without \"by\"; commentingReason; thread, write and preview failure sentences for each refusal and the ipc cause"
    },
    {
      "name": "MergeRequestThreadPanel.test.ts: the_comment_header_shows_picture_name_username_crown_and_ago",
      "proves": "C3 over !637 d01: picture, name, @username, ago with date tooltip; crown only on dmitri's comment; \"· Edited … by Dmitri Volkov\" on sam's, no \"by\" on anna's"
    },
    {
      "name": "a_comment_renders_gitlabs_blocks",
      "proves": "C4: table, code (useMarkdown), link button, both-size image style 160/80 and 50% width; no <script>, href or on* attribute"
    },
    {
      "name": "the_drafts_show_pending_at_the_end, submit_review_shows_the_pending_count_and_its_tip",
      "proves": "The draft is last with \"Pending\", plain pre-wrap text and no picture; \"Submit review\" shows \"2 pending\" with its tip, and is absent with no drafts"
    },
    {
      "name": "the_field_has_its_placeholder_and_no_toolbar, preview_shows_loading_then_blocks_and_nothing_for_empty",
      "proves": "C6/C7: placeholder, kept text, button order, dialog label; Preview goes Loading… → blocks; the textarea stays mounted and hidden; Write brings back the same text; blank → Nothing to preview.; failure sentence"
    },
    {
      "name": "the_buttons_row_has_…_resolve_at_the_right, a_failed_send_says_why_under_the_row, resolved_reads_resolved_and_unresolve",
      "proves": "C8/C10: order, disabled while empty or sending, !636 locked and may-not-resolve reasons as tooltips; refused/failed draft, comment and resolve sentences; check + Resolved, Unresolve thread"
    },
    {
      "name": "loading_failure_and_not_found_read_one_sentence_with_retry, a_refreshing_thread_keeps_its_comments_and_another_requests_thread_renders_nothing",
      "proves": "C5 panel side: loading without Retry; notFound, glab, failed and ipc sentences with Retry; a refresh keeps the comments (aria-busy) with buttons disabled; a thread of another iid renders nothing"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b (no errors)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (no findings)"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format. Finished … on 819 files"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "$ knip --include exports,types (no findings)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  297 passed (297) / Tests  4447 passed (4447)"
    },
    {
      "command": "just app-session start-fixture --name mtpanel --diff --mr list --size 1600x1000 --open-mr; click \"Show description\" --nth 0; read <img rects in the dialog>",
      "observed": "120 px wide: style width:120px → 120×60 (col 990); 40 % wide: 396×198 = 40% of 990; 4000 px wide: 990×495 (column width, 2:1 kept); 60 px high: style after load height:auto;width:120px → 120×60, not squashed"
    },
    {
      "command": "just app-session shot --name mtpanel /tmp/mtpanel-sizes-dark.png",
      "observed": "Dark theme: the 4000 px image fills the column, the 120 px and 60 px-high images are 120×60, the 40 % one is 396 wide"
    },
    {
      "command": "same session restarted, read 'document.documentElement.dataset.theme = \"light\"', reopen, read, shot /tmp/mtpanel-sizes-light.png",
      "observed": "theme light, dialog bg rgb(247, 248, 249); same sizes [120×60, 396×198, 990×495, 120×60] of col 990; shot shows the light panel"
    },
    {
      "command": "just app-session stop --name mtpanel",
      "observed": "{\"stopped\":\"mtpanel\",\"session\":\"ended\",…}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — 2 TS files, 125 mutants: 119 killed, 0 survived, 6 no coverage, 0 errors (.vue not mutated)",
    "survivors": [
      "mergeRequestImageSize.ts:56 default never branch (NoCoverage ×2) — equivalent: unreachable by type (TS3 exhaustive default)",
      "mergeRequestThreadText.ts:80 glabWords default never branch (NoCoverage ×2) — equivalent: unreachable by type",
      "mergeRequestThreadText.ts:104 threadRefusalText default never branch (NoCoverage ×2) — equivalent: unreachable by type"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The SSR test file is `ui/MergeRequestThreadPanel.test.ts`, not `MergeRequestThread.test.ts`, approved by Main. The brief's name differs from state-ui's `mergeRequestThread.test.ts` only in case, and vue-tsc stops with TS1149.",
    "threadRefusalText, writeFailureText and previewFailureText take an added `platform` argument. They build their sentences through problemText at the matching step (refusal reasons as an Unexpected cause, as aiText.ts does), so the \"Could not …\" words have one source.",
    "Light-theme smoke: start-fixture has no `--settings` option (only start-app has). I set `document.documentElement.dataset.theme = \"light\"` through `read` on the fixture page instead. Added `--open-mr` to open the page.",
    "ImageSize, DiscussionComment, NoteEdit and Commenting are not re-exported from ipc/index.ts. I derive them from DescriptionInline/DiscussionThread locally (TS6). A docs/ipc owner may add the re-exports.",
    "The buttons row and its failure sentence live in MergeRequestReplyField.vue, so Ctrl+Enter and the Add buttons share one disabled rule. Resolve is also disabled while the thread is refreshing, as the state ignores writes then. Every disabled state comes from Thread.sending, load and the text only; no words name a send's kind.",
    "A preview `read` with zero blocks shows \"Nothing to preview.\" (decided).",
    "VU15 reasons. MergeRequestThread.vue is the side panel itself. MergeRequestThreadComment.vue is one comment's header and body, repeated per comment. MergeRequestReplyField.vue is the field, Write/Preview and the buttons row: a self-contained input with its own DOM measuring.",
    "Docs keeper: tree.md rows for ui/MergeRequestThread.vue, ui/MergeRequestThreadComment.vue, ui/MergeRequestReplyField.vue, ui/mergeRequestThreadText.ts, ui/mergeRequestImageSize.ts and the test rename; ui/AGENTS.md (mr-threads-box's) should name imageStyle on MergeRequestDescriptionImage."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue fit()",
      "risk": "The 3–12 line height is measured from computed lineHeight (leading-5), padding and border. It is not exercised in WebKit until mr-threads-box mounts the panel (its WebKit step \"C6 Field\")."
    },
    {
      "location": "frontend/src/ui/MergeRequestThread.vue keyPressed / onMounted",
      "risk": "Escape-before-box relies on useHoverBox skipping defaultPrevented events, and focus-on-mount on the root. Both are unproven in the window until mr-threads-box mounts the panel."
    },
    {
      "location": "frontend/src/ui/MergeRequestReplyField.vue add/resolve spans",
      "risk": "Disabled buttons use pointer-events-none so their wrapping span gets the reason tooltip. \"Open on GitLab\" disabled has no tooltip."
    }
  ]
}
