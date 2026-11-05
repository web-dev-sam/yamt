# Slice mr-person-discussions-threads — several shown threads in the one thread owner, and the panel's body reusable inline

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` E3, E4, E5 and "Reopens" (`state.md:89`, threads request C1–C2).
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.2, §2.3; proposed plan row #193, RK78.

Runs in round 1, in parallel with `mr-person-discussions-rust` and `mr-person-discussions-core`. It changes no visible
behaviour: the box's panel works as today; the inline host comes with `mr-person-discussions-view`. After it lands,
`mr-person-discussions-ipc` adds one field (`first`) to the hand-built discussion in `mergeRequestThread.test.ts`: keep
that literal in its one builder function (today `:80-90`).

Facts (given):

- `ui/mergeRequestThread.ts`: `Thread { shown, load, sending, preview }` (`:36-41`); `Threads.thread: ShallowRef<Thread |
  null>` "the window's one thread panel" (`:42-60`); private `generation` (window-wide) and `writing` (`:62-71`); `show`
  replaces the slot and marks the new thread `sending` while another write runs (`:138-143`); `write` refuses unless the
  slot is read, not refreshing and nothing is writing (`:164-197`); `sendReply(kind)`, `setResolved(resolve)`,
  `submitReview()`, `showPreview()`, `showWrite()`, `retryThread()` act on the slot (`:219-277`); `refreshed(iid | null,
  asked?)` re-reads the slot (`:279-300`); every `read` answer reaches the queue's `threadRead` (`:113-115`).
- `replyTexts` is per discussion for the window's life (`:46`, `:145-153`; `state.md:90`).
- Readers of `thread` outside the file: `MergeRequestDiscussions.vue:48, 79, 132, 147, 195`; `MergeRequestThread.vue:50,
  55`; `mergeRequestsShown.ts:54, 142` (`panelRow`); `mergeRequestsRefresh.ts:32, 46`. They type it as `Pick<Threads,
  "thread">`; the refresh and shown fakes in tests pass `shallowRef`s.
- `ui/MergeRequestThread.vue`: placement `useBesidePlacement(panel, anchor)` (`:52`), window Escape listener (`:53`,
  `keyPressed` `:106-119`), root `fixed z-10 h-[min(48rem,calc(100vh-2rem))] w-[min(40rem,calc(100vw-2rem))] …` (`:139`),
  header with Open on GitLab, Submit review (pending count), Close; body: comments, Pending drafts, note or refusal +
  Retry, then `MergeRequestReplyField` (`:180-219`).
- `ui/MergeRequestReplyField.vue`: props `{ thread: Thread; writable }`, emits `close`, `focusPanel` (`:36-37`); its
  actions take no discussion (`:44-45, 132-178`); `keepFocus` is the HTML focus-fixup guard (`:138-146`).
- The panel's rules (plan §2 #183, #185, #189, #191, RK72, RK73) stay exactly as they are.

## Target

**Owned:**

- `frontend/src/ui/mergeRequestThread.ts`, `frontend/src/ui/mergeRequestThread.test.ts`
- `frontend/src/ui/MergeRequestThread.vue`
- `frontend/src/ui/MergeRequestThreadBody.vue` (new), `frontend/src/ui/MergeRequestThreadButtons.vue` (new)
- `frontend/src/ui/MergeRequestReplyField.vue`
- `frontend/src/ui/MergeRequestDiscussions.vue` (only if a reader needs it; today's `thread` reads stay valid)
- `frontend/src/ui/MergeRequestThreadPanel.test.ts`, `frontend/src/ui/MergeRequestDiscussionsBox.test.ts`

**Read-only:** everything else. `ui/mergeRequests.ts`, `mergeRequestsShown.ts`, `mergeRequestsRefresh.ts` and their
tests are `mr-person-discussions-state`'s: they compile unchanged because `thread` keeps its name and reads as a
`Readonly<Ref<Thread | null>>` (a `shallowRef` fake still fits). `docs/**`, `.omp/skills/**`: lines in
`deviations_from_brief` (the docs keeper writes `state.md` rows 89–90).

**Non-goals:** the person view, its entries, the queue, any new word; changing what the panel shows or how it closes.

## Contract

Fixed. You may add, never change.

```ts
// ui/mergeRequestThread.ts — ShownThread, ThreadLoad, WriteKind, WriteFailure, Sending, Thread keep their shapes;
// Thread.sending is now that thread's own write only.
export type Threads = {
  /** Every thread shown, by discussion: the box's panel's and each expanded entry's (request E4). */
  readonly threads: Readonly<ShallowRef<ReadonlyMap<DiscussionId, Thread>>>;
  /** The box's panel's thread (`threads` at the panel's discussion); null when no panel shows. */
  readonly thread: Readonly<Ref<Thread | null>>;
  /** The person view's expanded entries, in expanding order. */
  readonly expanded: Readonly<ShallowRef<ReadonlySet<DiscussionId>>>;
  /** The write under way in the window, one at a time (C8, E4); null: none. */
  readonly writing: Readonly<ShallowRef<WriteKind | null>>;
  /** C6: each discussion's unsent text for the window's life (absent: none); cleared only by a `sent` reply or draft. */
  readonly replyTexts: Readonly<ShallowRef<ReadonlyMap<DiscussionId, string>>>;
  setReplyText(discussion: DiscussionId, text: string): void;
  /** C1, C5: the panel shows `discussion`, read afresh (loading first); the one already in the panel: nothing; a thread
   *  an entry shows is shared, not read again. The panel's previous thread is dropped unless an entry shows it. */
  showThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** The panel closes; its thread is dropped unless an entry shows it. */
  closeThread(): void;
  /** E3: the entry expands, its thread read afresh (loading first); already expanded: nothing; one the panel shows is
   *  shared, not read again. */
  expandThread(iid: MergeRequestIid, discussion: DiscussionId): void;
  /** E2, E4: the entry collapses; its thread dropped unless the panel shows it; its text stays. Not expanded: nothing. */
  collapseThread(discussion: DiscussionId): void;
  retryThread(discussion: DiscussionId): void;
  /** C8: one send at a time in the window; a blank text, a send under way, or a thread not read → nothing. */
  sendReply(discussion: DiscussionId, kind: ReplyKind): Promise<void>;
  /** C10: resolve (true) or reopen (false); never sends the text. */
  setResolved(discussion: DiscussionId, resolve: boolean): Promise<void>;
  /** C9: publishes every pending draft of the discussion's merge request. */
  submitReview(discussion: DiscussionId): Promise<void>;
  showPreview(discussion: DiscussionId): void;
  showWrite(discussion: DiscussionId): void;
};

