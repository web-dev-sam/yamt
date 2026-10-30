# MrWindowStateBoundary

Agent output (`agent://MrWindowStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrWindowStateBoundary.md), collected 2026-10-30T14:23:37.931Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 30 touched files are in Owned globs. Map, architecture and state.md lines are proposed in deviations (DR5).",
    "§6 B4→B5 contract matches: MergeRequestSource, Listing, Opening, MergeRequests, createMergeRequests deps, register/use. Brands only in domain.ts; createdAt in ms; problem steps find|list|open|job.",
    "Edges: only ipc imports @tauri-apps (Channel, as tauriReview does). ui reaches core via ../mergeRequests index (TS8). PM7: compareStore→mergeRequestsStore chain reaches no store.ts or lsp/.",
    "Flag windowMergeRequests accepted: 2 users. It holds the create/register/report wiring once, like useThemeAttribute in settingsStore.ts. The slice writes the screen ref it is given, as servers.ts does.",
    "Flag stores ~300/300 accepted: each gains one field and one start-up call, no new job. Slice state lives in ui/mergeRequests.ts (282 lines), one writer per ref. cut is kept apart so the summary survives a failed ListEnd.",
    "TS17 tables are Record literals; never arms everywhere; fixture uses the same toMergeRequestPage/toOpenReply; RECHECK_PAUSE_MS and TIMED_OUT reused; FIXED_ATTEMPT_WORDS rename accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/screen.ts",
      "line": 9,
      "severity": "should",
      "rule_id": "promote",
      "problem": "settingsScreen now holds the gear/Back screen rule for compare and range, but ui/store.ts:226-231 keeps its own openSettings/closeSettings, so the rule exists twice. The merge window can drift from the others if Back's target changes.",
      "fix": "In the next slice that owns store.ts, replace its two closures with `...settingsScreen(state.screen)`. Also consider a name that says it returns actions (e.g. `settingsScreenActions`)."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequests.ts",
      "line": 69,
      "severity": "should",
      "problem": "pause() is a verbatim copy of fixtureReview.ts:43's private pause, and fixture.ts (owned) was free to hold one exported copy. Each new timed fixture script will add another copy.",
      "fix": "Export one `pause(ms)` from ipc/fixture.ts and import it here. Have fixtureReview.ts switch to it when its owner next touches it."
    },
    {
      "file": "frontend/src/ui/mergeRequests.test.ts",
      "line": 162,
      "severity": "should",
      "rule_id": "TS9",
      "problem": "The seam's tests (use-before-register at :162, windowMergeRequests at :507) live in the slice's test file. settingsStore.test.ts is the precedent for a seam's own test file, so a reader of mergeRequestsStore.ts finds no mergeRequestsStore.test.ts.",
      "fix": "Move both tests to ui/mergeRequestsStore.test.ts (add it to the next brief's Owned)."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 37,
      "severity": "should",
      "problem": "Several types now share one name. The slice's exported `Listing` (load state) clashes with ipc's merge-window `Listing` (exported from ipc/index.ts, used across ui/ beside ui/listing.ts). fixtureMergeRequests.ts:28/88 adds a third, private `Listing`/`listing`. B5 components and readers must tell three 'listings' apart by import path.",
      "fix": "Before B5 starts, have the orchestrator amend the §6 name (e.g. `ListLoad`). Rename the fixture's private pair to `Scripted`/`scripted` now, since that one is not contract."
    },
    {
      "file": "frontend/src/ipc/AGENTS.md",
      "line": 5,
      "severity": "should",
      "problem": "ipc/AGENTS.md has a paragraph for every source (Compare, Range, Review) but none for MergeRequestSource. The deviations propose tree.md and state.md lines but no AGENTS.md line, so the docs keeper may miss it. A reader then cannot find the ?mr scripts or the one-Channel-per-load rule.",
      "fix": "Add to deviations a proposed ipc/AGENTS.md paragraph: MergeRequestSource (extended by Compare/Range), the brands, mergeRequestDomain.ts, tauriMergeRequests.ts, ?mr=<script> and none without it."
    }
  ]
}
