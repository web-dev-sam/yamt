```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "growth: second copy of a rule",
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 169,
      "problem": "`loadFile` writes its own copy of the rule that a later success clears the problem about this path (`problem?.action === \"open\" && problem.path === path`) when `problem.ts` `clearProblemAbout` (used four times in `saving.ts`) already holds it. If that rule ever changes, the range window will drift from the merge window.",
      "fix": "Replace lines 169-172 with `clearProblemAbout(state, path);` imported from `./problem`."
    },
    {
      "severity": "block",
      "rule_id": "growth: side channel / words outside the words file (architecture §5.1 'words only in ui/problemText.ts'; design §7 'Words, in ui/rangeText.ts only')",
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 151,
      "problem": "A failed `openRange` sends the word \"the range\" (`RANGE_WORD`, line 53) through the `path` field of an `open` Problem. The window's text then comes from data that isn't a path: the log line `store.open_failed` records `path: \"the range\"`. The store now holds words, which contradicts the patch's own `ui/AGENTS.md` line \"Every range word is in `rangeText.ts`\". The compare root added its own `tabs` kind for the same situation.",
      "fix": "Add a Problem kind for this failure, e.g. `{ action: \"openRange\"; cause }`, in `problem.ts` (with its `logProblem` case) and its words in `problemText.ts`. The orchestrator grants both files. Then report it from `startUp` and delete `RANGE_WORD`."
    },
    {
      "severity": "should",
      "rule_id": "principles §2 (reader load)",
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 162,
      "problem": "`loadFile(file: RangeFileId)` looks the id up again and falls back to the made-up path `file ${id}`. That fallback is a second word outside `rangeText.ts`, and the only time it is reached is in the test that calls it before `openRange` answers. Every real caller (`useRangeController`) already holds the `RangeEntry`, so readers have to work out a case that cannot happen.",
      "fix": "Make it `loadFile(entry: RangeEntry)`. Use `entry.path` and `entry.id` directly, drop `entryOf`'s use here and the fallback, and delete the \"names file 3\" test case."
    },
    {
      "severity": "should",
      "rule_id": "naming",
      "file": "frontend/src/ui/useRangeController.ts",
      "line": 38,
      "problem": "`RangeHandle.shown` (what a view displays: loading / columns / sentence) shares its name with the store's `shown` (the shown file id) and the `shown` prop (PaneFrame visibility). `RangeView.vue:31` has to rename it to `view`. As more views copy this, a reader cannot tell three different facts apart by name.",
      "fix": "Rename the field and the `RangeShown` type to e.g. `content` / `RangeContent`, and destructure it as `content` in `RangeView.vue`."
    },
    {
      "severity": "should",
      "rule_id": "TS17",
      "file": "frontend/scripts/fences.ts",
      "line": 47,
      "problem": "`WINDOW_RULES` and `ROOT_FILES` (line 38) are keyed and valued by bare `string`, even though the roots are known when the code is written (`merge`/`compare`/`range`). Adding a fourth root compiles without a rule entry and is silently left unfenced.",
      "fix": "Declare `type Root = \"merge\" | \"compare\" | \"range\"`, type `ROOT_FILES` as `Readonly<Record<string, Root>>` and `WINDOW_RULES` as `Readonly<Record<Exclude<Root, \"merge\">, \"PM7\" | \"PM9\">>`, and narrow the regex group with a guard before indexing."
    },
    {
      "severity": "should",
      "rule_id": "clean cutover (no re-export aliases)",
      "file": "frontend/scripts/app-session/args.ts",
      "line": 37,
      "problem": "`export type { Recording } from \"./startArgs\"` stays only because `video.ts:5` still imports `Recording` from `./args`. The type now has two import paths, and the alias keeps living after the split.",
      "fix": "Change `video.ts:5` to `import type { Recording } from \"./startArgs\";` (the orchestrator grants the file) and delete the re-export line."
    },
    {
      "severity": "nit",
      "rule_id": "VU16",
      "file": "frontend/src/ui/RangeApp.vue",
      "line": 40,
      "problem": "The decision that the range is empty (`start.files.length === 0`) is made in the root component, which should only compose. Nothing gets much harder, but a second empty-state rule would end up in the component too.",
      "fix": "Have `emptyRangeText` return `string | null` (null when files exist), or put an `emptyText` computed on the store, and bind it directly."
    }
  ],
  "checked": [
    "main.ts:36-46,82-97: `windowKind` follows the contract (app: data-window compare|range, anything else merge; fixture: ?range before ?diff). The switch is exhaustive with a `never` default. `startRange` builds only the range source, `createRangeStore`, `startUp` and `RangeApp`: no LanguageServers, no merge store, no compare store.",
    "RangeApp.vue registers no `onWindowClose`, so there is no close guard, as design §3 says. `useThemeAttribute()`, window keydown → `fileListKey` and focus → `loadSettings` mirror CompareApp.vue.",
    "Fence PM9 and the PM7 addition: `rootFinding` (fences.ts) bars each root from the others' store/App files and from lsp/. fences.test.ts covers every forbidden target from .ts, .vue and .test.ts files, and the reverse compare→range case. The case-insensitive broadening (deviation) only widens what is fenced and catches no shared ui file today: accepted.",
    "rangeStore.ts: `shown` is written only in `show()`, which is called from `showFile` and `startUp`. `visited` is written in `show` and `forget`; `forget` is the brief's failed-load rule. The settings seam is registered via `registerSettingsStore`. `fileListKey` is the shared function. Store size and jobs match compareStore.",
    "`import type { Preferences } from \"./useMergeController\"` in rangeStore.ts follows compareStore.ts's existing precedent. ui/ reaches ../editor only through useRangeController.ts; the test's type-only import matches useCompareController.test.ts.",
    "RangeView.vue uses PaneFrame, `compareColumns()`, `ACTION_NAMES` and SettingsButton like CompareView.vue. It has no historyKey/format/settle, consistent with plan §2 #106.",
    "The compare window binds no previous/next-change keys (grep: only CompareView buttons; sideKeys covers side panes only), so binding none in RangeView is consistent: accepted.",
    "RangeFileRow.vue tokens `text-success-signal`, `text-problem-error`, `text-problem-warning`, `text-chunk-modified-removal` and `text-fg-muted` all exist in style.css @theme (lines 32, 49, 50, 52, 123).",
    "rangeText.ts: the words match design §7, and `fileSentence` ends in an exhaustive `never` default.",
    "useRangeController keeps texts only in the non-reactive `Live.waiting` until the hosts exist, so Vue state never holds document text (VU10).",
    "The startArgs.ts split (granted) moves code without changing behaviour except the new range branches. start.ts passes `--diff=<range> --repo <dir>` per #101's extension.",
    "Deviations accepted: `showFile(path)` (the shared FileList emits a path; `shown` stays a `RangeFileId`); the gear above the empty sentence; arrows disabled on sentences; ui/AGENTS.md's stale-note fixes (FileMark through App's #file slot, 'every root').",
    "Deviation not accepted: \"a failed openRange reported as 'the range'\" became the second block finding.",
    "Patch also carries .omp/run/mutants/RVShellR1.survivors.txt, .omp/run/notes/RVWindow.md and docs/slices/briefs/3.RV-review-ipc.md. These are orchestrator bookkeeping, not implementer source edits.",
    "open_risk RangeSideLabel (knip) is in ipc/, outside this patch: left to the orchestrator.",
    "Map/architecture lines are the orchestrator's docs pass, as the task states. Grading the mutation survivors and test strength belongs to the correctness lens.",
    "No contradiction with plan §2 #103/#105/#106 found apart from the words placement above."
  ]
}
```