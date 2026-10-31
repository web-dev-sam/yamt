# LineRangesSmoke

Agent output (`agent://LineRangesSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesSmoke.md), collected 2026-10-31T12:33:02.738Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B. pnpm -C frontend test:browser src/editor/rangeThreads.browser.test.ts",
      "excerpt": "Error: browserType.launch: Target page, context or browser has been closed\n<launching> /home/wds/.cache/ms-playwright/webkit-2370/pw_run.sh --inspector-pipe --headless --no-startup-window\n[err] /home/wds/.cache/ms-playwright/webkit-2370/minibrowser-wpe/bin/MiniBrowser: error while loading shared libraries: libicudata.so.74: cannot open shared object file: No such file or directory\n<process did exit: exitCode=127, signal=null>\n[ELIFECYCLE] Command failed with exit code 1.\nNo tests ran, so the three drag-only proofs (Escape mid-drag, scroll during drag, no text selection) are unproven."
    }
  ],
  "smoke": [
    {
      "recipe": "B. pnpm -C frontend test:browser src/editor/rangeThreads.browser.test.ts",
      "observed": "WebKit did not launch: MiniBrowser 'error while loading shared libraries: libicudata.so.74', exit 127. No test names to report.",
      "pass": false
    },
    {
      "recipe": "C.start start-fixture --name lr --range-case review --threads seeded --size 1600x1000; open board.ts; collapse off",
      "observed": "Fixture at localhost:45949. The option reads 'Msrc/board/board.ts 6+44−21'. With collapse off (aria-pressed false) the gutters run 1..29 without gaps. Seeded badges on L6, L20, R21 and R102. A click by the name 'src/board/board.ts' failed ('no element named'), so the option was opened with --nth 7.",
      "pass": true
    },
    {
      "recipe": "C1 drag R201 --dy 60",
      "observed": "L tint 197,198,199,200; R tint 201,202,203,204; header src/board/board.ts:201-204; focus TEXTAREA 'Write a comment…'. Screenshot /tmp/lr-c1.png",
      "pass": true
    },
    {
      "recipe": "C2 drag L200 → R204 (--dx 688)",
      "observed": "Two headers, both at x=1010 under R204: '201-204' at y382 and 'src/board/board.ts:-200 to +204' at y536. Tint includes L200 and R204. Screenshot /tmp/lr-c2.png",
      "pass": true
    },
    {
      "recipe": "C3 blur, drag R204 --dy -60",
      "observed": "No new box (still 2 headers). activeElement is textarea index 0 of 2, the first box's field.",
      "pass": true
    },
    {
      "recipe": "C4 click R210",
      "observed": "A third header appeared: src/board/board.ts:210",
      "pass": true
    },
    {
      "recipe": "C5 click R406 badge twice",
      "observed": "First click: header src/board/board.ts:389-406 (/tmp/lr-c5-open.png). Second click: no headers and 0 textareas, so the box collapsed and no draft was started.",
      "pass": true
    },
    {
      "recipe": "C6 hover thread-4 box, then hover Settings",
      "observed": "Hovered: L tint 401..415 (15 lines), R tint 389..406 (18 lines); /tmp/lr-c6-hover.png. Hovering elsewhere left L and R untinted.",
      "pass": true
    },
    {
      "recipe": "C7 collapse on",
      "observed": "Left gutter: …329,330, then a wave, then 397…419, so all of L401–415 are shown. Right gutter: 385…436, including R389–406.",
      "pass": true
    },
    {
      "recipe": "C8 collapse on, drag R23 --dy 200",
      "observed": "The right gutter shows a wave after 20/21 (d0). Header src/board/board.ts:23-25. /tmp/lr-c8.png",
      "pass": true
    },
    {
      "recipe": "C9 stop --name lr",
      "observed": "stopped lr: webdriver and vite stopped, folder removed",
      "pass": true
    },
    {
      "recipe": "D.prep range-repo.sh /tmp/lrv/rr; cargo tauri build --debug --no-bundle",
      "observed": "'holds main and feature'; 'Built application at: target/debug/yamt' (the old binary predated HEAD 2cf6a130)",
      "pass": true
    },
    {
      "recipe": "D1 start-app lra dark; two drags + Comment; hover box 2",
      "observed": "Headers 201-204 'Range in one column' and '-200 to +204' 'Across both sides', both saved with Post/Edit/Delete. Hovering box 2 tints L200 and R204. Dark screenshot /tmp/lrv/d1-dark.png",
      "pass": true
    },
    {
      "recipe": "D2 stop; cat threads.json",
      "observed": "\"format\": 2. Thread 1 place start {unchanged, left 196, right 200}, end {added, right 203}. Thread 2 place start {removed, left 199}, end {added, right 203}. Texts match.",
      "pass": true
    },
    {
      "recipe": "D3 restart light, same home",
      "observed": "The badge on R204 reads 2. Both boxes open with headers 201-204 and -200 to +204. Hovering box 1 tints L197–200 and R201–204. /tmp/lrv/d3-light.png. My first restart attempt failed because I issued it in parallel with the stop; run alone, it succeeded.",
      "pass": true
    },
    {
      "recipe": "D4 stop --name lra",
      "observed": "stopped lra: tauri-driver and xvfb stopped",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; vitest 5.0.3; playwright 1.64.0. Playwright WebKit (webkit-2370) cannot launch: libicudata.so.74 is missing on Arch. The fixture used MiniBrowser on a private display; the app ran on Xvfb :3. HEAD 2cf6a130."
}
