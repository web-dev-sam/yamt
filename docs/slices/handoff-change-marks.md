# Handoff — change marks while Alt is held (session 20, branch `feat/change-marks-alt`)

Board: `docs/slices/SLICES.md` section "Change marks" (rows 1–4). Rule: `docs/plan.md` §2 #80. Findings #1200–#1222 in
`.omp/run/findings.jsonl`. Notes per agent in `.omp/run/notes/AltMarks*.md`. Not pushed.

## State

- Product code: `e5cd4cf` (the Alt hold), `502e997` (marks and jump), `3615586` and `52a0121` (two review rounds).
- Final run at `0a97a3b`: the full check passes once the project-map lines below are in; without them `map-check`
  names exactly `ui/altHold.ts`, `editor/internal/markJump.ts`, `editor/internal/markLanes.ts`. Mutation runs: nothing
  left on changed lines. Scroll timing no slower (base 10–21 late frames of 200, HEAD 6–20, HEAD with Alt held 6–19).

## Suggested `.omp/` changes (owner asked for none this session; apply or reject)

1. **Project map** (needed for `just check`): `.omp/run/handoff/project-map-3.O.patch` — `git apply` it. Adds the
   `marks`/`markLanes`/`markJump` and `altHold.ts` lines, `showMarks`/`marks` on the editor's surface, and two
   state-ownership rows. Checked: `map-check: ok` in a clone with the patch.
2. **Browser tests** (verification skill): Playwright WebKit cannot launch on this machine and CI does not run
   `test:browser` (#1074, #1222), so a `*.browser.test.ts` proves nothing anywhere. Suggest a line: "no new
   `*.browser.test.ts` until `test:browser` runs here or in CI; WebKit proof is MiniBrowser through `just webdriver`."
   This feature followed it.
3. **Holding a key in smoke steps** (verification skill, `app-session`): every build needed Alt held without release;
   they used raw `xdotool keydown/keyup` and raw WebDriver `keyDown`. A `keydown`/`keyup` pair in `app-session` would
   make such steps one line (product-code change in `frontend/scripts/`, for a future build).
4. **Mutation runs inside a build** (verification skill VF7): `just mutants <base>` skips new files that are not yet
   committed (it lists `git diff --diff-filter=AM`), so a build in its own worktree sees nothing for its new files;
   the hold build ran Stryker by hand with `--mutate`. Suggest a note in VF7.
5. **`just app-session` quoting** (#1221, justfile, shared): `{{ args }}` drops quotes, so `read '<js>'` and
   `--settings '{…}'` break; `set positional-arguments` with `"$@"` fixes it.

## Owner checks (cannot run here)

- **Windows:** press and release Alt alone in yamt: nothing else should happen (no menu mode, the next key still types
  into the Result) — WebView2 hands Alt to the page (plan #80). Also: the marks' track leaves room for the classic
  scrollbar's arrow buttons, assumed square (`marks.ts` `laneBox`).
- **macOS:** Option held shows the marks; WKWebView's overlay scrollbar under the 14 px lane.
- **Linux desktops that move windows with Alt+drag** (Xfce, KDE Plasma 5) take Alt+click before yamt sees it. Your
  Plasma 6.7 has no `[MouseBindings]` override in `kwinrc`, so it uses Meta [INFERENCE: Plasma 6's default]; the
  Alt+clicks here ran on a private display with no window manager, so one Alt+click on your desktop settles it.

## Open points

- **#1219 — a jump to a change at a side's very end landed wrong twice.** In the real app, the first two clicks on such
  a mark (right after the run had reset the panes' scroll by script) left that pane at 2105 and 0; every later click
  on the same mark was right, and far marks not at the end were right. In MiniBrowser a plain scripted scroll to a
  side's end settles elsewhere with no mark involved (#1216). The jump scrolls exactly as the keyboard navigation does,
  so the suspect is the locked scroll at document ends, not the marks. Proposed: an investigation of the locked scroll
  (does keyboard navigation to a side's last change show it on `407ec81`?).
- `editor/index.ts` is at its 300-line limit: the next editor feature moves code out first.
- #1209, #1217, #1220 dropped as harmless (see their triage).
