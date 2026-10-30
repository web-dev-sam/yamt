# MrPageBoundary

Agent output (`agent://MrPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrPageBoundary.md), collected 2026-10-30T15:17:14.528Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 23 files are inside the Owned globs plus the granted windowFence.ts. The slice, core and ipc are untouched. `Listing` is never imported; the View reads `listing.value.kind`.",
    "PM10 (windowFence.ts:23,70): SHARED_PAGE_FILE matches the brief's globs and refuses the 6 roots and lsp/ (fences.test.ts:690). No false positives for the seam, roots importing the page, or ui/internal.",
    "windowFence.ts split accepted: PM7/PM9/AI-file rules moved verbatim, fences.ts calls windowFinding once, as agentFence/markdownFence do. fakeGlab.ts split accepted (start.ts size).",
    "The button sits before SettingsButton in CompareView, RangeView and RangeApp's empty header (the wrapper div is needed for the v-if root). Merge headers untouched; screen written only via slice show/close.",
    "startArgs: --dir only with --diff, --glab with --diff, --mr refuses the merge window. map-check adds MergeRequestSource; its 4 methods match the sed pattern `^  name(`.",
    "No new comments besides map-check's (CP4). Typed props/emits, useTemplateRef, useEventListener (VU4/5/12). Exhaustive keyOf and LOOKS Record (TS17). Escape follows ServerLogView's rule via `asking`."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 58,
      "severity": "block",
      "rule_id": "copied-decision",
      "problem": "goBack repeats SettingsView.vue:35-45's 8-line focus-return rule. The design names it as one rule, and open_risk #2 (WebKit not focusing a clicked button) already says it may change, which would mean editing two screens in step, and each new page would add a third copy.",
      "fix": "Move the rule to one shared function (e.g. `ui/focusReturn.ts` `returnFocus(before: Element | null)`) and call it from SettingsView and MergeRequestsView; the orchestrator grants the file and SettingsView.vue."
    },
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 43,
      "severity": "should",
      "problem": "The View classifies 'loaded'/'cut' as not-a-failure, the same decision as mergeRequests.ts:107 `listed`. Two places must agree on every new ListEnd kind; today they fail the same way.",
      "fix": "Next round, expose the classification once (e.g. `listFailureText(end): string | null` in mergeRequestsText.ts, or a slice computed) and use it in both places; the brief froze the slice, so do it then."
    },
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 50,
      "severity": "should",
      "problem": "statusText calls ciBox with no jobs just to reach its status sentence, and keeps an unreachable fallback to the raw status word. Every reader must work out that the branch is dead.",
      "fix": "Export `ciStatusText(status)` from mergeRequests/ (the STATUS_TEXTS lookup), have ciBox use it, and bind the box's aria-label to it (a core change for the next round)."
    },
    {
      "file": "frontend/src/ui/AGENTS.md",
      "line": 47,
      "severity": "should",
      "problem": "'Words come only from mergeRequestsText.ts and mergeRequests/' is false. The components hold 'Failed jobs', 'allowed to fail', NO_PAGE, 'Open the changes of', 'Clear filters', 'Retry', 'Dismiss', and countText (a third copy of searchText/serverText `counted`). The next implementer will trust the false rule.",
      "fix": "Correct the sentence to what is true now, or move those words and the plural helper into mergeRequestsText.ts in the next round and keep the sentence."
    },
    {
      "file": "frontend/scripts/app-session/stop.ts",
      "line": 36,
      "severity": "should",
      "problem": "The child sweep matches XDG_CONFIG_HOME, which comes from --home. Two sessions started with the same --home stop each other's yamt windows, though the brief says the session's children.",
      "fix": "Set a session-unique entry in appEnv (e.g. `YAMT_APP_SESSION=<state.folder>`), sweep on it, and build the key in one place for start.ts and stop.ts."
    },
    {
      "file": "frontend/src/ui/MergeRequestFilter.vue",
      "line": 42,
      "severity": "nit",
      "problem": "keyOf is a third encoding of a filter value's identity, next to core's sameValue and stored.ts's 'user:'/'label:' keys. The exhaustive switch keeps it safe; nothing gets harder.",
      "fix": "Use core's stored key once mergeRequests/ exports it."
    },
    {
      "file": "frontend/src/ui/RangeApp.vue",
      "line": 140,
      "severity": "nit",
      "problem": "The header's added `gap-1` has no effect because the header has one child (the wrapper div); nothing gets harder.",
      "fix": "Drop `gap-1` from the header class."
    }
  ]
}
