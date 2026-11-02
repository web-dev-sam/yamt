# MrRowDetailsStateBoundary

Agent output (`agent://MrRowDetailsStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsStateBoundary.md), collected 2026-11-02T21:03:46.668Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 22 touched files are in Owned; the problemText.test.ts edit is allowed (it names the steps). No .vue, bindings.ts or mergeRequests/** edits.",
    "Edges: the new ui/mergeRequestDueDates.ts and ui/mergeRequestRerequests.ts import only ipc, mergeRequests, vue/@vueuse, windowStorage, mergeRequestActions, problem. No window root or lsp import (PM10), no cycle.",
    "State: `replaced` is the one new rows writer and lives in the rows owner (mergeRequests.ts). Due dates: owner createDueDates, keepOnly only in `ended` on `loaded`. Asks: written only by createRerequests.",
    "Contract: Person/Reviewer/Label/RerequestReply, toMergeRequestPage/toRerequestReply(raw, uploadedPicture), PICTURE_SCHEME via convertFileSrc, click, dueDates/setDueDate and rerequests match the brief; `toggle` is gone.",
    "Accepted deviations: the named Rerequests type (RerequestAsk re-exported), filterActions/choicesOf in mergeRequestFilters.ts (one filters concept), the datedFirst widening (sound for Map.get), dmitri checked first.",
    "Reuse: setRow, storedRecord, and an ask map shaped like Opening/RowActing. PM6 map-check for rerequestReview waits on the docs keeper's architecture and ipc-contract lines."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestFilters.ts",
      "line": 66,
      "severity": "should",
      "problem": "The docs-keeper lines miss four updates. state.md row 68 and architecture 1122 still name the slice's `toggle` as the filters' writer. tree.md 258 does not mention filterActions/choicesOf. state.md row 66 does not mention State's `running`. Readers tracing writers land on names that no longer exist.",
      "fix": "Add to the docs-keeper lines: `toggle`→`click` in state.md row 68 and architecture 1122; mergeRequestFilters.ts also holds `filterActions`, `choicesOf`, `Choices`; `running` (only `load` writes it) is the buffer `replaced` writes."
    },
    {
      "file": "frontend/src/ipc/tauriMergeRequests.ts",
      "line": 17,
      "severity": "should",
      "problem": "PICTURE_SCHEME copies Rust's `PICTURE_SCHEME` (src-tauri/src/merge_requests/pictures.rs), but nothing in the TS points to it. Each side's test pins only its own literal. If Rust renames the scheme, the window keeps asking the old one, and every uploaded picture silently falls back to initials.",
      "fix": "Add a one-line CP1 reference above the constant to Rust's `PICTURE_SCHEME` in src-tauri/src/merge_requests/pictures.rs; the brief's contract shows exactly that line.",
      "rule_id": "CP1"
    },
    {
      "file": "frontend/src/ipc/index.ts",
      "line": 75,
      "severity": "nit",
      "problem": "`Label` comes after `LocalMerge` in an otherwise alphabetical export list; nothing gets harder.",
      "fix": "Move `Label` above `ListEnd`."
    }
  ]
}
