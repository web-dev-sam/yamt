# LspSetupCorrectness (correctness review of 1d31e9d, board row 9)

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": null,
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 123,
      "problem": "`answer()` applies the new choice even when `setServerAnswer` fails. Failures are real here: a broken or unwritable settings file gives `SettingsBroken`, and `send` in settings.ts:208-221 reports the error and returns without throwing. So when the user clicks \"Don't start\" in Settings, the servers stop, but the button stays on \"Start\", and at the next window focus `findAgain` applies the stored \"start\" (line 119) and starts them again. A failed \"Start\" does the reverse: servers run while the button says \"Don't start\". Every other settings action changes nothing in the window after a failed write. `changeAdded` (line 139) follows that rule by applying `storedAnswer`, so this is a second, conflicting copy of the rule for which answer is in force.",
      "fix": "After the write, apply what the settings now hold, the way `changeAdded` does: `const now = storedAnswer(setup)`, call `setSpecs([], …)` only when `now === \"dontStart\"`, then `apply(setup, now)`. Add a serverSetup.test.ts case where the fake `setServerAnswer` leaves the settings unchanged and expect the servers' states to stay as they were."
    },
    {
      "severity": "block",
      "rule_id": null,
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 168,
      "problem": "Escape for every question now goes through the server set-up. App.vue sends QuestionDialog's `dismiss` to the store's `dismissQuestion`, which belongs to `ServerSetup`. It bumps a `dismissals` counter in serverSetup and calls `asking.answer(false)`; `ask()` (lines 93-97) then compares counters to tell Escape from \"Don't start\". The state table says `ui/asking.ts` owns the question waiting for an answer, but this lifecycle state now lives in a second module. The unsaved-changes, key-clash and Mark-resolved questions (exit/clash/unprocessed) depend on serverSetup for their Escape, and the next question that needs Escape to differ from cancel would need another counter.",
      "fix": "Give `asking.ts` a `dismiss()` and let a question resolve to dismissed, for example `ask` resolving `true | false | null` behind a small wrapper for the existing boolean callers. Bind QuestionDialog's `dismiss` to it, then delete `dismissals` and `dismissQuestion` from serverSetup. This needs asking.ts added to Owned."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 103,
      "problem": "If the start `look` fails (`host.context()` or a detection IPC call rejects), `setUp` returns before `started = true`, so every later `findServers` does nothing for the rest of the run. That breaks #70's \"looked for again whenever the window regains focus\" after a single transient IPC failure. Today it is reachable only when the IPC itself rejects, because the Rust commands cannot fail. The test at serverSetup.test.ts:394 pins the start behaviour but has no focus case. As the app grows, any fallible lookup added to detection would inherit this one-strike rule without anyone noticing.",
      "fix": "Separate \"the start flow has run\" from \"the start look succeeded\": set `started` in a `finally` (or before the early return), so focus looks again without ever asking. Add a test where the first context call fails and a later `findServers` finds the servers stopped and asks nothing."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/serverSetup.ts",
      "line": 45,
      "problem": "`parseAddedServer` keeps file types with an inner dot (`d.ts`), and serverSetup.test.ts:575 pins that as correct. But `extensionOf` in lsp/internal/spec.ts:24-27 returns only the part after the last dot, so such a type can never serve a file, and the Settings row looks valid while doing nothing. Nothing else builds on this.",
      "fix": "Return null for a file type that still contains a dot after the leading dots are dropped, so Add stays disabled, and change the `d.ts` assertion to expect null."
    }
  ],
  "checked": [
    "The answer is keyed by the host root. serverSetup reads `repositories[root]` with `root` from `host.context()`, and Rust's `set_server_answer` writes under `lock(&host).context().root` (src-tauri/src/settings.rs:113-115), so it is the same string. Covered by the test \"an answer stored for another repository does not count\".",
    "Start ordering: main.ts runs `setUpServers` only after `Promise.all([loadFiles, loadSettings])`. `loadFiles` and `loadSettings` never reject (`attempt` in listing.ts:19 and settings.ts:209), so detection always sees the first list and the stored answer. Focus before set-up has finished does nothing (`started` guard; test \"focus: before the start set-up has finished\").",
    "Start flow: no specs means no question and no setSpecs; a stored answer means no question and `startOnOpen` taken from it; with no answer the question is asked and Start / Don't start are stored; Escape stores nothing and sets `startOnOpen` false; added servers alone also trigger the question; a non-UTF-8 root means nothing at all. Each case has a serverSetup.test.ts test against a real `LanguageServers` over a fake host.",
    "Focus: `findAgain` never asks. It applies the stored answer, so a repository without an answer keeps its servers stopped. `setSpecs` keeps unchanged servers running (lsp/index.ts:61-77, `sameValue` reuse): the test checks that nothing was stopped and that only typescript-language-server got a new run. A stale detection is dropped by the `latestLook` ticket, and deleting that check would fail the test \"an older detection that answers last is dropped\".",
    "Settings → \"Don't start\" stops running servers: `setSpecs([])` halts them, and the new `Server`s are not `userStopped`, so a later Start starts them. Deleting line 131 fails the settings test (it expects `host.stopped` to be oxfmt and oxlint). Start twice keeps the same runs.",
    "Added servers: `addedSpecs` names a duplicate \"oxlint (2)\" and lists added servers after the found ones, Remove is by index, and Command and File types are parsed as described (split, leading dots dropped, lower-cased; lsp's `extensionOf` lower-cases too, so the lower-casing is harmless). Tests: serverSetup.test.ts:484-579.",
    "Fixture mode: with host null, `setUp` and `findAgain` return early and `answer` only stores. LanguageServerSettings hides \"This repository\" and \"Found\" when `serverRoot` is null. Covered by the test \"fixture mode (no host): nothing at all\".",
    "A failing host context is logged as `servers.detect_failed` and nothing is asked (test exists). The focus consequence is reported as a should.",
    "#935: `sameStored`, `sameServers` and `sameAdded` each destructure into named fields plus `...rest` with `rest satisfies Record<string, never>`. A new required or optional field would make `rest` non-empty, so typecheck fails (it is not testable at runtime, as the brief says). The added test for a key moving between actions is a real adopt case.",
    "Question text: one line per project folder plus one \"added by you\" line, \"(not installed)\" marking, the note, and Start / Don't start (question.test.ts). QuestionDialog shows `list.kind` servers and the note. Escape on the other questions still resolves to false (test \"Escape on another question still means its cancel\").",
    "Store: `...state.guard` exposes exactly CloseGuard's five members (closeGuard.ts:10-16). `settingsActions(state)` is called a second time for serverSetup, but its closures use the same `state`, so `latestSettings` tickets are shared.",
    "The implementer's 11 serverSetup.ts Stryker survivors are equivalent per VF7(a), as claimed: `[\\s,]+` vs `[\\s,]` (empty parts are filtered out); both counters are only compared for equality; the stale `return true` only reapplies the current `found`; `root === null` gives `repositories[null]`, which falls to `?? null`; `host !== null` cannot matter because `started` is never true without a host; and the `setSpecs([], …)` options and contents are overwritten by the `apply` that follows. settings.ts:111 is equivalent, and settings.ts:128 was a survivor before this slice. Main's `just mutants 0b4c487` survivors had not arrived when this review finished, so they are not triaged here.",
    "scripts/lsp-repo.sh follows conflict-repo.sh's sandbox pattern (`require_empty_dir`, `isolate_git_config`, `repo_git`, RK19), contains every Behaviour 6 file, and dies unless there are exactly 2 conflicts.",
    "Open risk (project_files refuses links leading out of the repository): accepted, with a narrow reach. In pnpm's default layout the links stay inside the project: this checkout's frontend/node_modules/typescript resolves to frontend/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript under pnpm 12.0.0. npm and yarn-classic install real folders. TypeScript is missed only when the real path leaves the repository: pnpm's opt-in `enableGlobalVirtualStore`, or `pnpm link`/`npm link` to an outside checkout [INFERENCE]. The smoke script's copied package.json is needed only because it links into another repository. The fix would belong to lsp-host, outside this slice.",
    "Accepted deviations: the 4th `host` parameter (granted); `loadSettings` moving to main.ts; the `list`/`note` QuestionText shape; the `ProjectLookups` re-export removed (granted). The map already names serverSetup, LanguageServerSettings and lsp-repo.sh.",
    "No tests or tools were run; every finding comes from reading the code."
  ]
}
```