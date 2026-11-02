# Slice mr-row-details-hover — one tooltip directive, a hover box and a hover menu for the merge-request page

Feature: merge-request row details (request `docs/slices/request-mr-row-details.md` rules 3, 5, 8, 11; design
`docs/slices/briefs/mr-row-details-design.md` option A, §1.5, §1.6, §2.3; proposed plan §2 #154, #155, #157; owner
answer 2: the custom tooltip on the merge-request page only). Generic `ui/` primitives with no user yet:
`mr-row-details-page` puts them on the page's elements (it owns every page file, so this slice owns none). Runs beside
`mr-row-details-state`; needs nothing.

## Target

Owned: `frontend/src/ui/tooltip.ts` (new), `frontend/src/ui/tooltip.test.ts` (new),
`frontend/src/ui/operationTooltip.ts` (add `tooltipPlacement`; `tooltipBox` unchanged),
`frontend/src/ui/operationTooltip.test.ts`, `frontend/src/ui/useHoverBox.ts` (new),
`frontend/src/ui/useHoverBox.test.ts` (new), `frontend/src/ui/useHoverMenu.ts` (new),
`frontend/src/ui/useHoverMenu.test.ts` (new), `frontend/src/ui/useDropdownMenu.ts` (add `open`, `dismiss`; existing
behaviour unchanged).

Read-only: everything else — every `ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*` file (the page slice's),
`OperationLabel.vue` and every other window's file (owner answer 2: they keep `title`), `style.css` (reuse the existing
`hover-tooltip` and `tooltip-text` utilities, `style.css:169,175`), `vite.config.ts` (node tests only: browser tests are
`editor/` only, `vite.config.ts:14`), `ui/AGENTS.md` and `docs/**` (the docs keeper's: put your lines in
`deviations_from_brief`).

