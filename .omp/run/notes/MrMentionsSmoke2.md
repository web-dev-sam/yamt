# MrMentionsSmoke2

Agent output (`agent://MrMentionsSmoke2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsSmoke2.md), collected 2026-11-05T10:41:03.615Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "D start: range fixture listed; Back; board.ts; .cm-thread-count nth 3; Post nth 0",
      "observed": "activeElement TEXTAREA 'Text to post' value 'Is this still used?'. The board.ts:102 thread has two Post buttons (the note's and the AI answer's); nth 0 is the note's.",
      "pass": true
    },
    {
      "recipe": "D1 Ctrl+End, ' @' (dark and light)",
      "observed": "logs [], list ['*ABAnna Berg@anna','SWSam Weller@sam'], v 'Is this still used? @', ss 21, ae TEXTAREA|Text to post. No fixture_people_search. Light: the same.",
      "pass": true
    },
    {
      "recipe": "D2 'an', rects, elementFromPoint (dark and light)",
      "observed": "One '[info] mergeRequests.fixture_people_search {text: \"an\"}', list ['*ABAnna Berg@anna']. list_rect [1126.58,703.5,1285,731.5] is inside .cm-scroller [942.5,82.5,1591,953] (inside true), centreInList true. Light: the same values.",
      "pass": true
    },
    {
      "recipe": "D3 ArrowDown, Enter (dark and light)",
      "observed": "After ArrowDown: list unchanged, shown file still src/board/board.ts, scroller scrollTops [0,0], ae still the box. After Enter: v 'Is this still used? @anna ', ss 26, list null, ae TEXTAREA|Text to post. Light: the same.",
      "pass": true
    },
    {
      "recipe": "D4 '@an', Escape, Escape (dark and light)",
      "observed": "Escape 1: box true, list null, v 'Is this still used? @anna @an', focus in the box. Escape 2: box false, ae BUTTON, url unchanged (?range=review&threads=seeded&gitlab=listed&mr=list&open=mergeRequests). Light: the same.",
      "pass": true
    },
    {
      "recipe": "D5 Post again, ' @an', Enter, Queue, Send to GitLab (3)",
      "observed": "Before Queue: v 'Is this still used? @anna '. After Queue: 'Send to GitLab (3)' and 'Unqueue'. After Send: the thread showed 'Pending on GitLab https://gitlab.example/taskboard/taskboard/-/merge_requests/640/diffs' and 'Send to GitLab (0)'. Vue state: posting {kind:'pending', text:'Is this still used? @anna ', draftNote:104, mergeRequest:'!640'}. The UI does not show the queued text; I read it from state after Send. Shot: /tmp/mmv2-scratch/d5-sent-dark.png.",
      "pass": true
    },
    {
      "recipe": "D6 restart --gitlab linedUp; Post; ' @' then 'an'",
      "observed": "After ' @': logs [], list null. After 'an': one fixture_people_search {text: \"an\"}, list ['ABAnna Berg@anna'].",
      "pass": true
    },
    {
      "recipe": "D7 shots of step 2",
      "observed": "/tmp/mmv2-scratch/d2-dark.png and /tmp/mmv2-scratch/d2-light.png (both viewed): 'Is this still used? @an' with Anna Berg and a muted @anna under the caret line, inside the box above Queue/Cancel.",
      "pass": true
    },
    {
      "recipe": "B1 re-run (compare fixture --mr list --open-mr; !637 discussions; Shift over d01; '@'; dark and light)",
      "observed": "Dialog 'Thread: src/board.ts:12'. list ['*DVDmitri Volkov@dmitri','SWSam Weller@sam','ABAnna Berg@anna','BOBen Okafor@ben'], activedescendant v-0-0. @username colour rgb(129,126,141). Sam and Anna have a picture; Dmitri and Ben show initials. logs []. Light: the same.",
      "pass": true
    },
    {
      "recipe": "B2 re-run 'an' (dark and light)",
      "observed": "One 'fixture_people_search {text: \"an\"}', list ['*ABAnna Berg@anna']. Shots: /tmp/mmv2-scratch/b2-dark.png, b2-light.png.",
      "pass": true
    },
    {
      "recipe": "B7 re-pass #2494: Ctrl+Enter with list open, wait 1.5 s, '@an', read 2 s later",
      "observed": "Ctrl+Enter: 'fixture_write {kind: \"comment\", iid: 637, discussion: \"0...01\"}' and fixture_thread. Then v '' and list null. Then '@an': a new fixture_people_search {text: \"an\"}, list ['*ABAnna Berg@anna'], v '@an', ss 3. Dark: 2 of 2 tries. Light: 1 of 1.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0, node v26.13.0, pnpm 12.0.0; HEAD bc55e2e9 at the end (e6eadfc0 at the start). MiniBrowser via just app-session on a private display, 1600x962 viewport. Light was set live with data-theme. Logs were captured by wrapping console.* in the page."
}
