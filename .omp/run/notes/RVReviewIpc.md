The review source is in place: the window can now list threads, add threads and notes, queue and unqueue messages, check GitLab and send with progress, both in the app and in fixture mode. All four brief commands plus `unused` pass on the whole tree. `just map-check` still fails: `docs/architecture.md` doesn't name the seven `ReviewSource` methods, and that file isn't mine.

```
summary
- `ReviewSource` (the brief's seven methods) is new, and `RangeSource` now extends `SettingsSource, ReviewSource`. Both range sources spread in the review methods: `createTauriReview()` and `createFixtureReview(log, search, start)`.
- `ThreadId`/`MessageId` brands are in `domain.ts`. `toThreadLine`/`fromThreadLine` are in `threadLine.ts`. `reviewDomain.ts` holds the camelCase shapes and `toThreadList`, `toThreadAdded`, `toGitLabCheck`, `toSendReply`, which check every id and line and name the bad field.
- Fixture mode keeps threads in memory with Rust's refusals (`EmptyMessage`, `UnknownRangeFile`, `UnknownThread`, `UnknownMessage`, `MessagePending`, `SendRunning`). It supports `?threads=seeded` and all 13 `?gitlab=<script>` scripts, with a 300 ms pause and one progress report per message.
- `problemText.ts` has a reason for all seven new `IpcError` kinds. `ipc/index.ts` exports `AgentSettings`, which `ui/settings.ts` now uses. `RangeSideLabel` is no longer exported. `map-check.sh` loops over `ReviewSource` too.

files_changed
- new: frontend/src/ipc/{ReviewSource,reviewDomain,reviewDomain.test,tauriReview,tauriReview.test,fixtureReview,fixtureReview.test,fixtureGitLab,fixtureGitLab.test}.ts
- changed: frontend/src/ipc/{domain,threadLine,RangeSource,tauriRange,tauriRange.test,fixtureRange,fixtureRange.test,rangeDomain,index}.ts, frontend/src/ipc/AGENTS.md, frontend/src/ui/{problemText,problemText.test,settings}.ts, scripts/map-check.sh

tests_added
- reviewDomain.test.ts:
  - every `Posting` arm comes out camelCased (`draftNote`, `mergeRequest`); both `MessageBody` arms are kept as they came.
  - every `ThreadLine` kind and the session survive; `toThreadAdded` brands the new id.
  - bad ids are refused by field: thread id, file id, `threads[1].messages[1].id`, `line.left`, `line.right`, `thread`.
  - every `NotLinedUp` arm, through both `toGitLabCheck` and `toSendReply` (`lookedAt` branch and commit, `gitlabHead`/`shownHead`, `gitlabBase`/`shownBase`, `webUrl`).
  - the `linedUp`, `sent` and `stopped` replies; the line builders name `left line`/`right line`.
- tauriReview.test.ts:
  - every command passes its arguments and the list comes back camelCased; `addThread` sends the line through `fromThreadLine`.
  - `checkGitLab` camelCases the merge request; `sendQueue` hands each progress from the `Channel` to the callback.
  - a failure from each of the seven commands comes back unchanged; a bad message id in a reply is refused.
- fixtureReview.test.ts:
  - no threads without `?threads=seeded`; `seeded` gives the four line kinds, message ids 0–4, and queued, refused, pending and `aiAnswer` messages with the session.
  - `seeded` on a range without `board.ts` gives nothing.
  - `addThread`/`addNote` assign ids after the seeded ones and the time in seconds; blank, unknown-file and unknown-thread refusals.
  - queue keeps the edited text and unqueue takes it back; pending, unknown and blank refusals change nothing.
  - `checkGitLab` for each of the 13 scripts; `checking` answers only at 3000 ms; an unknown script logs `review.fixture_miss`, an empty one logs nothing.
  - a send waits 300 ms before each post and reports per message (draft notes 102, 103); `refusal` refuses the second post; `stopped` ends with "glab timed out" after 1 of 2.
  - not-lined-up scripts send nothing; a second concurrent send answers `SendRunning`; a message unqueued mid-send is skipped but still counted as done.
- fixtureGitLab.test.ts: a right side with no branch is looked up by commit (`noMergeRequest`, `several`); `noBranch` always looks up by commit; the pending link ends in `/diffs`; `postOutcome` for each script and index.
- fixtureRange.test.ts: on the committed review case, the seeded lines sit inside or outside board.ts's differences as their kinds say, left 100 pairs with right 101, and `?range=empty&threads=seeded` lists none.
- tauriRange.test.ts: the range source answers `listThreads` through the command.
- problemText.test.ts: the six fixed reasons, and `RemoveFailed` naming the folder and the trimmed message.

smoke_evidence
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit=0
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit=0, no findings
- `pnpm -C frontend test` → `Test Files  172 passed (172)` / `Tests  2263 passed (2263)`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`, exit=0
- `pnpm -C frontend unused` → `$ knip --include exports,types`, exit=0 (before: `RangeSideLabel` ×2 unused)
- Stryker (the `just mutants` command, limited to my files) → reviewDomain 91.76 %, fixtureReview 99.21 %, tauriReview 100 %, threadLine 94.03 % (all four survivors on my lines killed), problemText 100 %, fixtureGitLab 75.68 %. The remaining survivors are listed under open_risks.
- `bash scripts/map-check.sh` → still fails. Before this change it already failed on many unrelated files and commands. Mine adds `ReviewSource.listThreads|addThread|addNote|queueMessage|unqueueMessage|checkGitLab|sendQueue (not in docs/architecture.md)`. `RangeSource.openRange`/`loadRangeFile` were already missing the same way. `docs/architecture.md` is not owned.

