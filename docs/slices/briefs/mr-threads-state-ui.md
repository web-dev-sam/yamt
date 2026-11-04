# Slice mr-threads-state-ui — one row's reload, resolved marks and the row count; the shown thread, its texts and sends

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: C5, C6 (texts kept), C7 (the preview's state), C8.3, C9, C10 (marks
  until close), D1–D3.
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.3, §1.4, §3.1 row #183, §3.2 (RK33, RK72), §4 items 8–10.
- Proposed plan §2 #183.

Runs in wave 6, after `mr-threads-state-ipc`. `mr-threads-panel` and `mr-threads-box` render what this slice holds.

## Target

**Owned:**

- `frontend/src/ui/mergeRequestDiscussions.ts` (+ `.test.ts`)
- `frontend/src/ui/mergeRequestThread.ts` (new, + `.test.ts` new)
- `frontend/src/ui/mergeRequestReload.test.ts` (new: the slice-level reload and count tests)
- `frontend/src/ui/mergeRequests.ts`
- `frontend/src/ui/problem.ts`, `frontend/src/ui/problemText.ts` (+ `.test.ts`)

**Read-only:** everything else.

- `frontend/src/ipc/**`: `mr-threads-state-ipc`'s; use the source and the fixture as contracted.
- `frontend/src/ui/mergeRequests.test.ts`: its source has the five members already; add no test there (yours go in
  `mergeRequestReload.test.ts`, building the slice over `createFixtureCompareSource(log, "?mr=list", {})` with
  overrides, as `mergeRequests.test.ts:990`).
- `frontend/src/ui/mergeRequestActions.ts` (`setRow`, `useAskedRow`), `ui/mergeRequestDescriptions.ts`
  (`imageAddress`): use as they are.
- `frontend/src/mergeRequests/**`, `ui/*.vue`: later slices'.
- `docs/**`, `ui/AGENTS.md`: lines in `deviations_from_brief` (`mr-threads-box` writes `ui/AGENTS.md`).

**Non-goals:** words beyond the problem steps (the panel's and box's slices); the turn rule; any component.

## Contract

Fixed; you may add, never change.

### The queue (`ui/mergeRequestDiscussions.ts`)

```ts
export type DiscussionLoad =
  | { readonly kind: "loading" }
  | {
      readonly kind: "read";
      readonly discussions: readonly OpenDiscussion[];
      /** Resolved through the panel since this answer: shown marked until the box closes (C10). */
      readonly resolved: ReadonlySet<DiscussionId>;
    }
  | { readonly kind: "refused"; readonly answer: … }   // as today
  | { readonly kind: "failed"; readonly cause: ProblemCause };
/** A row's reload (D1): running, or why its answer was not taken (the old entry stays, D2). */
export type Reload = { readonly kind: "running" } | DiscussionFailure;

export type Discussions = {
  // …today's three members, and:
  readonly reloads: Readonly<ShallowRef<ReadonlyMap<MergeRequestIid, Reload>>>;
  /** D1: asks GitLab again for `iid` alone, first in the queue; the entry stays as it is until the answer. */
  reloadDiscussions(iid: MergeRequestIid): void;
  /** A thread's answer (C8.3, C10): `discussion` replaces the entry's discussion with its id (none: nothing);
   *  `resolved` adds or removes its mark. Nothing for an entry that is not `read`. */
  threadRead(iid: MergeRequestIid, discussion: OpenDiscussion, resolved: boolean): void;
  /** C10: the box of `iid` closed: marked discussions leave its entry, and the row's count becomes the rest. */
  boxClosed(iid: MergeRequestIid): void;
};
export function createDiscussions(deps: {
  readonly source: MergeRequestSource;
  readonly mode: () => DiscussionDetails;
  readonly rows: () => readonly MergeRequestRow[];
  /** The row's open-discussions count as a reload or a box close found it (D2, C10). */
  readonly counted: (iid: MergeRequestIid, count: number) => void;
}): DiscussionQueue;
```

