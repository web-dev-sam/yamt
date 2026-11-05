# TableAlignmentSmoke

Agent output (`agent://TableAlignmentSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-01-09-442Z_01a1aab9-db42-7214-86d7-c22d4308e026/TableAlignmentSmoke.md), collected 2026-11-05T08:24:43.614Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B (light): brief's `start-fixture … --settings '{\"theme\":\"light\"}'`",
      "excerpt": "app-session: unknown option --settings\nerror: recipe `app-session` failed on line 89 with exit code 1\n(start-fixture accepts no --settings; only start-app does. Light was run instead by Back → Settings → yamt 'Light' (data-theme=light) → Back → Merge requests in the same fixture session. The brief's recipe is wrong for start-fixture, which is the orchestrator's to fix.)"
    }
  ],
  "smoke": [
    {
      "recipe": "B1 dark: start-fixture --name tav --diff --mr list --open-mr --size 1600x1000, !640 'Show description'",
      "observed": "TH Card align=left fw=600 border=1px solid; TH State align=center fw=600 cell=[358.7,409.7] text=[367.7,401.7] dCentre=0.50; TH Days align=right fw=600 dRight=8.0 (pad 8px). TD Login left; open center cell=[358.7,409.7] text=[369.1,400.3] dCentre=0.50; 3 right text=[442.5,450.0] dRight=8.0; Board left; done center dCentre=0.50; 12 right dRight=8.0. Every dCentre of 0.50 is half of the 1px left border.",
      "pass": true
    },
    {
      "recipe": "B1 light (theme switched in Settings)",
      "observed": "theme=light; the same values: State/open/done center dCentre=0.50; Days/3/12 right dRight=8.0; Card/Login/Board left; th fw=600, td 400; border 1px rgb(209, 211, 217).",
      "pass": true
    },
    {
      "recipe": "B2 dark: !637 '13 open discussions' → d01 (Thread: src/board.ts:12), ALIGNED, Preview",
      "observed": "MutationObserver loadingSeen=0, loadingNow=false; captured console: [\"info [info] mergeRequests.preview_local {iid: 637, blocks: 1}\"] and no fixture_preview. html: <th class=\"\">left</th><th class=\"markdown-align-center\">center</th><th class=\"markdown-align-right\">right</th> … <td class=\"\">l</td><td class=\"markdown-align-center\">c</td><td class=\"markdown-align-right\">r</td>. th left/center/right fw600; td l left; td c center cell=[656.3,715.5] text=[683.3,689.5] dCentre=0.50; td r right cell=[715.5,764.5] text=[751.1,756.5] dRight=8.0.",
      "pass": true
    },
    {
      "recipe": "B2 light",
      "observed": "theme=light loadingSeen=0 loadingNow=false; log only [\"info [info] mergeRequests.preview_local {iid: 637, blocks: 1}\"]; the same HTML and rects: c center dCentre=0.50, r right dRight=8.0, l left.",
      "pass": true
    },
    {
      "recipe": "B3 shots (WebDriver page)",
      "observed": "/tmp/tav/B3-desc-dark.png, /tmp/tav/B3-preview-dark.png, /tmp/tav/B3-desc-light.png, /tmp/tav/B3-preview-light.png (each a full-page WebDriver shot, source \"page\"). The shots were not inspected by eye; the computed values above are the evidence.",
      "pass": true
    },
    {
      "recipe": "C1: local-conflicts-repo.sh /tmp/tav/scratch/tav; cargo tauri build --debug --no-bundle; start-app --diff --dir … --glab mr-description, !52 Show description",
      "observed": "The fake's graphql-description-52.json has <th align=\"left\">Left</th><th align=\"center\">Centre</th><th align=\"right\">Right</th>. Rendered: <th class=\"\">Left</th><th class=\"markdown-align-center\">Centre</th><th class=\"markdown-align-right\">Right</th>…<td class=\"\">l</td><td class=\"markdown-align-center\">c</td><td class=\"markdown-align-right\">r</td>. TD c center cell=[345.5,405.2] text=[371.9,379.9] dCentre=0.50; TD r right text=[443.2,448.2] dRight=8.0; TD l left. Shot /tmp/tav/C1-desc-52-dark.png.",
      "pass": true
    },
    {
      "recipe": "C2: start-app --diff --dir … --glab mr-threads --mr, 13 open discussions → d01 (row 3, 'Thread: src/board.ts:12'), ALIGNED, Preview",
      "observed": "calls.log had 14 argv lines before Preview and 14 after it, so Preview added none. The last lines were draft_notes, MergeRequestDiscussions, draft_notes and the uploads/…/shot.png thread read. loadingNow=false. The HTML is the same as in B2. TD c center cell=[654.3,712.2] text=[679.7,687.7] dCentre=0.50; TD r right text=[746.3,751.3] dRight=8.0; TD l left. My first try opened row 0, 'Thread: Overview', which is not d01. It gave the same alignment and no argv change (11 before and after); it is reported only to explain the second run. Shot /tmp/tav/C2-preview-d01-dark.png.",
      "pass": true
    }
  ],
  "environment": "commit a971493d; rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; fixture: MiniBrowser via just app-session on a private display; real app: target/debug/yamt (cargo tauri build --debug --no-bundle, 21 s) on Xvfb :3; window 1600x1000. No just check, no mutation run."
}