deviations_from_brief
- I split the fixture into `fixtureReview.ts` (the thread store) and the new `fixtureGitLab.ts` + `fixtureGitLab.test.ts` (the `?gitlab` answers). One file came to about 410 lines against max-lines 300. Main granted ownership.
- `ui/problemText.ts`: `RemoveFailed` names its folder and message (`removing <folder> failed: <message>`) instead of a fixed sentence. The other six use one fixed-reason table, checked by a type guard before the switch; this keeps `causedText` under 40 lines.
- `toThreadLine(raw, field = "line")` gains an optional field-name argument. The private `leftLine`/`rightLine` now take the field name too.
- `ipc/index.ts` exports no review types or sources yet, and `reviewDomain.ts` exports only the shapes the interface uses (`Thread`, `ThreadList`, `ThreadAdded`, `GitLabCheck`, `SendProgress`, `SendReply`). knip fails any export without an importer. Row 20 should export what the store imports.
- An unknown `?gitlab=` script logs `review.fixture_miss` and lines up. An unknown `?threads=` value just starts empty.
- The fixture's `sendQueue` checks `SendRunning` before the GitLab check, as Rust's send guard does. A message unqueued or edited mid-send is skipped but counted as done, as in `send.rs`.
- Needed outside my files: `docs/architecture.md` (and `ipc-contract`) must name the seven `ReviewSource` methods and the new files. `skill://project-map` must list `ReviewSource.ts`, `reviewDomain.ts`, `tauriReview.ts`, `fixtureReview.ts` and `fixtureGitLab.ts`.

open_risks
- frontend/src/ipc/fixtureGitLab.ts:24-59 and frontend/src/ipc/fixtureReview.ts:46,49: module-level constants and the script table survive Stryker. They are module-level (#732) and are evaluated once at load. The tests assert every value.
- frontend/src/ipc/reviewDomain.ts:150-152: the pass-through `case "glabMissing"|"notLoggedIn"|"failed"` labels are equivalent mutants, because the exhaustive default returns the same value.
- frontend/src/ipc/reviewDomain.ts:174,194 and threadLine.ts:20,75: the exhaustive `never` defaults are NoCoverage (unreachable).
- frontend/src/ipc/fixtureReview.ts:65-95: the seeded lines (19, 20, 5/5, 100/101) are tied to today's `fixtures/range/review.json`. If that generated file changes, `fixtureRange.test.ts` "?threads=seeded sits on board.ts's lines…" fails.
```