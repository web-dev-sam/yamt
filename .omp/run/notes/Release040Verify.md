The gate passes, and all four recipes pass: licences, bundle, and the release binary's conflict project, minimap, Abort merge and language servers. I fixed nothing and re-ran no failing step.

```
gate: pass
failures: []
```

**Environment (VF5)**
- HEAD `b19f48f`. The tree was clean before and after the run (`git status --short` printed 0 lines).
- Toolchain: rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0.
- WebKit: the real app ran through the `app-session` helper on its private Xvfb `:2` at device ratio 1. No MiniBrowser or fixture page was used.
- There is no `dpkg-deb` here, so I opened the package with `bsdtar`.
- The owner's `target/debug/yamt` was not running during this run, so nothing of theirs was touched.
- The helper kept its settings and window storage in its own temp folders, `/tmp/yamt-app-session-r-{merge,abort,lsp}-*/home/.config`. `stop` removed each one.
- I fingerprinted `~/.config/yamt`, `~/.local/share/dev.yamt*`, `~/go/bin`, `~/.cargo/bin` and `~/.local/bin` (file paths, sizes, change times). The fingerprint was `834f631b…` before and after. `~/.local/share/yamt` does not exist.

### smoke

**1. `just check`: pass.** Exit 0, wall time 32.9 s.
- deny: `advisories ok, bans ok, licenses ok, sources ok`.
- The bindings and fixtures diffs were empty.
- web-test: `Test Files 109 passed (109)`, `Tests 1445 passed (1445)`.
- `arch-check: ok`, `map-check: ok`, golden: all 10 `ok`, hooks-test `pass 16`, `fail 0`.
- The nextest summary line was above the 80-line tail I captured, so I cannot quote the Rust test count. No step failed: the exit status of 0 covers it.

**2. Licences: pass.**
- Output: `third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (740867 bytes)`.
- `git diff --exit-code` returned 0.
- Line 16375 reads `==== Copied code (1) ====`, followed by `---- Visual Studio Code minimap (MIT) ----`. It names `microsoft/vscode 789f2c470d13c4760f2b5cc6a9e1919c05d04f7d` and quotes the MIT text ("Copyright (c) 2015 - present Microsoft Corporation / Permission is hereby granted…").

**3. Bundle: pass.**
- The build printed `Bundling yamt_0.4.0_amd64.deb … Finished 1 bundle … (4.96 MiB)`, exit 0.
- `usr/bin` holds only `yamt`.
- The package also has `usr/lib/yamt/{LICENSE,THIRD_PARTY_LICENSES.txt}`, a `.desktop` file and three icons.
- `cmp` with the repository's `THIRD_PARTY_LICENSES.txt` found no difference.
- `target/release/yamt --version` printed `yamt 0.4.0`.

**4.1 Conflict project: pass.**
- The file list showed all 7 files: `assets/logo.bin`, `docs/removed.md`, `notes/crlf.txt`, `…/App.vue`, `…/vOn.ts`, `…/PersistQueryClientProvider.tsx`, `src/added.ts`.
- `vOn.ts` opened with 3 panes, `2 changes · 1 conflict`, and bands between the panes.
- I clicked "Mark resolved" on App.vue rather than vOn.ts, to keep vOn.ts unresolved for the minimap step. The "Unprocessed Changes" question appeared and I chose "Save Current Result".
- Then `ls-files -u` no longer lists App.vue, `status` shows `M  …/App.vue`, the list shows "App.vue ✓ resolved", and vOn.ts (the next unresolved file) opened.
- Dark theme: `/tmp/yamt-rel-0.4.0/1-after-mark-resolved-dark.png`, plus `merge-vOn-dark.png` and `after-mark.png`.

**4.2 Minimap: pass.**
- Collapsing off: `aria-pressed="false"`.
- After `xdotool keydown alt`, the minimap was `block` at x 1458–1591, y 88.5–991. The right pane is 1172–1591, so the minimap is at the window's right edge over that pane.
- The three pane rectangles were the same as before Alt.
- Screenshot: `2-minimap-alt-held.png`.
- With Alt still held I clicked the minimap at (1520, 390), which is row 151. `centredScrollTop` is 4 + 150×20 − 903/2 = 2552.5. Scroll positions as [left, Result, right]:

| when | scrollTop |
|---|---|
| first frame | [0, 2552, 0] |
| after 2 frames | [2552, 2552, 2492] |
| after 1 s | [2552, 2552, 2492] |

- On `keyup alt` the minimap went back to `none`.

**4.3 Abort merge: pass.**
- To capture the exit status and stderr, I started a wrapper script, `/tmp/yamt-rel-0.4.0/yamt-wrap.sh`. It runs `target/release/yamt "$@"` and saves both.
- With fresh storage, the toolbar had no Abort merge button.
- Right-clicking the toolbar listed 8 entries. "Abort merge" was first with `aria-checked=false`, then Previous, Next, Collapse, Apply left, Apply right, Undo, Redo.
- After I chose it, the toolbar read `Mark resolved, Abort merge, Previous change`.
- I marked App.vue resolved (status `M  …/App.vue`), then clicked Abort merge. The question "Abort Merge — Every resolution and every save in this merge will be lost…" appeared, and I chose "Abort Merge".
- The window closed with no unsaved-work question. The helper printed `Session terminated without a reply`, because the app had gone.
- Exit status `1`. The last stderr line is `yamt: merge aborted`.
- `git status --short --untracked-files=all` printed 0 lines, so there were no untracked files either, and `.git/MERGE_HEAD` is absent.
- Screenshots: `3-toolbar-menu.png`, `3-abort-button.png`, `3-abort-question.png`.

**4.4 Language servers: pass.**
- I started the app with `PATH=/home/wds/.cache/yamt/servers-path:$PATH RUSTUP_HOME=/home/wds/.rustup CARGO_HOME=/home/wds/.cargo`.
- The start question listed Biome, clangd, gopls, Phpactor, ruff, ty, basedpyright, rust-analyzer, oxfmt, oxlint and TypeScript (`4-lsp-start-question.png`).
- Hover in lib.rs line 8, after turning collapsing off (`4-hover-rust.png`): "expected 2 arguments, found 1 / rust-analyzer E0061".
- Hover on `count` in App.vue (`4-hover-vue.png`): "Type 'string' is not assignable to type 'number'. / TypeScript 2322".
- Ctrl+S (xdotool) in `stats.py` formatted `totals={"a":1,"b":2}` to `totals = {"a": 1, "b": 2}`. The file on disk kept `<<<<<<< HEAD` / `=======` / `>>>>>>> remote`, and `ls-files -u` still lists stages 1, 2 and 3.

**4.5 No leftovers: pass.**
- All three sessions stopped: tauri-driver and Xvfb `stopped`, temp folders removed.
- `pgrep -af` for the release binary, every preset program, tauri-driver, Xvfb and WebKitWebDriver found nothing from this run. It showed only processes that were already running before I started: pids 33199/33240 (oxlint and oxfmt `--lsp`, seen at the start) and 33459/33865/33866 (rust-analyzer and its proc-macro servers, from VS Code and `~/.rustup`).
- I removed `/tmp/yamt-rel-merge`, `/tmp/yamt-rel-abort` and `/tmp/yamt-rel-lsp`.
- Left in place: the screenshots folder `/tmp/yamt-rel-0.4.0/`, which also holds the extracted package under `deb/`, the wrapper script and the abort exit and stderr files. The helper's own state folder `/tmp/yamt-app-session` also remains.

All screenshots are in `/tmp/yamt-rel-0.4.0/`.