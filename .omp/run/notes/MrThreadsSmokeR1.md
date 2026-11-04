# MrThreadsSmokeR1

Agent output (`agent://MrThreadsSmokeR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsSmokeR1.md), collected 2026-11-04T17:05:39.824Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "Extra: Retry after a failed thread read, then Escape (real app, !90 d03)",
      "excerpt": "Panel alert: \"glab is not logged in: fake glab: no scenario folder …/glab/scenario — run glab auth login in a terminal, then Retry.Retry\". After the link was restored, Retry loaded the thread: arts=2, dlg [\"Thread: Overview [595,219,1235,987]\"], cur [\"0003\"], act \"BODY|\". Escape: h2=Tabs,Left,Right, dlg [], box null, mr false. Focus fell to BODY, and Escape left the page while the panel was open. The failure was induced by repointing the session's scratch glab/scenario link; no fixture makes a thread read fail."
    },
    {
      "step": "Extra: focus on the page's Refresh with the panel open, then Escape (WebKit dark and light)",
      "excerpt": "dark: after Refresh, dlg [\"Thread: src/board.ts:12 …\"], act BUTTON \"Refresh\" (data-refreshes-list). Escape: h2=Tabs,Left,Right, dlg [], box null, act BODY, mr false. light: the same, Escape → mr false. The page left with the panel open."
    },
    {
      "step": "B10 C2 coming back after leaving with the panel open: count dropped",
      "excerpt": "dark: before leaving, \"12 open discussions\". On return: no box (box null, dlg []), rows 03,04,01,05…13 (d02 gone), but the count button reads \"13 open discussions\". light: the same, the count is 13 and there is no 02. Cause per the note's open risk: the fixture list's fixed OPEN_DISCUSSIONS."
    },
    {
      "step": "B3 C1 #2385 as written (hover !636's count with !637's panel open)",
      "excerpt": "hover \"3 open discussions\" → (1251,365), inside !637's pinned box [1235,324,1578,902]. !636's box never opened, so the step can't run as written at 1600x1000. I ran it with !639 (\"1 open discussion\" nth 0), and it passed."
    }
  ],
  "smoke": [
    {
      "recipe": "B3 C1 Shift — WebKit dark",
      "observed": "d01: dlg \"Thread: src/board.ts:12 [595,194,1235,962]\", box [1235,324,1578,902], cur 0001, fixture_thread {iid: 637, …0001}, thread_read comments: 4. d02 switches (cur 0002). Shift+a → field \"A\". Lone Shift over d03 left cur 0002, no new read. Escape → focus row 0002. Focused d06 + Shift (pointer on h2) → cur 0006. !639 row Shift → ex [\"1 open discussion\"], cur 3900, !637 closed.",
      "pass": true
    },
    {
      "recipe": "B3 C1 Shift — WebKit light (Settings → Light, data-theme=light)",
      "observed": "Same rects and cur values as dark. Field A, thr=2 after the lone Shift. Escape → BUTTON|0002. Focused d06 → cur 0006. !639 Shift → !637 closed, cur 3900.",
      "pass": true
    },
    {
      "recipe": "B7 C8 Sends — dark",
      "observed": "Thanks → fixture_write {kind: \"comment\", iid: 637}, field \"\", Thanks after the 4 comments, row01 \"Author's turn\", act TEXTAREA. Later → draft, \"PendingLater\", \"Submit review3 pending\". Add buttons disabled while sending and while empty. Ctrl+Enter → comment. \"refuse it\" → \"Could not add the comment: 403 Forbidden\", text kept. Escape → row 0001. !636 d14: Adds disabled with the locked tip, Resolve \"You may not resolve this thread.\", Ctrl+Enter no write (4), Escape → row 0014.",
      "pass": true
    },
    {
      "recipe": "B7 C8 Sends — light",
      "observed": "Same as dark. Writes comment,draft,comment,comment; the 403 alert; field kept; Escape → BUTTON|0001. !636 tips the same, writes stayed 4, Escape → BUTTON|0014.",
      "pass": true
    },
    {
      "recipe": "B8 C9 Submit — dark",
      "observed": "Tooltip \"Publish your 3 pending comments on this merge request\". fixture_write {kind: \"submit\", iid: 637}, then fixture_discussions {iids: \"637\"}. No Submit, 0 Pending, the drafts now Sam Weller comments. act DIV|Thread. Escape → row 0001, page stays.",
      "pass": true
    },
    {
      "recipe": "B8 C9 Submit — light",
      "observed": "Same tooltip, submit write, then the 637 reload. pending 0, act DIV|Thread. Escape → BUTTON|0001.",
      "pass": true
    },
    {
      "recipe": "B9 C10 Resolve — dark",
      "observed": "Resolve d02: \"2 of 12 wait for you\", opener 13, row \"Resolved\" muted with an svg, \"Unresolve thread\", act TEXTAREA. Unresolve: \"2 of 13\", Author's turn. Resolve + Escape: dlg 0, focus 0002. Escape: \"12 open discussions\". Reopen: no 02.",
      "pass": true
    },
    {
      "recipe": "B9 C10 Resolve — light",
      "observed": "Identical words and counts. After Escape focus BUTTON|0002. The count reads 12, reopen 03,04,05,01,06…13 (no 02).",
      "pass": true
    },
    {
      "recipe": "B10 C2 What stays open — dark",
      "observed": "Pointer away: both stay. Link: fixture_page docs.example/x, both stay. Escape → panel off, focus 0001. Escape → box off. Close → box stays. Refresh with the panel open: both stay, fixture_thread 20→21. A press on the h2 closes both. Sends keep focus (B7–B9). Escape on Refresh leaves the page, and on return the count is not dropped (failures).",
      "pass": false
    },
    {
      "recipe": "B10 C2 What stays open — light",
      "observed": "Same as dark: stays on pointer away and on a link click, Escape order, Close, Refresh (thr 18→19, disc 4→7), the press closes both. Escape on Refresh left the page. On return: no box, no 02, count 13.",
      "pass": false
    },
    {
      "recipe": "C3 real app (start-app --name mta --diff --dir <scratch>/mtv --glab mr-threads --mr)",
      "observed": "d01: 4 comments, \"I'll take the second option.\" Pending, \"Submit review2 pending\". Each post showed its after-post answer. calls.log: 61/64 POST …/90/discussions/<d01>/notes {\"body\":\"Thanks\"}; 83/86 POST …/90/draft_notes {\"in_reply_to_discussion_id\":\"<d01>\",\"note\":\"Later\"}; 105/108 PUT …/discussions/<d01> {\"resolved\":true}; 127/130 the same, false; 149/152 POST …/draft_notes/bulk_publish {}; 180/183 POST markdown (Preview). No other lines. posts: 5.",
      "pass": true
    },
    {
      "recipe": "Extra: Retry then Escape (real app)",
      "observed": "Focus BODY after Retry; Escape left the page (failures).",
      "pass": false
    },
    {
      "recipe": "Extra: Refresh focus then Escape (WebKit dark and light)",
      "observed": "Escape left the page in both themes (failures).",
      "pass": false
    },
    {
      "recipe": "shots",
      "observed": ".omp/run/shots/mtv-r1-repass-dark.png, .omp/run/shots/mtv-r1-repass-light.png (page shots, d01 panel open)",
      "pass": true
    }
  ],
  "environment": "HEAD b98eda28. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser /usr/lib/webkitgtk-6.0/MiniBrowser, private display. start-fixture rejects --settings (\"unknown option --settings\"), so light was set via Settings → Light. Real app: cargo tauri build --debug --no-bundle. Logs from an in-page console wrapper. Sessions stopped."
}
