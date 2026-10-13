# SettingsWeb — web-impl report (verbatim JSON)

```json
{
  "summary": "Unit-level work for 3.S web build 1 is done, but the brief is not complete. The five real-app steps (Xvfb + tauri-driver) and the fixture-mode WebKit smoke were never run. What now exists:\n- A light palette in style.css, with `color-scheme` set in CSS. palette.ts checks that both palettes define the same colour tokens and that window.rs's BACKGROUND_DARK/LIGHT match each `--color-window`.\n- The start theme comes from `<html data-theme>`; App.vue writes it from then on. CodeMirror's dark flag sits in a compartment per pane.\n- `ipc/keys.ts` holds the one source for key facts: actions, defaults, file form, labels, keyOfEvent, bindingsOf. `cmKey` turns these into CodeMirror bindings. Side, find and middle keymaps sit in compartments, and `setPre…
  "files_changed": [
    "frontend/index.html",
    "frontend/src/style.css",
    "frontend/src/main.ts",
    "frontend/scripts/palette.ts",
    "frontend/scripts/palette.test.ts",
    "frontend/src/ipc/keys.ts (new)",
    "frontend/src/ipc/keys.test.ts (new)",
    "frontend/src/ipc/fixtureSettings.ts (new)",
    "frontend/src/ipc/fixtureSettings.test.ts (new)",
    "frontend/src/ipc/ChunkSource.ts",
    "frontend/src/ipc/domain.ts",
    "frontend/src/ipc/fixture.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/tauri.ts",
    "frontend/src/ipc/tauri.test.ts",
    "frontend/src/editor/index.ts",
    "frontend/src/editor/internal/keys.ts (new)",
    "frontend/src/editor/internal/keys.test.ts (new)",
    "frontend/src/editor/internal/sideKeys.ts (new)",
    "frontend/src/editor/internal/findMatch.ts (new)",
    "frontend/src/editor/internal/find.ts",
    "frontend/src/editor/internal/find.test.ts",
    "frontend/src/editor/internal/historyKey.ts",
    "frontend/src/editor/internal/historyKey.test.ts",
    "frontend/src/editor/internal/language.ts",
    "frontend/src/editor/internal/modClick.ts",
    "frontend/src/editor/internal/pane.ts",
    "frontend/src/editor/internal/pane.test.ts",
    "frontend/src/editor/internal/sideFocus.ts",
    "frontend/src/editor/internal/sideFocus.test.ts",
    "frontend/src/editor/internal/apply.test.ts",
    "frontend/src/editor/internal/sides.test.ts",
    "frontend/src/editor/internal/words.test.ts",
    "frontend/src/ui/settings.ts (new)",
    "frontend/src/ui/keymapEdit.ts (new)",
    "frontend/src/ui/keymapEdit.test.ts (new)",
    "frontend/src/ui/keyText.ts (new)",
    "frontend/src/ui/keyText.test.ts (new)",
    "frontend/src/ui/store.ts",
    "frontend/src/ui/store.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/question.ts",
    "frontend/src/ui/question.test.ts",
    "frontend/src/ui/useMergeController.ts",
    "frontend/src/ui/useMergeController.test.ts",
    "frontend/src/ui/App.vue",
    "frontend/src/ui/MergeView.vue",
    "frontend/src/ui/ProblemBar.vue",
    "frontend/src/ui/QuestionDialog.vue"
  ],
  "tests_added": [
    {
      "name": "ipc/keys.test.ts (17 tests)",
      "proves": "Defaults equal today's table (with the source of each); the file form round-trips and refuses wrong order, upper case, unknown names and F13; labels on Linux (Ctrl+Shift+Z, Shift+F3, ↑, Page Down) and macOS (⇧⌘Z, ⌃⌥X, ⏎, ⎋), and a macOS Ctrl key on Linux shows as \"⌃X (macOS)\"; keyOfEvent: a modifier alone gives null, Meta on Linux gives null, Ctrl on macOS gives MacCtrl, Ctrl+я gives Mod-z, Dvorak ';' stays ';', '?' carries no Shift, ' ' gives Space; bindingsOf: an unknown id is ignored, a malformed key keeps the defaults and is reported as unreadable, [] means no key, a key on two actions goes to the first in list order and is reported as twice"
    },
    {
      "name": "ui/keymapEdit.test.ts (13 tests)",
      "proves": "Item 14's rules: adding a key the action already has does nothing; a key held by another action asks, and Move sends both changes; a change replaces in place; remove; remove all sends []; reset sends null; a list equal to the defaults is sent as null"
    },
    {
      "name": "editor/internal/keys.test.ts",
      "proves": "cmKey: Shift+x gives \"X\"; Mod-Shift-z and Space pass through; a macOS Ctrl key is not bound on Linux and becomes Ctrl- on macOS"
    },
    {
      "name": "pane.test.ts (5 new tests)",
      "proves": "Indent on Mod-i runs before selectParentSyntax; with Undo on Alt-Backspace, nothing is bound to Mod-z in the middle and Mod-u is still undoSelection; with Indent unbound, Tab binds nothing; the defaults bind once each (historyKeymap's own Mod-z and Ctrl-Shift-z are gone); the dark flag follows the theme"
    },
    {
      "name": "sideFocus.test.ts",
      "proves": "Default side commands; with Apply rebound to \"a\", \"a\" applies and Enter/Space are unbound; an action with no keys binds nothing"
    },
    {
      "name": "historyKey.test.ts (2 new tests)",
      "proves": "A rebound Undo (Alt+Backspace) works window-wide, also from a side pane, and Ctrl+Z no longer does; Ctrl+Shift+Y does not redo; the non-Latin fallback still works with rebound keys"
    },
    {
      "name": "find.test.ts close title",
      "proves": "The Close button title follows the close-find binding: Close (Escape), Close (F10), ⎋ on macOS, plain Close when unbound"
    },
    {
      "name": "ipc/fixtureSettings.test.ts (7 tests)",
      "proves": "The first load creates the file from the settings in use and later loads read it; setTheme/setKeys keep unknown entries; an entry is set with a list or removed with null; replies are copies; a move to an unknown path creates it and a known one is used; ~/ goes to the fixture home; a relative path is refused with NotAbsolute"
    },
    {
      "name": "tauri.test.ts (2 new tests)",
      "proves": "The four commands send their arguments and map default_path to defaultPath; a SettingsBroken failure comes back as the app's error"
    },
    {
      "name": "store.test.ts (10 new tests)",
      "proves": "Settings start with the start theme; a load on focus applies a file changed by hand; a failed load or change keeps the settings in use and shows a settings problem; key problems show one settings problem and a clean read clears it; a clash asks and Move writes both changes in one setKeys; Cancel writes nothing; current sends only the changed actions; move works"
    },
    {
      "name": "useMergeController.test.ts (2 new tests)",
      "proves": "The controller is built with the preferences in use, follows a change through setPreferences without a rebuild, and a change made before the file loads reaches the editor built later"
    },
    {
      "name": "palette.test.ts (5 new tests)",
      "proves": "Literals inside the light block are allowed; a light block missing a token or with an extra one is reported; a light block outside style.css exempts nothing; window.rs backgrounds that differ from or are missing in the palettes are reported; the real tree includes window.rs and has no violations"
    },
    {
      "name": "problemText/question tests",
      "proves": "SettingsBroken text names line and column; texts for NotAbsolute, NoConfigFolder, ReadFailed/WriteFailed and both key problems; the clash question reads \"Ctrl+F is already used by Find. Move it to Undo?\" with Move/Cancel buttons"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — exit 0, no findings"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — exit 0, no errors"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  46 passed (46) / Tests  541 passed (541)"
    },
    {
      "command": "pnpm -C frontend sfc-order (= just sfc-order)",
      "observed": "$ tsx scripts/check-sfc-order.ts — exit 0, no output"
    },
    {
      "command": "pnpm -C frontend unused (= just web-unused)",
      "observed": "$ knip --include exports,types — exit 0, no findings"
    },
    {
      "command": "wc -l src/ui/store.ts src/editor/index.ts",
      "observed": "299 store.ts, 298 editor/index.ts (both ≤ 300)"
    },
    {
      "command": "Real app on Xvfb/tauri-driver, steps 1–5; fixture-mode WebDriver smoke",
      "observed": "NOT RUN: I stopped at the run's request budget. No screenshots, frame captures or key presses on the real app or in fixture mode were observed."
    }
  ],
  "deviations_from_brief": [
    "New files: ipc/keys.ts, ipc/fixtureSettings.ts, editor/internal/keys.ts (cmKey, cmKeys), editor/internal/sideKeys.ts (SideCommand, the side keymap compartment and sideKeyCommands, moved out of sideFocus.ts to keep it under 300 lines), editor/internal/findMatch.ts (matches, findLabel, labelOutdated, matchFrom, stepMatch, selectMatch, moved out of find.ts, which would have been 325 lines), ui/settings.ts, ui/keymapEdit.ts, ui/keyText.ts. Removed: SIDE_KEYS from sideFocus.ts. The project map needs these entries.",
    "Public surface: KeyName is not exported (from keys.ts or ipc/index.ts) because knip fails on an export nobody imports; the next build adds `export` when it uses it. ipc/index also re-exports isLetter and isMac, KeysChange, SettingsRead, StoredSettings and Theme. MergeController's constructor `options` went from optional to required (MergeOptions.preferences is required). editor/index re-exports Preferences from internal/pane.ts.",
    "problemText(problem, platform) and questionText(question, platform) gained a platform parameter so key labels are testable on any machine; ProblemBar and QuestionDialog pass navigator.platform.",
    "Problem gains `{ action: \"settings\"; cause: ProblemCause | { kind: \"Keys\"; path; problems } }`. clearProblemAbout moved into problem.ts.",
    "modClick.ts now uses isMac from ipc/keys.ts, so the platform test lives in one place.",
    "Window-wide undo/redo: \"Alt rules as today\" read as an exact key match. Ctrl+Alt+Z still does nothing, and Alt+Backspace works only when it is bound.",
    "Key grammar: every single-character name must be lower case, not only Latin letters (Я is refused and recorded as Shift-я). The physical-key fallback applies with Ctrl/Cmd or Alt held, except Alt alone on macOS, as CodeMirror does it.",
    "An action's list counts as the defaults when it holds exactly the default keys in any order; it is then sent as null.",
    "Change-to-a-key-the-action-already-has drops the old key; remove-all on an action with no keys does nothing.",
    "Labels: brief's Linux arrows ↑↓←→ kept; PageUp/PageDown are \"Page Up\"/\"Page Down\" (Java KeyEvent texts). macOS symbols come from IntelliJ MacKeymapUtil (intellij.platform.ide.jar): ⏎ ⇥ ⎋ ⌫ ⌦ ↖ ↘ ⇞ ⇟ ↑↓←→; Space is \"Space\".",
    "Clash dialog: WebStorm's KeyMapBundle has title \"Warning\" with Remove/Keep/Cancel. The brief's \"Key Already in Use\" with Move/Cancel was kept, as #663 decided.",
    "Palette: every light value checked against ManyIslandsLight.theme.json (gray-150/160/130/80, blue-80/140/130/160, red/green-160/130, transparent-black-10/20, purple-80/90, green-90, gray-90), expUI_lightScheme.xml (CARET_ROW f5f8fe, LINE_NUMBERS aeb3c2/767a8a, SELECTION a6d2ff, TEXT 080808, keyword 0033b3, string 067d17, number 1750eb, comments 8c8c8c, function 00627a, field 871094, metadata 9e880d, JS.REGEXP 264eff, hyperlink 006dcc) and Default in DefaultColorSchemesManager.xml (CARET_COLOR 0, SEARCH_RESULT ccccff; HTML/XML tag name falls back to keyword 0033b3). No value changed, and the dark block has no token the table lacks.",
    "Settings-problem words are my choice, for example \"Could not use the settings file: … is not an absolute path; start it with / or ~/.\"",
    "Item 17 confirmed: MergeView's window keydown handler runs only while `question === null`, and the modal <dialog> holds focus, so CodeMirror keymaps get no keys while the question is open.",
    "The middle pane's find keys stay before defaultKeymap, so Escape still reaches closeFind before simplifySelection. The Close-find binding keeps preventDefault false, as today."
  ],
  "open_risks": [
    {
      "location": "Acceptance: real-app steps 1–5 and fixture-mode smoke",
      "risk": "Not run (stopped at the request budget). Not proven in the app: a light start without a dark frame, rebinding in a hidden file, F10/Escape in a live find bar, the Alt+Backspace undo, and the problem bar for a broken file. Main or a follow-up run must do the Xvfb/tauri-driver and `just webdriver` steps."
    },
    {
      "location": "frontend/src/editor/internal/pane.ts showPreferences",
      "risk": "Compartment reconfigure on a live EditorView is exercised only through state-level tests (keymap facet order, darkTheme facet). No DOM/WebKit test dispatches a real keydown after setPreferences."
    },
    {
      "location": "frontend/src/ui/App.vue settings theme watcher (immediate)",
      "risk": "In the app the first frame relies on Rust's initialization script and on main.ts reading it. If loadSettings fails at start, the attribute stays the start theme, which is the intended behaviour but is unobserved."
    },
    {
      "location": "frontend/src/ui/settings.ts use()",
      "risk": "Key problems are reported (and logged at error level) again on every focus reload while the file keeps them, which may be noisy."
    },
    {
      "location": "frontend/src/ipc/keys.ts (296 lines), ui/store.ts (299), editor/index.ts (298)",
      "risk": "Close to the 300-line cap; the next build must move code before adding to them."
    }
  ]
}

[Some lines truncated to 768 chars]
```
