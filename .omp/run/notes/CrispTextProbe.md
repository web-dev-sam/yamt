# CrispTextProbe — measurements (brief `docs/slices/briefs/3.X-text-probe.md`)

Full report with every command: `/tmp/yamt-crisp/REPORT.md` (scratch; images in `/tmp/yamt-crisp/out/`). Repository at
`9da4adb`, no file changed. Private Xvfb displays only; WebStorm reference = WebStorm 2026.2's own JetBrains Runtime
(JBR-25.0.4) and TTF, Java2D LCD_HRGB, contrast 140, #BCBEC4 on #191A1C, lines 22–41 of
`tests/golden/vue-core-compiler-von/local.ts` (no tints in yamt).

## Configurations

C0 today; C1 GTK settings `gtk-xft-antialias=1`, `gtk-xft-rgba=rgb`, `gtk-xft-hintstyle=hintslight` at start
(settings.ini via `XDG_CONFIG_DIRS`); C2 = C1 + `WEBKIT_SKIA_ENABLE_CPU_RENDERING=1`; C3 = C0 + CPU rendering;
`o` = + `.cm-scroller { background-color: var(--color-panel) }`; `d` = `WEBKIT_DISABLE_DMABUF_RENDERER=0` (GPU path,
NVIDIA EGL mapped); shipped path on NVIDIA = DMABUF off = CPU painting into shared memory (no EGL vendor library in
the web process).

## Results

| config   | fringe s1 | s2    | 2→1.45 | ink/glyph s1 | core s1 |
| -------- | --------- | ----- | ------ | ------------ | ------- |
| WebStorm | 0.861     | 0.567 | 0.549  | 19.72        | 0.124   |
| C0       | 0.000     | 0.015 | 0.015  | 17.94        | 0.392   |
| C1       | 0.901     | 0.569 | 0.553  | 17.89        | 0.224   |
| C1d      | 0.894     | 0.567 | 0.607  | 16.97        | 0.218   |

- C1 = C2 byte-identical (shipped path); C1o = C1, C2o = C2: CPU rendering and an opaque scroller change nothing in
  WebKitGTK. C0 = C3.
- Baselines: the same glyph is pixel-identical on three lines with line-height 1.4 and 20px (32 checks): WebKit
  rounds each baseline to the device grid. Line tops at 18.1875 px pitch → first ink rows 499, 517, 554 (lines 23, 24,
  26): line pitch alternates 18/19 device px.
- Live switch (xsettingsd on the private display): started as C0, `Xft/RGBA rgb` never shows fringes (not even after
  reload); started as C1, rgb → none → rgb repaints live both ways. [INFERENCE: surface pixel geometry fixed at start.]
- Scroll timing (`.omp/run/scroll-timing.py`, renderer.ts, all opened, middle, median of 3 runs, late frames of 200):
  s1 C0 17, C1 21, C2 21, C0d 19, C1d 19 (C0's own runs 16–22); s2 C0 172, C1 171, C2 173 (Xvfb saturated at 3200×2000).
  Mean ms s2: C0 28.6, C1 28.8, C2 30.0. No measurable cost of subpixel text.
- WebStorm metrics at 13 px: ascent 14, descent 4, height 18, line height 22 px at spacing 1.2; advance 8 px (yamt 8 px).
- Chromium 156 (WebView2 stand-in; fontconfig rgba=rgb): dsf 1 subpixel everywhere (scrollers not composited); dsf 1.5
  each `.cm-scroller` is a composited `OverflowScrolling` layer and its text is grey (0.00); `.cm-scroller {
  background-color: var(--color-panel) }` → 0.49 in all three panes (0.47 after 1000 px scroll). `.cm-line {
  isolation: auto }` and removing the strip wrappers' `will-change` change nothing. Gutters subpixel in every variant.

## Limits

The owner's Wayland path (GTK at 2×, KWin → 1.45) was not observable; Xvfb/X11 stands in. Where GTK on Wayland takes
`gtk-xft-rgba` from was not measured. The 1.45 simulation scales a crop (linear filter). WebStorm's crops come from
Java2D off-screen.
