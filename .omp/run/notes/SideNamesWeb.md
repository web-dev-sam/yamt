# SideNamesWeb — 3.N-web, round 1

Brief `docs/slices/briefs/3.N-side-names-web.md`; plan §2 #62 (with #50). Transcript `history://SideNamesWeb`.

## Summary

- `ipc/`: `SideName`, `SideNames` (domain aliases), `ChunkSource.sideNames()`; tauri `commands.sideNames()`, fixture
  `{ local: null, remote: null }`. `RemoteName`, `remoteName` gone.
- Store `sideNames` (both null until loaded), `loadSideNames()` (called in `main.ts`); `ui/listing.ts`
  `loadSideNames(target)` (`SideNamesTarget`): rejection → both null, warn `store.side_names_failed`, no problem bar.
  `store.ts` 296 lines.
- `ui/sideHeaders.ts`: `sideHeader(side, names)`, one rule, `LABEL: Readonly<Record<Side, string>>`; Branch →
  "<label>: <name>", Commit → "<label>: <short_id> <subject>" (tooltip full message), null → "<label>".
  `MergeView.vue`, `ChoiceView.vue` pass `sideNames.value`.

## Tests

- `sideHeaders.test.ts` rewritten: per side × {branch, commit, null}; one side named leaves the other plain.
- `store.test.ts`: `loadSideNames` sets both; a rejection leaves both null, no problem, one warn line.
- Removed (forwarding/constant): "remoteName returns the app's answer", "the fixture source names nothing merged in".

## Evidence

- typecheck, lint, test (695 tests, 62 files), `just sfc-order`, `just web-unused` exit 0.
- WebKit fixture (golden file): visible headers "Local (yours)" / "Remote (theirs)" / "Result".
- Real app, merge (`/tmp/yamt-test-sidenames-merge`): vOn.ts, `docs/removed.md`, `assets/logo.bin` all show "Local
  (yours): local" / "Remote (theirs): remote" (titles equal); screenshots `/tmp/yamt-sidenames-merge.png`,
  `/tmp/yamt-sidenames-choice.png`.
- Real app, rebase: git `26c5817` / `remote`, REBASE_HEAD `e9c1303 local`; page "Local (yours): 26c5817 remote"
  (title "remote"), "Remote (theirs): e9c1303 local"; `/tmp/yamt-sidenames-rebase.png`.

## Deviations (accepted)

- Fixture mode has no deleted-side or choice file (all fixtures `deleted: null`, `unsupported: null`): those views
  were checked in the real app only.
- One-line commit messages in the rebase repo: the hover equals the subject there.

## Open risks

- Names load once at start without awaiting; a header shows the plain label until the reply arrives (as before).
