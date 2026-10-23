# PasteCrashWindow (3.F-paste, board Paste crash row 3)

On Linux, the window now cancels every trusted paste and reads the text itself through `readClipboard`, so WebKitGTK never reads the clipboard and nothing crashed in any case I ran. Typecheck, lint, the node tests, formatting and `unused` all pass, and every real-app case in the brief plus your case 6 was observed on a private Xvfb (`:2`).

**summary**
- `ui/linuxPaste.ts` `takeLinuxPastes(target, read)`: a listener on the window, in the capture phase, cancels and stops every trusted `paste` without touching its data. It reads the selection (PRIMARY) when the paste comes right after a middle-button release in the same task, otherwise the clipboard. When the text arrives, and only if the original target still has the focus, it dispatches `new ClipboardEvent("paste", …)` with the text as `text/plain`. An input or textarea that nobody handled gets `execCommand("insertText")`. `null`, `""` or a failed read pastes nothing.
- `isLinux` sits beside `isMac` in `ipc/keys.ts`, and `showsAntialiasing` now uses it. `readClipboard` is in `ipc/tauri.ts`, exported from `ipc/index.ts` with `ClipboardSelection`.
- `main.ts` installs the listener for both windows only when the Tauri source runs on Linux.
- A new fence in `scripts/fences.ts` (rule `#99`) refuses `clipboardData` reads and `navigator.clipboard.read`/`readText` anywhere except `ui/linuxPaste.ts`. It catches property access, element access and destructuring. Writing `{ clipboardData }` into a new event and `writeText` are allowed.

**files_changed**
- `frontend/src/ui/linuxPaste.ts` (new)
- `frontend/src/ui/linuxPaste.test.ts` (new)
- `frontend/src/main.ts`
- `frontend/src/ipc/tauri.ts`
- `frontend/src/ipc/index.ts`
- `frontend/src/ipc/keys.ts`
- `frontend/src/ipc/keys.test.ts`
- `frontend/src/ui/settings.ts`
- `frontend/src/ui/settings.test.ts`
- `frontend/scripts/fences.ts`
- `frontend/scripts/fences.test.ts`
- `frontend/src/ui/AGENTS.md`
- `frontend/src/ipc/AGENTS.md`

**tests_added**
- `linuxPaste.test.ts` runs in the node project with a fake window, nodes and event classes:
  - "both listeners are on the window in the capture phase" (`mouseup` passive, `paste` capture).
  - "a trusted paste is cancelled and stopped without its data being read, then the clipboard is read". The fake event's `clipboardData` getter throws if anything reads it.
  - "an untrusted paste, the window's own, passes untouched and reads nothing".
  - "a paste in the middle button's release task reads the selection; the next task's reads the clipboard".
  - "a release of button 0/2 leaves the clipboard".
  - "the text is pasted again on the still focused target, bubbling and cancelable, as text/plain": an editor that handles it gets no `insertText`.
  - "an input / a textarea nobody handled gets the text typed in".
  - "a field that handled the paste, or an element that is no field, gets nothing typed".
  - "an answer of null / \"\" pastes nothing".
  - "a target that lost the focus before the answer gets nothing".
  - "a failed read pastes nothing".
- `keys.test.ts`: "Linux and macOS are told apart by navigator.platform's start and CodeMirror's Mac test". The platform cases moved here from `settings.test.ts`, which keeps a short test that `showsAntialiasing` follows the rule.
- `fences.test.ts`:
  - "reading clipboardData or navigator.clipboard outside ui/linuxPaste.ts violates #99" covers six forms: `event.clipboardData`, `navigator.clipboard.readText`, `window.navigator["clipboard"]["read"]`, a `{ clipboardData }` parameter in a `.vue` file, `const { readText } = navigator.clipboard`, and `event["clipboardData"]`.
  - "ui/linuxPaste.ts reading, and writing the clipboard or a paste's data anywhere, violate nothing".

