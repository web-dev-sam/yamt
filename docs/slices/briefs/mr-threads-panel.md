# Slice mr-threads-panel — the thread panel: comments as GitLab shows them, the field, Write/Preview, the buttons; sized images

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: A1, A2 (the window), C3, C4, C6, C7, C8 (the panel's side), C9's header,
  C10's button and reasons; the WebKit acceptance's panel steps.
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.1 (sizing), §1.3 (panel, field), §4 items 3, 7, 8.
- Proposed plan §2 #183, #184; RK60, RK66 (amended).

Runs in wave 7, after `mr-threads-state-ui`. `mr-threads-box` mounts the panel beside the box (it wires the window);
until then the panel is proven by SSR tests, and the sized images in the description panel by WebKit.

## Target

**Owned:**

- `frontend/src/ui/MergeRequestThread.vue` (new), `frontend/src/ui/MergeRequestThreadComment.vue` (new),
  `frontend/src/ui/MergeRequestReplyField.vue` (new), `frontend/src/ui/MergeRequestThread.test.ts` (new, SSR)
- `frontend/src/ui/mergeRequestThreadText.ts` (new, + `.test.ts`)
- `frontend/src/ui/mergeRequestImageSize.ts` (new, + `.test.ts`)
- `frontend/src/ui/MergeRequestDescriptionImage.vue`, `frontend/src/ui/MergeRequestDescriptionInlines.vue`

**Read-only:** everything else.

- `ui/mergeRequestThread.ts`, `ui/mergeRequestDiscussions.ts`, `ui/mergeRequests.ts`, `ui/problem*.ts`, `ipc/**`: the
  state slices'. Use them as contracted.
- `ui/MergeRequestDescriptionBlocks.vue`, `ui/MergeRequestDescriptionCode.vue`, `ui/MergeRequestPicture.vue`,
  `ui/tooltip.ts`, `ui/glab.ts`, `ui/aiText.ts` (`RETRY`), `ui/useMenuPlacement.ts`, `mergeRequests` core (`agoText`,
  `dateTimeText`, `noteAuthorName`, `UNKNOWN_AUTHOR`): use as they are.
- `ui/MergeRequestDiscussions.vue`, `ui/useHoverBox.ts`, `ui/AGENTS.md`: `mr-threads-box`'s.
- `style.css`: no new token (the panel takes the job log panel's and the description panel's look).
- `docs/**`: lines in `deviations_from_brief`. Each new `.vue` file needs its one-line reason (VU15) there.

**Non-goals:** opening the panel, Shift, the box's marks, the hover rule (`mr-threads-box`); a Markdown editor, toolbar,
colours or `@` completion (request non-goals); rendering drafts; any `v-html`, `href` or `title` attribute
(`mergeRequestTitles.test.ts` bans `title` in `MergeRequest*.vue`).

## Contract

Fixed; you may add, never change.

```ts
// mergeRequestImageSize.ts — pure (design §1.1)
export type NaturalSize = { readonly width: number; readonly height: number };
/** CSS for an image of `size` (null: its own size, today's `max-w-full h-auto`); `natural` once it loaded. */
export function imageStyle(
  size: ImageSize | null,
  natural: NaturalSize | null,
): Readonly<Record<string, string>>;
// width W (px or %, % > 100 → 100%): { width: W, height: "auto", maxWidth: "100%" }
// height H px alone: before load { height: H }; after { width: `${H × w/h}px`, height: "auto", maxWidth: "100%" }
// both px: { width: W, aspectRatio: `${W} / ${H}`, height: "auto", maxWidth: "100%" }
// width % with height px: { width: min(W%,100%), aspectRatio from natural when known, height: "auto", maxWidth: "100%" }
// a height in %: ignored (as GitLab's page: CSS 2.1 §10.5); with a width, the width rule alone

// MergeRequestThread.vue
defineProps<{
  iid: MergeRequestIid;
  /** The merge request's author's username (null: unknown): the crown. */
  author: string | null;
  /** The box's words for the row: where it is and whose turn (the core's rule, via the box). */
  place: string;
  turn: string;
  /** The box's left and top: the panel's right edge meets the left, tops aligned (as CiStatusJobLog `:57-60`). */
  anchor: { readonly left: number; readonly top: number };
  /** The page's clock, as the box gets it (`MergeRequestDiscussions.vue` prop `now`): "3 hours ago". */
  now: number;
}>();
defineEmits<{ close: [] }>();
// reads `thread`, `replyTexts` and the Threads actions from useMergeRequests(); renders nothing when `thread` is null.
```

**The panel** (`role="dialog"`, `aria-label` "Thread: <place>", `tabindex="-1"`, focused on mount — never the field, so
a later Shift tap still switches; C1):

- Size `w-[min(40rem,calc(100vw-2rem))] h-[min(48rem,calc(100vh-2rem))]`, a flex column: header, the comments
  (`overflow-y-auto`, `flex-1`), then the field and the buttons row (never scrolled away; C1).
- **Header** (C3, C9, C10): `place`; the turn words, or a check (Lucide `check`) and "Resolved" muted when the thread
  answers `resolved`; "Open on GitLab" (Lucide `external-link`; opens `comments[0].page` through `openPage("discussion",
  page)`, disabled without one); while `pending > 0` a "Submit review" button with "3 pending" (tooltip "Publish your 3
  pending comments on this merge request"; 1: "Publish your pending comment on this merge request") — disabled while a
  send runs; "Close" (Lucide `x`) → `close`.
- **Comments** (C3, C4), oldest first, one `MergeRequestThreadComment` each: `MergeRequestPicture` and name as the
  people box shows them (`noteAuthorName`; "Someone" for null), `@username` muted, Lucide `crown` with tooltip
  "Author" right of the name when `author.username === props.author`, `agoText(createdAt, now)` with
  `dateTimeText(createdAt)` as its tooltip, and when `edited`: "· Edited 3 days ago" (`agoText(edited.at)`, tooltip
  `dateTimeText`) plus " by <name>" when `edited.by.username` is not the author's. The body is
  `MergeRequestDescriptionBlocks` of `comment.body.blocks` — the one renderer (RK60, RK66): code in yamt's colours,
  tables, images (sized), links through the one opener; a suggestion block is its code.
- **Drafts** (C8.2) after the comments: each `text` as written (`whitespace-pre-wrap`), with a "Pending" mark; no
  picture (design §4 item 3).
- **States** (C5): `loading` "Loading…"; `refused`: `notFound` "This discussion is no longer on GitLab.", glab's words
  (`glabRetryText`) or "Could not read the thread: <message>", each with Retry; `failed`: `problemText` at step
  `thread`, with Retry. A `read` with `refreshing` keeps its comments shown.
- **Field** (`MergeRequestReplyField.vue`, C6, C7): above it a two-button switch "Write"/"Preview" (`aria-pressed`); a
  plain `<textarea>` (no toolbar), placeholder "Write a reply… (Markdown)", `v-model` through `replyTexts` /
  `setReplyText` of the shown discussion; its height measured on mount and input from `scrollHeight`, clamped to
  3–12 lines, `overflow-y: auto` beyond (design §1.3, decided). Preview shows `preview`: `loading` "Loading…",
  `empty` "Nothing to preview.", `read` the blocks, `refused`/`failed` one sentence ("Could not preview: …" or
  `problemText` at `preview`); "Write" returns to the same textarea with its text and caret (the textarea stays
  mounted, hidden while previewing). Ctrl+Enter in the textarea = Add comment (C8.1); Enter types a line. Escape in
  the panel: `preventDefault`, then `close` (the box puts focus back on the row).
- **Buttons row** (C8, C10): left "Add review" then "Add comment"; at the far right "Resolve thread" or "Unresolve
  thread" (by `resolved`). The add buttons are disabled while the trimmed text is empty, a send runs or the thread is
  `refreshing`, and when `commenting` is not `allowed` — then with the reason as tooltip: `locked` "Comments on this
  merge request are locked to project members.", `notAllowed` "You may not comment on this merge request.". The
  resolve button is disabled while a send runs and when `!mayResolve` (tooltip "You may not resolve this thread.").
  Under the row, after a failed send, one sentence: "Could not add the comment: …", "Could not add the review comment:
  …", "Could not resolve the thread: …", "Could not unresolve the thread: …", "Could not submit the review: …" (the
  reason, glab's words, or `problemText` at the matching step).
- **Images** (A1, A2): `MergeRequestDescriptionImage.vue` takes `size: ImageSize | null` (passed by
  `MergeRequestDescriptionInlines.vue`) and binds `:style="imageStyle(size, natural)"`, `natural` from its `load`
  event (`naturalWidth`/`naturalHeight`); the stand-in text ignores the size (A3). Description and thread panels both
  get it.

`mergeRequestThreadText.ts` holds every word above as constants and `pendingText(n)`, `submitTip(n)`,
`editedText(edit, authorUsername, now)`, `threadRefusalText(reply)`, `writeFailureText(what, failure)`,
`previewFailureText(preview)`, `commentingReason(commenting)`.

## Change

1. `mergeRequestImageSize.ts` and its tests; the two description components.
2. `mergeRequestThreadText.ts` and its tests.
3. `MergeRequestThreadComment.vue`, `MergeRequestReplyField.vue`, `MergeRequestThread.vue`; the SSR tests (pattern
   `MergeRequestDescription.test.ts`: `windowMergeRequests(source, …)` over the `?mr=list` fixture source with the
   store's `showThread`, tooltip mocked).

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches, at least:

- `mergeRequestImageSize.test.ts`: `a_width_keeps_the_pictures_proportions_and_the_cap`,
  `a_percent_width_is_of_the_column_and_never_over_100`, `a_height_alone_scales_the_width_once_loaded`,
  `both_keep_their_ratio`, `a_percent_height_is_ignored`,
  `a_size_wider_than_the_column_shrinks_with_its_proportions` (**owns A1 and A2** with the WebKit step)
- `mergeRequestThreadText.test.ts`: every word and sentence above; `pendingText` singular and plural;
  `editedText` with and without "by"
- `MergeRequestThread.test.ts` (SSR, over the fixture's !637 d01):
  - `the_comment_header_shows_picture_name_username_crown_and_ago` (**owns C3**; the crown only on dmitri's comment,
    "· Edited … by Dmitri Volkov" on sam's, "· Edited …" without "by" on anna's)
  - `a_comment_renders_gitlabs_blocks` (**owns C4**: a code block, a table, an image with its size style, a link
    button; no `<script>`, no `href`)
  - `the_drafts_show_pending_at_the_end`, `submit_review_shows_the_pending_count_and_its_tip`
  - `the_field_has_its_placeholder_and_no_toolbar`, `preview_shows_loading_then_blocks_and_nothing_for_empty`
    (**owns C7**: "Loading…", the rendered blocks, "Nothing to preview.", back to the same text)
  - `the_buttons_row_has_add_review_add_comment_and_resolve_at_the_right` (**owns C8**: order, disabled while empty,
    the locked reason on !636), `a_failed_send_says_why_under_the_row`, `resolved_reads_resolved_and_unresolve`
  - `loading_failure_and_not_found_read_one_sentence_with_retry`

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`; `just mutants HEAD`.

**Smoke** (WebKit; paste the `read` results and the shots' paths): `just app-session start-fixture --name mtpanel
--diff --mr list --size 1600x1000`, open the merge-requests page, open !640's description panel: the 120 px image is
120 px wide, the 40 % one is 40 % of the text column, the 4000 px one is exactly the column's width with its
proportions, the 60 px-high one is 60 px high and not squashed (A1, A2 — **"A Sizes"**); `shot` dark; again with
`--settings '{"theme":"light"}'`; `just app-session stop mtpanel`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK60, RK66), `skill://verification`.
