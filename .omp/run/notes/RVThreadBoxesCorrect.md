**Verdict: pass.** No `block` from the correctness lens. There are 3 `should` findings: two test gaps in the dev script and one keyboard-focus gap. The boundary review's four blocks still stand, so this patch still has a fix round ahead.

```json
{
  "verdict": "pass",
  "lens": "correctness-reviewer",
  "patch": "062e049 RVThreadBoxes",
  "findings": [
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/scripts/app-session/startArgs.ts",
      "line": 100,
      "problem": "Mutation survivor `/^[a-z0-9-]+$/` → `/^[a-z0-9-]+/` is a real gap. The test claims `--glab` refuses paths, but each refused case (`../moved`, `/tmp/moved`, `Moved`) already fails on its first character. So `--glab lined-up/../../x` would pass the check, and `start.ts` would link a folder outside `tests/glab/`. Nothing else depends on this rule, so nothing gets harder as the app grows; only the check's own promise is unproven.",
      "fix": "Add `expect(() => parseCommand([...range, \"--glab\", \"lined-up/../moved\"])).toThrow(folderName)` to the `--glab` test in `args.test.ts`. That case starts with a valid prefix, so it kills the anchor mutant."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/scripts/app-session/start.ts",
      "line": 92,
      "problem": "Lines 83–106 of `start.ts` had 30 mutants with no coverage. Most of them are path and environment setup that real-app steps 1–6 exercised: the fake ran first on PATH and its log and state files were written. One guard was never exercised: the `existsSync` check that refuses a scenario with no folder. Without it, a typo such as `--glab lined_up` starts the app against a dangling link, and every glab call then fails in the app instead of at start. Only this dev script is affected; nothing gets harder as the app grows.",
      "fix": "Move the existence check into `startArgs.ts` `glabScenario`, which can take the folder lookup as a parameter, and test an unknown scenario name in `args.test.ts`. Alternatively, record a real-app `start-app --glab nosuch` run that shows the error."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/RangePostEditor.vue",
      "line": 37,
      "problem": "Keyboard focus is lost after queueing. After Ctrl/Cmd+Enter (or Queue) in the Post editor, the message becomes queued, `RangeMessage`'s `watch(queued)` closes the editor, and the focused textarea is removed, so focus falls to `<body>`. The same happens after clicking Comment on a reply: the text clears and the `v-if=\"draft !== null || !blank\"` row disappears. A draft's Ctrl+Enter, by contrast, keeps focus in the reply field through the `draft.focus` watch. A keyboard-only review loses its place after every Queue. No rule fixes focus here, so nothing gets harder as the app grows.",
      "fix": "When `RangeMessage` closes the editor after a queue, focus its Post/Unqueue button in `nextTick` (it is inside the host, so `ThreadHosts` keeps tracking it). Give the reply's Comment a `@mousedown.prevent`, as `RangeSendButton` has, so focus stays in the reply field."
    }
  ],
  "survivors": [
    {
      "mutant": "startArgs.ts:100 Regex /^[a-z0-9-]+$/ → /^[a-z0-9-]+/ (Survived)",
      "verdict": "real gap → finding 1 (should)"
    },
    {
      "mutant": "start.ts:83-106 (30 NoCoverage, fakeGlab/glabEnv)",
      "verdict": "(c) for the link, PATH order and `YAMT_FAKE_GLAB*` names: observed in real-app steps 1–6 (the fake's log has the POST argv/stdin; `ln -sfn` scenario switch worked in step 6). The `existsSync` guard is a real gap → finding 2 (should)"
    }
  ],
  "checked": [
    "Typing never reaches the columns (CodeMirror 6.43 `node_modules/@codemirror/view/dist/index.js`): `eventBelongsToEditor` (:4896-4906) walks up from the textarea through the host to the widget cell, and `WidgetType.ignoreEvent` returns true (:161), so CodeMirror's keymaps, find, copy and paste skip every bubbling event from a box. `onSelectionChange` (:7275-7279) ignores a selection inside a widget, so selecting the pending link is not reset. `readMutation` (:7505-7507) ignores Vue's DOM changes inside a cell, so mounting and re-rendering a box never redraws the code. WebKit step 3 agrees (arrows, Ctrl+A and Ctrl+C stay in the TEXTAREA; Ctrl+F opens no panel).",
    "Teleport into hosts that come and go: `RangeThreadLayer` renders one keyed `<Teleport>` per `threadHosts` entry, so a key without a host gets no box. A dropped key: `ThreadHosts.#drop` removes the host and clears `#focused`, then Vue unmounts the Teleport from the detached host, and focus falls to body (step 3: Escape on an empty draft gives `BODY | boxes=0`). A key dropped and re-created within one tick gets a new `to`; Vue moves the same box instance, so its state is kept. On a view's eviction, `onScopeDispose` destroys the hosts and the box unmounts without errors.",
    "A box survives a draft becoming a thread: `addThread` maps the new thread to the draft's key (`rangeThreads.ts` `state.keys.set(thread, key)`), so the same `RangeThreadBox` instance and host stay. The `draft.focus` watch (0 → undefined) focuses the reply field, and `:value` becomes the empty reply.",
    "Typed text across CodeMirror redraws: draft and reply text come from the store (`writeDraft`/`writeNote` on `@input`), and Vue patches `value` only when it differs from `el.value`, so the caret is never reset while typing (IME `input` included). Post-editor text is DOM-only, but the host moves with the cell, so a redraw keeps it. Loss on collapse or eviction is the boundary review's finding 1, not repeated here.",
    "Draft focus timing: the gutter `mousedown` returns true (`threadNumbers.ts:126`), so CodeMirror calls `preventDefault` and the default action never takes focus back from the box's `onMounted`/`focus` watch (step 1 shows focus = TEXTAREA after the press).",
    "Keys: `boxKey` submits only on Enter with Ctrl alone (Linux) or Cmd alone (macOS), with no Shift or Alt and not while composing. It cancels on Escape with no modifier. Both paths call `preventDefault` and `stopPropagation` before the action. `rangeKeys.test.ts` pins every branch (Stryker 100 %, 73 killed). It would fail with the feature deleted or with the platform swapped.",
    "Ctrl/Cmd+B from a box: Ctrl/Cmd+B is not a box key, so it reaches the window, and `typesIntoField` lets it through (step 13: list toggled from a box textarea and from the find input). The guard's scope is the boundary review's finding 4.",
    "Post/Queue/Unqueue: `pressPost` unqueues when `isQueued` (queued or refused) and opens `RangePostEditor` only for a `note`. `watch(queued)` closes the editor once the reply lands, and a failed queue keeps the editor open for a retry. `postButton` (row 20) disables pending and `aiAnswer` messages and keeps Unqueue enabled while not lined up (step 10: `moved`, `disabled=false`). Steps 7, 9 and 12 match.",
    "Pending link: shown as `select-text` with Copy. The clipboard fallback selects the link span inside the widget, which CodeMirror does not override (:7276). A synchronous throw when `navigator.clipboard` is missing would escape `.catch`. [INFERENCE] the Tauri origin and localhost are secure contexts, so it is defined; the boundary review's shared `copyOrSelect` would close this.",
    "Send: `RangeSendButton` renders `gitlab.sendButton`:",
    "- 'Checking GitLab…' before the first answer (step 11);",
    "- each not-lined-up sentence (step 10);",
    "- 'Nothing queued' at n = 0 (step 7);",
    "- 'Sending x of y…' and disabled while sending (step 8).",
    "`@mousedown.prevent` keeps a box's focus while Send is clicked.",
    "Send result: `gitlab.result` is shown through `NoticeBar` and cleared at the next Send's start. `@close` passes the row key, which `dismissResult` ignores.",
    "File-row count: `counts.get(file.id) ?? 0` comes from the stored threads only (drafts are not counted). `counts` is a top-level ref in `RangeApp`'s script setup, so the template unwraps it and stays reactive (step 2: row reads 1 after Ctrl+Enter). The `ml-auto` moves to the count only when there are threads.",
    "Paste through `takeLinuxPastes`, by reading, not observed: `main.ts:77-79` installs it for every root in the app on Linux. The re-dispatched paste bubbles from the box textarea, CodeMirror ignores it (widget), it is not `defaultPrevented`, so `insertText` goes into the focused textarea and its `input` reaches `writeDraft`. [INFERENCE] no WebKit or real-app paste was observed; paste is not among the brief's 13 + 6 steps.",
    "app-session flags:",
    "- `--glab` is refused without `--range` (`--repo`/`--diff` tested), refused without a value, and refuses `/`, `..` and upper case at the first character.",
    "- `glabEnv` is spread after `displayEnv`'s copy of `process.env`, so the fake's folder really comes first on PATH.",
    "- `--threads`/`--gitlab` are added to the URL with `URLSearchParams` and refused without `--range-case` (tested, including `a b` → `a+b`).",
    "Files unchanged since 062e049 (`git diff --stat 062e049 HEAD -- frontend/src/ui/ frontend/scripts/app-session` is empty), so the review covers the current tree. No test was run."
  ]
}
```