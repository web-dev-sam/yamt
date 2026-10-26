```json
{
  "verdict": "fail",
  "lens": "boundary-reviewer",
  "patch": "062e049 RVThreadBoxes",
  "findings": [
    {
      "severity": "block",
      "rule_id": "vision-2 / state-ownership",
      "file": "frontend/src/ui/RangePostEditor.vue",
      "line": 15,
      "problem": "The text being edited in the Post editor (`edited`), and whether a message has its editor open (`RangeMessage.vue:18` `editing`), are kept inside the components and not in the store. Collapsing the thread from the header or from the line mark unmounts the teleported box, and so does the view being dropped after 16 files. Either way the half-edited Post text disappears without warning, while reply and draft text in the same box come back (`rangeDrafts.ts`, which keeps drafts \"across the 16-view eviction\"). That is two owners for \"text not yet added\", and it breaks the Acceptance line \"state only in the store\".",
      "fix": "Give `rangeDrafts.ts` a `post` draft kind keyed by `MessageId` (exposed as `postDraft`/`writePost`/`dropPost` through `rangeThreads`). `RangeMessage` opens the editor while that draft exists, and `RangePostEditor` reads and writes the text through the store as `RangeThreadBox` does. This means a fix round with `rangeDrafts.ts`/`rangeThreads.ts` in Owned, plus a state-table row."
    },
    {
      "severity": "block",
      "rule_id": "words-only-in-rangeThreadText",
      "file": "frontend/src/ui/RangeThreadBox.vue",
      "line": 14,
      "problem": "Words are written in five components: \"Comment\", \"Cancel\" (twice, here and at `RangePostEditor.vue:11`), \"Collapse the thread\", \"Write a comment…\"/\"Reply…\" (mixed with row counts in `PROMPTS`), \"Queue\" and \"Text to post\" (`RangePostEditor.vue:10-12`), \"Copy\" (a second copy of `serverText.ts` `COPY`) with its title (`RangeMessage.vue:13-14`), the singular/plural rule \"1 thread\"/\"n threads\" (`RangeFileRow.vue:23`), and the notice's close label plus the `NoticeRow` it builds (`RangeApp.vue:20,54`). The Acceptance asks for every word in `rangeThreadText.ts`, and AGENTS.md says every range word is in one text module. The plural rule and the notice row are logic in a leaf and in the root (VU16).",
      "fix": "Move every word into `rangeThreadText.ts`: constants, `threadCountText(n)`, and `sendNoticeRow(result): NoticeRow` (as `noticeText.ts` `noticeRow` serves App.vue). Keep `rows` as a number next to its placeholder in the component, and have the components import the words. The brief made `rangeThreadText.ts` read-only, so the fix round must add it to Owned."
    },
    {
      "severity": "block",
      "rule_id": "PM-keys (#57: ipc/keys.ts is the one source of what keys mean)",
      "file": "frontend/src/ui/rangeKeys.ts",
      "line": 53,
      "problem": "`boxKey` works out the platform's `Mod` again (`isMac(platform) ? metaKey && !ctrlKey : ctrlKey && !metaKey`) and its own modifier rules for Escape. That copies `keyOfEvent`/`pressesKey`, which the file-list key and `historyKey` already share, so a later change to what Mod or MacCtrl means in `keys.ts` would leave the box keys behind.",
      "fix": "Express submit and cancel as `Key` values (`Mod-Enter`, `Escape`) built through `ipc/keys.ts`, for example by exporting its `defaultKeys` as a key-list helper, and test them with `pressesKey(event, keys, platform)`. Only the `isComposing` check stays in `rangeKeys.ts`, and the existing tests keep passing unchanged."
    },
    {
      "severity": "block",
      "rule_id": "DR1 / forked rule (#61)",
      "file": "frontend/src/ui/RangeApp.vue",
      "line": 44,
      "problem": "Only the range root wraps `fileListKey` in `typesIntoField`; `App.vue:48` and `CompareApp.vue:41` call it directly. With the default `Mod-b` the guard does nothing, because it lets every Ctrl/Cmd press through. Its only effect is that a user who binds \"Toggle file list\" to a key without Ctrl/Cmd (say F9 or Alt+B) cannot use it from a box, while the same key works from the merge window's find field (#61). The design's guard was meant for a `RangeView` `shownKeydown` that does not exist (deviation 3), so this is an unrequested second rule for one shared key. AGENTS.md:7 also claims the guard is what keeps Ctrl/Cmd+B working, which is not true.",
      "fix": "Drop `typesIntoField` and its test, call `fileListKey(event, navigator.platform)` as the other two roots do, and correct the AGENTS.md sentence. Report `isTypingTarget`'s missing caller (the `shownKeydown` premise) to the orchestrator; a typing guard for every root would belong in `fileListKey.ts` behind a plan row."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 1,
      "problem": "Seven new files (`RangeThreadLayer`, `RangeThreadBox`, `RangeMessage`, `RangePostEditor`, `RangeSendButton`, `rangeKeys.ts`, plus `rangeKeys.test.ts` as a test) are missing from the project map's ui row and from `docs/architecture.md`, so `just map-check` stays red. A reader cannot find which file owns which box job. The files are outside Owned (implementer's deviation).",
      "fix": "The orchestrator adds the five components and `rangeKeys.ts` (with its exported functions) to the ui row and to architecture, and gives the state table a row for the Post-editor draft once the first finding is fixed."
    },
    {
      "severity": "should",
      "rule_id": "vision-2",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 47,
      "problem": "What the Post button does is decided here: unqueue when `isQueued`, edit when the body is a note. What it says and whether it is enabled is decided by `rangeGitLab.ts` `postButton`. When C enables Post for an `aiAnswer` (queueing `TurnView.answer`), both places have to change in step.",
      "fix": "Have `postButton` return the press action alongside the view (`action: \"edit\" | \"unqueue\" | null`), and have `pressPost` switch on it exhaustively."
    },
    {
      "severity": "should",
      "rule_id": "naming",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 20,
      "problem": "Here `noteText` means the message's own body text. In the store, `threads.noteText(thread)`, used by `RangeThreadBox.vue:39`, means the unsent reply draft. One name with two meanings one component apart makes it harder to read either one.",
      "fix": "Rename the computed to `bodyText`."
    },
    {
      "severity": "should",
      "rule_id": "copied decision",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 59,
      "problem": "\"Copy text; if the clipboard write fails, select the element showing it\" now exists twice, here and in `ServerMenu.vue:126-135`. The two already differ: ServerMenu shows \"Copied\", this one shows nothing. A third Copy would pick between them.",
      "fix": "Extract one `copyOrSelect(text, element)` in `ui/` used by both, and decide once whether the \"Copied\" feedback applies to both."
    },
    {
      "severity": "nit",
      "rule_id": "existing pattern",
      "file": "frontend/src/ui/RangeSendButton.vue",
      "line": 15,
      "problem": "The hover sentence is set on both the wrapper `span` and the `button` (also `RangeMessage.vue:81-86`). The existing disabled-button pattern (`OperationButtons.vue:21-26`) puts the title on the wrapper only and adds `disabled:pointer-events-none` to the button. Two patterns for the same thing; nothing harder to grow.",
      "fix": "Follow `OperationButtons`: keep the title on the wrapper only and add `disabled:pointer-events-none` to the button."
    }
  ],
  "checked": [
    "Fences: the new ui files import only `../ipc` (types, `isMac`) and `./range*`, `./NoticeBar.vue`, `./noticeText`; no `editor/` import (useRangeController is still the only seam); no `@codemirror`/`@tauri-apps`; no `store.ts`/`App.vue`/`compare*`/`lsp/` import in range-prefixed files (PM2, PM5, PM9)",
    "Every new range file carries the Range/range prefix (PM9 naming rule in ui/AGENTS.md)",
    "Each component has one job: RangeThreadLayer only teleports per `threadHosts` key; RangeThreadBox is one box (draft or open thread); RangeMessage is one message; RangePostEditor is the Queue/Cancel editor; RangeSendButton only renders `gitlab.sendButton` and calls `send`",
    "Store writes from components go only through rangeStore actions (writeDraft, dropDraft, writeNote, addThread, addNote, toggle, queue, unqueue, send, dismissResult); no component assigns a store ref directly",
    "RangeFileRow count is derived from `threads.counts` (never stored), as the design requires; the `threads: number` prop matches the contract",
    "RangeSendButton is in the RangeView header left of the gear; disabled sentence, 'Checking GitLab…' and 'Nothing queued' all come from `rangeGitLab.ts` sendButton (contract)",
    "`isTypingTarget(target: EventTarget | null): boolean` exists and is pure (contract; its caller is finding 4)",
    "The `aiAnswer` switch in RangeMessage rather than RangeThreadBox: accepted (it is per message; `postButton` already disables Post with AI_ANSWER_TEXT)",
    "NoticeBar for `gitlab.result`: accepted as an addition (row 20 already built `result`, `dismissResult`, `sendResultText`); only its words and row building are finding 2",
    "app-session flags: the `--glab` spec and usage are in args.ts SPECS/USAGE, parsing and validation in startArgs.ts `glabScenario`, fs/env in start.ts `fakeGlab`/`glabEnv`; the same split as the existing options. `--threads`/`--gitlab` on start-fixture are accepted (`--range-case` encodes `&`); tests in args.test.ts instead of a new startArgs.test.ts are accepted (parseCommand covers startCommand)",
    "The env names set by start.ts match scripts/fake-glab/glab and tests/glab/README.md (YAMT_FAKE_GLAB, _STATE, _LOG)",
    "VU2/VU3/VU4/VU5: sections in order, `function` declarations, `useTemplateRef` for the textareas and the link span, type-based `defineProps`/`defineEmits` in every new SFC",
    "No comments added in the new or changed code (comment-policy)",
    "No contract drift: `useRangeController`'s return value, rangeStore, rangeThreads and rangeGitLab signatures are unchanged by this patch",
    "Plan #120 ('text typed but not added is not kept', closing does not ask) is about closing the window; finding 1 is about collapse and eviction within a run, which drafts already survive",
    "Mutation survivor startArgs.ts:100 (regex anchor) left to the correctness reviewer; start.ts NoCoverage accepted under VF7, the real-app steps ran through it"
  ]
}
```