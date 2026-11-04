# Slice mr-threads-state-ipc — the five source methods, the domain, and fixtures that answer like GitLab

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: the WebKit fixture acceptance (the data it shows), C5, C7–C10, D.
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.1–§1.4, §2 option A's data structures, §4.
- Proposed plan §2 #179–#184.

Runs in wave 5, after `mr-threads-app` **and** the orchestrator's `just bindings` (commit the regenerated
`bindings.ts` with this slice: the type check is red until it lands). `mr-threads-state-ui` builds on it.

## Target

**Owned:**

- `frontend/src/ipc/MergeRequestSource.ts`, `frontend/src/ipc/index.ts`, `frontend/src/ipc/domain.ts`
- `frontend/src/ipc/mergeRequestDomain.ts` (+ `.test.ts`), `frontend/src/ipc/descriptionDomain.ts` (+ `.test.ts`)
- `frontend/src/ipc/tauriMergeRequests.ts` (+ `.test.ts`)
- `frontend/src/ipc/fixtureMergeRequestThreads.ts` (new, + `.test.ts` new)
- `frontend/src/ipc/fixtureMergeRequestDiscussions.ts` (+ `.test.ts`), `frontend/src/ipc/fixtureMergeRequestDescriptions.ts`
  (+ `.test.ts`), `frontend/src/ipc/fixtureMergeRequests.ts` (+ `.test.ts`), `frontend/src/ipc/fixtureMergeRequestData.ts`
