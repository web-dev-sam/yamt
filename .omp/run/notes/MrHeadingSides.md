# MrHeadingSides

Agent output (`agent://MrHeadingSides`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingSides.md), collected 2026-11-25T09:16:25.000Z.

{
  "summary": "`WindowKeyTarget` now has `screen`. Off the files screen, `windowKey` answers false before it matches a key and never calls preventDefault, so Ctrl+B and the search key do nothing on settings, server log and merge requests. `SideColumn` gained the `onFiles` prop and hides itself with `v-show`. App and RangeApp pass the prop, and CompareApp's `v-show` on CompareTabList now also checks the files screen. In WebKit the column comes back as it was in all three windows.",
  "files_changed": [
    "frontend/src/ui/fileListKey.ts",
    "frontend/src/ui/SideColumn.vue",
    "frontend/src/ui/App.vue",
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/CompareApp.vue",
    "frontend/src/ui/AGENTS.md",
    "frontend/src/ui/fileListKey.test.ts",
    "frontend/src/ui/searching.test.ts",
    "frontend/src/ui/store.test.ts",
    "frontend/src/ui/compareStore.test.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/diskChanges.test.ts",
    "frontend/src/ui/stops.test.ts",
    "frontend/src/ui/mergeSearch.test.ts"
  ],
  "tests_added": [
    {
      "name": "fileListKey.test.ts: the_list_and_search_keys_do_nothing_off_the_files_screen",
      "proves": "On settings, serverLog and mergeRequests, windowKey is false for both actions with 0 preventDefault calls, and fileListKey leaves fileListShown. On files, both keys act and preventDefault is called."
    },
    {
      "name": "searching.test.ts: toggle-search off the files screen leaves the panel as it is",
      "proves": "toggleKey on settings leaves shown false, on files it opens the panel, and on mergeRequests it leaves the panel open."
    },
    {
      "name": "store.test.ts: Ctrl+B on the settings screen leaves the list; back on files it toggles",
      "proves": "The merge store's fileListKey leaves fileListShown on settings and does not call preventDefault; after closeSettings it toggles."
    },
    {
      "name": "compareStore.test.ts: the bound key on the settings screen leaves the tab panel; back on files it toggles",
      "proves": "The same rule for the compare store."
    },
    {
      "name": "rangeStore.test.ts: the bound key on the settings screen leaves the file list; back on files it toggles",
      "proves": "The same rule for the range store."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && pnpm -C frontend lint && pnpm -C frontend test",
      "observed": "vue-tsc -b: no errors. oxlint --type-aware and eslint: no output, exit 0. Test Files 314 passed (314), Tests 4739 passed (4739)."
    },
    {
      "command": "pnpm -C frontend fmt:check; just web-unused",
      "observed": "All matched files use the correct format. knip --include exports,types: no findings."
    },
    {
      "command": "app-session start-fixture --name sd-r --range-case review --mr list --size 1280x800: tree mode, close 'public', widen +120, Ctrl+Shift+S, type 'board', scroll list to bottom",
      "observed": "Before: colDisplay flex, colWidth 360px, listScrollTop 223, treeMode true, closed [public], query board, searchVisible true."
    },
    {
      "command": "sd-r: click Settings, press Ctrl+B and Ctrl+Shift+S, read panes",
      "observed": "col [none,0], panes [DIV:none:0:0, DIV:flex:5:1270]: the settings screen starts at the island edge (x=5). Back → colDisplay flex, 360px, scrollTop 223, tree, closed [public], query board: identical in dark and light."
    },
    {
      "command": "sd-r: click Merge requests, press both keys, Back",
      "observed": "On the list: col none, panes DIV:none, DIV:flex:5. Back → the same probe output as before: 360px, scrollTop 223, tree, [public], board."
    },
    {
      "command": "sd-r step 2: Ctrl+B on files, then Settings, then Back",
      "observed": "After Ctrl+B: aside none, col flex, search visible. On Settings: col none. Back: aside none, col flex, query board, searchVisible true (shot r-hidden-back-light.png)."
    },
    {
      "command": "app-session start-fixture --name sd-c --diff --mr list: 36 tabs, select Compare 20, list scrollTop 150; Settings, Back, Merge requests, Back, dark and light",
      "observed": "Hidden: aside none, panes [ASIDE:none:0, DIV:flex:5]. Restored every time: aside flex, scrollTop 150, size 990/708, selected Compare 20, panes [ASIDE:flex:5, DIV:flex:250]."
    },
    {
      "command": "app-session start-fixture --name sd-m: tree, widen +100, search 'the'; Settings plus Ctrl+B and Ctrl+Shift+S; Back, dark and light",
      "observed": "On Settings: col none, panes [DIV:none:0, DIV:flex:5]. Back: col flex, 340px, aside flex, tree true, query the, searchVisible true. Server buttons: 0, so the fixture has no server log screen."
    },
    {
      "command": "shots /tmp/sd/{r,c,m}-*-{dark,light}.png",
      "observed": "Side column hidden and the screen at the left edge on settings and the MR list; restored column identical (looked at r-settings-dark/light, r-mr-dark, r-back-dark, c-back-mr-light, m-back-dark)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: fileListKey.ts 24 mutants, 24 killed, 0 survived, 0 no coverage, 100% (.vue files are not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [
    "Step 4 server log screen: the merge fixture has no server row or log button (0 server buttons found), so that screen could not be reached. Only Settings was checked in the merge window.",
    "Merge window list scrollTop: the fixture's file list fits at 1280x800 (scrollTop stays 0), so the scroll offset was only proven in the range and compare windows."
  ],
  "deviations_from_brief": [
    "RangeApp.vue: the one added attribute made oxfmt split the `<SideColumn>` opening tag over 5 lines (the same in App.vue). The content change is still the single `:on-files` attribute.",
    "mergeSearch.test.ts:90 also builds a WindowKeyTarget literal (MergeSearchTarget); typecheck found it, so it gained `screen` as well.",
    "The test names in store/compare/range/searching follow each file's sentence style. fileListKey's test uses the brief's exact snake_case name."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/fileListKey.ts:26",
      "risk": "Any future WindowKeyTarget key goes inert off the files screen by design. A later key meant for other screens would need its own guard."
    }
  ]
}
