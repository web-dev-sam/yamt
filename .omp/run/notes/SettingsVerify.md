# SettingsVerify — verifier report (fields read one by one)

```json
{
  "gate": "fail",
  "failures": [
    {
      "step": "just mutants d370796 — Stryker (ipc/, ui/)",
      "excerpt": "Exit 1. The TypeScript mutation run never got started: its first test run failed inside Stryker's sandbox.\n15:51:41 INFO ProjectReader Found 18 of 294 file(s) to be mutated.\n15:51:42 INFO Instrumenter Instrumented 18 source file(s) with 1916 mutant(s)\n15:51:48 ERROR DryRunExecutor One or more tests failed in the initial test run:\n\tthe real source tree has no palette violations, the native window colours included\n\t\texpected [ …(125) ] to include '../src-tauri/src/window.rs'\n15:51:48 ERROR Stryker There were failed tests in the initial test run.\nConfigError: There were failed tests in the initial test run.\nerror: recipe `mutants` failed with exit code 1\nCause: frontend/scripts/palette.test.ts:17-20 asserts that ../src-tauri/src/window.rs is among the sources it reads. Stryker copies only frontend/ into target/stryker-tmp, so that file is missing there. The test passes in `just check` (web-test 566/566). None of the 1916 TS mutants were run. Owner: the slice that added the native-colour check to palette.test.ts (settings desktop/web)."
    },
    {
      "step": "just mutants d370796 — Rust survivors (real gaps, VF7)",
      "excerpt": "52 mutants tested in 2m: 7 missed, 23 caught, 22 unviable\nMISSED src-tauri/src/window.rs:56:5 replace start_theme -> Theme with Default::default()\nMISSED src-tauri/src/window.rs:72:5 replace background -> Color with Default::default()\nMISSED crates/settings/src/file.rs:49:23 replace match guard error.kind() == ErrorKind::NotFound with true in load\nMISSED crates/settings/src/places.rs:81:27 replace match guard error.kind() == ErrorKind::NotFound with true in Places::record_location\nMISSED crates/settings/src/places.rs:81:27 replace match guard ... with false in Places::record_location\nMISSED crates/settings/src/places.rs:81:40 replace == with != in Places::record_location\n(window.rs:66 show_theme -> () is triaged in smoke[].) Triage: these are a decision, a constant and guards, so none can be dropped. Details are in smoke[]."
    }
  ],
  "smoke": [
    {
      "recipe": "just check (exit 0)",
      "observed": "EXIT=0. Tail of each stage: fmt-check `All matched files use the correct format. Finished in 522ms on 146 files` + cargo fmt silent | clippy `Finished dev profile` (no warnings) | test `Summary [1.980s] 351 tests run: 351 passed, 1 skipped` | deny `advisories ok, bans ok, licenses ok, sources ok` (warnings only: duplicates, unmaintained paste/proc-macro-error) | bindings-check: diff empty | fixtures-check: diff -ru empty | web-lint (oxlint + eslint --max-warnings 0) silent | web-typecheck `vue-tsc -b` silent | web-test `Test Files 48 passed (48) Tests 566 passed (566)` | web-unused `knip --include exports,types` silent | arch-check `arch-check: ok` | map-check `map-check: ok` | golden `ok` ×10 (language-tools-script-setup … vueuse-use-magic-keys) | sfc-order silent | hooks-test `tests 16 pass 16 fail 0`",
      "pass": true
    },
    {
      "recipe": "just mutants d370796 — Rust (cargo-mutants on yamt-settings, yamt-app)",
      "observed": "`Found 52 mutants to test; ok Unmutated baseline in 44s build + 3s test; 52 mutants tested in 2m: 7 missed, 23 caught, 22 unviable`. Triage of the 7 survivors:\n- src-tauri/src/window.rs:56 `start_theme -> Default::default()`: REAL GAP. It is the light-start decision, and the no-config-folder fallback is a branch. Smoke step 3 shows a light start works, but no test kills the mutant.\n- src-tauri/src/window.rs:66 `show_theme with ()`: (c) wiring. It is one set_background_color call plus a warn log, with no decision of its own. Its effect showed in smoke step 2: no dark native background in any of the 90 resize frames after switching to Light.\n- src-tauri/src/window.rs:72 `background -> Default::default()`: REAL GAP (theme→colour constant mapping).\n- crates/settings/src/file.rs:49 NotFound guard→true in load: REAL GAP. Any read error would be treated as 'no file'.\n- crates/settings/src/places.rs:81:27 guard→true, :81:27 guard→false, :81:40 `==`→`!=` in record_location: REAL GAPS. A removal error is swallowed or a missing location file is reported as an error, and no test covers either.",
      "pass": false
    },
    {
      "recipe": "just mutants d370796 — Stryker (frontend ipc/, ui/)",
      "observed": "It did not run: the first test run failed with `the real source tree has no palette violations, the native window colours included — expected [ …(125) ] to include '../src-tauri/src/window.rs'` and `error: recipe mutants failed with exit code 1`. No TS survivors could be listed. I did not retry (VF1/VF2).",
      "pass": false
    },
    {
      "recipe": "Real app step 1 — first start, no settings file (Xvfb :97, GDK_BACKEND=x11, WAYLAND_DISPLAY unset, XDG_CONFIG_HOME=/tmp/yamt-test-set/config, HOME=/tmp/yamt-test-set-home, release binary via tauri-driver, xdotool input)",
      "observed": "Window title `yamt-test-set — yamt`, 1600x1000. `dataset.theme` = \"dark\". The frame pixels were srgb(38,40,44) and srgb(25,26,28) (01-start.png). Clicking the gear opened the view (02-settings-dark.png): Theme with Dark pressed (aria-pressed Dark=true, Light=false). Keymap groups showed today's keys: Side panes (Apply Enter Space; Ignore Backspace Delete X; Next change ↓; Previous change ↑; Left side ←; Right side →), Anywhere in the file (Undo Ctrl+Z; Redo Ctrl+Shift+Z Ctrl+Y), Find (Find Ctrl+F; Find next F3; Find previous Shift+F3; Close find Escape), Result pane (Indent Tab; Outdent Shift+Tab). The field read `/tmp/yamt-test-set/config/yamt/settings.json`. The file existed with content `{\\n  \"theme\": \"dark\"\\n}`. Side note: the gear's tooltip \"Setting…\" was drawn clipped at the right edge of the window.",
      "pass": true
    },
    {
      "recipe": "Real app step 2 — Light",
      "observed": "After clicking Light the whole view recoloured at once (03-settings-light.png). File: `{\\n  \"theme\": \"light\"\\n}`; dataset.theme \"light\". Back → vOn.ts (04-merge-light.png): light panels, dark text, syntax colours, blue change band at line 16, purple conflict at lines 19–21, curved connectors, toolbar `2 changes · 1 conflict`. I recorded a 3 s x11grab at 30 fps while running xdotool windowsize 1600x1000→1900x1180 in 6 steps. Over all 90 frames: #191a1c = 0 pixels. #26282c = 2–5 isolated pixels per frame, always inside the toolbar text row (bounding box from +286+27, height 3–79). That is antialiased text, not background. Newly exposed area, e.g. frame 35 p{1700,1050} = srgb(252,252,252) (05-resize-frame35.png).",
      "pass": true
    },
    {
      "recipe": "Real app step 3 — light start recorded",
      "observed": "I quit the session (file theme=light), then recorded x11grab at 60 fps (ffv1) from 0.5 s before session start, 360 frames. Pixel samples (5,5)/(120,500)/(800,500)/(1580,20)/(1590,990), with consecutive identical rows collapsed: 46× all 000000 (no window yet), 10× all E9EAEE (first painted frame = native light background, 06-first-painted.png), 3× E9EAEE FFFFFF E9EAEE E9EAEE E9EAEE, 301× E9EAEE FFFFFF FFFFFF E9EAEE FFFFFF (page ready). Count of exact #26282c and #191a1c pixels in each of the 360 frames: `360 0 0`, i.e. no dark pixel in any frame.",
      "pass": true
    },
    {
      "recipe": "Real app step 4 — two files, theme switch",
      "observed": "Opened App.vue, then vOn.ts. Gear → Dark → Back, then switched to App.vue. Result: dataset.theme \"dark\", selected file `packages-private/sfc-playground/src/App.vue`, the screenshot is fully dark (07-other-file-dark.png), file `{\"theme\": \"dark\"}`.",
      "pass": true
    },
    {
      "recipe": "Real app step 5 — re-bind Apply",
      "observed": "Apply menu (08-apply-menu.png): Add Keyboard Shortcut | Change Enter… | Remove Enter | Change Space… | Remove Space. Change Enter… → pressed A, the dialog showed `A` (09-recorder-a.png) → OK. File: `\"keys\": {\"apply\": [\"a\", \"Space\"]}, \"theme\": \"dark\"`. In App.vue, on a focused remote change: Enter left `6 changes · 1 conflict`; A gave `5 changes · 1 conflict`. In vOn.ts, on remote line 16: Enter left `2 changes · 1 conflict`; A gave `1 change · 1 conflict`.",
      "pass": true
    },
    {
      "recipe": "Real app step 6 — clash",
      "observed": "Undo → Add Keyboard Shortcut → Ctrl+F. The dialog showed `Ctrl+F` and `⚠ Already used by: Find` (11-clash-dialog.png). OK → question `Key Already in Use — Ctrl+F is already used by Find. Move it to Undo?` [Move][Cancel] (12). Move → the view shows Undo `Ctrl+Z Ctrl+F` and Find `None` (13). File keys: `find: [], undo: [\"Mod-z\",\"Mod-f\"]`. In vOn.ts with the remote side focused, Ctrl+F changed status from `1 change` to `2 changes · 1 conflict` (an undo) and no find input became visible (`[]`). Cancel case: Redo → Add → Ctrl+Z → OK → `Ctrl+Z is already used by Undo. Move it to Redo?` → Cancel. sha256 before and after was the same: 09b0237a…8e646a. Rows unchanged (15-after-cancel.png).",
      "pass": true
    },
    {
      "recipe": "Real app step 7 — reset",
      "observed": "Apply menu now has a Reset Shortcuts entry (16). Reset on Apply → file `{\"keys\":{\"find\":[],\"undo\":[\"Mod-z\",\"Mod-f\"]},\"theme\":\"dark\"}` (apply entry gone, row shows Enter Space). Reset on Undo → `{\"keys\":{\"find\":[]},\"theme\":\"dark\"}`, row shows Ctrl+Z. I also reset Find → `{\"theme\": \"dark\"}`.",
      "pass": true
    },
    {
      "recipe": "Real app step 8 — hand edit",
      "observed": "With xmessage holding X focus, I wrote `{\"theme\": \"light\", \"keys\": {\"next-change\": [\"j\"]}}`. While unfocused, the page stayed dataset.theme \"dark\". After xdotool windowfocus on yamt, dataset.theme was \"light\" and the file stayed byte-identical (not rewritten). In vOn.ts with the remote side focused, the chunk-focus mark moved from `chunk-marker-conflict … export interface VOnDirectiveNode` to `chunk-modified chunk-focus-first: const isMemberExp …` after J. Down then left it unchanged. The view's Next change row shows `J` (21-view-j-light.png).",
      "pass": true
    },
    {
      "recipe": "Real app step 9 — broken file",
      "observed": "While unfocused I wrote `{\"theme\": \"light\",\\n  \"keys\": {\"next-change\": [\"j\"]\\n` (sha256 7c6856d2…048716). After refocus the problem bar said: `The settings file /tmp/yamt-test-set/config/yamt/settings.json has an error at line 3, column 0: EOF while parsing an object. Fix it or choose another file.` dataset.theme stayed \"light\". I pressed Dark (at its shifted position under the bar): Light stayed pressed, theme \"light\", the problem bar stayed, sha256 unchanged at 7c6856d2…048716 (24-broken-dark-refused.png). Note: the column is reported as 0 for an EOF error.",
      "pass": true
    },
    {
      "recipe": "Real app step 10 — another location",
      "observed": "I fixed the file while unfocused, then refocused: no problem bar. I typed `/tmp/yamt-test-set/elsewhere/s.json` + Enter: the field showed that path, s.json was created with `{\"keys\":{\"next-change\":[\"j\"]},\"theme\":\"light\"}`, and `config/yamt/settings-location` = `/tmp/yamt-test-set/elsewhere/s.json`. Pressing Dark changed only s.json (sha c2b78a1f… → 3f0a2318…, now theme dark); the default settings.json stayed cbb84dc5… throughout. Pressing Default put the field back to `/tmp/yamt-test-set/config/yamt/settings.json`, removed settings-location (dir lists only settings.json), and the theme followed the default file (light). Typing `relative/s.json` + Enter gave the problem bar `Could not use the settings file: relative/s.json is not an absolute path; start it with / or ~/.` and the field kept `relative/s.json` (25-relative.png). Note: I used execute once for `input.scrollIntoView` to read the field's position. That scrolled the view; it was not used as an action.",
      "pass": true
    },
    {
      "recipe": "Real app step 11 — toolbar",
      "observed": "Visible top buttons: [\"Mark resolved\",\"Previous change\",\"Next change\",\"Apply non-conflicting changes from the left\",\"Apply non-conflicting changes from the right\",\"Settings\"], with no Undo/Redo (26-toolbar.png). With the remote change at line 84 focused: Enter changed `2 changes · 1 conflict` to `1 change · 1 conflict`, and Ctrl+Z brought back `2 changes · 1 conflict`.",
      "pass": true
    },
    {
      "recipe": "Real app step 12 — Alt+Backspace undo, F10 close find, Indent removed, read-only Tab",
      "observed": "Undo changed to Alt+Backspace (dialog shows `Alt+Backspace`, file `undo:[\"Alt-Backspace\"]`). In the middle pane I typed zzq at the end of line 42 → `  let eventName: ExpressionNodezzq`. Ctrl+Z left it unchanged; Alt+Backspace gave `  let eventName: ExpressionNode`. From a side: I retyped, clicked into the remote pane, Ctrl+Z left `…Nodezzq`, Alt+Backspace gave `…Node`. Close find changed to F10 (`close-find:[\"F10\"]`). Ctrl+F in the middle opened Find; Escape left the input open; the buttons were `Previous Occurrence (Shift+Enter)`, `Next Occurrence (Enter)`, `Close (F10) title=Close (F10)`; F10 closed it (`openInputs: []`). Remove Tab on Indent (via keyboard, because the menu was clipped at the window bottom) → `indent: []`, the row shows None. Tab in the middle moved focus from the middle editor (x=713) to the remote editor (x=1172) and the line was unchanged. In docs/removed.md's read-only Result pane, Tab moved focus to the `Delete` button. I then ran Reset Shortcuts on Next change, Undo, Close find and Indent → file `{\"theme\": \"light\"}`.",
      "pass": true
    },
    {
      "recipe": "Cleanup",
      "observed": "I closed the WebDriver session (no yamt window left) and killed tauri-driver, xmessage and Xvfb :97. `pgrep` for Xvfb :97|tauri-driver|WebKitWebDriver|xmessage|target/release/yamt found nothing. I removed /tmp/yamt-test-set, /tmp/yamt-test-set-shots and /tmp/yamt-test-set-home. Screenshots and videos were kept in /tmp/yamt-settings-verify-evidence/ (01–34 *.png, resize.mkv, start.mkv). target/release/yamt was left rebuilt. `git status --short` is empty. A pre-existing /tmp/yamt-test-settings (not created by me) also matches the glob and was left alone.",
      "pass": true
    }
  ],
  "environment": "Linux 7.2.9-arch1-1 x64. HEAD ab94cb6, worktree clean. rustc 1.99.0 (b940084d7 2026-09-28), node v24.21.0, pnpm 12.0.0, tauri-cli 2.12.1, wry 0.57 (WebDriver browserVersion), /usr/bin/WebKitWebDriver and ~/.cargo/bin/tauri-driver present. Xvfb :97 1920x1200x24 without a window manager. ImageMagick and ffmpeg (x11grab) are available. The release app was built with `cargo tauri build --no-bundle` (EXIT 0, 14.9 s). Stryker 10.0.0 with the vitest runner. Not run here (needs macOS): the ⌘/⌃ key labels in the keymap and dialog, and the NSWindow native background colour at a light start and on resize."
}
```
