# MrDescriptionSmoke

Agent output (`agent://MrDescriptionSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionSmoke.md), collected 2026-11-04T01:07:51.443Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B.9 fixture !636 failure wording",
      "excerpt": "Brief: !636 shows \"Could not read the description: glab: a deadline line\". Observed in every window where !636 was asked for the first time: {\"value\":\"Could not read the description: glab timed out\\nRetry\"}. The committed fixture agrees with this: fixtureMergeRequestDescriptions.ts:202 returns {kind:\"failed\", message: TIMED_OUT}, and the .test.ts:242 expects \"glab timed out\". So the brief and the fixture disagree. The real app's !49 does show \"glab: a deadline line\"."
    },
    {
      "step": "C.1-C.3 scenario host differs from brief",
      "excerpt": "Brief: https://gitlab.example and `api https://gitlab.example/-/project/7/uploads/<B>/old.png`. Observed: tests/glab/mr-description/project.json has web_url \"https://gitlab.com/taskboard/taskboard\". The log has `argv: api https://gitlab.com/-/project/7/uploads/f9e8.../old.png`, and #12 opened https://gitlab.com/taskboard/taskboard/-/issues/12. This is consistent with decision #2280, so the brief is stale. The self-managed/ subfolder (gitlab.example) cannot be run: --glab refuses it (\"expected a folder name under tests/glab/\"). That path was not exercised in the real app."
    }
  ],
  "smoke": [
    {
      "recipe": "B.1 column (start-fixture --diff --mr list --open-mr; and --range-case review; Light via Settings)",
      "observed": "All 4 windows: `640:…Show description@1395 ;; 639:…Show description@1395 ;; 638:…none@1395 ;; 637:…Show description@1395`. CI boxes: `639 Pipeline passed@1435 ;; 638 Pipeline running@1435 ;; 637 -@1435`. Tooltip: `Show description`. No fixture_page on open. start-fixture has no --settings, so Light was set in the Settings screen.",
      "pass": true
    },
    {
      "recipe": "B.2 every element !640",
      "observed": "{h1:1,h2:1,h3:1,em:1,strong:1,del:1,code:1,br:1,preSpans:[13,0,0],olStart:3,tasks:[Done,Not done,Not applicable],align:[left,center,right],quote:1,hr:1,detailsOpen:false}; after a click on the summary detailsAfterClick=true. Ruby keyword colour: rgb(224,152,107) dark, rgb(0,51,179) light. Shots: /tmp/mdv/b-640-{dark,diff-light,range-dark,range-light}.png",
      "pass": true
    },
    {
      "recipe": "B.3 images",
      "observed": "`screenshot nw=16 w=16;outside picture nw=48 w=48 inner=1022`; captions `broken screenshot|refused picture`. Clicking the images: `imgClickLog=[]`.",
      "pass": true
    },
    {
      "recipe": "B.4 links",
      "observed": "Only `fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/issues/12\"}` and `{page: \"https://docs.example/x\"}` were logged. Tooltips: `mailto:anna@example.com` and `javascript:window.yamtPlanted=true`. href unchanged, planted:\"undefined\", open:true, hrefs:0. In range-light the lines appear twice because my console hook was installed twice.",
      "pass": true
    },
    {
      "recipe": "B.5 closing",
      "observed": "Every window: `esc open=false focus=640`, `closeBtn open=false`, `header open=false`, `secondClick open=false`.",
      "pass": true
    },
    {
      "recipe": "B.6 replace/keep",
      "observed": "`panels=[\"!639Show overdue cards in red\"]`. A wheel over !630's button moved listTop 0→171 and the panel stayed open. After Refresh: `[\"!639…\"] Paragraph 1.Paragraph 2.`",
      "pass": true
    },
    {
      "recipe": "B.7 scroll",
      "observed": "{ratio:0.84998,cx:800,cy:480.84,winW:1600,winH:962,innerTop:500,innerH:3292}. Shots: /tmp/mdv/b-639-*.png",
      "pass": true
    },
    {
      "recipe": "B.8 fresh",
      "observed": "`first=Loading…` twice. Log: fixture_description {iid: 640}, description_shown {iid: 640, kind: \"shown\", blocks: 16, ms: 401}, then the same two lines again.",
      "pass": true
    },
    {
      "recipe": "B.9 empty and failed",
      "observed": "!637: `No description.`. !636: `Could not read the description: glab timed out\\nRetry`, not the brief's \"glab: a deadline line\". Retry → `Loading…` → `Snooze a reminder\\nWhat changes`.",
      "pass": false
    },
    {
      "recipe": "B.10 planted !635",
      "observed": "{t:\"<script>window.yamtPlanted = true</script>\\n\\n<img src=x onerror=…>\\n\\n<iframe src=\\\"https://evil.example/\\\">\", n:0, p:\"undefined\"}",
      "pass": true
    },
    {
      "recipe": "B.11 keyboard",
      "observed": "Tab reached `640 BUTTON|Show description`. Enter put focus `IN DIV|!640`. Then Tab gave: Close, SUMMARY More, A #12, A the docs, A mail Anna, A planted. Escape: `open=false focus=640`. Same in all 4 windows.",
      "pass": true
    },
    {
      "recipe": "B.12 shots",
      "observed": "/tmp/mdv/b-rows-{dark,diff-light,range-dark,range-light}.png and b-640-*.png. I viewed the dark and light shots: the centred panel over the rows, the coloured ruby block, the task icons, the aligned table.",
      "pass": true
    },
    {
      "recipe": "C.1 list (local-conflicts-repo.sh /tmp/mdv/mpv; cargo tauri build --debug --no-bundle; start-app --diff --glab mr-description --mr)",
      "observed": "Build ended `Built application at: target/debug/yamt`. Rows: `52+btn,51+btn,50+btn,49+btn,48+btn,47-none,46-none`. The list argv has `nodes { iid title description createdAt`, and descriptionHtml appears 0 times in it.",
      "pass": true
    },
    {
      "recipe": "C.2 !52",
      "observed": "Every rule 3 element is in the DOM. img src yamt-picture://localhost/upload~0a1b…e8f9 (shot, nw=32) and upload~f9e8…1b0a (old, nw=16); captions gone/cat/evil/plain. Log: `api projects/7/uploads/f9e8…/old.png`, `…/0a1b…/shot.png`, `…/1111aaaa…/gone.png`, `api https://gitlab.com/-/project/7/uploads/f9e8…/old.png` (and gone.png). stdin:0 -X:0, images/evil/plain.example:0.",
      "pass": true
    },
    {
      "recipe": "C.3 links",
      "observed": "opened.log: `argv: https://docs.example/x` and `argv: https://gitlab.com/taskboard/taskboard/-/issues/12`. mail, file:///etc/passwd and javascript:alert(1) added nothing. No problem bar; href stayed tauri://localhost.",
      "pass": true
    },
    {
      "recipe": "C.4 !50 planted",
      "observed": "{planted:\"undefined\", bad:0, stylesLinks:[STYLE.-, LINK.-, STYLE.markdown-highlight-styles] (2 before), display:\"block\", href:\"tauri://localhost\"}. App log: WARN nests deeper than yamt shows MAX_NESTING=32.",
      "pass": true
    },
    {
      "recipe": "C.5 !51 !49 !48",
      "observed": "!51: `No description.`. !49: `Could not read the description: glab: a deadline line\\nRetry`. !48: `Could not read the description: GitLab's answer names no merge request\\nRetry`.",
      "pass": true
    },
    {
      "recipe": "C.6 app log + shots",
      "observed": "description_shown: `blocks=17 iid=52 kind=\"shown\" ms=45`; `blocks=6 iid=50 shown`; `blocks=0 iid=51 shown`; `iid=49 kind=\"refused\"`; `iid=48 kind=\"refused\"`. One line per open, with no text or address. Shots: /tmp/mdv/c-52-dark.png, c-48-dark.png, c-52-light.png, c-rows-light.png (light via pnpm tsx start-app --settings).",
      "pass": true
    }
  ],
  "environment": "HEAD 47c8b903 (docs-only after 9fe4c13b); the worktree has orchestrator docs changes that are not mine. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser at /usr/lib/webkitgtk-6.0 via just webdriver on a private display. All sessions are stopped. Scratch: /tmp/mdv."
}
