# MrLinksPageR1

Agent output (`agent://MrLinksPageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksPageR1.md), collected 2026-11-04T02:32:07.212Z.

{
  "summary": "I fixed all four findings. One part of the step-3 smoke (a pointer leave closing the box) is not observed: a click on Retry gives Retry focus, and focus holds the box open (the hover boxes' existing rule). Link and discussion lines now have spaced accessible names: '#12 Snooze a reminder', '&4 Old board Closed'. `glab.ts` has `glabRetryText`, used by the links and description texts. `useHoverBox` has `keepFocus()`, used by the links Retry and the people box. The doc lines are fixed in both AGENTS.md files and in the MergeRequestSource comment Main asked for.",
  "files_changed": [
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/ui/MergeRequestLinks.vue",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/glab.ts",
    "frontend/src/ui/mergeRequestDescriptionText.ts",
    "frontend/src/ui/mergeRequestLinkLines.ts",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ipc/MergeRequestSource.ts"
  ],
  "tests_added": [
    {
      "name": "useHoverBox.test.ts keepFocus moves focus in the box to the box, so the box still closes once focus leaves after the control went",
      "proves": "The focused item is removed after keepFocus. Focus is now on the box, the pointer leaving keeps the box open, and a focusout to the outside closes it. The box can still be closed."
    },
    {
      "name": "useHoverBox.test.ts keepFocus leaves focus outside the box where it is, the opener included",
      "proves": "keepFocus moves focus only from inside the box. Focus outside the area and focus on the opener are both left alone."
    },
    {
      "name": "useHoverBox.test.ts keepFocus without a box leaves focus where it is",
      "proves": "With no box (null), keepFocus does nothing and does not throw."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order; test",
      "observed": "vue-tsc -b clean; oxlint --type-aware and eslint --max-warnings 0 clean; 'All matched files use the correct format.'; knip and check-sfc-order clean; 'Test Files 290 passed (290) Tests 4325 passed (4325)'"
    },
    {
      "command": "just app-session start-fixture --name mlr1 --diff --mr list --size 1600x1000; click 'Merge requests'; hover 'Linked epics, issues and commits' --nth 0 (!640); textContent of the line buttons",
      "observed": "[\"&3 Board redesign\",\"&4 Old board Closed\",\"design&2 Not found or no access\",\"#12 Snooze a reminder\",\"#13 Write the snooze test\",\"other/lib#5 Fix date parsing Closed\",\"secret/vault#9 Not found or no access\",\"fa3335f3 Backfill due dates\",…]. Screenshot /tmp/mlr1-640.png: spacing unchanged (gap)."
    },
    {
      "command": "WebDriver GET /session/<id>/element/<line button>/computedlabel (WebKit) on !640's link lines",
      "observed": "\"&3 Board redesign\", \"&4 Old board Closed\", \"design&2 Not found or no access\", \"#12 Snooze a reminder\", \"#13 Write the snooze test\""
    },
    {
      "command": "hover '2 open discussions' --nth 0; computedlabel of the discussion line buttons",
      "observed": "\"Chiara Rossi 5 days ago Your turn src/board/column.ts Done, see the new commit.\" and \"Dmitri Volkov 5 days ago Your turn Overview A single line that runs on, …\""
    },
    {
      "command": "hover links --nth 3 (!636); click Retry; read activeElement; hover Refresh (pointer leaves); read box count; click the search field",
      "observed": "Status 'Could not read the links: glab timed out'. After Retry, activeElement is DIV tabindex=-1 (the box). After the pointer leaves: 1 box with 10 lines; the box stays open because focus is inside. After clicking the search field: 0 boxes, focus on INPUT."
    },
    {
      "command": "hover !640 people opener; click 'More for Sam Weller'; click 'Remove assignee'; wait 2s; read; press Escape",
      "observed": "Before the reply, focus is on 'More for Sam Weller'. After the reply: 1 box, activeElement DIV tabindex=-1, box buttons ['Add assignee','Add reviewer']. Escape: 0 boxes."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 222 mutants; 213 killed, 1 survived, 8 no coverage (95.95%); glab.ts 11/0/2, mergeRequestDescriptionText.ts 7/0/2, mergeRequestLinkLines.ts 89/0/4, useHoverBox.ts 106/1/0",
    "survivors": [
      "frontend/src/ui/useHoverBox.ts:128 shallowRef({x:0,y:0}) → shallowRef({}) — equivalent: line unchanged (moved by the import edit); show() writes `at` before open turns true, so the start value is never read",
      "glab.ts, mergeRequestDescriptionText.ts, mergeRequestLinkLines.ts default `never` arms (8 NoCoverage) — gate-covered: no input reaches them, vue-tsc proves the switch exhaustive"
    ]
  },
  "acceptance_not_run": [
    "'!636 Retry then pointer leave closes the box': not observed. The Retry click gives Retry focus, keepFocus moves it to the box, and focus holds the box (existing useHoverBox rule). Observed: 1 box after the pointer left, 0 after an outside click."
  ],
  "deviations_from_brief": [
    "keepFocus() moves focus only when it is inside the box (`box?.contains(document.activeElement)`). The old Links code focused the box unconditionally, which could hold the box open when focus had never been in it. People drops its own `box.contains` check because keepFocus now does it.",
    "MergeRequestDiscussions.vue: space text nodes also go between the flex row and the place and excerpt blocks, not only between name, age and turn, so the whole line reads with spaces. oxfmt chose the line breaks.",
    "ui/AGENTS.md: added one paragraph after the links paragraph describing keepFocus and the `{{ \" \" }}` line-name convention. The links paragraph now names keepFocus and glabRetryText.",
    "At Main's request (outside the brief): ipc/AGENTS.md:25 now reads 'plan §2 rows 176–178'; ipc/MergeRequestSource.ts:58 comment now reads 'rows 176–177'.",
    "Not unified: mergeRequestLogText.ts (… ${PRESS_AGAIN}) and mergeRequestsText.ts (… then Refresh.) use the same glab sentence pattern with different endings. They are outside Owned and outside #2321's two Retry callers."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useHoverBox.ts:56-62 (focusEntered/focusLeft)",
      "risk": "A mouse click inside any hover box (Retry, a line) gives the button focus in WebKitGTK, so the box stays open when the pointer leaves until an outside click, Tab or Escape. keepFocus keeps this rule. If the owner wants pointer leave to close the box, the hold rule must change."
    },
    {
      "location": "frontend/src/ui/MergeRequestDiscussions.vue:154-165",
      "risk": "oxfmt puts a literal space next to `{{ \" \" }}`, so textContent has double spaces ('Chiara Rossi  5 days ago'). The WebKit computed label collapses them to single spaces; it looks only cosmetic."
    }
  ]
}
