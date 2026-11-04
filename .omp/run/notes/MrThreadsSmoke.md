# MrThreadsSmoke

Agent output (`agent://MrThreadsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsSmoke.md), collected 2026-11-04T16:38:02.497Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "Focus falls to BODY after Resolve/Unresolve/Submit; next Escape leaves the merge-request page",
      "excerpt": "Fixture, dark, after 'Resolve thread' on d02: {\"active\":\"BODY \"}; press Escape → {\"box\":false,\"mrVisible\":false,\"panel\":false} (page left). Same after 'Submit review' (dark and light): {\"a\":\"BODY \",\"submit\":false} then Escape → page left. Real app after Resolve: {\"a\":\"BODY\"}. Two Escapes sent quickly from inside the reply field (one press call) also left the page and dropped the field's text. Sent separately, they work: panel closes with focus on row …0001, then the box closes with focus on '13 open discussions'."
    },
    {
      "step": "C10 count when the box closes by leaving the page",
      "excerpt": "After Resolve d02 → Escape left the page → came back via 'Merge requests': opener still \"13 open discussions\"; the box opened again still listing d02 as 'Resolved', n:13, header '2 of 12 wait for you'. When the box closes properly (Escape from a focused row, or a press on the list), the count drops: '12 open discussions', and on reopen n:12 with no d02 (dark, and light on a fresh session)."
    },
    {
      "step": "B3 C1 tops aligned (fixture 1600x1000)",
      "excerpt": "Panel h-[min(48rem,calc(100vh-2rem))] = 768, innerHeight 962. The !637 box sits at 1235,324,1578,902 and the panel at 595,194,1235,962: clamped up, tops not level. !639's box at top 219 against the panel at 194: also clamped. No row's box can fit at this size; --size 1600x1250 left innerHeight at 962. Real app (innerHeight 1000): box 1235,219 and panel 595,219, so tops are level where the panel fits."
    },
    {
      "step": "B10 C2 list Refresh with the panel open",
      "excerpt": "Clicking the header 'Refresh' with the d14 panel open gave {\"box\":false,\"panel\":false}: both closed, as a press outside. The log has fixture_discussions for all iids and no fixture_thread. The brief expects both to stay and the thread to be read again."
    },
    {
      "step": "B2 review mode as Ben Okafor: d06 unreachable",
      "excerpt": "Review mode → Ben Okafor: '6 of 40 merge requests', !637 not in the list, so d06 could not be checked. Tooltip seen: 'Sorted for Ben Okafor's review: due with their turn first, then fewest waiting on the author'."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 A Sizes, dark+light",
      "observed": "!640: '120 px wide 120.0x60.0', '40 % wide 396.0x198.0', '4000 px wide 990.0x495.0', '60 px high 120.0x60.0', column 990, the same in light. d01: 120→w120 h60, 40%→w246 of ~614, 4000→w614 h307, 60 px high→w120 h60. Shots: /tmp/mtv-scratch/shots/B-dark-description-640-images.png, B-light-description-640-images.png",
      "pass": true
    },
    {
      "recipe": "B2 words",
      "observed": "!637: 01,03,04,05 Your turn first; 02 Author's; 06 Ben Okafor's turn; 07 Author's; 08 Anna Berg's turn; 09 Open; 10-13 Author's; '4 of 13 wait for you' (dark and light). !636: 16 Your turn, 14 Anna Berg's turn, 15 Waiting for an answer. Review-mode d06 unreachable.",
      "pass": true
    },
    {
      "recipe": "B3 C1 Shift",
      "observed": "d01 panel right 1235 = box left 1235; aria-current ['01']; Shift on d02 switches ('Thread: Overview'); Shift+a in the field → 'A', no fixture_thread; focused d05 + Shift → fixture_thread …05. Tops not level (194 vs 324).",
      "pass": false
    },
    {
      "recipe": "B4 C3-C5 thread d01",
      "observed": "4 comments oldest first; '· Edited 1 day ago by Dmitri Volkov' on Sam Weller, '· Edited 31 minutes ago' on Anna Berg; crown only on Dmitri Volkov; hover '02.11.2026, 17:22'; code colours, table, images; link → fixture_page docs.example/x; Open on GitLab → '…/637#note_12000'. 'Loading…' not caught (read came after the answer).",
      "pass": true
    },
    {
      "recipe": "B5 C6 field",
      "observed": "Heights: 2 lines → 68 px (3 lines); 8 → 168; 20 → 248 (12 lines), scrolled. Text 'keep me' kept across closing the box; d03's field empty.",
      "pass": true
    },
    {
      "recipe": "B6 C7 preview",
      "observed": "Loading… true → <strong>Hi</strong> and a link to @anna; fixture_preview {iid: 637}. Write: same text, caret 4. Empty field: 'Nothing to preview.', no log line. 'fail this': 'Could not preview: glab timed out', text kept.",
      "pass": true
    },
    {
      "recipe": "B7 C8 sends + Escape in field",
      "observed": "Thanks → fixture_write comment, field cleared, row 'Author's turn'; Ctrl+Enter writes once; Later → draft 'Pending', '3 pending'; buttons disabled while empty and while sending; refuse → 'Could not add the comment: 403 Forbidden'; !636 locked texts and 'You may not resolve this thread.'; Ctrl+Enter there: no write. Escape in field → panel closed, focus on its row. After a send, focus is on the panel div.",
      "pass": true
    },
    {
      "recipe": "B8 C9 submit",
      "observed": "Tooltip 'Publish your 3 pending comments on this merge request'; fixture_write submit; one fixture_discussions {iids: \"637\"}; drafts became comments; no Submit left. Focus goes to BODY, and Escape leaves the page.",
      "pass": false
    },
    {
      "recipe": "B9 C10 resolve",
      "observed": "Resolve → Unresolve; row 'Resolved', muted rgb(129,126,141); header '2 of 12'; opener 13. Unresolve → open again. Resolved again and closed properly → '12 open discussions', reopen: d02 gone (dark and light). Escape right after Resolve leaves the page.",
      "pass": false
    },
    {
      "recipe": "B10 C2 what stays open",
      "observed": "Pointer far: both stay. Link click: both stay. Escape → panel, focus on its row; Escape → box. Close → panel only. Press on the list → both close. Header Refresh → both close (brief: both stay).",
      "pass": false
    },
    {
      "recipe": "B11 D refresh",
      "observed": "Rows stay 12; log: fixture_discussions {iids: \"637\"}, fixture_thread …01, discussions_reloaded {iid: 637}. Turning icon not observed.",
      "pass": true
    },
    {
      "recipe": "B12 C11 off",
      "observed": "Off: 0 openers, no box, no panel. Load lazily: box (12 rows) and panel open.",
      "pass": true
    },
    {
      "recipe": "B13 shots",
      "observed": "/tmp/mtv-scratch/shots/B-dark-box-d01.png, B-light-box-d01.png, B-dark-description-640.png. The 'Shift: show the thread' tip covers the box header.",
      "pass": true
    },
    {
      "recipe": "C1 real app words",
      "observed": "!90 d-numbers match B2: 001,003,004,005 Your turn; 006 Ben Okafor's turn; 008 Anna Berg's turn; 009 Open; others Author's; '4 of 13 wait for you'. !91: Your turn / Waiting for an answer / Anna Berg's turn. Tops level: box 1235,219 and panel 595,219.",
      "pass": true
    },
    {
      "recipe": "C2 real app d01",
      "observed": "4 comments with the edits ('Edited 1 day ago'; 'Edited 3 days ago by Dmitri Volkov'), 'Pending / I'll take the second option.', '2 pending'.",
      "pass": true
    },
    {
      "recipe": "C3 fake glab log",
      "observed": "POST …/90/discussions/0…01/notes stdin {\"body\":\"Thanks\"}; POST …/90/draft_notes {\"in_reply_to_discussion_id\":\"0…01\",\"note\":\"Later\"}; PUT …/discussions/0…01 {\"resolved\":true}; same with false; POST markdown (preview, posts stayed 4); POST …/draft_notes/bulk_publish {}. No other --method lines; posts=5.",
      "pass": true
    },
    {
      "recipe": "C4 Rust log",
      "observed": "discussion_thread::write iid=90 kind=comment/draft/resolve/unresolve/submit outcome=\"sent\" status 201/201/200/200/204; read: comments=4 drafts=1 pending=2 … then comments=7 pending=0. No text in any line.",
      "pass": true
    },
    {
      "recipe": "C5 shots",
      "observed": "/tmp/mtv-scratch/shots/C-dark-box-d01.png, /tmp/mtv-scratch/shots/C-light-box-d01.png",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; HEAD 502225d8; MiniBrowser fixture via app-session (private display); app built by cargo tauri build --debug --no-bundle; start-fixture rejects --settings ('unknown option'), so light was set in Settings → yamt Light. All sessions stopped."
}
