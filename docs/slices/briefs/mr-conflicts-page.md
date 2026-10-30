# Slice MrConflictsPage — the rows' size, readiness icon, Resolve and Continue; the feature wired end to end

Feature: merge-request conflicts (request `docs/slices/request-mr-conflicts.md` rules 1–5, 8, 9 — with the owner's
#1997 "Continue merging" and #1998 "conflicts first"; design `docs/slices/briefs/mr-conflicts-design.md` option A —
§1 "The page and its Rust side", §2 "Words", "Icons", "The row's action rule", §4.5 entirely except "Merge window",
§4.6 "TS", §4.7 "Web, node", "WebKit fixture steps" (page) and "Real app"). Starts when `MrConflictsWindow` is committed
(it uses `ui/leftoverText.ts` and starts on a green tree). This build completes the feature: its commit starts the
verifier's smoke pass.

## Target

Owned: `frontend/src/ipc/{MergeRequestSource.ts,tauriMergeRequests.ts,fixtureMergeRequests.ts,
fixtureMergeRequests.test.ts,AGENTS.md}`, new `frontend/src/ipc/tauriResolve.test.ts`;
`frontend/src/ui/{mergeRequests.ts,mergeRequests.test.ts,mergeRequestsText.ts,mergeRequestsText.test.ts,
MergeRequestRow.vue,MergeRequestsView.vue,AGENTS.md}`, new `frontend/src/ui/MergeRequestReadiness.vue`;
`frontend/src/mergeRequests/{index.ts,AGENTS.md}`, new `frontend/src/mergeRequests/internal/{readiness.ts,
readiness.test.ts,size.ts,size.test.ts,rowAction.ts,rowAction.test.ts}`. For #2015 (below):
`frontend/src/ipc/{domain.ts,mergeRequestDomain.ts,index.ts}`, new `frontend/src/ipc/localMergeDomain.ts`, and the
`import` lines only of any other file that imports the moved names.

Read-only: everything else — `ipc/fixtureMergeRequestData.ts` (`MrConflictsGitlab`: the row cycle),
`ui/leftoverText.ts` (`MrConflictsWindow`), `ipc/tauriMergeRequests.test.ts` (`MrConflictsGitlab`; your three new
methods are tested in `tauriResolve.test.ts`).

**#2015 first** (`just findings 2015`; the app build's finding, moved here because it reaches the merge window's
imports): the local-merge aliases (`MergeView`, `ReturnTo`, `BranchBefore`, `Leftover`, `AbortReply`, `PushReply`,
`Started`, `Refusal`, `LocalMerge`) move from `mergeRequestDomain.ts` to new `ipc/localMergeDomain.ts`, which imports
only `bindings`; `domain.ts`'s `Listing.mergeRequest` uses its `MergeView` (one spelling); `index.ts` exports them from
there; importers follow (clean cutover, no re-export left behind).

Non-goals: Rust; the merge window.

## Contract

Fixed (existing after `MrConflictsApp`/`MrConflictsWindow`): `MergeRequestRow.size: ChangeSize | null`, `.readiness:
Readiness` (`{ kind: "conflicts"; also: BlockedReason[] }` among the others), `.fromFork: boolean`; `ResolveReply`,
`Started`, `Refusal` (`alreadyMerging { iid: number | null }`), `ResolveRefusal`, `ContinueMergeReply` (`opened {
branch, target }` | `alreadyOpen` | `ended` | `windowFailed { message }`), `LocalMerge` (`free` | `merging { iid,
windowOpen }`); commands `resolveMergeRequest(iid) → ResolveReply`, `continueMergeRequest(iid) → ContinueMergeReply`,
`findLocalMerge() → LocalMerge`; `leftoverText(leftover): string`.

Yours:

- `MergeRequestSource` gains `resolveMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ResolveReply>>`,
  `continueMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ContinueMergeReply>>` and `findLocalMerge():
  Promise<SourceResult<LocalMerge>>`.
- `mergeRequests/index.ts` exports `sizeText(size: ChangeSize): string`, `sizeTitle(size: ChangeSize): string`,
  `readinessText(readiness: Readiness): string`, `readinessIcon(readiness: Readiness): ReadinessIcon` (`"circle-check" |
  "git-merge-conflict" | "git-compare-arrows" | "hourglass" | "circle-slash"`), and `rowAction(row, localMerge,
  running: boolean): RowAction` with

  ```ts
  type ActionState =
    | { kind: "enabled" }
    | { kind: "running" }
    | { kind: "disabled"; hover: string };
  type RowAction =
    | { kind: "none" }
    | { kind: "resolve"; label: string; state: ActionState } // "Resolve conflicts of !12"
    | { kind: "continue"; label: string; state: ActionState }; // "Continue merging !12"
  ```

  — words, icons and the rule exactly as design §2 ("Words" with conflicts' `also` — "Has conflicts. Also blocked: "
  and the reasons joined by "; " —, "Icons", "The row's action rule": Continue on the merging row whatever its
  readiness, disabled "Its merge window is already open" while `windowOpen`; then no button unless `conflicts`; fork,
  then another merge "The merge of !21 is not finished in this repository", then running).

- Page state (`ui/mergeRequests.ts`): `RowReply = { kind: "resolve"; reply: ResolveReply } | { kind: "continue"; reply:
  ContinueMergeReply }`, `RowActing = { kind: "running" } | { kind: "replied"; reply: RowReply }`, `actions:
  Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, RowActing>>>` (as `openings`, one entry per row, replaced by the next
  click), `localMerge: Readonly<ShallowRef<LocalMerge>>` (starts `free`), `resolve(iid)`, `continueMerge(iid)`,
  `checkLocalMerge()`. `localMerge` is read at `show()`, by `checkLocalMerge()` (called from the view on the window's
  `focus` event while the page is shown) and after every resolve or continue reply. A source failure (IPC error) is the
  page's existing `report` path; `findLocalMerge` failing leaves `localMerge` as it was. A click while that row runs
  sends nothing.
