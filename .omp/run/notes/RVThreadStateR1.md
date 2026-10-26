All twelve items from the round-1 brief are done, each with its test. The whole tree passes `typecheck`, `lint`, `test`, `fmt:check`, `sfc-order` and `unused`.

**summary**
- `ShownThread` now lives in `ipc/threadLine.ts`. `rangeThreads.ts` no longer imports anything from the editor (PM2).
- `isQueued` is one exhaustive switch, used by both the queued count and the Unqueue button.
- Drafts moved into the new `ui/rangeDrafts.ts`; `RangeThreads` keeps the same surface. `GitLabState.result` now holds the send reply unchanged, and `SendResult` is gone.
- Send can no longer stick: each send has its own `running` flag, and the old result is cleared when a send starts. `rangeThreadParts` takes the store-to-controller wiring out of `useRangeController`, and it has a node test.
- `ipc/index.ts` no longer exports `ThreadAdded`.

**files_changed**
- `frontend/src/ipc/threadLine.ts`, `frontend/src/ipc/index.ts`
- `frontend/src/editor/range.ts`, `frontend/src/editor/internal/threadRows.ts` (only the `ShownThread` import, plus a re-export for `threadNumbers.ts`)
- `frontend/src/ui/rangeDrafts.ts` (new), `rangeThreads.ts`, `rangeGitLab.ts`, `rangeThreadText.ts`, `useRangeController.ts`
- Tests: `frontend/src/ui/rangeThreads.test.ts`, `rangeGitLab.test.ts`, `rangeThreadText.test.ts`, `rangeStore.test.ts`, `useRangeController.test.ts`

**tests_added**
- rangeThreads, "counts per file ignore drafts" (extended): `shownFor(other)` holds only its own `draft-0` (open), and `shownFor(board)` lists `thread-0…3, draft-1` (item 5).
- "after a refused Comment the next Comment on that draft is sent and stored once": the in-flight guard is released after a refusal (item 6).
- "a press on the same line number in the other column opens a second draft": left 3 then right 3 gives two drafts (item 6).
- "each thread keeps its own reply text": `noteText(a)` is "x" and `noteText(b)` is "y" (item 6).
- "a Comment on a key with no draft makes no call and reports nothing" (item 8).
- "a refused Comment whose draft was dropped while it ran brings no draft back": `drafts.size === 0` (item 8).
- "queued and refused postings sit in the queue; not queued and pending do not" (`isQueued`, item 2).
- The test at old line 280 is renamed to "a Cancel while Comment is in flight still adds and opens the thread" (item 12).
- rangeGitLab, "the progress label…" (extended): at `T0 + RECHECK_PAUSE_MS`, `checkOnFocus()` during a send keeps `checks()` at 1 (item 9).
- "a progress message arriving after the reply leaves Send usable": `sending` is null and the label reads "Send to GitLab (0)" (item 7).
- "a send that ends not lined up clears the previous send's result": a refusal result, then a `notLinedUp` send, leaves `result` null (item 10).
- The two result tests now assert the reply union itself (`kind: "sent"` / `kind: "stopped"` with `reason`) (item 4).
- rangeThreadText: `sendResultText` is tested for both `sent` and `stopped` replies (item 4).
- rangeStore, "a draft outlives its file's view…": after `showFile` on 16 other files, file 0 is no longer visited, and `shownFor(id0)` and `boxOf` still hold the draft with "Why?" (item 12).
- useRangeController, "a press on a line number starts a draft in that file only; toggle opens and closes": uses a real `createRangeThreads` through `rangeThreadParts` (item 11).

**smoke_evidence**
- `vitest run --project node` on the five touched test files → `Test Files 5 passed (5)`, `Tests 95 passed (95)`
- `pnpm -C frontend test` → `Test Files 183 passed (183)`, `Tests 2468 passed (2468)`
- `pnpm -C frontend lint && typecheck && sfc-order && unused && echo ALL-OK` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"` / `$ vue-tsc -b` / `$ tsx scripts/check-sfc-order.ts` / `$ knip --include exports,types` / `ALL-OK`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`

**deviations_from_brief**
- `editor/internal/threadRows.ts` also re-exports `ShownThread` from `../../ipc`. Without it, `threadNumbers.ts` and two editor test files, which import it from `./threadRows` and are read-only for me, would break.
- `addThread` and `addNote` now go through the public draft actions (`writeDraft`, `dropDraft`, `writeNote(thread, "")`) instead of a general `setDraft`. `writeDraft` writes only to an existing draft, so behaviour is unchanged, including the "dropped mid-flight" rule.
- `RangeDrafts` also has a `threadDraft` field. `createRangeThreads` destructures it out before spreading the rest (`threadDraft: _threadDraft`), and it is a function-typed property because a method signature fails lint (`unbound-method`). `isBlank` is exported from `rangeDrafts.ts` for `rangeThreads.ts`.
- The local name for the reply minus `notLinedUp` in `rangeGitLab.ts` is `SentReply`, not `SendResult`, so the deleted name doesn't come back. `sendResultText` writes the same `Exclude` inline.
- The draft rules are tested through `rangeThreads.test.ts`, which has the fixture's branded ids, so I did not create `rangeDrafts.test.ts`.
- The test `sendQueue` stubs reuse the file's existing `new Promise(resolve => …)` pattern rather than `Promise.withResolvers`, because `tsconfig.app.json` lib stops at ES2023.

**open_risks**
- `frontend/src/ui/rangeThreads.ts:214` (`const { threadDraft: _threadDraft, ...drafts }`): relies on oxlint ignoring names that start with `_`, which it does today. If a reviewer finds it unclear, the fix is to list the six draft fields explicitly.
- `docs/architecture.md` / the project map don't name `ui/rangeDrafts.ts` yet (the PM6 map check). Docs aren't in my Owned files, so this is the orchestrator's doc work.