- **Reload.** An entry that is `read`, `refused` or `failed` keeps it; `reloads` gets `running`; the iid goes first
  among `queued` (once). No entry or `loading`: as `askDiscussions` does today, whatever the mode but "off" (then
  nothing). One call at a time through today's `send` (no second path; the generation drops an answer after a list
  refresh, RK72). The answer: `open` → entry `read` with no marks, reload removed, `counted(iid, discussions.length)`;
  `refused` or a failed call → entry unchanged, `reloads` the failure. `settle` keeps an iid queued while its entry is
  `loading` **or** its reload is `running` and unanswered. `replaced`/`dropped` clear `reloads`.
- **Marks.** `boxClosed(iid)`: a `read` entry with marks loses those discussions and its marks, then
  `counted(iid, rest)`; without marks nothing changes and `counted` is not called.
- One log line per reload answer: `mergeRequests.discussions_reloaded { iid, kind, ms }` (today's `discussions_read`
  stays for the batch).

### The slice (`ui/mergeRequests.ts`)

- `withPeople` (`:99-107`) becomes `withRow(state, iid, partial: Partial<Pick<MergeRequestRow, "assignees" |
  "reviewers" | "openDiscussions">>)`: the one row patcher, of `rows` and a buffering refresh's buffer; its two callers
  and `counted` use it.
- `MergeRequests` gains `Threads` (below) and the queue's three members; `reloadDiscussions(iid)` exposed by the slice
  also re-reads the shown thread when it is on `iid` (D3); `rowsReplaced` also re-reads the shown thread (C2: a list
  refresh refreshes the panel).

### The thread (`ui/mergeRequestThread.ts`)

```ts
export type ShownThread = { readonly iid: MergeRequestIid; readonly discussion: DiscussionId };
export type ThreadLoad =
  | { readonly kind: "loading" }
  /** `refreshing`: read again (after a write, a reload, a refresh); the old thread stays shown meanwhile. */
  | { readonly kind: "read"; readonly thread: DiscussionThread; readonly refreshing: boolean }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<DiscussionThreadReply, { readonly kind: "read" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type WriteKind = "comment" | "draft" | "resolve" | "unresolve" | "submit";
export type WriteFailure =
  | Exclude<DiscussionWriteReply, { readonly kind: "sent" }>
  | { readonly kind: "ipc"; readonly cause: ProblemCause };
export type Sending =
  | { readonly kind: "idle" }
  | { readonly kind: "sending"; readonly what: WriteKind }
  | { readonly kind: "failed"; readonly what: WriteKind; readonly failure: WriteFailure };
export type Preview =
  | { readonly kind: "writing" }
  | { readonly kind: "empty" } // "Nothing to preview." — no call
  | { readonly kind: "loading" }
  | { readonly kind: "read"; readonly preview: Description }
  | {
      readonly kind: "refused";
      readonly reply: Exclude<MarkdownPreviewReply, { readonly kind: "read" }>;
    }
  | { readonly kind: "failed"; readonly cause: ProblemCause };
export type Thread = {
  readonly shown: ShownThread;
  readonly load: ThreadLoad;
  readonly sending: Sending;
  readonly preview: Preview;
};
export type Threads = {
  /** The window's one thread panel; null when none is shown. */
  readonly thread: Readonly<ShallowRef<Thread | null>>;
  /** C6: each discussion's unsent text for the window's life; cleared only by a `sent` reply or draft. */
  readonly replyTexts: Readonly<ShallowRef<ReadonlyMap<DiscussionId, string>>>;
  setReplyText(discussion: DiscussionId, text: string): void;
  /** C1, C5: shows `discussion` and reads it afresh (loading first); the one already shown: nothing. */
  showThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  closeThread(): void;
  retryThread(): void;
  /** C8: one send at a time; a blank text or a send under way → nothing. */
  sendReply(kind: ReplyKind): Promise<void>;
  /** C10: resolve (true) or reopen (false); never sends the text. */
  setResolved(resolve: boolean): Promise<void>;
  /** C9: publishes every pending draft of the merge request. */
  submitReview(): Promise<void>;
  showPreview(): void; // C7
  showWrite(): void;
};
export function createThreads(deps: {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<Discussions, "threadRead" | "reloadDiscussions">;
}): Threads & { refreshed(iid: MergeRequestIid | null): void /* null: any shown thread */ };
```

- **Generation.** Every show, close and re-read bumps a counter; an answer for an older one changes only the box
  (`threadRead` when it is `read`), never the panel (RK67, RK72).
