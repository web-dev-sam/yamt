# Release 0.3.0 — final run before tagging

Board "Release 0.3.0" row 3. Owner request #986: release 0.3.0. The release commit changes no product code: the
workspace version is `0.3.0` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.3.0] - 2026-10-14`, the README is
regenerated from `.readmer/readme.json`, and `docs/screenshot.png` is new. `crates/`, `frontend/`, `src-tauri/` are
unchanged since `2ed501d`, which the last final run checked (`.omp/run/notes/LspVerify.md`, `just mutants 16bc7f8`
included), so no mutation run this time. The `--version` test reads `CARGO_PKG_VERSION`. Read-only recipes only
(VF6); you fix nothing (VF1).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.3.0_amd64.deb` exists (the
   README's install command uses that name); `dpkg -c` on it lists `usr/bin/yamt` as the only program in `usr/bin`;
   `target/release/yamt --version` prints `yamt 0.3.0`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper
   (`pnpm -s -C frontend exec tsx scripts/app-session.ts <command> …`; `just app-session` breaks on JS parentheses):
   `start-app --name <n> --binary target/release/yamt --repo <dir> [--settings <json>]`. Real input only. The owner's
   own settings file (`~/.config/yamt/`) must stay untouched: say where the helper kept its settings.
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`. The file list shows the 7 files; open a
      text conflict: three panes with the changes; "Mark resolved" stages it (`git -C /tmp/yamt-rel-merge ls-files -u`
      no longer lists it) and opens the next unresolved file.
   2. **Language servers:** `XDG_CONFIG_HOME=/tmp/yamt-rel-config scripts/lsp-repo.sh --servers /tmp/yamt-rel-lsp`
      (the flag adds ruff to the settings file under that folder; the first run may download
      typescript-language-server and ruff into `~/.cache/yamt`), then start with `--settings "$(jq -c .
      /tmp/yamt-rel-config/yamt/settings.json)"`. Pass:
      - the start question lists "oxfmt, oxlint, TypeScript — web/" and "ruff — added by you"; after Start, all four
        show a running dot left of the gear;
      - `web/src/math.ts`: underlines on `debugger;` and `count`, the counts read 2 errors; hover on `count` shows
        TypeScript's message;
      - `api/stats.py`: `os` underlined, 1 warning;
      - Ctrl+S in each: `spaced` becomes `export const spaced = { a: 1, b: 2 };`, `totals` becomes
        `totals = {"a": 1, "b": 2}`; both files keep git's conflict markers on disk and stay in `git ls-files -u`.
   3. **No leftovers:** after `stop`, `pgrep -af "oxlint --lsp|oxfmt --lsp|typescript-language-server|ruff server|
      target/release/yamt"` finds nothing from this run. Remove `/tmp/yamt-rel-*`.

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
