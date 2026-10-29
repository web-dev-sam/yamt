# RangeCollapseVerify — final run (session 35)

Brief `docs/slices/briefs/range-collapse-verify.md`; verifier, 23m57s, HEAD `c0ccb3f`. **gate: fail** (VF2, flaky 2i).

- `just check` exit 0 (web 204 files / 2801 tests, arch-check, map-check, 10 goldens, hooks 17/17).
- Range fixture, dark and light: 2a 6 waves per column, 4 strip runs, joins 0 px, seeded thread 97–105 / 98–106; 2b
  4 → 8 → rest in both columns, focus kept, wave gutter press no draft; 2c hover marks all three parts, 2 px vs 1 px,
  pointer; 2d toggle keeps top 101 / 200, right lined up, cursor 32:15 → 25:0, disabled on logo.png; 2e thread on
  left 24 shown with context after off → on; 2f find reveals 70/71 in both, select-all reveals nothing; 2g
  Next/Previous through the 7 differences, no height change; 2h off → reload all shown, merge page unpressed (dark
  only); 2i Ctrl+Home [0,0], scripted steps never held. **2i Ctrl+End flaky in light: 2 of 12 runs** ([604,624] with
  the right cursor at 494; [0,0]) — #1693.
- Merge fixture dark and light: waves, hover, click +4 lines, toggle keeps top 89, minimap drag and Ctrl+wheel lined
  up, find + Ctrl+End lined up.
- Compare `?diff`: bands, no wave or toggle, sync. Typing removes every difference mark in fixture mode — also on
  `15ab31c` (older, fixture mode).
- Real app `range-repo.sh`, dark and light: 2a, 2b, 2d, 2f pass; off survives a restart; the merge window on a
  `conflict-repo.sh` repository with the same home reads the stored choice (pressed, `"true"`).
- Not fully exercised: deep-toggle cases capped by the collapsed height (kept lines 101, 200, 89 proven); Ctrl+wheel
  as a synthetic WheelEvent. Screenshots `/tmp/yamt-rc/verify/` (2f-*-dark files hold the real-app light shots).
