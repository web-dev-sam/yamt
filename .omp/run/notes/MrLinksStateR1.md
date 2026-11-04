# MrLinksStateR1

Agent output (`agent://MrLinksStateR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksStateR1.md), collected 2026-11-04T02:20:40.301Z.

{
  "summary": "All four findings are fixed. The links lookup has its own file, `ipc/linksDomain.ts` with its tests. Links pages are now branded https-only through the one `toWebPage`, so an http page fails. `useRowLinks` and `useRowDiscussions` both return the new shared `useAskedRow` in `ui/mergeRequestActions.ts`. `ListState` has one `rowsReplaced(rows)`, built in `mergeRequests.ts` from both queues. Exported names and signatures did not change.",
  "files_changed": [
    "frontend/src/ipc/linksDomain.ts",
    "frontend/src/ipc/linksDomain.test.ts",
    "frontend/src/ipc/descriptionDomain.ts",
    "frontend/src/ipc/descriptionDomain.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestLinks.ts",
    "frontend/src/ipc/fixtureMergeRequestLinks.test.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestActions.ts",
    "frontend/src/ui/mergeRequestDiscussions.ts",
    "frontend/src/ui/mergeRequestLinks.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequestsList.ts"
  ],
  "tests_added": [
    {
      "name": "linksDomain.test.ts every_links_page_is_branded_and_a_non_https_one_fails",
      "proves": "Every page made from https passes unchanged. For each of the 6 page fields (every line kind and shown.parent.page), an http:// or ftp:// page throws \"<field> must be an https address, got ...\"."
    },
    {
      "name": "linksDomain.test.ts a_links_refusal_passes_unchanged",
      "proves": "Moved from descriptionDomain.test.ts: glabMissing, notLoggedIn and failed come back as the same object."
    },
    {
      "name": "tauriMergeRequests.test.ts readLinks_calls_the_command_with_the_iid_and_brands_the_pages (amended)",
      "proves": "The command reply is branded from https, and an http:// commit page rejects with the https message."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b (no errors, exit 0)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — exit 0. An earlier run failed on domain.ts max-lines (302 > 300); the fix is described in deviations."
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend sfc-order",
      "observed": "$ tsx scripts/check-sfc-order.ts (exit 0)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  289 passed (289); Tests  4317 passed (4317). This includes the existing mergeRequestLinks, mergeRequestDiscussions (the box asks again when its entry vanishes) and refresh / failed-first-load tests."
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exported types (8): LinkedCommit, LinkedEpic, LinkedIssue, LinkedParent in index.ts and linksDomain.ts. These are expected until the page slice imports them."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 876 killed, 13 survived, 7 no coverage, score 97.77% (linksDomain.ts and descriptionDomain.ts 100%)",
    "survivors": [
      "frontend/src/ui/mergeRequestActions.ts:92 `=== undefined` → `!== undefined` — equivalent: the watch fires whenever that boolean changes, and the ask depends only on isOpen.",
      "frontend/src/ui/mergeRequestsList.ts:107 rowsReplaced([]) → ([\"Stryker was here\"]) — equivalent: a string has no openDiscussions, so listed() queues nothing, as for []; the links drop ignores rows."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2315: `toWebPage` is exported once from ipc/mergeRequestDomain.ts, where the private copy already was, not from domain.ts. Exporting it from domain.ts pushed domain.ts to 302 lines, over the 300-line max-lines cap. linksDomain.ts imports it from there. `isWebPage` stays in domain.ts. There is no second copy.",
    "Main granted edits to ipc/MergeRequestSource.ts (it now imports LinksReply from ./linksDomain) and ipc/mergeRequestDomain.ts (toWebPage exported). mergeRequestDomain.test.ts was not changed.",
    "useAskedRow takes one object parameter { rows, ask, iid, open } (TS7): `() => boolean` can be assigned to `(iid) => void`, so `open` and `ask` could be swapped by position without a type error.",
    "The `rowsReplaced` field in ListState has no comment. `discussionQueue` is narrowed to Pick<DiscussionQueue, \"listed\">, and `linkQueue` is no longer part of ListState.",
    "Docs outside Owned still describe the old place: tree.md (ipc row) and docs/architecture.md (~L1281). They should name linksDomain.ts (toLinksReply via toWebPage, https only) and useAskedRow. That is the docs keeper's job; `just map-check` may flag linksDomain.ts until then."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/fixtureMergeRequestLinks.ts",
      "risk": "The fixture now goes through the https-only toLinksReply. Its tests pass, so every fixture page is https today; any http page added later will throw."
    },
    {
      "location": "frontend/src/ipc/linksDomain.ts:3",
      "risk": "New import edge linksDomain → mergeRequestDomain, for toWebPage. There is no cycle (mergeRequestDomain imports only bindings, domain and validate)."
    }
  ]
}
