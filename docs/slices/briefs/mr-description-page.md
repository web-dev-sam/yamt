# Slice mr-description-page — the info button, the floating panel and the description's renderers (wires the window)

Feature: a merge request's description in a floating panel. Sources:

- Request `docs/slices/request-mr-description.md`: rules 1–7, the WebKit acceptance and the real-app acceptance.
- Design `docs/slices/briefs/mr-description-design.md` option A, §1.5–§1.7, §4.
- Proposed plan §2 #171–#174; RK66, RK67.

Runs in wave 4, after `mr-description-state` (and so after `-rust`, `-app`, `just bindings`) and `mr-description-look`.
**This slice wires the window**: its real-app run is the feature's first end-to-end proof.

## Target

**Owned:**

- `frontend/src/ui/MergeRequestRow.vue`
- `frontend/src/ui/MergeRequestsView.vue`
- `frontend/src/ui/MergeRequestDescription.vue` (new)
- `frontend/src/ui/MergeRequestDescriptionBlocks.vue` (new)
- `frontend/src/ui/MergeRequestDescriptionInlines.vue` (new)
- `frontend/src/ui/MergeRequestDescriptionImage.vue` (new)
- `frontend/src/ui/MergeRequestDescriptionCode.vue` (new)
- `frontend/src/ui/MergeRequestDescription.test.ts` (new)
- `frontend/src/ui/mergeRequestDescriptionText.ts` (new), `frontend/src/ui/mergeRequestDescriptionText.test.ts` (new)
- `frontend/src/ui/AGENTS.md`

**Read-only:** everything else.

- `ui/mergeRequests.ts`, `ui/mergeRequestDescriptions.ts`, `ui/mergeRequestsText.ts`, `ui/problem*.ts`, `ipc/**`: the
  state slice's. Use them as contracted.
- `ui/useMarkdown.ts` and `editor/**`: the look slice's. Use `useMarkdownCode` as it is.
- `ui/tooltip.ts`, `ui/focusReturn.ts`, `ui/mergeRequestsStore.ts`, `ui/aiText.ts` (`RETRY`): use them as they are.
- `style.css`: no new token. Links use the existing `--color-syntax-link`; the panel uses the boxes' look (facts §1).
- `docs/**`: lines in `deviations_from_brief`.

Each new component needs its one-line reason in `deviations_from_brief` (VU15):

- the panel has its own open/close rules and focus;
- blocks and inlines are each one recursive renderer;
- the image keeps its own failed state;
- the code block owns a `MarkdownView` host.

**Non-goals:**

- Editing; ticking task boxes; comments; drawing diagrams or math; playing media (request non-goals).
- Review mode's own controls beyond the shared row (request non-goal).
- Any `href`, `v-html`, `innerHTML` or `title` attribute (`mergeRequestTitles.test.ts` already bans `title` in
  `MergeRequest*.vue`, `:5-8`).

## Contract

Given (fixed):

- State, through `useMergeRequests()` (PM10): `description`, `toggleDescription`, `retryDescription`,
  `closeDescription`, `imageAddress`, `openPage(clicked: PageKind, page)` with `PageKind` `"link"`; the types
  `ShownDescription`, `DescriptionLoad`, `DescribedRow`.
- Domain: the description types (`mr-description-rust.md` Contract); `MergeRequestRow.hasDescription`.
- Look: `useMarkdownCode(host, () => ({ language, text }))`.
- Problem: the step `"description"` (`problemText`).

Fixed here (add-only beyond this):

```ts
// ui/mergeRequestDescriptionText.ts — the panel's words (the job log's own text file is the precedent,
// mergeRequestLogText.ts)
export const SHOW_DESCRIPTION = "Show description";
export const CLOSE_DESCRIPTION = "Close";
export const DESCRIPTION_LOADING = "Loading…";
export const NO_DESCRIPTION = "No description.";
export const TASK_DONE = "Done";
export const TASK_OPEN = "Not done";
export const TASK_INAPPLICABLE = "Not applicable";
/** One sentence; the panel puts Retry (aiText.ts RETRY) after it. */
export function descriptionRefusalText(
  reply: Exclude<DescriptionReply, { readonly kind: "read" }>,
): string;
//   glabMissing → `${GLAB_MISSING_TEXT} — install glab, then Retry.`
//   notLoggedIn → `${glabNotLoggedInText(detail)} — run glab auth login in a terminal, then Retry.`
//   failed      → `Could not read the description: ${message}`
//   (a thrown call: problemText({ action: "mergeRequests", step: "description", cause }, navigator.platform))
```

**The row** (`MergeRequestRow.vue`, rule 1):

- A new `<span class="flex w-7 shrink-0 justify-center">` sits between the approvals span (`:164-172`) and the CI
  box's span (`:173-182`). It always renders, so the column stays.
