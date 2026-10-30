# Slice MrWindowStateR1 — fix round 1 of the merge-request window state

Board "Merge requests" row 5. Round 1: `MrWindowState` (commit `635f4e5`, brief `docs/slices/briefs/mr-window-state.md`,
notes `.omp/run/notes/MrWindowState.md`). The Rust commands are committed with their generated bindings
(`frontend/src/ipc/bindings.ts`, notes `.omp/run/notes/MrOpenCommands.md`). Fix exactly these:

1. **The list's end on the channel** (orchestrator decision, round 1's own risk at `tauriMergeRequests.ts:22` and
   `mergeRequests.ts:116`): Tauri may deliver a page after the command resolves, so `listMergeRequests` now takes a
   `Channel<ListMessage>` carrying every page, then exactly one end, and resolves with nothing. The Tauri source
   resolves its `SourceResult<ListEnd>` on that end message (or the command's IPC failure); an unreadable page is a
   conversion failure of the load, whenever it arrives. `MergeRequestSource` keeps its signature. The slice no longer
   needs late-page handling after an end; remove what only served it.
2. **Bindings**: `pnpm -C frontend typecheck` and `lint` green against the real bindings (round 1's NOT RUN);
   `mergeRequestDomain.ts` follows the generated field names.
3. **#1941** The slice's `Listing` is renamed `ListLoad` (contract amendment, design §6 "B4 → B5"); the fixture's
   private `Listing`/`listing` pair gets a name of its own.
4. **#1938** The merge window's `ui/store.ts` uses `screen.ts`'s settings-screen actions instead of its own
   open/close closures; one rule for Back's target in all three windows.
5. **#1939** One `pause(ms)` exported from `ipc/fixture.ts`, used by `fixtureMergeRequests.ts` and `fixtureReview.ts`.
6. **#1942** `frontend/src/ipc/AGENTS.md`: a paragraph for `MergeRequestSource` like the other sources' (extended by
   Compare and Range; brands; `mergeRequestDomain.ts`; one Channel per load ending in its end message;
   `?mr=<script>`, project `none` without it).

`just findings 1938 1939 1941 1942` for the review text.

## Target

Owned: `frontend/src/ipc/{MergeRequestSource,mergeRequestDomain,tauriMergeRequests,fixtureMergeRequests,fixtureMergeRequestData,fixture,fixtureReview}.ts`
and their `*.test.ts`, `frontend/src/ipc/AGENTS.md`, `frontend/src/ui/{screen,mergeRequests,store}.ts` and their
`*.test.ts`. Read-only: everything else, `bindings.ts` included (generated).

## Acceptance

- `tauriMergeRequests.test`: a page whose message arrives after the command resolved is still in the load; the load
  ends only on the end message; an IPC failure of the command ends it as a problem. Fails on round 1's code.
- Merge window: Settings opens and Back returns as before (existing store tests unchanged in what they assert).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://ipc-contract`, `skill://verification`.
