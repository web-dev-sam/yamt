# AltMarksHold reviews (3.O-hold)

## Boundary

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "nit",
      "file": "frontend/src/ui/altHold.ts",
      "line": 34,
      "rule_id": null,
      "problem": "The local function `apply` reuses the product's word for applying a side's change (`applyLeft`, `applyRight`, `applyAllNonConflicting`, `editor/internal/apply.ts`). As the app grows, anyone searching for \"apply\" in `ui/` lands here for nothing; nothing else gets harder.",
      "fix": "Rename it `hear` or `step` (it feeds one `HoldEvent` into `heldAfter`)."
    }
  ],
  "checked": [
    "Ownership: the patch touches only `ui/altHold.ts`, `ui/altHold.test.ts` and `ui/App.vue`, which matches the brief's `Owned`. `MergeView.vue`, `store.ts`, `ipc/**`, `editor/**` and docs are untouched.",
    "Contract: `HoldEvent` (four kinds, readonly fields, no `altKey` on keydown), `heldAfter(held, event): boolean` and `useAltHold(): Readonly<ShallowRef<boolean>>` match the brief's fixed signatures exactly. The brief has a trailing comment on `left`; the code drops it, and nothing is lost because the `kind` name and the plan row say the same thing.",
    "`heldAfter` against plan §2 #80 \"Hold\" and board rules 1–2:\n  - Alt keydown: not a repeat → true; a repeat → unchanged.\n  - Any other keydown, AltGraph included → false.\n  - Alt keyup, or any keyup reporting Alt up → false; otherwise unchanged.\n  - pointer → `held && altKey`, so a pointer event never shows the marks.\n  - left → false.\n  - Coming back with Alt held follows from left=false plus repeat=unchanged.\n  Every case matches. The switch has no default and is exhaustive over the union (TS3).",
    "Listeners in `useAltHold` match brief Change 2:\n  - keydown and keyup on the window in the capture phase.\n  - blur on the window without capture. This is right: a captured blur would also fire for every element's blur, but this listener hears only the window's own.\n  - Hidden page through `useDocumentVisibility` and a watch that reacts only to \"hidden\".\n  - The four pointer/wheel listeners use capture and passive, through a reactive target that is `null` while Alt is up, so nothing listens then.\n  - No `preventDefault` anywhere (plan #80 \"Windows\").",
    "Capture-phase order: the other window capture listeners (`ToolbarMenu.vue:23-25`, `ServerMenu.vue:29-30`) sit on the same target, and none calls `stopImmediatePropagation` (grep over `frontend/src`), so they cannot hide a release from the hold.",
    "PM2/PM3/PM5: `altHold.ts` imports only `@vueuse/core` and `vue`. These are allowed in `ui/`, and there is no `@codemirror`, `@tauri-apps`, `editor/` or `internal/` import. `App.vue` adds one edge, `./altHold`, which is ui to ui.",
    "VU12: the listeners use VueUse `useEventListener`/`useDocumentVisibility`, with no hand-rolled `addEventListener`.",
    "VU16: `App.vue` gains only wiring: one `useAltHold()` beside the existing window listeners, plus a `:marks` binding. There is no feature logic in the component.",
    "VU2: the new statement sits in App's state section after `useWindowFocus()`. The build report says `just sfc-order` exits 0.",
    "VU13 file naming: composables are usually `use*.ts`, but `altHold.ts` is named by the brief's contract and by plan #80's \"One owner: `ui/altHold.ts`\". It is not a deviation.",
    "TS11 one concept: the file holds the hold rule and its one composable. Its 71 lines are under the 300 cap, and `useAltHold` is under 40 lines.",
    "TS16: `heldAfter` and `HoldEvent` are exported per the contract and imported by the test. The report says `knip` exits 0.",
    "State ownership (vision 2): the \"Alt held\" fact is one `shallowRef`, written only by the closure inside `useAltHold`. There is one instance in `App.vue`, and every `MergeView` gets the same value. No second copy exists: `keys.ts`, `keyField.ts` and `historyKey.ts` read `altKey` for key chords, not for a hold.",
    "Plan #80's rejected owners are respected: nothing in `store.ts` and nothing in `ipc/keys.ts`.",
    "Comments (comment-policy): `altHold.ts` and the test have none, and none are needed.",
    "Accepted: the `marks` attribute falls through onto MergeView's root until build 3.O-editor adds the prop. This is stated in the brief, the contract and open_risks.",
    "Accepted (open_risk): the pointer listeners attach a microtask after Alt's keydown. An event in that gap could not have shown the marks; at worst it delays a missed-release hide until the next event.",
    "Accepted (open_risk): the test's stand-in `window`/`document` depend on VueUse reading `window.document` at load. A VueUse change would make these tests fail, not pass wrongly.",
    "Accepted deviations: `just mutants` was run by hand on the new untracked file, and the orchestrator's run on the commit confirms it (`.omp/run/mutants/AltMarksHold.txt`: 62 killed, 0 survived). The deviation note also covers the `pnpm install`, the debug build and the curl WebDriver calls.",
    "Docs not in this patch, by design:\n  - `altHold.ts` is not yet named in `skill://project-map`, so `map-check` will list it.\n  - There is no architecture §5.1 row for \"change marks shown\" and no CHANGELOG line.\n  Docs are read-only in both 3.O briefs. Orchestrate §6 (SKILL.md:95) updates `docs/architecture.md` and `skill://project-map` once per feature, before the verifier. The orchestrator should add the map entry and the §5.1 row text from AltMarksDesign \"Build U\" at feature close.",
    "Acceptance evidence is present in the build report:\n  - node tests: 20 passed;\n  - lint, typecheck, test, unused, fmt:check and sfc-order exit 0;\n  - WebKit reads for keyDown, keyUp, Alt+a and blur;\n  - real-app xdotool reads for keydown, focus-away, focus-back and a fresh press;\n  - the session was stopped."
  ]
}
```

## Correctness

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 1,
      "problem": "`frontend/src/ui/altHold.ts` is not named in the project map (grep for the whole word `altHold` finds nothing in the map, `docs/architecture.md` or the ipc-contract skill). So `scripts/map-check.sh` fails on this commit, and with it `just check`, which runs `map-check`. The new window-wide fact \"Alt is held\" also has no row in the state-ownership table. As the app grows, a reader who asks \"where does the hold come from?\" will not find it in the map, and the next build's verifier will hit a red `just check` that this patch caused. The brief made docs and `.omp/**` read-only for the implementer, so the fix belongs to the orchestrator.",
      "fix": "Orchestrator: on the map's `frontend/src/ui` line, add `altHold.ts (`heldAfter`: the pure hold rule, `useAltHold`: one window-wide hold, plan §2 #80)`. Add a state row \"Alt held (change marks)\" with owner `useAltHold()` in `ui/altHold.ts`, one instance in App.vue, passed to every MergeView as `marks`, never stored. Add the same row to the state table in `docs/architecture.md`."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "frontend/src/ui/altHold.test.ts",
      "line": 204,
      "problem": "The `wheel` entry in \"no event's default is prevented\" can never fail: the pointer listener is passive, and Node ignores `preventDefault` inside a passive listener (checked on v24.22.0: `defaultPrevented` stays false), just as browsers do. What actually keeps the pointer path free of `preventDefault` is the `capture passive` assertion in the other test. Nothing gets harder as the app grows; a reader is only misled about which test proves it.",
      "fix": "Drop the wheel send from this test, or add a comment that the `capture passive` assertion in \"while held, pointer and wheel events…\" is what covers the pointer path."
    }
  ],
  "checked": [
    "Plan §2 #80 \"Hold\", board rules 1–2 and the brief's Change 1 were each traced against `heldAfter` (altHold.ts:13-30):",
    "  - keydown \"Alt\" that is not a repeat → true; a repeat → unchanged. Tests: \"Alt's press shows, from shown or hidden\" and \"Alt's repeat while shown keeps them shown\".",
    "  - keydown of any other key, \"AltGraph\" included and repeats included → false. Tests: \"AltGraph's press never shows\" (shown before true and false, repeat true and false) and \"another key hides, and Alt's repeat keeps them hidden\" (also covers key \"a\" with repeat true).",
    "  - keyup \"Alt\" → false whatever altKey says. Test: \"Alt's release hides, whatever altKey says\". This matters on WebKitGTK, where a modifier's own release can report its modifier still down [INFERENCE: GTK reports the state from before the event].",
    "  - keyup of another key: altKey false → false (a release the window missed); altKey true → unchanged, and it never shows from false. Test: \"another key's release with Alt up hides, with Alt down keeps\".",
    "  - pointer: `held && altKey`, so it never shows and hides on Alt up. Tests: the pure pointer test, plus the 4-way `test.each` over pointerdown, pointermove, pointerup and wheel through the composable.",
    "  - left → false. Tests: \"leaving the window hides\", \"the window losing focus hides\" (window `blur`), and \"the page becoming hidden hides; becoming visible does not\".",
    "  - Back in the window with Alt still held shows nothing until a fresh press. Tests: the pure `reduce` test (left, then two repeats, then a fresh press); the composable test shows `repeat` reaches the rule (an Alt repeat after another key stays false, so hard-coding `repeat: false` would fail).",
    "Listeners (altHold.ts:32-71):",
    "  - keydown and keyup are on the window in the capture phase, so a find box or menu that stops propagation cannot hide a release from it.",
    "  - `blur` is on the window without capture. That is correct: with capture, a focus move between elements (e.g. between panes) would reach the window listener and wrongly hide the marks. The test's exact `toEqual({keydown:'capture',keyup:'capture',blur:''})` pins this.",
    "  - Pointer listeners exist only while Alt is held. Checked against the VueUse 15.0.0 source (`dist/index.js:188-212`): when the getter returns null, the filtered target list is `[]`, so `firstParamTargets` is `[]`, so nothing is registered (it does not fall back to `defaultWindow`). The tests pin both directions: no pointer listener at start, all four added as `capture passive` while held, and exactly keydown/keyup/blur left after the release.",
    "  - `useDocumentVisibility` (VueUse :2748) listens for `visibilitychange` on `document`. The `watch` hides only on \"hidden\". The first Stryker run's survivor (`if (true)`) is now killed by the \"becoming visible does not\" half of the test.",
    "No `preventDefault` anywhere in altHold.ts (read in full). The keydown/keyup cases in the test use `cancelable: true` events, so those assertions can actually fail.",
    "Accepted open risk: the pointer listeners attach in a post-flush microtask after Alt's keydown. No pointer task can run before microtasks flush, and a pointer event could never show the marks anyway.",
    "Accepted open risk: the test's stand-ins rely on VueUse reading `window.document`. If that changes, the stand-ins break and the tests fail loudly; they cannot pass wrongly.",
    "Accepted deviations: Stryker run by hand before the commit (the orchestrator's run on the commit supersedes it); `pnpm install --offline` with no lockfile change; raw WebDriver calls for the keyDown-without-keyUp check (all four reads asked for in acceptance 3 are reported); debug build for the real-app check.",
    "Acceptance 3 (WebKit) and 4 (real app, real X input) are in the build report with every required read: hold → true, release → false, Alt then `a` → false and still false 1 s later, blur → false; in the real app focus-away → false, focus-back → false, a fresh press → true, release → false. The session was stopped. I did not re-run any of this.",
    "App.vue:39 and :81: one `useAltHold()` beside the existing window listeners, and `:marks=\"altHeld\"` on every `<MergeView>` (the top-level ref is unwrapped to a boolean in the template). It falls through as an attribute until the editor build adds the prop, as the brief intends.",
    "Mutants (`.omp/run/mutants/AltMarksHold.txt`): 68 instrumented, 62 killed, 0 survived, 0 no coverage. The other 6 are module-level mutants skipped by `--ignoreStatic` (justfile:133-135): `ALT` and the `POINTER_EVENTS` array and its four strings. By reading: `ALT → \"\"` fails \"Alt's press shows\"; emptying the array or any string fails the `toMatchObject` of the four listeners and the `test.each` over the four types. VF7 triage: nothing to drop or grade.",
    "Would the tests notice the feature deleted or off by one? Removing capture from the keys, adding capture to blur, attaching pointer listeners always, dropping `passive`, hard-coding the `key`, `repeat` or `altKey` fields, or hiding on \"visible\" each fail a named test.",
    "No risk-register row (RK1–RK27) has `ui/altHold.ts` or App.vue's MergeView wiring as its owner. merge-core §3.1 invariants and CM1–CM9 do not apply: the patch has no merge-core or editor changes.",
    "`heldAfter`'s switch over HoldEvent has no default and is covered by `switch-exhaustiveness-check` (TS3); no `as`, `!` or `any` in the source (TS4).",
    "No test or toolchain run by me; one `node -e` probe of Node's EventTarget (passive `preventDefault` is ignored) backs the nit."
  ]
}
```