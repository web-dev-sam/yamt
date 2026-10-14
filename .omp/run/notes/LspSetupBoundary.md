# LspSetupBoundary (boundary review of 1d31e9d, board row 9)

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "state-ownership: question waiting for an answer (ui/asking.ts)",
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 167,
      "problem": "Escape now runs through `serverSetup.dismissQuestion` for every question, including exit, clash and unprocessed (App.vue:101 → QuestionDialog `dismiss`). serverSetup works out that a question was dismissed by comparing a `dismissals` counter before and after an `await` (:91-96). It also copies asking's one-question-at-a-time rule (:88 repeats asking.ts:19), because asking's `false` cannot be told apart from Don't start. So the waiting question is ended by two modules, and the dialog's general behaviour is tested in serverSetup.test.ts:330 ('Escape on another question still means its cancel'). Growth: the next question that has to tell Escape apart from No must either go through the language-server module or add another counter, and asking.ts no longer owns how its questions end.",
      "fix": "Have asking.ts answer with three outcomes, for example `ask` resolving to `\"yes\" | \"no\" | \"dismissed\"` plus a `dismiss()` (existing callers map `\"yes\"` to true). Wire `dismissQuestion: asking.dismiss` in store.ts and delete `dismissals`, the `question.value !== null` pre-check and the dismissal tests from serverSetup. The orchestrator has to grant asking.ts, which is outside `Owned`."
    },
    {
      "severity": "block",
      "rule_id": "copied decision (growth check)",
      "file": "frontend/src/ui/question.ts",
      "line": 31,
      "problem": "`projectLabel` copies how a project folder reads, which serverText.ts:147 (`installText`) already decides (\"\" → the repository root, otherwise `folder/`). Settings now takes this server label from the question-words module (LanguageServerSettings.vue:7,64). The words for a server that is not installed now exist three times: question.ts:36 \"(not installed)\", LanguageServerSettings.vue:32 \"not installed\", and serverText.ts:81 \"Not installed\". The map puts every server word in serverText.ts. Growth: changing how a folder or a missing server reads means finding and editing two or three modules, and they will drift apart.",
      "fix": "Move `projectLabel` and one not-installed label into serverText.ts. Use `projectLabel` inside `installText`'s folder line. Have question.ts `serversText` and LanguageServerSettings.vue import both from serverText.ts."
    },
    {
      "severity": "should",
      "rule_id": "VU16",
      "file": "frontend/src/ui/App.vue",
      "line": 44,
      "problem": "Three places each own a piece of the start and focus flow. The rule 'detect after the file list and the settings are in' is written once for start in main.ts:16 and again for focus as `await Promise.all(...)` then `findServers()` in App.vue:44-49. serverSetup.ts:112/116 adds a `started` guard on top. App.vue is supposed to be a composition surface with no feature logic. Growth: a new input to detection has to be awaited in both main.ts and App.vue, and App.vue keeps picking up flow logic.",
      "fix": "Give serverSetup's target `loadFiles`, `refreshFiles` and `loadSettings`, and expose `start()` and `refocus()` that do the ordering themselves. main.ts calls `store.start()` and App.vue's watch calls `refocus()`, so the ordering and the `started` guard live in one module."
    },
    {
      "severity": "should",
      "rule_id": "PM5 (spirit) / CP1",
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 126,
      "problem": "Don't start stops the running servers by calling `setSpecs([])` first. That only works because of how the private `LanguageServers.#create` carries `userStopped` across a reconcile, and the comment quotes that private member. lsp offers no named operation to stop servers without marking them as stopped by the user. Growth: a refactor of lsp's private carry-over silently changes Don't start, and the next caller that needs the same thing has to copy the two-call trick.",
      "fix": "Have lsp provide the behaviour, for example `setSpecs(specs, { startOnOpen: false })` halting live runs without `userStopped`, or a `halt()` (needs a grant, lsp is read-only here). Then `answer` calls only `apply`, and the comment goes."
    },
    {
      "severity": "should",
      "rule_id": "dead weight",
      "file": "frontend/src/ui/store.ts",
      "line": 143,
      "problem": "`settingsActions(state)` is built twice: once in `actions()` (:180) and once for `createServerSetup` (:143). Growth: today the two copies only share `state.latestSettings`. If `settingsActions` ever holds its own state, such as a ticket or a pending edit, the store and serverSetup will quietly use separate instances.",
      "fix": "Build it once in `createAppStore` (`const settingsActs = settingsActions(state)`), spread it into the store and pass it to both `actions(state, buttons, settingsActs)` and `createServerSetup`."
    },
    {
      "severity": "should",
      "rule_id": "growth check: state owner row",
      "file": "docs/architecture.md",
      "line": 531,
      "problem": "New state has no owner row in the state table: the detected specs and the repository root (`found`/`root` in serverSetup.ts:25-26, exposed as `foundServers`/`serverRoot`). Row 531 still says that `LanguageServers` holds every spec. Line 797 still shows `createAppStore(source, startTheme)`. Growth: a reader cannot answer in 30 s where the Settings 'Found' list comes from or what changes it.",
      "fix": "Add the row 'detected servers and the repository root | `ui/serverSetup.ts` (`found`, `root`), written only by `look` at start and on focus' to architecture §5.1 and to the project map's table, and update line 797 to the 4-parameter `createAppStore`."
    },
    {
      "severity": "nit",
      "rule_id": "TS (types prove the case)",
      "file": "frontend/src/ui/LanguageServerSettings.vue",
      "line": 35,
      "problem": "`pick` handles a `\"notAsked\"` value that the buttons can never emit. It only exists because `ChoiceButtons` requires `pressed: T`, which widens `T`. Growth: nothing.",
      "fix": "Make `ChoiceButtons`' prop `pressed: T | null`, pass `answer` directly, and bind `@pick=\"answerServers\"`."
    }
  ],
  "checked": [
    "Host reaches ui only through ipc types: store.ts:13 and serverSetup.ts:3-9 import `ServerHost` as a type from ../ipc. createTauriServerHost is built only in main.ts:12. No ui file imports @tauri-apps/* or lsp/internal (grep of the new files' imports).",
    "Deviation 'createAppStore 4th parameter' accepted: the same `host` object goes to `new LanguageServers(host)` and to the store (main.ts:12-15), and the brief's contract needs it as detect's lookups.",
    "Deviation 'start sequence in main.ts' accepted as a grant. Its ordering split with App.vue is finding 3.",
    "Deviation 'QuestionText list/note' accepted: `QuestionList` is a sum type, QuestionDialog.vue renders each kind, and the `questionText` switch is exhaustive with a `never` default (question.ts:109-112).",
    "Deviation '...state.guard spread' accepted: `CloseGuard` has exactly the five members it returns (closeGuard.ts:10-16, 35-51), so no extra member leaks into the store. store.ts is 299 lines, under oxlint `max-lines` 300 (.oxlintrc.json:53).",
    "Deviation 'lsp/index.ts ProjectLookups re-export removed' accepted: no importer left. `detect` takes the host structurally (serverSetup.ts:61).",
    "Deviation 'Don't start halts via setSpecs([])': behaviour verified against lsp/index.ts:61-68 and 142-146. Its coupling is finding 4.",
    "Deviation 'Escape via dismiss emit' is finding 1. asking.ts is unchanged, and `dismiss` is a second route by which a question gets answered.",
    "#935 guards: `sameStored` (settings.ts:126-128), `sameServers` (:104-105) and `sameAdded` (:97-98) destructure every field plus `...rest` with `rest satisfies Record<string, never>`. `adopt` copies the same four fields.",
    "One owner for the stored answer: answers are written only by `setServerAnswer` through `send` (settings.ts), and serverSetup only reads `settings.languageServers.repositories[root]` (serverSetup.ts:81). The Settings component reads it the same way and never writes it.",
    "Stale-detection ticket `latestLook` (serverSetup.ts:53-66) follows the store's existing `latestOpen` ticket pattern. `found`/`root` are written only in `look`.",
    "Words of the servers question (title, message, note, buttons) are only in question.ts:39-56. QuestionDialog.vue adds no words.",
    "SettingsView.vue: the new section is placed after Keymap, as the brief asks. LanguageServerSettings.vue keeps VU2 order (imports → consts → store → state → computed → functions), uses type-based macros, has no inline logic handlers, and its only one-level ternary is in `:class`.",
    "PM2/PM3: serverSetup.ts imports vue only for `shallowRef`/types (ui layer), plus ../ipc, ../lsp (index) and ui siblings. No editor/ or model/ import.",
    "scripts/lsp-repo.sh: sources git-sandbox.sh, calls `isolate_git_config` and `require_empty_dir`. The header follows CP4 and gives the external fact's source (crates/lsp-host/src/files.rs). Shell functions state their positional parameters.",
    "AGENTS.md (ui) line 5 describes serverSetup's job and the Escape rule, and agrees with the code.",
    "No gate or test was run (RV6). I could not run `git show` here, so I reviewed the touched files as they are now."
  ]
}
```