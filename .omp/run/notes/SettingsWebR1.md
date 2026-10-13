# SettingsWebR1 — implementer report (fields read one by one)

```json
{
  "summary": "All twelve findings of 3.S-settings-web-rework-1 are fixed, and every new test fails when its fix is reverted. In detail: `KeyName` is now exported and re-exported from `ipc/index.ts`. `parseKey` refuses Shift before a symbol. The settings store keeps the same `settings` object and does not report the same key problems again when a reload read an unchanged file. A call counter (`latestSettings`) stops an older reply from overwriting a newer one, and key edits are planned again on the bindings in use after the clash question. In the editor, `preferenceEffects(kind, settings)` in `pane.ts` builds the theme, find-key and side- or middle-key reconfigures for one pane, and `MergeController.setPreferences` sends them to all three views itself, so the callback is gone. The side keymap no longer needs a callback: it reads a `sideRunner` facet. In the middle pane only undo and redo prevent the key's default. A `Prec.highest` `beforeinput` handler blocks the browser's own historyUndo/historyRedo.",
  "files_changed": [
    "frontend/src/ipc/keys.ts",
    "frontend/src/ipc/keys.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/fixtureSettings.ts",
    "frontend/src/editor/index.ts",
    "frontend/src/editor/internal/pane.ts",
    "frontend/src/editor/internal/pane.test.ts",
    "frontend/src/editor/internal/sideKeys.ts",
    "frontend/src/editor/internal/sideKeys.test.ts (renamed from sideFocus.test.ts, content unchanged)",
    "frontend/src/ui/settings.ts",
    "frontend/src/ui/store.ts",
    "frontend/src/ui/store.test.ts"
  ],
  "tests_added": [
    {
      "name": "ipc/keys.test.ts 'anything else is refused' (+ \"Shift-1\", \"Shift-?\") and 'bindingsOf: Shift before a symbol is unreadable, since no key press gives it'",
      "proves": "#694: Shift before a symbol does not parse, and `bindingsOf` reports such a key as unreadable and keeps that action's defaults. Fails with the `shiftedSymbol` check removed (both tests failed)."
    },
    {
      "name": "editor/internal/pane.test.ts 'a read-only Result pane leaves Tab to the browser: Indent refuses and nothing prevents the key'",
      "proves": "#689: Tab and Indent have no preventDefault, indentMore refuses in a read-only pane, and Mod-z still has preventDefault. Fails with indent's preventDefault set back to true."
    },
    {
      "name": "editor/internal/pane.test.ts 'the browser's own undo and redo are refused in the middle; other input passes through'",
      "proves": "#690: `refuseNativeHistory` prevents and handles historyUndo/historyRedo and passes insertText/deleteContentBackward through. Fails when it returns false. It does not prove the handler is wired into the middle pane (see open_risks)."
    },
    {
      "name": "editor/internal/pane.test.ts 'new preferences turn the middle light, move its Undo and rebind its find keys'",
      "proves": "#693: on a center state, `preferenceEffects(\"center\")` flips `EditorView.darkTheme`, moves Undo from Mod-z to Alt-Backspace and binds F10 for close-find. Fails when the theme effect or the find effect is removed."
    },
    {
      "name": "editor/internal/pane.test.ts 'new preferences turn a side light, rebind its Apply and its find keys'",
      "proves": "#693: on a side state, the effects flip darkTheme, bind \"a\" (not before the change), unbind Enter and move close-find from Escape to F10. Fails with the theme effect removed, the find effect removed, or the side given middle keys."
    },
    {
      "name": "ui/store.test.ts 'an identical load keeps the settings object and does not show the same key problems again'",
      "proves": "#685/#691: after dismissProblem, a second identical load leaves `problem` null and `settings`/`preferences` the same objects. A theme change with the same broken key does not report again (exactly one error log). Fails when `settings` is always replaced and when key problems are always reported."
    },
    {
      "name": "ui/store.test.ts 'a key problem shown again replaces a settings failure the file no longer has'",
      "proves": "Once a load failure is shown, a readable file with the same key problems puts the Keys problem back in place of the stale failure. Fails with that clause removed."
    },
    {
      "name": "ui/store.test.ts 'a load that started before a change and answers after it does not put the old file back'",
      "proves": "#692: a slow load's OK reply arriving after a setTheme is dropped, and its failure is logged but not shown. Fails with the counter check disabled."
    },
    {
      "name": "ui/store.test.ts 'Move after a reload freed the key sends the edit planned on the bindings now in use'",
      "proves": "#692: when a reload during the clash question changed the bindings, Move sends only the undo change and does not clear find's new Mod-g. Fails when the plan made before the question is sent."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; echo \"lint exit=$?\"",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\nlint exit=0"
    },
    {
      "command": "pnpm -C frontend typecheck; echo \"typecheck exit=$?\"",
      "observed": "$ vue-tsc -b\ntypecheck exit=0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  46 passed (46)\n      Tests  550 passed (550)"
    },
    {
      "command": "just sfc-order; just web-unused",
      "observed": "$ tsx scripts/check-sfc-order.ts\nsfc-order exit=0\n$ knip --include exports,types\nweb-unused exit=0"
    },
    {
      "command": "just map-check",
      "observed": "exit 1. Only missing-entry lines, all for the orchestrator to add: frontend/src/editor/internal/findMatch.ts, frontend/src/editor/internal/sideKeys.ts, frontend/src/ipc/fixtureSettings.ts, frontend/src/ui/keyText.ts, frontend/src/ui/keymapEdit.ts (not in project-map); ChunkSource.loadSettings/setTheme/setKeys/moveSettings (not in docs/architecture.md). This round adds no new source files; sideKeys.test.ts is a test file."
    },
    {
      "command": "wc -l frontend/src/editor/index.ts frontend/src/ui/store.ts frontend/src/ipc/keys.ts",
      "observed": "294 editor/index.ts, 300 ui/store.ts, 297 ipc/keys.ts (all ≤ 300)"
    },
    {
      "command": "Fix reverted, then the test file run, for each fix (vitest run --project node <file>)",
      "observed": "parseKey check removed → 2 keys tests fail. indent preventDefault true + refuseNativeHistory returning false → the read-only Tab test and the native-history test fail. Theme effect dropped → both preference tests fail. Find effect dropped → both fail (\"expected [] to have a length of 1\"). Side given middle keys → the side test fails. adopt always replacing + counter disabled + pre-question plan sent → identical-load, stale-load and Move-after-reload tests fail. Key problems always reported → identical-load test fails. Failure-replacement clause dropped → replace-failure test fails. Every fix was put back afterwards: the pane.ts and settings.ts snapshot tags returned to their pre-revert values, and the final run passes 550/550."
    },
    {
      "command": "pnpm -C frontend dev --port 5193 --strictPort + just webdriver 4473 (MiniBrowser 2.54.1, Samsung screen); WebDriver pointer/key actions; execute only to read",
      "observed": "Dark window: <html data-theme=\"dark\">, color-scheme dark, --color-window #26282c, all three .cm-editor carry ͼ3 (CodeMirror's dark base class), pane background rgb(25,26,28); screenshot /tmp/yamt-smoke-3S-r1/dark.png shows the dark window. Click in the left pane, then ArrowDown: a chunk-modified line gets chunk-focus. Enter: summary goes from \"3 changes · 1 conflict\" to \"2 changes · 1 conflict\". Ctrl+Z (keyboard still on the left pane): back to \"3 changes · 1 conflict\". Click in the middle and type Qq: line \"\\t\\t);\" becomes \"\\t\\t);Qq\". Ctrl+Z: back to \"\\t\\t);\". Ctrl+F: middle find panel opens, activeElement INPUT.find-field. Escape: panel gone, focus back on the middle's cm-content. Tab in the middle: line \"\\tyield …\" becomes \"\\t\\tyield …\", focus stays in the middle. Shift+Tab: back to \"\\tyield …\"."
    },
    {
      "command": "Item 9 beforeinput observation (capture-phase keydown/beforeinput recorder added through execute; it only records)",
      "observed": "Middle pane, default keys: typing gave keydown:Q, beforeinput:insertText, keydown:q, beforeinput:insertText. Ctrl+Z gave only keydown:Control, keydown:z: no beforeinput at all, because the Mod-z binding prevents the keydown. To see what WebKitGTK does with an unprevented Ctrl+Z, I tried the find field: after typing \"ab\"/\"c\", Ctrl+Z gave keydown:Control and keydown:z with defaultPrevented=false at window bubble. No beforeinput historyUndo followed, and the field value stayed \"abc\". So WebKitGTK via WebDriver input sends no native historyUndo for Ctrl+Z. The `beforeinput` block guards the macOS WKWebView / Edit-menu path named in #690, which I could not exercise here."
    }
  ],
  "deviations_from_brief": [
    "Side keymap without a callback: `sideKeys(keys, platform)` is now pure. Its bindings read a new `sideRunner` facet (`editor/internal/sideKeys.ts`), which the controller supplies per side as `sideRunner.of(command => focus.run(side, command))`. The side-key compartment moved into `pane.ts` (private, next to the theme and middle-key compartments), and `kindExtensions(\"side\")` places it. This makes `preferenceEffects` pure for both kinds. A side pane without a runner leaves the key unhandled (run returns false).",
    "Public surface inside editor/internal: removed `showPreferences` and the exported `sideKeysCompartment`. Added `preferenceEffects(kind: \"side\" | \"center\", settings: PaneSettings)` and `refuseNativeHistory(event)` (pane.ts) and `sideRunner` (sideKeys.ts). `refuseNativeHistory` is exported only so it can be unit-tested. `MergeController`'s public surface is unchanged.",
    "Renamed file for the project map: `frontend/src/editor/internal/sideFocus.test.ts` → `frontend/src/editor/internal/sideKeys.test.ts`. No new non-test source files. New public export: `KeyName` from `ipc/index.ts`. `FixtureSettings` is no longer exported.",
    "knip still reported the `ipc/index.ts` re-export of KeyName as unused when `keys.test.ts` imported it from `./keys`, despite #682's reasoning. So `keys.test.ts` imports `type KeyName` from \".\" (the ipc index) and uses it in the round-trip test (`key(\"Mod--\").name` is the KeyName \"-\").",
    "How the store decides (left open by the brief): the read is unchanged when path, theme and every stored key text list (unknown actions included) are equal; then `settings.value` is kept. Key problems count as the same when their kind/action/text or key/actions match in order. They are reported when they differ from those in use, or when a non-Keys settings failure is shown (so a stale failure is replaced). No key problems clears any shown settings problem, as before.",
    "Reply ordering: a stale failed reply is logged (logProblem) but not shown, matching `load()`'s `latestOpen` handling. After a clash answer the edit is planned again: \"nothing\" sends nothing; otherwise the new plan's changes are sent, even if the new plan would ask about a different owner. The user already agreed to give the key to this action.",
    "DEFAULT_KEYS citations now point at the base commit: sideFocus.ts SIDE_KEYS, historyKey.ts historyCommand, find.ts:269-284 and pane.ts indentWithTab, all at 9b717cb, plus plan §2 #54/#44/#35. I checked each with `git show 9b717cb:…`.",
    "The beforeinput test is a node unit test of the pure handler, not a WebKit DOM test. I wrote a `pane.browser.test.ts` first, but `pnpm test:browser` cannot launch Playwright WebKit on this host (\"Host system is missing dependencies to run browsers … libicu74, libxml2, libflite1\"). I deleted it rather than ship a test nobody has seen run.",
    "store.test.ts keeps the `new Promise(executor)` form for the deferred load (as `answeredLater` already does). `Promise.withResolvers` is ES2024, and tsconfig.app.json's lib is ES2023.",
    "Fixture-mode run ordering: the brief says to check in WebKit first; I made the code fixes and tests first, then ran the WebKit check, as the task's Contract section orders."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/internal/pane.ts:194 (nativeHistoryBlocked)",
      "risk": "No test proves the `beforeinput` block is wired into the middle pane. In WebKitGTK a WebDriver Ctrl+Z produced no historyUndo even in an unprevented text field, so the path it guards (macOS WKWebView Cmd+Z or the Edit menu with Undo rebound) is [INFERENCE] from #690 and the @codemirror/commands source."
    },
    {
      "location": "frontend/src/editor/internal/sideKeys.ts:54 (sideRunner lookup)",
      "risk": "The runner lookup is covered only by the fixture-mode WebKit run (Enter applied a change). No unit test sends a key to a live side view after `setPreferences`, because Playwright WebKit cannot launch on this host."
    },
    {
      "location": "frontend/src/ui/settings.ts:100-103",
      "risk": "Equal key problems with a non-Keys, non-settings problem on screen (e.g. a failed Finish) are not reported again. That is intended by #691, but it means a dismissed Keys problem never comes back until the problems change."
    },
    {
      "location": "scripts/map-check.sh output",
      "risk": "`just map-check` fails on entries this slice does not own (project map / architecture). The orchestrator must add the five files and four ChunkSource methods listed in smoke_evidence."
    }
  ]
}
```
