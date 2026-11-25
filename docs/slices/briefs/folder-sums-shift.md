# Slice folder-sums-shift — folder `+a −r` in the range tree only while Shift is held

Request `docs/slices/request-folder-sums-shift.md` (rules 1–3, acceptance). Amends plan §2 #125. Base: main
`eb2c9f12`.

## Target

**Owned:** `frontend/src/ui/RangeApp.vue`, `frontend/src/ui/AGENTS.md`, and a test file only if you add a component
(below).

**Read-only:** everything else; `useShiftHeld.ts` is used as is (its rule and tests stay); `RangeCounts.vue` and
`RangeFileRow.vue` unchanged (file rows keep their counts). Doc lines beyond `ui/AGENTS.md` go in
`deviations_from_brief`.

**Non-goals:** request "Non-goals".

## Contract

- `useShiftHeld()` from `ui/useShiftHeld.ts` (shared composable, `Readonly<Ref<boolean>>`), the same one
  `RangeMessage.vue:32` and `RangeThreadBox.vue:38` use. No second Shift listener, no `useKeyModifier`.
- The folder slot's `RangeCounts` gets `invisible` while not held (Tailwind `invisible`, `visibility: hidden`), never
  `v-if`/`v-show`: layout identical in both states (rule 2).
- `RangeApp.vue` stays a composition surface (VU16): one `const shift = useShiftHeld()` and a class binding. If the
  slot grows beyond that, a small `RangeFolderEnd.vue` (counts + reviewed check) is allowed with a one-line reason
  (VU15) and an SSR render test like `RangeColumnHeading.test.ts`.

## Change

1. Wire `useShiftHeld` into the folder slot's counts as above.
2. `ui/AGENTS.md` line 9 ("Folder sums"): add that they show only while Shift is held (`useShiftHeld`).

## Acceptance

- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test` clean; `just web-unused` clean.
- WebKit fixture `just app-session start-fixture --name fs --range-case review --size 1280x800`, tree view, with real
  WebDriver key actions (`keyDown`/`keyUp` `\uE008` on the session's endpoint, not synthetic DOM events): before, every
  folder row's `RangeCounts` has computed `visibility: hidden`; after keyDown, `visible`, with the same text as at
  `eb2c9f12` (record both); after keyUp, hidden; keyDown, then window blur (`window.dispatchEvent(new Event('blur'))`
  is acceptable here) → hidden. Folder name and reviewed-check bounding boxes equal in both states. File rows' counts
  visible throughout. Shots dark and light, held and not held.
- `just mutants HEAD` (a `.vue`-only change mutates nothing: say so).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
