# PasteCrashWindowBoundary

```json
{
  "lens": "boundary",
  "patch": ".omp/run/patches/PasteCrashWindow.patch",
  "commit": "496a474",
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/linuxPaste.ts",
      "line": 58,
      "rule_id": "plan §2 #99 / brief Contract behaviour 3",
      "problem": "When focus moves to nothing, `document.activeElement` is `<body>`, and `body.contains(pasted)` is true for every target. A slow answer can then still be pasted. Example: a hung owner answers later, or the user clicks somewhere that takes no focus or moves to another file. The text is then dispatched on the old editor's contentDOM, and CodeMirror's `handlers.paste` (`@codemirror/view` index.js:5167) inserts it at that view's selection without checking focus. The brief's \"only if the target is still the focused element\" rule does not hold here. The tests miss it because `beforeEach` sets `activeElement` to `body`, and the lost-focus test only moves focus to another element.",
      "fix": "Do not count `<body>` or `null` as focus: `const focus = document.activeElement; const focused = focus !== null && focus !== document.body && focus.contains(pasted);`. Add a test where focus becomes `body` before the answer, and expect no event to be dispatched."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/fences.ts",
      "line": 10,
      "rule_id": "PM7 precedent / guardrail-evolution registry",
      "problem": "My ruling on the rule id: \"#99\" is not accepted. It adds a second id scheme to `FenceViolation.rule`, where every other id is a project-map PM rule. PM7 shows the pattern: plan §2 #94 was enforced as PM7, with a project-map line and an architecture table row that names `fences.ts PM7` as the detector. Under \"#99\", this fence never appears in the PM list or in architecture's rule/detector table. A reader who looks for the window's boundaries there will not find it, and the next fence may copy the plan-row scheme. Nothing behaves differently today, so this is a `should`.",
      "fix": "When updating the project map and architecture, the orchestrator adds a PM8 line ('only ui/linuxPaste.ts reads the clipboard: `clipboardData`, `navigator.clipboard.read`/`readText`; plan §2 #99. Detector: `frontend/scripts/fences.ts` + `fences.test.ts`') and a matching row in the architecture rule table. The patch renames `\"#99\"` to `\"PM8\"` in fences.ts:10 and :182, in fences.test.ts, and in ui/AGENTS.md ('rule #99')."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/tauri.ts",
      "line": 144,
      "rule_id": "TS6 / reuse existing pattern",
      "problem": "`ClipboardSelection` reaches `ipc/index.ts` through `export type { ClipboardSelection }` in tauri.ts. Every other generated union the window uses is aliased in `domain.ts` (`export type Theme = Generated.Theme`, `Antialiasing`) or in `compareDomain.ts` (`Column`, `TabLanguage`), and index.ts exports it from there. This is a second way for a generated type to enter the window's surface, so the next one has two patterns to copy.",
      "fix": "Add `export type ClipboardSelection = Generated.ClipboardSelection;` in `domain.ts`, export it from `./domain` in index.ts, and drop the re-export from tauri.ts. tauri.ts keeps its import from `./bindings` for `readClipboard`'s signature."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/AGENTS.md",
      "line": 3,
      "rule_id": "vision 3",
      "problem": "The doc says 'only `ui/linuxPaste.ts` calls it', and plan §2 #99 says 'Nothing else in the window reads the clipboard (fence)'. But `readClipboard` is exported from `ipc/index.ts`, which editor/ and ui/ both import, and the fence only checks `clipboardData` and `navigator.clipboard` reads. A second reader through `readClipboard` would pass every gate. The rule is written down but not enforced.",
      "fix": "Extend the clipboard fence to report any `readClipboard` identifier outside `src/main.ts`, `src/ipc/index.ts` and `src/ipc/tauri.ts`, with one failing-path case in fences.test.ts. If that is out of scope, reword the line to 'main.ts hands it to `takeLinuxPastes`; nothing enforces this'."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/fences.ts",
      "line": 128,
      "rule_id": "TS11",
      "problem": "fences.ts is now 299 lines against oxlint's `max-lines` 300. It holds the import fences, cycle detection and an AST scan for clipboard reads. The next fence cannot be added without first splitting the file inside someone else's slice.",
      "fix": "Move the clipboard scan into `frontend/scripts/clipboardFence.ts`: the `CLIPBOARD_*` constants, `nameOf`, `readsClipboard`, `isClipboardRead`, `clipboardReads` and `clipboardViolations`. `findFenceViolations` calls it. Name the file in the project map with the PM8 line."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ui/linuxPaste.ts",
      "line": 4,
      "rule_id": "TS6",
      "problem": "`type ReadClipboard` restates `readClipboard`'s signature by hand. If the command's reply changes, there are two declarations to keep in step; the type check at main.ts:52 would still catch a mismatch.",
      "fix": "Use `type ReadClipboard = typeof readClipboard;` (type-only import from `../ipc`)."
    }
  ],
  "checked": [
    "Ownership: every touched file is in the brief's Owned list (linuxPaste.ts + test, main.ts, ipc/tauri.ts, ipc/index.ts, ipc/keys.ts + test, ui/settings.ts + test, scripts/fences.ts + test, ui/AGENTS.md, ipc/AGENTS.md); no read-only file (bindings.ts, editor/**, src-tauri/**, docs/**) is touched.",
    "Contract signatures match the brief: `isLinux(platform: string): boolean` (keys.ts:101), `readClipboard(selection): Promise<string | null>` (tauri.ts:146), `takeLinuxPastes(target: Window, read)` (linuxPaste.ts:8); `ClipboardSelection` is exported from ipc/index.ts.",
    "Import edges follow architecture §2: ui/linuxPaste.ts → ipc (log, type) and → ui/problem (`unexpected`, the existing log-field convention also used by closeGuard.ts:59, serverSetup.ts:97, windowStorage.ts:27); main.ts → ui/linuxPaste; no @tauri-apps, @codemirror or editor/internal import in ui (PM2); linuxPaste is not a compare-prefixed file, so PM7 does not apply, and it imports neither store.ts nor lsp/.",
    "main.ts:51-53 installs the listener once, before either root mounts, so the window capture listener is registered before any other paste listener; it runs only when `IN_APP && isLinux(navigator.platform)`, so fixture mode, macOS and Windows are unchanged (brief non-goals).",
    "Trusted pastes are cancelled with `preventDefault` + `stopImmediatePropagation` in the capture phase on window without touching `clipboardData` (linuxPaste.ts:15-19); untrusted pastes return early. The test's throwing `clipboardData` getter pins that the data is never read.",
    "The middle-release flag is cleared in the next task through `setTimeout`, not a microtask, which suits WebKit's mouseup → paste order in one task (EventHandler.cpp cited); it lives in a closure, so there is no module state (TS15) and no new §5.1 owner row is needed.",
    "Comments follow CP1: linuxPaste.ts:10-11 and :37-38 give WebKit facts with bug/source references; keys.ts:100 cites plan §2 #60.",
    "The `showsAntialiasing` → `isLinux` cutover leaves one Linux test (vision 2, brief Change 1); the platform cases moved to keys.test.ts:59-68 and settings.test.ts keeps a test that `showsAntialiasing` follows the rule.",
    "Fence logic: it covers property access, element access and destructuring (variable and parameter); a shorthand `{ clipboardData }` written into a new `ClipboardEvent` init and the `const clipboardData` variable declaration are not flagged; linuxPaste.test.ts's `get clipboardData()` accessor is not flagged; the exemption path `src/ui/linuxPaste.ts` matches `readSourceTree`'s `src/`-relative paths. The implementer's notes give the planted-read failure output.",
    "Open risk accepted: the fence does not scan `.vue` templates. A template `$event.clipboardData` only ever sees the window's own in-memory re-dispatch on Linux, because trusted pastes stop at the window capture; Vue templates cannot reach `navigator`.",
    "Deviation accepted: a failed read is logged with `log.warn(\"paste.read_failed\", …)` and the user sees nothing (plan §2 #99: nothing pasted, no notice); this also keeps the `.then` rejection handled (TS13).",
    "Deviation not accepted: the fence id `#99` (finding 2).",
    "PM6/map-check: `ui/linuxPaste.ts`, the `read_clipboard` command and the new fence are not yet in the project map or architecture §5.4; the orchestrator's contract says it adds them after review, so this is not a finding.",
    "AGENTS.md: the ui/AGENTS.md paragraph matches the behaviour in linuxPaste.ts; it was appended by `printf >>` (deviation), which is harmless — the file's content is what counts.",
    "No dead weight added: `readClipboard` and `isLinux` each have an importer (main.ts; settings.ts and main.ts); no unused export (implementer reports `pnpm unused` exit 0).",
    "Read only; I ran no gate or test."
  ]
}
```