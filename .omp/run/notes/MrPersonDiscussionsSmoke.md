# MrPersonDiscussionsSmoke

Agent output (`agent://MrPersonDiscussionsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsSmoke.md), collected 2026-11-05T14:58:11.161Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B6 person menu: type `an` → Anna Berg",
      "excerpt": "There is no search field in the menu. After opening it, focus was on menuitemradio \"SW Me\". `type an` changed nothing: \"SW Me | AB Anna Berg | BO Ben Okafor | CR Chiara Rossi | DV Dmitri Volkov\". MergeRequestMenu.vue shows its search field only when choices.length > NARROW_FROM, and NARROW_FROM = 8 (choices.ts). The menu has 5 people, so the field never shows."
    },
    {
      "step": "B10 Reload discussions: p1 keeps its index",
      "excerpt": "Before the reload: p1idx=39, p3idx=40, 56 entries. After: p1idx=40, p3 gone, 55 entries. Order now `38=637:13 39=609:22 40=624:17 41=607:23`. Before it was `38=637:13 39=624:17 40=624:19 41=609:22`. p6 moved in front of p1, so p1 did not keep index 39."
    },
    {
      "step": "B2 fixture_discussions '10 iids each'",
      "excerpt": "Each call sends every unread row and the fixture answers 10: `{iids: \"639,637,…,602\"}` (26 iids) → `discussions_read {asked: 26, answered: 10, refused: 1}`; then 16 iids → `{asked: 16, answered: 10}`; then 6 iids → `{asked: 6, answered: 6}`. The calls run one at a time and only for unread rows (638, 618, 608 left out), but they do not carry 10 iids each."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 Load lazily; search board + Reviewer; scroll",
      "observed": "Load lazily picked. With `board` and Reviewer Me: \"3 of 40 merge requests 638,618,608\" (with None: 4 rows). No scrollable list at 1600x1000, so half-way scrolling could not be done; scrollTop stayed 0.",
      "pass": false
    },
    {
      "recipe": "B2 Discussions button",
      "observed": "Tip \"Every open discussion, for one person\". Header \"Loading discussions — 0 of 3 merge requests\", then 5 entries; filter row kept. Log: fixture_discussions {iids: \"638,618,608\"}; discussions_read {asked: 3, answered: 3}. Without filters the header counted \"3 of 29\" → \"23 of 29\" → done.",
      "pass": true
    },
    {
      "recipe": "B3 Back to list",
      "observed": "\"3 of 40 merge requests 638,618,608 search=board reviewerBtn=true\". No log lines after Back.",
      "pass": true
    },
    {
      "recipe": "B4 Me's order, failures, Retry",
      "observed": "The 56 entries equal MES_ORDER (\"637:1 637:3 636:16 … 602:60201\"). Header \"15 of 56 wait for you\". \"!629 … — glab is not logged in: gitlab.example: No token found (…) — run glab auth login in a terminal, then Refresh.\" Retry; \"!615 … — glab failed: glab timed out\" Retry. Retry on !615 → fixture_discussions {iids: \"615\"} once.",
      "pass": true
    },
    {
      "recipe": "B5 p1 entry, p6 fold",
      "observed": "p1 (17 on !624): Anna Berg, \"2 days ago\" (tip 03.11.2026, 15:47), \"!624 Speed up the board query\", Overview. Shows strong \"reminder\", code \"snoozeUntil\", the link, img 160x80. Clamp 80 px. Writers BO, CR, DV with name tips. Turn word \"Ben Okafor's turn\", as pinned in the test. One-comment entries have no pictures. p6: no fold at 1600, \"+3\" at 700 (tip \"3 more: Chiara Rossi, Dmitri Volkov, Anna Berg\"), \"+9\" at 560; newest writers stay. Shots /tmp/mpd-shots/b5-dark.png, b5-light.png",
      "pass": true
    },
    {
      "recipe": "B6 person menu",
      "observed": "Menu: Me first, then Anna, Ben, Chiara, Dmitri, each with an avatar. Typing `an` does nothing (see failures). Picking Anna gives exactly ANNAS_ORDER and \"13 of 56 wait for Anna Berg\": 13 × \"Anna Berg's turn\", 0 × \"Your turn\". First Escape closes the menu only; second Escape: the page stays. Shots b6-menu-dark/light.png",
      "pass": false
    },
    {
      "recipe": "B7 expanding",
      "observed": "Hover p2 + Shift → \"Loading…\", then the thread; one fixture_thread (624/…018). Shift again: no log, still expanded. Chevron collapses; Enter on it expands with one new fixture_thread. Tab moves to the next entry's chevron, and Shift expands that entry (p6). Shift+a in a field types \"A\" and nothing expands.",
      "pass": true
    },
    {
      "recipe": "B8 two expanded",
      "observed": "p1 and p3 expanded, fields [\"one\",\"three\"]. Collapsing and re-expanding p1 → still \"one\". Shots b8-dark/light.png",
      "pass": true
    },
    {
      "recipe": "B9 writes in p3",
      "observed": "Preview renders \"three\" (preview_local log, no fixture_preview). `@an` → fixture_people_search {text:\"an\"}, Anna listed; Enter → \"three @anna \". Add comment: one fixture_write {kind:\"comment\"}; p1's buttons disabled while it sends; field cleared. Add review: {kind:\"draft\"}, \"Pending\", \"Submit review 1 pending\". Submit: {kind:\"submit\"}. Resolve: {kind:\"resolve\"}, \"Resolved\", index 40 kept. Escape → focus on p3's \"Hide the thread\", still expanded. Shots b9-*.png",
      "pass": true
    },
    {
      "recipe": "B10 held + Reload",
      "observed": "After collapse p3 stays at idx 40. Reload: one fixture_thread for p1, p3 gone, p1's text kept. But p1 moved from 39 to 40 (see failures). Shot b10-reload-dark.png",
      "pass": false
    },
    {
      "recipe": "B11 Back, count, reopen",
      "observed": "!624 shows \"2 open discussions\" (was 3). Reopening: nothing expanded, no p3, no fixture_discussions; p1's field \"one\".",
      "pass": true
    },
    {
      "recipe": "B12 panel text shared",
      "observed": "!637 box, Shift over d01 → panel; typed \"from the box\"; Escape closes it. In Discussions, expanding d01 shows field \"from the box\".",
      "pass": true
    },
    {
      "recipe": "B light theme",
      "observed": "Light was checked by screenshots only (b5, b6-menu, b8, b9-resolved light); the steps were not repeated in light.",
      "pass": false
    },
    {
      "recipe": "C range window",
      "observed": "56 entries equal MES_ORDER, \"15 of 56 wait for you\". p2 expanded, Add comment → one fixture_write {kind:\"comment\", iid:624, discussion:…018}; field cleared. Back → \"40 of 40 merge requests\". No warn or error. Shot /tmp/mpd-shots/c-range-dark.png",
      "pass": true
    }
  ],
  "environment": "Commit 0015e469. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser on a private display via app-session; window resized with WebDriver setWindowRect; console captured in the page. Sessions stopped."
}