- It holds a button only when `row.hasDescription`. The button:
  - `type="button"`, `data-row-control`, `@click.stop`, `data-description-opener` = the iid;
  - `v-tooltip` and `aria-label` `SHOW_DESCRIPTION`;
  - `aria-haspopup="dialog"`, `aria-expanded` true while this row's panel is open;
  - `class="shrink-0 rounded p-1 hover:bg-hover cursor-pointer"`, Lucide `info` `size-4`.
- A click calls `toggleDescription({ iid, title })`. Enter and Space are the native button's.

**The panel** (`MergeRequestDescription.vue`, rendered once by `MergeRequestsView.vue` after the list, `v-if` an
entry is shown):

- **Look.** `role="dialog"`, `aria-modal="false"`, `aria-labelledby` its header, `tabindex="-1"`;
  `fixed z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[min(64rem,calc(100vw-4rem))]
  max-h-[85vh] rounded-md border border-control-border bg-panel-inline shadow-lg`. The tooltip stays above it
  (`z-500`, `tooltip.ts:10`).
- **Header.** `!<iid>` (`mergeRequestReference`) and the title as given at open; then the close button (Lucide `x`,
  `v-tooltip`/`aria-label` `CLOSE_DESCRIPTION`).
- **Content.** `overflow-y-auto overscroll-contain`, holding exactly one of:
  - `DESCRIPTION_LOADING`;
  - `NO_DESCRIPTION` for `shown` with no blocks;
  - the blocks;
  - the refusal or failure sentence and a Retry button (`retryDescription`).
- **Focus.** On mount the panel takes focus.
- **Closing:**
  - Escape on `window` while open, unless `defaultPrevented`: `closeDescription`, then `returnFocus`
    (`focusReturn.ts:3-12`) on the row's `[data-description-opener="<iid>"]` button when it is still listed.
  - The close button closes the same way.
  - `onClickOutside(panel, closeDescription, { ignore: ["[data-description-opener]"] })`: the pattern of
    `MergeRequestDueDate.vue:38-44`. The opener's own toggle then closes or replaces the panel.
  - No scroll handler: a page scroll leaves it open.

**The renderers** (text interpolation only):

- **Blocks** (`MergeRequestDescriptionBlocks.vue`, props `{ blocks: readonly DescriptionBlock[] }`; it renders nested
  blocks by referring to itself):
  - the `markdown-*` classes of `editor/theme.css`, so the panel matches yamt's Markdown;
  - `heading` → `h1`–`h6` by `level`;
  - `code` → `MergeRequestDescriptionCode`;
  - `list` → `ul` or `ol` with `start`; each item's task box is a Lucide `square-check` (done), `square` (open) or
    `square-slash` (inapplicable) icon with `role="img"` and its word as `aria-label`, never an `input`;
  - `table` → `thead`/`tbody`, `th`/`td`, `text-left|center|right` by `align`, in an `overflow-x-auto` wrapper;
  - `quote` → `blockquote`; `rule` → `hr`;
  - `details` → `<details :open>` with `<summary>`.
- **Inlines** (`MergeRequestDescriptionInlines.vue`, props `{ inlines: readonly DescriptionInline[] }`, the same
  self-reference):
  - `text` → interpolation; `emphasis`/`strong`/`strike` → `em`/`strong`/`del`; `code` → `code.markdown-inline-code`;
    `lineBreak` → `br`.
  - **`link`:** an `a` with `role="link"`, `tabindex="0"` and no `href`, so nothing can navigate (rule 4).
    - `page`: `text-syntax-link cursor-pointer hover:underline`, `v-tooltip` = the address. Click or Enter →
      `openPage("link", page)`; the panel stays open.
    - `refused`: muted, `cursor-default`, `v-tooltip` = the address as written. Click and Enter do nothing.
  - `image` → `MergeRequestDescriptionImage`.
- **Image** (`MergeRequestDescriptionImage.vue`):
  - `imageAddress(image)`. `null`, or the `img`'s `error` event, shows the caption in a muted span. When the caption
    is empty, the span shows the `web` address, or "picture" for an upload or a refused one.
  - Else `<img :src :alt="caption" referrerpolicy="no-referrer" loading="lazy" draggable="false" class="h-auto
    max-w-full">`. A click does nothing (rule 5).
- **Code** (`MergeRequestDescriptionCode.vue`): a host `div` through `useTemplateRef`, and `useMarkdownCode(host, () =>
  ({ language, text }))`.

## Change

1. `mergeRequestDescriptionText.ts` and its test.
2. The renderers and `MergeRequestDescription.test.ts` (SSR, `renderToString`, as `MergeRequestFilter.test.ts:1-20`).
3. The panel, the view's one host, the row's button.
4. `ui/AGENTS.md`: the panel, its close rules, the renderers' "no `href`, interpolation only", and the words file.

