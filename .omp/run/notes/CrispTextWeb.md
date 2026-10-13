# CrispTextWeb — round 1 (`4223f25`, base `1361290`)

Brief: `docs/slices/briefs/3.X-crisp-text-web.md`; rule plan §2 #60. Patch: `.omp/run/patches/CrispTextWeb.patch`.

## What exists now

- `editor/internal/pane.ts` `.cm-scroller`: `lineHeight: "20px"`, `backgroundColor: var(--color-panel)` (CP1 comment → #60).
- `ChunkSource.setAntialiasing` (tauri: private `createTauriSettings()` spread into `createTauriSource()`; fixture in
  memory), `Antialiasing` re-exported; `SettingsInUse.antialiasing` (start "subpixel"), sent by `storedSettings`, compared
  by `sameStored`, taken by `adopt`; store action `setAntialiasing`; SettingsView section "Antialiasing" (Subpixel /
  Greyscale, note "Takes effect the next time yamt starts.") on Linux only.
- `bg-panel` on FileList's and QuestionDialog's scrolling `<ul>` (both measured grey in Chromium at 1.5).

## Evidence (implementer)

- pnpm lint / typecheck / test (642) / unused / sfc-order / fmt:check exit 0.
- WebKit fixture (dpr 2): every `.cm-line` 20 px, tops step 20/20/20/20 in all panes; selection, active line, tints,
  word marks, removal bar, find bar visible (`/tmp/yamt-crisp-web/webkit-*.png`).
- Real app: view shows Antialiasing with Subpixel pressed; Greyscale writes `"antialiasing": "greyscale"`; restart grey
  (fringe 0.027) vs subpixel (0.903) with 20 px tops 512.5/532.5/552.5.
- Chromium 156 at dsf 1.5: panes 0.50 (0.48 after 1000 px scroll); file list 0.15 → 0.74; question list 0.00 → 0.68;
  settings view 0.67 (already opaque).
- Scroll timing, interleaved A/B on the trial repo (scale 1, renderer.ts, all opened, middle, late frames of 200):
  change 25/24/24 medians vs base 23/25; mean 16.6–17.0 vs 16.7–17.1 ms; p95 22–26 vs 28–31; max 29–36 vs 38–44.

## Review

Boundary pass with shoulds #795–#797 (promoted); correctness fail: block #794 (square corner spur on the file list),
should #798 (promoted). Mutants 91.54 %, survivors only on unchanged lines (#799). → rework 1.

## Final comparison image

`/tmp/yamt-crisp/final-compare-s1.png`: WebStorm | yamt before (grey, 18.2 px) | yamt after (Subpixel, 20 px), 400 %.
