# MrMentionsFinal

Agent output (`agent://MrMentionsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsFinal.md), collected 2026-11-05T10:55:44.886Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check (at c5dbade9; only .omp/run/slices.json modified)",
      "observed": "EXIT 0, 48.9 s. nextest 'Summary 1505 tests run: 1505 passed, 62 skipped'; vitest 'Test Files 306 passed (306) / Tests 4571 passed (4571)'; 'arch-check: ok'; 'map-check: ok'; golden run all ok; hooks-test 'tests 18 pass 18 fail 0'. Log /tmp/mmv-check.log.",
      "pass": true
    },
    {
      "recipe": "B1 bare @ (fixture --diff --mr list --open-mr; !637 '13 open discussions'; hover d01, Shift)",
      "observed": "Dialog 'Thread: src/board.ts:12'. Dark and light: list [*DV|Dmitri Volkov|@dmitri, SW|Sam Weller|@sam, AB|Anna Berg|@anna, BO|Ben Okafor|@ben], first selected, logs []. Pictures: initials, img, img, initials. Light @username colour rgb(115,118,124). The 4-line list flipped above the field (737.5-849.5) because it does not fit below; design section 268-269 calls for this.",
      "pass": true
    },
    {
      "recipe": "B2 search an; B10 shots",
      "observed": "Dark and light: exactly one 'mergeRequests.fixture_people_search {text: \"an\"}', list [*AB|Anna Berg|@anna]. Shots /tmp/mmvf/b2-dark.png (viewed) and /tmp/mmvf/b2-light.png.",
      "pass": true
    },
    {
      "recipe": "B3 under the caret (13px/20px system-ui, lineHeight 20px, paddingTop 4px)",
      "observed": "Measured on the visible bordered box, dark and light. @an line 1: line bottom 874.5, box top 874.5; @ x 617, box left 617. Line 3: 914.5 vs 914.5; 617 vs 617. 'hello @an': 874.5 vs 874.5; 617+measureText 33.319=650.319 vs 650.3125.",
      "pass": true
    },
    {
      "recipe": "B4 inside the panel",
      "observed": "Dark and light: 12 lines; list [617,914.5,785.42,952.5] inside panel [595,194,1235,962].",
      "pass": true
    },
    {
      "recipe": "B5 pick, undo, click",
      "observed": "Dark and light: Down, Enter gave v '@anna ', ss 6, no list. execCommand undo gave v '@an', selection 0-3, no list. A click on the option gave '@anna ', ss 6, focus in the field.",
      "pass": true
    },
    {
      "recipe": "B6 Escape (RK73)",
      "observed": "Dark and light: Escape 1 left the list closed, the dialog open and focus in the field. Escape 2 closed the dialog; url ?diff&mr=list&open=mergeRequests, '40 of 40 merge requests'.",
      "pass": true
    },
    {
      "recipe": "B7 send keys",
      "observed": "Dark and light: Ctrl+Enter logged one 'fixture_write {kind: \"comment\", iid: 637, discussion: 000..01}', then v '' and no list. Shift+Enter gave '@an\\n' with no list. Tab gave '@an\\n@anna ' with ss 10. A fresh '@an' after the send listed Anna again.",
      "pass": true
    },
    {
      "recipe": "B8 rule 6",
      "observed": "Dark and light, with Anna listed: I clicked the people opener at (1063,183), then 'Add assignee'. 'Search people' was empty with Me@sam, Dmitri, Anna, Ben, Chiara and no mention list. 'er' made one search 'er': Sam, Anna, Erik Lund. Two Escapes closed it. Reopening d01 and clicking the field listed only Anna, no Erik, no new search. Shots /tmp/mmvf/b8-er-dark.png and b8-er-light.png.",
      "pass": true
    },
    {
      "recipe": "B9 Preview / Write",
      "observed": "Dark and light: Preview closed the list. Write brought back v '@an', ss 3, focus, no list. ArrowLeft showed no list. End, then ' @b', listed Ben and Anna after one search 'b'.",
      "pass": true
    },
    {
      "recipe": "C1 local-conflicts-repo.sh /tmp/mmvf/mmv; cargo tauri build --debug --no-bundle",
      "observed": "'Open its merge-request page with: cd /tmp/mmvf/mmv && yamt --diff'; 'Finished dev profile ... Built application at: target/debug/yamt'.",
      "pass": true
    },
    {
      "recipe": "C2 real app --glab mr-threads --mr, !90 d01, argv counts",
      "observed": "Dark: '@' added no line; Dmitri, Sam, Ben, Anna listed. 'an' added one line: 'argv: api graphql -f query=query PeopleSearch(...) autocompleteUsers(search: $search) ... -f fullPath=taskboard/taskboard -f search=an'. Anna was listed with an img (naturalWidth 16). Down, Enter gave '@anna ' and no new line. a/n/n with pauses gave one line each: search=a, search=an, search=ann. A muted note (rgb(129,126,141)) under Anna: 'fake glab: the scenario has no answer graphql-people-ann.json'. Light: the same.",
      "pass": true
    },
    {
      "recipe": "C3 shots; C4 stop",
      "observed": "/tmp/mmvf/c-an-dark.png, c-ann-dark.png, c-an-light.png, c-ann-light.png (viewed: '@ann', Anna, the muted note). The stop printed session ended.",
      "pass": true
    },
    {
      "recipe": "D1 range fixture listed: Back, board.ts, thread, Post, Ctrl+End, ' @'",
      "observed": "Dark and light: list [*AB|Anna Berg|@anna, SW|Sam Weller|@sam], logs [], focus in 'Text to post'.",
      "pass": true
    },
    {
      "recipe": "D2 'an', rects; D7 shots",
      "observed": "Dark and light: one fixture_people_search 'an', Anna listed. List [1121.58,698.5,1290,736.5] inside .cm-scroller [942.5,82.5,1591,953]; centreInList true. Shots /tmp/mmvf/d2-dark.png and d2-light.png.",
      "pass": true
    },
    {
      "recipe": "D3 ArrowDown, Enter (RK35)",
      "observed": "Dark and light: ArrowDown left the file 'src/board/board.ts', scrollTops [0,0] and focus in the box. Enter gave 'Is this still used? @anna ', ss 26, no list.",
      "pass": true
    },
    {
      "recipe": "D4 Escape twice",
      "observed": "Dark and light: Escape 1 closed the list and the box stayed focused. Escape 2 closed the box (focus on a BUTTON), url unchanged.",
      "pass": true
    },
    {
      "recipe": "D5 Queue and Send",
      "observed": "After Queue: 'Send to GitLab (3)', 'Unqueue'; state {kind:queued, text:'Is this still used? @anna '}. After Send: 'Pending on GitLab'; state {kind:pending, text:'...@anna ', draftNote:104, mergeRequest:'!640'}. Shot /tmp/mmvf/d5-sent-light.png.",
      "pass": true
    },
    {
      "recipe": "D6 restart --gitlab linedUp",
      "observed": "' @' showed no list and no search. 'an' made one fixture_people_search 'an' and listed Anna Berg.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0, node v26.13.0, pnpm 12.0.0. The gate and B ran at c5dbade9. HEAD moved to b0c45dd3 (docs-only) during the smoke run. MiniBrowser and the app on private displays (Xvfb :3). Light set live via data-theme. Logs captured by wrapping console.*."
}
