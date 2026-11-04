# MrFastPreviewPanelCorrectness

Agent output (`agent://MrFastPreviewPanelCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelCorrectness.md), collected 2026-11-04T22:29:45.491Z.

{
  "verdict": "fail",
  "checked": [
    "Local read, no Loading: thread.ts:203-207 sets previewHere's read synchronously, no call; a_plain_preview_is_read_at_once (seen=[writing,read]) and the panel test fail if previewHere is deleted. Log is {iid,blocks} only.",
    "Late answers: guard `preview === loading` (:212) drops held @anna answer after Write→plain→Preview; test uses toBe(local), fails without the guard. Blank still empty with no call.",
    "Write keeps text and caret: preview never writes replyTexts; ReplyField.vue:184 v-show keeps the textarea mounted. Failure words untouched; failure tests still on GitLab's path ('fail here #1', ASKED).",
    "Ordering: held-ask test sees loads=1 until resolved (un-awaited ask fails it); show() first/stale never asks; failed ask logs and lists. Submit reload never asks; refreshDiscussions does ask then read.",
    "IPC: tauri toResult + WorkerStopped row; fixture logs fixture_ask_again {}. Rust forget_project takes the mutex logged_in_project holds across glab auth status + api (project.rs:72-92); GLAB_TIMEOUT 20 s.",
    "Accepted deviations: mergeRequestsRefresh.ts (tree.md row to docs keeper), reload test edits, merged blank/local branch, projectCalls, 'row NNN' wording; ui→editor import per brief (as useMarkdown.ts). No test run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestsRefresh.ts",
      "line": 26,
      "severity": "block",
      "rule_id": "R-ux-feedback",
      "problem": "refresh() awaits askGitLabAgain before loadList sets listing=loading; forget_project waits on the mutex held across an in-flight glab lookup (up to 2×GLAB_TIMEOUT=40 s while GitLab fails, when Retry is pressed), so Refresh/Retry stays enabled, unspun, failure banner up, and each extra press queues an ask; ~25 tests gained `await settled()`, hiding it.",
      "fix": "Move the ask inside loadList's loading window (e.g. loadList(state, askAgain)): set listing=loading synchronously, then await the ask, then listMergeRequests; revert the added settles; held-ask test asserts loading while held."
    },
    {
      "file": "frontend/src/ui/mergeRequestsRefresh.ts",
      "line": 30,
      "severity": "block",
      "rule_id": "R-ux-feedback",
      "problem": "refreshDiscussions calls reloadDiscussions only after the ask settles, so the icon does not spin and the failed sentence stays while any glab lookup holds the lock (up to 40 s when GitLab fails, the case the button is for); no running guard, so repeat presses queue asks; the test pins this via `reloads.size toBe(0)`.",
      "fix": "Let reloads' owner (mergeRequestDiscussions.ts reload) mark the row running/LOADING at the press, then sentFirst after the ask (e.g. reloadDiscussions(iid, before?)); test: running while ask held, read only after (grant that file)."
    },
    {
      "file": ".omp/run/mutants/MrFastPreviewPanel.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The 25 kept survivors are listed as line ranges with no mutation and no (a)/(b)/(c) reason; 'on unchanged lines' is not a VF7 reason. Two are a guard and a boundary (mergeRequestThread.ts:85 patch's isShown, mergeRequests.ts:140 the stale check this slice's show-never-asks test drives). Left as-is, gaps in rules later slices rely on go unrecorded.",
      "fix": "List each survivor as `file:line mutation` with (a)/(b)/(c), or kill it; hand guard/boundary survivors on unchanged lines to the orchestrator as findings for the owning slice."
    }
  ]
}
