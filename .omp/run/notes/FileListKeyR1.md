# FileListKeyR1 — 3.L-key, rework 1 (#809, #811)

Brief `docs/slices/briefs/3.L-toggle-key-rework-1.md`. Transcript `history://FileListKeyR1`.

- `ipc/keys.ts` exports `pressesKey(event, keys, platform)` (keyOfEvent not null and `sameKey` with one of
  `keys`), re-exported from `ipc/index.ts`; `store.ts` `fileListKey` and `editor/internal/historyKey.ts`
  `historyCommand` call it; neither uses `keyOfEvent`/`sameKey` for the match now.
- Line cap: `sameKey` body loops over `MODIFIERS` (keys.ts 299 lines); `KeyPress` derived from
  `Parameters<typeof pressesKey>[0]`; store.ts 296 lines.
- Tests: `pressesKey` with [], two keys (+ near misses), macOS ⌘B vs ⌃B; store: empty binding (no flip, no
  preventDefault), two keys (each flips). 655 tests.
- Evidence: lint, typecheck, test, sfc-order, web-unused exit 0; `grep sameKey` on store.ts/historyKey.ts empty;
  WebKit fixture: Ctrl+B hides/shows from the Result pane (focus kept), side apply → Ctrl+Z → Ctrl+Shift+Z
  summary 2 → 3 → 2 changes.
- Open: keys.ts 299/300 lines.
