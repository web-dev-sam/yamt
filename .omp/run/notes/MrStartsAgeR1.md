# MrStartsAgeR1

Agent output (`agent://MrStartsAgeR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsAgeR1.md), collected 2026-11-03T20:18:36.994Z.

{
  "summary": "I added `ui/useListAge.ts`. It gives the header age left of Refresh its own clock: it reads the time whenever `listedAt` changes, then sets a timeout for the next whole minute after `listedAt`. So the text shows \"just now\" only for the first 60 s and then changes on each minute boundary. `MergeRequestsView.vue` now uses it; the rows stay on the page's minute `useNow`. The wording (`agoText`, `timeTitle`) and `listedAt` are unchanged. `ui/AGENTS.md` describes the new clock.",
  "files_changed": [
    "frontend/src/ui/useListAge.ts",
    "frontend/src/ui/useListAge.test.ts",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "the age reads just now for 59 s and 1 minute ago at 60 s, 2 minutes ago at 120 s (catches a page clock lagging the load)",
      "proves": "Rule A1: the text changes exactly at each whole minute after listedAt."
    },
    {
      "name": "a list loaded 30 s before the page opened turns 1 minute ago 30 s after it (catches a clock counted from mount)",
      "proves": "The timeout counts from listedAt, not from when the page mounted. T0 is deliberately not on a whole minute, which kills the `now + at` mutant."
    },
    {
      "name": "a new listedAt reads just now at once and counts its minute from itself",
      "proves": "After a Refresh the age resets at once, and its minute counts from the new end."
    },
    {
      "name": "no listedAt is no age and no timer; a first one starts both",
      "proves": "While listedAt is null there is no age and no timer; the first listedAt starts both."
    },
    {
      "name": "listedAt turning null stops the timer",
      "proves": "When listedAt becomes null the age is null and no timer is left running."
    },
    {
      "name": "the hover follows the clock across midnight",
      "proves": "The `timeTitle` hover uses the composable's ticking `now`: it switches from clock text to the date-and-time text after midnight."
    },
    {
      "name": "unmount stops the timer",
      "proves": "Stopping the scope (unmount) clears the timeout."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend fmt:check; pnpm -C frontend unused",
      "observed": "oxlint --type-aware && eslint: no output. vue-tsc -b: no output. oxfmt: \"All matched files use the correct format.\" knip: no output."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 276 passed (276), Tests 4165 passed (4165). Afterwards only T0 in useListAge.test.ts changed; I re-ran that file (7 passed) plus oxlint and oxfmt on it: clean."
    },
    {
      "command": "just app-session start-fixture --name age --diff --mr list; click \"Merge requests\" --role button; read header age",
      "observed": "20:15:08.687Z age \"just now\" (shown right after the click; the list ended before this). 20:15:58.747Z \"just now\"; hover aria-description \"21:15\". 20:16:07.782Z \"just now\". 20:16:17.006Z \"1 minute ago\"."
    },
    {
      "command": "same session: click \"Refresh\" --role button, then read at about +55 s and +65 s",
      "observed": "20:16:24.771Z \"just now\" tip \"21:16\" (resets at once). 20:17:17.993Z (about 53 s) \"just now\". 20:17:28.220Z (about 63 s) \"1 minute ago\" tip \"21:16\". Session stopped afterwards."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → useListAge.ts 21 mutants: 17 killed, 2 timeout, 2 survived (90.48%)",
    "survivors": [
      "frontend/src/ui/useListAge.ts:17 `{ immediate: false }` → `{ immediate: true }` — equivalent: the watch's immediate `read()` restarts the timeout right away (or stops it when listedAt is null), so the extra start never fires.",
      "frontend/src/ui/useListAge.ts:17 `{ immediate: false }` → `{}` — equivalent, same reason (the default is immediate true)."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "tree.md is not in Owned, so `just map-check` (PM6) needs a row for the new file. Insert after tree.md line 232: `useListAge.ts (`useListAge(listedAt)`: the page's header age `{ text, title }` or null on its own `now`, read at a listedAt change and each whole minute after it, rule A1; MergeRequestsView);`",
    "tree.md line 279 still describes the age as `agoText(listedAt, now)`; it should name `useListAge`.",
    "WebKit timing: the fixture list ended during the click, so I had no exact end time. I read the first load at about 51 s / 60 s (just now) and about 69 s (1 minute ago). A Refresh, whose end was known to within about 1 s, gave about 53 s just now and about 63 s 1 minute ago."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useListAge.ts:6",
      "risk": "`MINUTE_MS = 60_000` now also exists in MergeRequestsView.vue (the rows' clock) and in mergeRequests/internal/relativeTime.ts, each next to its own user (TS14). A reviewer may want one shared constant."
    },
    {
      "location": "frontend/src/ui/useListAge.ts:38",
      "risk": "If the system clock jumps backwards so listedAt is in the future, the delay can be up to two minutes, so one extra early tick may happen. The text stays right (\"just now\"); I did not handle this case specially."
    }
  ]
}
