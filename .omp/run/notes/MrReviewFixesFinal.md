# MrReviewFixesFinal

Agent output (`agent://MrReviewFixesFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesFinal.md), collected 2026-11-05T00:56:21.934Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "Final real app step 2 (resolve → button turns plain), start-app --diff --glab mr-threads --mr",
      "excerpt": "Not proven in the real app. The fake-glab scenario cannot model this, so I don't count it as a product fault. !91 box '1 of 3 waits for you'. I opened Anna Berg's 'Your turn' line (d16) with Shift, waited 1.5 s, and clicked Resolve thread with the mouse. calls.log line 63: 'argv: api --include --method PUT projects/taskboard%2Ftaskboard/merge_requests/91/discussions/0000…0016 --input -'. posts=1. The re-read of !91 came back unchanged: at +0.2/+0.5/+1.5 s it still showed '!91* !90* | box:1 of 3 waits for you | panel:true/false', with no error text. mr-threads only has after-post answers for !90's d01, and its post 1 is a reply, not a resolve. So no scenario has a resolved !91. The resolve's unmark is proven in the WebKit fixture, dark and light (see smoke)."
    }
  ],
  "smoke": [
    {
      "recipe": "just check (once, HEAD 9378c82f, includes map-check)",
      "observed": "Ran all the way to the last recipe, hooks-test: 'ℹ tests 18 ℹ pass 18 ℹ fail 0'. The golden step before it printed ok for every case (…vueuse-use-magic-keys). Wall time 46.96 s. I piped the output through tail, so exit 0 is inferred from the run reaching the last recipe, and just stops at the first failure. [INFERENCE]",
      "pass": true
    },
    {
      "recipe": "dark A1 (start-fixture --name mrfv --diff --mr list --open-mr --size 1600x1000)",
      "observed": "!637 (author DV), box line: 'SW / Sam Weller / 2 hours ago / Dmitri Volkov's turn / Overview / Yes, it keeps it.' Hover plus Shift opens the thread panel; its header reads 'Overview  Dmitri Volkov's turn' (/tmp/mrfv-thread.png).",
      "pass": true
    },
    {
      "recipe": "dark B1: all 27 discussion buttons vs box header",
      "observed": "27/27 match. Marked text-primary rgb(119,76,213) on !637 4 of 13, !636 1 of 3, !633 1 of 1, !626 2 of 2, !623 1 of 2, !621 1 of 1, !618 1 of 1, !611 2 of 2, !606 1 of 1. Every '0 of N wait for you' row is plain, and so are !629 (glab is not logged in) and !615 (glab failed: glab timed out).",
      "pass": true
    },
    {
      "recipe": "dark step 3: review mode Anna Berg",
      "observed": "Rows with buttons: !630 PURPLE '1 of 1 waits for Anna Berg' (its line reads 'Anna Berg's turn'), !602 PURPLE '1 of 2 waits for Anna Berg', !612/!632/!617 plain '0 of N wait for Anna Berg'.",
      "pass": true
    },
    {
      "recipe": "dark C1/C2/Back",
      "observed": "Escape 1: panel gone, box stays, page stays. Escape 2: box gone, page stays, focus on BUTTON 13. Escape 3: page stays. Escape on body and Escape with focus on Back: page stays. Assignee menu open (2 menus), Escape: back to 1 (the always-present listbox), page stays, focus on Assignee. Enter on Back: page=false. Click on Back: page=false.",
      "pass": true
    },
    {
      "recipe": "dark D1–D5 (review mode Me, dates via the calendar)",
      "observed": "Before dates: !633* !618* !623* !638 !622 !603 !608. I set !622 to Thursday, 12 November 2026 and !603 to Sunday, 1 November 2026. Order after: !603 'Due 01.11.2026, 4 days overdue', !622 'Due 12.11.2026, 7 days left', !633*, !618*, !623* (1 waiting each), then !638, !608. Hovering the sort icon shows: 'Sorted for your review: soonest due date first, then most discussions waiting for you, then fewest discussions you wrote in' (/tmp/mrfv-dark-tooltip.png).",
      "pass": true
    },
    {
      "recipe": "dark orchestrator check (#2472/#2476): Me mode, resolve !633's only waiting discussion by mouse after the thread loaded",
      "observed": "Box open: '!603 !622 !633* !618* !623* !638 !608 | 1 of 1 waits for you'. Hover the line, Shift, wait 1.5 s: panel loaded, Resolve thread showing. Mouse click on Resolve thread. +0.3 s: unchanged, still 1 of 1, no Unresolve yet. +1.5 s: '!603 !622 !633 !618* !623* !638 !608 | No open discussions | Unresolve': button unmarked in the same render as the box change, row still in place. Escape (panel): order unchanged. Escape (box): '!603 !622 !618* !623* !638 !633 !608', so the row moved once both had closed.",
      "pass": true
    },
    {
      "recipe": "light A1 (fresh session, Settings → Theme → Light)",
      "observed": "!637 line 'Sam Weller / … / Dmitri Volkov's turn / Overview / Yes, it keeps it.'; panel header 'Overview\\nDmitri Volkov's turn' (/tmp/mrfv-light-thread.png).",
      "pass": true
    },
    {
      "recipe": "light B1: 27 buttons",
      "observed": "27/27 match, same rows as dark. Marked rgb(56,113,225) exactly on the nine 'N≥1 of M' rows. Plain is rgb(0,0,0) on the 0-of-N rows and on the glab-error rows !629 and !615.",
      "pass": true
    },
    {
      "recipe": "light step 3: Anna Berg",
      "observed": "!630 MARK '1 of 1 waits for Anna Berg' (line Anna Berg's turn); !602 MARK '1 of 2'; !612, !632, !617 plain '0 of N wait for Anna Berg'. Tooltip: 'Sorted for Anna Berg's review: soonest due date first, then most discussions waiting for Anna Berg, then fewest discussions Anna Berg wrote in'.",
      "pass": true
    },
    {
      "recipe": "light C1/C2/Back",
      "observed": "Escape closes the panel, then the box; the page stays each time. Escape on body and on Back: page stays. Reviewer menu open (2 menus), Escape: 1, focus on Reviewer, page stays. Back by Enter: page=false. Back by click: page=false.",
      "pass": true
    },
    {
      "recipe": "light D1–D5",
      "observed": "Same dates as dark. Order: !603 (4 days overdue), !622 (7 days left), !633 MARK, !618 MARK, !623 MARK, !638, !608. Tooltip has the D5 words (/tmp/mrfv-light-sorted.png).",
      "pass": true
    },
    {
      "recipe": "light orchestrator check: resolve !633 by mouse after load",
      "observed": "Loaded: '!633* … 1 of 1 waits for you | Resolve thread'. Click. +0.1 s unchanged. +0.2 s: '!603 !622 !633 !618* !623* !638 !608 | No open discussions | Unresolve', unchanged at +0.3, +0.5 and +1 s. Escape (panel): row still in place. Escape (box): '!603 !622 !618* !623* !638 !633 !608'.",
      "pass": true
    },
    {
      "recipe": "real app step 1 (cargo tauri build --debug --no-bundle; start-app --name mrfvapp --diff --dir /tmp/mrfv-real/repo --glab mr-threads --mr)",
      "observed": "Page shows '2 of 2 merge requests' (!91, !90 by DV). !90 box lines include 'Dmitri Volkov's turn' ×6, 'Anna Berg's turn', 'Ben Okafor's turn', 'Open', 'Your turn' ×4. Shift on Chiara Rossi's line opens the panel with header 'Overview  Dmitri Volkov's turn' (/tmp/mrfv-app-thread.png).",
      "pass": true
    },
    {
      "recipe": "real app step 2 B1 (button vs header)",
      "observed": "!91 PURPLE rgb(119,76,213) with '1 of 3 waits for you'; !90 PURPLE with '4 of 13 wait for you'. The resolve part is unproven here (see failures).",
      "pass": true
    },
    {
      "recipe": "real app step 2 resolve → plain",
      "observed": "PUT …/91/discussions/0000…0016 was sent, but the scenario's re-read still has it open, so the box stayed '1 of 3' and the button stayed purple. The scenario has no resolved-!91 answer.",
      "pass": false
    },
    {
      "recipe": "real app step 4 C1/C2/Back",
      "observed": "esc1: panel closed, box open, page stays. esc2: box closed, focus on BUTTON 13. Escape on body: page stays. Escape on Back: page stays, focus on Back. Assignee menu: menus 2→1 after Escape, focus on Assignee, page stays. Enter on Back: page=false. Reopened, then click on Back: page=false.",
      "pass": true
    }
  ],
  "environment": "HEAD 9378c82f; rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. Fixture: MiniBrowser WebKit on the private display via just app-session. Real app: target/debug/yamt rebuilt with cargo tauri build --debug --no-bundle, on Xvfb :3. Scratch repo from scripts/local-conflicts-repo.sh. All sessions stopped. The light theme was set through Settings → Theme → Light."
}
