# Slice MrRowTwoLines — a merge-request row in two lines, like GitLab's list

Owner, 2026-10-31, with a screenshot of the playground's four rows: "make this more structured. All these info is in
one line and misaligned". He picked "Two lines, like GitLab" from three options:

```
Due dates on cards                              💬0  👍1  ✓  ⑂  ⎘
!1 · created 1 hour ago · +8 −1 · 2 files
──────────────────────────────────────────────────────────────────
Card labels                                     💬0  👍0  ✓     ⎘
!2 · created 1 hour ago · +1 −0 · 1 file
```

Today (`frontend/src/ui/MergeRequestRow.vue`, the first `<div>` of the row): the title, `!iid`, the age and the size
sit on one baseline with `gap-2`. Each row's details start where its title ends, so they don't line up across rows.

## Target

Owned: `frontend/src/ui/MergeRequestRow.vue`, the row's paragraph in `frontend/src/ui/AGENTS.md`. Read-only:
everything else. No contract change, and no new words (the parts and their hover titles stay as they are).

## Change

1. First line: the title alone (the `<button>` when the row has a page, else the `<span>`), still truncated with an
   ellipsis when too long, with its hover title and accessible name unchanged.
2. Second line, under the title and starting at the same left edge in every row: `!iid · created … · <size>`. It is
   muted (`text-fg-muted`) and one step smaller than the title, using the text size the app already uses for
   secondary text (look at the other lists and headers; don't invent a new size). The parts are separated by `·`,
   and when GitLab gave no size the line ends after the age with no dangling separator. The age keeps its exact-time
   hover (`createdTitle`), and the size keeps its hover (`size.title`). The line truncates instead of wrapping.
3. The right-hand group (discussions, approvals, CI box, readiness, action, Show Diff) keeps its fixed-width columns.
   It is centred vertically against the two lines, so the icons of every row stay in the same columns.
4. Unchanged: the click rules (row and title open the page, controls stop propagation, `data-row-control`, the
   hover/cursor rules of the previous fix), keyboard focus, the refusal and reply lines under the row, and the
   accessible names.

## Acceptance

- Your layer's recipes (SP3): format, lint, typecheck, tests. Run `just mutants HEAD` in your workspace (SP11): `.vue`
  only, say so.
- On WebKit through the private display (`skill://verification`): build `scripts/mr-conflict-repo.sh`'s repository,
  start `just app-session start-app … --diff --glab mr-conflicts`, and open "Merge requests". Take a screenshot of the
  list in the default dark theme. Using the DOM, report that every row's `!iid` element has the same `left` and its
  title the same `left`, and that each row's icon columns have the same `left` as the first row's. Report a row
  without a size (`!27`): its second line ends with the age. Narrow the window (or the list) until a title truncates
  and screenshot that.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