/** The one rule both hosts use: read, not refreshing, and no write under way in the window. */
export function isWritable(thread: Thread, writing: WriteKind | null): boolean;

export function createThreads(deps: {
  readonly source: MergeRequestSource;
  readonly discussions: Pick<DiscussionQueue, "threadRead" | "reloadDiscussions">;
}): Threads & {
  /** Every shown thread of `iid` (all for null) read again; `asked` first when given. */
  readonly refreshed: (iid: MergeRequestIid | null, asked?: Promise<void>) => void;
};
```

```ts
// ui/MergeRequestThreadBody.vue
defineProps<{
  thread: Thread;
  /** The merge request's author's username (null: unknown): the crown. */
  author: string | null;
  now: number;
  /** "beside": the comments scroll and the field sits at the bottom (the panel); "inline": natural height (an entry). */
  placement: "beside" | "inline";
}>();
defineEmits<{ cancel: []; focusHost: [] }>();

// ui/MergeRequestThreadButtons.vue — Open on GitLab (the first comment's page) and Submit review (pending count)
defineProps<{ thread: Thread }>();
defineEmits<{ focusHost: [] }>();

// ui/MergeRequestReplyField.vue
defineProps<{ thread: Thread; writable: boolean }>();
defineEmits<{ cancel: []; focusHost: [] }>();
```

### Rules (design §2.2)

- A record exists in `threads` exactly while the panel (a private `panel: DiscussionId | null`) or `expanded` names it.
- **Read tokens:** a private `Map<DiscussionId, number>` replaces `generation`. Every show, expand, retry and re-read takes a
  new token for its discussion (one window-wide counter); an answer patches its record only while the record exists and
  the token is still that discussion's latest. Every `read` answer still reaches `discussions.threadRead`.
- **Writes:** `write` takes the record of `discussion`; refuses unless `isWritable(record, writing)`; sets `writing`, the
  record's `sending`; after the answer: `writing` null, the record's `sending` idle or failed (only if the record still
  exists), the text cleared when GitLab took it and it is unchanged, then a re-read of that discussion unless refused, and
  for a sent submit `reloadDiscussions(iid)`. No record but the written one changes.
- `setReplyText` sets the preview back to writing for that discussion's record only. A preview answer lands only while that
  record's preview is still the `loading` it started.

## Change

1. `mergeRequestThread.ts` per the Contract and Rules; the `show` trick of marking a new thread `sending` goes.
2. Split `MergeRequestThread.vue`: the shell keeps the dialog root, `useBesidePlacement`, the window Escape listener (its
   conditions unchanged), focus on mount and the header (place, Resolved/turn, `MergeRequestThreadButtons`, Close); the
   comments, drafts, Loading/refusal/Retry and the reply field move to `MergeRequestThreadBody.vue`. `beside` reproduces
   today's classes exactly (`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-2` for the
   comments, the field at the bottom); `inline` drops `min-h-0 flex-1 overflow-y-auto overscroll-contain`.
3. `MergeRequestReplyField.vue`: every action with `thread.shown.discussion`; `writable` from the host; emits `cancel`
   (the `boxKeydown` cancel) and `focusHost` (renamed from `close`/`focusPanel`, every caller migrated).
4. Update the panel and box SSR tests for the new calls (`setResolved(d(2), true)`, `sendReply(d(1), "comment")`, …).

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches (RK78):

- `mergeRequestThread.test.ts` (a fake source with held answers):
  - `two_expanded_threads_read_and_write_apart`: expand d01 and d02; answers in reverse order land in their own records;
    a comment on d02 sends d02's text, re-reads d02 only.
  - `one_write_at_a_time_across_threads`: a send on d01 running → `writing` set, d02's send sends nothing, both records
    not writable by `isWritable`.
  - `a_collapsed_threads_late_answer_is_dropped`: collapse while loading → no record after the answer; `threadRead` still
    got it.
  - `re_expanding_reads_afresh`: collapse, expand → a new `loading` and one more read.
  - `an_expansion_leaves_the_panel_alone`: the panel on d01, expand d02 → `thread` still d01, unchanged object.
  - `the_panel_and_an_entry_share_one_thread`: panel on d01, expand d01 → no second read; close the panel → the record
    stays; collapse → gone.
  - `the_text_outlives_a_collapse` (C6, E4).
  - `refreshed_rereads_every_shown_thread_of_the_row`.
  - Today's panel tests keep passing with the new arguments.
- `MergeRequestThreadPanel.test.ts`: today's assertions unchanged (the split renders the same panel), plus
  `the_inline_body_has_no_inner_scroller`: `MergeRequestThreadBody` with `placement="inline"` renders the comments and the
  field without `overflow-y-auto`.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD` (kill every
survivor on changed lines in `mergeRequestThread.ts`).

**Smoke (WebKit fixture, the panel unchanged):** `just app-session start-fixture --name mpt --diff --mr list --open-mr
--size 1600x1000`; !637's box, Shift over d01: the panel opens left of the box; type, Add comment → one `fixture_write {
kind: comment }`; Resolve thread → one `fixture_write { kind: resolve }`; Preview shows; Escape in the field → the panel
closes, focus on d01's row, the page stays; Escape → the box closes. `shot` dark.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK72, RK73, RK78 proposed),
`skill://verification`.