- **A read answer** `read` → `load` read (refreshing false) and `discussions.threadRead(iid, thread.discussion,
  thread.resolved)`; other replies → `refused`; an ipc failure → `failed` (in-panel; never `report`).
- **Sends.** `sending` → the source call → `sent`: comment/draft clear the text and set `preview` writing; every kind
  then re-reads the thread (refreshing); `submit` also `reloadDiscussions(iid)` (C9). `refused` → `sending` failed,
  no re-read. Any other failure (`failed`, `glabMissing`, `notLoggedIn`, ipc) → `sending` failed **and** a re-read
  (design §4 item 9, RK33: a timed-out write may have landed). The add buttons are enabled only when `sending` is not
  `sending` and `load` is `read` with `refreshing` false.
- **Preview.** `showPreview`: a blank text → `empty`; else `loading` → `previewMarkdown` → `read`/`refused`/`failed`.
  `showWrite` → `writing`. Changing the text while previewing sets `writing`.
- Log lines: `mergeRequests.thread_read { iid, kind, comments, ms }`, `mergeRequests.thread_write { iid, what, kind,
  ms }`, `mergeRequests.preview_read { iid, kind, ms }`; never text, names or ids.

### Problem steps (`ui/problem.ts`, `ui/problemText.ts`)

`MergeRequestStep` gains `"thread"` ("Could not read the thread"), `"reply"` ("Could not add the comment"),
`"draft"` ("Could not add the review comment"), `"resolveThread"` ("Could not resolve the thread"),
`"unresolveThread"` ("Could not unresolve the thread"), `"submitReview"` ("Could not submit the review"), `"preview"`
("Could not preview"); the panel shows `problemText` at that step for an ipc failure.

## Change

1. `problem.ts`, `problemText.ts` (+ test).
2. The queue: `Reload`, marks, `reloadDiscussions`, `threadRead`, `boxClosed`, `counted`; its tests.
3. `mergeRequestThread.ts` and its tests (a hand-built source with deferred promises, as
   `mergeRequestDescriptions.test.ts:55`).
4. `mergeRequests.ts`: `withRow`, `counted`, `createThreads`, the D3 and refresh hooks; `mergeRequestReload.test.ts`.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches, at least:

- queue: `a_reload_keeps_the_rows_until_its_answer` (**owns D2's "rows stay"**), `a_reload_sets_the_rows_count`
  (**owns D2's "count set"**), `a_failed_reload_keeps_the_rows_and_says_why` (**owns D2's failure**),
  `a_reload_goes_first_and_once`, `a_reload_after_a_refresh_is_dropped` (RK72),
  `a_resolved_row_stays_until_the_box_closes_then_the_count_drops` (RK72; supports C10),
  `a_thread_answer_replaces_its_discussion_in_the_box` (C8.3), `closing_a_box_without_marks_changes_nothing`
- thread: `each_open_reads_the_thread_afresh` (**owns C5**), `a_failed_read_retries` (**owns C5's Retry**),
  `an_answer_for_a_thread_no_longer_shown_changes_only_the_box` (RK72), `texts_are_kept_per_discussion_until_sent`
  (C6), `a_second_send_while_one_runs_sends_nothing`, `a_refused_send_keeps_the_text_and_reads_nothing`,
  `a_failed_send_reads_the_thread_again_before_another_send` (RK33),
  `submit_publishes_then_reloads_the_thread_and_the_row` (**owns C9**), `a_failed_submit_keeps_the_drafts_pending`
  (**owns C9's failure**), `resolve_sends_no_text_and_rereads`, `a_blank_preview_is_empty_without_a_call` (C7),
  `a_preview_failure_keeps_the_text`
- slice (`mergeRequestReload.test.ts`): `a_reload_reads_the_shown_thread_again` (**owns D3**),
  `a_thread_resolved_elsewhere_reads_resolved_and_keeps_its_text` (**owns D3's "Resolved"**),
  `a_list_refresh_rereads_the_shown_thread`, `withRow_patches_the_buffer_of_a_buffering_refresh`
- `problemText.test.ts`: each new step's words.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD`.

**Smoke:** none in the window (no component reads the new state yet); the slice-level tests run over the `?mr=list`
fixture source.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK33, RK67, RK72),
`skill://verification`.
