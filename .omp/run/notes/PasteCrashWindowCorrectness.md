# PasteCrashWindowCorrectness

```json
{
  "lens": "correctness",
  "patch": ".omp/run/patches/PasteCrashWindow.patch",
  "commit": "496a474",
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/linuxPaste.ts",
      "line": 65,
      "rule_id": "plan §2 #99 / request rule 3",
      "problem": "The paste is sent again on the original `event.target`, which can be removed from the page while the read is in flight even though the editor keeps focus. That target is the element at the caret: a highlight `<span>` or a `.cm-line` inside CodeMirror. CodeMirror 6.43 rebuilds a line's marks from a cache whenever that line's decorations change (`@codemirror/view` index.js:2433 reuses any equal mark's DOM, and `destroyDropped` at :3511 drops the rest). That happens when language-server problems arrive, a parse finishes, the compare window's differences arrive after a settle, or the user types during the read. Once the target is detached, `activeElement.contains(pasted)` is false at :58 and the paste is silently lost while the editor still has focus. Even if a detached target got past the focus check, `eventBelongsToEditor` (index.js:4896) would walk up to `null` and ignore the event. [INFERENCE: the timing was not observed; it follows from the code read]",
      "fix": "When the trusted paste arrives, record `const focus = document.activeElement` and deliver only if `document.activeElement === focus` and `focus` is not `<body>` (this also covers the boundary review's block). Dispatch on `pasted.isConnected ? pasted : focus`, where focus is the contentDOM or the input. Add a test where the target is detached before the answer while the focus stays: it should get the paste on the focused element."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/linuxPaste.test.ts",
      "line": 25,
      "rule_id": "review-protocol test strength",
      "problem": "`FakeClipboardEvent extends Event` throws away the `clipboardData` init, so the test at :180 ('pasted again … as text/plain') only checks `page.written`, the `setData` calls. If `deliver` built `new ClipboardEvent(\"paste\", { bubbles: true, cancelable: true })` without the data, the test would still pass. In the app, CodeMirror would then see `clipboardData === null` and run its `capturePaste` fallback (index.js:4914): it moves focus to a hidden textarea and pastes \"\". Only the real-app smoke would catch this.",
      "fix": "Have `FakeClipboardEvent` keep `init.clipboardData`, and expect `events[0].clipboardData` to be the same DataTransfer whose `setData` received `[\"text/plain\", \"one\\ntwo\\nthree\"]`, for example by having the fake DataTransfer answer `getData(\"text/plain\")`."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/fences.test.ts",
      "line": 341,
      "rule_id": "VF7",
      "problem": "Mutation survivors at fences.ts:129, :132 and :135 (`node !== undefined` → `true`) show that no case reaches `nameOf(undefined)`. That only happens for a destructured `read`/`readText` with no variable initializer, such as the parameter `function f({ readText }: Clipboard) {}`. Under those mutants the fence throws on that input. Survivor :185 shows the #99 reason text is not pinned either. If this stays, a later edit can make the fence crash on an ordinary destructured parameter, or drop its message, and no test notices.",
      "fix": "Add `{ path: \"src/ui/reader.ts\", text: \"function f({ readText }: Clipboard) {}\" }` to the 'violate nothing' test. Pin the reason in one #99 case, the way the PM2 lsp test at :248 pins its reasons."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/linuxPaste.test.ts",
      "line": 246,
      "rule_id": "VF7",
      "problem": "Survivors at linuxPaste.ts:28-29 (the rejection handler's body removed, `\"paste.read_failed\"` → \"\", `{ ...unexpected(error) }` → `{}`) show that 'a failed read pastes nothing' never checks the warning. The only trace of a failed `read_clipboard` invoke can be lost. Nothing else depends on it.",
      "fix": "Follow serverSetup.test.ts:453: `const warn = vi.spyOn(log, \"warn\").mockReturnValue();` and expect `warn` to have been called with `(\"paste.read_failed\", { kind: \"Unexpected\", message: \"command missing\" })`."
    }
  ],
  "checked": [
    "Every trusted paste is cancelled before WebKit reads: a capture listener on `window` with `preventDefault` + `stopImmediatePropagation` (linuxPaste.ts:12-19), installed in main.ts:51-53 before either root mounts. No other `paste` listener exists in frontend/src (grep), and nothing else is contenteditable outside CodeMirror. Covered by the cancel test (:146, a throwing `clipboardData` getter) and the capture-options test (:139). The context menu's Paste was observed in smoke 3, and Ctrl+V/Shift+Insert/Ctrl+Shift+V in smoke 2, including a clipboard nobody ever owned.",
    "Untrusted re-dispatches pass the window listener untouched (:15, test :154), and CodeMirror's `handlers.paste` (index.js:5167) has no `isTrusted` check. So `doPaste` runs with `userEvent: \"input.paste\"`: undo and the 8 MiB `transactionFilter` stay. Observed in smoke 1 (one Ctrl+Z removes the paste) and smoke 5 (the 8 MiB notice, `columns [1,1]`).",
    "Middle-release rule: the flag is set on `mouseup` with button 1 and cleared by `target.setTimeout`, a task rather than a microtask. Test :162 would fail if the clear moved to a microtask or were removed; test :173 kills the `!==` mutation for buttons 0 and 2. Smoke 4 confirmed PRIMARY in the same task, which settles the brief's [INFERENCE].",
    "Editor vs field delivery: the paste is dispatched on the original target, so CodeMirror's contentDOM handler sees it bubble from the line (:180). An unhandled input or textarea gets `insertText` (:193). A handled field, or an element that is not a field, gets nothing (:206). A read-only side pane: CodeMirror returns true, so the event counts as handled and no `insertText` runs. `null`/`\"\"` paste nothing (:222); removing either check would make the test dispatch and fail.",
    "Hung-owner race: a lost focus to another element is tested (:234). Focus moving to `<body>` is the boundary review's block and is not repeated here. The detached-target case is finding 1. Wayland and `kill -STOP` were not run; the brief's Acceptance does not list them, and the notes say so (accepted).",
    "Implementer deviations and open risks accepted: the `log.warn` on a failed read (rule 2, no notice); Ctrl+Z in the find field (Ctrl+Z on typed text does not undo there either, so this patch did not cause it); `.vue` templates not scanned (the boundary review accepted this). The `#99` id and the `ClipboardSelection` route are not repeated.",
    "Acceptance evidence is present: typecheck/lint/test exit 0 and 1942 tests; the planted `event.clipboardData` read in tauri.ts with the failing fence output pasted; real-app smoke 1–5 on private Xvfb :2 with owners ended by `kill $pid`.",
    "`isLinux` (keys.ts:101): keys.test.ts:59 kills `startsWith`→`includes` (\"FreeBSD amd64 Linux\") and the empty-string case. `showsAntialiasing` delegates to it, so there is one Linux rule.",
    "Survivors dropped per VF7. fences.ts:143 (a): with `name` undefined, `Object.hasOwn(CLIPBOARD_READS, undefined)` looks up the key \"undefined\", which is absent, so the result is the same. fences.ts:163 (a): `ensureScriptKind` (typescript.js:22507) falls back to TS for \"\" exactly as for \"script.ts\". tauri.ts:146 (c): a pass-through to the generated command, exercised in every smoke paste. linuxPaste.ts:21 (a): a trusted paste's target is always an Element (the selection's element or body) [INFERENCE: WebKit `findEventTargetFrom`]; without the guard, `contains` would throw and nothing is pasted either way. linuxPaste.ts:58 `?? true` and `?.`→`.` (a): `document.activeElement` is never null in a document with a body, and finding 1 rewrites the line.",
    "Survivors kept: fences.ts:129, :132, :135 and :185 (finding 3); linuxPaste.ts:28-29 (finding 4).",
    "Files are unchanged since 496a474 (`git diff --stat 496a474 HEAD -- frontend/` empty). I am read-only and ran no gate or test."
  ]
}
```