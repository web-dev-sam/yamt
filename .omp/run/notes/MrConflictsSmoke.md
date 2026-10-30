# MrConflictsSmoke

Agent output (`agent://MrConflictsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsSmoke.md), collected 2026-10-30T23:29:22.128Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "3.2 Real app, rule 9: Continue merging !21 should be disabled while its merge window is open",
      "excerpt": "Right after the reply to Resolve !21, with the merge window running (`3136099 /home/wds/Projects/yamt/target/debug/yamt --repo /var/tmp/yamt-mrc-smoke`), the compare window showed `Continue merging !21 dis=false hover=Continue merging !21`. Expected: disabled, \"Its merge window is already open\". It became `dis=true hover=Its merge window is already open` only after `focus-away` + `focus-back`. The same thing happened after clicking Continue: the window reopened (`3138910 … yamt --repo /var/tmp/yamt-mrc-smoke`), and the row read `Merging main into feature/due-dates in a new window. ||  dis=false hover=Continue merging !21`. The fixture page (step 1) did show it disabled right after Continue, so only the real app is affected. Design §4.7 \"WebKit fixture steps\" and the mergeRequests.test.ts description say localMerge is re-read after every reply."
    },
    {
      "step": "Cleanup: remove /var/tmp/yamt-mrc*",
      "excerpt": "[bash-guard] rm -rf outside target/, node_modules/, dist/, /tmp — so /var/tmp/yamt-mrc-smoke (the step 3–6 repository) and the screenshots /var/tmp/yamt-mrc-smoke-*.png are still there. The /tmp repositories (/tmp/yamt-mrc-smoke3, /tmp/yamt-mrc-smoke7, /tmp/yamt-mrc-smoke7-other) were removed. /var/tmp/yamt-mrc, -local1 and -local2 from an earlier build are untouched."
    }
  ],
  "smoke": [
    {
      "recipe": "1. start-fixture --name p --diff --mr list; click Merge requests; read rows",
      "observed": "!640: `+12 −0 · 1 file` title \"12 lines added, 0 removed in 1 file\"; readiness \"Has conflicts\" (hover \"Has conflicts\"); Resolve enabled. !636: \"Has conflicts. Also blocked: discussions are unresolved\". Fork row !639: Resolve disabled=true, hover \"Resolving a fork's merge request is not supported\". Shot: /var/tmp/yamt-mrc-smoke-1a.png",
      "pass": true
    },
    {
      "recipe": "1. click Resolve conflicts of !640, then Continue merging !640",
      "observed": "After Resolve, row !640: \"Merging main into feature/fixture-640 in a new window.\"; button \"Continue merging !640\" enabled; !636/!632/!628/!624/!620 disabled with hover \"The merge of !640 is not finished in this repository\"; fork rows keep the fork hover. After Continue: same sentence, \"Continue merging !640 disabled=true hover=Its merge window is already open\". Shots 1b, 1c. (The first click without --role errored in app-session; repeating it with --role button worked.)",
      "pass": true
    },
    {
      "recipe": "2. start-fixture --name w; location.assign('/?operation=merge&mergeRequest=created'); Abort",
      "observed": "Abort merge starts hidden in the toolbar. I showed it through the toolbar context menu (a contextmenu event dispatched on the header; app-session has no right-click) → menuitemcheckbox \"Abort merge\". Question: \"Abort Merge ¦ Abort the merge of main into feature/due-dates and return to develop? ¦ yamt deletes feature/due-dates, which it created for this merge. ¦ Abort Merge ¦ Cancel\". Shot 2c.",
      "pass": true
    },
    {
      "recipe": "2. …&leftovers → Abort → Abort Merge",
      "observed": "\"Merge Aborted ¦ The merge of main into feature/due-dates is aborted, but yamt did not put everything back: ¦ HEAD moved after the merge started, so yamt did not check out develop again. ¦ feature/due-dates changed after the merge started, so yamt left it as it is. ¦ Close\" — buttons=1. Shot 2d.",
      "pass": true
    },
    {
      "recipe": "2. …&mergeRequest=created&clean&push=rejected → Commit merge → Push → Keep Local (#2026)",
      "observed": "Push question: \"Push to GitLab ¦ Push feature/due-dates to GitLab? ¦ The merge is committed on feature/due-dates. Keep Local leaves it there; you can push it later. ¦ Push ¦ Keep Local\", behind it \"Commit merge disabled=true, Abort merge disabled=true\". After Push: \"Push Failed ¦ git did not push feature/due-dates: [rejected] (fetch first) ¦ The merge commit stays on your feature/due-dates. ¦ Push Again ¦ Keep Local\". Keep Local → 0 dialogs. Shots 2e–2h.",
      "pass": true
    },
    {
      "recipe": "3.0 cargo tauri build --debug --no-bundle",
      "observed": "Finished `dev` profile … Built application at: /home/wds/Projects/yamt/target/debug/yamt",
      "pass": true
    },
    {
      "recipe": "3.1 start-app --name c --diff --dir /var/tmp/yamt-mrc-smoke --glab mr-conflicts; Merge requests",
      "observed": "!21 \"+120 −40 · 6 files\", \"Has conflicts\", Resolve enabled; !22 (fork) Resolve dis=true, hover \"Resolving a fork's merge request is not supported\"; !27 \"Reminder sounds ¦ !27 ¦ created 3 days ago ¦ 0 ¦ 1\" with no size, \"Ready to merge\"; !31 \"Has conflicts. Also blocked: it is a draft\" with Resolve enabled. Shot 3-1.",
      "pass": true
    },
    {
      "recipe": "3.2 Resolve !21; git status; @{u}; second window; pkill; Continue",
      "observed": "Row: \"Merging main into feature/due-dates in a new window.\" git status: \"On branch feature/due-dates … You have unmerged paths … new file: src/board/priority.ts … both modified: src/board/card.ts\"; rev-parse → origin/feature/due-dates; display shot 3-2a shows the merge window on src/board/card.ts. Other Resolve buttons disabled with \"The merge of !21 is not finished in this repository\". Continue merging !21 was dis=false while the window was open (failure above). After pkill + focus: enabled; click → window reopened (pid 3138910), unmerged: src/board/card.ts.",
      "pass": false
    },
    {
      "recipe": "3.3 fresh repo /tmp/yamt-mrc-smoke3 (/var/tmp writes are hook-blocked), tracked file edited, Resolve !21",
      "observed": "\"This checkout has uncommitted changes to tracked files; commit or stash them first.\"; git status unchanged: \"## develop\\n M src/board/card.ts\"; no merge window (pgrep exit 1). Shot 3-3.",
      "pass": true
    },
    {
      "recipe": "3.4 pkill; start-app m --repo; second window; Abort",
      "observed": "Second window: start-app m3 hung (webdriver POST /session: no answer within 60000 ms). Running the binary directly on a private xvfb display: \"yamt: the merge of !21 is already open in another yamt window\" exit=2. In m: \"Abort the merge of main into feature/due-dates and return to develop?\" → Abort Merge → window gone (pgrep=1); branch --show-current → develop; branches: develop, main (feature/due-dates gone); no yamt-merge-request.json in .git (only the .lock files). Shot 3-4a.",
      "pass": true
    },
    {
      "recipe": "3.5 Resolve !21 again, pkill, start-app m2, take sides, Commit merge, Push",
      "observed": "I took local + ignored remote for both conflicts in card.ts → Mark resolved → \"All files are resolved. Commit merge to commit it.\" Commit merge → \"Push feature/due-dates to GitLab?\" (shot 3-5a). Push → window gone (pgrep=1). fake-gitlab log -1 → \"Merge remote-tracking branch 'origin/main' into feature/due-dates\"; checkout \"## feature/due-dates...origin/feature/due-dates\".",
      "pass": true
    },
    {
      "recipe": "3.6 Resolve !23 (feature/clean)",
      "observed": "\"main merges into feature/clean without conflicts after all; check and commit it in the new window.\"; status \"## feature/clean...origin/feature/clean / M  src/board/card.ts / A  src/board/priority.ts\"; display shot 3-6: empty file list, \"Git stopped without conflicts.\", Commit merge (primary) and Abort merge.",
      "pass": true
    },
    {
      "recipe": "3.7 fresh /tmp/yamt-mrc-smoke7: commit added to fake GitLab, then Push → Keep Local",
      "observed": "Fake GitLab feature/due-dates was at 212ea07 \"Someone else pushed\". Push → \"Push Failed ¦ git did not push feature/due-dates: [rejected] (fetch first) ¦ The merge commit stays on your feature/due-dates. ¦ Push Again ¦ Keep Local\" (shot 3-7a). Keep Local → window closed (per design §4.4, exit 0). Fake GitLab still 212ea07 \"Someone else pushed\"; local fe29e79 \"Merge remote-tracking branch 'origin/main' into feature/due-dates\", \"[ahead 2]\".",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0; tree 320731d (docs-only past 1bd8483). Fixture: MiniBrowser on the app-session private display. Real app: target/debug/yamt on xvfb displays :3/:4. The ownership hook blocks writes into /var/tmp, so the steps 3 and 7 repositories were in /tmp."
}
