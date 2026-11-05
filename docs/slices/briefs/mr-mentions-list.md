# Slice mr-mentions-list — the mention list under the caret, wired into the thread panel's reply field

Feature: `@` completion in comment fields. Sources:

- Request `docs/slices/request-mr-mentions.md`, rules 1–7, and the WebKit and real-app acceptance for the reply field.
- Design `docs/slices/briefs/mr-mentions-design.md` option A, §2.1–2.7 and §2.9. Proposed plan rows #191 and #192. RK35, RK73 (amended), RK76 (new), RK53 and RK54 (unchanged).

Runs in round 2, once `mr-mentions-core` and `mr-mentions-search` are committed. **This slice wires the window**: the reply field in the compare window and on the range window's merge-request page. Its commit starts the verifier's first smoke pass.

## Facts (given)

**The two earlier slices.**

- Core (`mr-mentions-core`): `mentionWordAt`, `knownMentions`, `mentionLines`, `mentionEdit`, `MENTION_LINES`, `MentionWord` from `../mergeRequests`.
- Slice (`mr-mentions-search`): `useMergeRequests().mentionSearch: PeopleSearcher` (`state`, `search(typed)`, `end()`). Its `search` ignores the same text, and `""` is `empty` with no call.

**The reply field** (`ui/MergeRequestReplyField.vue`).

- The textarea is at `:183-191`: `v-show="writing" ref="field" v-model="text" @keydown="keyPressed"`.
- `text` is a computed over `replyTexts`/`setReplyText` (`:45-50`).
- `fit` runs in a post-flush watch (`:76, 106-121`).
- `send(kind)` is at `:139-144`; `keyPressed` (`boxKeydown`: Mod-Enter sends, Escape emits `close`) at `:146-155`.
- Preview is a button calling `showPreview` (`:174-181`); `loaded` is at `:53`.
- Its parent `MergeRequestThread.vue` closes the panel on an Escape that is not `defaultPrevented`. It has two listeners: its root `@keydown` (`:141`) and a window listener (`:53, 107-119`).
- The panel is `fixed z-10 … overflow-hidden` (`:139`).

**People data.** `useMergeRequests()` has `rows` (each row: `author`, `assignees`, `reviewers[].person`, `approvedBy`) and `thread` (`load.kind === "read"` → `load.thread.comments[].author`, `ipc/discussionDomain.ts:42-60`).

**Existing pieces this slice reuses.**

- The people box's combobox pattern: `MergeRequestPeopleSearch.vue:92-143` (options `@mousedown.prevent @click`, `aria-selected`, picture + name + muted `@username`, the active option scrolled into view `:48-56`).
- `MergeRequestPicture.vue` (`person`, `size="box"`).
- `mergeRequestsText.ts:180-183` `peopleSearchText(search, platform)`.
- `menuKeys.ts:3` `ARROW_STEPS` and `:10-22` `stepMenuItem` (wrap `(focused + step + count) % count`).
- `useMenuPlacement.ts:33-48` (the `useElementSize` pattern); `menuPosition.ts` `Size`.

**Writing into a field.** `ui/linuxPaste.ts:81` already writes into a field with `document.execCommand("insertText", false, text)`. Its undo in WebKitGTK is **unmeasured** (`[INFERENCE]` in `docs/slices/briefs/3.F-paste.md:23-24`). Change step 1 measures it.

**What clips the list.**

- CodeMirror's `.cm-scroller` is `position: relative; z-index: 0; overflow-x: auto` (`node_modules/@codemirror/view/dist/index.js:6856-6866`). The range window's boxes live inside it (the `mr-mentions-post` slice).
- Only `src/editor/**/*.browser.test.ts` run in WebKit (`vite.config.ts:13-19`). `just check` runs `--project node` only (`package.json:13`). So DOM placement is proven in the smoke, and the arithmetic in node tests.

**PM10** (`scripts/windowFence.ts:23`): files `ui/MergeRequest*`/`ui/mergeRequest*` import no window root and no `lsp/`. Every new mention file except `textareaCaret.ts` carries the prefix. `textareaCaret.ts` imports nothing.

**Fixture and fake glab.**

