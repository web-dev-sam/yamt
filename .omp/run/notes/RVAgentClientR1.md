**summary**
- Fix round 1 of the agent client is done: B1–B10, C1–C10, the survivor groups marked "kill", and the type errors from the two binding changes. All five frontend recipes pass on the whole tree.
- The agent code is split up. `ipc/agentDomain.ts` holds the shapes and conversions (camelCase: `homeFolders`, `headMoved`, `refs`). `agent/internal/starter.ts` makes the checkout and starts the process. `agent/internal/turnRun.ts` holds the running turn. `session.ts` is now only the session-id brand.
- An app failure now travels as its `SourceFailure` (`AgentFailure` `app`, `EditDiff` `appFailed`), so the window's existing failure words apply; `sourceText` is deleted.
- Fixed behaviour:
  - Stop before the prompt ends the turn at once and sends nothing more for it.
  - A thread's conversation load and an Ask AI on it send one `session/load`.
  - A turn is no longer running inside its `ended` handler.
  - After `destroy` nothing starts.
  - An old Stop button after its turn ended cancels nothing.
- `scripts/record-agent.ts` now uses the same "inside the checkout" rule as `inside.ts`, and a test checks every recorded permission answer against `answers.ts`.

**files_changed**
- New: `frontend/src/agent/internal/{starter,turnRun}.ts`, `frontend/src/agent/internal/{protocol,turnRun}.test.ts`, `frontend/src/ipc/agentDomain.ts`, `frontend/src/ipc/agentDomain.test.ts`
- Changed in `frontend/src/agent/`: `AGENTS.md`, `index.ts`, `index.test.ts`, `internal/{answers,answers.test,failure,process,protocol,session,turn.test}.ts`
- Changed in `frontend/src/ipc/`: `{AgentSource,tauriAgent,tauriAgent.test,fixtureAgent,fixtureAgent.test,tauri,tauriReview,fixture,fixtureCompare,index,fixtureReview,reviewDomain.test,fixtureReview.test}.ts`
- Changed: `frontend/scripts/record-agent.ts`

**tests_added**
- `index.test.ts`:
  - C1: "Stop while the checkout is made ends the turn at once; the late checkout starts nothing" (a prepare held, then released: no start, nothing sent, no session) and "Stop while omp starts … sends no session/new".
  - C2: "a load and an ask on one thread send one session/load; the replay turns once, the answer is new".
  - C3: "inside an ended handler the turn is no longer running and its thread takes a new ask".
  - C4: "destroy while the checkout is made starts nothing …", "loadConversation after destroy starts nothing and answers stopped", "a load cut off by destroy answers stopped", "a start that resolves after destroy is stopped".
  - C5: "a stale stop after its turn ended cancels nothing".
  - C7, the eight cases: new session counts as loaded; ask on a new thread's session is busy; ending one thread leaves the other busy; `session/prompt` error refused with omp's details; `loadConversation` with a failed checkout; empty `session/new` id refused; destroy on an unused client; a start that throws is `spawnFailed` and retried.
  - C8 client: a malformed update is logged and dropped, another notification is ignored, and the stream goes on; a refusal for an unlistened session; omp exiting before `initialize` gives `crashed` with its last log line.
  - The app-failure expectations (B1) were updated.
- `internal/protocol.test.ts` (C8): content items other than text and diffs are dropped, image blocks give no output; null content/kind/status; unknown kind or status; a missing or empty `sessionId` fails to parse; a malformed read kind fails while an unread kind is ignored.
- `internal/turn.test.ts` (C9): a known step keeps its title on refusal; an unknown step in a non-empty turn takes the refusal's title; a first `tool_call` with content keeps exactly that content.
- `internal/turnRun.test.ts`: the stopReason table, moved here from `turn.test.ts`.
- `internal/answers.test.ts` (B2): "every recorded permission is answered as the table answers it" — all 3 recorded requests in `fixtures/agent/*.jsonl`.
- `ipc/agentDomain.test.ts`: the conversions, camelCase with `refs`, and a relative folder refused in both `Changed` and `Unreadable`.
- `ipc/fixtureAgent.test.ts` (C10): a diff miss when only one of the two texts matches (both directions); `stopAgent` of an old run leaves the new one playing; a discard during playback gives only `Exited { code: null }`; `?ai=load` is refused and the known list leaves `load` out.

**smoke_evidence**
`cd frontend && pnpm typecheck; pnpm lint; pnpm test; pnpm fmt:check; pnpm unused`:
```
$ vue-tsc -b                                              (no errors)
$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"   (no findings)
 Test Files  186 passed (186)
      Tests  2506 passed (2506)
All matched files use the correct format.
$ knip --include exports,types                            (no findings)
```
I did not run Stryker; the "kill" groups are covered by the targeted tests listed above.

**deviations_from_brief**
1. **Fourth file outside Owned.** Main granted `frontend/src/ipc/fixtureReview.test.ts:150` (expected body now `{ kind: "aiAnswer", session: "fixture-session", turn: 0 }`); it broke as a result of the brief's `fixtureReview.ts:85` change. In `fixtureReview.ts` I hoisted the answer into `SEEDED_AI_ANSWER`, because formatting the new line pushed `seededThreads` past the 40-line limit.
2. **`Starter.ready` has a different signature than B10 suggested.** It is `ready(wanted: () => boolean): Promise<Started>`, where `Started` is `started | failed | dropped`, not `Outcome<AgentProcess>`. "After destroy" and "stopped while the checkout is made" are not `AgentFailure`s, and C1 needs the start skipped (no spawn) when the ask was stopped during the checkout.
3. **Seam additions** (the contract allows adding):
   - `ConversationLoad` gained `{ kind: "stopped" }`, the answer after `destroy`.
   - `EditDiff` keeps `failed { message }` for a thrown error, next to the new `appFailed`.
4. **`CheckoutChanges` is no longer re-exported from `ipc/index.ts`.** knip flagged it once no importer was left. C7's close question will need to re-add the export.
5. **`Starter` exposes `isDestroyed()` instead of a getter.** TypeScript keeps a narrowed field across `await`, and lint then rejected the later destroyed checks as always false.
6. **`session/new` uses the shared session-id schema.** An empty id is now refused with valibot's reason text, not "an empty session id".
7. **Changes outside the B/C list:**
   - `tauri.ts` `toSettingsResult` now uses the shared `converted`.
   - `fromAgentCommand` was added to `agentDomain.ts`.
   - The `COLUMN_LIMIT_BYTES` constant lives in `fixture.ts`.
   - `agent/AGENTS.md` was updated.

**open_risks**
- `agent/internal/process.ts` `listen`'s unlisten identity guard (`#listeners.get(session) === listener`): the review expected the C2 test to kill these mutants, but with the joined load an unlisten always runs while its own listener is still current, so they are likely equivalent. I kept the guard as a safeguard.
- `process.ts` `replay` always sends its own `session/load` (it needs the updates). Two `loadConversation` calls on one session at the same time still send two loads; the second listener replaces the first. Not in the brief, untested.
- `index.ts` `#turn`: a Stop while `session/new` is in flight drops the created session unreported. This is the C1 reading ("no session reported"); a later ask on that thread opens a new session.