# v0 — one verification run over everything since M1

Base: `030d2ff` (last verified state, end of M1). Everything after it is v0: 2.0 desktop shell, 2.X
git cross-check, 2.1 window reads git, 2.K keep work per file, 2.F file icons, 2.C choose a side
(Rust), 2.C' choice panel, 2.R release. None of it has been through `just check` yet.

## Recipes (read-only; fix nothing)

1. `just check` — the whole gate. Paste each step's tail and the exit status.
2. `just mutants 030d2ff` — cargo-mutants on Rust lines changed since the base, Stryker on the
   changed TypeScript. For every surviving mutant: file:line, the mutation, and whether it is
   equivalent (with the reason) or a real gap; name the owning piece of work from the board
   (`docs/slices/SLICES.md`, v0 table). Timeouts listed separately.
3. Desktop smoke through tauri-driver (recipe in `skill://verification` and below) on
   `scripts/conflict-repo.sh /tmp/yamt-verify-v0`:
   - Port 5173 free; `VITE_CHUNK_SOURCE=tauri pnpm -C frontend dev --port 5173 --strictPort`;
     `cargo build -p yamt-app`; `~/.cargo/bin/tauri-driver --port <p> --native-port <p2>`; session
     capabilities `{"tauri:options":{"application":"<repo>/target/debug/yamt","args":["--repo","/tmp/yamt-verify-v0"]}}`.
   - Resolve every file: text conflicts in the editor (apply sides, Mark resolved); the binary file
     with "Take left" or "Take right"; the file deleted on one side with "Keep" or "Delete".
   - Reset one resolved text file → its conflict is back (3 stages, markers); resolve it again.
   - Afterwards: `git -C /tmp/yamt-verify-v0 status --porcelain` shows no unmerged paths; one
     written text file equals what the middle pane showed (CRLF kept on the CRLF file).
   - Close the window with a KWin script calling `closeWindow()` (WebDriver's close leaves the app
     running without a page) → exit status 0.
   - A second run on a fresh repo: quit with files unresolved → exit status 1 and those files still
     unmerged as git left them.
4. Release build: `cargo tauri build` → paste the AppImage and `.deb` paths and sizes; both contain
   `LICENSE` and `THIRD_PARTY_LICENSES.txt`. `APPIMAGELAUNCHER_DISABLE=1` AppImage started with no
   arguments from inside a fresh `scripts/conflict-repo.sh` repo lists the 7 files. `grep` the built
   frontend (`frontend/dist`) for a fixture-only name (e.g. `nuxt-island-test`) → 0 hits.

Screenshots, if any, target the yamt window only — never "the active window". Stop every process
you started; remove the scratch repositories.

## Report

Output schema, every field; `gate: pass|fail` with the failing step named. Evidence goes verbatim.
