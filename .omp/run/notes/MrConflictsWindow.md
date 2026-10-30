# MrConflictsWindow

Agent output (`agent://MrConflictsWindow`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsWindow.md), collected 2026-10-30T22:44:56.821Z.

{
  "summary": "The merge window now handles a merge that yamt started. The listing keeps `mergeRequest`. Abort asks the design's words; if git leaves something behind, a one-button \"Merge Aborted\" notice lists it, then `closeEndedMerge` runs. Commit merge hands `ReadyToPush` to the new `pushing.ts`: Push / Push Failed loop, or Keep Local / Escape closes. `leftoverText.ts` holds the five leftover sentences. The fixture now takes the `mergeRequest`, `clean`, `push=rejected` and `leftovers` parameters. Typecheck is green.",
  "files_changed": [
    "frontend/src/ipc/ChunkSource.ts",
    "frontend/src/ipc/tauri.ts",
    "frontend/src/ipc/tauri.test.ts",
    "frontend/src/ipc/fixture.ts",
    "frontend/src/ipc/fixtureOperations.ts",
    "frontend/src/ipc/fixtureOperations.test.ts",
    "frontend/src/ui/listing.ts",
    "frontend/src/ui/listing.test.ts",
    "frontend/src/ui/aborting.ts",
    "frontend/src/ui/aborting.test.ts",
    "frontend/src/ui/continuing.ts",
    "frontend/src/ui/continuing.test.ts",
    "frontend/src/ui/pushing.ts",
    "frontend/src/ui/pushing.test.ts",
    "frontend/src/ui/leftoverText.ts",
    "frontend/src/ui/leftoverText.test.ts",
    "frontend/src/ui/question.ts",
    "frontend/src/ui/question.test.ts",
    "frontend/src/ui/questionText.ts",
    "frontend/src/ui/questionText.test.ts",
    "frontend/src/ui/QuestionDialog.vue",
    "frontend/src/ui/operationText.ts",
    "frontend/src/ui/store.ts",
    "frontend/src/ui/store.test.ts",
    "frontend/src/ui/diskChanges.test.ts",
    "frontend/src/ui/saving.test.ts",
    "frontend/src/ui/stops.test.ts"
  ],
  "tests_added": [
    {
      "name": "leftoverText.test.ts: %j reads as the one sentence for it",
      "proves": "Each of the five kinds has its exact sentence, with both a branch target (develop) and a commit target (commit 9b0d4e1)."
    },
    {
      "name": "questionText.test.ts: aborting a merge yamt started names the place it returns to / the abort note says what happens to the branch",
      "proves": "Abort wording for each BranchBefore × each return place (branch, commit, null) matches design §4.5."
    },
    {
      "name": "questionText.test.ts: push / a failed push asks again with git's words / what an abort left is a notice with one Close button",
      "proves": "The exact push, pushFailed and abortLeftovers texts; leftovers has cancel null; none of the three ends with the stop."
    },
    {
      "name": "questionText.test.ts: servers question (list kind `lines`)",
      "proves": "The renamed `lines` list kind is used for the servers list."
    },
    {
      "name": "pushing.test.ts: Push pushes once; Escape and Keep Local never push; a failure asks again with git's words; Pushed ends the app; Keep Local closes once",
      "proves": "RK45: only the confirm answer pushes. A failure loops through pushFailed. Pushed leaves git running. Keep Local or Escape calls closeEndedMerge once."
    },
    {
      "name": "pushing.test.ts: refused push / dropped stop / refused close",
      "proves": "An IPC failure shows the continue problem, then takes the Keep Local path. A dropped stop does nothing. A failed close reports the problem and re-enables the window."
    },
    {
      "name": "aborting.test.ts: leftovers show the notice; Close/Escape closes the ended merge once",
      "proves": "Leftovers lead to the abortLeftovers notice, then one closeEndedMerge whatever the answer. No leftovers ends the window as before. A close failure is the abort problem."
    },
    {
      "name": "continuing.test.ts: ReadyToPush hands the branch to the push offer once, lists nothing and does not end the window",
      "proves": "ReadyToPush offers a push without listing again, and the window is not ended. A ReadyToPush after its stop was dropped offers nothing."
    },
    {
      "name": "fixtureOperations.test.ts: ?mergeRequest=%s lists…; ?clean; ReadyToPush then Pushed; ?push=rejected; closeEndedMerge; ?leftovers",
      "proves": "Each mergeRequest value lists its view. clean lists no file. The rejected push comes first, then Pushed. leftovers answers the two leftovers. Every command after the end answers MergeFinished or MergeAborted."
    },
    {
      "name": "tauri.test.ts: abortOperation / pushMergedBranch / closeEndedMerge / continueOperation ReadyToPush / listStop mergeRequest",
      "proves": "The commands' replies and failures pass through unchanged, and `merge_request` is mapped."
    },
    {
      "name": "store.test.ts: a recorded merge's Abort … / a recorded merge's Continue asks to push without listing again",
      "proves": "Through the store: the abort question carries mergeRequest, then notice and close. Continue leads to the push question, then pushMergedBranch, with no listStop after the continue."
    },
    {
      "name": "listing.test.ts: a list sets … the merge request from the one reply",
      "proves": "listing.ts is the only place mergeRequest is written, from every listing."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend fmt:check; pnpm -C frontend sfc-order",
      "observed": "vue-tsc -b: no errors. lint exit 0 (oxlint + eslint). fmt:check: \"All matched files use the correct format.\" sfc-order: no output, exit 0."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  239 passed (239)\n      Tests  3305 passed (3305)"
    },
    {
      "command": "just app-session start-fixture --name w; read \"location.assign('/?operation=merge&mergeRequest=created')\"; Abort merge shown via the toolbar menu; click Abort merge; read dialog innerText",
      "observed": "\"Abort Merge\\n\\nAbort the merge of main into feature/due-dates and return to develop?\\n\\nyamt deletes feature/due-dates, which it created for this merge.\\n\\nAbort Merge\\nCancel\". Shot: /var/tmp/mrcw/abort-question.png"
    },
    {
      "command": "read \"location.assign('/?operation=merge&mergeRequest=created&leftovers')\"; click Abort merge; click Abort Merge; read dialog",
      "observed": "\"Merge Aborted\\n\\nThe merge of main into feature/due-dates is aborted, but yamt did not put everything back:\\n\\nHEAD moved after the merge started, so yamt did not check out develop again.\\nfeature/due-dates changed after the merge started, so yamt left it as it is.\\nClose | buttons=1\". Shot: /var/tmp/mrcw/abort-leftovers.png"
    },
    {
      "command": "read \"location.assign('/?operation=merge&mergeRequest=created&clean&push=rejected')\"; click Commit merge; read dialog; click Push; read dialog",
      "observed": "\"Push to GitLab\\n\\nPush feature/due-dates to GitLab?\\n\\nThe merge is committed on feature/due-dates. Keep Local leaves it there; you can push it later.\\n\\nPush\\nKeep Local\", then \"Push Failed\\n\\ngit did not push feature/due-dates: [rejected] (fetch first)\\n\\nThe merge commit stays on your feature/due-dates.\\n\\nPush Again\\nKeep Local\". Shots: push-question.png, push-failed.png (in /var/tmp/mrcw)"
    },
    {
      "command": "click Keep Local; read dialog and buttons",
      "observed": "\"false | … Commit merge(off) ; Abort merge(off) ; Settings\": no question; ended state (git running, both operation buttons disabled). Shot: /var/tmp/mrcw/kept-local.png. Session stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 1236 killed, 2 timeout, 158 survived, 29 no-cov (86.88%); aborting/pushing/listing 100%. Most survivors are on lines this slice did not change.",
    "survivors": [
      "fixtureOperations.ts:43-59 literal mutants on MERGE_REQUEST_STARTS, LEFTOVERS, DEVELOP, REJECTED_PUSH — equivalent: module-level constants with --ignoreStatic (#732); the tests check every value",
      "leftoverText.ts:9,28 exhaustive never default (NoCoverage) — equivalent: unreachable",
      "operationText.ts:258 exhaustive never default in mergeRequestAbortNote — equivalent: unreachable",
      "question.ts:70, questionText.ts:259 exhaustive never defaults — equivalent: unreachable"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Main approved a split into new owned ui/questionText.ts (+ test). It holds the QuestionText/QuestionList types, questionText() and its builders, moved verbatim. question.ts keeps Question, finishMustAsk, exitMustAsk and endsWithStop. Reason: question.ts reached 330 lines (max 300), and the texts could not move elsewhere without an import cycle.",
    "Question `abortLeftovers` also carries `mergeRequest: MergeView`, because the notice names the target and the branch. If an Abort answers leftovers while the listing had no merge request (should not happen), no notice is shown but closeEndedMerge still runs.",
    "PushReply kinds are lowercase in the generated bindings, so endsApp is `reply.kind === \"pushed\"`.",
    "Push runs after Continue's gitRun finishes, not inside its landing; otherwise the outer run would reset `running`. continued() returns the branch. createContinuing(target, pushing) takes a second parameter; store.ts wires it as createContinuing(state, createPushing(state)).",
    "closeEndedMerge (after leftovers and after Keep Local) runs through gitRun with endsApp: () => true, so the window stays ended. A push or close IPC failure reuses the existing abort or continue problem.",
    "operationText.ts gained mergeRequestAbortMessage / mergeRequestAbortNote. leftoverText.ts also exports returnPlaceText, shared with the abort question.",
    "Fixture choices the brief left open: moved, unchanged and created return to develop; detached has branchBefore created; same has unchanged. The stop's operation is Merge main→feature/due-dates. mergeRequest applies only to operation=merge.",
    "Sentence for ui/AGENTS.md: \"`question.ts` is what is asked; `questionText.ts` is its words (`cancel: null` draws one button). Abort of a merge yamt started (`mergeRequest`, written only by `listing.ts`) asks by returnTo/branchBefore, then shows the one-button notice if git left anything (`leftoverText.ts`), then `closeEndedMerge`.\"",
    "Sentence for ui/AGENTS.md: \"`pushing.ts` offers the push after Continue answers ReadyToPush: only Push pushes (RK45), a failure asks pushFailed again, Keep Local or Escape closes once.\"",
    "Sentence for ipc/AGENTS.md: \"Fixture mode's operation also takes ?mergeRequest=created|moved|unchanged|detached|same (Continue answers ReadyToPush), ?clean (no file listed), ?push=rejected (the first push fails) and ?leftovers (Abort leaves two).\"",
    "map-check: tree.md needs rows for ui/pushing.ts, ui/leftoverText.ts and ui/questionText.ts. map-check now fails only on the app's commands and the ChunkSource methods; that is the docs keeper's job."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/continuing.ts:149-152",
      "risk": "Between Continue's reply and the push question, gitRun.running is false. While the modal question shows, Commit merge and Abort look enabled behind it. The modal blocks pointer input; a second ask is dismissed."
    },
    {
      "location": "frontend/src/ui/aborting.ts:61-64",
      "risk": "Leftovers with no listed mergeRequest skip the notice and only close. Believed unreachable, because the app derives both from the same record [INFERENCE]."
    },
    {
      "location": "frontend/src/ui/pushing.ts:22-26",
      "risk": "A push or close IPC failure reuses the `continue` problem, which reads \"Could not commit the merge: …\" even though the commit itself succeeded."
    }
  ]
}