- `frontend/src/ipc/AGENTS.md`
- `frontend/src/ui/mergeRequests.test.ts` (the hand-built source's five new members only, line ~167)

**Read-only:** everything else.

- `frontend/src/ipc/bindings.ts`: generated (PM4); the orchestrator hands it to you.
- `frontend/src/mergeRequests/**`: `mr-threads-box`'s. The core declares its own structural `OpenDiscussion`
  (`mergeRequests/internal/discussions.ts:4-12`, `place` and `last` only), so the ipc type with more fields stays
  assignable and nothing there changes.
- `frontend/src/ui/**` other than the one test file: later slices'.
- `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** any `ui/` state or component; the turn rule; real Markdown rendering in the fixture.

## Contract

Fixed; you may add, never change.

```ts
// domain.ts
export type DiscussionId = Brand<string, "DiscussionId">;
export function isDiscussionId(text: string): text is DiscussionId; // /^[0-9a-f]{40}$/u

// mergeRequestDomain.ts — beside today's DiscussionNote / OpenDiscussion (`:75`)
export type Mention = Readonly<Generated.Mention>;
export type DiscussionNote = { …today; readonly mentions: readonly Mention[] };
export type TurnComment = { readonly author: Person | null; readonly mentions: readonly Mention[] };
export type OpenDiscussion = {
  readonly id: DiscussionId;
  readonly place: DiscussionPlace;
  readonly earlier: readonly TurnComment[];
  readonly last: DiscussionNote;
};
export type NoteEdit = { readonly at: number /* ms */; readonly by: Person };
export type DiscussionComment = {
  readonly author: Person | null;
  readonly createdAt: number; // ms
  readonly edited: NoteEdit | null;
  readonly body: Description; // descriptionDomain's, pages branded
  readonly page: WebPage | null;
};
export type PendingDraft = Readonly<Generated.PendingDraft>;
export type Commenting = Generated.Commenting; // "allowed" | "locked" | "notAllowed"
export type DiscussionThread = {
  readonly discussion: OpenDiscussion;
  readonly resolved: boolean;
  readonly comments: readonly DiscussionComment[];
  readonly drafts: readonly PendingDraft[];
  readonly pending: number;
  readonly commenting: Commenting;
  readonly mayResolve: boolean;
};
export type DiscussionThreadReply =
  | { readonly kind: "read"; readonly thread: DiscussionThread }
  | Readonly<Exclude<Generated.DiscussionThreadReply, { kind: "read" }>>;
export type ReplyKind = Generated.ReplyKind; // "comment" | "draft"
export type DiscussionWriteReply = Readonly<Generated.DiscussionWriteReply>;
export type MarkdownPreviewReply =
  | { readonly kind: "read"; readonly preview: Description }
  | Readonly<Exclude<Generated.MarkdownPreviewReply, { kind: "read" }>>;
export function toDiscussionThreadReply(raw: Generated.DiscussionThreadReply, uploadedPicture: UploadedPicture)
  : DiscussionThreadReply; // ids, pages, people and times as toRowDiscussions converts them
export function toMarkdownPreviewReply(raw: Generated.MarkdownPreviewReply): MarkdownPreviewReply;

// descriptionDomain.ts
export function toDescription(raw: Generated.Description, field: string): Description; // today's body of toDescriptionReply
export type ImageSize = Readonly<Generated.ImageSize>; // inline `image` gains `size: ImageSize | null`, passed as sent

// MergeRequestSource.ts — five members, each documented with its plan row
readDiscussionThread(iid: MergeRequestIid, discussion: DiscussionId): Promise<SourceResult<DiscussionThreadReply>>;
replyToDiscussion(iid: MergeRequestIid, discussion: DiscussionId, kind: ReplyKind, text: string)
  : Promise<SourceResult<DiscussionWriteReply>>;
resolveDiscussion(iid: MergeRequestIid, discussion: DiscussionId, resolve: boolean)
  : Promise<SourceResult<DiscussionWriteReply>>;
submitReview(iid: MergeRequestIid): Promise<SourceResult<DiscussionWriteReply>>;
previewMarkdown(iid: MergeRequestIid, text: string): Promise<SourceResult<MarkdownPreviewReply>>;
```

- `toRowDiscussions` brands each `id` (`isDiscussionId`; anything else throws, as `toWebPage` does) and converts
  `earlier[].author` and `last.mentions` as sent.
- `tauriMergeRequests.ts` calls `commands.readDiscussionThread(iid, discussion)`, `replyToDiscussion(iid, discussion,
  kind, text)`, `resolveDiscussion(iid, discussion, resolve)`, `submitReview(iid)`, `previewMarkdown(iid, text)`.

### The fixture (`?mr=list`; fixture data `fixtureMergeRequestData.ts`)

**Rows.** !637 (index 3, author dmitri) gets `openDiscussions: 13`, !636 (index 4, author sam) `openDiscussions: 3`
(overrides in `fixtureMergeRequestData.ts`; every other row as today). Both are among the first 10 answered rows.

**Discussions** (`fixtureMergeRequestDiscussions.ts`): !637 and !636 answer the B cases of
`briefs/mr-threads-fixtures.md` "!90's discussions" and "!91's discussions" (the same thirteen and three cases, the
same people, `d01`… ids as 40 hex digits), oldest note 2 days ago, the last of each 1–13 hours ago so the order is
visible; mentions as `Mention`s. Every other row as today plus an `id` per discussion and `earlier: []`,
`mentions: []`. The answers come from the thread store below, so a write shows in the next `readDiscussions` of that
row (a resolved one is left out, a reply is its new `last`).

**Threads** (`fixtureMergeRequestThreads.ts`, new): `threadsScript(log, store)` →
`Pick<MergeRequestSource, "readDiscussionThread" | "replyToDiscussion" | "resolveDiscussion" | "submitReview" |
"previewMarkdown">`, one mutable store per source (created in `fixtureMergeRequests.ts` and shared with the
discussions script):

- reads answer after 400 ms (`mergeRequests.fixture_thread { iid, discussion }`); writes after 300 ms
  (`mergeRequests.fixture_write { kind: comment|draft|resolve|unresolve|submit, iid, discussion }` — `discussion`
  empty for submit); previews after 300 ms (`mergeRequests.fixture_preview { iid }`). Never the text in a log line.
- **d01 of !637** is the rich thread: anna's first comment's body is `!640`'s description blocks (code with colours, a
  table, a link, an uploaded image) plus a sized web image; then sam's comment edited by dmitri ("Edited … by Dmitri
  Volkov"), dmitri's with a `width: 50%` image, anna's last edited by herself; drafts: one in d01 ("I'll take the
  second option."), one in d05 → `pending: 2`. A thread of any other listed discussion: its `earlier` and `last` as
  one-paragraph comments.
- `commenting`: !636 `locked`, else `allowed`; `mayResolve`: false for !636's first discussion, else true.
- **Writes**: a blank text → `refused { reason: "There is nothing to send." }`; a text starting `refuse` →
  `refused { reason: "403 Forbidden" }`; starting `fail` → `failed { message: "glab timed out" }`; else `sent` and
  the store changes: a comment appends sam's comment (now) and makes it the discussion's `last`; a draft appends a
  `PendingDraft`; resolve/unresolve flip `resolved`; submit turns every draft of the merge request into sam's
  comments in their discussions and empties the drafts. Resolving on !636 → `refused { reason: "403 Forbidden" }`.
- **Preview**: blank → `read` with no blocks; starting `fail` → `failed { message: "glab timed out" }`; else one
  paragraph per non-empty line, `**x**` as strong text, `@name` as a link to `https://gitlab.com/name` (the
  person's page, as GitLab links a mention).
- **Unknown iid or discussion** → `notFound`.

**Sized images** (`fixtureMergeRequestDescriptions.ts`): !640's description gains, after its images, three web images
of the fixture's own data URLs: `width` 120 px, `width` 40 %, and `width` 4000 px (wider than any panel), each with an
`alt`; and one with `height` 60 px alone.

## Change

1. `domain.ts`, `mergeRequestDomain.ts`, `descriptionDomain.ts`, `index.ts` exports; their tests.
2. `MergeRequestSource.ts`, `tauriMergeRequests.ts` and its test; `ui/mergeRequests.test.ts`'s five members
   (resolving to `notFound`/`sent`/`read` with no blocks).
3. The store, `fixtureMergeRequestThreads.ts` and its test; the discussions fixture and its test; the description
   fixture and its test; `fixtureMergeRequests.ts` spreads the new script; `fixtureMergeRequestData.ts` overrides.
4. `ipc/AGENTS.md`: the five methods, the domain, the fixture's cases and scripted words.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches, at least:

- `toRowDiscussions_brands_ids_and_keeps_earlier_and_mentions`, `a_discussion_id_not_40_hex_throws`
- `toDiscussionThreadReply_converts_times_people_pages_and_bodies` (edited `at` in ms, `by` a domain `Person`, a link
  page branded in a comment's body)
- `an_images_size_passes_as_sent`
- `tauri: each_thread_method_calls_its_command_with_its_arguments` (five)
- fixture: `the_b_cases_answer_on_637_and_636` (each case's last author and mentions), `a_comment_shows_in_the_next_read_and_the_rows_discussions`,
  `a_draft_counts_pending_and_submit_publishes_every_draft`, `a_resolved_discussion_leaves_the_next_discussions_read`,
  `refuse_and_fail_texts_answer_as_scripted`, `a_blank_preview_has_no_blocks`, `the_fixture_logs_no_text`
- the existing fixture and domain tests green.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD`.

**Smoke:** `just app-session start-fixture --name mtipc --diff --mr list --size 1600x1000`; open the merge-requests
page: the list renders, !637's count reads 13, its box (today's UI) lists thirteen discussions, !640's description
panel shows its new images (today's sizing); paste the session log's `fixture_discussions` line; `just app-session
stop mtipc`.

## Skills

`skill://ts-conventions`, `skill://ipc-contract`, `skill://verification`.
