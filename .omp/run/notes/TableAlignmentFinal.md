# TableAlignmentFinal

Agent output (`agent://TableAlignmentFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-01-09-442Z_01a1aab9-db42-7214-86d7-c22d4308e026/TableAlignmentFinal.md), collected 2026-11-05T08:32:32.635Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (full gate incl. map-check) at 360c3e54",
      "observed": "Exit 0, wall 60.47 s. Last lines of the output: golden `ok vueuse-use-magic-keys`; sfc-order `tsx scripts/check-sfc-order.ts`; hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`; `EXIT 0`. I saw only the tail, so map-check's own lines are not pasted. It runs before golden in the chain, which stops at the first failure, so exit 0 means it passed.",
      "pass": true
    },
    {
      "recipe": "B1 dark: start-fixture --name tav --diff --mr list --open-mr --size 1600x1000, !640 Show description",
      "observed": "[text, align, weight, cellCentre−textCentre, cellRight−textRight]: Card left 600; State center 600 -0.5; Days right 600 8 (pad 8px); Login left 400; open center -0.5; 3 right 8; Board left; done center -0.5; 12 right. Borders 1px solid rgb(67,64,77). Shot /tmp/tav/b-desc-dark.png.",
      "pass": true
    },
    {
      "recipe": "B2 dark: d01 panel (!637, Shift tap on src/board.ts:12 row), ALIGNED, Preview",
      "observed": "Field value exactly the ALIGNED text with real newlines. Loading… = false. A console hook I set caught exactly one line: `info [info] mergeRequests.preview_local {iid: 637, blocks: 1}`. No fixture_preview. Preview: left left 600; center center -0.5; right right 8 (pad 8px); l left; c center -0.5; r right 8.",
      "pass": true
    },
    {
      "recipe": "B3 dark shots",
      "observed": "/tmp/tav/b-desc-dark.png and /tmp/tav/b-preview-dark.png (page captures). In the preview, c is centred and r is at the right.",
      "pass": true
    },
    {
      "recipe": "B1 light via Back → Settings → Light → Back → Merge requests",
      "observed": "data-theme=\"light\". !640 table: same values as dark (State/open/done center -0.5; Days/3/12 right 8). Borders 1px solid rgb(209,211,217); weights 600/400. Shot /tmp/tav/b-desc-light.png.",
      "pass": true
    },
    {
      "recipe": "B2 light: d01 panel again (text kept), Preview",
      "observed": "Loading… = false. left/center/right and l/c/r same values as dark. The log had preview_local {iid: 637, blocks: 1} and no fixture_preview. Each line was captured twice because I hooked the console a second time; that duplicate is my harness, not the app. Shot /tmp/tav/b-preview-light.png.",
      "pass": true
    },
    {
      "recipe": "C1: local-conflicts-repo.sh /tmp/tav-c/tav; cargo tauri build --debug --no-bundle; start-app --glab mr-description --mr; !52 description",
      "observed": "Build: `Built application at: target/debug/yamt`. Left left 600; Centre center -0.5; Right right 8 (pad 8px); l left; c center -0.5; r right 8. Shot /tmp/tav/c1-desc.png.",
      "pass": true
    },
    {
      "recipe": "C2: start-app --glab mr-threads --mr; !90 d01 (src/board.ts:12) panel, ALIGNED, Preview",
      "observed": "`grep -c argv: calls.log`: 12 before Preview, 12 two seconds after, so no new argv line. Loading… = false. left/center(-0.5)/right(8) in the head, l/c(-0.5)/r(8) in the body. Shot /tmp/tav/c2-preview.png.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; linux 7.2.11-arch1-1 x64. Fixture: MiniBrowser/WebKitWebDriver on a private display (app-session). Real app: target/debug/yamt under Xvfb :3 + tauri-driver. Commit 360c3e54, clean tree. No mutation run."
}
