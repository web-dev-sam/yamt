# SidebarNextFileWeb

Agent output (`agent://SidebarNextFileWeb`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/SidebarNextFileWeb.md), collected 2026-11-25T11:26:29.888Z.

{
  "summary": "After Reviewed (range window) and after Mark resolved/Keep/Delete/Take (merge window), the next file is now the next file row the sidebar shows in its current view. `fileTree.ts` `sidebarOrder` is the single order rule, built on `treeRows` with every folder counted as open. Each window store owns one `createFileListMode()` as `listMode`, and `FileList.vue` takes it as the `mode` prop plus a `toggleMode` event. The range sidebar heading shows a muted `leftToReview` total (`+a −r`) left of the toggle; its title and accessible name are \"left to review\".",
  "files_changed": [
    "frontend/src/ui/fileTree.ts",
    "frontend/src/ui/fileListMode.ts",
    "frontend/src/ui/opening.ts",
    "frontend/src/ui/rangeReviewed.ts",
    "frontend/src/ui/store.ts",
    "frontend/src/ui/rangeStore.ts",
    "frontend/src/ui/rangeFolderSums.ts",
    "frontend/src/ui/rangeText.ts",
    "frontend/src/ui/FileList.vue",
    "frontend/src/ui/App.vue",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/RangeCounts.vue",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ui/fileTree.test.ts",
    "frontend/src/ui/rangeFolderSums.test.ts",
    "frontend/src/ui/rangeReviewed.test.ts",
    "frontend/src/ui/store.test.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/useRangeController.test.ts"
  ],
  "tests_added": [
    {
      "name": "fileTree.test.ts sidebarOrder: the list keeps the given order; the tree puts folders first and root files after them",
      "proves": "a.txt, b/x.txt, c.txt → list keeps the given order; tree gives b/x.txt, a.txt, c.txt; switching the mode switches the order"
    },
    {
      "name": "fileTree.test.ts sidebarOrder: the tree walks a joined chain's files at its place, sorted by name",
      "proves": "files inside a joined chain a/b/c sit at the chain's tree place, sorted by name, with root files last"
    },
    {
      "name": "fileTree.test.ts sidebarOrder: the list returns the very same files, the tree only file rows",
      "proves": "list mode returns the same array untouched; tree mode returns only file rows"
    },
    {
      "name": "rangeReviewed.test.ts in tree mode Reviewed opens the next not-reviewed tree row, not the list's next; the list mode follows the list",
      "proves": "with the git list reversed, tree mode goes to the next tree row; after toggling back to list mode the next file follows the list"
    },
    {
      "name": "rangeReviewed.test.ts in tree mode Reviewed on the last tree row wraps to the first tree row",
      "proves": "wrapping follows the tree order (config → data/big.txt), not the list's (which would give vendor/ui)"
    },
    {
      "name": "rangeReviewed.test.ts a mark before the window knows its files … (list|tree view)",
      "proves": "with no start yet, either mode stores the mark and shows nothing; kills the `?? []` mutant"
    },
    {
      "name": "store.test.ts a take in %s view opens the next unresolved row of that view",
      "proves": "merge window move-on goes to z.ts in list view and b/c.ts in tree view, using the store's one listMode"
    },
    {
      "name": "rangeStore.test.ts the store's one list mode drives Reviewed's next file",
      "proves": "rangeStore.listMode is the same instance Reviewed reads (no second mode ref)"
    },
    {
      "name": "rangeFolderSums.test.ts leftToReview: skips reviewed …, ignores notCounted",
      "proves": "\"reviewed\" files are skipped; \"changedSinceReview\" and unmarked files count whole; notCounted files are ignored"
    },
    {
      "name": "rangeFolderSums.test.ts leftToReview: one file / every reviewed / only notCounted left",
      "proves": "one file gives exactly its counts (zeros kept); all reviewed → notCounted; only notCounted files left → notCounted"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && pnpm -C frontend lint && pnpm -C frontend fmt:check && pnpm -C frontend test",
      "observed": "vue-tsc -b clean; oxlint+eslint clean; \"All matched files use the correct format.\"; Test Files 316 passed (316), Tests 4803 passed (4803)"
    },
    {
      "command": "just web-unused; just sfc-order; just arch-check",
      "observed": "knip clean (no output); check-sfc-order clean; \"arch-check: ok\""
    },
    {
      "command": "just app-session start-fixture --name sn --range-case review --reviewed seeded; read aside h2 parent outerHTML",
      "observed": "<h2 class=\"mr-auto …\">Files</h2><span … role=\"group\" title=\"left to review\" aria-label=\"left to review\"><span class=\"text-fg-muted\">+62</span><span class=\"text-fg-muted\">−67</span></span><button … aria-label=\"View as tree\">. The heading total is +64 −67 minus keys.md (reviewed, +2 −0) = +62 −67"
    },
    {
      "command": "dark: getComputedStyle(total span).color vs --color-fg-muted; shot /tmp/sn-dark.png",
      "observed": "color rgb(129,126,141) = --color-fg-muted #817e8d; screenshot shows a grey \"+62 −67\" just left of the list icon, while file rows keep green/red"
    },
    {
      "command": "click Reviewed (on config +1 −1), read total; click data/big.txt-advanced Reviewed again",
      "observed": "total +62 −67 → shown data/big.txt, total +61 −66; second Reviewed → shown docs/current.md, total +60 −66"
    },
    {
      "command": "click config row (reviewed), click Reviewed (unmark), read total",
      "observed": "shown config, total +60 −66 → +61 −67 (config's +1 −1 returned)"
    },
    {
      "command": "hover --name sn \"left to review\" --role group",
      "observed": "{\"hovered\":{\"role\":\"group\",\"name\":\"left to review\"}}; title attribute \"left to review\" (native tooltip not capturable: shot --display is only available in start-app sessions)"
    },
    {
      "command": "Settings → Light, Back; read colours; shot /tmp/sn-light.png",
      "observed": "theme light; total color rgb(115,118,124) = light --color-fg-muted #73767c, while the row's added colour is rgb(32,138,60); screenshot shows a muted \"+61 −67\" left of the toggle"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 622 killed, 1 timeout, 19 survived, 8 no coverage (95.85%); rangeReviewed.ts and rangeFolderSums.ts 100%",
    "survivors": []
  },
  "acceptance_not_run": [
    "The native title tooltip pop-up was not captured on screen: `app-session shot --display` refuses fixture sessions. The hover was observed through the accessible-name lookup (role group, name \"left to review\") and the title attribute."
  ],
  "deviations_from_brief": [
    "frontend/src/ui/useRangeController.test.ts:16,581 (granted by Main): imports createFileListMode and adds `listMode: createFileListMode()` to the rangeReviewed window it builds.",
    "FileList.vue's slot is named `total`; the event is `toggleMode` (`@toggle-mode` in the parents).",
    "The total's span gets role=\"group\": ARIA does not allow an aria-label on a generic span, and a group keeps the counts readable after the name.",
    "Window types read the mode as `listMode: Pick<FileListView, \"mode\">`, with the new `FileListView` type in fileListMode.ts. In store.ts, `listMode` is exposed through `Actions` (next to `search`) so createAppStore stays within 40 lines.",
    "Docs outside Owned still describe the old state and need the docs keeper: docs/architecture.md:895 (rangeReviewed next file), :1766 and .omp/skills/project-map/state.md:48 (FileList.vue owns the mode → the window stores own `listMode`), :2174 and tree.md:246,265 (add `sidebarOrder`; FileList gets `mode` and emits `toggleMode`; `leftToReview`)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/FileList.vue:57",
      "risk": "A long total such as +12345 −6789 in a narrow panel could squeeze the \"Files\" heading; only checked at the default width."
    },
    {
      "location": "frontend/src/ui/opening.ts:70",
      "risk": "sidebarOrder now runs on every move-on, even when the user opened another file meanwhile (the result is then dropped). This costs O(n log n) per write; I left it for readability."
    }
  ]
}