- `ui/mergeRequestsText.ts` `rowReplyText(reply: RowReply, iid): { text: string; refused: boolean }` — every sentence
  of design §4.5 "Texts" (row replies, both `alreadyMerging` forms, continue replies), `gitRefused`'s leftovers through
  `leftoverText` joined by "; ", the existing glab sentences for `glabMissing`/`notLoggedIn`/`failed`. `refused` is
  false for `started`, `opened`; true for the rest.

Display (design §4.5 "Components"): the row's meta line gains `sizeText` (`title` = `sizeTitle`) when `size` is not
null; `MergeRequestReadiness.vue` is a `w-7` column right of the CI box: the icon (Lucide, as the CI box's icons are
drawn) with `title` and `aria-label` = `readinessText`; the row's action button left of the open-changes button —
Resolve with icon `git-merge`, Continue with icon `step-forward` —, `title`/`aria-label` = its label (the hover replaces
the title when disabled), disabled through the `<span :title>` pattern of `OperationButtons.vue:21-35`, a spinner while
running (as the open-changes button's fetching state); the reply line under the row (`role="status"`, error colour only
when `refused`), as the open refusal line (`MergeRequestRow.vue:113-115`).

Fixture (`fixtureMergeRequests.ts`, `?mr=<script>`; rows from `MrConflictsGitlab`'s cycle: 640 conflicts, 639 conflicts
from a fork, 636 conflicts also discussions, 634 blocked draft, 620 conflicts also discussions and draft): resolve
replies by iid — 640 `started` with conflicts, 632 `started` clean (`conflicts: false`), 624 `refused` `localAhead {
branch: "feature/fixture-624" }`, 616 `windowFailed` with message "yamt: not found", any other conflicts row
`started`; branch `feature/fixture-<iid>`, target `main`; each after a pause as `openMergeRequest`. `findLocalMerge`
answers `free` until a started or windowFailed reply, then `merging { iid, windowOpen: false }`;
`continueMergeRequest(iid)` of that iid answers `opened { branch, target }` and from then `windowOpen: true`; of any
other iid `ended`.

AGENTS.md lines: `ui/AGENTS.md` — the page's row actions, their state and the rule-8/9 reads; plus the sentences
`MrConflictsWindow` reports in its `deviations_from_brief` (pushing.ts, the abort leftovers notice,
`QuestionText.cancel: null`, list kind `lines`), taken from its handoff; `ipc/AGENTS.md` — the three new source methods
and the fixture replies; `mergeRequests/AGENTS.md` — the three new internal files.

## Change

1. `mergeRequests/internal/{size,readiness,rowAction}.ts` + tests; `index.ts`.
2. Source methods: `MergeRequestSource.ts`, `tauriMergeRequests.ts` (+ `tauriResolve.test.ts`), the fixture (+ test).
3. `ui/mergeRequests.ts`, `ui/mergeRequestsText.ts` + tests.
4. `MergeRequestReadiness.vue`, `MergeRequestRow.vue`, `MergeRequestsView.vue`.
5. The three AGENTS.md files.

## Acceptance

- Node tests: `readiness.test.ts` (every `BlockedReason` and readiness → its words and icon; conflicts with an empty
  `also`, with one and with two reasons; `other` quotes GitLab's word), `size.test.ts` ("+120 −40 · 6 files" with
  U+2212, "1 file", the title's singulars), `rowAction.test.ts` (Continue on the merging row even when its readiness is
  ready or blocked; Continue disabled while its window is open; Continue running; no button unless conflicts; fork wins
  over another merge; another merge names its iid; running; enabled), `mergeRequests.test.ts` (a resolve's and a
  continue's running → replied; a second click while running sends nothing; `localMerge` read at show, at
  `checkLocalMerge` and after each kind of reply), `mergeRequestsText.test.ts` (every `ResolveReply` and
  `ContinueMergeReply` kind, both `alreadyMerging` forms, `gitRefused` with and without leftovers),
  `fixtureMergeRequests.test.ts` (the four scripted replies; `findLocalMerge` after a start; continue `opened` then
  `windowOpen: true`, another iid `ended`), `tauriResolve.test.ts` (the three commands' replies and failures unchanged).
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `sfc-order`, `test` (paste the summary lines).
- WebKit fixture smoke (`just app-session start-fixture --name p --diff --mr list`, open the page): `read` row !640's
  size text and readiness `aria-label` ("Has conflicts"), !636's ("Has conflicts. Also blocked: discussions are
  unresolved") and that it has no size, !639's Resolve hover "Resolving a fork's merge request is not supported";
  click "Resolve conflicts of !640" → "Merging main into feature/fixture-640 in a new window."; !640's button is now
  "Continue merging !640" and every other enabled Resolve is disabled with "The merge of !640 is not finished in this
  repository"; click Continue → "Merging main into feature/fixture-640 in a new window." and the button disabled "Its
  merge window is already open"; `shot` the page after each click. Name the shots.
- Real-app smoke, design §4.7 "Real app" steps 1–7, after `cargo tauri build --debug --no-bundle` and
  `scripts/mr-conflict-repo.sh /var/tmp/yamt-mrc`: run at least steps 1, 2 (with its Continue part) and 4 yourself
  (`just app-session start-app --name c --diff --dir /var/tmp/yamt-mrc --glab mr-conflicts`, then `start-app --name m
  --repo /var/tmp/yamt-mrc`), paste the `git` outputs and name the shots; the verifier runs all seven.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://ipc-contract`, `skill://verification`.
