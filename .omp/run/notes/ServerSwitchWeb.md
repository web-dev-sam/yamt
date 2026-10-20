Every server spec and view now carries a `ServerKey`, Settings has an on/off switch for each found server, and pins are stored per repository. The frontend recipes all exit 0, and Acceptance 2–4 were checked in the real app, with one gap described under smoke_evidence (the switch click was not done by app-session). Nothing is committed.

```
summary
  Every ServerSpec and ServerView carries a `ServerKey` (brand, `lsp/internal/spec.ts` `serverKey`). Found servers get it in
  detect's last step: tool name plus project, always written out. Hand-added servers get "added: <command words>".
  `ui/serverSetup.ts`: `offServers`, and `apply` drops found servers that are off before `setSpecs`; the start question lists
  only shown servers. New `switchServer(key, on)` and `ServerPins` fields. `ui/settings.ts` has the `setServerSwitch` action.
  New `ui/serverPins.ts` (storage key `yamt.servers.pinned`, per root). Settings → "Found in this repository" has one
  `role="switch"` checkbox per server; an off row's name is muted. #1268: `off` is required in the window's types.

files_changed
  frontend/src/lsp/internal/spec.ts, detect.ts, vue.ts, added.ts, state.ts; frontend/src/lsp/index.ts; frontend/src/lsp/AGENTS.md
  frontend/src/lsp/index.test.ts, internal/spec.test.ts, internal/added.test.ts, internal/detect.test.ts
  frontend/src/ui/serverPins.ts (new), serverPins.test.ts (new), serverSetup.ts, serverSetup.test.ts, settings.ts, settings.test.ts,
    LanguageServerSettings.vue
  frontend/src/ui/store.test.ts, servers.test.ts, question.test.ts (literals only), serverText.test.ts (one `key` plus its import, granted by Main)
  frontend/src/ipc/domain.ts, fixtureSettings.ts, fixtureSettings.test.ts, tauri.test.ts (#1268, granted by Main)

tests_added
  lsp/internal/detect.test.ts:
    "the key stays when a second project brings the suffix": oxlint alone → name "oxlint", key "oxlint (frontend)"; with a
      root project → names get the suffix, keys unchanged.
    "keys are unique; Vue's is not TypeScript's": root and web oxlint, TypeScript, Vue → 4 distinct keys, Vue's is "Vue (web)".
    "TypeScript's key stays whichever program runs it, installed or not": tsc, tsgo, typescript-language-server not
      installed and installed all give "TypeScript (web)".
  lsp/internal/added.test.ts "an added server's key is its command, not its numbered name": name "oxlint (2)", key "added: oxlint --lsp".
  lsp/internal/spec.test.ts "a server key is any text but the empty one": `serverKey("")` throws RangeError.
  lsp/index.test.ts: the two view-equality tests now include `key`, which differs from the name, so a view built from the name fails them.
  ui/settings.test.ts "setServerSwitch sends the settings in use, the key and on, and adopts the reply": both directions.
  ui/serverSetup.test.ts (real `LanguageServers` with FakeHost):
    "switch: off stops a running server at once, clears its problems and logs its exit; it stays found": a published
      problem is cleared (shown count 1 → 0), the host stops oxlint, its log ends with "Exited with code 0", foundServers is unchanged.
    "switch: an off server is never asked about nor started: not by Start, not on focus, not at the next start".
    "start: with every found server off and none added there is no question and no server".
    "switch: on again starts the server only under Start": Don't start leaves it stopped; Start starts it.
    "switch: a failed write changes nothing": `off` unchanged, nothing stopped.
    "switch: a server keeps its switch when a second project brings the suffix".
    "switch: another repository's switches do not count".
    "offServers: the keys switched off under this root; none without a root or an entry".
  ui/serverPins.test.ts: none pinned at first, pin and unpin; per root with other roots kept as written (a malformed one too);
    a root left empty is removed; a null root pins nothing and toggling does nothing; six unreadable or wrongly typed
    stored values read as no pins.
  ipc/tauri.test.ts "a read without off has nothing switched off; one with off keeps it" (#1268).

smoke_evidence
  1. pnpm -C frontend lint → oxlint and eslint print nothing, exit 0 ("lint=0")
     pnpm -C frontend typecheck → "$ vue-tsc -b", "typecheck=0"
     pnpm -C frontend test → "Test Files  110 passed (110)", "Tests  1479 passed (1479)"
     pnpm -C frontend unused → "$ knip --include exports,types", "unused=0"
     pnpm -C frontend fmt:check → "All matched files use the correct format.", "fmt=0"
  2. cargo tauri build --debug --no-bundle → "Built application at: …/target/debug/yamt"
     scripts/lsp-repo.sh --servers /tmp/yamt-q5/lsp → mid-merge, 9 conflicted files
     PATH=~/.cache/yamt/servers-path:$PATH just app-session start-app --name q-switch-a --repo /tmp/yamt-q5/lsp
     → the question was shown ("Start this project's language servers? … ruff, ty, basedpyright — py/ …"); clicked Start;
       opened py/api/stats.py.
     Before, with "Collapse unchanged fragments" turned off so line 1 shows:
       .cm-lintRange: "cm-lintRange-warning os | cm-lintRange-error "three""; counts "2 errors, 1 warning"; header "… ruff=Running …";
       pgrep -af "ruff server" → "224098 /tmp/yamt-q5/lsp/py/.venv/bin/ruff server".
     How the switch was clicked: `app-session click "ruff" --role switch` answered "no element named "ruff" with role switch".
       Its name lookup reads only aria-label, title or the text content of a few roles, so it misses a label wrapping a
       checkbox. I clicked the input with `read` running `input.click()`, which fires the real click and change events.
       app-session itself did not do the click.
     After switching off: pgrep → "pgrep: none"; rows "… ruff=false(muted) …";
       header "Biome=Running ; clangd=Stopped ; gopls=Stopped ; Phpactor=Stopped ; ty=Running ; basedpyright=Running ; …" (no ruff);
       counts "2 errors, 0 warnings"; .cm-lintRange: "cm-lintRange-hint os | cm-lintRange-error "three"".
       The count of `.cm-lintRange` stays 2: ruff's warning on `os` is gone, and a hint on the same word stays.
       [INFERENCE] the hint is basedpyright's unused-import hint, which is not counted.
       Screenshot: /tmp/yamt-q5/settings-ruff-off-dark.png (dark; the ruff row is muted with its switch off, the other 10 are on).
     After switching on: pgrep → "232148 /tmp/yamt-q5/lsp/py/.venv/bin/ruff server"; header "… ruff=Running …";
       the `os` warning is back. ruff → Show log → "18:52:27 // yamt // Exited with code 0 // 18:53:00 // yamt // Starting ruff server in py".
       So the exit line was the last line while ruff was off; I could only read the log after switching it on, because an off
       server has no button to open its log from.
  3. just app-session stop --name q-switch-a → "session":"ended"; pgrep → none.
     start-app --name q-switch-b --repo /tmp/yamt-q5/lsp --settings
       '{"theme":"dark","languageServers":{"repositories":{"/tmp/yamt-q5/lsp":"start"},"off":{"/tmp/yamt-q5/lsp":["ruff (py)"]},"added":[]}}'
     → "no dialog", "no question"; header "Biome=Running ; … ty=Running ; basedpyright=Running ; …" (no ruff);
       after opening py/api/stats.py and waiting 13 s: "pgrep after 13 s: none" (ty and basedpyright processes are running).
  4. just app-session stop --name q-switch-b → "session":"ended"; pgrep for ty, basedpyright and biome → "no servers left".

deviations_from_brief
  - #1268 (Main's added item): in `ipc/domain.ts`, `LanguageServerSettings` is `Required<Generated.LanguageServerSettings>`, and
    `StoredSettings` uses it, so `SettingsRead` does too. `off ?? {}` is filled once, in `toSettingsRead`, the conversion
    `tauri.ts` `toSettingsResult` calls; it has no other caller. Main asked for it in `toSettingsResult`, so this is one
    level down. The test is in tauri.test.ts. Removed the defaults from `ui/settings.ts` `sameServers` and
    `ipc/fixtureSettings.ts` `copied`; `startSettings` now writes `off: {}`. Test literals gained `off: {}`.
  - serverText.test.ts was outside my list; Main allowed it. Only the literal's `key` and the `serverKey` import changed.
  - Irregular key: Phpactor and Intelephense come from one preset, so the key follows the tool that is actually used:
    "Phpactor (php)" or "Intelephense (php)". Installing Intelephense where Phpactor is missing therefore gives a different
    key; that is a different tool with a different shown name. Documented in lsp/AGENTS.md. TypeScript (tsc/tsgo/not
    installed) and Vue keep one key; a test checks both.
  - Hand-added servers are still numbered against all found servers, including off ones. This keeps an added server's
    name, and so its run, from changing when a found server is switched.
  - The checkbox is set from the settings after each write. Otherwise, when a write fails, the native checkbox would show
    the new state while the setting stayed the same.
  - The question's wording did not change. It now lists only shown servers, as the brief says.
  - New export `serverKey` from `lsp/index.ts`, used to build keys in tests outside `lsp/`.
  - For the orchestrator: ui/AGENTS.md (row 7 owns it), docs/architecture.md and the project-map still need `ui/serverPins.ts`,
    `offServers` and `switchServer` (PM6 map-check will name `serverPins.ts`).
  - Acceptance 2: the switch was clicked through `read` (`input.click()`), not app-session `click`, because app-session's
    name lookup ignores a wrapping `<label>`. The fix belongs in frontend/scripts/app-session/find.ts, which I do not own.

open_risks
  - frontend/src/ui/LanguageServerSettings.vue:43-49: a second click while the first write is still running reads the old
    `off`. The value is set again after each write, so this is harmless, but it was not tested in WebKit.
  - frontend/src/ui/serverPins.ts:58: when a repository is pinned again, its entry moves to the end of the stored object.
    The order is never read.
  - The fixture page still has no servers (row 7 adds `?servers`), so the Settings switch was checked only in the real app
    (WebKitGTK), not in MiniBrowser.
```