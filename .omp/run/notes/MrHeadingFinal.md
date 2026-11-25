# MrHeadingFinal

Agent output (`agent://MrHeadingFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingFinal.md), collected 2026-11-25T10:22:29.215Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check (run once, HEAD 1f4dc93e)",
      "observed": "EXIT=0, wall 73.97 s. Log: /tmp/yamt-mh/verify-final-check.log. Lines from the log: 'Summary [  14.446s] 1588 tests run: 1588 passed, 65 skipped'; 'Test Files  316 passed (316)' / 'Tests  4790 passed (4790)'; 'arch-check: ok'; 'map-check: ok'; hooks-test 'ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "B1 review --heading mergeRequest 1280x800, dark",
      "observed": "The line at y=5 is above the h3 at y=91. !12 is muted rgb(129,126,141); the title w600. CODE 'feature' and CODE 'main' carry the chip classes 'rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code', colour rgb(196,194,206) on rgb(33,31,39). +64 rgb(120,191,123) and −67 rgb(246,107,113), the same as the file rows. jq totals 64/67; sums 64/67. /[·|•-]/ false. h3 'main where feature branched off 531ea52' (bold/muted/mono) and 'feature 9c1ba3f', commit subjects as titles. Button right edges ≤ 1267 (width 1280). B1-dark.png",
      "pass": true
    },
    {
      "recipe": "B1 light + rule 4 + Settings",
      "observed": "Light: chips rgb(8,8,8) on rgb(247,248,249); +64 rgb(32,138,60) and −67 rgb(229,82,48), the same as the rows. Opening 3 files, then Reviewed, then searching 'reminder': the line stayed '!12Reminders before a card is duefeature→main+64−67'. Settings: no line, 0 rows, search hidden (B1-settings-light.png). Back: the same line, 13 rows, query 'reminder'.",
      "pass": true
    },
    {
      "recipe": "B2 fork / hiddenFork at 1280x800 and 900x600, dark+light",
      "observed": "Chips 'sam:feature/reminders-grouped-by-due-day' (scrollWidth 324 > clientWidth 254) and '(fork) feature/…' (347 > 254) truncate, with the full name as title. The title truncates (750 > 585 at 1280, > 205 at 900). Totals right edge 1263 / 883; header buttons max 1267 / 887. B2-*-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B3 --heading unnamed",
      "observed": "line ['!12','9c1ba3f','→','531ea52','+64','−67']; h3 ['531ea52','9c1ba3f']; hex40 false. B3-unnamed-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B4 no --heading",
      "observed": "line ['main','...','feature','+64','−67'], no '!'; h3 as in B1; hex40 false. The pane titles were not re-read in B4. In B1 they read 'main, where feature branched off (531ea52)' and 'feature (9c1ba3f)'. B4-plain-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "B5 --range-case empty",
      "observed": "line ['feature','..','feature','+0','−0'] above 'feature (9c1ba3f) and feature (9c1ba3f) have the same files.'; hex40 false. B5-empty-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "C setup + C1 mh-page --range main...feature --mr",
      "observed": "Refs: feature 9c1ba3fc…, main 437805506e…; status is empty. yamt-cli totals 64/67, sums 64/67. _NET_WM_NAME \"main...feature  +64 −67 — repo — yamt\"; od shows two spaces before '+64', 342 210 222 (−) and 342 200 224 (—). MR page: line false, 0 rows. C1-page-dark.png",
      "pass": true
    },
    {
      "recipe": "C2 Show Diff !12 / !13",
      "observed": "!12: '!12 is already open in another yamt window.' !13 (pid 874465): \"!13 Snooze a reminder  snooze → main  +69 −67 — repo — yamt\"; od shows two spaces before 'snooze' and before '+69'. cli totals 69/67, sums 69/67. Log: 'starting a second window … \"--review-of=taskboard/taskboard!13\", \"--mr-title=Snooze a reminder\", \"--mr-source=snooze\", \"--mr-target=main\"'. kill -TERM returned 0; log: 'ended status=signal: 15 (SIGTERM)'.",
      "pass": true
    },
    {
      "recipe": "C2 shot --display (C7)",
      "observed": "C2-display-dark.png shows '!13 Snooze a reminder' and the headers 'main where snooze branched off 531ea52' / 'snooze 6ea97d8'. With no WM the window is wider than 1280, so the chips and totals are off-screen; C3 read them. There is no light display shot; C3/C4 have light shots.",
      "pass": true
    },
    {
      "recipe": "C3 mh-child --review-of + --mr-title/--mr-source/--mr-target (full)",
      "observed": "Started OK; same title as C2, od identical. Dark: chips snooze/main rgb(196,194,206) on rgb(33,31,39); +69 green, −67 red. Light: chips rgb(8,8,8) on rgb(247,248,249). h3: main bold + 'where snooze branched off ' + 531ea52 mono; snooze bold + 6ea97d8 mono; hex40 false. Queued 'check' on right line 1 of docs/current.md: 'Send to GitLab (1)', title 'Send the 1 queued comment to your pending review on !13', no line-up notice. Not sent. C3-*.png",
      "pass": true
    },
    {
      "recipe": "C4 mh-old --review-of only",
      "observed": "\"!13  531ea52..6ea97d8  +69 −67 — repo — yamt\" (od: two spaces before 531ea52 and before +69). line ['!13','6ea97d8','→','531ea52','+69','−67']; h3 ['531ea52','6ea97d8']; hex40 false. C4-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "C5 refusals",
      "observed": "'yamt: give --mr-title, --mr-source and --mr-target together, each once', exit=2. With all three: 'yamt: --mr-title, --mr-source and --mr-target go with --review-of=<project>!<iid>', exit=2",
      "pass": true
    },
    {
      "recipe": "C6 repository untouched",
      "observed": "'refs-same', 'status-same'",
      "pass": true
    },
    {
      "recipe": "E1 range --mr list 1280x450 (brief)",
      "observed": "Before: tree, scrollTop 137, column 238, query 'reminder', line on. In Settings and in Merge requests (with Ctrl+B pressed there): all hidden. Back: scrollTop 137, column 238, query kept, line on. E1-*.png",
      "pass": true
    },
    {
      "recipe": "E2 Ctrl+B, Settings, back",
      "observed": "Ctrl+B hid the list (rows 0). After Settings and Back: rows 0, query 'reminder'. With focus in the search input, Ctrl+B did nothing. E2-restored-{dark,light}.png",
      "pass": true
    },
    {
      "recipe": "E3 compare --diff --mr list (brief)",
      "observed": "In Settings and Merge requests: 0 Close buttons. Back: 1, 'Compare 1' selected. The 31-tab scroll was not re-checked; Ctrl+T made no tabs. E3-*.png",
      "pass": true
    },
    {
      "recipe": "E4 merge mh-sm (brief)",
      "observed": "12 rows, selected language-tools-script-setup.ts. Settings: 0 rows (Settings only). Back: 12 rows, same selection, separators 245/566/919, dark and light. The fixture has no server log screen. E4-*.png",
      "pass": true
    }
  ],
  "environment": "HEAD 1f4dc93e (dirty only .omp/run/slices.json, docs/slices/SLICES.md). rustc 1.99.0, node v26.13.1, pnpm 12.0.0. tauri debug build + yamt-cli: exit 0. Xvfb :3, no WM; windows found by ctypes XQueryTree + xprop/od. MiniBrowser via app-session. All sessions stopped. Shots /tmp/yamt-mh/verify/final/."
}
