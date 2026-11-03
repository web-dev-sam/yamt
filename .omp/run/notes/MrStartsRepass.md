# MrStartsRepass

Agent output (`agent://MrStartsRepass`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsRepass.md), collected 2026-11-03T20:24:01.042Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A. just check at cbe68a8c",
      "observed": "Exit 0 in 44.8 s. Last lines: golden run 'ok vueuse-use-magic-keys', the sfc-order check, and hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "B1 start-fixture --name age --diff --mr list --size 1600x1000; open Merge requests; hover the age",
      "observed": "The header DOM is <div class=\"ml-auto flex items-center gap-3\"><span class=\"text-fg-muted\" aria-description=\"21:20\">just now</span><button …> Refresh</button></div>. Hovering the span showed a '21:20' tooltip (today's HH:MM) under the muted 'just now', directly left of Refresh. Screenshot: /tmp/vf-age-hover.png",
      "pass": true
    },
    {
      "recipe": "B2 wait about 55 s and about 65 s with no click (compare window)",
      "observed": "The list loaded between 21:20:08 (start) and 21:20:13 (click). With no click, polls every 2 s read 'just now' at 21:20:50 through 21:21:12, then '1 minute ago' at 21:21:14, 21:21:16 and 21:21:19.",
      "pass": true
    },
    {
      "recipe": "B2 in the range window (--range-case review --mr list)",
      "observed": "Clicked open at 21:22:17. It read 'just now' at 21:22:20 and at 21:23:13, 21:23:15 and 21:23:17, then '1 minute ago' from 21:23:19 through 21:23:32, with no click.",
      "pass": true
    },
    {
      "recipe": "B3 start-fixture --mr slow: open, wait for the list, click Refresh",
      "observed": "While loading [age null, 1 spinner]. After the load: 'just now', 0 spinners, hover time 21:21. Read right after clicking Refresh at 21:22:00: ['just now', aria-description '21:21', 1 spinner], so the earlier value is kept while the spinner runs (/tmp/vf-slow-refresh.png). At 21:22:05: ['just now', '21:22', 0 spinners], the new load time.",
      "pass": true
    },
    {
      "recipe": "B4 shot of the header in yamt Dark and yamt Light; step 1 in the range window",
      "observed": "Dark (dataset.theme 'dark'): /tmp/vf-hdr-dark.png. Light, set from the session (dataset.theme='light'): /tmp/vf-hdr-light.png, which shows the muted '1 minute ago' left of Refresh and the '21:20' tooltip. Range window: 'just now' sits 12 px left of 'Refresh', hover tooltip '21:22' (/tmp/vf-range-hover.png).",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. MiniBrowser/WebKitWebDriver on a private display via just app-session. All sessions (age, slow, rng) stopped; no yamt, MiniBrowser or WebKitWebDriver processes left (only the editor's oxlint/oxfmt LSPs, which are not from this run)."
}
