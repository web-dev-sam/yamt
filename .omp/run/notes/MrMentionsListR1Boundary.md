# MrMentionsListR1Boundary

Agent output (`agent://MrMentionsListR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsListR1Boundary.md), collected 2026-11-05T10:26:38.430Z.

{
  "verdict": "pass",
  "checked": [
    "#2489 fixed: close() stores {close,start,text} (Lines.ts:118); heldDismissal (:99) keeps it only while text matches, so a send's v-model clear frees the next `@`. Tests: Lines a_send_forgets_…, Mentions a_send_closes_….",
    "Escape keeps holding until the caret leaves the word; a later close() overwrites it. The Ctrl+Enter keyup sees the unsent text and holds. This matches the approved deviation: no text getter, MentionField unchanged.",
    "Ownership and edges: the changed files are Owned or granted. mentionEdit comes from mergeRequests/index.ts (PM5). The test imports no window root and no lsp (PM10). The pure file has no vue.",
    "State: `mention` has one writer (dispatch via the pure mentionStep); anchor's only writer is measure. mentionPick replaces the inline pick with no copy. callAfter (once per open word) differs from the searcher's dedupe.",
    "Accepted: close() with field null now keeps the list open, but it is unreachable because both fields keep their textarea mounted (ReplyField v-show, RangeMessageEditor:65). Also accepted: the failed-send and same-text open risks.",
    "AGENTS.md:77 matches mentionStep and both dismissal lifetimes. Dropping `default: never` is fine: the return type plus the switch-exhaustiveness lint cover it (TS3). No gate was run."
  ],
  "findings": []
}
