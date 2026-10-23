**Gate: pass.** The feature check fails overall on three points: the WebKit test run had 5 failures (none in `themes.browser.test.ts`), the real app showed no broken-settings message, and `just mutants` left survivors on feature lines that were not triaged before. The ten themes themselves matched their CSS files in every colour, shape and window check I ran.

Commit `a44e0f0` on `feat/themes`, clean tree before the run. rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0. Plain Playwright WebKit does not start on this host; the private copy at `PLAYWRIGHT_BROWSERS_PATH=/tmp/th-code-pw` (webkit-2370) was still there and I used it. All screenshots are in `/tmp/yamt-themes/verify/`.

```
gate: "pass"

failures: [
 { step: "pnpm -C frontend test:browser (recipe 3)",
   excerpt: "Test Files  3 failed | 3 passed (6) / Tests  5 failed | 18 passed (23) / ELIFECYCLE exit 1.
   × compare.browser.test.ts > the columns and the strip follow the theme, dark then light
     Error: Access denied to \"/tmp/yamt-compare/compare-dark.png\". See Vite config documentation for \"server.fs\" (compare.browser.test.ts:294 page.screenshot)
   × problems.browser.test.ts > a problem's tooltip inside will-change: transform wrappers shows its message on top of the panes
     Error: Access denied to \"/tmp/yamt-lsp-editor/problem-tooltip.png\" … server.fs (problems.browser.test.ts:158)
   × removals.browser.test.ts > hovering a bar shows its removed text above the panes; beside it none; applying its side closes it
     Error: Access denied to \"/tmp/yamt-removal-tooltip/removal-tooltip.png\" … server.fs (removals.browser.test.ts:129)
   × removals.browser.test.ts > a whitespace-only removal shows its whitespace as marks
     AssertionError: expected 'export const removedSetting = compute…' to be '→↵' (removals.browser.test.ts:154)
   × removals.browser.test.ts > a kept final line break draws its empty line, in the pane's code colour and ligatures
     expected `${LONG}` to be `${LONG}\n` (removals.browser.test.ts:171)" },
 { step: "real app: settings file with \"theme\": \"vscode\" (recipe 5)",
   excerpt: "Opens in yamt Dark: data-theme \"dark\", window rgb(39, 37, 46). No broken-settings report anywhere:
   settings.json on disk = {\"theme\":\"vscode\"}; after waiting 4 s,
   document.body.innerText.match(/settings file|error|vscode/gi) = null.
   The Settings screen's \"Settings file\" section reads only \"Use Default yamt reads this file again whenever its window gets focus.\"
   Seen in two sessions (v-th-bad, v-th-bad2); the v-th-bad3 restart on the same home (no --settings) showed the same.
   Shots: unknown-theme.png, unknown-theme-settings.png, unknown-theme-4s.png" },
 { step: "just mutants 17849b0 (recipe 2)",
   excerpt: "Survivors on the feature's lines that are not in #1593/#1608/#1609 — see smoke[1]" }
]

smoke: [
 { recipe: "1. just check", pass: true,
   observed: "Ran all 15 recipes through hooks-test without stopping; golden: ok for all 10 cases; map-check: ok;
   hooks-test: ℹ tests 16 ℹ pass 16 ℹ fail 0; wall time 38.37 s. (Output was piped to tail, so there is no exit-status line; just stops at the first failing recipe and hooks-test, the last one, ran.)" },

 { recipe: "2. just mutants 17849b0", pass: false,
   observed: "Exit 0.
   Rust: '3 mutants tested in 65s: 1 missed, 2 caught'.
     MISSED src-tauri/src/window.rs:142:5: replace background -> Color with Default::default().
     The function body was changed by 2070cfe (new theme arms), so it is on the feature's lines.
     #1593 is said to be covered by the theme check, but this mutant still survived (target/mutants/mutants.out/missed.txt).
   Stryker: All files 82.56 % (353 killed, 2 timeout, 60 survived, 15 no coverage).
     palette.ts 93.22, scripts/themes.ts 91.99, ipc/index.ts 0.00, ipc/themes.ts 34.85, settingsStore.ts 100.
   Survivors, grouped:
   • src/ipc/themes.ts:17–27 — 41 ObjectLiteral/StringLiteral mutants on the THEMES literal (group, label or kind emptied, or an entry set to {}). Known: #1609.
   • src/ipc/themes.ts:43:17 — .filter(isTheme) removed. Equivalent per ThemesCodeCorrect.
   • src/ipc/themes.ts:35:10 — `value !== undefined && isTheme(value)` becomes `true && isTheme(value)`. NOT in the triage notes I found.
   • scripts/themes.ts — 11 survivors (#1608 / ThemesPalettesR1Correct: 'the other ten … already triaged', plus 276:55 equivalent):
     66:33 `<` → `<=`; 69:29 index+1 → index-1; 87:85 []; 107:18 .trim() removed; 136:17 ?. twice; 136:42 find(()=>true); 199:58 []; 242:31 []; 276:55 \"\"; 289:47 {cwd} removed.
   • scripts/palette.ts:38:41 `>=` → `>` and 38:59 `<` → `<=`. NOT in the triage notes I found.
   • src/ipc/index.ts:88:16/54 — IN_APP mutants. That line dates from 5208140 (2026-10-10), not this feature: the feature only adds line 83 of that file.
   • No coverage: scripts/themes.ts 103, 119, 137, 226, 246 (the `?? \"\"` defaults); palette.ts 26, 59; index.ts 92." },

 { recipe: "3. pnpm -C frontend test:browser (WebKit, PLAYWRIGHT_BROWSERS_PATH=/tmp/th-code-pw)", pass: false,
   observed: "editor/themes.browser.test.ts, test by test:
   ✓ every theme's panel, gutter, code, syntax spans, band and word mark show the values in its CSS (1019 ms)
   ✓ yamt Dark and Light colour and style every probed word as before the 39-token table (235 ms)
   ✓ with the minimap shown, a switch between two dark themes repaints its code pixels (591 ms)
   engine.browser.test.ts ✓; strips 3/3 ✓.
   Failures in other files (full text in failures[0]):
   – compare/problems/removals — 3 `server.fs` refusals of screenshot paths. compare's failing test is 'the columns and the strip follow the theme, dark then light'.
   – removals — 2 tooltip-text assertions that ran after the removals screenshot failure.
   The run left an untracked frontend/.vitest/ (failure screenshots)." },

 { recipe: "4. WebKit fixture page (start-fixture 1600×1000; viewport 1600×964)", pass: "partial — see minimap",
   observed: "Theme choice: Settings → Theme shows 5 groups (yamt Dark/Light; WebStorm Islands Dark/Light; VS Code Dark 2026/Light 2026; Zed One Dark/One Light; Atom One Dark/One Light).
   After every click exactly one theme button had aria-pressed=true, across all groups.

   Colours: each value is shown as computed = file value.
   – TS file language-tools-script-setup.ts; probe words: keyword `if`, variable `ctx`, type `ScriptCodegenOptions`.
   – Vue file vue-core-playground-app.vue; probe words: `const`, `replRef`, `InstanceType`.
   – Every value matched its file in all 10 themes. Examples:
     · dark: window #27252e, panel #17161c, files #17161c, text #d6d4dd, keyword #e0986b, conflict band #905fe124 (both the strip path and the line); colorScheme dark.
     · light: window #e9eaee, panel #ffffff, keyword #0033b3, band #967bef6b; colorScheme light.
     · webstorm-dark: #26282c / #191a1c, variable #a9b7c6, band #2b2322.
     · vscode-dark: #191a1b / #121314; files #191a1b; type #4ec9b0. `if` = control-keyword #c586c0; `const` = definition-keyword #ff7b72; `replRef` = variable-definition #79c0ff.
     · zed-dark: #3b414d / #282c33 / #2f343e, keyword #b477cf, type #6eb4bf, band #74ade81a.
     · zed-light: window #dcdcdd, band #0588f080.
     · atom-dark: #21252b / #282c34, keyword #c678dd.
     · atom-light: #eaeaeb / #fafafa, keyword #a626a4.
   – Compare window (--diff-case typescript, which shows as 'Auto · Plain text', so it has no syntax spans): window, panel, tab list, text, code and the modified band all matched in all 10 themes.
   – Screenshots: ts-<theme>.png, vue-<theme>.png, compare-<theme>.png (30 shots).

   Shapes:
   – webstorm-dark: radius 10px, gap 5px, padding 5px, no border.
   – vscode-dark: radius 8px, gap 4px, 1px border rgb(42,43,44).
   – zed-dark: radius 0. File list at x −1…239, merge view at 238…1601, so their two 1px borders share one column (gapPx −1). The outer edges fall at −1, 1601 and 965 > 964, outside the viewport. #app overflow: clip.
   – atom-light: same geometry as zed-dark, border rgb(219,219,220).
   – Ctrl+B in zed-dark hid the file list; the merge view spans −1…1601 and scrollWidth stays 1600, so nothing is clipped (zed-dark-ctrl-b.png). A second Ctrl+B brought the list back.
   – Dragging the 'File list width' separator: 240 → +120 → 360 → −120 → 240.

   Minimap: NOT verified as written. The minimap shows only on the files screen (showsMinimap needs screen 'files'). With Alt held (raw WebDriver keyDown U+E00A) on the Settings screen, the .minimap container is display:none. I could not switch the theme by its button while the minimap was visible.
   What I did instead: held Alt on the files screen in dark → '264x1734 hash=1042941553 painted=10491'; released; Settings → Dark 2026 → Back; held Alt → '264x1736 hash=-638120025 painted=10491'. The minimap repaints, but the canvas height also changed by 2 px, so the hash difference is not a clean pixel comparison. Shots: minimap-dark.png, minimap-vscode-dark.png.

   Markdown: in the compare window, Markdown picked from the language menu (the first pick did not take; the label stayed 'Auto · Plain text', the second did). Typed `Some *emphasis with [a link](https://example.com) inside* here`.
   – dark: every span is italic, including `[`, `a link`, `]`, `(`, the URL and `)`, coloured rgb(166,137,241).
   – light: all italic, the link spans rgb(0,109,204) (markdown-light.png)." },

 { recipe: "5. Real app (cargo tauri build --debug --no-bundle → target/debug/yamt)", pass: false,
   observed: "Build: 'Finished `dev` profile … Built application at: …/target/debug/yamt'.

   No flash on start: app-session colours over 240 frames (frames 0–19 match no table colour).
   – zed-light: window #dcdcdd from frame 20. The other nine never appear, except #eaeaeb on 1–5 px in frames 34–239 (stray antialiased pixels).
   – vscode-dark: #191a1b from frame 20. All other nine 0 in every frame.
   – light: #e9eaee from frame 20. All other nine 0. Note: webstorm-light's window is also #e9eaee, so the video cannot tell those two apart.
   – Page reads: zed-light → rgb(220,220,221); vscode-dark → rgb(25,26,27).

   Old file: --settings {\"theme\":\"light\"} → data-theme 'light', window rgb(233,234,238) = #e9eaee.

   Switch everywhere:
   – Opened App.vue then vOn.ts; Settings → Atom 'One Dark' (nth 1) → data-theme atom-dark, window rgb(33,37,43).
   – All 9 editors (both opened files plus docs/removed.md) changed from code rgb(196,194,206) / panel rgb(23,22,28) to rgb(171,178,191) / rgb(40,44,52).
   – Display shots: switch-before.png, switch-settings-atom.png, switch-vOn-atom.png, switch-app-vue-atom.png. The display shots show atom-dark colours.
   – settings.json: {\"antialiasing\": \"subpixel\", \"theme\": \"atom-dark\"}.
   – Restart on the same home: data-theme atom-dark, rgb(33,37,43) (restart-atom-dark.png).

   Compare window follows: a --diff session on the same home opened in atom-dark. The merge window switched to Zed One Light. The compare window still read 'atom-dark' before focus. After focus-away ({focused: xmessage}) and focus-back it read 'zed-light', rgb(220,220,221) (compare-after-focus.png).

   Unknown 'vscode': opens in yamt Dark, but no broken-settings report (failures[1])." }
]
```

All sessions, drivers and dev servers I started are stopped. The only change in the repo is the untracked `frontend/.vitest/` folder of failure screenshots, created by `pnpm -C frontend test:browser`.