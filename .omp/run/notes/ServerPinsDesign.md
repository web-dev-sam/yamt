# 3.Q design: found servers can be switched off, one group button in the header, pins

I recommend **option A**: a stable key on every server, an `off` field next to `repositories` in the settings file, and pins in the window's storage. The design touches none of the other feature's files, and `ui/store.ts` and `App.vue` stay as they are. Nothing here was built or run; the facts below come from reading the tree.

## Facts read in the tree

These change the design or the acceptance:

- **The fixture page has no servers.** `main.ts:12` passes a null host, and `serverSetup.startUp` skips `setUp` when the host is null. None of this feature can be seen in WebKit until fixture mode gets servers.
- **`lsp-repo.sh` has only text conflicts.** It has no binary or deleted-side file, so the read-only header and the choice header cannot be shown on it.
- **`app-session stop` deletes the session's home folder** (`stop.ts:29`). Settings and window storage are both gone afterwards, so "survives a restart" cannot be checked in the real app today.
- **`useDropdownMenu.ts` does not close on window blur.** Rule 5 assumes it does.
- **`ServerMenu.vue` does not give the keyboard back on Escape.** Its close step only emits `close` (`ServerMenu.vue` `keyPressed`), so focus falls to the page body.
- **Servers are matched by their shown name.** `LanguageServers` finds a server for its actions by name (`#named`) and carries a user's Stop over by name (`#create`, `lsp/index.ts:153-158`). Detection adds the project suffix only when two projects use a tool (`detect.ts:246-250`). So a suffix change today loses the user's Stop and restarts the server.
- **Old settings files need a default for the new field.** `LanguageServerSettings` has no serde defaults and nothing in `crates/` uses `deny_unknown_fields`. 0.4.0 therefore ignores an unknown `off` inside `languageServers`, but drops it the next time it writes any setting.
- **Two library details checked in the registry sources:** specta rc.25 exports `BTreeSet` (`specta/src/type/impls.rs:73`). specta-serde 0.0.12 makes a `#[serde(default)]` field optional in its Deserialize and Unified modes (`lib.rs`, `field_is_optional_for_mode`).
- **The yamt precedents to copy:** `ToolbarMenu.vue` toggles inside a menu with `role="menuitemcheckbox"` and `aria-checked` (#58). `toolbarButtons.ts` is the pattern for a choice stored in the window.
- **Nothing is copied from WebStorm or VS Code**, so there are no upstream sources to cite.

---

## Option A (recommended): a key beside the name

**Visions served:** 2 (one key, built in one place in `lsp/`), 4 (a `ServerKey` brand; the two sets hold the key, never the name), 5 (no change to how Start/Stop/log work), 1.

### Data structures

```ts
// lsp/internal/spec.ts
export type ServerKey = string & { readonly __brand: "ServerKey" };
export function serverKey(text: string): ServerKey;   // type guard text !== "", RangeError otherwise (like nextVersion)
export type ServerSpec = { readonly key: ServerKey; readonly name: string; … };   // key added
export type FoundSpec = Omit<ServerSpec, "key">;      // what detection builds before its last step
// ServerView gains `key`
```

```rust
// crates/settings
pub struct LanguageServerSettings {
    pub repositories: BTreeMap<String, RepositoryAnswer>,
    /// repository root → keys of the found servers switched off there (the window's text, opaque here)
    #[serde(default)]
    pub off: BTreeMap<String, BTreeSet<String>>,
    pub added: Vec<AddedServer>,
}
pub fn set_server_switch(places, current, root: &str, server: &str, on: bool) -> Result<SettingsRead, Error>
```

```ts
// ui/serverPins.ts — window storage "yamt.servers.pinned" = { "<root>": ["<key>", …] }
export type ServerPins = {
  readonly pinnedServers: Readonly<Ref<ReadonlySet<string>>>;
  togglePin(key: ServerKey): void;
};
export function createServerPins(root: Readonly<Ref<string | null>>, storage?: StorageLike): ServerPins;
```

### 1. Identity

- **Found server:** the key is the tool name with its project, always written out: `oxlint (frontend)`, `TypeScript (repository root)`. This is the same text #71 shows as the name when two projects use the tool. It does not change when the suffix comes or goes, or when the command changes (tsc ↔ tsgo, installed ↔ not installed).
- **Where it is built:** in one spot, the last step of `detect` in `detect.ts`. That step builds the labelled text once and gives `key = serverKey(labelled)` and `name = shared ? labelled : spec.name`. Building it there and not in `specsOf` matters: `vue.ts` copies the TypeScript spec with a spread, so the Vue server would otherwise inherit TypeScript's key.
- **Hand-added server:** `added: <command words joined by spaces>`, built in `addedSpecs`. It does not use the name, because that name gets " (2)" whenever a found server has the same name.
- **Across the IPC:** the key crosses only as plain text in `off`. Rust never reads its meaning, as with action ids in `keys` (#57).
- **Uniqueness:** each project yields at most one spec per preset, and preset names are distinct, so keys are unique [INFERENCE from `detectIn`/`lookIn`; a test pins it].

### 2. Settings file

- **Shape:** a field beside `repositories`, as above.
- **Old files:** a 0.4.0 file reads with nothing switched off, through `#[serde(default)]`. There is no migration step.
- **Possible type wrinkle:** if specta exports the field as optional (`off?:`), keep it optional. `offServers()` (point 3) is the only reader and handles a missing field.
- **New command:** `set_server_switch(current, server: String, on: bool)` in `src-tauri/src/settings.rs`. It is keyed by `servers_context().root` exactly like `set_server_answer`; a non-UTF-8 root gives a plain `read`.
  - Switching one entry at a time, rather than sending the whole list, means two windows on one file never overwrite each other's switches. `set_keys` and `set_repository_answer` already work this way.
- **What Rust does with it:** stores the key as given (a set, so a key appears once) and removes a root left with no switched-off servers. Rust checks nothing about the key's text. A malformed `off` makes the file `Broken`, and nothing is written, as today.

### 3. Where "off" is applied

- **One place:** `ui/serverSetup.ts` `apply()`. It hands `setSpecs` the found servers that are not off, plus the added ones. It reads the off set through `offServers(settings: LanguageServerSettings, root: string | null): ReadonlySet<string>`, which is exported for the Settings view too.
- **Stops at once:** `setSpecs` retires a spec that disappears. Retiring uses the same `halt()` path as Stop, so problems are cleared (`closeAll`) and `Exited with code N` is logged.
- **Never starts:** an off server is never created, so nothing starts it. That covers the question's "Start", window focus (`refocus` → `apply`) and the next start of yamt (`setUp` → `apply`).
- **The start question:** it lists only shown servers and is not asked when none are shown (rule 1: "shows nowhere outside Settings"). If every found server is off and none is added, the question does not come, as today with no servers.
- **New action:** `switchServer(key, on)` writes the switch, then runs `apply`. A failed write changes nothing.
- **Settings still lists off servers:** "Found in this repository" keeps iterating `foundServers`, which is never filtered. Each switch is `!offServers(settings, serverRoot).has(spec.key)`.

### 4. Pins

- **Owner:** `ui/serverPins.ts`, built on `storedValue`, with the storage key `yamt.servers.pinned`.
- **Shape:** `{ <root>: keys[] }`. A non-object, or entries that are not arrays of strings, read as no pins. Other repositories' entries are kept as written, and a root left with no pins is removed. With no root, there are no pins and `togglePin` does nothing.
- **Who holds it:** `createServerSetup` calls `createServerPins(setup.root)` and returns its two fields. `serverSetup` already owns the root, the `ServerSetup` type grows, and `AppStore` picks it up through `& ServerSetup`. This is why `ui/store.ts` needs no edit.
- **Rule 6 (switched off and on keeps the pin):** pins never consult `off`. The header shows the pins that match a shown view, and off servers are not views. A server switched on again is therefore pinned again.

### 5. Header

- **`ServerStatus.vue`**, about 125 lines, props unchanged:
  - Shows the counts and the note as today.
  - Then the buttons of servers with `pinned`, in view order, with today's look and `ServerMenu`.
  - Then `<ServerGroup :buttons :dot>`.
  - It still renders only when there are views.
- **New `ui/serverButtons.ts`** (pure): `ServerButton` = `{ key, name, title: stateLine, dot: class, pinned }`. `serverButtons(views, pinned)` builds them, and the `DOT_CLASSES` table moves here from `ServerStatus`.
- **`groupDot(kinds: readonly DotKind[]): DotKind`** goes in `serverText.ts` beside `dotKind`. It returns the first of problem, warning, busy, running found among the kinds, else stopped.
- **New `ui/ServerGroup.vue`:**
  - **Group button:** title and `aria-label` "Language servers", `aria-haspopup="menu"`, a dot, "Servers", and Lucide `chevron-down`.
  - **Drop-down:** `<ul role="menu" aria-label="Language servers">`, moved to `body` with a fixed position from `menuPosition` (anchored at the button's bottom-left, like `ServerMenu`), `max-h-[60vh] overflow-y-auto`, `@keydown="menuKey"`.
  - **Each row:** `<li role="none" class="flex">` containing
    - `<button role="menuitem" aria-haspopup="menu" :title="stateLine">` with the dot and the name;
    - `<button role="menuitemcheckbox" :aria-checked="pinned" :aria-label="`Pin ${name} to the header`" :title="Pin to the header / Unpin from the header">` with Lucide `pin` and `aria-checked:bg-row-selected`.
  - **Open, close and keys:** `useDropdownMenu<"servers">` does all of it. Up and Down step through row 1, pin 1, row 2 and so on (`stepMenuItem` unchanged). Escape and Tab close and return the keyboard to the opener; an outside press closes.
  - **Choosing a row:** `await close()` (the keyboard goes back to the group button), then set `rowMenu = { name, at }` with the same `at` as the list. `ServerMenu` mounts in the list's place, with the group button as opener, and takes the keyboard.
  - **Clicking the group button while a row's menu is open** only closes that menu, as a second click on a pinned button does today.
- **`ServerMenu.vue`:** its Escape/Tab step calls `props.opener.focus()` before `emit("close")`. Escape then returns the keyboard to the group button, and to a pinned button for a pinned server's menu.
- **`useDropdownMenu.ts`:** also closes on window blur (`useWindowFocus` → `close`). Item queries use one `MENU_ITEMS = "[role=menuitem], [role=menuitemcheckbox]"` constant in `menuKeys.ts`.

### 6. Settings row

- **Control:** there is no switch pattern in the settings view; `ChoiceButtons` is a pressed group of two choices, too heavy for a long monorepo list. Each row's name cell becomes `<label>` around `<input type="checkbox" role="switch" class="size-4 accent-primary">` and the shown name.
- **Accessible name:** the server's name, for example "oxlint (frontend), switch, on".
- **Change handler:** `flip(spec, event)` calls `switchServer(spec.key, checked)`. The row's `:key` becomes `spec.key`.
- **Look:** a switched-off row shows its name in `text-fg-muted`.

### 7. Tests (`ui/` and `lsp/` are mutated by `just mutants`)

**Build R — `crates/settings/tests/language_servers.rs`.** Each test, with the bug it catches:

| test | bug it catches |
|---|---|
| `a_0_4_0_entry_without_off_reads_with_nothing_switched_off` | a missing serde default makes every old file "broken" |
| `a_server_switched_off_is_stored_under_this_root_only` | the wrong root, or a global list |
| `switching_on_removes_the_key_and_a_root_left_empty` | leftover `"off": {"/r": []}` entries, or "on" not removing |
| `switching_off_twice_keeps_one_entry` | a list with duplicates |
| `a_switch_keeps_the_answer_the_added_servers_the_theme_and_unknown_entries` | the change rebuilt from `current` and not from the file |
| `a_malformed_off_entry_is_broken_and_nothing_is_written` | a lenient read that silently drops the entry |

**Build W1:**

- `detect.test.ts`
  - "the key stays when a second project brings the suffix" (bug: key built from the shown name).
  - "keys are unique; Vue's is not TypeScript's" (bug: the spread copies the key).
- `added.test.ts`: "an added server's key is its command, not its numbered name" (bug: " (2)" in the key).
- `index.test.ts`: views carry the key.
- `settings.test.ts`
  - `setServerSwitch` sends `current`, the key and `on`, and adopts the reply.
  - A load that differs only in `off` is adopted (bug: `sameServers` skips the new field).
- `fixtureSettings.test.ts`: the switch is per repository, "on" removes it, other entries are kept.
- `tauri.test.ts`: arguments and the error are passed through.
- `serverSetup.test.ts`, against the real `LanguageServers` and its `FakeHost`:
  - Switching off stops the server at once, and its problems are cleared.
  - An off server never starts: not on "Start", not on focus, not at the next start.
  - The question lists no off servers; with none shown there is no question.
  - Switching on starts the server only under "Start".
  - A failed write changes nothing.
  - The switch survives a second project appearing.
  - Another root's off set does not count.
  - `offServers` itself.
- `serverPins.test.ts`, with a fake `StorageLike` as in `toolbarButtons.test.ts`:
  - None pinned at first; pin and unpin.
  - Pins are per root, and other roots stay as written.
  - With a null root, toggling does nothing.
  - Unreadable or wrongly typed storage reads as none.
  - An emptied root is removed.

**Build W2:**

- `serverText.test.ts` `groupDot`: every pair of kinds in order, the empty list, one running beside stopped ones (bug: wrong urgency order, or "running" only when all run).
- `serverButtons.test.ts`: view order kept, the `pinned` flag, the title is the state line.
- `ipc/fixtureServers.test.ts`: `findProgram` and `projectFiles` answers; start answers `SpawnFailed`.
- `app-session/args.test.ts`: `--home`.

**WebKit**

Start `pnpm -C frontend dev --port 5277`, then `just webdriver 4447` with MiniBrowser and the window at 1600×1000. Open `http://localhost:5277/?servers`.

1. The question lists oxlint, TypeScript, Vue (not installed) and eslint (not installed) → "Don't start". The header has only "Language servers"; there is one `[aria-haspopup=menu]` in the toolbar. Its dot is warning.
2. Click it. The menu has 4 rows whose titles are the state lines, and 4 `menuitemcheckbox` with `aria-checked=false`.
3. Pin oxlint and TypeScript. Exactly those two buttons appear left of the group, in list order. The list stays open, and the titles now say "Unpin from the header".
4. Escape → the list is closed and `document.activeElement` is the group button.
5. Pinned oxlint → its menu → Show log → the log view → Back.
6. Unpin TypeScript → one pinned button is left.
7. Reload (`read "location.reload()"`) → "Don't start" → oxlint is still pinned.
8. Keyboard: focus the group button, then
   - Enter → row 1 has focus;
   - Down → pin 1;
   - Down, Down → TypeScript's pin; Space → pinned;
   - Up → TypeScript's row; Enter → its `ServerMenu` has focus;
   - Escape → focus is back on the group button.
9. Open the list, then `focus-away` → the list closes; `focus-back` → focus is on the group button.
10. Start from a menu → "Could not start: …", and the group dot turns to problem.
11. Settings → Found:
    - 4 switches, all on.
    - TypeScript off → it leaves the header and the list.
    - On again → its pin is back.
    - All four off → no status area at all.
12. Screenshots of the header with pins and the open list, dark and Light.

The fixture page has no read-only or choice files; those headers are covered in the real app (step 5 there).

**Real app** (`cargo tauri build --debug --no-bundle`, sessions named `q-…`)

1. `scripts/lsp-repo.sh --servers /tmp/yamt-q/lsp`, then `start-app --name q-a --repo /tmp/yamt-q/lsp --home /tmp/yamt-q/home`.
2. Answer "Start". The header shows the counts and the group only. The list shows every server and its state. Pin two, then use their menus: Stop, Start, Show log. Unpin one.
3. Open a `py/` conflict that has ruff problems. In Settings, switch ruff off.
   - Its underline goes and the counts drop (`read` of the `.cm-lintRange` count in the Result).
   - `pgrep -f "ruff server"` is empty.
   - ruff is not in the header or the list.
   - `stop`, then `start-app --name q-b` with the same `--repo` and `--home`: no question, ruff stays absent and never starts, the pins are present.
   - Switch it on → the process is back. Its pin is back if it was pinned. Show log contains "Exited with code 0" before the new "Starting ruff server …".
4. Suffix:
   - In the first session, pin oxlint (web) and switch another node tool off.
   - `stop`. Then in `/tmp/yamt-q/lsp`: `git merge --abort`, copy `web/` to `web2/` on both branches, and merge again.
   - `start-app` with the same `--home`. The shown name is now "oxlint (web)": still pinned. The switched-off tool is still off.
5. Other header rows:
   - `scripts/conflict-repo.sh /tmp/yamt-q/plain`, then `start-app --name q-c --repo /tmp/yamt-q/plain --settings '{"languageServers":{"repositories":{},"added":[{"command":["oxlint","--lsp"],"fileTypes":["ts"]},{"command":["taplo","lsp","stdio"],"fileTypes":["toml"]}]}}'`.
   - Pin oxlint. The binary file's choice header and the deleted-side read-only header both show the pin and the group, and the list works there.
6. Dark and Light screenshots of each.

### 8. Builds (disjoint ownership; R, then W1, then W2)

| build | files | changed lines | gives the next build |
|---|---|---|---|
| **R** `rust-impl` | `crates/settings/src/lib.rs`, `tests/language_servers.rs`, `AGENTS.md`; `src-tauri/src/settings.rs`, `commands.rs` (register), `AGENTS.md`; `frontend/src/ipc/bindings.ts` (`just bindings`) | ≈150 | `LanguageServerSettings.off: { [root]: string[] }` (possibly optional, see point 2); `commands.setServerSwitch(current, server, on) → SettingsRead`. Web typecheck is red until W1 lands. |
| **W1** `web-impl` (identity, off, pins) | `lsp/internal/spec.ts`, `detect.ts`, `vue.ts`, `added.ts`, `lsp/index.ts` (+ `detect`/`added`/`index` tests, and every test helper that builds a spec gains `key`); `ipc/ChunkSource.ts`, `tauri.ts`, `fixtureSettings.ts` (+ tests); `ui/settings.ts`, `serverSetup.ts`, **new** `ui/serverPins.ts` (+ tests), `LanguageServerSettings.vue`; literal fixes in `store.test.ts`, `saving.test.ts`, `servers.test.ts`, `question.test.ts`; `lsp/AGENTS.md`, `ipc/AGENTS.md` | ≈180 production, ≈330 tests | `ServerView.key: ServerKey` (exported from `lsp`); `serverViews` holds shown servers only; `store.pinnedServers`, `store.togglePin(key)`, `store.switchServer(key, on)` |
| **W2** `web-impl` (header, fixture, tooling) | `ui/ServerStatus.vue`, **new** `ui/ServerGroup.vue`, **new** `ui/serverButtons.ts` (+test), `ui/serverText.ts` (+test), `ui/ServerMenu.vue`, `ui/useDropdownMenu.ts`, `ui/menuKeys.ts`; **new** `ipc/fixtureServers.ts` (+test), `ipc/index.ts`, `main.ts` (`?servers`); `frontend/scripts/app-session/args.ts`, `start.ts`, `args.test.ts` (`--home <dir>`: used as the app's home, created when missing, never removed by `stop`); `ui/AGENTS.md` | ≈330 | — |

- **Orchestrator:** plan §2 #83, `docs/architecture.md` (§3.5, §3.6, §5.1, §5.3b, §5.4), the project-map and ipc-contract skills (PM6: the three new files and the new command), `CHANGELOG.md`.
- **Other feature:** none of its files are touched (`MergeView`, `ChoiceView`, `FileList`, `style.css`).
- **Component count (VU15):** `ServerGroup.vue` owns one popup group — the button, the list and a row's `ServerMenu` — which keeps `ServerStatus` at about 125 lines.
- **Fixture host (`fixtureServers.ts`):** a file tree for one root project — `package.json`, `tsconfig.json`, TypeScript 5.9.3, `.bin/oxlint`, `.bin/typescript-language-server`, an eslint config and package — with `findProgram` walking `.bin` and `start` answering `SpawnFailed` ("language servers run only in the app"). It uses the root `"/fixture/repository"` exported from `fixtureSettings.ts`. No formatter is in the tree, so Save in fixture mode shows no note.

### 9. Draft for plan §2 #83

| 83 | **Found language servers can be switched off; the header groups them and shows only pinned ones** (owner 2026-10-19, GitHub issue 3 and chat; rules 1–7 in `docs/slices/request-server-pins.md`; design `briefs/3.Q-server-pins-design.md` option A). **Identity:** each server spec carries a `ServerKey` built once in `lsp/` that does not change with its shown name: a found server's is its tool name with its project, always written out (`oxlint (frontend)`, `TypeScript (repository root)` — #71's suffix text); a hand-added server's is `added: ` plus its command. Start/Stop/Restart/Show log still go by the shown name. **Off:** settings file `languageServers.off { <root>: [keys] }` beside `repositories` (`#[serde(default)]`: a 0.4.0 file reads with nothing off); `set_server_switch(current, server, on)` keyed by the host's root, one entry per change; Rust keeps the keys as opaque text and removes a root left with none. The window drops off servers in one place (`serverSetup` `apply` through `offServers`) before `setSpecs`: an off server is retired at once (Stop's path: problems cleared, the exit logged) and never created by the question, focus or the next start; the question lists only shown servers and is not asked when none show; Settings lists every found server with a native `role="switch"` checkbox labelled by its name. **Pins:** window storage `yamt.servers.pinned` = `{ <root>: [keys] }` (`ui/serverPins.ts`), never pruned by off, so a server switched on again is pinned again. **Header:** counts, note, the pinned buttons in list order, then "Servers" with the most urgent dot (`groupDot`: problem, warning, busy, running, stopped) and a drop-down moved to the body (`role="menu"`: per server a `menuitem` row and a `menuitemcheckbox` pin with `aria-checked`, Up/Down through both in order); a row closes the list and opens `ServerMenu` in its place with the group button as opener; Escape in any `ServerMenu` returns the keyboard to its opener; `useDropdownMenu` also closes on window blur. **Fixture page:** `?servers` gives a fixture host (one project: oxlint, TypeScript, Vue, eslint; starts answer "run only in the app"). **Verification:** `app-session start-app --home <dir>` keeps a home across sessions | The shown name as the key (a second project renames it and the switch and pin are lost, rule 2); the command as the key (TypeScript's changes with tsc/tsgo); the key as the only handle for Start/Stop/log as well (option B: one identity, but about 150 more lines in the #70/#71 code that rule 7 keeps unchanged); a per-repository record `{answer, off}` (option C: 0.4.0 reads the new file as broken, "not asked" gets two spellings, an untagged reader); `off` as a top-level entry 0.4.0 would keep (not beside the answer, rule 2); a replace-all list command (two windows overwrite each other); "off" known to `lsp/` (a settings fact in the protocol client); pins in the settings file (#58); `aria-pressed` on the pin (not allowed on a menu item; `ToolbarMenu`'s `menuitemcheckbox` is the precedent); Left/Right between a row and its pin (a second key rule beside `stepMenuItem`) | 2, 4, 1, 5 |

---

## Option B: the key is the only handle

Visions 2, 1 and 4 are stronger here; vision 5 is weaker.

- **What changes beyond A:**
  - `LanguageServers.start/stop/restart/log(key: ServerKey)`; `#named` becomes a lookup by key; `#create` carries a user's Stop over by key; logs are kept by key (`server.ts` `#log`).
  - `ui/servers.ts` actions take keys; `screen.ts` becomes `serverLog { key }`; `ServerLogView` takes its title from the view's name, falling back to the key. The prop is named `server`, because `key` is reserved in Vue.
  - `ServerMenu` and `ServerStatus` pass keys.
- **What the user would notice:** a user's Stop and a server's log both survive a suffix change. Today they are lost and the server restarts.
- **Cost:** about 150 more changed lines, mostly in tests (about 30 call sites in `lsp/index.test.ts`, `servers.test.ts`, `store.test.ts`, `serverSetup.test.ts`). It also reworks the #70/#71 code that rule 7 keeps unchanged.
- **Builds:** the `lsp/`, `servers.ts`, `screen.ts` and `ServerLogView` changes join W1; `ServerMenu` and `ServerStatus` stay in W2.

## Option C: one record per repository in the file

Vision 2 for the file; vision 1 is weaker.

- **Shape:** `repositories: { <root>: { answer: "start" | "dontStart" | null, off: [keys] } }`, read with a beginner-unfriendly untagged enum so 0.4.0's plain strings still parse.
- **Cost:**
  - 0.4.0 reads a new file as `Broken`, so the owner's installed app refuses every settings change.
  - "Not asked" can then be written two ways.
  - Three answer readers in the window change.
- **Gain:** a repository's facts sit together in one record.
- **Builds:** the same as A, plus a heavier R and changes to `serverSetup.ts`, `LanguageServerSettings.vue` and `fixtureSettings.ts`.

---

## Recommendation: option A

It meets rules 1–7, leaves Start/Stop/log/menus untouched, keeps the file readable by 0.4.0, and needs no edit to `store.ts` or `App.vue`. Its costs:

- **Two handles on a view:** `name` for actions, `key` for pins and off. The brand turns `togglePin(view.name)` into a type error; the reverse mistake finds no server, and tests catch it.
- **What stays as today:** a user's Stop is still lost on a suffix change.
- **Extra tooling:** the `?servers` fixture host and `--home`.
- **When to switch:** take option B if a reader is confused by the two handles.

## Refinements to the request and brief (`deviations_from_brief`)

1. **Pin accessibility:** rule 5 asks for `aria-pressed`, but it is not allowed on a menu item. I used `menuitemcheckbox` with `aria-checked`, as `ToolbarMenu` does. The pressed look and both titles stay.
2. **Window blur:** rule 5 says yamt's drop-downs close on blur; `useDropdownMenu` does not. It gains that rule, so `PresetPicker` and `KeymapList` close on blur too.
3. **Keyboard after Escape:** `ServerMenu` now gives the keyboard back to its opener on Escape, for pinned buttons too. Today it is lost.
4. **WebKit acceptance** is impossible at `6c5f91a`: the fixture page has no servers. Fix: the `?servers` fixture host.
5. **Real-app restart checks** are impossible with `app-session` today. Fix: `--home`. Also, `lsp-repo.sh` has no choice or deleted-side file, so the other header rows are checked on `conflict-repo.sh` with two hand-added servers.

## Open risks

- **0.4.0 drops the switches:** 0.4.0 writing any setting removes `off`. This is open question 2 below.
- **A preset renamed in a later yamt** loses that tool's switches and pins, because the key contains the tool name.
- **Duplicate hand-added servers:** two with the same command share one pin.
- **Pins are never pruned:** pins for servers that are no longer found stay in window storage, as answers for repositories never opened again stay in the file.
- **Doc edits from both features:** `docs/architecture.md` §5.4 and `ui/AGENTS.md` are edited by both features, so the orchestrator merges those docs.

## Open questions for the product owner

1. **Browser preview:** opened with `?servers`, the preview shows four servers that never run, after a start question; without it, nothing changes. Is that acceptable?
2. **Going back to 0.4.0:** a user who switches servers off and then changes any setting in 0.4.0 gets every server back on. Should the switches stay beside the answer anyway (rule 2), or move to a separate top-level entry that 0.4.0 leaves alone?