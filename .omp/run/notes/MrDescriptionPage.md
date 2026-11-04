# MrDescriptionPage

Agent output (`agent://MrDescriptionPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionPage.md), collected 2026-11-04T00:57:30.011Z.

{
  "summary": "Each row now has an info column with a 'Show description' button, which opens a floating panel showing the description in the window. The panel shows loading, empty, refused and failed states, with Retry for the last two. It closes on Escape, the close button, a press outside or a second click on the same button. Links never navigate: page links (http or https) open through openPage. Images, code blocks and task boxes render, all through interpolation. Fix of #2289: ipc `toDescriptionReply` brands every linked page as WebPage, and it accepts http as well as https.",
  "files_changed": [
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/MergeRequestDescription.vue",
    "frontend/src/ui/MergeRequestDescriptionBlocks.vue",
    "frontend/src/ui/MergeRequestDescriptionInlines.vue",
    "frontend/src/ui/MergeRequestDescriptionImage.vue",
    "frontend/src/ui/MergeRequestDescriptionCode.vue",
    "frontend/src/ui/MergeRequestDescription.test.ts",
    "frontend/src/ui/mergeRequestDescriptionText.ts",
    "frontend/src/ui/mergeRequestDescriptionText.test.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/descriptionDomain.ts",
    "frontend/src/ipc/descriptionDomain.test.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestDescriptions.ts"
  ],
  "tests_added": [
    {
      "name": "MergeRequestDescription.test: every_block_and_inline_renders_its_element",
      "proves": "rule 3: on !640 every tag, class, ol start and number span is present; the 3 code blocks reach useMarkdownCode with their language and text"
    },
    {
      "name": "MergeRequestDescription.test: a details block that starts open renders open; a heading level picks its tag",
      "proves": "details `open` and heading level map to the element"
    },
    {
      "name": "MergeRequestDescription.test: text_that_looks_like_markup_renders_as_text",
      "proves": "RK66: !635's script/img/iframe text is escaped; no <script, <img or <iframe"
    },
    {
      "name": "MergeRequestDescription.test: no_description_element_has_an_href_or_an_on_attribute",
      "proves": "rule 4/RK66: rich render has no href, no on*=, no input/iframe/form/style/object"
    },
    {
      "name": "MergeRequestDescription.test: an_upload_and_another_sites_image_load_their_address_and_a_refused_one_shows_its_caption (+ caption stand-in test)",
      "proves": "rule 5: uploads use source.uploadedImage, web uses its own address, no-referrer/lazy/undraggable; refused shows caption, empty caption → address or 'picture'"
    },
    {
      "name": "MergeRequestDescription.test: a_refused_link_carries_its_address_for_the_tooltip_and_no_page",
      "proves": "rule 4: refused links are muted with tooltip = address; page links are styled as links with tooltip = page"
    },
    {
      "name": "MergeRequestDescription.test: task_boxes_are_icons_with_their_word_never_inputs; table_cells_carry_their_alignment",
      "proves": "rule 3: role=img icons labelled Done/Not done/Not applicable, no input; th/td get markdown-align-center/right"
    },
    {
      "name": "MergeRequestDescription.test: loading_empty_refused_and_failed_show_their_sentence_and_retry",
      "proves": "rule 7: each state's sentence; Retry only for refused and failed; header shows !640 and the title"
    },
    {
      "name": "mergeRequestDescriptionText.test: words + refusal sentences",
      "proves": "each word and each refusal sentence as the Contract gives it"
    },
    {
      "name": "descriptionDomain.test: every kind keeps its shape and its http/https link; a nested non-http link throws; prefix edge cases throw; refusals pass",
      "proves": "#2289: links are branded at the ipc conversion at every depth; http is kept"
    },
    {
      "name": "tauriMergeRequests.test: readDescription_calls_the_command_with_the_iid_and_converts_the_reply; readDescription_throws_on_a_linked_page_that_is_not_http",
      "proves": "the app source converts through toDescriptionReply"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck / lint / fmt:check / sfc-order / unused / test",
      "observed": "vue-tsc -b: no output; oxlint+eslint: no diagnostics; 'All matched files use the correct format. Finished in 1116ms on 790 files'; sfc-order: no output; knip: no output (clean); 'Test Files 286 passed (286) Tests 4292 passed (4292)'"
    },
    {
      "command": "just app-session start-fixture --name mdp --diff --mr list --size 1600x1000; read row spans",
      "observed": "{rows:40, infoIndex:[6] (approvals at 5), infoLefts:[1395], ciLefts:[1435], noButton:[!638,!631,!624,!617,!610,!603]}; hover → tooltip 'Show description'; fixture_page count 0; shot /tmp/mdp-column.png"
    },
    {
      "command": "click [data-description-opener=640]; read panel",
      "observed": "opened by JS click, read at once: '!640Snooze a reminderLoading…'. Then h1/h2/h3, p 12, em, strong, del, inline code, br, 3 pre, ul 2, ol[start=3], tasks [Done, Not done, Not applicable], th/td 3/6, quote, hr, closed details, 4 links. Images: screenshot 16px wide, outside picture 48px wide. Muted: 'broken screenshot', 'refused picture'. Ruby block has 13 coloured spans; mermaid has 0. Shot /tmp/mdp-640-dark.png"
    },
    {
      "command": "click '#12'; hover/click 'mail Anna'; click 'planted'",
      "observed": "log: 'mergeRequests.fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/issues/12\"}'; panel stays; location.href unchanged. mailto tooltip 'mailto:anna@example.com'. After both refused clicks: still 1 fixture_page, yamtPlanted undefined"
    },
    {
      "command": "Escape; close button; click page header; second click on same opener",
      "observed": "Escape: no dialog, activeElement opener 640, page stays. Close button: closed, focus on 640. Header 'Merge requests' press: closed. Second click: closed (aria-expanded true→false). 5 opens → 5 'fixture_description {iid: 640}' lines"
    },
    {
      "command": "open !640 then click !639's opener; scroll panel; wheel over a row outside",
      "observed": "one panel, '!639Show overdue cards in red'. Content overflows by 2517 px and scrolls to 'Paragraph 120.'. Panel 817.7 of 962 px (85%). A wheel over !634's button scrolls the list to 329 and the panel stays"
    },
    {
      "command": "open !640, click Refresh",
      "observed": "after the refresh: panel still there with the same text (discussions re-read after it); no warnings or errors"
    },
    {
      "command": "!637, !636, Retry, !635",
      "observed": "'No description.'; 'Could not read the description: glab timed outRetry' → Retry → rich (h1/table/details = 3). !635: three planted lines as text, 0 iframe/script/img, yamtPlanted undefined"
    },
    {
      "command": "keyboard: focus due date, Tab, Enter, Tab×6, Enter on #12, Space on summary, Escape",
      "observed": "Tab → opener 640; Enter opens with focus on the dialog. Tab order: Close, SUMMARY 'More', #12, the docs, mail Anna, planted. Enter on #12 logs fixture_page. Space opens details (false→true). Escape closes with focus on 640"
    },
    {
      "command": "light in both windows (Settings → Light; start-fixture has no --settings); --range-case review --mr list",
      "observed": "shots /tmp/mdp-640-light.png and /tmp/mdp-column-light.png. Review window: 34 openers; !640 has 8 of h1/table/details/pre/img; the docs link logs fixture_page https://docs.example/x; Escape returns focus to 640. Shots /tmp/mdp-review-640-dark.png and /tmp/mdp-review-640-light.png"
    },
    {
      "command": "scripts/local-conflicts-repo.sh /var/tmp/mdp-scratch/mpv; cargo tauri build --debug --no-bundle; just app-session start-app --name mdr --diff --dir … --glab mr-description",
      "observed": "!52: every element. imgs shot 32px and old 16px from yamt-picture://localhost/upload~…. Muted captions: gone, cat, evil, plain. Clicking docs and plain gives opened.log 'argv: https://docs.example/x' and 'argv: http://plain.example/'; script and file add nothing. Light run: same images, shot /tmp/mdr-52-light.png"
    },
    {
      "command": "open !50 in the app; fake glab calls.log",
      "observed": "{planted:'undefined', bad:0 (iframe/form/object/video/audio), display:'block'}. calls.log has 'api projects/7/uploads/…/shot.png', 'old.png', 'gone.png' and 'api https://gitlab.com/-/project/7/uploads/…'. grep for images.example or evil.example: no matches"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 6 TS files, 513 mutants: 495 killed, 13 survived, 5 no coverage (descriptionDomain.ts 72/72 killed)",
    "survivors": [
      "src/ui/mergeRequestDescriptionText.ts:24 exhaustive default (NoCoverage ×2) — equivalent: unreachable `never` arm",
      "The rest are not on my changed lines: fixtureMergeRequestDescriptions.ts:17-22,29,32 module consts (#732), index.ts:183,187, tauriMergeRequests.ts:22, mergeRequestDomain.ts:131"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2289 fix, granted by Main: new ipc/descriptionDomain.ts holds the description types (link page: WebPage at every depth) and toDescriptionReply. tauriMergeRequests.readDescription and the fixture's script convert through it. Its aliases moved out of mergeRequestDomain.ts; index.ts exports them from the new file. UploadKey is no longer exported from index.",
    "isLinkedPage (http or https) is a private guard in descriptionDomain.ts, not in ipc/domain.ts as Main said: domain.ts is exactly at max-lines 300. Its test is in descriptionDomain.test.ts. domain.ts and domain.test.ts are unchanged (I restored my edits to them with `git checkout --`).",
    "Table alignment uses theme.css's markdown-align-center / markdown-align-right, not text-center/right: `.markdown-table :is(th,td){text-align:left}` (unlayered) beats Tailwind's layered utilities. A start cell renders class=\"\".",
    "Refresh and the list-failure Retry carry `data-refreshes-list`, and the panel's onClickOutside ignores them too. Without this, rule 2's 'list refresh leaves the panel' and acceptance 7 cannot hold: VueUse closes on any click outside, keyboard clicks included.",
    "The panel's Escape listener runs on window in the capture phase and is skipped while a question is asked (new prop `asking` from the view). The view's own Escape listener was registered first and would otherwise leave the page.",
    "The view calls closeDescription when it unmounts, so a panel left open does not come back when the page is reopened. The view also keys the panel by iid, so a replace mounts a new panel (focus, scroll top).",
    "Words: added IMAGE_STAND_IN = \"picture\" to mergeRequestDescriptionText.ts.",
    "VU15 reasons for the new components: MergeRequestDescription has its own open/close rules and focus; Blocks and Inlines are each one recursive renderer; Image keeps its own failed state; Code owns a MarkdownView host.",
    "Docs outside Owned. ipc/AGENTS.md line 23 still says readDescription is 'passed through unchanged' and the types are 'aliases … in mergeRequestDomain.ts'. It should say: converted by `descriptionDomain.ts` `toDescriptionReply`, which brands every link page (http/https) as WebPage. project-map tree.md needs ipc/descriptionDomain.ts and the 6 new ui files.",
    "The fixture's failure line for !636 is 'glab timed out' (the state slice's TIMED_OUT), not the brief's 'a deadline line'.",
    "Scratch repo left at /var/tmp/mdp-scratch/mpv: bash-guard blocks rm -rf there."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestDescription.vue:36",
      "risk": "Escape in capture phase on window: if a filter menu, people box or job log is opened by keyboard while the panel is open, Escape closes the panel first, not that box."
    },
    {
      "location": "frontend/src/ui/MergeRequestDescription.vue:33-35",
      "risk": "Any other click outside the panel closes it, keyboard-triggered clicks included (VueUse onClickOutside treats detail-0 clicks as presses). Only the openers and the two refresh buttons are exempt."
    },
    {
      "location": "frontend/src/ui/MergeRequestDescriptionBlocks.vue:84",
      "risk": "An ordered list item with a task box shows the icon instead of its number, so that item's number does not show."
    }
  ]
}
