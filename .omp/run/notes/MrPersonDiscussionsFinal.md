# MrPersonDiscussionsFinal

Agent output (`agent://MrPersonDiscussionsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsFinal.md), collected 2026-11-05T15:55:03.095Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "B5 (dark and light): p6 '+N' at the left; narrow to 900 px: N grows",
      "excerpt": "At 1600 and at 900 px p6 (!609, discussion 22) shows all 13 later writers and no '+N'. Writers row text: 1600 → \"CR DV AB BO DV CR AB BO DV BO CR Ben Okafor's turn\"; 900 (innerWidth 900, article width 645) → the same string. The fold appears only once the row is narrower: at 600 px → \"+7 AB BO DV BO CR Ben Okafor's turn\" (same in dark and light). So the brief's 1600/900 '+N' expectation is not met with this fixture (13 writers fit in the row at 900 px). Either the fixture needs more writers or the brief's widths are wrong. That is for the owning slice or the brief to decide."
    }
  ],
  "smoke": [
    {
      "recipe": "A `just check` (abf00c64)",
      "observed": "Exit 0, wall 74 s; fences.test.ts did not fail, so no rerun. web-test: 'Test Files 310 passed (310) Tests 4655 passed (4655)'; 'arch-check: ok'; 'map-check: ok'; golden: ok for all 10 cases; hooks-test: 'tests 18 pass 18 fail 0'.",
      "pass": true
    },
    {
      "recipe": "B1 Settings Load lazily + search/filter + scroll (dark, light)",
      "observed": "Load lazily aria-pressed=true. Search 'board' + Reviewer: Me → iids [638,618,608]. Cleared, 1600x500: list UL scrollHeight 2099 / clientHeight 328, scrolled to scrollTop 886. Same in light.",
      "pass": true
    },
    {
      "recipe": "B2 Discussions button, count-up, one call at a time (dark, light)",
      "observed": "Tooltip 'Every open discussion, for one person'. Filter row kept. Headers: 'Loading discussions — 3 of 29 merge requests' → '13 of 29' → '23 of 29' → '15 of 56 wait for you'. Entries grew 5→31→48→56. The calls ran in sequence, each with every unread row: 26, 16, 6 iids (answered 10, 10, 6). Light: 0 → 10 → 20 of 29, then '15 of 56'.",
      "pass": true
    },
    {
      "recipe": "B3 Back to list (dark, light)",
      "observed": "Back → search 'board', iids [638,618,608], 'Reviewer: Me'. Second Back → scrollTop 886 (dark and light). Back during the load: one fixture_discussions with 29 iids (answered: 10), then no further call 3 s later (dark and light).",
      "pass": true
    },
    {
      "recipe": "B4 C2 Me's order, failures, Retry !615 (dark, light)",
      "observed": "The 56 entries equal MES_ORDER exactly. Header '15 of 56 wait for you'; the first 15 read 'Your turn'. Alerts: '!629 … glab is not logged in: gitlab.example: No token found (…) — run glab auth login in a terminal, then Refresh.' and '!615 … glab failed: glab timed out', each with Retry. Retry !615 → one `fixture_discussions {iids: \"615\"}`.",
      "pass": true
    },
    {
      "recipe": "B5 D1–D4 p1 entry on !624 (dark, light)",
      "observed": "Anna Berg; '2 days ago' muted (hover '03.11.2026, 16:35'); '!624 Speed up the board query' muted; 'Overview'. Body: STRONG, CODE, A, IMG 160px; box 80 px tall. Writers Ben@290, Chiara@314, Dmitri@338, each tooltip naming its writer. Turn: 'Ben Okafor's turn'. A one-comment discussion has 0 pictures. p6 '+N' failed: see failures.",
      "pass": false
    },
    {
      "recipe": "B6 Whose discussions menu, Anna (dark, light)",
      "observed": "Menu: Me (checked), Anna Berg, Ben Okafor, Chiara Rossi, Dmitri Volkov, each with a picture; no input. Picking Anna: the order equals ANNAS_ORDER; header '13 of 56 wait for Anna Berg'; the first 13 read 'Anna Berg's turn'. First Escape closes the menu only; second Escape: the page stays.",
      "pass": true
    },
    {
      "recipe": "B7 E1–E2 expanding p2 (dark, light)",
      "observed": "Pointer + Shift → 'Loading…', then the thread; 1 fixture_thread. Shift again → still expanded, still 1. Chevron → collapsed; Enter → expanded, a 2nd fixture_thread. Tab focus + Shift → expanded. Shift+a in the reply field → value 'A', no other entry expanded.",
      "pass": true
    },
    {
      "recipe": "B8 E4 two at once (dark, light)",
      "observed": "p1 and p3 both expanded; p1 field 'one', p3 field 'three'. Collapsed and re-expanded p1 → 'one'. Shots /tmp/vf-mpd/b8-dark.png, b8-light.png.",
      "pass": true
    },
    {
      "recipe": "B9 E3 writes in p3 (dark, light)",
      "observed": "Preview → preview_local (blocks: 1); Write → 'three'. '@an' → option 'Anna Berg @anna'; Enter → 'three @anna '. Add comment → one {kind: comment}, the thread re-read, the field cleared. p1's buttons were disabled while sending ('000'→'111'). Add review → one {kind: draft}, 'Pending', 'Submit review 1 pending'. Submit → one {kind: submit}. Resolve → one {kind: resolve}, 'Resolved', index 40 kept. Escape → focus on p3's chevron, still expanded.",
      "pass": true
    },
    {
      "recipe": "B10 C3 held through Reload (dark, light)",
      "observed": "p3 kept index 40 after the writes and after collapsing. Reload → fixture_discussions with all 29 listed iids, then continuation calls (19, then 9 iids, 10 rows per call), and one fixture_thread for p1 (…17). Afterwards p1 is still at index 39 and expanded, p3 is gone, and the header reads '15 of 55 wait for you'.",
      "pass": true
    },
    {
      "recipe": "B11 Back, count, Discussions again (dark, light)",
      "observed": "The !624 row reads '2 open discussions' (the fixture has 3, p1–p3). Discussions again → 0 expanded, no p3; expanding p1 → its field reads 'one'.",
      "pass": true
    },
    {
      "recipe": "B12 panel text shared with the box (dark, light)",
      "observed": "In the !637 box, Shift over d01 → the panel; typed 'from the box'; Escape → the panel closed. Discussions → expanded d01 → its field reads 'from the box'.",
      "pass": true
    },
    {
      "recipe": "Expanded head wraps at 700/560 px (dark, light)",
      "observed": "d01 header at 700 px: 290–683, 73 px tall, no overflow (scrollWidth==clientWidth). At 560 px: 290–543, 97 px tall, wraps onto 4 lines, no overflow. Shots /tmp/vf-mpd/wrap-{700,560}-{dark,light}.png. Unrelated: at 560 the top Refresh button is clipped.",
      "pass": true
    },
    {
      "recipe": "One TURN_MARK, box look unchanged (dark, light)",
      "observed": "The person view's 'Your turn', the box line and the box opener all use font-semibold text-primary at weight 600; colour rgb(119,76,213) in dark and rgb(56,113,225) in light. Shots /tmp/vf-mpd/box-dark.png, box-light.png.",
      "pass": true
    },
    {
      "recipe": "'99+' chip",
      "observed": "Not observable: no fixture discussion has more than 99 later writers (the largest, p6, has 13). Code has COUNTED_MAX = 99 → '99+'. Not exercised on screen.",
      "pass": false
    },
    {
      "recipe": "B13 screenshots",
      "observed": "/tmp/vf-mpd/b5-dark.png, b6-dark.png, b8-dark.png, b9-dark.png, b5-light.png, b6-light.png, b8-light.png, b9-light.png (page source).",
      "pass": true
    },
    {
      "recipe": "C range window (A2), dark",
      "observed": "Discussions → 56 entries equal to MES_ORDER, '15 of 56 wait for you'. Expanded p2, Add comment → one `fixture_write {kind: \"comment\", iid: 624}`, the thread re-read (3 comments). Back → '40 of 40 merge requests'. Shot /tmp/vf-mpd/c-dark.png.",
      "pass": true
    },
    {
      "recipe": "D1 build + repo",
      "observed": "local-conflicts-repo.sh /tmp/vf-mpd/mpd → 'is on develop; GitLab holds the head refs of !41–!48'. cargo tauri build --debug --no-bundle → 'Built application at: …/target/debug/yamt'.",
      "pass": true
    },
    {
      "recipe": "D2.1 view, formatted first comments, no new query",
      "observed": "'5 of 16 wait for you'; !90 and !91 entries shown. d01's first comment has STRONG, CODE, A, PRE, TABLE. After Discussions the only new line was 'argv: api https://gitlab.com/uploads/-/system/user/avatar/4/avatar.png': no discussions query.",
      "pass": true
    },
    {
      "recipe": "D2.2 expand d01",
      "observed": "'argv: api graphql -f query=query MergeRequestDiscussions(… -F iids=[\"90\"] -F first=1' + 'argv: api --paginate projects/taskboard%2Ftaskboard/merge_requests/90/draft_notes' (+ the upload shot.png). Collapse + expand → exactly one more of each.",
      "pass": true
    },
    {
      "recipe": "D2.3 writes",
      "observed": "'argv: api --include --method POST …/90/discussions/…0001/notes' {\"body\":\"verify\"} ×1; '--method PUT …/90/discussions/…0002' {\"resolved\":true} ×1; 'POST …/90/draft_notes' ×1; 'POST …/90/draft_notes/bulk_publish' ×1. Each write was followed by re-reads. After the PUT the screen showed d01 'Resolved' [INFERENCE: fake canned answer].",
      "pass": true
    },
    {
      "recipe": "D2.4 link opens, picture shows",
      "observed": "Clicking 'the docs' → opened.log 'argv: https://docs.example/board'. The upload yamt-picture://localhost/upload~903a… loaded (natural 32x32, shown 761x761). Shots /tmp/vf-mpd/d-dark.png, d-light.png. Session stopped.",
      "pass": true
    },
    {
      "recipe": "Owner check text",
      "observed": "Unchanged as written in the brief (4 steps, samubr/glab-yamt-playground); handed on, not run.",
      "pass": true
    }
  ],
  "environment": "linux 7.2.11-arch1-1 x64; rustc 1.99.0; node v26.13.0; pnpm 12.0.0; MiniBrowser /usr/lib/webkitgtk-6.0/MiniBrowser + WebKitWebDriver on xvfb; real app target/debug/yamt via tauri-driver on private display :3; tree abf00c64. Console lines were captured with an in-page console wrapper (no repo change)."
}
