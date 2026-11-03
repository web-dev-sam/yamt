# MrStartsAge

Agent output (`agent://MrStartsAge`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsAge.md), collected 2026-11-03T19:41:59.497Z.

{
  "summary": "The merge-request header now shows how old the list is, left of Refresh, in muted text (core `agoText`). Hovering it shows `HH:MM` when the time is today, else `dateTimeText`, through `v-tooltip`. Nothing shows until a list has loaded. The time is `listedAt` in `ui/mergeRequests.ts`, written only by `ended` on an end with no failure text. A refresh in progress, a thrown call or a failure end leave it unchanged. The new core function is `timeTitle(at, now)` in `mergeRequests/internal/dueDate.ts`; `dateTimeText` now shares its `clockText` helper.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/dueDate.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/internal/dueDate.test.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "timeTitle is the clock alone on now's local day and the full date otherwise, at both day edges",
      "proves": "23:59 vs 00:00 local in both directions, a time ahead of now on the same day (clock only) and ahead across midnight (full date)"
    },
    {
      "name": "timeTitle compares local days, not UTC days (catches getUTCDate)",
      "proves": "In the file's pinned zone, a pair on the same UTC day but different local days, and the reverse, read as local days"
    },
    {
      "name": "listedAt is null through the first load and its end's time once listed (catches an age before the list)",
      "proves": "Null while the first load streams pages; set to the end's Date.now() on a listed (cut) end"
    },
    {
      "name": "a first load ending %j leaves listedAt null",
      "proves": "A first load ending in failed, notLoggedIn or a thrown call (ok:false) leaves it null"
    },
    {
      "name": "a refresh keeps listedAt while it runs and writes its end's time once listed (catches the age reset at the click)",
      "proves": "The old time stays during the refresh; the swap writes the new end time"
    },
    {
      "name": "a refresh ending %j keeps the shown list's listedAt (catches the age of a list never shown)",
      "proves": "A refresh ending with a failure text or ok:false keeps the old time"
    },
    {
      "name": "a refresh whose call throws keeps listedAt",
      "proves": "A rejected listMergeRequests on refresh keeps the time; the problem is reported"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; fmt:check; test; unused; sfc-order (rerun after the last edit)",
      "observed": "oxlint + eslint no output (clean); vue-tsc -b clean; 'All matched files use the correct format.'; 'Test Files 274 passed (274) Tests 4147 passed (4147)'; knip and sfc-order no output"
    },
    {
      "command": "just app-session start-fixture --name age --diff --mr list --size 1600x1000; click 'Merge requests'; read the header",
      "observed": "header innerText 'Back\\nMerge requests\\njust now\\nRefresh'; group class 'ml-auto flex items-center gap-3'; the age span's next sibling is Refresh; colour rgb(129,126,141) (muted). Screenshot target/age-header.png"
    },
    {
      "command": "hover 'header .ml-auto span'; read .hover-tooltip (dark theme)",
      "observed": "tip [['20:35', false]] (list ended 20:35, page clock 20:37:33); span text '1 minute ago' after the minute tick; aria-description '20:35'. Screenshot target/age-hover.png shows the tip under the age"
    },
    {
      "command": "set <html data-theme=light>; hover the age; shot",
      "observed": "Light theme screenshot target/age-light.png: muted '1 minute ago' left of Refresh, tip '20:35'"
    },
    {
      "command": "(--mr list) click Refresh; read",
      "observed": "{age:'just now', title:'20:37'}"
    },
    {
      "command": "just app-session start-fixture --name age --diff --mr slow; open; wait about 2 minutes; click Refresh; poll header every second",
      "observed": "20:40:29 '1 minute ago | Refresh'; after the click at 20:40:34 '1 minute ago | Refresh', spin:true (screenshot target/age-slow-refresh.png: disabled spinning Refresh, old age kept); 20:40:36 'just now | Refresh', spin:false"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → no Rust changes; Stryker on dueDate.ts and ui/mergeRequests.ts: 284 mutants, 258 killed, 26 survived, 90.85%",
    "survivors": []
  },
  "acceptance_not_run": [
    "--mr pageFails after a good load: one fixture script cannot reach it (as the brief says). Unit tests pin it instead: 'a refresh ending {failed…} keeps the shown list's listedAt' and the first-load failure cases."
  ],
  "deviations_from_brief": [
    "ui/mergeRequests.ts was exactly at oxlint max-lines 300 at base. With Main's approval (option b) I removed `listingOf` and put `listing`, `listedAt` and the `failure` computed directly in `createMergeRequests`'s return. Behaviour is unchanged; the file is now 299 lines and the function 39.",
    "The brief asked for a west-zone test. The draft test passed under plain vitest but failed Stryker's dry run. I replaced it with UTC-day-crossing pairs under the file's pinned Europe/Berlin, which still catches a UTC-day comparison. [INFERENCE] Stryker's runner ignores a TZ change made at runtime.",
    "dueDate.ts: extracted a private `clockText` from `dateTimeText` so `HH:MM` is written once; `dateTimeText`'s output is unchanged.",
    "The new state is named `listedAt`; the core function is `timeTitle(at, now)`.",
    "mergeRequests/AGENTS.md: added a `timeTitle` entry (owned under mergeRequests/**)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:80",
      "risk": "`now` ticks every 60 s from mount, not from the load, so '1 minute ago' can appear up to about 2 minutes after the load. Seen in WebKit: still 'just now' at about 85 s."
    },
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:39",
      "risk": "A missing `vTooltip` import passed lint, vue-tsc and every test; only WebKit showed it (no aria-description). No detector catches an unresolved directive."
    },
    {
      "location": "frontend/src/mergeRequests/internal/dueDate.test.ts:186",
      "risk": "Zone tests rely on TZ=Europe/Berlin being in effect. This machine is CET, so Stryker's run also matches; a non-CET machine under Stryker could fail them, as with the existing Berlin tests."
    }
  ]
}
