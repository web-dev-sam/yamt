# Release060Verify

Agent output (`agent://Release060Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/Release060Verify.md), collected 2026-10-30T17:13:53.400Z.

**gate:** `pass`. `just check` exited 0 (EXIT=0 in 54.39 s). One brief recipe, the `dpkg-deb` checks in recipe 3, could not run because the tool isn't installed here. All the other recipes passed.

**failures**
- step: `3 Bundle — dpkg-deb -f <deb> Version`, `dpkg-deb -c <deb>`
  excerpt: `error: command not found: dpkg-deb` (printed three times). I ran the same checks a different way, read-only, using `bsdtar` on the `.deb`: Version `0.6.0`, only `usr/bin/yamt` in `usr/bin`, and the licence file is identical. That substitute is not the brief's command.

**smoke**

1. **`just check`** — pass
   - Last lines: `map-check: ok`; golden 10/10 `ok`; sfc-order ran; hooks-test `ℹ tests 17 ℹ pass 17 ℹ fail 0`.

2. **`readmer check`** — pass
   - `READMER=0`.

3. **Licences** — pass
   - `scripts/third-party-licenses.sh` → `TPL=0`.
   - `git diff --exit-code THIRD_PARTY_LICENSES.txt` → `DIFF=0`, no diff.

4. **Bundle** — partial (`dpkg-deb` missing)
   - `cargo tauri build --bundles deb` → `B=0`, `Bundling yamt_0.6.0_amd64.deb … Finished 1 bundle`.
   - The `.deb` exists: `5988306 bytes`, `Oct 30 18:08`.
   - Via `bsdtar`: `Version: 0.6.0`; data contains `usr/bin/yamt` and `usr/lib/yamt/THIRD_PARTY_LICENSES.txt`; `ls usr/bin` shows `yamt` only; `cmp` against the repository's file → `CMP=0`.
   - `target/release/yamt --version` → `yamt 0.6.0`.

5. **4.1 Merge, release binary** — pass
   - `conflict-repo.sh` gave 7 conflicted files; the sidebar listed the same 7.
   - Opened `packages/compiler-core/src/transforms/vOn.ts`. Ctrl+Shift+S with "handler" → `14 results in 1 file`, one row per match.
   - Clicked the row `Result, line 17` → the selection is `"HANDLER"` and focus is in `cm-content`.
   - Mark resolved → "Unprocessed Changes" dialog → Save Current Result. `ls-files -u` no longer lists vOn.ts, and status shows `M  packages/compiler-core/src/transforms/vOn.ts`.
   - Driving mistake on my side: a Ctrl+A plus typing went into the Result while the search panel was toggled shut. I undid it with Reset before searching. Screenshots: `/tmp/yamt-rel-0.6.0/{search2,row,mark}.png`.

6. **4.2 Range `main...feature --glab lined-up`** — pass
   - Tree view shows folder sums, e.g. `src +55 −64`, `board +55 −21`, `docs +4 −1`.
   - In board.ts, unchanged lines sit behind waves.
   - Clicked a line number → "Write a comment…" → typed a note → Ctrl+Enter → Post → Queue → `Send to GitLab (1)` → `1 sent, 0 refused`, "Pending on GitLab".
   - The fake glab's `calls.log` has one `POST projects/7/merge_requests/12/draft_notes` with `stdin: {"note":"Release 0.6.0 check note",…"new_line":23,"new_path":"src/board/bo…`. The note is on line 23 because my click landed on that row of the gutter.
   - Relaunched with a scratch wrapper that records the exit status, closed with `WM_DELETE_WINDOW` → `0 --diff=main...feature --repo /tmp/yamt-rel60-range`.
   - Screenshots: `/tmp/yamt-rel-0.6.0/{tree,board}.png`.

7. **4.3 `--diff`** — pass
   - Left `{"name": "yamt", "version": "0.5.0"}`, right `… "0.6.0"}`; mode auto-detected as `Auto · JSON`.
   - Only the `5` and `6` are highlighted, one in each column.
   - `WM_DELETE_WINDOW` → `0 --diff`. Screenshot: `/tmp/yamt-rel-0.6.0/diff1.png`.

8. **4.4 Cleanup** — pass
   - Each `stop` reported tauri-driver and Xvfb `stopped` and its folder removed.
   - Afterwards `pgrep -af 'yamt|Xvfb|tauri-driver|WebKitWebDriver|dbus-daemon'` printed nothing.
   - `/tmp/yamt-rel60-*` removed; repository `git status --short` shows 0 lines.

**Notes**
- No mutation run (VF7).
- The merge window's exit status was not captured: it ran without the wrapper, and the brief doesn't ask for it.
- `plugin:window|close` from the page is refused (`not allowed by ACL`), so the windows were closed with a scratch Xlib `WM_DELETE_WINDOW` sender. It and the wrapper are under `/tmp/yamt-rel-0.6.0/`.
- **Environment:** HEAD `ec5c914` (release commit `8ece003`), clean tree; rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0. WebKit came from tauri-driver plus the release binary on a private Xvfb display `:3`, with no window manager. `dpkg-deb` is not installed.
