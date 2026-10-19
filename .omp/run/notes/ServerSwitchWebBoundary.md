The patch passes the boundary review: no blocking findings and two `should`s. I read the files at HEAD and ran no checks or tests (review is read-only, RV6).

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/LanguageServerSettings.vue",
      "line": 43,
      "problem": "Two places set whether the switch shows checked: Vue's `:checked=\"!off.has(spec.key)\"` and `flip`'s `input.checked = !off.value.has(spec.key)` after the await. The `event.target instanceof HTMLInputElement` check exists only to make that second write, and it is why a second click during a write reads an old `off` (open risk 1). As the app grows, the next Settings control that writes through the store will likely copy this pattern; nothing else gets harder.",
      "fix": "Replace `flip` with `@click.prevent=\"switchServer(spec.key, off.has(spec.key))\"`. A cancelled click on a checkbox puts its checked state back (HTML activation behaviour), so `:checked` becomes the only writer, both after a reply and after a failed write."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 1,
      "problem": "The project map's `frontend/src/lsp` line still lists the public surface as `detect`, `addedSpecs`, `presetChoices`, `isDocVersion`, and `spec` as only 'serving by extension and folder'. The new `serverKey`/`ServerKey` export, the key on `ServerSpec`/`ServerView` and `FoundSpec` are missing. This is outside the already-known gap list (`serverPins.ts`, `offServers`, `switchServer`). `map-check` checks only file names, so nothing will catch it, and row 7's reader will look for the key's owner in `lsp/AGENTS.md` only.",
      "fix": "In the same docs step, add `serverKey` (and the `ServerKey` type) to the lsp `index.ts` surface on the map, and 'the `ServerKey` brand' to the `spec` entry."
    }
  ],
  "checked": [
    "Ownership: every changed file is in Owned or granted. lsp/** (spec, detect, vue, added, state, index, their tests, AGENTS.md); ui settings.ts(+test), serverSetup.ts(+test), new serverPins.ts(+test), LanguageServerSettings.vue; literal-only edits in store.test.ts, servers.test.ts, question.test.ts; serverText.test.ts (one `key` plus its import, granted); ipc/domain.ts and fixtureSettings.ts (granted #1268) plus their tests fixtureSettings.test.ts and tauri.test.ts. tauri.ts was granted and is unchanged; no row 7 file (ServerStatus, ServerMenu, serverText.ts, useDropdownMenu, menuKeys, ui/AGENTS.md) and no issue-4 file was touched.",
    "Fixed contract matches the brief character for character: `ServerKey = string & { __brand }` exported from lsp/index.ts; `key: ServerKey` on ServerSpec (spec.ts:58) and ServerView (state.ts); `SettingsActions.setServerSwitch(server: string, on: boolean)` (settings.ts:54); `ServerPins { pinnedServers: Readonly<Ref<ReadonlySet<string>>>; togglePin(key: ServerKey) }` and `createServerPins(root, storage?)` (serverPins.ts:7-39); `offServers(settings, root): ReadonlySet<string>` (serverSetup.ts:73); `ServerSetup = ServerPins & { …, switchServer(key, on) }`. Row 7's brief uses `ServerView.key`, `store.pinnedServers` and `store.togglePin`, all present through `AppStore & ServerSetup` (store.ts:93,148) with no edit to store.ts.",
    "Key built in one place: detect.ts:246-250, the last step after `found` is flattened, gives `key = serverKey(labelled)` and `name = shared ? labelled : spec.name`. `fromProject`/`specsOf`/`detectIn`/`withVue` now take and return `FoundSpec` (Omit<ServerSpec,'key'>), so Vue's spread of TypeScript's spec cannot carry a key. Hand-added: added.ts:55 `added: ` plus the program and args. `presetPart` returns a Pick without `key`, so the spread cannot overwrite it.",
    "Brand pattern matches lsp/internal/version.ts: a type guard `isServerKey`, a RangeError constructor `serverKey`; no `as` (TS4).",
    "Off is applied in one place: `shownFound` (serverSetup.ts:111) through `offServers` feeds `apply` (setSpecs), `setUp`'s empty check and the question's `found`. `foundServers` is never filtered (`look` writes it unfiltered). The only other reader of `off` in ui/ is the Settings view's display computed, through `offServers` (searched `.off` / `off[` in ui/).",
    "lsp/ stays free of settings facts: no lsp code reads `off`, the answer or the pins. The patch adds no lsp import beyond lsp/internal; PM2/PM3/PM5 hold. ui reaches lsp only through ../lsp (serverKey, ServerKey).",
    "`off` is filled once at the IPC boundary: domain.ts:218-224 `toSettingsRead` (its only caller is tauri.ts `toSettingsResult`, used by all eight settings commands). The defaults were removed from settings.ts `sameServers` and fixtureSettings.ts `copied`; `startSettings` writes `off: {}`. A later optional field made required by `Required<>` cannot slip through: `toSettingsRead`'s declared return type and `copied`'s field-by-field build would both fail typecheck. Accepted as granted (#1268, one level below `toSettingsResult`).",
    "`switchServer` = `applyAfter(setup, setup.setServerSwitch(key, on))`. `send` shows a failed write as the settings problem and returns without adopting the reply, so the following `apply` sees unchanged settings and does nothing (settings.ts:187-203).",
    "Pins: `storedValue` under `yamt.servers.pinned`, the same pattern as toolbarButtons.ts/collapsing.ts. `togglePin` is the only writer; pins never read `off` (rule 6). A null root gives an empty set and a toggle does nothing; other roots stay as written; an emptied root is dropped. Held through `createServerSetup(setup.root)`, as plan #83 and design point 4 decided (DR1: not reopened).",
    "Settings row (LanguageServerSettings.vue:79-95): `:key=\"spec.key\"`; a `<label>` wraps `<input type=checkbox role=switch>` and the shown name; `text-fg-muted` while off; the section is gated only on `serverRoot !== null`, so the switch shows under Don't start and Not asked. VU2 order holds (off computed after the others, flip with the functions); VU6 holds (no inline logic).",
    "Deviation accepted: hand-added servers are still numbered against every found name, off ones included (serverSetup.ts addedOf). Numbering against shown names only would rename an added server on each switch. Since Start/Stop/log and `runsAs` go by name (lsp/index.ts:156-158, server.ts:50-52), that would restart its run and drop a user's Stop.",
    "Deviations accepted as stated in the assignment: the Phpactor/Intelephense key follows the tool in use; `serverKey` exported for tests outside lsp/; the serverText.test.ts literal. The question's words are unchanged (question.ts untouched; it gets `shownFound` as `found`).",
    "Decision record: #58 (header choices are window storage: pins in localStorage, not the settings file); #67 (what runs per repository is the settings file: `off` next to `repositories`); #70 (lsp framework-free, Rust gets keys only as opaque text); #71 (the key uses the suffix text, `ROOT_LABEL` 'repository root'); #83 Identity/Off/Pins. The patch contradicts none of them.",
    "Comments: no code comments added (CP). lsp/AGENTS.md's new paragraph matches the code (FoundSpec, last step, `added: `, Phpactor/Intelephense, Start/Stop by name).",
    "Growth: serverSetup.ts is about 205 lines (≤ 300) and every function is ≤ 40 lines. Its new parts are the off filter (`shownFound`) and the switch action; pins live in their own file and are only spread in. serverPins.ts holds one concept (65 lines). No new edge against PM1-PM5. `off` has one writer (settings replies through `adopt`), pins one writer (`togglePin`).",
    "Not re-raised (already known or row 7's): the project map/architecture lacking serverPins.ts/offServers/switchServer; ui/AGENTS.md (row 7 owns it) not yet naming off/pins."
  ]
}
```