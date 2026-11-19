# RangeReviewedSmokeR1

Agent output (`agent://RangeReviewedSmokeR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedSmokeR1.md), collected 2026-11-19T10:26:12.269Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "Extra check: a fixture start that shows board.ts first, changed since reviewed (fixture form)",
      "excerpt": "Cannot be set up in the fixture. frontend/fixtures/range/ has only empty.json and review.json. review.json starts with config, data/big.txt, docs/current.md, and the range store always shows files[0] first (rangeStore.ts:271-273). A reload does not restore the last file: I opened board.ts, ran location.reload(), and the header read \"Reviewed config 1 of 13 reviewed Send to GitLab (2)\". I ran the same check in the real app instead; it passed (see smoke)."
    },
    {
      "step": "C1–C8 exit statuses on stop",
      "excerpt": "`just app-session stop` does not report the app's exit code. Every stop printed only {\"stopped\":\"<n>\",\"session\":\"ended\",\"procs\":[{\"role\":\"tauri-driver\",…\"result\":\"stopped\"},{\"role\":\"xvfb\",…\"result\":\"stopped\"}],\"children\":[],\"folder\":\"removed …\"}. So no exit status was recorded for the WM_DELETE_WINDOW closes. The exit codes in C6 come from running target/debug/yamt directly under xvfb-run."
    }
  ],
  "smoke": [
    {
      "recipe": "Build: cargo tauri build --debug --no-bundle at 339d5509",
      "observed": "vue-tsc -b and vite build passed. \"Compiling yamt-app v0.7.0 … Finished `dev` profile … Built application at: /home/wds/Projects/yamt/target/debug/yamt\" (286977576 bytes). The TS2353 error is gone.",
      "pass": true
    },
    {
      "recipe": "C setup: range-repo.sh /tmp/yamt-rv/verify/repo; switch feature; refs/status before",
      "observed": "for-each-ref: 9c1ba3fc606a… commit refs/heads/feature; 437805506eab… commit refs/heads/main. status --porcelain: 0 lines.",
      "pass": true
    },
    {
      "recipe": "C1 start-app --name v-rv --range main...HEAD --repo … --home …",
      "observed": "Open: \"Reviewed config 0 of 13 reviewed Send to GitLab (0)\", 13 rows in the brief's order, aria-pressed=false. On docs/current.md, Reviewed → header \"Reviewed docs/shortcuts.md → docs/keys.md 1 of 13 reviewed\", row \"M docs/current.md +1 −1 [modified,reviewed]\". On src/board/board.ts, Reviewed → \"Reviewed src/board/reminders.ts 2 of 13 reviewed\", reminders *SEL*, board.ts [modified,reviewed]. Stopped. My first attempt misclicked; I wiped that home and redid C1 clean.",
      "pass": true
    },
    {
      "recipe": "C2 restart; cat reviewed.json; ls texts/",
      "observed": "\"Reviewed config 2 of 13 reviewed\"; current.md and board.ts [reviewed]. reviewed.json: {\"format\":1,\"review\":{\"kind\":\"range\",\"left\":{\"kind\":\"ref\",\"name\":\"refs/heads/main\"},\"dots\":\"three\",\"right\":{\"kind\":\"ref\",\"name\":\"refs/heads/feature\"}},\"marks\":[{\"path\":\"docs/current.md\",\"left\":{\"id\":\"32e98f28…\",\"kind\":\"link\"},\"right\":{\"id\":\"cafed0d6…\",\"kind\":\"link\"},\"keptText\":true},{\"path\":\"src/board/board.ts\",…\"kind\":\"file\"…,\"keptText\":true}]}. texts/ holds 2 files: 079324a4… (13356 B) and cafed0d6… (7 B). range/<key>/<l>-<r>/ holds only lock.",
      "pass": true
    },
    {
      "recipe": "C3 commit one-line board.ts change (4df87de); restart",
      "observed": "\"1 of 13 reviewed\"; board.ts [modified,changed since reviewed]; current.md [reviewed]. board.ts header \"Changed since you reviewed it Review from start\", left heading \"As you reviewed it\", collapsed to 6 lines, the only changed line is line 1. Review from start → \"Reviewed src/board/board.ts 1 of 13 reviewed\", row [modified] with no mark, the 71-line whole change. current.md: aria-pressed=true; click → \"Reviewed docs/current.md 0 of 13 reviewed\", the window stays on current.md.",
      "pass": true
    },
    {
      "recipe": "C4 --name v-rv2 --range main..HEAD; mark reminders.ts; commit on main (836134b); restart",
      "observed": "After marking: \"Reviewed tools/build.sh 1 of 14 reviewed\" (README.md is also in the 2-dot range), reminders [added,reviewed]. After the main commit and restart: \"M src/board/reminders.ts +0 −1 [modified,reviewed]\", \"1 of 14 reviewed\".",
      "pass": true
    },
    {
      "recipe": "C5 --name v-rvm --range <main id>..<feature id> --review-of group/project!12, then !13",
      "observed": "!12: on tools/build.sh, Reviewed → \"Reviewed tools/deploy.sh … 1 of 14 reviewed\". Committed setup.cmd (1673a76) and reopened 836134b..1673a76 with !12: build.sh [modified,reviewed], \"1 of 14 reviewed\". Same range with !13: \"0 of 14 reviewed\", no marks.",
      "pass": true
    },
    {
      "recipe": "C6 refusals (target/debug/yamt under xvfb-run, HOME=…/home)",
      "observed": "format 2: \"yamt: the reviewed marks /tmp/yamt-rv/verify/home/.local/share/yamt/reviewed/repo-d770925c1f1ead6a/a3723440b0708215/reviewed.json were written by a newer yamt (format 2)\", exit=2. sha256 6172b3928e0f… is the same before and after, so the file is unchanged. `yamt --review-of=group/project!12 --repo …` → \"yamt: --review-of goes with --diff=<range>\" plus the usage text, exit=2.",
      "pass": true
    },
    {
      "recipe": "C7 repository untouched",
      "observed": "status --porcelain: 0 lines. Refs: main 836134b (my c4 commit), feature ebd22b7 (my commits 4df87de, 1673a76, ebd22b7 on top of 9c1ba3f). Nothing else changed.",
      "pass": true
    },
    {
      "recipe": "C8 shots and stop",
      "observed": "/tmp/yamt-rv/verify/shots/c2-dark.png, c2-light.png, c3-dark.png, c3-light.png, c3-fromstart-dark.png. I looked at c3-light: light theme, \"As you reviewed it\" | \"HEAD (4df87de)\", one changed line, a check on current.md. All sessions stopped (stop does not report an exit code; see failures); pgrep for yamt/driver/Xvfb is empty.",
      "pass": true
    },
    {
      "recipe": "Real-app first-shown since file: --range 9c1ba3f..ebd22b7 --review-of group/project!20",
      "observed": "A MutationObserver was installed before the first render. States it recorded: [\"noeditors|since=false\", \"noeditors|since=true|asReviewed=true\", \"editors=2|since=true|lines=36/36\", \"…71/36\", \"…71/71\"]. The whole change never showed. Header \"src/board/board.ts Changed since you reviewed it Review from start 0 of 2 reviewed\"; one changed line (line 2); collapse off, as toggled in C3. Shot firstshown-board-dark.png",
      "pass": true
    },
    {
      "recipe": "B1 fixture (--range-case review --threads seeded --reviewed seeded), dark and light",
      "observed": "\"Reviewed config 1 of 13 reviewed Send to GitLab (2)\". Reviewed is the first header button, aria-pressed=false, bg transparent; border rgb(67,64,77) dark / rgb(209,211,217) light. keys.md name \"truncate text-fg-muted\": rgb(129,126,141) vs others rgb(214,212,221) dark; rgb(115,118,124) vs rgb(0,0,0) light. logo.png and board.ts show a \"changed since reviewed\" icon (rgb(240,196,94) dark / rgb(232,163,62) light), names not muted. Shots r1-b1-dark.png, r1-b1-light.png",
      "pass": true
    },
    {
      "recipe": "Fixture: board.ts first-shown changed-since start",
      "observed": "Not runnable: the review case always starts on config and there is no other range case (see failures). Covered by the real-app check above.",
      "pass": false
    }
  ],
  "environment": "HEAD 339d5509 (only .omp/run/slices.json modified). rustc 1.99.0; node v26.13.1; pnpm 12.0.0. Real app: target/debug/yamt via just app-session on private Xvfb :3; C6 under xvfb-run. Fixture: MiniBrowser via app-session. Playwright WebKit not used (#1242). Scratch /tmp/yamt-rv/verify."
}
