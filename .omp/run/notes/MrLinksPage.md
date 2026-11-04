# MrLinksPage

Agent output (`agent://MrLinksPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksPage.md), collected 2026-11-04T02:20:11.808Z.

{
  "summary": "Each merge-request row now has a links column between the info column and the CI box. A row with a description shows a Lucide `link` button there. It opens a hover box built like the discussions box. The box shows Loading, the empty sentence, a failure sentence with Retry, or the non-empty groups Epics, Issues and Commits. A line opens its page and the box stays open. An issue shown with a parent also gets a parent button with a tooltip. All the box's words and lines come from `mergeRequestLinkLines.ts` `linkBox`.",
  "files_changed": [
    "frontend/src/ui/mergeRequestLinkLines.ts",
    "frontend/src/ui/mergeRequestLinkLines.test.ts",
    "frontend/src/ui/MergeRequestLinks.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "mergeRequestLinkLines.test.ts groups_come_epics_issues_commits_and_an_empty_group_is_left_out",
      "proves": "Groups come in the order Epics, Issues, Commits with their headings and fixture !640's references in order. An empty group is left out (no issues; only commits; only epics)."
    },
    {
      "name": "mergeRequestLinkLines.test.ts a_line_keeps_its_reference_title_and_closed",
      "proves": "Each line keeps its title, closed flag and page. Commits are shown with closed false. The words of all ten lines are right."
    },
    {
      "name": "mergeRequestLinkLines.test.ts a_thing_gitlab_did_not_show_says_not_found_or_no_access_and_keeps_its_page",
      "proves": "design&2, secret/vault#9 and secret/vault@0badc0de are notShown, keep their pages and have no parent."
    },
    {
      "name": "mergeRequestLinkLines.test.ts only_an_issue_with_a_parent_gets_the_parent_button_with_its_tooltip",
      "proves": "Only #12 and #13 get a parent, with the right page and tooltip ('Open parent: &3 Board redesign'). An issue GitLab did not show has no parent."
    },
    {
      "name": "mergeRequestLinkLines.test.ts loading_empty_refused_and_failed_have_their_sentence_and_only_failures_retry",
      "proves": "undefined and loading show Loading…; an empty read shows the empty sentence; the 3 refusals and a thrown call show their sentence with failed true; nothing else is failed."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck / lint / fmt:check / unused / sfc-order / test",
      "observed": "vue-tsc -b: no diagnostics. lint exit 0. 'All matched files use the correct format.' knip: no findings (the Linked* types are now imported). sfc-order exit 0. 'Test Files 289 passed (289)  Tests 4322 passed (4322)'."
    },
    {
      "command": "start-fixture --name mlp --diff --mr list --size 1600x1000; rects of each row's w-7 columns (WebDriver)",
      "observed": "!640/!639/!637/!636/!634: info x=1355, links x=1395, CI x=1435. !638: '1355:- | 1395:- | 1435:Pipeline running', so no links button and its CI box stays in line. Before any hover the log has 0 fixture_links lines."
    },
    {
      "command": "hover !640 with a MutationObserver on the box; move the pointer into the box; leave; hover again",
      "observed": "Box texts in order: ['Loading…', 'Epics…']. The log has exactly one 'fixture_links {iid: 640}'. With the pointer on the #12 line the box is still open (1). After leaving, 0 boxes. After hovering again, still one fixture_links for 640."
    },
    {
      "command": "read the box innerText of !640",
      "observed": "Epics: &3 Board redesign; &4 Old board Closed; design&2 Not found or no access. Issues: #12, #13, other/lib#5 Fix date parsing Closed, secret/vault#9 Not found or no access. Commits: fa3335f3, a1b2c3d4…e5f6a7b8, secret/vault@0badc0de Not found or no access. Parent buttons appear only on #12 and #13."
    },
    {
      "command": "click the #12 line, both parent buttons, then the opener",
      "observed": "fixture_page …/taskboard/taskboard/-/work_items/12, then …/groups/taskboard/-/work_items/3, then …/-/work_items/12. The box stayed open. Clicking the opener logged no fixture_page for the row."
    },
    {
      "command": "!639, !636 (+Retry), !634 (close and hover again)",
      "observed": "!639: 'No linked epics, issues or commits.' !636: 'Could not read the links: glab timed out' with Retry; Retry shows Loading…, then the groups. !634: 'glab is not logged in: gitlab.example: No token found (…). — run glab auth login in a terminal, then Retry.' Closing and hovering again logs a second fixture_links {iid: 634}."
    },
    {
      "command": "Refresh, then hover !640, which was already read",
      "observed": "Box texts in order: ['Loading…', 'Epics…']; the log has a new 'fixture_links {iid: 640}'."
    },
    {
      "command": "keyboard: focus !640's description opener, then Tab ×1, Tab ×5, Shift+Tab, Enter, Escape",
      "observed": "After one Tab, focus is on the links opener and 1 box is open. After 5 more Tabs, focus is on 'Open parent: &3 Board redesign' (&3, &4, design&2, #12, parent). Shift+Tab then Enter on '#12' logs fixture_page …/work_items/12. Escape leaves 0 boxes, with focus back on the opener."
    },
    {
      "command": "shots, compare window: /tmp/mlp-640-dark.png, /tmp/mlp-636-fail-dark.png, /tmp/mlp-640-light.png (Settings → Light)",
      "observed": "The box has the discussions box's look in dark and light, with the group icons, mono references and muted Closed / Not found. The parent tooltip shows in light. The row columns are aligned."
    },
    {
      "command": "start-fixture --name mlq --range-case review --mr list, dark then Light",
      "observed": "Columns are the same as in the compare window (!638: none). Hovering !640 logs one fixture_links and shows the same groups; its parent click logs …/groups/taskboard/-/work_items/3. In light: !636 shows the timed-out sentence with Retry and !639 the empty sentence. Shots: /tmp/mlq-640-dark.png, /tmp/mlq-636-light.png, /tmp/mlq-640-light.png."
    },
    {
      "command": "real app (local-conflicts-repo.sh; cargo tauri build --debug --no-bundle; start-app --glab mr-links): hover !62, click #12's parent and the secret/vault#9 line",
      "observed": "!62: Epics &3, &4 Closed, design&2. Issues #12 [Open parent: &3 Board redesign], #13 [Open parent: #12 …], other/lib#5 Closed, web#6, secret/vault#9 Not found, #99 Not found. Commits fa3335f3, 6ea97d8c, a1b2c3d4…e5f6a7b8, secret/vault@0badc0de Not found. opened.log: argv: https://gitlab.example/groups/taskboard/-/work_items/3 / argv: https://gitlab.example/secret/vault/-/issues/9"
    },
    {
      "command": "real app: !59, !61, !60, !57, then grep the fake glab calls.log",
      "observed": "!59: &8 Not found, #20 Free issue (no parent button), #21 [Open parent: #20 Free issue]. !61: empty sentence. !60: 'Could not read the links: glab: a deadline line' with Retry. !57: no button. calls.log: one MergeRequestLinks argv each for !62 (line 7) and !59 (line 11), one for !60 (line 18), none for !61 or !58, no stdin lines."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: no Rust changes; Stryker on mergeRequestLinkLines.ts: 96 mutants, 92 killed, 0 survived, 4 no coverage, score 95.83% (covered 100%)",
    "survivors": [
      "frontend/src/ui/mergeRequestLinkLines.ts:113 and :138: the exhaustive `default: { const _exhaustive: never }` arms emptied (4 NoCoverage) — gate-covered: unreachable, vue-tsc rejects any unhandled kind"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "VU15 sixth component: MergeRequestLinks.vue has its own hover rules and its own lazy load, as MergeRequestDiscussions.vue does.",
    "Retry first moves focus to the box (`box.focus()`), then asks again. The Retry button is removed while it holds focus, and the HTML focus fixup sends no focusout. Without this, useHoverBox thought focus was still inside, and the box stayed open and covered the rows below (seen on !636). The comment cites the spec.",
    "Smoke 7 in the fixture reads 'Could not read the links: glab timed out' (TIMED_OUT), per the state-slice fact. The real app's !60 reads 'glab: a deadline line'.",
    "Light theme was set through Settings → Light, because start-fixture has no --settings flag. The cargo build followed the worktree recipe (frontend build --mode tauri first, then an empty beforeBuildCommand).",
    "MergeRequestsView.vue was not touched. The hover box's Escape calls preventDefault, so the description panel (which only acts on an Escape that was not prevented) does not close too.",
    "For the docs keeper: the AGENTS.md description paragraph still says the info column sits 'between the approvals and the CI box'; the links column now sits between the info column and the CI box (my paragraph says so). tree.md needs `ui/MergeRequestLinks.vue` and `ui/mergeRequestLinkLines.ts`. All links types are imported only through `../ipc`, so the planned move to linksDomain.ts merges cleanly."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestLinks.vue (line button)",
      "risk": "A line button's accessible name has no space between reference and title (WebDriver names it '#12Snooze a reminder'): the flex spans add no whitespace. Screen readers read the two run together. A fix would be an aria-label or a separator text node."
    },
    {
      "location": "frontend/src/ui/mergeRequestLinkLines.ts:94-115",
      "risk": "linksFailedText repeats descriptionRefusalText's glab sentences except the failed prefix. The Contract fixes both, so I kept them separate. A reviewer may ask for one shared helper."
    },
    {
      "location": "frontend/src/ui/MergeRequestLinks.vue (useHoverBox focus rule)",
      "risk": "After a mouse click on a line or Retry, focus stays in the box, so it stays open when the pointer leaves until an outside click, Escape or Tab. This is the discussions box's existing rule, but a tall box can cover the rows below."
    }
  ]
}
