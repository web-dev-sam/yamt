# PasteCrashWindowR1 (3.F-paste fix round 1)

Both blocks (#1565, #1571) and the six promoted items are fixed. The frontend recipes pass, the three hand mutations each failed tests, and every real-app case behaved as the brief asks on a private Xvfb (`:2`).

**summary**
- `ui/linuxPaste.ts` now records the focused element when the trusted paste arrives. When the text comes back, it pastes only if that element still has the focus and is neither `<body>` nor `null`.
- The paste is sent again on the original target if that target is still in the page. If it was removed, the paste goes to the recorded focused element, and a field nobody handled gets `insertText`.
- The clipboard check moved out of `scripts/fences.ts` (now 235 lines) into the new `scripts/clipboardFence.ts`, and its rule id is now `PM8`.
- `ClipboardSelection` now comes from `ipc/domain.ts` and is exported through `ipc/index.ts`; the re-export in `tauri.ts` is gone. Both `AGENTS.md` files are reworded.

**files_changed**
- `frontend/src/ui/linuxPaste.ts`
- `frontend/src/ui/linuxPaste.test.ts`
- `frontend/src/ipc/domain.ts`
- `frontend/src/ipc/index.ts`
- `frontend/src/ipc/tauri.ts`
- `frontend/scripts/fences.ts`
- `frontend/scripts/clipboardFence.ts` (new)
- `frontend/scripts/fences.test.ts`
- `frontend/src/ui/AGENTS.md`
- `frontend/src/ipc/AGENTS.md`

**tests_added**
- `linuxPaste.test.ts` "focus moved to %s before the answer pastes nothing" (the body, or nothing): neither the target nor the editor receives anything (#1565).
- "a paste while the body has the focus pastes nothing": the `<body>` check on its own.
- "a target removed from the page before the answer has the paste go to the still focused editor": the editor gets the event carrying the text, and the removed target gets nothing (#1571).
- "a target removed from the page before the answer has the text typed into the still focused field": the field gets the event and `insertText`.
- `FakeClipboardEvent` now keeps `init.clipboardData`. The "still focused target" test and both removed-target tests check that `clipboardData.getData("text/plain")` returns the text (#1572). The "still focused target" test also checks that the editor gets no second copy.
- `fences.test.ts`: the clipboard cases now expect `PM8`, and one violating case checks the reason text (#1566, #1573). `src/ui/reader.ts` with `function f({ readText }: Clipboard) {}` and `src/ui/linuxPaste.test.ts` were added to the cases that violate nothing.

**smoke_evidence**
- `pnpm -C frontend typecheck`: `$ vue-tsc -b`, no output, so no errors.
- `pnpm -C frontend lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no output, so no findings.
- `pnpm -C frontend fmt:check`: `All matched files use the correct format. Finished in 747ms on 422 files`
- `pnpm -C frontend unused`: `$ knip --include exports,types`, no output, so no unused exports.
- `pnpm -C frontend test`: `Test Files 147 passed (147)`, `Tests 1947 passed (1947)`
- `just map-check`: `map-check: ok`
- Hand mutations (each run, then reverted; the file is back at its pre-mutation state, `#FBDF`):
  1. Accepting `<body>` (removed `focused === document.body ||`): `× a paste while the body has the focus pastes nothing … AssertionError: expected [ …(1) ] to deeply equal []`, `Tests 1 failed | 18 passed (19)`
  2. Always sending on the original target (`const receiver = pasted;`): `× a target removed from the page … still focused editor`, `× a target removed from the page … still focused field`, `Tests 2 failed | 17 passed (19)`
  3. Sending without `clipboardData`: `× the text is pasted again on the still focused target…`, `AssertionError: expected undefined to be 'one\ntwo\nthree'`, the same failure in both removed-target tests, `Tests 3 failed | 16 passed (19)`
- Real app: built with `cargo tauri build --debug --no-bundle`, started with `just app-session start-app --name paste --fresh-repo`, display `:2`. Keys went through `--x11` (xdotool). Each owner was an `xclip -selection clipboard -loops 0 -quiet` service and was ended with `kill $pid`.
  - **Live 3-line paste into the Result** (`notes/crlf.txt`): Ctrl+V gave `"line one\nline two\nline three\nPASTE-A1\nPASTE-A2\nPASTE-A3"`. One Ctrl+Z gave `"line one\nline two\nline three\n\n"` back.
  - **Owner killed:** after `kill 2141822`, `xclip -o -t TARGETS` answered `Error: target TARGETS not available`. Ctrl+V into the Result: the app was still running (`pgrep` → `2137634`) and the Result was unchanged, `"line one\nline two\nline three\n\n"`.
  - **Hung owner:** `kill -STOP 2144028`, then Ctrl+V into the Result (unchanged), then a click on the empty part of the file list. `activeElement` was `["BODY",true]`. After `kill -CONT 2144028` the owner's log shows `Waiting for selection request number 2`, so the late answer was delivered. The Result was still `"line one\nline two\nline three\n\n"` and the app was still running (`2137634`).
  - When I then sent `kill 2144028`, it answered "failed to send signal": the owner had already exited (code 0) before the kill. The test result above does not depend on this.
  - **Compare column** (`start-app --name pasteraw --raw`, `yamt --raw`): Ctrl+V gave `["\"PASTE-A1\\nPASTE-A2\\nPASTE-A3\"","\"\\n\""]`. One Ctrl+Z gave `["\"\\n\"","\"\\n\""]` back.
  - Both sessions were stopped with `just app-session stop` and their folders removed. Afterwards `pgrep` found no `xclip`, `yamt` or Xvfb process.

**deviations_from_brief**
- `clipboardFence.ts` exempts `src/ui/linuxPaste.test.ts` as well as `ui/linuxPaste.ts`. The fence flags any `clipboardData` read, so keeping `init.clipboardData` in the test's fake (#1572) made the "real source tree has no fence violations" test fail with three hits in that test file. The exemption is pinned by a case in the "violates nothing" test.
- `clipboardFence.ts` imports the types `FenceViolation` and `SourceFile` from `fences.ts` (`import type`), while `fences.ts` imports `clipboardViolations` from it. That is a cycle between the two files, but only through types. `import/no-cycle` did not flag it and `lint` passes.
- The PM8 reason text now reads "only ui/linuxPaste.ts reads the clipboard through WebKit (plan §2 #99)", to match the project map's PM8 wording.
- `deliver` takes `{ pasted, focused }` as one object parameter. An `Element` is also a `Node`, so the two could be swapped without a type error (TS7).
- The test fake `FakeNode` lost `parent` and `contains`, because the implementation no longer calls `contains`.
- Reading still starts when `<body>` has the focus at paste time; delivery then refuses it. I chose this because the brief only places the check at delivery.
- `.omp/run/slices.json` shows as modified in the tree. I did not edit it.

**open_risks**
- `frontend/src/ui/linuxPaste.ts:75`: a target that is still in the page is used as-is. Nothing checks that it lies inside the recorded focused element. The original target is normally the focused element or inside it.
- `frontend/scripts/clipboardFence.ts:3`: the type-only cycle with `fences.ts`. If `import/no-cycle` is ever set to count type imports, it will fail.
- Not run: Wayland, and the earlier round's middle-button and context-menu paths (this brief does not list them).

**Checks to run:** `just check`, and `just mutants 849e5c5` for the reviewer.