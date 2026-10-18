# Handoff — the Result's minimap while Alt is held (session 21, branch `feat/minimap` off main `7141a81`)

Board: `docs/slices/SLICES.md` section "Minimap" (rows 1–4''). Rules: `docs/plan.md` §2 #81 (the minimap; #80's marks
superseded, its Alt hold kept) and #82 (a far scroll lands where it was sent, in every pane). Request and owner answers:
`docs/slices/request-minimap.md`. Findings #1223–#1250 in `.omp/run/findings.jsonl`; notes per agent in
`.omp/run/notes/Minimap*.md`. Not pushed.

## State

- Product commits: `67dc661` (Alt scrollbar marks and their jump removed), `fc98f33` (the minimap's pure parts),
  `a0c110d` (the minimap in the window), `2f767a5`, `192272b` (last rows near the end), `8c07b92`, `74e1e3b` (far scrolls
  land, `exactScroll.ts`). Licence notice for VS Code's minimap glyphs: `2096884`, `f917dd9`.
- Final run at `d7aaeb6`: `just check` passes; mutation run leaves only the 14 older survivors in
  `ui/useMergeController.ts`; WebKit and the real app pass; scroll timing with Alt up within base + 3 on all 8 rows.
- Owner decisions this session: #1243 — fix the far click now (done, plan #82); try the minimap on its own layer (tried,
  no reliable gain, not kept).

## Owner checks (cannot run here)

- **Your desktop, Alt+drag:** hold Alt and drag the minimap's box once. Desktops that move windows with Alt+drag (Xfce,
  KDE Plasma 5) take that drag before yamt sees it; Plasma 6 uses Meta by default [INFERENCE]. Clicks and the wheel on
  the minimap are unaffected either way.
- **Look:** the box over the visible part shows the whole time Alt is held (VS Code shows it only under the pointer);
  a file that fits on screen shows no box; problem and change marks are at least 4 px tall. Screenshots:
  `/tmp/yamt-m/verify2/window-dark.png`, `/tmp/yamt-m/verify2/app-light-alt.png`, `/tmp/yamt-m/verify/window-long.png`.
- **Windows:** Alt alone must not open a menu (unchanged from #80, still unverified); the far-scroll fix was observed on
  WebKitGTK only and uses CodeMirror's own scroll request, so another engine should behave the same [INFERENCE].
- **macOS:** Option held shows the minimap.

## Suggested `.omp/` changes for the next retro (apply only at Gate D)

1. **CM13** (cm6-rules): an exception line for `exactScroll`'s synchronous `scrollTop`/`clientHeight` read — it runs
   inside CodeMirror's scroll handling right before CodeMirror's own synchronous measure (#1248, plan #82).
2. **Palette check reads finding numbers as colours** (#1250): `#1240` in a source comment fails VU17's `HEX_COLOUR`;
   exempt comments or require a colour context.
3. **`git restore` in isolated worktrees** (#1226): an implementer restored a file from history in its worktree; the
   bash guard allowed it.
4. **`scroll-timing.py` writes `.omp/run/__pycache__/`**, which got committed once and the bash guard blocks `rm -r`
   of it; run it with `PYTHONDONTWRITEBYTECODE=1` (the second final run did) or ignore the folder.
5. **Browser tests** (#1242, as #1074/#1222): Playwright WebKit still cannot launch here and CI does not run
   `test:browser`; this feature added no browser test.

## Open points

- #1219 (a jump to a side's very end landing wrong) was not reproduced after #82: a drag to the very end lands
  `[2785, 2785, 2725]` and stays; its earlier reports may share #1240's cause [INFERENCE].
- Alt-held scroll timing: one of eight rows 15 late frames of 200 against base 11 + 3; medians over repeats equal
  (8 / 8 / 9). Within the run-to-run spread on this machine.
