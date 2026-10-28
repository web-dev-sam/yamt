# Final run — the range window collapses unchanged lines behind the wave, with the merge window's toggle

Board "Range collapse" row 5 (session 35). Rows 2–4 are committed and accepted (notes `.omp/run/notes/RangeFoldCore.md`,
`RangeCollapseToggle.md`, `RangeFoldColumns.md`). Rules: `docs/slices/request-range-collapse.md` (rules 1–8, acceptance)
and `docs/plan.md` §2 **#126** (read both whole). Read-only (VF6); you fix nothing (VF1); alone. **No mutation run**
(VF7, owner #1630): each patch had its own. Real-app sessions `v-rc-…`; scratch under `/tmp/yamt-rc/verify/`. The
owner's own yamt may be running: leave it alone; never `pkill`/`killall`. `pnpm -C frontend test:browser` cannot
launch Playwright's WebKit on this host (#1242): do not run it; MiniBrowser through `just webdriver` is the engine of
record (VF8).

Fixture facts: `?range=review` (generated from `scripts/range-repo.sh`, `main...feature`), `src/board/board.ts`:
differences start at left lines 19, 179, 199, 254, 308, 415, 461 (0-based; 20, 180, … as shown); left 20–178 is one
unchanged stretch; `&threads=seeded` puts a thread on left 100 / right 101.

## Recipes

1. `just check` from the main checkout at HEAD. Any failure is `gate: fail` with its first 30 relevant lines.
2. WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded`, MiniBrowser 1600×1000),
   `src/board/board.ts`, dark **and** light, the window focused:
   a. At open the unchanged stretches sit behind one wave across both columns and the strip (join ends at both
   columns' wave centres within 1 device px); the seeded thread shows with 4 lines on each side.
   b. Clicks on the left wave, the strip's wave, the right wave show 4 more, 8 more, then the rest, in both columns;
   the keyboard stays where it was; a press on a wave's gutter cell opens no thread draft.
   c. Hover on any part thickens the whole run's wave (1 → 2 px) in both columns and the strip, hand pointer.
   d. The header toggle: off shows every line, no wave; on after clicks resets to the start; the left column's top
   line stays on screen and the right lines up at once — from a shallow and a deep scroll; a cursor inside lines
   that get hidden lands on the wave line's start; `aria-pressed` follows; disabled on `public/logo.png`.
   e. A thread added on a shown unchanged line next to a wave, then off → on: shown with its 4 lines of context.
   f. Ctrl/Cmd+F to a word only in a hidden line shows it in both columns; select-all and Ctrl/Cmd+End reveal nothing.
   g. Previous/Next step through the 7 differences and change no wave.
   h. Toggle off, reload: the file opens with every line shown; the merge fixture page (`just app-session
      start-fixture`, same profile) shows its toggle unpressed; on there, reload the range page: collapsed.
3. Merge window, fixture page (`just app-session start-fixture`), dark and light, focused: waves across three panes and
   both strips, a click shows the next step, hover thickens the whole wave, the toolbar toggle off/on keeps the
   Result's top line with the sides lined up at once (shallow and deep scroll) — as before.
4. Compare window, fixture page (`?diff`): differences, strip bands, scrolling and editing as before; no wave anywhere.
5. Real app on a private X display (`cargo tauri build --debug --no-bundle`), repository from `scripts/range-repo.sh
   /tmp/yamt-rc/verify/repo`, `just app-session start-app --name v-rc --range main...feature --repo …`: 2a, 2b, 2d, 2f
   on `src/board/board.ts`, dark and light; toggle off, close (WM_DELETE_WINDOW), start again: still off; on again.
   Then the merge window on a `scripts/conflict-repo.sh` repository (`start-app --repo …`): its toggle shows the same
   stored choice.
6. Close (WM_DELETE_WINDOW) every app you started → exit status recorded.

## Report

`gate: pass|fail`, the `just check` result line, one observed value or screenshot path per step.
