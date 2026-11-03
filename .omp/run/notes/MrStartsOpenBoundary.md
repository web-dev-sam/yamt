# MrStartsOpenBoundary

Agent output (`agent://MrStartsOpenBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsOpenBoundary.md), collected 2026-11-03T19:51:45.999Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: changed files are all in Owned, plus rangeSearch/rangeThreads tests (granted). mergeRequests.ts, ui/AGENTS.md, src-tauri and docs are untouched.",
    "Contract kept: main.ts windowStart reads dataset.open (app) or ?open (fixture), once, for compare and range only; stores never read document or URL. StartScreen is derived from Screen kinds.",
    "One screen writer at start: openAtStart (startScreen.ts:14-22) only calls the slice's show(), the sole mergeRequests writer (state.md row 68). adoptList (compareStore.ts:177) never writes screen.",
    "Range deviation accepted. User picks and search opens still close the page via showPath (plan #128; rangeStore.test.ts:156-159, 308-313). Only start-up's auto-select no longer resets it.",
    "B1/B3 written once in openAtStart, shared by both stores. startScreen.ts imports only ipc, mergeRequests and screen: PM7/PM9/PM10 clean. WindowStart and appArgs' {ai, mr} accepted (TS7).",
    "app-session: start-app --mr refused with --repo/--fresh-repo; --open-mr refused without --mr; usage text in args.ts matches. No comment violates the comment policy."
  ],
  "findings": [
    {
      "file": ".omp/skills/project-map/tree.md",
      "line": 228,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "New `ui/startScreen.ts` (`WindowStart`, `startScreenOf`, `openAtStart`) is named in no project-map file, so `just map-check` fails once the file is tracked; the notes' 'map-check: ok' must have run while it was untracked. If left, map-check stays red and readers cannot find the start rule.",
      "fix": "Docs keeper (slice 4): add startScreen.ts next to screen.ts in tree.md, add start-app `--mr` / start-fixture `--open-mr` to the startArgs.ts entry, and name `openAtStart` → `show` in state.md's screen rows."
    },
    {
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 244,
      "severity": "should",
      "problem": "`show` and `showPath` now differ in whether they close the merge-request/Settings page (plan §2 #128), but the names don't say so. The implementer's own open risk notes that a future caller of `show` would silently leave the page open; this gets more likely as callers grow.",
      "fix": "Rename `show` to something that says it only marks a file shown and mounted (e.g. `markShown`), keeping `showPath` as the user's 'show a file' that resets the screen."
    },
    {
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 174,
      "severity": "nit",
      "problem": "`createRangeStore` destructures the start screen as `screen` next to `refs.screen`/`state.screen` (the Screen ref), while compareStore keeps `start.screen`. Two styles across sibling stores, and the start marker is easy to confuse with the live ref; nothing gets harder as the app grows.",
      "fix": "Take `start: WindowStart` as compareStore does and pass `start.theme` / `start.screen`."
    }
  ]
}
