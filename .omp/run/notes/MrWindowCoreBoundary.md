# MrWindowCoreBoundary

Agent output (`agent://MrWindowCoreBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowCoreBoundary.md), collected 2026-10-30T13:55:29.032Z.

{
  "verdict": "fail",
  "checked": [
    "All changed files are in Owned. mergeRequests/ imports only its own files, no vue/@vueuse/tauri. mergeRequestFilters.ts uses ../mergeRequests index only. fences.ts self-contained (PM2) and oxlint PM3 list extended.",
    "index.ts exports match design §6 B2 and the §2.1 types. Stored form: keyed by repository, other entries kept, an entry back at no filter removed. summaryText's TS7 shape is fixed by the brief.",
    "Cutover is clean. RECHECK_PAUSE_MS and the glab sentences live only in ui/glab.ts, with no re-export from rangeGitLab.ts and no other importer (grep). rangeThreadText.test.ts is unedited.",
    "No code comments in the patch. AGENTS.md matches search/AGENTS.md's form. Citing a .omp/run/notes design note follows plan.md #72–#128.",
    "Deviations accepted, for the orchestrator: justfile mutants globs, fences.test cases, tree.md rows, and a state.md row (yamt.mergeRequests.filters, writer createRememberedFilters.set). Map and docs are deferred by the brief.",
    "Open risks accepted: the manual-status wording is B4's call. localeCompare('en') matches language.ts and fixture.ts. I2 (last write wins) is the design's inference."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestFilters.ts",
      "line": 11,
      "severity": "block",
      "rule_id": "growth-copied-decision",
      "problem": "The per-repository localStorage record now exists twice. readByRepository copies serverPins.ts readPins (16-21), and set's rule (drop this key, keep the others as written, remove the entry when empty; lines 39-44) copies togglePin (serverPins.ts:55-59). A later fix to that rule will reach one store only.",
      "fix": "Extend ownership to windowStorage.ts and serverPins.ts. Add one helper there (e.g. storedByKey plus withEntry(record, at, value|null)), use it from both stores, and delete readPins and readByRepository."
    },
    {
      "file": "frontend/src/mergeRequests/internal/filters.ts",
      "line": 36,
      "severity": "should",
      "problem": "sameValue takes a value's identity from valueWord, which is also filterLabel's button text. If the owner vetoes 'filter buttons name usernames' (design §9) and valueWord shows names, toggling and choices.checked would merge two people with the same name.",
      "fix": "Have sameValue switch on a.kind and compare b's kind and payload directly (username or title), and keep valueWord for display only."
    },
    {
      "file": "frontend/src/mergeRequests/internal/stored.ts",
      "line": 44,
      "severity": "nit",
      "problem": "wordsOf's `field: keyof StoredFilters` also accepts \"draft\", which is not a word list; nothing gets harder as the app grows.",
      "fix": "Type the parameter as ListFilter, imported from ./filters."
    }
  ]
}
