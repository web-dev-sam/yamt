# Slice MrRowColours — colours on the merge-request row's details line

Owner, 2026-10-31, after the two-line row (`briefs/mr-row-two-lines.md`): "the gitlab id can be muted, created X ago
too, +X-Y green and red and X files white like now".

Today (`frontend/src/ui/MergeRequestRow.vue` line 2, a `<p class="… text-fg-muted text-xs">`) the whole line is muted.
The size comes as one string from `mergeRequests/` `sizeText` (`"+8 −1 · 2 files"`, `internal/size.ts`), so it cannot
be coloured in parts.

## Target

Owned: `frontend/src/mergeRequests/internal/size.ts`, `frontend/src/mergeRequests/internal/size.test.ts`, the
`sizeText` export in `frontend/src/mergeRequests/index.ts`, `frontend/src/ui/MergeRequestRow.vue`, and the row's
paragraph in `frontend/src/ui/AGENTS.md`. Read-only: everything else. No contract change, and no new colour tokens.

## Change

1. The size's words come in parts so the row can colour them: for example `sizeParts(size)` →
   `{ added: "+8", removed: "−1", files: "2 files" }` (a real minus U+2212, `file`/`files` plural as today). It
   replaces `sizeText`; migrate every caller and test, with no alias left behind. `sizeTitle` (the hover) stays.
2. Line 2's colours: `!iid` muted, `created … ago` muted, the `·` separators muted, `+X` in `text-success-signal`,
   `−Y` in `text-problem-error` (the pair `RangeCounts.vue` uses for the range window's line counts), and `N files` in
   the normal text colour (`text-fg`). Sizes and spacing stay as they are: one space between `+X` and `−Y`, and
   `·` before the file count.
3. Unchanged: the line's `textContent` (`!32 · created 1 day ago · +75 −12 · 5 files`, and `!27 · created 3 days
   ago` for a row without a size), the plain-text separators (finding #2044: no whitespace between the tags, since
   Vue's condense mode would add or drop spaces), the hover titles (the size's hover on the whole size part), the
   truncation, and the click, cursor and hover rules.

## Acceptance

- Unit tests in `size.test.ts`: the parts, the U+2212 minus, and one file versus several files. Your layer's recipes
  (SP3) and `just mutants HEAD` (SP11).
- On WebKit (`just app-session … --diff --glab mr-conflicts` on `scripts/mr-conflict-repo.sh`'s repository): report
  verbatim line 2's `textContent` for !32 and !27, and the computed `color` of each part of !32 (iid, age, separator,
  +, −, files). Take one screenshot of the list in the default dark theme and one in a light theme (`webstorm-light`).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
