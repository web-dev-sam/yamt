# Slice MrRowPointer — one cursor on a merge-request row, buttons that show they are separate

Owner, 2026-10-31, on the real GitLab playground: "the cursor is weird, on the title its default, row is pointer,
buttons is default" → "everything pointer, but the buttons should have a on hover bg change so I know when I click the
row and when the button".

Today (`frontend/src/ui/MergeRequestRow.vue`): the `<li>` has `cursor-pointer hover:bg-row-hover` when `row.page` is
set. The title `<button>` gets the browser's default cursor (Tailwind preflight). The CI box carries
`cursor-default`, and so do the action button (Resolve/Continue) and the open-changes button. The buttons'
`hover:bg-hover` is often invisible on top of the row's `hover:bg-row-hover`: in atom-dark/light and zed-dark/light,
`--color-hover` and `--color-row-hover` are the same opaque colour; in the others the two are close translucent tints.

## Target

Owned: `frontend/src/ui/MergeRequestRow.vue`, a new `frontend/src/ui/MergeRequestRow.browser.test.ts` if a test
earns its place (VF rules: no tests of class strings), and the row's paragraph in `frontend/src/ui/AGENTS.md`. Read-only:
everything else, `CiStatusBox.vue` included. Only the merge-request row changes; other places that use `CiStatusBox`
and the theme colours stay as they are. No contract change.

## Change

1. The hand cursor (`cursor-pointer`) covers the whole row when the row opens a page: its empty space, the title, and
   every enabled button in it (CI box, Resolve/Continue, open changes, the CI box's failed-job buttons). A row
   without a page (`row.page === null`) does not open anything, so it shows the hand only on its enabled buttons.
2. While the pointer is over an enabled button, only that button is highlighted (`bg-hover`), not the row, in every
   theme. While it is over the title or the row's empty space, the row is highlighted (`bg-row-hover`) as today. This
   way the owner sees what a click will hit. Use Tailwind variants for this (for example a `group`/`has-[…]` rule on the
   `<li>` keyed on the row's buttons, the title excluded); do not change the theme colour tokens.
3. A disabled button cannot be clicked, so it shows the normal arrow and no highlight, and the row stays unhighlighted
   while the pointer is over it. Today the disabled action button has `disabled:pointer-events-none`, so the pointer
   falls through to the row; fix that inside the row, without changing what a click there does (nothing).
4. Keyboard focus rings and the click behaviour (row and title open the page; the buttons and the CI box stop
   propagation) stay as they are.

## Acceptance

- `pnpm` lint, typecheck and the row's tests (your layer's recipes, SP3) pass; `just mutants HEAD` in your workspace
  (SP11).
- On WebKit through the private display (`just app-session … --glab tests/glab/mr-conflicts` with
  `scripts/mr-conflict-repo.sh`'s repository; read `skill://verification`): read the computed `cursor` of the row,
  the title, the CI box, an enabled Resolve, open changes and a disabled action button. Take one screenshot hovering
  open changes and one hovering the title, in the default dark theme and in zed-dark (where `--color-hover` equals
  `--color-row-hover`). In each screenshot only the hovered thing is highlighted. Report the computed values and the
  screenshot paths.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
