# MrWindowCore

Agent output (`agent://MrWindowCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowCore.md), collected 2026-10-30T13:46:40.449Z.

{
  "summary": "New self-contained, framework-free `frontend/src/mergeRequests/` core (index.ts + internal/ filters, choices, order, summary, relativeTime, ciBox, stored, one node test each, AGENTS.md). It is registered in fences.ts, the oxlint override and the vitest node include. New `ui/glab.ts` holds the glab sentences and RECHECK_PAUSE_MS: rangeThreadText.ts and rangeGitLab.ts now import them, with no second copy and no re-export. New `ui/mergeRequestFilters.ts` `createRememberedFilters`: localStorage `yamt.mergeRequests.filters` keyed by repository.",
  "files_changed": [
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/mergeRequests/internal/filters.ts",
    "frontend/src/mergeRequests/internal/filters.test.ts",
    "frontend/src/mergeRequests/internal/choices.ts",
    "frontend/src/mergeRequests/internal/choices.test.ts",
    "frontend/src/mergeRequests/internal/order.ts",
    "frontend/src/mergeRequests/internal/order.test.ts",
    "frontend/src/mergeRequests/internal/summary.ts",
    "frontend/src/mergeRequests/internal/summary.test.ts",
    "frontend/src/mergeRequests/internal/relativeTime.ts",
    "frontend/src/mergeRequests/internal/relativeTime.test.ts",
    "frontend/src/mergeRequests/internal/ciBox.ts",
    "frontend/src/mergeRequests/internal/ciBox.test.ts",
    "frontend/src/mergeRequests/internal/stored.ts",
    "frontend/src/mergeRequests/internal/stored.test.ts",
    "frontend/src/ui/glab.ts",
    "frontend/src/ui/mergeRequestFilters.ts",
    "frontend/src/ui/mergeRequestFilters.test.ts",
    "frontend/src/ui/rangeThreadText.ts",
    "frontend/src/ui/rangeGitLab.ts",
    "frontend/src/ui/rangeGitLab.test.ts",
    "frontend/scripts/fences.ts",
    "frontend/.oxlintrc.json",
    "frontend/vite.config.ts"
  ],
  "tests_added": [
    {
      "name": "filters.test: any checked value within one filter / every set filter must match across filters",
      "proves": "OR inside a filter, AND across Assignee, Reviewer, Label and Draft"
    },
    {
      "name": "filters.test: Me resolves to the logged-in user, never a username spelled me; Me matches nothing while unknown",
      "proves": "Me is never matched against the literal username \"me\""
    },
    {
      "name": "filters.test: None; Draft all/drafts/ready; toggles; other-family values ignored; cleared; isFiltered; filterLabel table",
      "proves": "None, the three-way Draft, toggle equality (Me ≠ person \"Me\", None ≠ label \"None\"), and \"Reviewer: Me, anna\" / \"Reviewer\""
    },
    {
      "name": "choices.test: Me first, None, others by name; counts over every row; checked values; a checked person/label no longer listed stays with 0",
      "proves": "Checklist order and counts, and that a checked value is kept at 0"
    },
    {
      "name": "choices.test: Label None first; Label's None counts only unlabelled rows; checked None does not bring Me back",
      "proves": "The order of Label's checklist and its None count"
    },
    {
      "name": "choices.test: narrowed any case, trimmed; long checklist narrows",
      "proves": "`narrowed` keeps matching labels, ignoring case and outer spaces"
    },
    {
      "name": "order.test: newest first, ties by higher iid; page joins; duplicate kept once (page copy)",
      "proves": "`merged` removes duplicates and sorts rows, ties included"
    },
    {
      "name": "summary.test: counts; cut list",
      "proves": "\"12 of 40 merge requests\", singular at 1, and the cut suffix"
    },
    {
      "name": "relativeTime.test: 0 s to 800 d table; future time",
      "proves": "createdAgo at 59 s, 1 min, 23 h, 1 d, 6 d, 7 d, 29 d, 30 d, 364 d, 365 d (unit and rounding)"
    },
    {
      "name": "ciBox.test: allowed-to-fail last; more; status words per status",
      "proves": "Allowed-to-fail jobs come last, and with no failed job the box gives the status sentence"
    },
    {
      "name": "stored.test: words, round trip, junk (7 kinds) reads as no filter, unreadable words dropped, Draft reads back",
      "proves": "`filtersFrom` on junk and the stored form"
    },
    {
      "name": "mergeRequestFilters.test: per repository; another repository's entry survives a write; null repository writes nothing; junk storage",
      "proves": "Remembered filters per repository, other repositories' entries kept, a null repository writes nothing"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests src/ui/mergeRequestFilters (after the final edits)",
      "observed": "Test Files  8 passed (8)  Tests  103 passed (103)"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests src/ui/mergeRequestFilters src/ui/rangeGitLab src/ui/rangeThreadText",
      "observed": "Test Files  10 passed (10)  Tests  135 passed (135). rangeThreadText.test.ts is unedited; in rangeGitLab.test.ts only the RECHECK_PAUSE_MS import moved to ./glab"
    },
    {
      "command": "cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm fmt:check && pnpm unused && pnpm sfc-order; echo EXIT=$?",
      "observed": "vue-tsc -b clean; oxlint+eslint clean; Test Files 228 passed (228) Tests 3093 passed (3093); All matched files use the correct format; knip clean; check-sfc-order clean; EXIT=0"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node scripts/fences.test.ts",
      "observed": "Test Files  1 passed (1)  Tests  47 passed (47)"
    },
    {
      "command": "pnpm -C frontend exec tsx -e 'findFenceViolations([{path:\"src/mergeRequests/internal/filters.ts\",text:\"import { ref } from \\\"vue\\\";\"},{path:\"src/mergeRequests/index.ts\",text:\"import { log } from \\\"../ipc\\\";\"}])'",
      "observed": "{rule:\"PM3\", reason:\"mergeRequests/ is framework-free\", file:\"src/mergeRequests/internal/filters.ts\", specifier:\"vue\"}, {rule:\"PM2\", reason:\"mergeRequests/ imports no other src/ module\", file:\"src/mergeRequests/index.ts\", specifier:\"../ipc\"}"
    },
    {
      "command": "pnpm -C frontend exec stryker run (recipe flags) --mutate <mergeRequests/index.ts + 7 internal files, ui/mergeRequestFilters.ts> --ignoreStatic",
      "observed": "All files 98.34 (414 killed, 3 survived, 4 no cov); choices, ciBox, order, relativeTime, summary 100%. The survivors and no-cov mutants are listed in `mutation`."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 567 killed, 14 timeout, 36 survived, 10 no cov, none on my changed lines; glab.ts 100%. mergeRequests/ is not in its globs; by-hand stryker run: 414 killed, 3 survived",
    "survivors": [
      "frontend/src/ui/mergeRequestFilters.ts:13 `stored !== null`→true — equivalent: typeof null is \"object\" and {...null} is {}, so the result is the same",
      "frontend/src/ui/mergeRequestFilters.ts:26 warn event string→\"\" — wiring: the log name passed to storedValue (windowStorage.test covers the logging)",
      "frontend/src/mergeRequests/internal/stored.ts:46 `return []`→[\"Stryker was here\"] — equivalent: personFrom/labelFrom drop the unreadable word",
      "frontend/src/mergeRequests/internal/filters.ts:47,128 NoCoverage `default` never-arms — gate-covered: TS3 exhaustiveness checked by vue-tsc"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "justfile `mutants` web_globs lacks the new module. Needed: add 'frontend/src/mergeRequests/*.ts' 'frontend/src/mergeRequests/internal/*.ts' (justfile is not mine). I ran stryker on those files by hand with the recipe's flags.",
    "fences.test.ts (not mine) has no mergeRequests cases. Suggest copies of search's PM3, PM2 and \"importing itself is fine\" tests with src/mergeRequests paths. I showed the refusal through findFenceViolations.",
    "project-map, for the docs keeper. tree.md: a `frontend/src/mergeRequests` row like search's, plus `ui/glab.ts` and `ui/mergeRequestFilters.ts` in the ui row. state.md: remembered MR filters, owner ui/mergeRequestFilters.ts (`set` only), localStorage yamt.mergeRequests.filters. map-check passes now only because it reads git ls-files.",
    "mergeRequestFilters.ts `readByRepository` repeats serverPins.ts's private `readPins` object check. Suggest moving it into windowStorage.ts as `storedRecord(raw)` (that file is not mine).",
    "Contract types and NARROW_FROM have no non-test importer until B4/B5, so knip would flag them. The tests use them as typed tables and fixture sizes instead of adding a knip exception.",
    "Choices (open in the brief): None always listed. Person label = name, ties in GitLab's order. A checked person no longer listed shows their username. A checked Me while me is unknown shows first with 0. `narrowed` matches labels only, ignoring case and outer spaces. A person value toggled into Label (or a label into Assignee/Reviewer) is ignored.",
    "More choices: `merged` keeps the page's copy of a duplicate iid. Summary is singular at 1 loaded; its cut suffix uses `loaded`, not a second 500. A future createdAt reads \"created just now\". Manual status: \"Pipeline waiting for a manual job\". Filters set back to none remove the repository's entry, as serverPins does. `filtersFrom` reads each word on its own."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/ciBox.ts:21",
      "risk": "The wording \"Pipeline waiting for a manual job\" is my choice; the design only gives \"Pipeline running\" and \"Pipeline passed\". B4's mergeRequestsText may want to own all CI words."
    },
    {
      "location": "frontend/src/mergeRequests/internal/choices.ts:22",
      "risk": "Checklist order uses localeCompare(\"en\"), so mixed-case names sort case-insensitively. Reading \"by name\" as a plain code-point order would sort differently."
    },
    {
      "location": "frontend/src/ui/mergeRequestFilters.ts:31",
      "risk": "I2: WebKit localStorage is shared by every yamt process, so two windows writing filters at once means the last write wins."
    }
  ]
}
