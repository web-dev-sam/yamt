# RVNoteEditsWebR1Correct — re-check of 663e99d

Verbatim output:

```json
{
  "verdict": "pass",
  "findings": [],
  "items": {
    "#1647": "fixed. rangeDrafts.ts:100-104: `isStored` keeps an `edit` draft only while `storedMessage(...)` is found and `isChangeable`. RangeMessage.vue:44: `editOpen = changeable && editDraft !== null`. rangeGitLab.ts:159-170 sets `sending = null` and calls `replace(reply.list)` in the same synchronous run after the await, so no render can show Save turned back on before the draft is dropped. Test rangeThreads.test.ts 'an Edit box on a note a send made pending closes…' fails if the `isChangeable` check is removed from `isStored`: the draft would still read 'too late'.",
    "#1648": "fixed. Test rangeThreads.test.ts 'each message keeps its own Edit text…' fails under a shared `editKey`. The second `writeEdit` would overwrite the first, because `editDraft` checks only `kind`. The `writePost(first)` step would then also remove the second message's edit (rangeDrafts.ts `openMessageBox`).",
    "#1649": "fixed. The 'deleting a thread's last note…' test now puts a `post-${answer.id}` draft and an `edit-${repliedNote.id}` draft on thread 3, which has two messages, and expects both after the delete. With `some`→`every` or an equivalent per-thread rule, both would be dropped. The new lookup `storedMessage` (flatMap/find, rangeDrafts.ts:89-91) has no survivors on changed lines."
  },
  "checked": [
    "Survivor triage: the run reports 0 survivors on changed lines (RVNoteEditsWebR1.survivors.txt). .vue files are not mutated, so I read the RangeMessageEditor/RangeMessage behaviour below.",
    "Post keeps its earlier behaviour. Keys: both boxes use the same `boxKeydown(event, navigator.platform, { submit, cancel })` (RangeMessageEditor.vue:57-59, same as the deleted RangePostEditor.vue). Blank submit is off: `off = offTitle !== null || isBlank(text)`, and Post passes `:off-title=\"null\"` (RangeMessage.vue:131), so this is the old `blank` rule. Submit emits only when not off and passes `text.value`, as `queue` did before. Cancel → `cancel()`: `dropPost` + focus Post (unchanged). After a queue, focus goes to the Post/Unqueue button (RangeMessage.vue `queue`: awaits `threads.queue`, then focuses `postButton` in nextTick when `!postOpen`, unchanged). The field still focuses on mount with preventScroll, has 4 rows and `bg-panel-inline`, and its la…
    "Post's Queue gains a title span (`title` undefined when null), `disabled:pointer-events-none` instead of `disabled:hover:brightness-100`, and `@mousedown.prevent`. Focus after a successful queue is unchanged. After a refused queue, focus now stays in the field instead of on the button. I accepted this as the brief's 'one look' choice: it does not change behaviour in a way the user would notice as a regression.",
    "Edit's behaviour is kept. Save is off during a send or the thread's AI turn (`saveOffTitle` is non-null exactly when `block` is non-null, RangeMessage.vue:49) and when the text is blank (`?? \"\"` covers the old `editText === null`). `saveEdit` no longer checks this again, because the editor's `submit` gate covers both the click and Ctrl/Cmd+Enter. Focus on open moved from `focusLater` to the editor's onMounted. Escape/Cancel → `cancelEdit` focuses Edit; a successful save also focuses Edit (`editNote` drops the draft, rangeThreads.ts:236-240).",
    "Two RangeMessageEditor instances in v-if/v-else-if branches: Vue 3 gives each branch its own key, so switching boxes remounts and focus-on-mount runs again. Both openers are hidden while either box is open (RangeMessage.vue `v-if=\"!postOpen && !editOpen\"`), so a direct switch cannot happen anyway.",
    "The `isChangeable` move changed no rule: noteChange.ts:8-10 has the same text as the removed rangeThreads.ts lines (`body.kind === \"note\" && posting.kind !== \"pending\"`). The rangeThreads.test.ts:522 table over all seeded messages now imports it from noteChange. No other importer is left (grep: RangeMessage, rangeDrafts, rangeThreads.test).",
    "`noteChangeBlock` matches the old inline rule (old RangeMessage.vue at 663e99d^:52-58): a send first, then `threadAi.running !== null` → aiWorking. `ThreadAi.running: TurnView | null` (rangeAi.ts:18) matches the parameter. noteChange.test.ts covers all four combinations, including send+AI → 'sending'.",
    "Renames: `PostAction` is now `\"write\" | \"unqueue\"` (rangeGitLab.ts:35,117). `pressPost` switches over it exhaustively. No `\"edit\"` action or `RangePostEditor` reference is left in frontend/src (grep). The project map at SKILL.md:207 names RangeMessageEditor and noteChange.ts.",
    "rangeDrafts no longer imports rangeThreads (it imports `./noteChange`, which takes type-only imports from ../agent and ../ipc), so it adds no cycle. rangeThreads.ts is 292 lines, under the 300 cap.",
    "'replace mirrors a send's list…' now also checks that a Post draft on a message missing from the list is pruned. This closes the round-1 `case \"post\"` should finding.",
    "Not raised (RV8, not caused by this round): if `send_queue` returns Err after some posts were recorded (`?` in send.rs `send_one`), the window does not replace its list (rangeGitLab.ts:161-164), so an Edit box on a note now pending in Rust stays open. This was already true before the round and applies to the whole stale list, not to the draft rule. The focus-to-<body> when a Send closes an open Edit box is the implementer's open risk, and the brief does not ask for it.",
    "No tests run; every conclusion above comes from reading the code and the survivors file."
  ]
}
```

[Some lines truncated to 768 chars. Use agent://RVNoteEditsWebR1Correct:raw:12-12 to read line 12 whole]