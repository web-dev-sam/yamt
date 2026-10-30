# MrConflictsWindowCorrectness

Agent output (`agent://MrConflictsWindowCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsWindowCorrectness.md), collected 2026-10-30T22:50:24.766Z.

{
  "verdict": "pass",
  "checked": [
    "RK45: pushing.ts:52 loops only while ask()==='yes'; Keep Local, Escape and an already-waiting question all lead to one closeEndedMerge; pushing.test.ts 'Escape and Keep Local never push' fails if the loop tests !=='no'",
    "Rule 7 / design §4.5 abort words: mergeRequestAbortMessage/Note and leftoverText match the design text exactly (questionText.test.ts:191-221, leftoverText.test.ts); seen in WebKit in abort-question.png and abort-leftovers.png",
    "Leftovers → notice → one closeEndedMerge, for Close and for Escape (aborting.test.ts:239-263, store.test.ts:2984); no leftovers ends the window without a close; Rust close_ended_merge closes Aborted via has_ended (commands.rs:221)",
    "Rule 6: ReadyToPush → push offer, no second listStop (store.test.ts:3019); Failed asks pushFailed with git's words; Pushed keeps running true; Continue on Committed answers MergeFinished (merge.rs:96)",
    "Risk 2 accepted: list_stop errors when the record cannot be read (merge.rs:122), so null mergeRequest at list time means no record then; the no-notice-but-close path is tested (aborting.test.ts:285)",
    "Survivors: the never-default ones are (a) unreachable, which is correct; the fixture constants are asserted by fixtureOperations.test.ts:203-300. Ran no tests: no finding is a block"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/pushing.ts",
      "line": 22,
      "severity": "should",
      "rule_id": "risk-3",
      "problem": "A failed push or close IPC call is reported as {action:'continue'}: 'Could not commit the merge: yamt's worker stopped; try again.' after the commit succeeded. pushing.test.ts:155 pins it and the log files it as a continue failure; aborting.ts:61 says 'Could not abort' too. The close destroys the window, so it is mainly seen in logs. Growth: a push problem has no name of its own.",
      "fix": "Add a 'push' Problem action ('Could not push <branch>: …') in problem.ts/problemText.ts (orchestrator widens Owned) and make pushing.test.ts:155 assert those words."
    },
    {
      "file": "frontend/src/ui/continuing.ts",
      "line": 116,
      "severity": "should",
      "rule_id": "risk-1",
      "problem": "Once a merge is committed, Commit merge (primary) and Abort merge show as enabled behind the push and pushFailed questions (push-failed.png). They are inert under showModal, but continuing.test.ts:340 pins continueState 'ready' for a committed merge. Growth: any later reader of continueState or abortState gets a wrong state.",
      "fix": "Amend the brief: every ok reply after ReadyToPush ends the window, so use endsApp:()=>true for ReadyToPush, for the push run and for an abort with leftovers (running stays true); the test then expects 'running'."
    },
    {
      "file": ".omp/run/mutants/MrConflictsWindow.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "promote",
      "problem": "The fixtureOperations.ts:43-59 constant survivors are kept as (a) 'equivalent', which they are not: a changed DEVELOP or REJECTED_PUSH changes what the fixture lists. They are #732 static artefacts that existing assertions kill, which is (b). This is the same mislabel as #1943 and #2006. Growth: none in code, but the label teaches the wrong VF7 category.",
      "fix": "Relabel them (b) gate-covered, #732 artefact, and name the killing assertions: fixtureOperations.test.ts:203-221, 260-270 and 289-300."
    }
  ]
}
