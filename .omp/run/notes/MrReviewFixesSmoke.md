# MrReviewFixesSmoke

Agent output (`agent://MrReviewFixesSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesSmoke.md), collected 2026-11-05T00:03:28.018Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B2 dark: resolve by mouse click (!633, review mode Me)",
      "excerpt": "Hover line, Shift, then an immediate click on Resolve thread (app-session: clicked at x 1164, y 940). 1.5 s later: 1 open discussion purple=true rgb(119,76,213), box 1 of 1 waits for you, and no Unresolve appeared. Focus + Enter on Resolve thread then worked: purple=false, box No open discussions, Resolved. In light, a click 800 ms after Shift worked. [INFERENCE] The click probably landed while the thread was still loading (THREAD_PAUSE_MS 400). That could be my timing or a real lost click; I did not dig further."
    }
  ],
  "smoke": [
    {
      "recipe": "dark A1 (start-fixture --name mrfv --diff --mr list --open-mr --size 1600x1000)",
      "observed": "!637, author Dmitri Volkov: box lines read Dmitri Volkov's turn. Thread panel header: Overview  Dmitri Volkov's turn (/tmp/mrfv-thread.png).",
      "pass": true
    },
    {
      "recipe": "dark B1: all 27 discussion buttons vs box header",
      "observed": "27/27 OK. Purple rgb(119,76,213) only on headers N of M wait(s) for you with N 1 or more (4 of 13, 1 of 3, 2 of 2, 1 of 2, 1 of 1 ...). Plain on 0 of N and on the 2 glab-error rows.",
      "pass": true
    },
    {
      "recipe": "dark B2: resolve only waiting discussion",
      "observed": "After the resolve (done with Enter; the mouse click had no effect, see failures): purple=false rgb(214,212,221), box No open discussions.",
      "pass": false
    },
    {
      "recipe": "dark step 3: review mode Anna Berg",
      "observed": "Purple on 1 of 1 / 1 of 2 waits for Anna Berg (line Anna Berg's turn). Plain on 0 of N wait for Anna Berg.",
      "pass": true
    },
    {
      "recipe": "dark C1/C2/Back",
      "observed": "Escape closed the panel, then the box, and the page stayed. Escape on body: page stays. Escape with focus on Back: page stays. Assignee menu + Escape: menu closed, page stays, focus back on Assignee. Back+Enter left the page; Back click left the page.",
      "pass": true
    },
    {
      "recipe": "dark D1-D5",
      "observed": "Dates set with the calendar (typing did nothing: the field was not focused). Order: !603 (4 days overdue), !622 (7 days left), then undated rows by waiting count 1,1,1,0,0. Tooltip: Sorted for your review: soonest due date first, then most discussions waiting for you, then fewest discussions you wrote in. The written-in tie-break was not checked.",
      "pass": true
    },
    {
      "recipe": "light A1 (Settings, Theme, Light; fresh session)",
      "observed": "Box line and panel header: Dmitri Volkov's turn (/tmp/mrfv-light-thread.png).",
      "pass": true
    },
    {
      "recipe": "light B1",
      "observed": "27/27 OK. In light the mark is theme primary rgb(56,113,225), which is blue; plain is rgb(0,0,0).",
      "pass": true
    },
    {
      "recipe": "light B2 mouse click",
      "observed": "800 ms after Shift, a click on Resolve thread: purple=false, box No open discussions, Resolved.",
      "pass": true
    },
    {
      "recipe": "light step 3: Dmitri Volkov, Anna Berg",
      "observed": "Dmitri: all boxes 0 of N wait for Dmitri Volkov, all plain. Anna: purple exactly on 1 of 1 / 1 of 2. Tooltip: Sorted for Anna Berg's review: ... waiting for Anna Berg, then fewest discussions Anna Berg wrote in.",
      "pass": true
    },
    {
      "recipe": "light C1/C2/Back",
      "observed": "Same as dark: page stays on every Escape. Reviewer menu closes on Escape. Back by Enter and by click leave the page.",
      "pass": true
    },
    {
      "recipe": "light D1-D5",
      "observed": "Order !603, !622, !633, !618, !623, !638, !608. Tooltip has the D5 words (/tmp/mrfv-light-sort2.png).",
      "pass": true
    }
  ],
  "environment": "HEAD 3c37f5e0; rustc 1.99.0, node v26.13.0, pnpm 12.0.0; MiniBrowser WebKit on the private display via just app-session; both sessions stopped."
}
