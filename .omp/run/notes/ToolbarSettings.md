# ToolbarSettings (3.S, board "Toolbar" row 1) — implementer report digest

Base `af83d3a`; patch `.omp/run/patches/ToolbarSettings.patch` (uncommitted in the working tree: the
owner reviews it instead of review agents and asked for no commit, #656).

## Shape

- `SideFocus.moveToChange(direction)`: side with DOM focus, else `"local"`; shares the private
  `#takeKeyboardThenStep(side, direction | null)` with `#wheel` (which now runs `wheelStep` first).
- `MergeController.moveToChange`, `export type { Direction }`; `MergeHandle.moveToChange` (no-op
  before the controller exists), `Direction` re-exported from `useMergeController.ts`.
- Line budget: `#showCovered` → `internal/covered.ts` `pushCovered(views, covered)` (`showCovered`,
  `coveredField`, `sameCovered` now private there); `index.ts` 299 → 297. Store's `report` →
  `ui/problem.ts` `report(target, failure)`, also used by `views.ts` `reload`; `store.ts` 286 → 296.
- Store: `settingsOpen`, `openSettings`, `closeSettings`, `pick(path)` (closes settings, then `open`);
  App's FileList `@select` → `pick`. `open` never touches `settingsOpen`.
- `MergeToolbar.vue`: ↑ "Previous change", ↓ "Next change" after Mark resolved; `IconButton.keepsKeyboard`
  (true only for the arrows) → `preventDefault` on `mousedown`; emits `move: [direction]`.
- `SettingsButton.vue` (VU15: one gear for three file headers): lucide `settings`, toolbar icon-button
  classes, calls `openSettings`; `ml-auto` in the toolbar; read-only and choice headers became
  `flex h-10 shrink-0 items-center justify-end px-2`.
- `SettingsView.vue` (VU15: a screen of its own): `<section aria-label="Settings">` `col-start-1
  row-start-1 min-h-0 min-w-0 overflow-y-auto rounded-island bg-panel`; column `mx-auto w-full
  max-w-3xl p-6`; Back = Mark resolved's bordered look + lucide `arrow-left`. Reads
  `document.activeElement` in setup, focuses Back on mount; Back → `closeSettings`, `nextTick`, refocus
  the saved element if connected and `visibility: visible`.

## Evidence (fixture mode, WebKit, real WebDriver input)

lint/typecheck/test (464 tests, 41 files), sfc-order, web-unused, oxfmt: exit 0. Steps 1–8 observed
(arrows on both sides, stop at the lowest, from the middle screen-relative: left 71 not 5, keyboard
Tab+Enter, settings hide/no key reaches/Back restores text+summary+scroll+undo, focus back on the gear,
file pick closes). Step 9 (gear on read-only/choice) not in the fixture → verifier.

## Open risks

- Focus hand-back reads the opener in setup; if the real app's WebKit drops focus earlier, Back leaves
  focus alone.
- `mousedown` `preventDefault` keeping the side's keyboard checked in WebKitGTK only.
- No side focused → always the left; a future toolbar on a deleted-side file would need `hidden`.
