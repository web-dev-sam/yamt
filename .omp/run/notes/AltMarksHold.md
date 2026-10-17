# AltMarksHold — build output (3.O-hold, board "Change marks" row 2)

**summary**
The window now tracks whether Alt is held. `frontend/src/ui/altHold.ts` holds the pure `heldAfter` rule and the `useAltHold()` composable. The composable listens for `keydown`/`keyup` in the capture phase, for window `blur`, and for the page becoming hidden (`useDocumentVisibility`). It listens for `pointerdown`/`pointermove`/`pointerup`/`wheel` on the window (capture, passive) only while Alt is held. No listener calls `preventDefault`. `App.vue` calls `useAltHold()` once and passes `:marks="altHeld"` to every `<MergeView>`. All four acceptance items were observed.

**files_changed**
- `frontend/src/ui/altHold.ts` (new)
- `frontend/src/ui/altHold.test.ts` (new)
- `frontend/src/ui/App.vue`

**tests_added** (`frontend/src/ui/altHold.test.ts`, node, 20 tests)
- Rules for `heldAfter`:
  - "Alt's press shows, from shown or hidden"
  - "AltGraph's press never shows (shown before: true/false)"
  - "Alt's release hides, whatever altKey says"
  - "another key hides, and Alt's repeat keeps them hidden"
  - "Alt's repeat while shown keeps them shown"
  - "another key's release with Alt up hides, with Alt down keeps"
  - "a pointer event with Alt up hides, with Alt down keeps, and never shows"
  - "leaving the window hides"
  - "back with Alt still held shows nothing until a fresh press"
- `useAltHold` against stand-in `window`/`document` objects that record each listener's options:
  - "keys are heard in the capture phase; pointers not while Alt is up": exactly `{keydown: "capture", keyup: "capture", blur: ""}` are registered.
  - "while held, pointer and wheel events are heard in the capture phase, passively": the four listeners are added while held and removed on release.
  - "a pointerdown/pointermove/pointerup/wheel with Alt down keeps them, with Alt up hides them"
  - "another key's press and release reach the hold with their own fields"
  - "the window losing focus hides"
  - "the page becoming hidden hides; becoming visible does not"
  - "no event's default is prevented"

**smoke_evidence**
1. Node tests and mutants:
   - `pnpm -C frontend exec vitest run --project node src/ui/altHold.test.ts` → `Tests  20 passed (20)`.
   - `just mutants <base>` finds nothing here: it lists files with `git diff --diff-filter=AM <base>`, and new untracked files don't appear in that. So I ran its Stryker command directly with `--mutate src/ui/altHold.ts`.
     - First run: 1 survivor, `altHold.ts:58:9 if (visibility === "hidden") → if (true)`. The test never switched visibility from hidden back to visible, so the watch never fired on "visible". I fixed the test.
     - Rerun: `altHold.ts | 100.00 | 100.00 | 62 killed | 0 | 0 survived | 0 no cov | 0 errors`.
2. Frontend recipes, run with `set -o pipefail`:
   - `lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
   - `typecheck` → `$ vue-tsc -b`, exit 0
   - `test` → `Test Files  102 passed (102)`, `Tests  1369 passed (1369)`, exit 0
   - `unused` → `$ knip --include exports,types`, exit 0
   - `fmt:check` → `All matched files use the correct format. Finished in 756ms on 307 files`, exit 0
   - `just sfc-order` → `$ tsx scripts/check-sfc-order.ts`, exit 0
3. WebKit, fixture page:
   - Setup: `pnpm -C frontend dev --port 5317 --strictPort` and `just webdriver 4446` (`test windows go to Samsung (HDMI-A-1…)`). MiniBrowser 2.54.1 with the capabilities from `skill://verification`. I opened a second file by clicking it, so two MergeViews exist (before any key: `["false","false"]`).
   - Reads of `[marks]` after each step:

     | Step | Read |
     |---|---|
     | keyDown Alt | `["true","true"]` |
     | keyUp Alt | `["false","false"]` |
     | keyDown Alt | `["true","true"]` |
     | then press `a` | `["false","false"]` |
     | 1 s later, Alt still down | `["false","false"]` |
     | keyUp, then keyDown Alt | `["true","true"]` |
     | `window.dispatchEvent(new Event("blur"))` | `["false","false"]` |

   - Session deleted, driver and dev server stopped.
4. Real app, real X input:
   - Setup: `cargo tauri build --debug --no-bundle` → `Built application at: …/target/debug/yamt`. `just app-session start-app --name b-hold --fresh-repo` → `{"display":":2",…}`.
   - Reads, all taken with `tsx scripts/app-session.ts read --name b-hold` (`just app-session read` breaks on a quoted JS argument):

     | Step | Read |
     |---|---|
     | start | `{"value":["false"]}` |
     | `DISPLAY=:2 xdotool keydown alt` | `{"value":["true"]}` |
     | `focus-away` (`{"focused":"xmessage",…}`) | `{"value":["false"]}` |
     | `focus-back` (`{"focused":"app",…}`) | `{"value":["false"]}` |
     | `xdotool keyup alt` | `{"value":["false"]}` |
     | `xdotool keydown alt` | `{"value":["true"]}` |
     | `xdotool keyup alt` | `{"value":["false"]}` |

   - `stop --name b-hold` → `{"stopped":"b-hold","session":"ended","procs":[{"role":"tauri-driver",…"stopped"},{"role":"xvfb",…"stopped"}],"folder":"removed …"}`.
   - A leftover check found one other process, `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 2093060). It started before my session and uses a different repo, so I left it running.

**deviations_from_brief**
- `just mutants <base>` can't see uncommitted new files, so I ran its Stryker line by hand on `src/ui/altHold.ts`. The orchestrator's run after the commit will cover it the normal way.
- I ran `pnpm install --frozen-lockfile --offline` in the worktree, which had no `node_modules`. No lockfile change.
- I built `target/debug/yamt` in the worktree, which the real-app check needs.
- For the WebKit check I used raw WebDriver calls with curl instead of `app-session start-fixture`, because the brief needs a keyDown with no keyUp.
- Choice the brief left open: the hidden page is detected with `useDocumentVisibility()` plus a `watch`. The pointer listeners use `useEventListener` with a target of `window` while held and `null` otherwise.
- The test puts stand-in `window`/`document` objects in `vi.hoisted` before VueUse loads. The `document` needs `createElement: () => ({})`, because Vue's runtime-dom calls it on import. The `window` needs `window.document`, because VueUse takes its default document from there.

**open_risks**
- `frontend/src/ui/App.vue:81`: until the editor build adds the `marks` prop, `marks` falls through as an HTML attribute on MergeView's root `<div>` (`marks="true"`/`"false"`). That is intended for now.
- `frontend/src/ui/altHold.ts`: the pointer listeners attach after Vue's post-flush, a microtask after Alt's keydown. A pointer event inside that gap isn't seen. It couldn't show the marks anyway; at worst one Alt-up hide waits for the next event.
- `frontend/src/ui/altHold.test.ts:6-39`: the test relies on VueUse 15 reading `window.document` once when it loads. A VueUse upgrade that changes this would break the stand-ins, and the tests would fail loudly rather than pass wrongly.