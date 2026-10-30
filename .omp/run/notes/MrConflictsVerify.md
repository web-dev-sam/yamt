# MrConflictsVerify

Agent output (`agent://MrConflictsVerify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsVerify.md), collected 2026-10-30T23:48:13.820Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "3.4 second start via `app-session start-app --name m3 --repo /tmp/yamt-mrc` (harness, not product)",
      "excerpt": "app-session: webdriver POST /session: no answer within 60000 ms\nm3 exit=1\n— app-session cannot report the app's own exit code. I then ran target/debug/yamt --repo /tmp/yamt-mrc directly: `yamt: the merge of !21 is already open in another yamt window` / `direct second exit=2`. VF8 deviation: that run was not on a private display. It refused at startup, and no window was seen."
    },
    {
      "step": "3.5 finding: compare page state after the Abort in step 4 (not a step check)",
      "excerpt": "After the Abort (record gone, git on develop, `pgrep` empty), the compare window's !21 row still showed \"Continue merging !21\". It was enabled at first. After two Refresh clicks it was disabled ([d]). Only a focus-away/focus-back turned it back into \"Resolve conflicts of !21\", and even then the stale sentence \"Merging main into feature/due-dates in a new window.\" stayed beside it. Refresh did not re-read the merge record. Shot: /tmp/yamt-shots-mr-conflicts/r5-stale.png"
    }
  ],
  "smoke": [
    {
      "recipe": "just check (gate)",
      "observed": "web-test: Test Files 244 passed (244), Tests 3411 passed (3411); arch-check: ok; map-check: ok; golden: 10× ok; hooks-test: tests 18 pass 18 fail 0; EXIT 0 (Wall 56.69 s)",
      "pass": true
    },
    {
      "recipe": "1 Fixture page: start-fixture --name p --diff --mr list, open page, read !640/!636/fork",
      "observed": "!640 size \"+12 −0 · 1 file\", readiness hover \"Has conflicts\", button \"Resolve conflicts of !640\". !636 \"Has conflicts. Also blocked: discussions are unresolved\". Fork !639 (and !631): Resolve disabled, hover \"Resolving a fork's merge request is not supported\". Shot p1.png",
      "pass": true
    },
    {
      "recipe": "1 Fixture page: click Resolve !640",
      "observed": "!640 text \"Merging main into feature/fixture-640 in a new window.\", button \"Continue merging !640\" (enabled in the fixture). !636 and !632: Resolve disabled, hover \"The merge of !640 is not finished in this repository\". Fork rows keep the fork hover. Shot p2.png",
      "pass": true
    },
    {
      "recipe": "1 Fixture page: click Continue !640",
      "observed": "text \"Merging main into feature/fixture-640 in a new window.\" | Continue merging !640[disabled] hover=Its merge window is already open. Shot p3.png",
      "pass": true
    },
    {
      "recipe": "2 Fixture merge window ?operation=merge&mergeRequest=created → Abort",
      "observed": "Abort merge is hidden by default; I showed it through the toolbar menu. Dialog: \"Abort Merge / Abort the merge of main into feature/due-dates and return to develop? / yamt deletes feature/due-dates, which it created for this merge. / Abort Merge / Cancel\". Shot w1.png",
      "pass": true
    },
    {
      "recipe": "2 Fixture …&leftovers → Abort → confirm",
      "observed": "\"Merge Aborted / The merge of main into feature/due-dates is aborted, but yamt did not put everything back: / HEAD moved after the merge started, so yamt did not check out develop again. / feature/due-dates changed after the merge started, so yamt left it as it is. / Close\". The only button: Close. Shot w2.png",
      "pass": true
    },
    {
      "recipe": "2 Fixture …&mergeRequest=created&clean&push=rejected → Commit merge → push question (#2026)",
      "observed": "\"Push to GitLab / Push feature/due-dates to GitLab? / The merge is committed on feature/due-dates. Keep Local leaves it there; you can push it later. / Push / Keep Local\". Toolbar: Commit merge[disabled] ; Abort merge[disabled]. Shot w3.png",
      "pass": true
    },
    {
      "recipe": "2 Fixture Push → failed question → Keep Local",
      "observed": "\"Push Failed / git did not push feature/due-dates: [rejected] (fetch first) / The merge commit stays on your feature/due-dates. / Push Again / Keep Local\". After Keep Local: no dialog. Shot w4.png",
      "pass": true
    },
    {
      "recipe": "3 build: cargo tauri build --debug --no-bundle; scripts/mr-conflict-repo.sh /tmp/yamt-mrc",
      "observed": "Finished `dev` profile … Built application at: /home/wds/Projects/yamt/target/debug/yamt. mr-conflict-repo: /tmp/yamt-mrc is on develop; GitLab holds main, develop, feature/due-dates, feature/clean and feature/merged.",
      "pass": true
    },
    {
      "recipe": "3.1 start-app --name c --diff --dir /tmp/yamt-mrc --glab mr-conflicts, page",
      "observed": "!21 size=+120 −40 · 6 files, \"Has conflicts\", Resolve enabled. !22 \"Resolving a fork's merge request is not supported\", Resolve[disabled]. !27 size=none, \"Ready to merge\". Shot r1.png",
      "pass": true
    },
    {
      "recipe": "3.2 Resolve !21 (#2036 check right after the reply)",
      "observed": "!21 \"Merging main into feature/due-dates in a new window.\" | Continue merging !21[disabled] hover=Its merge window is already open (hasFocus=false, no focus change). !32/!31/!29/!23: Resolve[disabled] hover=The merge of !21 is not finished in this repository. git status: On branch feature/due-dates / Your branch is up to date with 'origin/feature/due-dates'. / You have unmerged paths. / both modified: src/board/card.ts. rev-parse feature/due-dates@{u} → origin/feature/due-dates. The --display shot r2a.png shows the second window (MERGE, card.ts, 2 conflicts).",
      "pass": true
    },
    {
      "recipe": "3.2 pkill window, focus-back, Continue (#2036 check after the Continue reply)",
      "observed": "pgrep: no merge window. After focus-back: Continue merging !21[enabled]. Clicked; read without a focus change: Continue merging !21[disabled] hover=Its merge window is already open, hasFocus=true. New process `yamt --repo /tmp/yamt-mrc`. Unmerged: src/board/card.ts. !31: \"Has conflicts. Also blocked: it is a draft\" with an enabled Resolve (before the merge). Shot r2b.png",
      "pass": true
    },
    {
      "recipe": "3.3 fresh /tmp/yamt-mrc3, README.md edited, Resolve !21",
      "observed": "Before: `## develop /  M README.md`. Row: \"This checkout has uncommitted changes to tracked files; commit or stash them first.\" git status unchanged (diff empty), no merge window. Shot r3.png",
      "pass": true
    },
    {
      "recipe": "3.4 pkill, start-app m, second start, Abort",
      "observed": "Second start: `yamt: the merge of !21 is already open in another yamt window`, exit 2 (direct run; see failures for the app-session m3 timeout). In m: \"Abort the merge of main into feature/due-dates and return to develop? / yamt deletes feature/due-dates, which it created for this merge.\" → confirm → pgrep: merge window gone. Branch: develop, no feature/* branch, no yamt-merge-request.json (only the .lock files). Shot r4.png",
      "pass": true
    },
    {
      "recipe": "3.5 Resolve !21 again, pkill, start-app m2, take sides, Commit merge, Push",
      "observed": "I took sides with the chunk arrows: 2 conflicts → 1 conflict → All changes processed; Mark resolved. Commit merge → \"Push to GitLab / Push feature/due-dates to GitLab?\" (shot r5.png). Push → merge window gone. fake-gitlab log -1 %s feature/due-dates: \"Merge remote-tracking branch 'origin/main' into feature/due-dates\". Checkout on feature/due-dates, `## feature/due-dates...origin/feature/due-dates`. The stale-row finding is under failures.",
      "pass": true
    },
    {
      "recipe": "3.6 Resolve !23 (feature/clean), from develop",
      "observed": "\"main merges into feature/clean without conflicts after all; check and commit it in the new window.\" Window (restarted as m4): \"MERGE Merging origin/main into feature/clean / Commit merge / Abort merge / Git stopped without conflicts.\" Shot r6.png. I then aborted it; back on develop.",
      "pass": true
    },
    {
      "recipe": "3.7 fresh /tmp/yamt-mrc7: commit pushed to fake GitLab before Push → rejected → Keep Local",
      "observed": "Fake GitLab feature/due-dates: 4fb791c Someone else's commit. Push → \"Push Failed / git did not push feature/due-dates: [rejected] (fetch first) / The merge commit stays on your feature/due-dates. / Push Again / Keep Local\" (r7b.png). Keep Local → the window closed, as the design §363 says. GitLab is still 4fb791c. Local: a6f2d81 Merge remote-tracking branch 'origin/main' into feature/due-dates, on feature/due-dates.",
      "pass": true
    },
    {
      "recipe": "Verify step 3: cleanup",
      "observed": "All sessions stopped; `pgrep -af 'yamt --repo'` → empty; /tmp/yamt-mrc, -mrc3, -mrc7 removed; `ls -d /tmp/yamt-mrc*` → No such file or directory. Shots kept in /tmp/yamt-shots-mr-conflicts/.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; Linux 7.2.11-arch1-1 x64. Fixture: MiniBrowser through app-session on a private display. Real app: target/debug/yamt on private displays :3/:4. Repos in /tmp instead of /var/tmp, as the verify brief says. test:browser not run (not named)."
}
