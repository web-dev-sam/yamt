# AltMarksVerify — final run (3.O, board "Change marks" row 4)

## Final run: change marks while Alt is held (`feat/change-marks-alt` @ `0a97a3b`)

**Overall:** the gate passes once the project-map patch is applied (`map-check` failed only as the brief predicted). Most smoke sub-steps match the brief. Three things need a decision:
- **5d:** the tick below a collapsed run sat lower with collapsing on, not higher as the brief expects.
- **5b doc-end:** the first two clicks on the same tick left that pane in the wrong place. Later clicks were correct.
- **Recipe 3:** WebKit could not launch.

I edited nothing in the repository.

**Environment (VF5):** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0. `test-screen` said "test windows go to Samsung (HDMI-A-1…)". The real-app sessions ran on private display `:2` and the timing runs on Xvfb `:93`.

```
gate: pass
```
(This counts `map-check` as the expected outcome the brief describes. Without the patch, `just check` exits non-zero.)

```
failures: []
```

**smoke:**

**1. gate** — pass
- `just check`: fmt-check, clippy, test, deny ("advisories ok, bans ok, licenses ok, sources ok"), bindings-check, fixtures-check, web-lint, web-typecheck, web-test ("Test Files 103 passed (103) / Tests 1389 passed (1389)"), web-unused and "arch-check: ok" all passed. It then stopped at `map-check`:
  ```
  map-check: missing:
    frontend/src/editor/internal/markJump.ts (not in .omp/skills/project-map/SKILL.md)
    frontend/src/editor/internal/markLanes.ts (not in .omp/skills/project-map/SKILL.md)
    frontend/src/ui/altHold.ts (not in .omp/skills/project-map/SKILL.md)
  ```
  These are exactly the three files the brief names.
- The remaining recipes, run one by one: `golden` exit 0, `sfc-order` exit 0, `hooks-test` "tests 16 / pass 16 / fail 0".
- In a scratch clone at `0a97a3b` with `project-map-3.O.patch` applied: "map-check: ok", exit 0.
- By mistake I also ran `map-check` once from the main checkout. It printed the same three files; nothing was written.

**2. `just mutants 407ec81`** — pass
- "mutants: no Rust changes since 407ec81".
- StrykerJS: `altHold.ts` 62 killed, 0 survived (100%). `useMergeController.ts` 69 killed, 14 survived, 1 error.
- The lines changed since `407ec81` in that file are 47, 143–157, 161, 181 and 189. None of the 14 survivors is on them. They are the older lines already listed in #1214:
  - 79:5, 80:5, 81:5, 82:5, 83:5: `x === null ||` → `false`
  - 89:5 ObjectLiteral → `{}`
  - 89:36 strips → `[]`
  - 104:25 `shallowRef(false)` → `true`
  - 133:29, 134:19, 135:11, 136:11: forwarders → `() => undefined`
  - 186:31 `flush: "post"` → `""`
  - 192:39 `() => null` → `() => undefined`
- All 14 are dropped as not on changed lines.

**3. `pnpm -C frontend test:browser`** — fail (cannot run here)
- "Error: browserType.launch: Host system is missing dependencies to run browsers. … sudo pnpm exec playwright install-deps". The WebKit probe did not run.

**4. WebKit fixture page** (dev server on 5274, `just webdriver 4446`, MiniBrowser at 1600×964 inner, file `language-tools-script-setup.ts`) — pass
- **a. Before Alt:** in all three panes the right-edge `elementFromPoint` is `cm-scroller`, and every lane is `hidden: true` with 0 ticks.
- **b. Alt held:** all lanes shown. Left has 4 ticks (modified ×3, conflict), centre 4 (same), right 1 (conflict). Scanning the tinted waiting changes gives 4 / 4 / 1. Screenshot: `fixture-alt-dark.png`.
- **c. Two files open, Alt held:**
  - Fresh page, file 2 opened without Alt, then Alt held: the hidden file's lanes are all hidden with 0 ticks; file 2 shows 4 / 5 / 4.
  - In an earlier order (Alt held on file 1, released, file 2 opened, Alt held again), file 1's lanes stayed hidden but kept their earlier 4 / 4 / 1 tick elements.
- **d. Colours:** every tick's computed background equals its token, in dark (e.g. conflict `rgb(129, 80, 190)` = `#8150be`, modified = `#43698d`, inserted = `#447152`) and in light (conflict `#c6bbf5`, modified `#b6d2f2`, inserted `#aadeaa`). Only those 3 kinds occur in the fixture, so the deleted, error, warning and info tokens were not exercised here. Screenshot: `fixture-alt-light.png`.
- **e. Hiding rules** (lanes listed as hidden, tick count): Alt held (False,4)(False,5)(False,4) → Alt+`a` all hidden, still hidden 1 s later with Alt down → keyUp hidden → keyDown shown → window `blur` hidden.

**5. Real app with xdotool** (sessions `b-verify-a`, `-end`, `-lsp`, `-eof`, `-light`)
- **a.** pass. Alt down: lanes 4 / 4 / 1 in three panes. Screenshot `app-5a-alt.png`. Collapsing is on by default, so the file is short; I turned it off (scrollHeight 12288) for 5b.
- **b. Far tick** — pass
  - A real click on the left conflict tick (y=630, change at line 363) gave scrollTops 6943 / 7048 / 7298. The change sits at 0.333 of the view height, has the `chunk-focus` outline and the keyboard, and nothing is selected. Values were unchanged 1 s later. Screenshot `app-5b-jump.png`.
  - keyup Alt, then Enter: the next Alt shows left 3 ticks with no conflict; centre still 4, right 1. Screenshot `app-5b-applied.png`.
