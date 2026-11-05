# MrMentionsListBoundary

Agent output (`agent://MrMentionsListBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsListBoundary.md), collected 2026-11-05T10:02:48.404Z.

{
  "verdict": "fail",
  "checked": [
    "Boundaries: new ui/MergeRequest*/mergeRequest* files import only mergeRequestsStore/useMergeRequests, no window root or lsp/ (PM10); textareaCaret.ts imports nothing; files changed ⊆ Owned (README re-pad is the post-edit oxfmt hook)",
    "Contract: every fixed signature matches; additions mentionOptionId/FieldRead/MentionInput have importers; wrappedIndex extracted with stepMenuItem unchanged (menuKeys.ts:11-27); MENTION_PEOPLE one constant",
    "Deviations accepted: insertText write path (orchestrator-approved, measured), caretBox first-client-rect + half-leading (CSS 2.1 cite, CP1), split panel classes for uncapped measure, focus read a task later, compositionstart read",
    "Keys/RK73: taken keys preventDefault+stopPropagation before boxKeydown (ReplyField.vue:162-165); MergeRequestThread.vue:107-118 skips defaultPrevented Escape; options @mousedown.prevent keep focus",
    "State/reuse: mentionSearch owned by mergeRequests.ts:289 (search slice); per-field word/highlight/anchor/dismissed local to useMentions; listbox markup and scrollIntoView reuse MergeRequestPeopleSearch.vue pattern",
    "Acceptance tests present: mergeRequestMentionLines.test.ts names, textareaCaret mirror test, wrappedIndex test, the_reply_field_offers_mentions SSR; AGENTS.md :75 rewrite and Mentions paragraph match brief step 9"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestMentions.ts",
      "line": 145,
      "severity": "block",
      "problem": "Ctrl+Enter or Add comment with the caret in an `@` word (e.g. `cc @anna`) dismisses its start; the sent text is cleared without an input event, so typing `@` at that offset in the next reply opens no list until the caret leaves the word.",
      "fix": "Forget `dismissed` when the text is replaced from outside: add `MentionField.forget()` (sets dismissed null) and call it from the reply field when a send clears `text`, or don't dismiss in `close()` for sends.",
      "rule_id": "R-mentions-rule-1"
    },
    {
      "file": "frontend/src/ui/mergeRequestMentions.ts",
      "line": 46,
      "severity": "should",
      "problem": "The `State` doc comment explains what `word` and `dismissed` hold, which better names could say; nothing gets harder as the app grows, but readers must hold the comment to read `read`/`close`.",
      "fix": "Rename `word` → `openWord` and `dismissed` → `dismissedStart` and delete the comment.",
      "rule_id": "CP2"
    }
  ]
}
