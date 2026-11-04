# MrThreadsFinal

Agent output (`agent://MrThreadsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsFinal.md), collected 2026-11-04T20:24:03.404Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "A just check → arch-check (earlier recipes passed; web-test 299 files/4476 tests; map-check, golden, sfc-order, hooks-test not reached)",
      "excerpt": "scripts/arch-check.sh\narch-check: yamt-agent depends on yamt-gitio, yamt-pipe and yamt-range (with its yamt-merge-core) only among yamt crates, never on tauri or serde_json, not: serde_json\nerror: recipe `arch-check` failed on line 60 with exit code 1"
    },
    {
      "step": "C5 Anna order differs from mr-review-mode-design.md:218 (report-only per brief)",
      "excerpt": "Seen Anna: \"3 of 8 merge requests\", !97 !96 !92; the doc says !96 !97 !92. !97 box: \"0 of 1 wait for Anna Berg\" (9701 Author's turn). !96 box: \"0 of 2 wait for Anna Berg\" (9602 Author's turn, 9601 Open); the old smoke had \"2 of 2\". Each has 1 thread waiting on the author, so the newer !97 comes first. The doc and mr-review-mode-page.md:264 are out of date."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 Sizes (dark/light)",
      "observed": "Description content width 990: 120 px→120x60; 40 %→396x198; 4000 px→990x495 (natural 48x24); 60 px high→120x60. d01 thread, content width 614: 120→120, 40 %→245.59, 4000→614x307, 60 high→120x60, 160x80, 50 %→307. Light: the same.",
      "pass": true
    },
    {
      "recipe": "B2 words (dark/light)",
      "observed": "!637: 0001,0003,0004,0005 Your turn; 0002 Author's; 0006 Ben Okafor's turn; 0007 Author's; 0008 Anna Berg's turn; 0009 Open; 0010-0013 Author's; \"4 of 13 wait for you\". !636: Your turn, Anna Berg's turn, Waiting for an answer. Ben's review mode (dark): \"Sorted for Ben Okafor's review: due with their turn first, then fewest waiting on the author\".",
      "pass": true
    },
    {
      "recipe": "B3 Shift (dark/light)",
      "observed": "d01 panel at [595,194,1235,962], directly left of box [1235,324,1578,902] (clamped); 0001 marked; fixture_thread logged. d02 switches. Shift+a gives \"A\", no new read. A lone Shift over d03 keeps 0001. Focused 0006 + Shift → 0006. Shift over !639's row → !637 closed, 3900 marked.",
      "pass": true
    },
    {
      "recipe": "B4 Thread",
      "observed": "4 comments + a Pending draft, oldest first; crown \"Author\" only on Dmitri's; tooltip \"02.11.2026, 21:08\"; \"· Edited 1 day ago by Dmitri Volkov\" and \"· Edited 30 minutes ago\"; coloured code (13 spans); a table. Open on GitLab → fixture_page …/637#note_12000; link → docs.example/x. \"Loading…\" observed; each reopen logged a new fixture_thread.",
      "pass": true
    },
    {
      "recipe": "B5 Field (dark)",
      "observed": "Placeholder ok. Line height 20: 2 lines→70px (3 lines), 8→170, 20→250 with scrollHeight 408. \"keep me\" kept after reopening; another discussion's field \"\".",
      "pass": true
    },
    {
      "recipe": "B6 Preview (dark/light)",
      "observed": "Bold \"Hi\", a link to @anna, fixture_preview {iid:637}. Write: text and caret 12 kept. Empty → \"Nothing to preview.\", no fixture_preview. fail → \"Could not preview: glab timed out\", text kept.",
      "pass": true
    },
    {
      "recipe": "B7 Sends (dark/light)",
      "observed": "comment/draft/Ctrl+Enter writes logged; field cleared; row Author's turn; \"Pending Later\" last; \"Submit review3 pending\"; disabled while empty and sending. refuse → \"Could not add the comment: 403 Forbidden\", text kept. !636: buttons disabled with the locked reason, \"You may not resolve this thread.\", Ctrl+Enter no write. Escape → focus on the row.",
      "pass": true
    },
    {
      "recipe": "B8 Submit (dark/light)",
      "observed": "Tooltip \"Publish your 3 pending comments on this merge request\"; fixture_write submit; fixture_discussions {iids:\"637\"}; no Submit; drafts now comments; focus in the panel.",
      "pass": true
    },
    {
      "recipe": "B9 Resolve (dark/light)",
      "observed": "\"2 of 12 wait for you\", row Resolved muted with an svg, count 13; Unresolve → \"2 of 13\"; resolve + close → \"12 open discussions\"; reopen without 0002.",
      "pass": true
    },
    {
      "recipe": "B10 What stays open (dark/light)",
      "observed": "Pointer away and a link click: both stay. Escape → panel closes, focus on the row; Escape → box closes. Close keeps the box; a press on the list closes both. Refresh: both stay, thread read again; Escape then closes the panel, the page stays. Retry (d13) then Escape: the same. Leave/return: no box, no 0002 (count 13, accepted). Description via Tab+Enter, Escape → panel stays. Question \"Close Compare 1? Its text is lost.\" → Escape: question gone, panel stays; next Escape closes the panel.",
      "pass": true
    },
    {
      "recipe": "B11 Reload discussions (dark/light)",
      "observed": "Spinner seen and 12 rows kept; only fixture_discussions {iids:\"637\"}; discussions_reloaded {iid:637}; one fixture_thread with d01 open.",
      "pass": true
    },
    {
      "recipe": "B12 Off/Load lazily (dark/light)",
      "observed": "Off: count is a SPAN, Shift opens no box or panel. Lazily: hover → fixture_discussions 637, 12 rows, Shift → panel.",
      "pass": true
    },
    {
      "recipe": "B13 shots",
      "observed": ".omp/run/shots/mtv-final-dark-panel.png, mtv-final-dark-desc.png, mtv-final-light-panel.png, mtv-final-light-desc.png",
      "pass": true
    },
    {
      "recipe": "C1 real app words",
      "observed": "!90: 0005,0004,0003,0001 Your turn; 0013-0010 Author's; 0009 Open; 0008 Anna Berg's; 0007 Author's; 0006 Ben Okafor's; 0002 Author's; \"4 of 13 wait for you\". !91: Your turn, Waiting for an answer, Anna Berg's turn.",
      "pass": true
    },
    {
      "recipe": "C2 real app d01",
      "observed": "4 comments with edits (\"· Edited 3 days ago by Dmitri Volkov\"), \"Pending I'll take the second option.\", \"Submit review2 pending\".",
      "pass": true
    },
    {
      "recipe": "C3 posts + glab log",
      "observed": "posts 1→5, each with its after-post thread. calls.log: 61/64 POST …/90/discussions/<d01>/notes {\"body\":\"Thanks\"}; 83/86 POST …/draft_notes {\"in_reply_to_discussion_id\":\"<d01>\",\"note\":\"Later\"}; 105/108 PUT …/discussions/<d01> {\"resolved\":true}; 127/130 false; 149/152 POST …/draft_notes/bulk_publish {}; 180/183 POST markdown. No other lines. posts 5.",
      "pass": true
    },
    {
      "recipe": "C4 Rust log",
      "observed": "\"read a discussion's thread iid=90 outcome=\\\"read\\\" comments=4 drafts=1 pending=2\"; write lines kind=comment/draft/resolve/unresolve/submit outcome=\"sent\" status 201/201/200/200/204; no text.",
      "pass": true
    },
    {
      "recipe": "C5 review mode",
      "observed": "Me: !94 !91 !96 !93 (matches the doc), \"Sorted for your review: …\". Anna: !97 !96 !92 (doc: !96 !97 !92; see failures).",
      "pass": true
    },
    {
      "recipe": "C6 shots",
      "observed": ".omp/run/shots/mtv-final-app-dark.png, .omp/run/shots/mtv-final-app-light.png",
      "pass": true
    }
  ],
  "environment": "HEAD b1e032c4; rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser on a private display; app debug build on Xvfb. start-fixture rejects --settings (\"unknown option --settings\"), so I used Settings → Light. B5 and Ben's tooltip ran in dark only. No rowColours flake seen. All sessions stopped."
}