- **b. Doc-end tick** (vue-router-playground-app, collapsing off) — **inconsistent**
  - Rounds 1–2: clicking the right pane's last tick (its conflict ends that side's document) gave right scrollTop 2105, then 0, stable 1 s later. Neither puts the change a third down.
  - Later rounds on the same tick: [3225, 3443, 3383]. The right pane is focused and outlined, first visible line 170, stable after 1 s.
  - The left pane's end tick: left 3225 = max, stable after 1 s; the other panes 2625.
  - #1216's "settled elsewhere" was not reproduced on the later rounds. The first two rounds came right after I set `scrollTop = 0` through JS, so I cannot say whether that caused them.
- **c. Result tick** — pass. Cursor on line 109 (the change's first line) at 0.335 of the view, Result focused, selection collapsed with 0 characters.
- **d. Collapse toggle with Alt held** — **does not match the brief**
  - Centre ticks with collapsing off: [217, 250, 259, 632 conflict]. With it on: [204, 428, 531, 798 conflict].
  - The conflict tick below the run sat **lower** with collapsing on. Lanes stayed shown.
- **e. Wheel** — pass. Pointer over the right conflict tick (`elementFromPoint` = `change-mark change-mark-conflict`), 3 wheel-downs: scrollTops [1704, 1765, 1765] → [1982, 2062, 2062].
- **f. Focus** — pass. Shown → `focus-away` hidden → `focus-back` hidden → keyup hidden → keydown shown.
- **g. Other key** — pass. `xdotool key Down` with Alt held hides the lanes.
- **h. Alt + press** — pass
  - Alt+click on Result text: document lengths unchanged [3427, 3463, 3502], summary still "3 changes · 1 conflict", caret moved with 0 characters selected, nothing applied.
  - Alt + press on the track at y=150 (`elementFromPoint` = `cm-scroller`): scrollTops [1982, 2062, 2062] → [0, 0, 0]. The same press without Alt does the same.
- **i. Thumb drag without Alt** — pass. Dragging 200 px: [0, 0, 0] → [2758, 2838, 2838], about 200 × 12808 / 903.
- **j. Problem ticks** — pass
  - With `c/src/main.c` and clangd, the problem sits in collapsed lines (only lines 1–7 visible). The error tick is `rgb(214, 77, 91)` = `#d64d5b`. Clicking it shows lines 1–11 with the cursor on `int count = "three";` and Result focused. Screenshot `app-5j-collapsed-problem.png`.
  - The `math.ts` problem was not in collapsed lines, so I didn't count it.
  - For the end-of-file case I built a scratch repo (`/tmp/yamt-b-ws/verify/eof`, `tail.ts` ending in `export function open() {` and a line break, tail collapsed). The oxlint error tick click shows lines 1–23 with the cursor on empty line 23, Result focused. Screenshot `app-5j-eof.png`.
- **k. Light theme** — pass. Every tick matches its light token. Screenshot `app-5k-light.png`.
  - `just app-session … --settings '{"theme":"light"}'` failed with "--settings is not JSON" because the quotes are lost through just. I ran it through `pnpm -C frontend exec tsx scripts/app-session.ts` instead.

**6. Scroll timing** — pass (frames over 20 ms, out of 200)
- On the first attempt the script failed because `[role=option]` was not found. It had picked up the owner's real settings (tree view) through the shared HOME. I verified the owner's `~/.config/yamt/settings.json` mtime is 20:51, before my runs.
- I re-ran with tauri-driver on an isolated HOME under `/tmp/yamt-b-ws/verify/home`, where the script runs as written.

| file / files opened / pane | base `407ec81` | HEAD | HEAD, Alt held |
|---|---|---|---|
| renderer.ts / 1 opened / middle | 12 | 9 | 6 |
| renderer.ts / 1 opened / left | 10 | 6 | 7 |
| renderer.ts / all opened / middle | 10 | 9 | 10 |
| renderer.ts / all opened / left | 13 | 8 | 8 |
| pnpm-lock.yaml / 1 opened / middle | 21 | 20 | 18 |
| pnpm-lock.yaml / 1 opened / left | 11 | 11 | 11 |
| pnpm-lock.yaml / all opened / middle | 21 | 19 | 19 |
| pnpm-lock.yaml / all opened / left | 11 | 11 | 11 |

Mean frame time is 16.5–16.8 ms in every row. A separate check confirmed Alt reached the app on `:93`: `xdotool keydown alt` turned the lanes from hidden to shown with 5 / 13 / 9 ticks.

**Cleanup:** all 5 app sessions report "stopped" with their temp folders removed. I stopped my dev server, the WebKit driver, Xvfb `:93` and both tauri-drivers. Still running and not mine: `target/debug/yamt --repo /tmp/yamt-conflict-project` and the `~/Projects/yamt` oxlint/oxfmt LSPs. `git status` in the main checkout is clean. Screenshots and scratch repos are under `/tmp/yamt-b-ws/verify/`.