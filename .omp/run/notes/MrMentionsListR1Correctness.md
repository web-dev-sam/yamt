# MrMentionsListR1Correctness

Agent output (`agent://MrMentionsListR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsListR1Correctness.md), collected 2026-11-05T10:26:20.889Z.

{
  "verdict": "pass",
  "checked": [
    "#2491 fixed: callAfter searches only on a changed start or typed; caught by the_search_is_asked_once_per_open_word and typing_a_word_opens_its_list_and_searches_once (input+keyup+click gives 1 search)",
    "#2489/#2492/#2494 fixed: heldDismissal keeps a close() dismissal only while text is unchanged; a send clears the text, `@` reads text '@' and opens; a_send_forgets_… and a_send_closes_… catch it; WebKit dark+light smoke",
    "#2493 fixed: the read/close/escape/blur/compose decision is the pure mentionStep with node tests; the one kept survivor (:104 list===null→false) is VF7 (a) equivalent: mentionKey(e, null) returns null already",
    "No regression: composing drops the dismissal and closes the word as in round 1; Escape then a send leaves a close dismissal; the highlight resets on open/close (the_highlight_resets… kills it)",
    "Accepted risks: a failed send keeps its dismissal while the text is unchanged (approved rule); measure per event nulls the anchor when closed; ui/AGENTS.md:77 matches",
    "Read-only review; no tests run (no block depended on one)"
  ],
  "findings": []
}
