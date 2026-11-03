# MrShiftHeld

Agent output (`agent://MrShiftHeld`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeld.md), collected 2026-11-03T08:19:36.010Z.

{
  "summary": "Fixed: the muted \"not\" icons in merge-request filter lists show only while Shift is held. New `ui/useShiftHeld.ts` turns them on at Shift's keydown and off at its keyup, by key name, not `getModifierState`. They also go off on blur, a hidden page, or a pointer event without `shiftKey`. `MergeRequestFilter.vue` uses it instead of vueuse `useKeyModifier`; the click path is unchanged. Cause: in the WebKitGTK app on X11, Shift's own keyup reports Shift still set (seen).",
  "files_changed": [
    "frontend/src/ui/useShiftHeld.ts",
    "frontend/src/ui/useShiftHeld.test.ts",
    "frontend/src/ui/MergeRequestFilter.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "useShiftHeld.test.ts › down shows, up hides at once",
      "proves": "A real Shift keydown turns the state on and its keyup turns it off right away."
    },
    {
      "name": "useShiftHeld.test.ts › a release that still reports Shift as set hides",
      "proves": "A Shift keyup whose shiftKey/getModifierState still say Shift (the WebKitGTK/X11 case) clears the state."
    },
    {
      "name": "useShiftHeld.test.ts › window losing focus hides / page becoming hidden hides; becoming visible does not",
      "proves": "blur and visibilitychange to hidden clear it; becoming visible leaves a fresh press on."
    },
    {
      "name": "useShiftHeld.test.ts › a %s with Shift keeps them, without Shift hides them",
      "proves": "A pointerdown/move/up with shiftKey false catches a release the page never saw; with shiftKey true the state stays on."
    },
    {
      "name": "useShiftHeld.test.ts › pure-rule tests (press/release, other keys, pointer, leaving)",
      "proves": "Every branch of `shiftHeldAfter`; typing capitals while Shift is held keeps the icons."
    },
    {
      "name": "useShiftHeld.test.ts › listener tests (capture, pointers only while held, passive, no default prevented)",
      "proves": "Which listeners exist and with which options; no event's default is prevented."
    }
  ],
  "smoke_evidence": [
    {
      "command": "BEFORE fix, WebKit fixture (start-fixture --diff --mr list, Assignee hovered): WebDriver POST /actions keyDown then keyUp \\uE008 by curl; count muted icons",
      "observed": "down: 6 muted; up: none. The bug did not show: a logged listener saw `keydown:Shift:true:true keyup:Shift:false:false`, so WebKitWebDriver reports the modifier correctly on release."
    },
    {
      "command": "BEFORE fix, same fixture page, real X11 input on its private Xvfb :99: `xdotool keydown shift` / `keyup shift`",
      "observed": "down 0, up 6, 2 s after release still 6 (the bug). Events logged: `keydown:Shift:false:false keyup:Shift:true:true`."
    },
    {
      "command": "BEFORE fix, real app (debug build; start-app --diff --dir <scripts/range-repo.sh repo> --glab mr-row-details): WebDriver keys, then xdotool on :3",
      "observed": "WebDriver: down 3, up 0. X11: down 3, up 3, up + 2 s 3 (the bug). Events: `keydown:Shift:true keyup:Shift:false keydown:Shift:true keyup:Shift:true`."
    },
    {
      "command": "AFTER fix, fixture (page reloaded): WebDriver keyDown/keyUp \\uE008, then xdotool keydown/keyup shift on :99; output as (menu items / muted icons)",
      "observed": "WebDriver down 6, up 0. X11 down 6/6, up 6/0 at once."
    },
    {
      "command": "AFTER fix, fixture: WebDriver keyDown Shift, pointer click on \"Anna Berg\" (curl pointer actions), read openers, keyUp",
      "observed": "down 6/6/-; after the Shift+click 6/5/not Anna Berg and the opener reads \"Assignee: not anna\"; after release 6/0/not Anna Berg, so only Anna's red icon is left."
    },
    {
      "command": "AFTER fix, fixture: Shift down (WebDriver), then a second WebDriver window opened and switched to, then back; menu reopened by pointer move with Shift still down in WebDriver",
      "observed": "down 6/5; back 0/0 (the menu closed); reopened with Shift still down: 6/0, so the icons are off after leaving and coming back."
    },
    {
      "command": "AFTER fix, real app (rebuilt): WebDriver keys, then xdotool keydown/keyup shift on :3",
      "observed": "WebDriver down 3/3, up 3/0. X11 down 3/3, up 3/0, up + 2 s 3/0, while keyup still reports getModifierState Shift true."
    },
    {
      "command": "AFTER fix, real app: xdotool keydown shift; `app-session click --x11 [role=menuitemcheckbox] --nth 2` (Dmitri Volkov); keyup shift",
      "observed": "down 3/3/-; after the Shift+click 3/2/not Dmitri Volkov, opener \"Assignee: not dmitri\"; after release 3/0/not Dmitri Volkov. The scenario has no \"anna\"."
    },
    {
      "command": "AFTER fix, real app: X11 Shift down; focus-away; focus-back; menu reopened by xdotool mousemove with Shift still physically down",
      "observed": "down 3/2; after coming back and reopening 3/0. A pointermove while Shift is held reports shiftKey:true (seen: still 3/2), so the reset came from the blur."
    },
    {
      "command": "AFTER fix, real app: WebDriver keyDown Shift, then an X11 pointer move without Shift",
      "observed": "3/2, then 3/0 with shiftKey:false: a missed release is caught by the pointer rule."
    },
    {
      "command": "pnpm -C frontend fmt:check; lint; typecheck; unused; test",
      "observed": "All files use the correct format; lint exit=0 (oxlint + eslint, no output); vue-tsc -b clean; knip clean; Test Files 258 passed, Tests 3791 passed. `just map-check`: ok."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → useShiftHeld.ts 58 mutants: 58 killed, 0 survived, 100%. The first run's survivor (visibility `if (true)`) was killed by tightening the hidden/visible test.",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The brief's repro in the fixture with WebDriver keyDown/keyUp does not reproduce the bug: WebKitWebDriver's keyUp reports Shift false. I reproduced it with real X11 key events (xdotool on the session's private Xvfb :99 and on the app's :3) and kept the WebDriver runs as evidence too.",
    "The fixture blur step used a second WebDriver window instead of `app-session focus-away`, which is app-only; xmessage + windowfocus on Xvfb left document.hasFocus() true. In the real app the step used focus-away/focus-back.",
    "The real app's mr-row-details scenario has no \"anna\", so the app's Shift+click used \"Dmitri Volkov\". The app ran on a scripts/range-repo.sh repo (GitLab origin) so the Merge requests button appears.",
    "New composable `ui/useShiftHeld.ts` (with a pure `shiftHeldAfter`). Reason: vueuse `useKeyModifier` reads getModifierState, which WebKitGTK/X11 reports wrongly on Shift's own release. It follows `altHold.ts`'s shape but with Shift's rules: other keys do not end the hold, so capitals can be typed. altHold.ts is read-only here, so I did not merge the two.",
    "Docs (not edited, outside Owned): `.omp/skills/project-map/tree.md` needs a row under ui/: `useShiftHeld.ts (useShiftHeld: whether Shift is held, Shift keydown→keyup by key name, off on blur/hidden/pointer without shiftKey; shiftHeldAfter the pure rule; one per MergeRequestFilter)` (PM6). `just map-check` passed, probably because the file is untracked."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useShiftHeld.ts:15",
      "risk": "If both Shift keys are held and one is released, the state turns off while the other is still down; the next pointer event does not turn it back on. Left out on purpose (rule 1: until that key goes up)."
    },
    {
      "location": "frontend/src/ui/useShiftHeld.ts:31",
      "risk": "Each of the three filter components adds its own window listeners (as useKeyModifier did before); cheap, but it means three copies."
    }
  ]
}