Non-goals: migrating any `title` (the page slice does it on the page); tooltips with rich content (that is the hover
box); a tooltip in `editor/` (CodeMirror's own); other windows.

## Contract

Fixed (add-only beyond this):

```ts
// ui/operationTooltip.ts — beside tooltipBox, sharing its GAP_PX (4) and MAX_WIDTH_PX (480)
export type Anchor = { readonly top: number; readonly bottom: number; readonly left: number };
export function tooltipPlacement(input: { readonly anchor: Anchor; readonly tip: Size; readonly viewport: Size }):
  { readonly left: number; readonly top: number; readonly maxWidth: number };
// above the anchor (top = anchor.top − GAP − tip.height) when that is ≥ 0, else below (anchor.bottom + GAP);
// left = anchor.left, moved left so the tip ends inside the viewport, never below 0; maxWidth = min(480, viewport.width).

// ui/tooltip.ts
export const TOOLTIP_DELAY_MS = 400;     // the first tip
export const TOOLTIP_WARM_MS = 300;      // a tip asked within this long of the last one closing shows at once
export const vTooltip: Directive<HTMLElement, string | null>;  // `v-tooltip="text"`; null or "" shows nothing
```

Directive behaviour: one tip element per window (`div`, `aria-hidden="true"`, `role` none, classes `pointer-events-none
fixed z-500 w-max overflow-hidden hover-tooltip px-2 py-1 tooltip-text wrap-break-word whitespace-pre-wrap select-none`
as `OperationLabel.vue:70`), created at the first show, placed by `tooltipPlacement` after its text is set (measure, then
place); `pointerenter` starts the delay (or shows at once inside the warm window); `pointerleave`, a `pointerdown`
anywhere, `Escape` (keydown, not prevented, not consumed), a scroll anywhere (capture) hide it; the bound value
changing while shown changes the text; the element unmounting while its tip shows hides it. Multi-line text (`\n`)
shows as lines. The directive mirrors the text into the element's `aria-description`, except when it equals the
element's `aria-label`, and removes it on `null`/unmount; it never sets `title` or `aria-label`.

```ts
// ui/useHoverBox.ts — the CI box's open/close (CiStatusBox.vue:40-110), for any box the pointer may enter
export function useHoverBox(parts: {
  readonly area: () => HTMLElement | null;     // opener and box inside it
  readonly opener: () => HTMLElement | null;   // the box opens below its left edge, focus returns here on Escape
  readonly box: MaybeRefOrGetter<HTMLElement | null>;
}): {
  readonly open: Readonly<ShallowRef<boolean>>;
  readonly placement: ComputedRef<{ readonly left: string; readonly top: string }>;  // useMenuPlacement
  readonly on: {                                // bind on the area: v-on="on"
    pointerenter(): void; pointerleave(): void; focusin(event: FocusEvent): void; focusout(event: FocusEvent): void;
    keydown(event: KeyboardEvent): void;
  };
  close(): void;
};
// opens at once on pointer or focus entering; stays while pointer or focus is inside; closes on leaving both, on
// Escape (focus to the opener) and on a scroll outside the box (CiStatusBox.vue `scrolled`), as today's CI box.

// ui/useDropdownMenu.ts — DropdownMenu<T> gains
open(which: T): Promise<void>;    // opens `which` (closing another) and places it like toggle, without moving focus
dismiss(): Promise<void>;         // closes; focus returns to the opener only when it was inside the menu
                                  // (closeAfterClick's rule, useDropdownMenu.ts:42-49)

// ui/useHoverMenu.ts — one dropdown for several openers, opening on hover
export const HOVER_CLOSE_MS = 300;
export type HoverMenu<T> = DropdownMenu<T> & {
  pointerEntered(which: T): void;   // over an opener or its menu: opens `which` (others close), cancels a pending close
  pointerLeft(): void;              // left opener and menu: dismiss after HOVER_CLOSE_MS unless re-entered
  openerClicked(which: T): Promise<void>;  // a click: when `which` is open by hover, keep it open and move focus to
                                           // its first item (pinned: hover leaving no longer closes it); else toggle
};
export function useHoverMenu<T>(parts: { menu: () => HTMLElement | null; opener: (which: T) => HTMLElement | null }): HoverMenu<T>;
// one openFor: one menu open at a time by construction. A pinned menu closes as today (Escape, click outside, a
// second click on its opener, window blur).
```

## Change

1. `operationTooltip.ts`: `tooltipPlacement` (and an `Anchor` type); tests.
2. `tooltip.ts`: the directive. Keep the timing decisions in a small pure part (for example a function from the last
   close time and now to "at once" or "after 400 ms") so node tests cover them with fake timers; the DOM part thin.
3. `useHoverBox.ts`: CI box's logic generalised (the page slice moves `CiStatusBox.vue` onto it); its `isInside` takes
   the area from `parts.area`.
4. `useDropdownMenu.ts`: `open`, `dismiss`; the five existing users unchanged.
5. `useHoverMenu.ts` over one `useDropdownMenu<T>`; tests with fake timers (in node, `menu()`/`opener()` may answer
   `null`; `useDropdownMenu`'s DOM steps already tolerate it, `useDropdownMenu.ts:67-70`).

## Acceptance

- Vitest (`pnpm -C frontend test`, node), each named for the bug it catches, at least:
  - `operationTooltip.test.ts`: `a_tip_that_fits_above_sits_above_at_the_left_edge`,
    `a_tip_that_does_not_fit_above_goes_below`, `a_tip_near_the_right_edge_moves_left_never_past_0`; `tooltipBox`'s
    tests unchanged.
  - `tooltip.test.ts`: `the_first_tip_waits_400_ms`, `a_tip_within_300_ms_of_the_last_shows_at_once`,
    `a_tip_after_the_warm_window_waits_again`, leave/Escape/scroll/press hide (through the pure part and the
    listeners it registers, with fakes).
  - `useHoverMenu.test.ts`: `hover_opens_without_moving_focus`, `moving_to_another_opener_closes_the_first_at_once`,
    `leaving_closes_after_300_ms_and_re_entering_cancels`, `a_click_on_a_hover_opened_opener_pins_it`,
    `a_second_click_closes`, `escape_closes_a_pinned_menu`.
  - `useHoverBox.test.ts`: open on pointer or focus, stays while either is inside, closes on leaving both, Escape.
- `pnpm -C frontend lint`, `typecheck` (errors only in files of `mr-row-details-page` or `-state` if they have not
  landed yet, listed): summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://verification`.
