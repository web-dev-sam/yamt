# MrShiftHeldR1

Agent output (`agent://MrShiftHeldR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeldR1.md), collected 2026-11-03T08:29:18.756Z.

{
  "summary": "New `ui/keyHold.ts` `useKeyHold(rule, pointerEvents)` now owns the hold's listeners: capture key listeners, off on blur and when the page is hidden, pointer listeners only while held, passive. `altHold.ts` (`useAltHold = useKeyHold(heldAfter, …wheel)`) and `useShiftHeld.ts` both call it. Their pure rules (`heldAfter`, `shiftHeldAfter`) stay separate. `useShiftHeld` is wrapped in vueuse `createSharedComposable`, so the three filters share one state and one set of listeners. Alt's behaviour and its test file did not change.",
  "files_changed": [
    "frontend/src/ui/keyHold.ts",
    "frontend/src/ui/keyHold.test.ts",
    "frontend/src/ui/altHold.ts",
    "frontend/src/ui/useShiftHeld.ts",
    "frontend/src/ui/useShiftHeld.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "keyHold.test.ts › the rule's answer is the state, fed the state before",
      "proves": "The shell stores what the rule returns and passes it the previous state."
    },
    {
      "name": "keyHold.test.ts › key presses and releases reach the rule with their key, repeat and modifiers",
      "proves": "keydown → {key, repeat}; keyup → {key, altKey, shiftKey}."
    },
    {
      "name": "keyHold.test.ts › keys heard in capture; pointers not while not held / while held, the rule's pointer events are heard capture+passive",
      "proves": "Listener options. Only the caller's pointer-event list is used. Pointer listeners go away when the hold ends."
    },
    {
      "name": "keyHold.test.ts › a pointer event reaches the rule with its modifiers",
      "proves": "Pointer and wheel events reach the rule as {kind: pointer, altKey, shiftKey}."
    },
    {
      "name": "keyHold.test.ts › blur / hidden page reach the rule as leaving; visible does not; no default prevented; stopping the scope removes every listener",
      "proves": "The shared lifecycle that #2147 found copied in two places."
    },
    {
      "name": "useShiftHeld.test.ts › while held, pointer events and no wheel are heard",
      "proves": "Shift listens to exactly pointerdown, pointermove and pointerup, and not wheel."
    },
    {
      "name": "useShiftHeld.test.ts › every filter shares one state and one set of listeners until the last one goes",
      "proves": "#2148: both callers get the same ref; it still works after one caller's scope stops; all listeners are removed after the last one stops."
    }
  ],
  "smoke_evidence": [
    {
      "command": "just app-session start-fixture --name shr1 --diff --mr list; click \"Merge requests\"; hover Assignee; DISPLAY=:99 xdotool keydown shift / keyup shift; read [menu items, muted icons, hasFocus]",
      "observed": "before [6,0,true]; down [6,6,true]; up [6,0,true]; up+2s [6,0,true]"
    },
    {
      "command": "same fixture: xdotool mousemove to Assignee (320,112), keydown shift, xdotool mousemove to Reviewer (445,112), keyup shift; read [menu label, items, muted]",
      "observed": "hover [\"Assignee\",6,0]; down [\"Assignee\",6,6]; down + X11 move to Reviewer [\"Reviewer\",6,6]; up [\"Reviewer\",6,0]. The shared state follows Shift from one filter to the next."
    },
    {
      "command": "just app-session start-fixture --name altr1 (merge window); DISPLAY=:99 xdotool keydown/keyup alt, key x while held; read [.minimap count, shown, hasFocus]",
      "observed": "before [1,0,true]; alt down [1,1,true]; alt up [1,0,true]; alt down again [1,1,true]; alt held + x [1,0,true]; alt up [1,0,true]"
    },
    {
      "command": "same merge fixture: xdotool keydown alt; mousemove 700 500; click 5 (wheel); keyup alt; read shown minimaps",
      "observed": "alt down 1; +X11 move 1; +X11 wheel 1; up 0"
    },
    {
      "command": "pnpm -C frontend fmt:check; lint; typecheck; unused; test",
      "observed": "All matched files use the correct format; lint exit 0 (LINT_OK); vue-tsc -b clean; knip clean; Test Files 259 passed, Tests 3797 passed. `just map-check`: map-check: ok"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 86 mutants, 86 killed, 0 survived (altHold.ts 28/28, keyHold.ts 35/35, useShiftHeld.ts 23/23), 100%",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "tree.md, ui/: add `keyHold.ts` (useKeyHold: the hold's window listeners — capture keys, blur and a hidden page as leaving, the rule's pointer events only while held, passive — sending KeyHoldEvent to a pure rule; used by altHold.ts and useShiftHeld.ts).",
    "tree.md: the altHold.ts row becomes `heldAfter` on useKeyHold. The useShiftHeld.ts row becomes `shiftHeldAfter` on useKeyHold; one instance per window via createSharedComposable, not one per MergeRequestFilter.",
    "state.md: the 'Shift held' row is owned by useShiftHeld.ts's single shared instance (createSharedComposable), written only by shiftHeldAfter through keyHold.ts. The Alt-held row's writer is heldAfter through keyHold.ts.",
    "Each rule keeps its own narrow input type (altHold HoldEvent, ShiftEvent). The shell's KeyHoldEvent is wider: keyup and pointer carry both altKey and shiftKey, and both rules are assignable to its rule parameter. This keeps altHold.test.ts byte-for-byte unchanged.",
    "The WebKitGTK/X11 comment moved to the `keyup` case of `shiftHeldAfter`, the code that now depends on it.",
    "Removed from useShiftHeld.test.ts the lifecycle tests now in keyHold.test.ts: listener options, blur, hidden page, no default prevented. altHold.test.ts keeps its own versions unchanged.",
    "`just map-check` passes even though keyHold.ts is not yet in tree.md, probably because the file is untracked (the same thing round 1 saw).",
    "Ran `pnpm -C frontend install --frozen-lockfile --offline` in the worktree because node_modules was missing. It only changed ignored files."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useShiftHeld.ts:28",
      "risk": "createSharedComposable returns the raw composable when vueuse's isClient is false (no window at module load). That cannot happen in the app or WebKit; the tests stub window before importing."
    },
    {
      "location": "frontend/src/ui/useShiftHeld.ts:15",
      "risk": "Carried over from round 1: with both Shift keys held, releasing one turns the state off."
    }
  ]
}