## Acceptance

**Tests** (`pnpm -C frontend test`), each named for the bug it catches:

- `MergeRequestDescription.test.ts` (SSR):
  - `every_block_and_inline_renders_its_element` (rule 3: one tree with each kind, each expected tag present)
  - `text_that_looks_like_markup_renders_as_text` (RK66): text `<script>…</script><img src=x onerror=…>` comes out
    escaped; the render has no `<script` and no `<img` but the image renderer's.
  - `no_description_element_has_an_href_or_an_on_attribute` (rule 4, RK66): over the rich tree, the rendered HTML has
    no ` href=`, no ` on[a-z]+=` and no `<input`, `<iframe`, `<form`, `<style` or `<object`.
  - `an_upload_and_another_sites_image_load_their_address_and_a_refused_one_shows_its_caption` (rule 5)
  - `a_refused_link_carries_its_address_for_the_tooltip_and_no_page` (rule 4)
  - `task_boxes_are_icons_with_their_word_never_inputs` (rule 3)
  - `table_cells_carry_their_alignment` (rule 3)
  - `loading_empty_refused_and_failed_show_their_sentence_and_retry` (rule 7)
- `mergeRequestDescriptionText.test.ts`: each word, and each refusal sentence ending as given.
- `mergeRequestTitles.test.ts` passes over the new files unchanged.

**Commands:**

- `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend fmt:check`, `pnpm -C frontend test`,
  `pnpm -C frontend unused` and `pnpm -C frontend sfc-order`: their summary lines.
- `just mutants HEAD` in your workspace (SP11).

**Smoke — WebKit fixture**, both windows (`--diff`, and `--range-case review --mr list`), dark and light (`--settings
'{"theme":"light"}'`). Start with `just app-session start-fixture --name mdp --diff --mr list --size 1600x1000` and open
the merge-requests page.

1. **Column.**
   - Every row's info column sits after the approvals and before the CI box.
   - !638 has no button, and its CI box stays in line with the others (WebDriver rects).
   - Hovering the button shows "Show description". A click does not log `fixture_page`.
2. **Rich.**
   - Open !640: "Loading…", then every element of rule 3.
   - The ruby block has coloured spans; the mermaid block is plain.
   - The uploaded image loads; the broken one shows "broken screenshot"; the stand-in for another site loads; the
     refused one shows "refused picture".
3. **Links.**
   - Click `#12`: the log has `fixture_page { page: "…/-/issues/12" }`, the panel stays, and `location.href` is
     unchanged.
   - Hover `mailto:…`: its tooltip shows the address. A click logs nothing.
   - `javascript:…`: a click logs nothing, and `window.yamtPlanted` stays undefined.
4. **Closing.**
   - Escape closes it, and focus is on !640's button.
   - Reopen: the close button closes.
   - Reopen: a press on the page header closes.
   - Reopen: a second click on the same button closes.
   - Each reopen logs a new `fixture_description` (rule 7).
5. **Replace.** With !640 open, click !639's button: one panel, !639's.
6. **Scroll.** !639 scrolls inside the panel; the panel's height ≤ 85% of the window. A wheel over the list behind
   scrolls the list and leaves the panel open.
7. **Refresh.** With !640 open, press Refresh: the panel stays as loaded.
8. **Empty and failed.**
   - !637 says "No description.".
   - !636 says "Could not read the description: glab: a deadline line" with Retry. Retry shows the rich description.
9. **Planted as text.** !635 shows its three lines literally. No `iframe`, `script` or `img` is in the panel's DOM, and
   `window.yamtPlanted` is undefined.
10. **Keyboard.**
    - Tab to !640's info button; Enter opens.
    - Tab moves through the close button, then the links and summaries.
    - Space on the `summary` opens the details.
    - Escape closes and returns to the button.
11. `shot` of !640's panel in dark and light, and of the row column.

**Smoke — real app.**

1. Run `scripts/local-conflicts-repo.sh <scratch>/mpv`, then `cargo tauri build --debug --no-bundle`, then `just
   app-session start-app --name mdr --diff --dir <scratch>/mpv --glab mr-description`.
2. Open !52: every element; images A and B load from `yamt-picture:`; image C shows its caption; `images.example` and
   `evil.example` show their captions (no network) or load.
3. Click `https://docs.example/x`: the fake xdg-open logs it.
4. Open !50: `window.yamtPlanted` is undefined; no `iframe`, `form`, `object`, `video` or `audio` element in the
   document; `getComputedStyle(document.body).display` is not `none`.
5. Paste the fake glab log's lines. It has the uploads route and never `images.example` or `evil.example`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://risk-register` (proposed RK66, RK67),
`skill://verification`.
