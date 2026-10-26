```json
{
  "verdict": "fail",
  "lens": "boundary-reviewer",
  "patch": "fd06743 RVThreadState",
  "findings": [
    {
      "severity": "block",
      "rule_id": "PM2",
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 3,
      "problem": "`import type { ShownThread } from \"../editor\"` makes a state module a fourth way from ui/ into the editor. The project map's dependency direction and ui/AGENTS.md only allow `useMergeController`, `useCompareController` and `useRangeController`, and the brief's acceptance names this fence. No fence script catches a type-only import, so more state modules can copy this unnoticed.",
      "fix": "Move `ShownThread` into `ipc/threadLine.ts` next to `ThreadLine` and `shownLine`. `editor/internal/threadRows.ts` imports it from `../../ipc`, `editor/range.ts`/`index.ts` keep re-exporting it, and `rangeThreads.ts` imports it from `../ipc`. This needs a grant for `ipc/threadLine.ts` and `editor/internal/threadRows.ts`, and it also avoids the cycle that stopped a re-export through useRangeController."
    },
    {
      "severity": "block",
      "rule_id": "TS3",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 97,
      "problem": "The rule for which postings sit in the queue is written twice. `rangeThreads.ts:236` counts `queued || refused` for \"Send to GitLab (n)\", and `postButton` treats any `kind !== \"notQueued\"` left after `pending` as Unqueue. Neither is an exhaustive switch, so a new `Posting` kind would show Unqueue on a message the count leaves out, with no type error.",
      "fix": "Export one `isQueued(posting: Posting): boolean` from `rangeThreads.ts`, written as an exhaustive `switch` with a `never` default. Use it in both the `queued` computed and `postButton`'s Unqueue branch."
    },
    {
      "severity": "should",
      "rule_id": "TS11",
      "file": "frontend/src/ui/rangeThreads.ts",
      "line": 17,
      "problem": "`rangeThreads.ts` is 293 of its 300 allowed lines and holds three jobs: the list mirror and open set, the drafts (new-thread drafts, note text, the `focus` counter, `nextDraft`) and the editor projections (`shownFor`, `boxOf`). Row C (`3.RV-ai-threads`) owns this file next, so its first addition goes over the cap and lands in an already mixed module.",
      "fix": "Move `Draft`, `setDraft`, `threadDraft`, `startThread`'s draft half and `writing` into `ui/rangeDrafts.ts` (a `createRangeDrafts()` that `createRangeThreads` builds and spreads), keeping `RangeThreads`' contract surface unchanged."
    },
    {
      "severity": "should",
      "rule_id": "TS2",
      "file": "frontend/src/ui/rangeThreadText.ts",
      "line": 12,
      "problem": "`SendResult { sent, refused, stopped: string | null }` turns ipc's `sent | stopped` reply into a nullable field. `rangeGitLab.ts:152` converts it with a ternary, so a third reply kind would quietly read as \"not stopped\". The window's state type also lives in the words module.",
      "fix": "Hold `Exclude<SendReply, { kind: \"notLinedUp\" }>` in `GitLabState.result`, have `sendResultText` switch exhaustively on `kind`, and delete `SendResult`."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ui/problem.ts",
      "line": 23,
      "problem": "GitLab check and send failures are logged as `store.threads_failed {step: \"check\"|\"send\"}`, so anyone searching the log for GitLab failures has to know they sit under threads; nothing else gets harder.",
      "fix": "Split them into `{ action: \"gitlab\"; step: \"check\" | \"send\"; cause }` and keep `threads` for list/add/note/queue/unqueue."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 38,
      "problem": "`result`/`dismissResult` beside `check` does not say which result it is; nothing gets harder.",
      "fix": "Rename them to `sendResult`/`dismissSendResult`."
    }
  ],
  "checked": [
    "Ownership: every changed file is in Owned or the mid-build grants (problem*, problemText*). The `ipc/reviewDomain.ts` export-only change is recorded as granted in the implementer notes and is consistent with the RVReviewIpc notes asking row 20 to export what it imports.",
    "RangeApp.vue changes only the `gitlab` destructure and the `checkOnFocus()` call in the focus watch, within its grant.",
    "editor/range.ts: `NO_EVENTS` is deleted and `events` is required. All three `new RangeController(` callers (useRangeController.ts:176, range.browser.test.ts:126, rangeThreads.browser.test.ts:150) pass events.",
    "editor/AGENTS.md: the `threadAnchors` line now reads the brief's text (\"the text bottom above and the next line's block top below each unchanged row\").",
    "Fences: rangeGitLab.ts and rangeThreadText.ts import only vue, `../ipc` and ui siblings; no `@codemirror`, `@tauri-apps`, `editor/internal` or `lsp/` imports in any new file.",
    "Import edges: rangeGitLab → rangeThreads (type) → problem, and rangeThreadText → rangeText; no new cycle.",
    "Contract: `RangeThreads` and `GitLabState` keep every field and signature in the brief. The additions (`queued`, `load`, `boxOf`, `writeDraft`, `dropDraft`, `noteText`, `writeNote`, `result`, `sendButton`, `postButton`, `dismissResult`) are allowed and accepted; row 21's brief (3.RV-thread-boxes.md Facts) does not list them yet, which is for the orchestrator.",
    "Deviation accepted: `createGitLabCheck`'s fourth parameter `start` (appended; the four parameters have distinct types, TS7 fine) is read-only and has one writer (rangeStore `startUp`).",
    "Deviation accepted: a new thread keeps its draft key through `state.keys`, so its editor host is not rebuilt (plan §2 #116, hosts kept for a thread's life).",
    "Deviation accepted: the `threads` Problem variant has its log line in `logProblem` and its words in `problemText.ts` `THREAD_STEP_WORDS` (a `Record` keyed by `ThreadStep`, TS17).",
    "One writer per state: `list` is written only inside rangeThreads (`changed`, `addThread`, `replace`); rangeGitLab writes it only through `threads.replace`.",
    "One writer per state: `open`/`drafts` only by rangeThreads' actions; `check`/`checking`/`sending`/`result` only inside rangeGitLab; `problem` only through the store's `report`.",
    "Store vs components: rangeStore builds both state objects once and only exposes them; Vue gets no EditorView, position or document text. Draft text is review text, not editor text.",
    "Decision record #116: the editor shows only what `showThreads` gets; `useRangeController` pushes `shownFor(file.id)` at build and on each change, and returns `threadHosts`.",
    "Decision record #119: checked at start after the list shows (rangeStore `startUp`), on focus ≥ RECHECK_PAUSE_MS after the last check ended, one at a time; buttons blocked with CHECKING_TEXT until the first answer; the last answer is kept during a re-check; Unqueue stays enabled whatever GitLab says (rangeGitLab.ts:97-98).",
    "Decision record #120: `open` is never stored, so a reopened range starts collapsed; drafts stay in memory only.",
    "Every user-facing sentence of these modules is in rangeThreadText.ts; rangeThreads and rangeGitLab only have key prefixes. `notLinedUpText` and `postingLabel` are exhaustive switches with `never` defaults (TS3).",
    "Comments: none added in the new modules, the store or the controller seam (comment-policy).",
    "TS10/TS15: top-level functions are declarations; mutable state (`keys`, `adding`, `nextDraft`, `lastEnded`) lives in per-instance closures, not module state.",
    "Mutation survivors: none shows a boundary problem. The NoCoverage on useRangeController.ts:166-176 (the store-to-controller wiring) is for the correctness lens.",
    "Pre-existing, not this patch: docs/architecture.md has no range-window rows at all (state table, PM6 naming of rangeThreads/rangeGitLab/rangeThreadText). Docs are not Owned here, so this is the orchestrator's doc work for the branch."
  ]
}
```