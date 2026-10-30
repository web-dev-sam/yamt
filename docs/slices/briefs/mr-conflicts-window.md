# Slice MrConflictsWindow — the merge window: Abort that restores, Commit merge that asks to push

Feature: merge-request conflicts (request `docs/slices/request-mr-conflicts.md` rules 5–7; design
`docs/slices/briefs/mr-conflicts-design.md` option A — §1 "The merge window", §4.3, §4.4, §4.5 "Sources", "Merge
window", "Texts" (abort, leftovers, push), "Fixture scripts" (merge window), §4.6 "TS", §4.7 "Web, node" and "WebKit
fixture steps" (merge window)). Starts when `MrConflictsApp` is committed and the orchestrator has regenerated
`frontend/src/ipc/bindings.ts`.

## Target

Owned: `frontend/src/ipc/{ChunkSource.ts,tauri.ts,tauri.test.ts,fixture.ts,fixtureOperations.ts,
fixtureOperations.test.ts}`; `frontend/src/ui/{listing.ts,listing.test.ts,store.ts,store.test.ts,aborting.ts,
aborting.test.ts,continuing.ts,continuing.test.ts,question.ts,question.test.ts,QuestionDialog.vue,operationText.ts,
operationText.test.ts,diskChanges.test.ts,saving.test.ts,stops.test.ts}`; new `frontend/src/ui/{pushing.ts,
pushing.test.ts,leftoverText.ts,leftoverText.test.ts}`.

Read-only: everything else; `ipc/{domain.ts,mergeRequestDomain.ts,index.ts}` as `MrConflictsApp` left them (a missing
alias is a deviation to report, not to add). `ui/AGENTS.md` and `ipc/AGENTS.md` belong to `MrConflictsPage`: put the
sentences your change needs in `deviations_from_brief` and that build adds them.

**First repair** (design §5): after `MrConflictsApp` the web typecheck fails in your files only — `abortOperation`
now answers `AbortReply`, `Listing.Files` has `mergeRequest`, `ContinueReply` has `ReadyToPush`, and `ChunkSource`
fakes lack the two new methods. Make `pnpm -C frontend typecheck` green as your first step.

Non-goals: the merge-request page, including its "Continue merging !12" (`MrConflictsPage`); Rust, including the
window claim at start-up (`MrConflictsApp`: a second window on a recorded merge exits before any web code runs).

## Contract

Fixed (design §4.6 "TS", existing in the tree after `MrConflictsApp`): `AbortReply { leftovers: Leftover[] }`,
`PushReply`, `MergeView`, `ReturnTo`, `BranchBefore`, `Leftover`, `ContinueReply` `{ kind: "ReadyToPush"; branch }`,
`Listing` `Files.mergeRequest: MergeView | null`; commands `abortOperation() → AbortReply`, `pushMergedBranch() →
PushReply`, `closeEndedMerge() → null`.

Yours to fix, and `MrConflictsPage` reads it:

- `ChunkSource`: `abortOperation(): Promise<SourceResult<AbortReply>>`; new `pushMergedBranch():
  Promise<SourceResult<PushReply>>`, `closeEndedMerge(): Promise<SourceResult<null>>`.
- `ui/leftoverText.ts`: `export function leftoverText(leftover: Leftover): string` — the four sentences of design §4.5
  "Leftovers" (`ReturnTo` named as the branch, or "commit <id>"), the one wording of a leftover in the app.

Behaviour:

- `listing.ts` keeps `mergeRequest: MergeView | null` beside `operation`, from every listing.
- `aborting.ts`: the question is `{ kind: "abort"; operation; mergeRequest: MergeView | null }`; its words for a merge
  request are design §4.5 "Abort question" (message by `returnTo`, note by `branchBefore`), else today's.
  `endsApp: (reply) => reply.leftovers.length === 0`; with leftovers it asks `{ kind: "abortLeftovers"; leftovers }`
  (one button "Close", `cancel: null`), then calls `closeEndedMerge` whatever the answer (Escape too).
- `continuing.ts`: `endsApp` stays `Finished` only; `ReadyToPush { branch }` lands in `pushing.ts` without listing again
  (the app answers `MergeFinished` to `listStop` while committed).
- `pushing.ts` (`createPushing({ source, asking, gitRun, stop… })`): asks `{ kind: "push"; branch }` (Push / Keep
  Local); Push → `pushMergedBranch` through `gitRun` with `endsApp: (reply) => reply.kind === "Pushed"`; `Failed {
  message }` → asks `{ kind: "pushFailed"; branch; message }` (Push Again / Keep Local) and loops; Keep Local, Escape or
  a dismiss → `closeEndedMerge` once. Only the confirm answer pushes (RK45). A failed command (IPC error) → the
  existing problem line, then Keep Local's path.
- `question.ts`: the three new kinds and their texts (design §4.5 "Texts", exactly), `QuestionText.cancel: string |
  null`, the list kind `servers` renamed `lines` (its only users are `serversText`, the dialog and `question.test.ts`);
  `endsWithStop` is false for the three new kinds. `QuestionDialog.vue` draws the cancel button only when `cancel` is
  not null.
- `operationText.ts`: `allResolvedText` and the abort words stay; add only what `question.ts` needs for a merge
  request's abort, if anything, with tests.
- Fixture (`fixture.ts`, `fixtureOperations.ts`): `?operation=merge&mergeRequest=<created|moved|unchanged|detached|same>`
  lists `mergeRequest` (branch `feature/due-dates`, target `main`; `created` returns to branch `develop`, `moved` from
  `3f1c2a9`, `unchanged`, `detached` returns to commit `9b0d4e1`, `same` has `returnTo: null`); `&clean` lists no file;
  Continue on a merge-request stop answers `ReadyToPush`; `&push=rejected` answers the first push `Failed { message:
  "[rejected] (fetch first)" }`; `&leftovers` answers Abort with `[NotReturned { to: develop }, BranchKept {
  feature/due-dates }]`; after Pushed or `closeEndedMerge` every command answers `MergeFinished`, after Abort
  `MergeAborted` (as today).

## Change

1. The repair: `ChunkSource`, `tauri.ts` (+ its test), the fixture, every `ChunkSource` fake in the owned tests.
2. `leftoverText.ts`, `question.ts`, `QuestionDialog.vue`.
3. `listing.ts`, `aborting.ts`, `continuing.ts`, `pushing.ts`, wiring in `store.ts`.
4. Tests.

## Acceptance

- Node tests (design §4.7 "Web, node", by file): `leftoverText.test.ts` (each kind, a branch and a commit target);
  `question.test.ts` (abort words for each `BranchBefore` × return place; push, pushFailed with git's words, leftovers
  with one button; the `lines` list); `pushing.test.ts` ("Push pushes once", "Escape and Keep Local never push",
  "a failure asks again with git's words", "Pushed ends the app", "Keep Local closes once"); `aborting.test.ts`
  (leftovers → notice → `closeEndedMerge`; no leftovers ends as today); `continuing.test.ts` (`ReadyToPush` → the push
  question, no list, not ended); `fixtureOperations.test.ts` (each `mergeRequest` value lists its view; `clean`;
  `push=rejected` then Pushed; `leftovers`); `tauri.test.ts` (the three commands' replies unchanged); `store.test.ts`
  (a recorded merge's Abort and Continue through the store).
- `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`, `pnpm -C frontend
  sfc-order`, `pnpm -C frontend test` (paste the summary lines).
- WebKit fixture smoke (`just app-session start-fixture --name w`, then `read "location.assign('/?operation=merge&mergeRequest=created')"`):
  Abort → `shot` of the question "Abort the merge of main into feature/due-dates and return to develop?" with the
  note "yamt deletes feature/due-dates, which it created for this merge."; `…&mergeRequest=created&leftovers` → Abort →
  the one-button notice with both lines; `…&mergeRequest=created&clean&push=rejected` → Commit merge → "Push
  feature/due-dates to GitLab?" → Push → "Push Failed" with "[rejected] (fetch first)" → Keep Local → the window's
  ended state. Paste the `read` outputs and name the shots.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
