# RangeReviewedFinal

Agent output (`agent://RangeReviewedFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedFinal.md), collected 2026-11-19T10:42:34.771Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "C1–C5/C8 exit status on app-session stop (known host limit, not a feature failure)",
      "excerpt": "`just app-session stop` does not report the app's exit code. Every stop printed only {\"stopped\":\"v-rv\",\"session\":\"ended\",\"procs\":[{\"role\":\"tauri-driver\",…\"result\":\"stopped\"},{\"role\":\"xvfb\",…\"result\":\"stopped\"}],\"children\":[],\"folder\":\"removed /tmp/yamt-app-session-v-rv-…\"}. So I have no exit status for the WM_DELETE_WINDOW closes. The C6 exit codes come from running target/debug/yamt directly under xvfb-run."
    }
  ],
  "smoke": [
    {
      "recipe": "A. just check at 1f3fe61e (gate, includes map-check)",
      "observed": "Exit 0 (EXIT 0, 76.8 s). nextest: \"Summary [14.376s] 1559 tests run: 1559 passed, 64 skipped\". vitest: \"Test Files 314 passed (314) / Tests 4709 passed (4709)\". \"scripts/map-check.sh\" then \"map-check: ok\". golden: \"ok …\" for every case. sfc-order ran. hooks-test: \"ℹ tests 18 ℹ pass 18 ℹ fail 0\". Log: /tmp/yamt-rv-check.log",
      "pass": true
    },
    {
      "recipe": "B1 fixture start-fixture --range-case review --threads seeded --reviewed seeded --size 1600x1000, dark+light",
      "observed": "Header \"Reviewed config 1 of 13 reviewed Send to GitLab (2)\". Reviewed is the first header button, aria-pressed=false, bg rgba(0,0,0,0), border rgb(67,64,77) dark / rgb(209,211,217) light. keys.md: [reviewed], name class \"truncate text-fg-muted\", rgb(129,126,141) vs rgb(214,212,221) dark; rgb(115,118,124) vs rgb(0,0,0) light. logo.png and board.ts: [changed since reviewed], icon rgb(240,196,94) dark / rgb(232,163,62) light. 13 rows in the brief's order. Shots: /tmp/yamt-rv/verify/final/shots/b1-dark.png, b1-light.png",
      "pass": true
    },
    {
      "recipe": "B2 rule 2: mark config, big.txt; unmark seeded keys.md",
      "observed": "Reviewed on config → config [reviewed], data/big.txt selected. Reviewed again → big.txt [reviewed], \"Reviewed docs/current.md 3 of 13 reviewed\" (the intermediate 2 of 13 was not read). I then marked current.md by mistake → \"docs/legacy.txt 4 of 13\". keys.md opened: pressed=true, bg rgb(119,76,213). Click → \"Reviewed docs/shortcuts.md → docs/keys.md 3 of 13 reviewed\", pressed=false, keys.md row [] and still selected.",
      "pass": true
    },
    {
      "recipe": "B3 wrap from vendor/ui; mark binary logo.png",
      "observed": "On vendor/ui, Reviewed → vendor/ui [reviewed] and the first not-reviewed file from the top opened: \"docs/shortcuts.md → docs/keys.md 4 of 13\". current.md was already marked, so that file is keys.md. logo.png header \"Reviewed public/logo.png Changed since you reviewed it Review from start 4 of 13 reviewed\". Reviewed → logo.png [reviewed], src/api/mockBoards.ts opened, \"5 of 13 reviewed\".",
      "pass": true
    },
    {
      "recipe": "B4 rule 5: board.ts since view (after reload), logo.png no-text",
      "observed": "Header \"Reviewed src/board/board.ts Changed since you reviewed it Review from start 1 of 13 reviewed\". Left heading \"As you reviewed it\", right \"feature (9c1ba3f)\". chunk-inserted only on right lines 41,42,43; left has one insertion-point marker at 41. Next/Previous put the caret on the one difference (line 41), repeat stays there. Collapse toggle: 10/13 lines ↔ 69/69. cm-thread-host/row/count visible: 0. Drag on right line numbers (966,217→277): 0 textareas, no draft. logo.png DOM: SINCE_NO_TEXT sentence verbatim plus the Review from start button. Shots b4-dark.png, b4-light.png",
      "pass": true
    },
    {
      "recipe": "B5 rule 6: Review from start on board.ts, then mark",
      "observed": "Header \"Reviewed src/board/board.ts 1 of 13 reviewed\" (since text gone); row [] with no mark. Next change stopped at 7 places, then stayed on the last. 3 cm-thread-count visible (the seeded thread). Reviewed → \"src/board/reminders.ts 2 of 13 reviewed\". Back on board.ts: pressed=true, since=false, 15 inserted lines (the whole change). Shots b5-light.png, b5-dark.png",
      "pass": true
    },
    {
      "recipe": "B6 search Ctrl+Shift+S during since view (reloaded)",
      "observed": "\"randomUUID\" → \"1 result in 1 file\". Clicking the hit opened board.ts in the since view; caret in the right column, line 41 \"id: crypto.randomUUID(),\". Left-only word \"duplicateBoard\" (in fixture left, not right) → 1 hit; click opened board.ts (since view header), no caret, scroll 0,0: it did not move.",
      "pass": true
    },
    {
      "recipe": "B7 merge fixture (/) and ?diff",
      "observed": "/: 3 editors; buttons View as tree|Mark resolved|Commit merge|Previous/Next change|Collapse…|Apply non-conflicting changes from the left/right|Settings|Reset. No Reviewed button, no \"reviewed\" text. ?diff: New tab|Close Compare 1|Format|Auto · Plain text|Previous/Next change|Settings, no Reviewed. Bulk-apply then Ctrl+Z: my chunk-class probe showed no change; inconclusive. Shot b7-merge.png",
      "pass": true
    },
    {
      "recipe": "C setup: cargo tauri build --debug --no-bundle; range-repo.sh; switch feature",
      "observed": "Build EXIT 0, \"Built application at: …/target/debug/yamt\". Refs before: 9c1ba3fc… refs/heads/feature, 437805506e… refs/heads/main; status --porcelain: 0 lines.",
      "pass": true
    },
    {
      "recipe": "C1 start-app --name v-rv --range main...HEAD --repo/--home",
      "observed": "\"Reviewed config 0 of 13 reviewed\", 13 rows. current.md Reviewed → \"docs/shortcuts.md → docs/keys.md 1 of 13 reviewed\". board.ts Reviewed → \"src/board/reminders.ts 2 of 13 reviewed\", rows current.md and board.ts [reviewed]. Stopped (no exit code, see failures).",
      "pass": true
    },
    {
      "recipe": "C2 restart; reviewed.json; texts/",
      "observed": "\"Reviewed config 2 of 13 reviewed\"; current.md and board.ts [reviewed]. reviewed.json: {\"format\":1,\"review\":{\"kind\":\"range\",\"left\":{\"kind\":\"ref\",\"name\":\"refs/heads/main\"},\"dots\":\"three\",\"right\":{\"kind\":\"ref\",\"name\":\"refs/heads/feature\"}},\"marks\":[{\"path\":\"docs/current.md\",…\"link\"…,\"keptText\":true},{\"path\":\"src/board/board.ts\",\"left\":{\"id\":\"d8bbe057…\",\"kind\":\"file\"},\"right\":{\"id\":\"079324a4…\",\"kind\":\"file\"},\"keptText\":true}]}. Folder has lock, reviewed.json, texts/ (079324a4… 13356 B, cafed0d6… 7 B). range/…/531ea52…-9c1ba3f…/ has only lock. Shots c2-dark.png, c2-light.png",
      "pass": true
    },
    {
      "recipe": "C3 commit 56224bb (one line on board.ts), restart",
      "observed": "\"1 of 13 reviewed\"; board.ts [changed since reviewed], current.md [reviewed]. board.ts: \"Changed since you reviewed it\"; headings \"As you reviewed it | HEAD (56224bb)\"; one change, right line 1 \"// verify c3\" (5/6 lines collapsed). Review from start → since text gone, 71/71 lines, row with no mark, \"1 of 13\". current.md pressed=true → click → \"0 of 13 reviewed\", stays on current.md. Shots c3-dark.png, c3-light.png, c3-fromstart-light.png",
      "pass": true
    },
    {
      "recipe": "C4 --name v-rv2 --range main..HEAD; commit on main",
      "observed": "\"README.md 0 of 14\" (README is in the 2-dot range). On reminders.ts, Reviewed → \"tools/build.sh 1 of 14\". reminders.ts is not on main, so my commit ccf34bb adds it there. Restart: \"src/board/reminders.ts +11 −1 [reviewed]\", \"1 of 14 reviewed\".",
      "pass": true
    },
    {
      "recipe": "C5 --range ccf34bb..<feature> --review-of group/project!12, then !13",
      "observed": "!12: on tools/build.sh, Reviewed → \"tools/deploy.sh … 1 of 14 reviewed\". Committed setup.cmd 26c2e04 and reopened ccf34bb..26c2e04 with !12: \"1 of 14 reviewed\", tools/build.sh [reviewed], setup.cmd +2 −0 []. Same range with !13: \"0 of 14 reviewed\", no marks.",
      "pass": true
    },
    {
      "recipe": "C6 refusals (target/debug/yamt under xvfb-run -a, HOME=…/home)",
      "observed": "After writing format 2: \"yamt: the reviewed marks /tmp/yamt-rv/verify/final/home/.local/share/yamt/reviewed/repo-4d4b4fc0959c2ed1/a3723440b0708215/reviewed.json were written by a newer yamt (format 2)\", exit=2. sha256 6172b392…eea9 is the same before and after. `--review-of=group/project!12 --repo …` → \"yamt: --review-of goes with --diff=<range>\" plus usage, exit=2.",
      "pass": true
    },
    {
      "recipe": "C7 repository untouched",
      "observed": "status --porcelain: 0 lines. Refs: main ccf34bb (my C4 commit on 4378055), feature 26c2e04 (my 56224bb and 26c2e04 on 9c1ba3f). Nothing else changed.",
      "pass": true
    },
    {
      "recipe": "C8 shots, stop all",
      "observed": "Shots: c2-dark/light, c3-dark/light, c3-fromstart-light in /tmp/yamt-rv/verify/final/shots/. c3-dark shows \"As you reviewed it | HEAD (56224bb)\" and one green line \"// verify c3\". Every session stopped; pgrep for target/debug/yamt, WebKitWebDriver, tauri-driver and Xvfb :3 is empty. No exit codes (see failures).",
      "pass": true
    },
    {
      "recipe": "D acceptance-clause mapping",
      "observed": "Two marks, each opening the next file: B2, C1. Restart keeps marks: C2. Changed file shows only its since change, Review from start, the other file stays reviewed, unmark: B4, B5, C3. Left side moved: C4. A merge request's marks after a push, by --review-of: C5. Refusals: C6. Repository untouched: C7. Other windows unchanged: B7. Search: B6. Owner check (GitLab playground) handed on, not run.",
      "pass": true
    }
  ],
  "environment": "HEAD 1f3fe61e (only .omp/run/slices.json modified). Fixture: MiniBrowser via just app-session. Real app: target/debug/yamt on private Xvfb :3; C6 under xvfb-run -a. Playwright WebKit not used (#1242). rustc/node/pnpm versions not re-read this pass (R1: rustc 1.99.0, node v26.13.1, pnpm 12.0.0). Scratch /tmp/yamt-rv/verify/final."
}
