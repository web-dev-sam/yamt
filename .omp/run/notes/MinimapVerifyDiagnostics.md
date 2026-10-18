# MinimapVerify — diagnostics after the final run (orchestrator's record of the verifier's two follow-up answers)

The first save of this file copied the main report by mistake; the verifier's two follow-up answers were:

## 1. Where 5b comes from (real app `:2`, `/tmp/yamt-m/verify/long`, `vOn.ts`, collapsing off, fresh session each run)

Before every write: tops `[0,0,0]`, centre `scrollHeight 3688`, `clientHeight 903`. Arrays are `[left, center, right]`.

- D1 HEAD, Alt up, `center.scrollDOM.scrollTop = 2552`: frames `[[0,1385,0],[1385,1385,1325]]`, after 1 s `[1385,1385,1325]`.
- D1b same, read back synchronously: `sync:[0,2552,0]`, `syncScrollHeight:3688`; frames as D1.
- D2 base `7141a81` (scratch build), same write: identical to D1.
- D3 HEAD, `left.scrollDOM.scrollTop = 2552`: frames `[[1385,0,0],[1385,1385,1325]]`, after 1 s the same.
- D4 HEAD, Alt held, real press on row 151 (y 390), capture-phase `pointerdown` probe: `atDown [0,0,0]`; frames 1–5
  `[[0,1405,0],[1405,1405,1345],…]`, after 1 s `[1405,1405,1345]`.
- D5 toolbar Next change: `vOn.ts` has no change below row 120 (changes at rows ~16, ~19–21, ~87); not answerable here.

Conclusion: the pull-back happens before the first frame, in the written pane, whichever pane is written, on the base too;
the sides follow a frame later. The locked scroll's family (#1219), not the minimap.

## 2. Scroll timing repeats (three interleaved runs per column; late frames of 200, mean ms)

| row                                | base `7141a81`                  | HEAD Alt up                     | HEAD Alt held                   |
| ---------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| renderer.ts, all opened, middle    | 9 (16.5), 9 (16.4), 11 (16.5)   | 11 (16.5), 12 (16.5), 8 (16.5)  | 15 (16.5), 14 (16.5), 7 (16.5)  |
| pnpm-lock.yaml, all opened, middle | 25 (16.7), 23 (16.7), 19 (16.6) | 22 (16.7), 19 (16.6), 19 (16.6) | 20 (16.7), 23 (16.6), 21 (16.6) |

Medians: renderer base 9, Alt up 11, Alt held 14 (limit 12); pnpm-lock base 23, Alt up 19, Alt held 21 (limit 26).
Run-to-run spread up to 8 frames; mean frame time 16.4–16.7 ms everywhere.
