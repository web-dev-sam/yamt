The final check passed: the gate, every recipe in the brief, `readmer check` and the screenshot size. Two things differ from the notes, though neither is a failure: board.ts opens with 12 changes, not 10 (step 4a), and mutation testing had nothing to mutate.

```
gate        "pass"
failures    []
smoke       see below
```

**1. Gate.** `just check` at `6bbf865` ran once and exited 0 (log in `/tmp/yamt-d-verify/check.log`):
- nextest: `Summary [5.071s] 473 tests run: 473 passed, 1 skipped`
- cargo deny: warnings only (duplicate crates, and RUSTSEC-2024-0370 because proc-macro-error is unmaintained).
- vitest: `Test Files 109 passed (109)`, `Tests 1445 passed (1445)`
- hooks-test: `ℹ tests 16 … pass 16 fail 0`

**Mutants.** I ran `just mutants 4ae24d4`, the commit before `bafe527`, and it exited 0:
```
mutants: no Rust changes since 4ae24d4
mutants: no TypeScript changes since 4ae24d4
```
So there are no survivors. The feature's `.ts` files are under `scripts/demo/` and were not mutated.

**2. Button commands** — pass. I used `/tmp/yamt-d-verify/cp` in place of `/tmp/yamt-conflict-project`.
- `scripts/demo-repo.sh /tmp/yamt-d-verify/cp` succeeded and printed:
  - `lsp-servers: typescript-language-server 6.0.2`
  - `lsp-servers: launch yamt with PATH=/home/wds/.cache/yamt/servers-path:$PATH`
  - `demo-repo: … is mid-merge (main merging feature/reminders); conflicted files:` followed by `docs/shortcuts.md public/logo.png src/api/client.ts src/api/mockBoards.ts src/board/board.ts src/board/card.ts src/ui/cardView.ts`
- I didn't see that call's exit code directly: the hook blocked my `; echo` chain, and the tool returned no error. The make-if-missing run below printed `missing-exit=0`.
- `git ls-files -u` lists stages 1/2/3 for those 7 paths; `mockBoards.ts` has only stages 1 and 2.
- Running it again into the same folder printed `demo-repo: refusing to overwrite /tmp/yamt-d-verify/cp: it exists and is not empty` and exited 1.
- The "make it if missing" part, which is the same in the yamt and WebStorm tasks:
  - on an existing folder: `existing-exit=0`, nothing built;
  - on a missing folder (`/tmp/yamt-d-verify/missing`): it built the repo, printed the same 7 paths and `missing-exit=0`.
- `scripts/lsp-servers.sh --path` printed `/home/wds/.cache/yamt/servers-path`.

**3. Other repo scripts** — pass.
- `scripts/conflict-repo.sh` exited 0 and printed 7 paths: `assets/logo.bin docs/removed.md notes/crlf.txt packages/compiler-core/src/transforms/vOn.ts packages-private/sfc-playground/src/App.vue packages/react-query-persist-client/src/PersistQueryClientProvider.tsx src/added.ts`. That matches its header: three goldens, CRLF, add/add, binary, delete.
- `scripts/lsp-repo.sh --servers` exited 0, printed the server version line, and listed 9 paths: `biome/src/index.js c/src/main.c go/calc/calc.go php/src/Stats.php py/api/stats.py rs/core/src/lib.rs web/src/App.vue web/src/greet.ts web/src/math.ts`. That matches its header: one per project, three in web/.

**4. Real app** — pass. I used `target/release/yamt` (built 16:32, after the last product commit at 16:30), with the servers path first on PATH and session `d-app` on private display `:2`, size 1600×1000. Clicks, hover and Alt went through WebDriver pointer and key actions; scrolling used `app-session scroll`.
- **a.**
  - The start question read "Start this project's language servers? • oxfmt, oxlint, TypeScript — the repository root" (`a1-start.png`).
  - After Start, all three servers showed green. "View as tree" showed docs/shortcuts.md, public/logo.png, src/api/{client,mockBoards}.ts, src/board/{board,card}.ts and src/ui/cardView.ts.
  - board.ts opened with "12 changes · 1 conflict", 0 errors and 0 warnings (`a2-board.png`).
- **b.**
  - Applying the lanes section (Local line 164 ») gave "11 changes", 1 error and 0 warnings.
  - Applying the `terms` line (Local line 452 ») gave "10 changes", 1 error and 1 warning (`b2-terms.png`).
  - Hovering `card.dueDate` at Result line 204 showed a tooltip reading `Property 'dueDate' does not exist on type 'Card'. Did you mean 'dueAt'?\nTypeScript 2551`.
  - With Alt held, the minimap showed at the right edge, with a red mark and a yellow mark on its left edge and blue and green change marks on its right edge. The tooltip was still shown, and reading it again gave the same text. Screenshot: `/tmp/yamt-d-verify/b5-alt-tooltip.png`.
- **c.**
  - logo.png showed "A binary file, 2.5 KB. Take left" against "A binary file, 3.5 KB. Take right", and the Result said "Take the left or the right version." (`c1-logo.png`).
  - mockBoards.ts showed a **Keep** button on Local, and the Remote pane read "Deleted in this branch." with a **Delete** button (`c2-mockboards.png`).
- **d.** `stop` reported tauri-driver and Xvfb stopped and the session folder removed. A `pgrep -af` for the binary, tauri-driver, Xvfb and the three servers then found only PIDs 33199 (`oxlint --lsp`) and 33240 (`oxfmt --lsp`). Both run from the main checkout's frontend and were already running before this run, per `DemoRepoR1.md`.

**5. README** — pass. `readmer check` exited 0, and `docs/screenshot.png` is `PNG image data, 3200 x 2000`.

**Environment**
- Toolchain: `rustc 1.99.0 (b940084d7 2026-09-28)`, node `v24.22.0`, pnpm `12.0.0`.
- WebKit: tauri-driver with Xvfb on the private display worked.
- The owner's folders have the same fingerprints before and after: `~/.config/yamt` 2832ebd853d0, `~/.local/share/dev.yamt.merge` 8f0936431752, `~/.cache/dev.yamt.merge` e3b0c44298fc, `~/go/bin` 1c0954a38809, `~/.cargo/bin` 54025059ac52, `~/.local/bin` 39f6f197f593.
- `/tmp/yamt-conflict-project` was last modified at 16:22, before this run. `git status` is clean.

All screenshots and scratch repos are in `/tmp/yamt-d-verify/`.