- Fixture `?mr=list`: !637's d01 thread (Shift over d01's row in !637's discussions box). People: sam (Me) "Sam Weller", anna "Anna Berg", ben, chiara, dmitri; search-only erik, olga, rita (`ipc/fixtureMergeRequestData.ts:65-80`). "an" matches only anna.
- Each search logs `mergeRequests.fixture_people_search {"text":…}` and answers after 300 ms (`ipc/fixtureMergeRequestPeople.ts:15, 105-113`).
- Fake glab: `glab api graphql` with `search=<text>` answers `graphql-people-<text>.json`. A missing file exits 2, which is still logged (`tests/glab/README.md:46, 60`).
- `mr-threads/` has people sam, anna (id 2), ben, chiara, dmitri, with avatars `/uploads/-/system/user/avatar/<id>/avatar.png` in its `pictures/` (README `:312-316`).
- `mr-people/graphql-people-an.json` is anna's search answer.

## Target

**Owned:**

- `frontend/src/ui/mergeRequestMentionLines.ts` (new), `frontend/src/ui/mergeRequestMentionLines.test.ts` (new)
- `frontend/src/ui/mergeRequestMentions.ts` (new, the composable)
- `frontend/src/ui/MergeRequestMentionList.vue` (new)
- `frontend/src/ui/textareaCaret.ts` (new), `frontend/src/ui/textareaCaret.test.ts` (new)
- `frontend/src/ui/menuKeys.ts`, `frontend/src/ui/menuKeys.test.ts`
- `frontend/src/ui/mergeRequestsText.ts` (one constant)
- `frontend/src/ui/MergeRequestReplyField.vue`
- `frontend/src/ui/MergeRequestThreadPanel.test.ts`
- `frontend/src/ui/AGENTS.md`
- `tests/glab/mr-threads/graphql-people-an.json` (new), `tests/glab/README.md` (the `mr-threads/` paragraph)

**Read-only:**

- everything else;
- `frontend/src/mergeRequests/**` (core), `frontend/src/ui/mergeRequestPeople.ts`, `frontend/src/ui/mergeRequests.ts`;
- `frontend/src/ui/MergeRequestThread.vue`: unchanged, since its listeners already skip a stopped or prevented key;
- `frontend/src/ui/boxKeys.ts`;
- `frontend/src/ui/RangeMessageEditor.vue` (`mr-mentions-post`);
- `vite.config.ts`, `frontend/src/ipc/bindings.ts`, `docs/**`, `.omp/**`.

**Non-goals:**

