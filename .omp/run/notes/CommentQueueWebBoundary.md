# CommentQueueWebBoundary

Agent output (`agent://CommentQueueWebBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/CommentQueueWebBoundary.md), collected 2026-11-24T18:41:31.870Z.

{
  "verdict": "pass",
  "findings": [
    {
      "file": "frontend/src/ui/rangeDrafts.ts",
      "line": 77,
      "severity": "should",
      "rule_id": "principles-2",
      "problem": "After #198 only an AI answer gets a Post draft and only a note gets an Edit draft (rangeNoteChange.ts:8). So `openMessageBox`'s rule that the two boxes never open at once guards an impossible state. Brief Change 4 asked for this path to go; the deviation saying it is still used does not hold. Readers must reason about a combination that cannot happen.",
      "fix": "Have writePost/writeEdit call setDraft directly, delete openMessageBox and its exclusion tests, drop the never-open-at-once clause in ui/AGENTS.md:17, and list it in deviations for plan #123."
    },
    {
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 59,
      "severity": "should",
      "rule_id": "TS16",
      "problem": "The public `addThread`/`addNote` members (wired at :282-283) have no production caller now that RangeThreadBox and rangeAi use `addTyped`; only tests keep them. That leaves two public add APIs with different return shapes, and the next caller can pick either.",
      "fix": "Move the tests to `addTyped`, then remove `addThread`/`addNote` from `RangeThreads`, keeping the module-private functions that addTyped dispatches to."
    },
    {
      "file": "frontend/src/ui/RangeMessageEditor.vue",
      "line": 40,
      "severity": "should",
      "rule_id": "VU7",
      "problem": "The editor gets its button rule two ways. The post box reads `gitlab.queueButton` and `useShiftHeld` from the store; the edit box gets its block through the `offTitle` prop, which RangeMessage passes as null for the post box. The prop and box combination is loose, and every new box would teach the editor another rule.",
      "fix": "Have RangeMessage compute the `ButtonView` for both boxes (queueButton with useShiftHeld for post, the Save view from saveOffTitle for edit) and pass it as a `button` prop; remove `offTitle` and the gitlab/shift reads from the editor."
    },
    {
      "file": ".omp/skills/project-map/tree.md",
      "line": 290,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "tree.md:290 and architecture.md:843 still name `ask(from: AskFrom, typed)`, a type this commit removed. tree.md:286's rangeGitLab list leaves out queueButton/queueTyped/queuePost. The deviations hand over only the sendMessage doc lines, so the docs keeper will miss these, and a search for AskFrom finds nothing.",
      "fix": "Add to deviations: AskFrom → `AddTo` (rangeThreads.ts) at architecture.md:843 and tree.md:290; rangeGitLab.ts also has `queueButton`, `queueTyped`, `queuePost` (tree.md:286)."
    },
    {
      "file": "frontend/src/ipc/fixtureReview.ts",
      "line": 219,
      "severity": "nit",
      "problem": "`only: number | null` needs a comment to say that null means the whole queue, where Rust uses the `Covers` enum (send.rs). Nothing gets harder as the app grows.",
      "fix": "Use `{ kind: \"queue\" } | { kind: \"message\"; id: number }`, mirroring Covers, and delete the comment."
    }
  ],
  "checked": [
    "Ownership: every touched file is in Owned except rangeAi.ts/.test, which Main granted; AskFrom→AddTo moved into rangeThreads, one add dispatch (addTyped) used by rangeAi, Note and Queue. Deviation accepted.",
    "One send routine: rangeGitLab.ts send(state, of, call) serves Send to GitLab and Send-one (progress, result, notLinedUp); sending/result are written only in rangeGitLab; no second Shift listener (useShiftHeld shared).",
    "Fixture order matches Rust send.rs:62 (SendRunning, UnknownMessage, check, not waiting → 0/0); postQueue shared rather than copied; tauriReview's sends() split is forced by max-lines-per-function.",
    "No PM2/PM3/PM5/PM9 edge added: ui imports ipc via ../ipc only; no @tauri-apps in ui; words only in rangeThreadText.ts; COMMENT_LABEL fully removed from src.",
    "Plan #198 matches: Post on a note queues at once, AI answer opens the box with Queue/Send; Queue/Send gated with the reason; Send off while sending; Note off only when blank; Ctrl/Cmd+Enter = Note.",
    "Not graded (outside this lens): WebKit/real-app smoke not run, environment gap the orchestrator already acknowledged; rangeGitLab.ts is at 285/300 lines (TS11), so the next growth should split the button views."
  ]
}
