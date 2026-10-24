# Release 0.5.1 — final run before tagging

Board "Release 0.5.1" row 2. Owner request #1621 ("release 0.5.1"): `feat/themes` merged into `main` (`732b709`, a
merge commit; the tree equals the branch head `f959b38`), then two commits that change no product code: `e45c6cd`
names the four editors whose theme colours yamt copies in `THIRD_PARTY_NOTICES.md` and, with their licence texts, in
`scripts/third-party-licenses.sh` (#1620; `THIRD_PARTY_LICENSES.txt` regenerated), and the release commit: the
workspace version is `0.5.1` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.5.1] - 2026-10-24`, the README
names the 0.5.1 files (`readmer check` passes). Since 0.5.0 the product gained eight editor themes (plan §2 #102);
their final run passed at `a44e0f0` with a debug build (`.omp/run/notes/ThemesVerify.md`). This run checks the
release build. No mutation run here (the feature's is in its notes). Read-only recipes only (VF6); you fix nothing
(VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.5.1/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.5.1/home-<n>` on every `start-app`
(the owner's own settings and compare tabs stay untouched). The owner's own yamt may be running: leave it alone; never
`pkill`/`killall` (finding #1560). Every launch on a private display. Record yamt's exit status with a wrapper around
the binary, as the earlier final runs did; close windows with `WM_DELETE_WINDOW`, not WebDriver (#1447).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff; the file has the four "theme colours" entries after the
   minimap's.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.5.1_amd64.deb` exists; its
   contents list `usr/bin/yamt` as the only program in `usr/bin` and carry `THIRD_PARTY_LICENSES.txt` equal to the
   repository's; `target/release/yamt --version` prints `yamt 0.5.1`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper (`start-app
   --name <n> --binary target/release/yamt … --home <home>`):
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`: the 7 files listed; open a text conflict;
      Mark resolved stages it (`git -C … ls-files -u` no longer lists it) and opens the next unresolved file.
   2. **Themes:** Settings → Theme shows five groups (yamt, WebStorm, VS Code, Zed, Atom), each Dark and Light. Pick
      each of the ten once: `data-theme` is its name and the window colour equals `--color-window` of its file
      (`frontend/src/style.css` `@theme` for `dark`, `frontend/src/themes/<name>.css` for the others); the native
      background behind the page follows (`shot --display`). One screenshot of a text conflict per editor family,
      in `webstorm-dark`, `vscode-light`, `zed-dark` and `atom-light`.
   3. **Start in a theme without a flash:** with `--settings '{"theme":"vscode-light"}' --record <f>.mkv
      --record-seconds 4`, then `app-session colours <f>.mkv` with the other nine window colours (table in
      `docs/slices/briefs/3.TH-themes-rust.md`): none appears as a frame. The settings file written by a pick in 4.2,
      on restart with the same home, opens in that theme.
   4. **Compare window:** `--diff` with a home whose settings say `"theme": "zed-dark"`: it opens in Zed One Dark;
      type two JSON texts that differ in one value → the difference shows in both columns; Format → both laid out;
      close with `WM_DELETE_WINDOW` → exit 0.
   5. **No leftovers:** after `stop`, no yamt, Xvfb or driver from this run (`pgrep -af` by this run's paths). Remove
      `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
