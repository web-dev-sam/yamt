# MrWindowCoreR1

Agent output (`agent://MrWindowCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowCoreR1.md), collected 2026-10-30T14:26:36.612Z.

{
  "summary": "`ui/windowStorage.ts` now has one shared helper for a record kept per key, `storedRecord(key, warnEvent, storage)`. It offers `entryAt`, `set` (the other keys' entries stay as written) and `remove`. `serverPins.ts` and `mergeRequestFilters.ts` both use it, and `readPins`/`readByRepository` are deleted. `sameValue` now compares kind plus username or title, and `valueWord` is only used for display. `fences.test.ts` has the PM3, PM2 and self-import cases for `src/mergeRequests/`.",
  "files_changed": [
    "frontend/src/ui/windowStorage.ts",
    "frontend/src/ui/windowStorage.test.ts",
    "frontend/src/ui/serverPins.ts",
    "frontend/src/ui/serverPins.test.ts",
    "frontend/src/ui/mergeRequestFilters.ts",
    "frontend/src/ui/mergeRequestFilters.test.ts",
    "frontend/src/mergeRequests/internal/filters.ts",
    "frontend/src/mergeRequests/internal/filters.test.ts",
    "frontend/src/mergeRequests/internal/choices.test.ts",
    "frontend/scripts/fences.test.ts"
  ],
  "tests_added": [
    {
      "name": "windowStorage.test: a record entry is set under its key; another key's entry stays as written",
      "proves": "the shared helper keeps another key's entry exactly as written, even an odd shape"
    },
    {
      "name": "windowStorage.test: a set replaces the key's entry; a remove drops the key and keeps the others",
      "proves": "an emptied key is removed once, in the shared helper, and the other entries survive"
    },
    {
      "name": "windowStorage.test: a record stored as %s reads as empty, and a set starts afresh (4 cases)",
      "proves": "non-JSON, an array, null or a number reads as an empty record; kills the Array.isArray and typeof mutants"
    },
    {
      "name": "filters.test: two people with the same name stay two values when toggled",
      "proves": "toggle identity is the username: two people with the same name stay apart, and a second toggle removes only its own"
    },
    {
      "name": "filters.test: two labels stay two values when toggled; a second toggle removes only its own",
      "proves": "label identity is the title"
    },
    {
      "name": "choices.test: of two people with the same name only the checked one shows checked",
      "proves": "`checked` uses the payload identity, not the display name"
    },
    {
      "name": "fences.test: mergeRequests importing vue, @vueuse, @tauri-apps or an icon component violates PM3",
      "proves": "`mergeRequests` is listed in FRAMEWORK_FREE_MODULES"
    },
    {
      "name": "fences.test: mergeRequests importing any other src/ module violates PM2",
      "proves": "`mergeRequests` is self-contained, including the `../mergeRequestsx` prefix trap"
    },
    {
      "name": "fences.test: mergeRequests importing itself, and ui importing mergeRequests' index, violate nothing",
      "proves": "self-imports and ui → index are allowed"
    },
    {
      "name": "serverPins.test / mergeRequestFilters.test: a storage that throws on write … logs under the store's event",
      "proves": "each store passes its own warn event to the shared helper (kills the event-string mutants)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  233 passed (233)\n      Tests  3207 passed (3207)"
    },
    {
      "command": "pnpm -C frontend fmt:check / unused / sfc-order",
      "observed": "All matched files use the correct format. knip: no output, exit 0. check-sfc-order: no output, exit 0."
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "FAILS at HEAD, only outside this slice: src/ipc/{mergeRequestDomain,fixtureMergeRequestData,fixtureMergeRequests,tauriMergeRequests}.ts and src/ui/{mergeRequests,mergeRequestsText}.ts. bindings has no exported member 'MergeRequestRow', 'Pipeline', 'ListEnd', 'OpenReply', … No error in any owned file."
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "FAILS only in src/ipc/mergeRequestDomain.ts, fixtureMergeRequestData.ts, fixtureMergeRequests.test.ts and src/ui/mergeRequests.test.ts: 'error' types act as 'any' because of the same missing bindings. Filtering the lint output for the owned files gave nothing."
    },
    {
      "command": "just bindings-check | grep -c '^[-+]'",
      "observed": "0: bindings.ts matches the Rust export, so the Rust side lacks those types at HEAD (left to the Rust slice)."
    },
    {
      "command": "temporary probe in fences.test.ts: PM3/PM2 cases with src/mergeRequestz (a module not in FRAMEWORK_FREE_MODULES), then removed",
      "observed": "× PROBE unlisted module: Expected [{file src/mergeRequestz/index.ts, rule PM3, specifier vue}] Received []\n× PROBE unlisted module PM2: expected [] to have a length of 1 but got +0"
    },
    {
      "command": "temporary probe: round-1 sameValue body restored, then vitest run --project node src/mergeRequests",
      "observed": "Tests  96 passed (96): the new same-name tests do not fail on round 1's code (see acceptance_not_run)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → mutants: no Rust changes; stryker: 245 killed, 5 survived, 6 no coverage; mergeRequestFilters.ts 100%, serverPins.ts 95%, windowStorage.ts 97.22%, filters.ts 95.06%",
    "survivors": [
      "frontend/src/mergeRequests/internal/filters.ts:41 `b.kind === \"person\"` → true — equivalent: a b of another kind has no username, and undefined never equals a string",
      "frontend/src/mergeRequests/internal/filters.ts:43 `b.kind === \"label\"` → true — equivalent: a b of another kind has no title, and undefined never equals a string",
      "frontend/src/mergeRequests/internal/filters.ts:44 default exhaustive arm (NoCoverage) — equivalent: unreachable, `a` is `never` there",
      "frontend/src/ui/serverPins.ts:29 `root.value === null` → false — equivalent: entryAt(null) reads key \"null\", which no absolute repository root can be",
      "frontend/src/ui/windowStorage.ts:42 `stored !== null` → true — equivalent: spreading null gives {}, the same empty record",
      "frontend/src/ui/serverPins.ts:12 STORAGE_KEY string — not a changed line (only moved up); module-level static under --ignoreStatic"
    ]
  },
  "acceptance_not_run": [
    "#1927: no test can fail on round 1's code, since its valueWord already returned the username or title. With the round-1 body restored, all 96 tests passed. The new tests guard against display words switching to names.",
    "Fence self-import case: removing mergeRequests from the table cannot make it fail, because it expects no violations either way. Only the PM3 and PM2 cases fail (probe with an unlisted module; fences.ts is not owned).",
    "typecheck and lint pass on owned files only. Both fail at HEAD on the missing merge-request bindings, outside this slice."
  ],
  "deviations_from_brief": [
    "Helper shape decided here: `storedRecord(key, warnEvent, storage?)` returns `{ entryAt(at), set(at, entry), remove(at) }`, with separate set and remove methods rather than a null sentinel. Each caller decides emptiness: pins use an empty list, filters use `!isFiltered`.",
    "New tests added to serverPins.test and mergeRequestFilters.test, each checking the store's warn event on a failing write. The existing assertions are unchanged.",
    "Docs not owned: `.omp/skills/project-map/tree.md:158` and `docs/architecture.md:795-796` should name `storedRecord` beside `storedValue` (for the docs keeper)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/bindings.ts (HEAD)",
      "risk": "Typecheck and lint of the merged tree stay red until the Rust slice exports MergeRequestRow, Pipeline, ListEnd, OpenReply, … and bindings are regenerated."
    },
    {
      "location": "frontend/src/ui/windowStorage.ts:58",
      "risk": "`entryAt` indexes a plain object, so a key like \"__proto__\" would read Object.prototype. This is unchanged from round 1's readPins and readByRepository, and roots are absolute paths."
    }
  ]
}
