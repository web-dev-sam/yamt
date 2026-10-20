```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/paneSplit.test.ts",
      "line": 166,
      "rule_id": "VF7",
      "problem": "Every test of the remote boundary uses widths where Local equals Remote: {300,400,300} at :166, {250,500,250} at :177, and WIDTHS at usePaneDividers.test.ts:12. So swapping `moved` and `kept` for the remote boundary still passes; these are the survivors paneSplit.ts:44:17 and :45:16. A user would see it: after any drag of the left divider, pressing the right one snaps Remote to Local's width and Local to Remote's. For example, {200,500,300} with dx 0 gives remote 0.2 instead of 0.3. This is the 'two sides mixed up' bug the design's mirror test and its dx-0 test ('a click moves the split') were meant to catch, and row 6 builds on `dragged`.",
      "fix": "Use widths with Local and Remote different, e.g. {local: 200, center: 500, remote: 300}. Assert dragged(w,'remote',0) = {0.2, 0.3} and dragged(w,'local',0) = {0.2, 0.3}; dragged(w,'remote',-100) = {local 0.2, remote 0.4} with local*1000 === 200; dragged(w,'remote',400).remote*1000 === 220 with local*1000 === 200. Make usePaneDividers.test.ts's WIDTHS asymmetric too."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/usePaneDividers.ts",
      "line": 41,
      "rule_id": "VF7",
      "problem": "No test reaches `usePaneDividers` (the four NoCoverage mutants at :41–44). Swapping its 'local'/'remote' keys, or the '' mutant, which `dragged`'s `boundary === \"local\"` ternaries treat as remote, would make the left divider move the right boundary. Today only row 6's manual WebKit step W2 would notice, so the mapping MergeView/ChoiceView bind to has no gate in the mutation run.",
      "fix": "Add one usePaneDividers.test.ts case inside an `effectScope`, with the same stubbed PointerEvent/Element globals as useColumnDrag.test.ts and asymmetric widths. Send pointerdown then pointermove (dx 100) through `.local.listeners` and through `.remote.listeners`, and assert each records `dragged` for its own boundary."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/paneSplit.ts",
      "line": 70,
      "rule_id": "VF7",
      "problem": "The `typeof local/remote === \"number\"` guards survive (:70:5 ×3, :71:5), but they are not fully equivalent. '{\"local\":\"5e-1\",\"remote\":1}' gets past the other checks (\"5e-1\"+1 = \"5e-11\", which is ≤ 0.99), and so does '{\"local\":0.5,\"remote\":\"1\"}' (0.5+\"1\" = \"0.51\"). Without the guard, a string share reaches `paneColumns` with a Result of −0.5. Only a hand-edited value gets there; nothing else gets harder as the app grows.",
      "fix": "Add both values to the invalid table at paneSplit.test.ts:53. They kill all four typeof mutants, including the `||` one."
    }
  ],
  "checked": [
    "Brief/design/plan #84 read; patch read in full; touched files read as committed (paneSplit.ts, useColumnDrag.ts, usePaneDividers.ts, fileListWidth.ts, store.ts hunks, windowStorage.ts, MergeView.vue:235-245 strip svg as direct child of the strip cell, stripIcons.ts icons are nested <svg>).",
    "Behaviour 1: readSplit rejects non-objects, null, arrays (`in` fails), missing keys, shares < 0.01, sum > 0.99; JSON cannot yield NaN and 1e400 (Infinity) fails the sum check, so dropping `Number.isFinite` is equivalent (accepted deviation; test :73). Missing key writes nothing (writeDefaults false; test :40). Reset writes the thirds as JSON (brief silent on it).",
    "Behaviour 2: paneColumns gives five tracks, gutter inside the minimum, share×100 fr; valid shares ≥ 0.01 give factors ≥ 1, and the factors always sum to 100 (tests :183, :191, :199).",
    "Behaviour 3 traced by hand: local boundary pair = local+center, floor = min(least, pair/2), clamp, kept/T exact; the remote boundary negates dx (`toward`), and the sign mutant is killed by :168. The floor never exceeds pair−floor, so bounds cannot invert.",
    "Survivor paneSplit.ts:43:39 (`total*PANES` → least always 220) is equivalent (VF7 a) for widths a layout produces. When T < 660, the CSS minimum min(220, T/3) forces all three panes to exactly T/3, and then pair/2 = T/3 equals the floor either way; when T ≥ 660 both give 220. Only unreachable inputs such as {250,250,100} tell them apart. [INFERENCE] This assumes row 6's `measure` returns the three grid tracks. The test at :147 cannot tell the two apart, despite its name.",
    "Open risk 'share < MIN_SHARE from dragged' accepted: CSS keeps every pane ≥ min(220, T/3), so the share stays ≥ 0.01 for T ≤ 22,000 px.",
    "Survivor paneSplit.ts:58:11 (`catch {}` → undefined) is equivalent: undefined fails the first `typeof value !== \"object\"` guard just as null does.",
    "These module-level survivors are false: the tests would kill them if Stryker re-evaluated module scope. STORAGE_KEY='' (:21) is killed by the read-back test :47; GUTTER_WIDTH {}/''/'' (:27) by the exact strings :183/:191; EQUAL_SPLIT {} and 1*PANES ×2 (:29) by :36. Tooling note for the orchestrator: the justfile passes --ignoreStatic, but these still came back as Survived rather than Ignored.",
    "Survivor useColumnDrag.ts:61:7 (`currentTarget instanceof Element` → true) is equivalent: a v-on listener's currentTarget is always the bound element during dispatch.",
    "Behaviour 4: preventDefault before press; capture, class and `drag` only for a non-null drag (accepted deviation, test 'a press that gives no drag'); moves use clientX − pressX and read no layout (:moved; test 'each move gets dx'); up, cancel and lost capture are filtered by pointerId; a lostpointercapture after pointerup is a no-op because dragging is null; scope dispose removes the class from the root captured at the press (tests 'disposing the scope…'); a second pointer is not cancelled and is ignored; buttons 1 and 2 and rejected targets are neither cancelled nor pressed; dblclick resets only when accepted; hover and leave do not touch `drag`.",
    "Deviation 'dots → hover after the drag ends' accepted. Per Pointer Events, boundary events fire after capture is released, so a pointerover on an icon target brings `rest` back [INFERENCE]; this is the implementer's open risk for row 6's WebKit steps.",
    "Behaviour 5 accept rule: the handle itself and an svg whose parentNode is the handle are accepted; a nested icon svg (its parent is the action group), a wave-join path and a null currentTarget are rejected (usePaneDividers.test.ts:43, :51, :62). The stricter parentNode check is correct given stripIcons.ts nests a Lucide <svg> in each action. press measures once per press (:68); reset only resets (:90).",
    "Behaviour 6: read requires Number finite and ≥ 160 (Infinity, 159.5, 0, '' tested); setWidth = max(160, min(px, ww/2)) with both ends and the narrow window tested; reset removes the key (useStorage null → removeItem; test checks `has(KEY)` false); a throwing storage keeps the value in memory and warns. No survivors in fileListWidth.ts.",
    "store.ts: the three lines only; `...createPaneSplit()` adds paneSplit/setPaneSplit/resetPaneSplit with no key clash (grep of frontend/src).",
    "No test run; every finding rests on the orchestrator's survivor list plus reading the code."
  ]
}
```