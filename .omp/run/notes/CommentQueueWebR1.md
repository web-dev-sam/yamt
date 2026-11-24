# CommentQueueWebR1

Agent output (`agent://CommentQueueWebR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueWebR1.md), collected 2026-11-24T18:58:23.074Z.

{
  "summary": "All five findings are fixed. Send now reports SendRunning (step send) when a send is already running, so a Shift+Send that loses the race leaves its message queued and shows a problem. Draft writes go straight to setDraft; openMessageBox and its tests are gone. RangeThreads keeps only addTyped as its public add. RangeMessage builds one ButtonView per box and passes it to RangeMessageEditor with the text. The fixture's `only` is now a Covers sum type.",
  "files_changed": [
    "frontend/src/ui/rangeGitLab.ts",
    "frontend/src/ui/rangeGitLab.test.ts",
    "frontend/src/ui/rangeDrafts.ts",
    "frontend/src/ui/rangeThreads.ts",
    "frontend/src/ui/rangeThreads.test.ts",
    "frontend/src/ui/rangeAi.test.ts",
    "frontend/src/ui/RangeMessage.vue",
    "frontend/src/ui/RangeMessageEditor.vue",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ipc/fixtureReview.ts"
  ],
  "tests_added": [
    {
      "name": "rangeGitLab: Send to GitLab starting between the queue and Send's one-message send reports SendRunning; the message stays queued",
      "proves": "#2582: sendQueue starts after queueMessage resolves and before the one-message send. sendMessage is never called, the message stays queued, and problems = [{threads, send, SendRunning}]."
    },
    {
      "name": "rangeGitLab: the progress label counts the message being sent, one send at a time (extended)",
      "proves": "A second send() while one runs now reports SendRunning instead of returning silently (kills the mutant on the new report line)."
    },
    {
      "name": "rangeThreads / rangeAi tests moved to addTyped (e.g. 'a second Comment while the first is in flight sends nothing more', 'addingNote holds…')",
      "proves": "#2585: same behaviour through the one public add API: the null/Added results, the in-flight refusal, blank text, and refused adds."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend fmt:check; pnpm -C frontend unused",
      "observed": "vue-tsc -b clean; oxlint+eslint no errors; 'All matched files use the correct format.'; knip clean"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 314 passed (314); Tests 4734 passed (4734)"
    },
    {
      "command": "just app-session start-fixture --name cqr1 --range-case review --threads seeded --ai; Ask AI on a new line-7 thread, then Post on the answer (WebKitWebDriver + MiniBrowser on Xvfb)",
      "observed": "Post box 'Text to post' holds the answer. Buttons: Queue{Queue this comment as a draft on !12; Send to GitLab sends the queue} | Cancel"
    },
    {
      "command": "raw WebDriver key action keyDown \\uE008 (held), read the box, then keyUp \\uE008",
      "observed": "held: Send{Send only this comment to !12 as a draft now} | Cancel; released: Queue{Queue this comment as a draft on !12; …} | Cancel"
    },
    {
      "command": "pointer click on the Post box's Queue",
      "observed": "Send to GitLab (2)→(3); the answer shows Unqueue{Take this message out of the queue} and 'Queued for GitLab'. Shot /tmp/cqr1/06-post-queued.png"
    },
    {
      "command": "Unqueue → Post → one WebDriver action set: keyDown Shift + pointer click on the box button + keyUp",
      "observed": "Send to GitLab stays (2); notice '1 sent, 0 refused'; the answer shows Post[d]{Pending on GitLab} and the link …/merge_requests/12/diffs. Shot /tmp/cqr1/07-shift-sent.png"
    },
    {
      "command": "Edit on the note → select-all + Backspace → type → Ask AI in the reply field → read Save → wait → Save",
      "observed": "open: Save{-} (no title); blank: Save[d]{-}; typed: Save{-}; during the AI turn: Save[d]{Comments cannot be edited while the AI works in this thread}; after: Save{-}. Save closed the box, the new text is shown, focus is on Edit. Shot /tmp/cqr1/08-save-blocked.png"
    },
    {
      "command": "just map-check",
      "observed": "map-check: ok"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 840 killed, 0 timeout, 13 survived, 4 no coverage (98.02%); the four TS files mutated whole",
    "survivors": [
      "13 survivors + 4 no-coverage, all on lines this round did not change (fixtureReview 108; rangeDrafts 88/98/108/122; rangeGitLab 97; rangeThreads 91/106/134/155/234/235/242). New report line rangeGitLab.ts:178 killed."
    ]
  },
  "acceptance_not_run": [
    "The #2582 race (Send to GitLab starting between queue and the one-message send) was not reproduced in WebKit: the window is microtask-sized and cannot be timed through WebDriver. The node test above covers it."
  ],
  "deviations_from_brief": [
    "#2586: ButtonView is now exported and its `title` is `string | undefined`, because the Edit box's enabled Save has no title today and must stay that way. RangeMessage also passes the draft's `text` as a prop, so the post/edit text is derived once, in RangeMessage.",
    "#2586: RangeMessageEditor still reads `gitlab.check` and `mergeRequests.rows` for the Post box's @ mentions (plan #191). That is not a button rule, so I left it there. Every read of gitlab.queueButton, useShiftHeld and offTitle is removed.",
    "#2582: the SendRunning report is in the shared send(), so the top-bar Send to GitLab's guard reports too. That path is unreachable from the UI while its button is disabled.",
    "fixtureReview.ts: to stay within max-lines 300, send() drops its try/finally around postQueue: sending=true, await, sending=false. postQueue cannot reject: it only pauses and does synchronous work.",
    "#2584: the never-both-open exclusion is gone (plan §2 #123). The ui/AGENTS.md Edit row now says that only a note gets an Edit draft and only an AI answer a Post draft. The docs keeper should update plan #123's wording if it still names the exclusion.",
    "ui/AGENTS.md: the Range threads, Queue and Note, and Ask AI rows are updated for the ButtonView/text props, the SendRunning report, and addTyped replacing addThread/addNote. ipc/AGENTS.md needed no change."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/rangeGitLab.ts:40",
      "risk": "`title: string | undefined` widens the type for sendButton/queueButton, which always give a string. A reviewer may want a separate Save view type instead."
    },
    {
      "location": "frontend/src/ipc/fixtureReview.ts:237",
      "risk": "Without try/finally, a future postQueue that can throw would leave the fixture's `sending` stuck at true."
    }
  ]
}
