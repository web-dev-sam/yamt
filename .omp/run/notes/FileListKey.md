# FileListKey — 3.L-key, round 1

Brief `docs/slices/briefs/3.L-toggle-key.md`; plan §2 #61 (Key). Transcript `history://FileListKey`.

## Summary

- `KeyAction` `"toggle-file-list"`, last in `KEY_ACTIONS`, default `Mod-b`; Keymap "Toggle file list", "anywhere in
  the window", group "Window" (last).
- Store: `fileListShown` (true at start, never stored), `fileListKey(event, platform)`: nothing on
  `defaultPrevented`, a waiting question, or another key; else `preventDefault()` and flip. Bindings read from
  `state.settings.value.keys.bindings` (the source of `preferences.keys`).
- `App.vue`: `useEventListener(window, "keydown", …)` → `fileListKey(event, navigator.platform)`; `v-show` on
  `<FileList>`.
- `refreshFiles`, `loadRemoteName` moved unchanged into new `ui/listing.ts` (structural `Listing`,
  `RemoteNameTarget`); `store.ts` 300 lines.

## Evidence

- typecheck, lint, `pnpm test` 58 files / 650 tests, `just sfc-order`, `just web-unused` exit 0.
- WebKit (fixture, MiniBrowser, real WebDriver input): Ctrl+B in the Result pane hides the aside (merge view
  1345 → 1590 px), text unchanged, Ctrl+Z undoes only the test edit; width 360 kept across hide/show; left side
  keeps focus and outline, ArrowDown steps after; find box keeps focus; works beside settings and in its path
  field; Keymap "Window" row; rebind to Ctrl+Shift+L while recording does not toggle; Reset restores Ctrl+B;
  clash question names "Toggle file list" and blocks the key; Mark resolved question blocks it; reload starts
  shown. Screenshots `/tmp/yamt-flk/`.

## Deviations

- New file `ui/listing.ts` (exports `refreshFiles`, `loadRemoteName`), no own test (store tests cover it).
- `KeyPress` = `Parameters<typeof keyOfEvent>[0] & Pick<KeyboardEvent, "defaultPrevented" | "preventDefault">`.
- Extra tests: Meta+B on Linux, `usedByText(keyOwners(…))` clash text.

## Open risks

- `store.ts` at exactly 300 lines.
- `App.vue` `v-show` needs `FileList` to keep one root element (FileTreeView must keep `<aside>` as root).
- Choice-file / deleted-side views not exercised (fixtures are text only).
