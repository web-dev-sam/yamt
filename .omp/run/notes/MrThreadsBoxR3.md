# MrThreadsBoxR3

Agent output (`agent://MrThreadsBoxR3`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR3.md), collected 2026-11-04T20:02:08.879Z.

{
  "summary": "The thread panel's window Escape now does nothing while a question is open or a description is open. `asking` goes View → Row → Discussions → Thread, the same way the description gets it. While `useMergeRequests().description` is not null, the description's own listener takes the Escape and the panel's next Escape closes it. The description's guard is written inline in its handler, not a function I could share, so the panel has its own inline guard.",
  "files_changed": [
    "frontend/src/ui/MergeRequestThread.vue",
    "frontend/src/ui/MergeRequestDiscussions.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/MergeRequestDiscussionsBox.test.ts",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend sfc-order && typecheck && lint && fmt:check && unused && test",
      "observed": "sfc-order exit 0; vue-tsc -b no output; oxlint + eslint exit 0; 'All matched files use the correct format' (821 files); knip no findings; Test Files 299 passed (299), Tests 4476 passed (4476)"
    },
    {
      "command": "start-fixture --name mtr3 --diff --mr list --open-mr --size 1600x1000, dataset.theme='dark'; hover '13 open discussions', hover box row 1, Shift; Tab ×9 (webdriver) to !637 'Show description'",
      "observed": "{act:'BUTTON Show description', op:'637', dlg:['Thread: Overview']}"
    },
    {
      "command": "(a) Enter; Escape; Escape",
      "observed": "After Enter: dlg ['Thread: Overview','!637Move the card menu…'], focus in the description. Escape → {act:'BUTTON Show description', op:'637', dlg:['Thread: Overview'], exp:['13 open discussions']}: the description closed and the panel stayed. Escape again → {act:'BUTTON ABAnna Berg 3 hours', dlg:[], exp:['13 open discussions'], mr:true}: the panel closed"
    },
    {
      "command": "(b) typed 'kept text' into Compare 1, back to the page, showed the panel, raised closeTab with a script click on 'Close Compare 1' (no pointerdown); Escape; Escape",
      "observed": "Question: {modal:['true Close TabClose Compare 1? Its text is lost.YesNo'], act:'BUTTON Yes', dlg:['Thread: Overview']}. Escape → {modal:[], tabs:['Close Compare 1'], dlg:['Thread: Overview'], act:BODY}: the question was dismissed, the tab and panel stayed. Escape → the panel closed, focus on its row"
    },
    {
      "command": "step 10, after a send: Shift on the row, click textarea, type 'Labelled now.', click 'Add comment', Escape",
      "observed": "After the send: act TEXTAREA, 3 articles, the last ends with 'just nowLabelled now.'. Escape → {act:'BUTTON SWSam Weller just n', dlg:[], exp:['13 open discussions'], mr:true}"
    },
    {
      "command": "step 10, Retry: Shift on d13 (box row 12), click Retry, Escape",
      "observed": "alert 'Could not read the thread: glab timed outRetry'. After Retry: alert null, 1 article, act 'DIV Thread: Overview'. Escape → {act:'BUTTON CRChiara Rossi 13 h', dlg:[], exp:['13 open discussions'], mr:true}"
    },
    {
      "command": "step 10, Refresh: Shift on box row 0, click [data-refreshes-list], Escape, Escape",
      "observed": "After Refresh: {act:'BUTTON Refresh', dlg:['Thread: src/board.ts:12']}. Escape → {act:'BUTTON ABAnna Berg 1 hour', dlg:[], exp:['13 open discussions'], mr:true}. Escape → {act:'BUTTON 13 open discussions', dlg:0, exp:[], mr:true}"
    },
    {
      "command": "just app-session stop --name mtr3",
      "observed": "stopped: webdriver and vite; folder removed"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD', 'mutants: no TypeScript changes since HEAD' (only .vue files and two test props changed; .vue is not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [
    "No unit test covers the new guard. It lives in a .vue window listener, and SSR tests cannot send keys. The WebKit runs above show it works."
  ],
  "deviations_from_brief": [
    "In (b), the question came from a script `click()` on Compare 1's tab ×. The × is `invisible` until the pointer is over the tab, so the keyboard cannot reach it, and a real pointer click lands outside the box. The fixture cannot send a window-close request, so keepAiChanges cannot be raised there either.",
    "MergeRequestRow.vue and MergeRequestDiscussions.vue each get a new `asking: boolean` prop; the two SSR tests now pass `asking: false`.",
    "For the docs keeper: in verify step 10 and the ui/AGENTS.md panel paragraph, add that the panel's window Escape does nothing while a question is open (`asking`) or a description is open: that Escape is theirs, and the next one closes the panel."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestThread.vue:107-116",
      "risk": "In (b), when the question closes, focus lands on BODY instead of the panel, though the panel's Escape still works from there. This is the dialog's focus restore and is outside this round's scope."
    }
  ]
}