- The range Post box (`mr-mentions-post`).
- The range window's note and Edit boxes (request "Fields").
- Groups, `@all`, other references.
- A "Searching…" or "No one found" line (#192).
- A WebKit browser-test project for `ui/` (the smoke proves the DOM).

## Contract

Fixed. You may add to it, but never change it.

```ts
// ui/textareaCaret.ts — DOM helpers, no Vue
export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};
/** Pixels relative to the field's border box, after its scroll: the caret's left, its line's top and bottom. */
export type CaretBox = { readonly left: number; readonly top: number; readonly bottom: number };
/** The mirror's inline style for a field with `computed` style and `clientWidth` (design §2.5 step 2). */
export function mirrorStyle(
  computed: Readonly<Record<string, string>>,
  clientWidth: number,
): Readonly<Record<string, string>>;
/** Where `index`'s caret is drawn in `field` (mirror-div measure, design §2.5). */
export function caretBox(field: HTMLTextAreaElement, index: number): CaretBox;
/** The viewport intersected with every ancestor of `element` whose overflow is not `visible` (viewport pixels). */
export function visibleRoom(element: HTMLElement): Rect;

// ui/mergeRequestMentionLines.ts — pure
export type MentionLine = {
  readonly username: string;
  readonly picture: Person;
  readonly label: string;
};
/** `note`: why GitLab's search is missing (the people box's words), muted under the lines (rule 5). */
export type MentionList = { readonly lines: readonly MentionLine[]; readonly note: string | null };
export type MentionInput = {
  readonly known: readonly Person[];
  readonly typed: string;
  readonly search: PeopleSearch;
  readonly platform: string;
};
/** Design §2.4; null (closed) when there is no line and no note. */
export function mentionList(input: MentionInput): MentionList | null;
export type FieldRead = {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly composing: boolean;
};
/** The open word (design §2.1): null while composing, with a selection, with no word, or for the word Escape
 *  dismissed (`dismissed` is that word's start). */
export function mentionRead(read: FieldRead, dismissed: number | null): MentionWord | null;
export type MentionKey =
  | { readonly kind: "step"; readonly step: number }
  | { readonly kind: "pick" }
  | { readonly kind: "close" };
/** Design §2.6's table; null: the key is the field's. */
export function mentionKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">,
  list: MentionList | null,
): MentionKey | null;
/** `current` while the usernames are unchanged, else 0. */
export function highlightAfter(
  before: readonly MentionLine[],
  after: readonly MentionLine[],
  current: number,
): number;
/** The caret, the field's and the room's viewport rects, measured together. */
export type MentionAnchor = { readonly caret: CaretBox; readonly field: Rect; readonly room: Rect };
/** Pixels relative to the field's border box. */
export type MentionPlace = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
};
/** Design §2.5 "Placement". */
export function mentionPlace(anchor: MentionAnchor, list: Size): MentionPlace;

// ui/menuKeys.ts
/** `index` moved by `step`, wrapping over `count` (> 0) items; `stepMenuItem` uses it. */
export function wrappedIndex(count: number, index: number, step: number): number;

// ui/mergeRequestMentions.ts — the one composable, one call per field
export type MentionField = {
  /** null while closed. */
  readonly list: ComputedRef<MentionList | null>;
  readonly highlight: Readonly<ShallowRef<number>>;
  readonly anchor: Readonly<ShallowRef<MentionAnchor | null>>;
  readonly listId: string;
  /** `aria-autocomplete: "list"` always; `aria-controls` and `aria-activedescendant` while open. */
  readonly fieldAria: ComputedRef<Readonly<Record<string, string | undefined>>>;
  /** Call first in the field's keydown: true when the list took the key (already prevented and stopped). */
  keydown(event: KeyboardEvent): boolean;
  pick(index: number): void;
  /** Closes the list and ends the mention search (Preview, a send, Queue). */
  close(): void;
};
export function useMentions(
  field: Readonly<ShallowRef<HTMLTextAreaElement | null>>,
  known: MaybeRefOrGetter<readonly Person[]>,
): MentionField;

// ui/mergeRequestsText.ts
export const MENTION_PEOPLE = "People to mention";
```

`MergeRequestMentionList.vue`:

- Props: `list: MentionList`, `highlight: number`, `listId: string`, `anchor: MentionAnchor`.
- Emits: `pick: [index: number]`.
- It measures its own size (`useElementSize`, border box) and is styled `{ left, top, maxHeight }` from `mentionPlace`.

## Change

1. **Measure first (design §2.7).** Before the rest, wire the smallest pick into the reply field. In the WebKit fixture, type `@an`, then Down and Enter, and confirm `@anna `. Press Ctrl+Z and `read` the field's value and `selectionStart`.
   - `@an` and 3 → keep `execCommand("insertText")`.
   - Anything else, or `execCommand` returning false → use `setRangeText(insert, from, to, "end")` plus a bubbling `input` event, and put the measurement in `open_risks`.
   - Ship exactly one path. Paste the measurement in `smoke_evidence`.
2. `menuKeys.ts`: extract `wrappedIndex` from `stepMenuItem`, with no change in behaviour.
3. `textareaCaret.ts`, per design §2.5. `mirrorStyle` is pure:
   - it copies `direction`, padding, every `font*`, `lineHeight`, `letterSpacing`, `wordSpacing`, `tabSize`, `textIndent`, `textTransform`, `textAlign`;
   - it sets `boxSizing: content-box`, `whiteSpace: pre-wrap`, `overflowWrap: break-word`, `position: absolute`, `visibility: hidden`, `top: 0`, `left: -9999px`;
   - `width` is `clientWidth − paddingLeft − paddingRight` px.
4. `mergeRequestMentionLines.ts`, per design §2.4–2.6. `mentionPlace`:
   - below at `caret.bottom` when it fits under it inside `room`;
   - otherwise above at `caret.top − height` when it fits there;
   - otherwise on the larger side, with `maxHeight` set to that side's room;
   - `left` is `caret.left`, moved left so `field.left + left + width ≤ room.right`, and never below `room.left − field.left`.
   - `mentionList` uses the core's `mentionLines` and `displayName`.
5. `mergeRequestMentions.ts` `useMentions`:
   - **Reads.** `useEventListener` on the field ref for `input` (skipped while composing), `click`, `keyup`, `focus`, `compositionstart`/`compositionend` (the composing flag; `compositionend` reads), `blur` (`close`) and `scroll` (re-measure).
   - **Each read.** `word = mentionRead(read, dismissed)`.
     - A null word closes: `mentionSearch.end()` if the list was open. The dismissed start is forgotten once the word is null or another word starts.
     - Otherwise `mentionSearch.search(word.typed)`, and a re-measure after `nextTick`: `anchor = { caret: caretBox(field, word.start), field: field.getBoundingClientRect(), room: visibleRoom(field) }`.
   - **List and highlight.** `list` is `mentionList({ known, typed: word.typed, search: mentionSearch.state.value, platform: navigator.platform })` while a word is open. `highlight` follows `highlightAfter`.
   - **`keydown`.** Map through `mentionKey`, then: `step` → `wrappedIndex`; `pick` → `pick(highlight)`; `close` → `dismissed = word.start`, then close.
   - **`pick(index)`.** Run `mentionEdit`, `focus`, `setSelectionRange`, then the measured write (step 1).
   - **Pictures** are those `rows`, threads and searches carry (RK53). No call but the search (RK54).
6. `MergeRequestMentionList.vue`: the people box's listbox markup and classes (`MergeRequestPeopleSearch.vue:129-160`).
   - A panel `absolute z-10 rounded-md border border-control-border bg-panel-inline shadow-lg overflow-y-auto`.
   - Options `role="option"` with `id` `${listId}-${index}`, `aria-selected`, `@mousedown.prevent`, `@click` → `pick`.
   - Each option shows `MergeRequestPicture size="box"`, the label, and a muted `@username`.
   - The note is a muted `role="status"` `<p>`.
   - The listbox's `aria-label` is `MENTION_PEOPLE`.
   - The active option is scrolled into view (`block: "nearest"`).
7. `MergeRequestReplyField.vue`:
   - Wrap the textarea in `<div v-show="writing" class="relative">`, moving `v-show` from the textarea to the wrapper. Inside the wrapper put the textarea with `v-bind="mentions.fieldAria.value"`, and `<MergeRequestMentionList v-if="…">`.
   - `known` = `knownMentions(rows.find(row => row.iid === thread.shown.iid) ?? null, loaded?.thread.comments.map(c => c.author) ?? [])`.
   - `keyPressed` calls `mentions.keydown(event)` first and returns when it is true.
   - `send` and the Preview button call `mentions.close()` first.
8. Tests below. Then `tests/glab/mr-threads/graphql-people-an.json` (anna "Anna Berg", `avatarUrl` `/uploads/-/system/user/avatar/2/avatar.png`, the shape of `mr-people/graphql-people-an.json`) and its README line.
9. `ui/AGENTS.md`:
   - rewrite `:75`'s search sentence: `peopleSearch: PeopleSearcher`, one of two `createPeopleSearch` instances;
   - add a "Mentions" paragraph (request, design, plan #191–#192): the fields; `useMentions` and its reads, keys and close points; the list's placement and DOM rule (an absolute child of the field's wrapper, never teleported); `mentionSearch`; the write path as measured; the Post box's people from `linedUpRow` (filled in by `mr-mentions-post`; describe it as the design states).

## Acceptance

**Tests** (`pnpm -C frontend test`):

- `mergeRequestMentionLines.test.ts`:
  - `known_people_show_at_once_and_search_results_follow`: an `empty` search lists the known matches; `found` adds the search matches after them.
  - `a_refused_or_failed_search_keeps_the_known_people_with_the_people_box_words` (rule 5): a `glabMissing` refusal and a thrown failure → the lines plus `peopleSearchText`'s sentence.
  - `nothing_to_show_closes_the_list`: no line and no note → null; `searching` with no known match → null.
  - `a_composition_never_opens_the_list` (RK76): `composing: true` → null.
  - `a_selection_opens_no_list`.
  - `a_dismissed_word_stays_closed_until_another_word_starts`.
  - `an_open_list_takes_escape_enter_tab_and_arrows_only` (RK73): each key of design §2.6's table.
    - Ctrl+Enter, Meta+Enter, Shift+Enter, Shift+Tab, Alt+ArrowDown → null.
    - Enter or Tab with no lines but a note → null; Escape with a note only → close.
    - `isComposing` → null; a closed list → null.
  - `the_highlight_stays_while_the_people_stay_and_resets_otherwise`.
  - `the_list_sits_below_the_caret_when_it_fits`, `the_list_flips_above_when_there_is_no_room_below`, `the_list_takes_the_larger_side_and_scrolls_when_neither_fits`, `the_list_moves_left_to_stay_inside_the_room`.
- `textareaCaret.test.ts`: `the_mirror_copies_what_moves_a_glyph_and_wraps_like_the_field`. Every listed property is copied; the width excludes the padding; `pre-wrap`/`break-word` are set.
- `menuKeys.test.ts`: `wrappedIndex` wraps both ways. `stepMenuItem`'s tests are unchanged and green.
- `MergeRequestThreadPanel.test.ts`: `the_reply_field_offers_mentions` (SSR). The textarea carries `aria-autocomplete="list"` and no `aria-activedescendant`; no listbox is rendered.

**Commands:** `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test`, `unused`, `sfc-order`. `just mutants HEAD`:

- `mergeRequestMentionLines.ts` and `menuKeys.ts` survivors are killed by tests.
- `textareaCaret.ts` `caretBox`/`visibleRoom` and `mergeRequestMentions.ts` survivors may be kept only as **wiring**, each named against the smoke step below that observes it (VF7 (c)).

**Smoke (WebKit fixture, the wiring; dark, and light with `--settings '{"theme":"light"}'`).** Start with `just app-session start-fixture --name mml --diff --mr list --open-mr --size 1600x1000`, then open !637's d01 panel (Shift over d01's row in !637's discussions box). Paste `read` results and log lines.

1. **Bare `@`.** Type `@` → a listbox "People to mention" under the caret line.
   - Its lines are !637's author, assignees, reviewers, approvers, then d01's writers, each once.
   - The first line is `aria-selected`.
   - No `fixture_people_search` line in the session log.
2. **Search.** Type `an` → after the pause exactly one `mergeRequests.fixture_people_search {"text":"an"}`, and Anna Berg listed with her picture and muted `@anna`.
3. **Placement.** `read` the list's and the field's rects. The list's top is within 2 px of the caret line's bottom (the field's content top + line height × the `@`'s line). Its left is within 4 px of the `@`'s x.
   - Repeat after typing two lines first, so the `@` is on line 3.
   - Repeat with `hello @an` on line 1: the left grows by the width of `hello ` (canvas `measureText` in the field's computed font, ±4 px).
   - Type 12 lines so the field scrolls, then `@an` on the last: the list stays inside the panel (above the caret when there is no room below).
4. **Pick.** Down, then Enter → the field reads `@anna ` and `selectionStart` 6; the list is gone.
   - Then **Ctrl+Z** → the step 1 measurement (`@an`, caret 3, the list back).
   - Then Enter → `@anna ` again; type `@an` and click Anna's line → `@anna @anna `.
5. **Escape twice (RK73).** Type `@an` → the list. Escape → no list, panel open, focus in the field. Escape → the panel closes.
6. **Keys stay the field's.**
   - With the list open, Ctrl+Enter → one `fixture_write { kind: comment }`, and the list is closed.
   - Shift+Enter with the list open → a line break.
   - Tab with the list open → a pick.
7. **Rule 6.**
   1. Reopen d01's panel, type `@an` (Anna listed).
   2. Open !637's people box and press "Add assignee" (the panel closes by the press outside, RK73): its empty field shows its suggestions (Me first), not the mention search.
   3. Type `er` → Erik.
   4. Escape twice.
   5. Reopen d01's panel and click at the end of the kept text: the list shows Anna again and no Erik.
8. **Preview** with the list open → the list is gone; Write → the field and its text, with no list until the caret is in a word again.
9. `shot` of step 2's list (Anna, picture, muted username), in dark and in light.

Stop with `just app-session stop --name mml`.

**Real app (fake glab).**

1. `scripts/local-conflicts-repo.sh <scratch>/mml` and `cargo tauri build --debug --no-bundle`.
2. `just app-session start-app --name mmla --diff --dir <scratch>/mml --glab mr-threads --mr`, then !90's d01 panel.
3. Count the fake glab `argv:` lines:
   - `@` → none;
   - `an` typed at once → after a pause exactly one `argv: api graphql … search=an`, and Anna listed with her picture (`/2/avatar.png`);
   - Down, then Enter → the field reads `@anna `, and no new line;
   - clear the field, then `@a`, a pause, `n`, a pause, `n`, a pause → exactly one line per pause (`search=a`, `an`, `ann`). An unscripted search (`ann`) shows the people box's failure sentence, muted, under the known people (rule 5).
4. `just app-session stop --name mmla`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK35, RK53, RK54, RK73, RK76), `skill://verification`.