**smoke_evidence**
- `pnpm -C frontend typecheck` → exit 0. `lint` → exit 0. `fmt:check` → "All matched files use the correct format." `unused` → exit 0. `test` → "Test Files 147 passed (147) / Tests 1942 passed (1942)".
- Planted read: I added `export function planted(event: ClipboardEvent): string | undefined { return event.clipboardData?.getData("text/plain"); }` to `src/ipc/tauri.ts` and ran `vitest run --project node scripts/fences.test.ts`. It failed with "× the real source tree has no fence violations … + { "file": "src/ipc/tauri.ts", "reason": "only ui/linuxPaste.ts reads the clipboard (plan §2 #99)", "rule": "#99", "specifier": "event.clipboardData" }". I removed the line afterwards.
- Real app: build with `cargo tauri build --debug --no-bundle`, then `just app-session start-app --name paste --fresh-repo`. Display `:2`, `GDK_BACKEND=x11` with `WAYLAND_DISPLAY` unset (`session.ts` `displayEnv`), private HOME, `navigator.platform` "Linux x86_64". Keys went through `--x11` (xdotool). Owners were started with `setsid -f xclip … -loops 0 -quiet`, their pid taken from `pgrep -f` on the exact command line, and ended with `kill $pid`.
  1. **Live owner, 3 lines.** Result: Ctrl+V → `"result":"PASTE-A1\nPASTE-A2\nPASTE-A3"`, then one Ctrl+Z → `"result":"\n"`. Compare column (`--raw` session): Ctrl+V → `"left":"PASTE-A1\nPASTE-A2\nPASTE-A3","maxLine":3`, then Ctrl+Z → `"left":"\n","maxLine":1`.
  2. **Owner killed** (`xclip -o -t TARGETS` → "Error: target TARGETS not available"). Ctrl+V, Shift+Insert and Ctrl+Shift+V each gave "alive: 2051920" (merge) or "alive: 2075166" (compare), with no text changed:
     - Result and a side pane: `lengths [37,30,38]` before and after.
     - Find field: `["INPUT","Find",""]` before and after.
     - Compare column: `"columns":[1,1]`.
     - Tab rename: `["INPUT","Tab name","Compare 1"]` before and after.
     - Afterwards a live owner landed: Result `"…line three\nPASTE-C1"`, find field `"FINDME"`, tab rename `"Compare 1PASTE-T1"` (Escape kept the name "Compare 1").
     - The compare session also started on a fresh display whose clipboard was never owned. The same three keys there gave "alive: 2075166" each and `"columns":[1,1]`.
  3. **Right-click → Paste in the Result, owner killed.** The screenshot shows WebKit's menu (Cut, Copy, Paste, Delete, Select All, …). After Paste: "alive: 2051920", lengths `[37,30,38]`, menu closed. With a live owner, the same menu Paste landed `PASTE-C1`.
  4. **Middle button.** With `primary=PASTE-P1 clipboard=PASTE-C1`, a middle click in the Result → `"marks":["PASTE-P1"]`, so the selection, not the clipboard. With the PRIMARY owner killed → "alive: 2051920" and the Result unchanged (`[37,30,38]`). This also confirms the brief's [INFERENCE]: the paste comes in the same task as the middle button's `mouseup`.
  5. **Large pastes into a compare column.** `seq 300` → `"maxLine":301,"leftEnd":"…298\n299\n300\n\n"` (300 lines plus the trailing newline), and Ctrl+Z → `"maxLine":1`. A 9,437,184-byte payload → "alive: 2075166", `"notices":["Compare 1, left: not pasted — a column holds up to 8 MiB"]`, `"columns":[1,1]`.
  6. **Text yamt itself owns** (your case 6). After Ctrl+A and Ctrl+C in the Result, the clipboard targets were "TIMESTAMP TARGETS … org.webkitgtk.WebKit.custom-pasteboard-data", and the xclip had exited because yamt now owned the clipboard. Ctrl+V into another file's Result (notes/crlf.txt) → `"line one\nline two\nline three\nPASTE-A1\nPASTE-A2\nPASTE-A3"`. I used that alternative rather than a compare column. Then I double-clicked "line" in the Local pane (`PRIMARY=line`, `CLIPBOARD=PASTE-A1 PASTE-A2 PASTE-A3`) and middle-clicked the Result → `"…line three\nline"`.
- Both sessions were stopped with `just app-session stop`, and their folders were removed.
- Versions: node v24.22.1, pnpm 12.0.0, tauri-cli 2.12.2.

**deviations_from_brief**
- The fence needed a rule id and the brief named none. I used `"#99"`, the plan row, because I could not add a PM rule to the read-only project map. If you want it there, add a PM8 line to the project map and `docs/architecture.md`.
- Reads that fail are logged as a warning (`log.warn("paste.read_failed", …)`) so a rejected promise is not left unhandled. Nothing is shown to the user, in line with rule 2.
- `ClipboardSelection` is re-exported from `tauri.ts` (`export type { ClipboardSelection }`) and from there through `index.ts`, as the brief's "(from ipc/tauri.ts)" says, not through `domain.ts`.
- I appended the paragraph to `ui/AGENTS.md` with a shell `printf >>` instead of the edit tool.
- `pnpm install --offline` created `frontend/node_modules`, and the build created `target/`, inside the worktree. Both are build outputs.
- Not in my slice and still needed by PM6 (`just map-check`): a project-map and `docs/architecture.md` §5.4 entry for `ui/linuxPaste.ts`, plus a CHANGELOG line.

**open_risks**
- `frontend/src/ui/linuxPaste.ts:20`: a trusted paste whose target is not a `Node` is cancelled and dropped. No test covers that guard, so it could survive mutation testing.
- `frontend/src/ui/linuxPaste.ts:55-69`: in the find field, Ctrl+Z did not undo the inserted text. Typing "abc" and pressing Ctrl+Z did not undo either, so this was not caused by the paste fix, but the brief's "native undo" for fields could not be shown there.
- The fence reads scripts only (`frontend/scripts/fences.ts` `scriptTexts`). A `.vue` template expression like `$event.clipboardData` would not be caught.
- Not tested: a hung owner (`kill -STOP`), Wayland, and the settings-path and server fields. None of these are in this brief's acceptance; the request lists Wayland.