```json
{
  "lens": "correctness-reviewer",
  "round": "PaneHandlesR1 re-check (104553e)",
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/useColumnDrag.ts",
      "line": 120,
      "rule_id": "#1284",
      "problem": "This is the real gap behind the `:133 [false, true]` survivor. The handle remembers the last two presses it has seen at any time, not the two presses of this double-click. Take a handle whose previous press was accepted, for example an earlier divider drag or a press on an empty strip. If a double-click's first press lands outside it (the pane text or gutter next to a strip, the right edge of a file row next to the file-list handle) and the second press lands on it, the state reads [true (old), true] and the split resets to thirds (or the file list goes back to 240 px). On a fresh handle the constant `[false, false]` is the only thing that stops a reset after one press, and no test sends one press and then a dblclick. So the #1284 promise 'a double-click whose first press was not on the divider never resets' still fails when the first press is outside the handle. [INFERENCE: WebKit counts clicks without checking which node got the first press; the notes' before-fix repro supports this, since the first press on an icon rect and the second on the svg root still gave a dblclick.]",
      "fix": "In `left` (pointerleave with no drag), set `lastTwoPressesAccepted` back to `[false, false]`, because a press the handle cannot see needs the pointer outside it. Add two node cases: a fresh rig with one accepted click then dblclick gives 0 resets (this kills the `[false, true]` survivor), and accepted click, pointerleave, accepted click, dblclick gives 0 resets."
    }
  ],
  "survivors": [
    {
      "mutant": "useColumnDrag.ts:54:7 ConditionalExpression `if (false)` (+ NoCoverage BlockStatement 54:41)",
      "triage": "drop",
      "reason": "(a) equivalent: `pressed` is called only from the `pointerdown` listener, and browsers send `pointerdown` only as a `PointerEvent`, so the guard never returns in the app. The check is there only to narrow the type. (b) gate-covered: with the guard gone, `vue-tsc -b` (`pnpm typecheck`) rejects `isMainPress(state, event)` (Event is not MouseEvent), `handle.press(event)` and `event.pointerId`."
    },
    {
      "mutant": "useColumnDrag.ts:133:29 ArrayDeclaration `[]`",
      "triage": "drop",
      "reason": "(a) equivalent: both slots read `undefined`, which is falsy, and the first press shifts in `[undefined, accepted]`, so it never resets until two real accepted presses, the same as `[false, false]`. (b) typecheck rejects `[]` for the `readonly [boolean, boolean]` tuple."
    },
    {
      "mutant": "useColumnDrag.ts:133:30 BooleanLiteral `[true, false]`",
      "triage": "drop",
      "reason": "(a) equivalent: the starting `earlier` never decides anything. With no presses `latest` is false, so there is no reset, and the first press shifts the starting `earlier` out."
    },
    {
      "mutant": "useColumnDrag.ts:133:37 BooleanLiteral `[false, true]`",
      "triage": "finding",
      "reason": "Not equivalent: on a fresh handle, one accepted press then a dblclick resets. That happens when the double-click's first press was outside the handle. Answer to the brief's question: yes, with this mutant a dblclick after only one press this handle saw resets. With the real code it also resets once the handle has seen any earlier accepted press. Reported as the block above."
    }
  ],
  "checked": [
    "#1284 fixed for the reported cases: the strip wrapper's listeners (MergeView.vue:265-268, 277-280) see the icon or wave-join press. `dividerHandle.accepts` (usePaneDividers.ts:17-20) rejects it, so the state is [false, true] at the dblclick and there is no reset. Notes §2: apply-icon and wave-join double-clicks left the split at 0.4287…, and the before-fix repro reset it.",
    "Two divider presses still reset: test 'a double-click resets only when both of its presses were accepted' (useColumnDrag.test.ts:262-283), plus the WebKit run (divider double-click gives thirds) and the real-app ChoiceView gutter double-click (notes §2, §4).",
    "#1284 test strength: a `latest`-only check fails 'rejected then accepted'; an `earlier`-only check fails 'accepted then rejected'; the round-1 dblclick-target check resets in 'rejected then accepted' (accepting=true at the dblclick) and fails. The notes' hand mutant `earlier || latest || !earlier` fails 2 tests.",
    "Right-click memory: 'a press with another button counts as a rejected one' (test.ts:285-292) pins `isMainPress` rather than `accepts` alone.",
    "The `pressed` change has no regression: `accepts` is pure for both handles (usePaneDividers.ts:17, FileList.vue:23). A second pointer during a drag still does not start or prevent anything (test 'a second pointer's press…' unchanged and passing per the notes). dblclick no longer reads its own target, and every source of a dblclick passes through pointerdown first.",
    "#1285 fixed: `hovered` gives `rest` when `event.buttons !== 0` (useColumnDrag.ts:104). The test 'hover with a button held rests…' fails with the check removed (it reads 'hover'). WebKit after the fix: dots stay rgb(86, 83, 98) at 0.1–1.0 s of an icon drag, and the drag still applies. Hover with no button still brightens both the header and file-list handles (notes §3).",
    "#1285 side effect accepted (below the block bar, dropped per RV8): after an icon drag ends over the svg root no new pointerover fires, so the dots stay at rest until the pointer moves to another element. Cosmetic only.",
    "FileList centring keeps the press area: the handle's box classes `absolute inset-y-0 -right-island z-10 w-island` are unchanged (FileList.vue:128). The ResizeDots root is `pointer-events-none` (ResizeDots.vue:15), so presses on the dots' spot still have target === currentTarget, which `accepts` (FileList.vue:23) needs, the same as with flex.",
    "FileList cursor: `cursor-col-resize` is still on the handle, and the pointer-events-none dots do not affect it.",
    "FileList dots: the same `resize.dots` binding. The fallthrough `absolute inset-0 m-auto size-fit` lands on ResizeDots' single root span and has no conflicting position, inset, margin or size utility there. Measured centre: handle [245,5,5,954], dots [246,474.5,3,15], centres (247.5, 482) for both.",
    "FileList double-click: same listeners and `resetWidth`. Real app: drag +100 gives aside 340, stored '340'; double-click gives 240 and removes the key (notes §4).",
    "PaneDivider merge: the root's classes plus the fallthrough give the same classes as round 1 for both MergeView header cells and both ChoiceView hit boxes, the same `v-on` binding and ResizeDots state. There is no behaviour change; ownership is the boundary lens's #1283.",
    "Risk register: no row has `ui/useColumnDrag`, `FileList` or `PaneDivider` as owner. Architecture §3.1 (merge-core) and CM1–CM9 (editor/) are not touched by this patch.",
    "No test was run; the block rests on reading `pressed`, `left` and `doubleClicked` together with the notes' WebKit observation."
  ]
}
```