```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "acceptance: words only in their text modules",
      "file": "frontend/src/ui/AiTurn.vue",
      "line": 13,
      "problem": "Some AI words are written outside `aiText.ts`: `RUNNING_TEXT` \"working…\" (AiTurn.vue:13), `LOADING_TEXT` \"Making the diff…\" (EditDiff.vue:22), the \"⋯ \" prefix built in `rowText` (EditDiff.vue:108), and `YOLO_NOTE` plus the \"… is not a placeholder; it is sent as typed.\" sentence inside the rules module `agentSettingsFields.ts` (lines 12-13 and 52). AI words therefore have three homes, and `ui/AGENTS.md:9`'s claim that \"Every AI word is in `aiText.ts`\" is false.",
      "fix": "Move these words into `aiText.ts`: `RUNNING_TEXT`, a `LOADING_DIFF_TEXT`, the ⋯ folded into `skippedLinesText`, `YOLO_NOTE` and an `unknownPlaceholderText(name)`. `agentSettingsFields.ts` keeps only the Use/Default rules and the unknown names. Move the matching assertions into `aiText.test.ts`."
    },
    {
      "severity": "block",
      "rule_id": "principles §1 (parse at the boundary); growth: decision copied",
      "file": "frontend/src/ui/question.ts",
      "line": 160,
      "problem": "`question.ts` reads the wire format itself: `STASH = \"stash\"` assumes Rust's `branches_and_stash` (`crates/gitio/src/checkout.rs:85-91`) sends git's `%(refname:short)` names. The ipc layer already disagrees: `agentDomain.test.ts:41` and `tauriAgent.test.ts:119` use `refs/stash` and `refs/heads/ai`. If Rust ever sends full names, the stash is worded \"the branch refs/stash\". A branch the AI named `stash` (with no stash) is already worded \"a stash\".",
      "fix": "Decide what a ref is once, at the ipc boundary. Either `toCheckoutChanges` turns `refs` into `{ branches, stash: boolean }`, or `ipc/agentDomain.ts` exports the one `isStash(ref)`, and `question.ts` uses that. Align the ipc tests with Rust's short names. Name the C5 owner for that file."
    },
    {
      "severity": "should",
      "rule_id": "PM9",
      "file": "frontend/scripts/fences.ts",
      "line": 168,
      "problem": "The four AI views are range-only, but `rootFinding` only checks file names matched by `WINDOW_FILE`. Nothing stops `AiTurn`/`AiStep`/`EditDiff`/`AgentSettings` from importing `store.ts`, `App.vue`, `compareStore.ts` or `lsp/`, and `fences.test.ts` even asserts that `App.vue` importing `./aiClose` is fine. A later AI-view edit can pull a merge-window root into the range window without the fence noticing.",
      "fix": "Have `rootFinding` treat a file listed in `AI_VIEWS` as the `range` root. Add a failing-path test (an AI view importing `./store`) and drop the `App.vue` → `./aiClose` allowance from the passing test."
    },
    {
      "severity": "should",
      "rule_id": "VU15, principles §2",
      "file": "frontend/src/ui/EditDiff.vue",
      "line": 87,
      "problem": "`sign`, `oldNumber`, `newNumber` and `rowText` are pure row formatting kept in the component and untested. `SIGNS` covers only part of the kinds, and the `||` chains replace an exhaustive switch, so a new `DiffRow` kind compiles and renders blank cells. As written, the component's jobs are loading, formatting and layout.",
      "fix": "Export one exhaustive `diffRowCells(row): { old, new, sign, text }` from `editDiffLines.ts`, using `aiText` for the words, add a node test for it, and have the template read its cells."
    },
    {
      "severity": "should",
      "rule_id": "principles §2 (layers that do not use the data)",
      "file": "frontend/src/ui/AiStep.vue",
      "line": 6,
      "problem": "`AiStep` takes the whole `AgentClient` (ask, stop, …) only to pass it to `EditDiff`, which calls `editDiff` and nothing else. Every nested view can therefore start or stop turns, and a reader has to trace the client through two layers.",
      "fix": "Type `AiStep`'s and `EditDiff`'s prop as `Pick<AgentClient, \"editDiff\">`. `AiTurn` keeps the contract's `client` prop."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/question.ts",
      "line": 198,
      "problem": "The note \"Discard Changes removes the checkout.\" types the button label again instead of using `DISCARD`. Renaming the button leaves the note naming a button that no longer exists.",
      "fix": "Build the note as `${DISCARD} removes the checkout.`"
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "frontend/src/ui/AgentSettings.vue",
      "line": 66,
      "problem": "\"The command is split on spaces.\" repeats `LanguageServerSettings.vue:165` word for word, describing the one `commandWords` rule (#113). If the rule changes, one of the two copies goes stale.",
      "fix": "Keep one constant in a text module and import it in both settings sections."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "frontend/src/ui/AgentSettings.vue",
      "line": 36,
      "problem": "A local function named `store` sits next to `useSettingsStore()` in a layer where \"store\" always means the app or settings store, so `store(command.use)` reads like a store reference.",
      "fix": "Rename it `save` (or `useSetting`)."
    }
  ],
  "checked": [
    "Ownership: every touched file is in the brief's Owned list except `problem.ts`/`problemText.ts` (+ tests), which Main granted mid-build; the notes record this under deviations.",
    "Fence PM9 (one direction): `aiViewFinding` rejects the merge root, compare root, `SettingsView` and `store.ts` importing an AI view, and allows range files and the AI views among themselves (fences.test.ts new cases, both directions).",
    "ui reaches agent/ and ipc/ only through their indexes: AiTurn, AiStep, EditDiff and agentSettingsFields import \"../agent\"; aiClose and editDiffLines import \"../ipc\"; no agent/internal import (PM5).",
    "The `app` failure is worded through `problemText`'s new `ai` action (aiText.ts:52); diff failures go through the same table (`diffFailureText`); no second reason table.",
    "question.ts kinds match the contract (`keepAiChanges {folder, files, headMoved, refs}`, `keepUnreadableCheckout {folder, message}`); confirm is \"Keep Changes\", cancel \"Discard Changes\", title \"Keep the AI's changes?\", and \"It also made commits there.\" matches plan #111; `endsWithStop` is false for both.",
    "QuestionDialog shows no empty list for a `keepAiChanges` with only refs or a moved HEAD (`files.length > 0` guard, QuestionDialog.vue:33).",
    "Accepted deviation: `aiMayClose`'s `Pick<…>` target still accepts the contract's full `AgentSource`/`Asking`, so the contract only widens.",
    "Accepted decision: a failed look closes, consistent with #111 (the shell removes only a clean checkout at exit, so nothing is lost).",
    "Accepted decision: Retry only on failures, matching the design §3 failures table (each failure offers Retry; stopping is the user's own act).",
    "No store state in the components: AgentSettings reads `settings` and writes only through `setAgent` (`settingsStore.ts:21`); its drafts, plus AiTurn's `opened` and EditDiff's `opened`/`shown`, are view-local.",
    "VU2 order, VU4 (`useTemplateRef` for the answer host), VU5 typed `defineProps`/`defineEmits`, VU3 function declarations: AiTurn, AiStep, EditDiff, AgentSettings.",
    "`navigator.platform` is passed into word functions the same way ProblemBar and QuestionDialog do.",
    "Palette (VU17): only theme tokens; `bg-chunk-deleted`/`bg-chunk-inserted` are the panes' own change colours (style.css:117-119), so the open risk about grey removed lines is accepted.",
    "Plan #113: a default value is stored as null (`commandField`/`firstMessageField`), the five placeholders come from the `PLACEHOLDERS` source, and unknown ones are named. Plan #114: 3 context lines, one `MAX_DIFF_ROWS` constant, the \"too large\" words.",
    "Markdown reaches AiTurn only through `ui/useMarkdown.ts`.",
    "Extractions `stoppedFields` (problem.ts) and `exitText` (question.ts) keep the same output.",
    "Comments: aiClose's doc states the reason (shell removes only a clean checkout); the editDiffLines type docs state line-number and run semantics; none narrate or carry TODOs (comment policy).",
    "Accepted: no `plan §2 #111` references in sources (the palette check reads `#111` as a colour); the map line is left to the orchestrator, who owns project-map (PM6/DR5).",
    "No decision-record contradiction with #111–#115 or #122 apart from the refs finding above."
  ]
}
```