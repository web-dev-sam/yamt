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

## Second pass (HEAD `39182c2`, after repair round 4)

`just check` exit 0 (hooks 17/17, goldens, arch-check, map-check). Range fixture dark and light: 2a–2h pass as before;
2i #1689 repro [2809, 3268]; right-column Ctrl+End with no find 20/20 at both ends; Ctrl+Home 0; script steps never
held; 2j built-while-hidden right at once. Merge fixture dark and light: waves, hover, click, toggle (top 89 kept),
minimap drag, Ctrl+wheel, find + Ctrl+End, a Result click near the top + Ctrl+End 10/10 + 10/10, two-file switch
widths right. Compare: bands, no wave or toggle, sync. Real app: 2a, 2b, 2d, 2f pass dark and light; off survives a
restart; the merge window reads the same stored choice. Exits: range 0, 0; merge 1 ("7 of 7 files still unresolved").

Verifier's gate: fail on two steps, both triaged by the orchestrator as over-strict brief lines, no product defect:
2i from the left column (#1695: the sync's middle-line pairing, lines paired in the screenshot, same in the merge
window) and 2j after a resize while hidden (#1696: the wave width follows CodeMirror's own 50 ms resize re-measure,
~5 frames). Feature closed on that triage; the owner is told both.
