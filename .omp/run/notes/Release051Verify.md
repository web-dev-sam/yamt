Release 0.5.1 passes at HEAD `d652757`. The gate, the licence check, the deb bundle and all five release-binary recipes passed, and there were no failures. One oddity from the first app session is worth a look before tagging (end of the report).

**Environment (VF5):** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0. `dpkg-deb` is not installed here, so I read the .deb with `bsdtar`. Every app run used the release binary through a scratch exit-status wrapper (`/tmp/yamt-rel-0.5.1/yamt-wrap`), on the private display `:3`. Windows were closed with `WM_DELETE_WINDOW`, sent by a scratch ctypes/libX11 sender (`/tmp/yamt-rel-0.5.1/wmclose.py`).

```
gate: "pass"
failures: []
smoke: [
 { recipe: "1. just check", pass: true,
   observed: "EXIT=0 in 43.33 s; full log /tmp/yamt-rel-0.5.1/check.log. All 15 recipes ran.
   fmt-check/oxfmt: 'All matched files use the correct format. Finished in 913ms on 440 files'.
   clippy: 'Finished `dev` profile … in 2.28s', no warnings.
   test: 'Summary [ 7.503s] 684 tests run: 684 passed, 10 skipped'.
   deny: 'advisories ok, bans ok, licenses ok, sources ok' (warnings only: duplicates; proc-macro-error RUSTSEC-2024-0370 unmaintained).
   bindings-check, fixtures-check: diffs empty.
   web-test: 'Test Files 151 passed (151) / Tests 1974 passed (1974)'.
   arch-check: ok; map-check: ok.
   golden: ok for all 10 cases.
   sfc-order: silent.
   hooks-test: 'ℹ tests 16 ℹ pass 16 ℹ fail 0'." },

 { recipe: "2. Licences", pass: true,
   observed: "'third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (744605 bytes)'; git diff --exit-code → EXIT=0.
   Order in the file: 16377 '---- Visual Studio Code minimap (MIT) ----', then 16404 VS Code theme colours (MIT), 16410 Atom One Dark and One Light theme colours (MIT), 16437 Zed One Dark and One Light theme colours (MIT), 16462 WebStorm Islands Dark and Islands Light theme colours (Apache-2.0)." },

 { recipe: "3. Bundle", pass: true,
   observed: "cargo tauri build --bundles deb EXIT=0: 'Bundling yamt_0.5.1_amd64.deb … (5.23 MiB)'.
   Data files: usr/bin/yamt (the only file in usr/bin), usr/lib/yamt/{THIRD_PARTY_LICENSES.txt, LICENSE}, the .desktop file and three icons.
   The bundled THIRD_PARTY_LICENSES.txt equals the repository's (cmp → CMP_OK).
   target/release/yamt --version → 'yamt 0.5.1'." },

 { recipe: "4.1 Conflict project", pass: true,
   observed: "The sidebar listed the 7 files: assets/logo.bin, docs/removed.md, notes/crlf.txt, …/App.vue, …/vOn.ts, …/PersistQueryClientProvider.tsx, src/added.ts. ls-files -u listed the same 7.
   Opened vOn.ts ('2 changes · 1 conflict') and clicked Mark resolved. The 'Unprocessed Changes' question appeared; I answered Save Current Result.
   After that, ls-files -u no longer lists vOn.ts (stage 0, a1631e1…), the list shows 'vOn.ts resolved', and the next unresolved file, PersistQueryClientProvider.tsx, is selected.
   WM close → wrapper 'exit=1', stderr 'yamt: 6 of 7 files still unresolved'.
   Shots: shots/merge-vOn-open.png, merge-after-mark.png, merge-after-resolved.png." },

 { recipe: "4.2 Themes", pass: true,
   observed: "Settings → Theme shows five groups: yamt Dark/Light, WebStorm Islands Dark/Islands Light, VS Code Dark 2026/Light 2026, Zed One Dark/One Light, Atom One Dark/One Light.
   Each pick gave data-theme, then --color-window, then the html background:
   - dark #27252e rgb(39,37,46)
   - light #e9eaee rgb(233,234,238)
   - webstorm-dark #26282c rgb(38,40,44)
   - webstorm-light #e9eaee rgb(233,234,238)
   - vscode-dark #191a1b rgb(25,26,27)
   - vscode-light #fafafd rgb(250,250,253)
   - zed-dark #3b414d rgb(59,65,77)
   - zed-light #dcdcdd rgb(220,220,221)
   - atom-dark #21252b rgb(33,37,43)
   - atom-light #eaeaeb rgb(234,234,235)
   All ten equal style.css / themes/<name>.css.
   Display shots (shot --display, display-<theme>.png): the pixel at x=1598 is the window colour for dark, light, webstorm-* and vscode-*. For zed-* and atom-* it is the panel colour, because the panels reach the window edge.
   These shots show the page painting over the window. They do not show the native background behind it; 4.3's startup video covers that.
   Conflict shots (PersistQueryClientProvider.tsx): shots/conflict-webstorm-dark.png, conflict-vscode-light.png, conflict-zed-dark.png, conflict-atom-light.png." },

 { recipe: "4.3 Start without a flash", pass: true,
   observed: "Started with --settings {\"theme\":\"vscode-light\"} and a 4 s recording (240 frames, 1600x1000), then ran app-session colours with the nine other window colours plus fafafd. Each of the nine was 0 pixels in every frame range (0-18, 19-30, 31-35, 36-239). fafafd showed 0 in frames 0-18, then 1599824 px in 19-30.
   The page read vscode-light rgb(250,250,253).
   Settings file left by the last pick in 4.2: {\"antialiasing\":\"subpixel\",\"theme\":\"atom-light\"}. Restarting on the same home with no --settings opened atom-light rgb(234,234,235) (shots/restart-atom-light.png).
   Video: /tmp/yamt-rel-0.5.1/flash-vscode-light.mkv." },

 { recipe: "4.4 Compare window", pass: true,
   observed: "--diff with a home whose settings say 'theme':'zed-dark' → title 'Compare — yamt', data-theme zed-dark rgb(59,65,77).
   Typed {\"name\":\"yamt\",\"version\":\"0.5.0\",\"themes\":10} on the left and the same with 0.5.1 on the right. The language became 'Auto · JSON'. The differing character (0/1) is marked in both columns.
   Format (button title 'Format both columns as JSON') laid both out on 5 lines; line 3, the version line, is highlighted on both sides.
   WM_DELETE_WINDOW → wrapper 'exit=0'.
   Shots: compare-zed-dark-typed.png, compare-zed-dark-formatted.png." },

 { recipe: "4.5 No leftovers", pass: true,
   observed: "Every stop reported tauri-driver/xvfb 'stopped' (ffmpeg 'gone' after the recording).
   pgrep -af 'yamt-rel|yamt-app-session|target/release/yamt|tauri-driver|WebKitWebDriver|Xvfb' matched nothing (exit 1).
   /tmp/yamt-rel-merge was removed. /tmp/yamt-rel-0.5.1/ is kept (screenshots, video, logs, the scratch wrapper and the close sender).
   Exit log: 1, 1, 1 (merge sessions, files still open), 0 (--diff)." }
]
```

**The oddity:** in the first session, my first `WM_DELETE_WINDOW` went to a short-lived extra window (0x201921) instead of the main one. That window was gone afterwards and the app stayed open. When I then closed the main window, stderr showed six lines of `(yamt:79260): Gtk-CRITICAL **: gtk_widget_get_visible: assertion 'GTK_IS_WIDGET (widget)' failed`. The exit status was still the expected 1 with the expected message. None of the three later sessions logged a Gtk-CRITICAL.

I left the main checkout clean (`git status --short` is empty) and all screenshots are in `/tmp/yamt-rel-0.5.1/shots/`.