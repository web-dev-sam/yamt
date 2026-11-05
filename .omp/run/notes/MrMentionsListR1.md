# MrMentionsListR1

Agent output (`agent://MrMentionsListR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsListR1.md), collected 2026-11-05T10:24:09.896Z.

{
  "summary": "Escape and `close()` now leave different dismissals. Escape's lasts until the caret leaves the word. A send's or Preview's lasts only while the field still shows the text it closed on, so a cleared field opens a new `@` again (#2489/#2492/#2494). The read/close/blur/compose decision is now the pure `mentionStep` in mergeRequestMentionLines.ts. It searches only when the open word's start or typed text changes (#2491). The pick edit is the pure `mentionPick`. A new node test drives useMentions with a fake textarea (#2493). useMentions' signature is unchanged.",
  "files_changed": [
    "frontend/src/ui/mergeRequestMentionLines.ts",
    "frontend/src/ui/mergeRequestMentionLines.test.ts",
    "frontend/src/ui/mergeRequestMentions.ts",
    "frontend/src/ui/mergeRequestMentions.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "a_send_forgets_its_dismissal_once_the_field_shows_another_text",
      "proves": "Send `@an`, then a keyup on the same text: stays closed. After the text becomes `@`, the list opens and the dismissal is gone. `@ann` opens. A caret outside the word drops the dismissal."
    },
    {
      "name": "escape_keeps_its_word_closed_while_typing_in_it",
      "proves": "After Escape at start 3, typing in the word stays closed with no call. Another word opens, and so does the first word once the caret is back. Escape with no word dismisses nothing."
    },
    {
      "name": "a_close_outside_a_word_dismisses_nothing",
      "proves": "close() outside a word, or while composing, leaves no dismissal."
    },
    {
      "name": "the_search_is_asked_once_per_open_word",
      "proves": "#2491: rereading the same word asks nothing. A changed typed text or start asks again."
    },
    {
      "name": "a_closing_word_ends_the_search_once / a_composition_closes_the_word_and_its_end_reads_again",
      "proves": "end() fires once per closing (read with no word, blur). Composition start closes; reads while composing stay closed; compositionend reads again."
    },
    {
      "name": "a_pick_writes_an_existing_line_over_the_open_word",
      "proves": "mentionPick gives the edit for an existing line. It gives null for an index out of range, no list, or no word."
    },
    {
      "name": "mergeRequestMentions.test.ts (10 tests)",
      "proves": "useMentions with a fake textarea and fake searcher: reads, one search, aria, anchor after nextTick, arrows, Enter pick via insertText(false), Escape, send close, blur/focus a task later, composition, scroll, highlight reset."
    }
  ],
  "smoke_evidence": [
    {
      "command": "just app-session start-fixture --name mmr --diff --mr list --open-mr --size 1600x1000; d01 panel; type @an",
      "observed": "{logs:[fixture_people_search {text:\"an\"}], list:[\"ABAnna Berg@anna\"], ss:3, v:\"@an\"} (dark)"
    },
    {
      "command": "dark: Ctrl+Enter with the list open, read, then type @an",
      "observed": "After the send: {v:\"\", ss:0, list:null, focus:TEXTAREA, one fixture_write {kind:\"comment\", iid:637, discussion d01}}. After @an: {list:[\"*ABAnna Berg@anna\"], ss:3, v:\"@an\"} plus one new people_search \"an\". A second dark send then @an: writes 2, list [Anna]. Shot /tmp/mmr-dark.png."
    },
    {
      "command": "light set live (html data-theme=light, colorScheme light), twice: Ctrl+Enter, type @an",
      "observed": "{theme:\"light\", writes:3, list:[\"ABAnna Berg@anna\"], v:\"@an\"} and {theme:\"light\", writes:4, list:[\"ABAnna Berg@anna\"]}. /tmp/mmr-light.png shows Anna's line under `@an` in the reply field."
    },
    {
      "command": "#2489 example: type `cc @an`, Ctrl+Enter, type `cc @an`; then Escape and `n`",
      "observed": "{writes:6, list:[\"ABAnna Berg@anna\"], v:\"cc @an\"}. After Escape and n: {list:null, v:\"cc @ann\", focus TEXTAREA}: Escape's dismissal holds while typing."
    },
    {
      "command": "#2491: with @an open, a click and End (same word)",
      "observed": "people_search count stayed 3, list [Anna]. Arrow keys inside the word asked again: the typed text went `a` then `an`, which the rule allows."
    },
    {
      "command": "Preview with ` @b` open, then Write",
      "observed": "Preview: list null. Write: {v:\"cc @ann @b\", ss:10, list:null}"
    },
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order; test",
      "observed": "All clean. \"All matched files use the correct format.\" Test Files 306 passed (306); Tests 4563 passed (4563)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 99.70% (332 killed, 1 survived, 0 no-cov, 4 compile errors). mergeRequestMentionLines.ts 100% (200/200). mergeRequestMentions.ts 99.25%; its listener registrations are killed too.",
    "survivors": [
      "mergeRequestMentions.ts:104 `key === null || list === null` → `key === null || false` — equivalent: mentionKey(event, null) already returns null (fixed contract), so the result is false either way. The guard only narrows `list` for TS."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2489/#2492 fixed without a text getter, with Main's approval: a close() dismissal holds only while the field shows the text it closed on, so the Post box's Queue gets the fix with useMentions(field, known) unchanged.",
    "Added exports: FieldText, MentionState, MentionEvent, MentionCall, MentionStep, MENTION_CLOSED, mentionStep, mentionPick (mergeRequestMentionLines.ts). New file mergeRequestMentions.test.ts (Owned granted by Main).",
    "The input listener no longer skips while composing; it sends a `read`, and every read while composing finds no word, which is the same outcome. input, click and keyup share one registration.",
    "The highlight watch now watches `list`: opening or closing resets the highlight to 0, otherwise highlightAfter. This replaces the `?? []` default, which was an equivalent mutant.",
    "Exhaustive `default: never` arms dropped where tsgolint switch-exhaustiveness-check covers the switch (TS3 allows both). The search-call switch became if/else."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestMentionLines.ts:99-106 (heldDismissal)",
      "risk": "If a send fails, the text stays, so close()'s dismissal holds until the caret leaves the word or the text changes. The same holds if an outside writer sets the exact same text."
    },
    {
      "location": "frontend/src/ui/mergeRequestMentions.ts:78-80",
      "risk": "measure runs after every event, including blur and reads with the word closed (it then sets the anchor to null). That is one caretBox mirror per read while a word is open, the same as round 1."
    }
  ]
}
