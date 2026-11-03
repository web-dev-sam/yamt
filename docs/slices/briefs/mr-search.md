# Slice mr-search — text search in the merge-request list: title, and a merge-request number anywhere in the text

Owner's words (#2150, 2026-11-03): "Text search in MR list (also matches XXXX gitlab id anywhere in search text,
searches title)". Window: the merge-request page (`ui/MergeRequestsView.vue`, state `ui/mergeRequests.ts`, framework-free
core `frontend/src/mergeRequests/`). Details marked "(orchestrator)" are the orchestrator's choice; the owner may veto.
Base: main `b8207a3a`.

## Target

Owned: `frontend/src/mergeRequests/internal/search.ts` (new), `frontend/src/mergeRequests/internal/search.test.ts`
(new), `frontend/src/mergeRequests/index.ts`, `frontend/src/mergeRequests/AGENTS.md`, `frontend/src/ui/mergeRequests.ts`,
`frontend/src/ui/mergeRequests.test.ts`, `frontend/src/ui/MergeRequestsView.vue`, `frontend/src/ui/MergeRequestSearch.vue`
(new, if the field earns its own component), `frontend/src/ui/mergeRequestsText.ts`,
`frontend/src/ui/mergeRequestsText.test.ts`, `frontend/src/ui/AGENTS.md`.

Read-only: everything else — `ui/mergeRequestFilters.ts` and `mergeRequests/internal/filters.ts` / `stored.ts` (the
search is not a stored filter: `Filters`, `isFiltered`, the stored words and "Clear filters" stay as they are),
`internal/choices.ts` (checklist counts stay over every loaded row), `style.css` (no new token: the palette fence),
every other window, `docs/**` (put doc lines in `deviations_from_brief`).

Non-goals: searching GitLab (only the loaded rows are searched; a cut list stays cut); searching anything but the title
and the number (author, labels, branch, description); fuzzy matching, highlighting the match in the title; a keyboard
shortcut to focus the field; remembering the text across page visits or restarts; a search history.

## Rules

1. **Field (orchestrator).** A text field is the first item of the filter bar, left of the Assignee filter: Lucide
   `search` icon inside on the left (muted, `aria-hidden`), placeholder "Search title or !number", accessible name
   "Search merge requests", the page's control look (border, rounded, the panel colour, the focus ring the other
   fields of the app use), a sensible fixed width that leaves the filter buttons on the same line at 1600 px. While it
   holds text, an `x` button inside on the right (name "Clear search") empties it and keeps the focus in the field. No
   `title` attribute (the page's tooltip rule).
2. **Title match.** A row matches when its title (GitLab's, "Draft: " prefix included, as shown) contains the
   trimmed search text, ignoring case. Text that is empty or only whitespace matches every row.
3. **Number anywhere in the text.** A row also matches when any number in the search text equals its iid. A number is
   a run of digits with no letter or digit right before or after it (orchestrator): `!1234`, `#1234`, `1234`,
   `MR 1234 fix`, `see !1234,` and a pasted `https://gitlab.example.com/g/p/-/merge_requests/1234` all name 1234;
   `v2`, `abc123`, `12ab` name nothing; `0042` names 42. Several numbers name several merge requests ("!12 !34" shows
   both). Title match OR number match: typing `630` shows !630 and every title containing "630".
4. **Together with the filters.** A row is shown when it passes the filters (as today) and matches the search; due
   ones stay first (`datedFirst` as today). The summary line counts shown rows as today ("3 of 40 merge requests").
   The checklists' counts do not change with the search. "Clear filters" does not empty the search (orchestrator).
5. **Keys.** Typing filters at once (no delay; at most a few hundred rows). Escape in the field with text empties it
   and keeps the focus there; Escape in an empty field leaves the page as today (the field's handler calls
   `preventDefault` only when it emptied something: the page's `escapePressed` already skips prevented events).
6. **Lifetime (orchestrator).** The text lives in the page's state, kept across Refresh and while the page is open;
   it is empty each time the page is shown (`show`). Never stored.

## Contract

Core (`frontend/src/mergeRequests`, framework-free, exported from `index.ts`; all `readonly`):

```ts
// internal/search.ts
export type SearchedRequest = { readonly iid: number; readonly title: string };
export function searched<R extends SearchedRequest>(rows: readonly R[], text: string): readonly R[];
```

`searched` reads the text once (trimmed lower-cased text, the set of numbers rule 3 names), then tests each row; an
empty text returns `rows` itself. Any helper it needs stays unexported unless a test needs it.

State (`ui/mergeRequests.ts`, `MergeRequests`): `readonly search: Readonly<ShallowRef<string>>` and
`setSearch(text: string): void`; `shownRows` = `datedFirst(searched(filtered(rows, filters, me), search))`; `show`
empties the search. The view binds the field to `search` / `setSearch`.

## Acceptance

- `pnpm -C frontend test` (node), each named for the bug it catches, at least: case-insensitive title match; whitespace
  only matches all; each rule-3 form names its number (`!1234`, `#1234`, the URL, `see !1234,`) and `v2` / `abc123` /
  `12ab` name nothing; two numbers show two rows; a number matching nothing still lets a title match through; `0042`;
  in `mergeRequests.test.ts`: search AND an active filter, due dates still first, summary count, `show` empties the
  search, Refresh keeps it. `lint`, `typecheck`, `fmt:check`, `sfc-order`, `unused` clean.
- WebKit fixture (`just app-session start-fixture --diff --mr list --size 1600x1000`), dark and light, screenshots of
  a searched list in both: type `!630` → only !630 (plus titles containing "!630", if any) and the summary reads
  "1 of N"; type part of a fixture title in other case → those rows; paste a `…/merge_requests/620` URL → !620; search
  with the Label filter "frontend" on → only rows passing both; the `x` empties and keeps focus; Escape with text
  empties, a second Escape leaves the page; Refresh keeps the text; leave and reopen → empty field, full list; the
  filter bar stays on one line; no `[title]` on the page.
- `just mutants HEAD` (scope to your files' tests if its dry run stops on unrelated failures).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
