# Slice mr-heading-web — the range window's merge-request line, structured column headers, and their fixtures

Feature "MR heading" build 3 of 3; needs `mr-heading-rust` committed **with** the regenerated `ipc/bindings.ts` and
`fixtures/range/*.json` (the orchestrator runs `just bindings` and `just fixtures` after that patch), **and**
`mr-heading-sides` committed (rule 7: `RangeApp.vue`, `SideColumn.vue`, `ui/fileListKey.ts` and `ui/AGENTS.md` as it left
them are your base; keep its side-column change). Request: `docs/slices/request-mr-heading.md` rules 2, 3, 4, 5, 6 and the
owner's answers (read it whole). VU18 (`skill://vue-conventions` "Looks"): no separator character (`·`, `|`, `•`, `-`)
between parts, spacing and alignment only. Design: `docs/slices/briefs/mr-heading-design.md` option A, §0, §1 (headers
and wording), §4.2. Plan rows: #103 (range fixtures), #125 (folder sums, the `+a −r` look), #196 (since view's "As you
reviewed it" stays), proposed #199.

Facts (given, from the design's §0):

- `RangeStart` domain type and `toRangeStart`: `frontend/src/ipc/rangeDomain.ts:22-27,71-78`; brands through
  `branded(value, guard, path)` (`ipc/validate.ts`); `isMergeRequestIid` (`ipc/domain.ts:199-201`).
- `sideLabel`/`sideHeading`/`emptyRangeText`: `ui/rangeText.ts:66-76`; `lineCounts` `:82-86`; `RangeCounts.vue:12-16`
  (`text-success-signal` / `text-problem-error`, `tabular-nums`); `mergeRequestReference(iid)` = `!<iid>`
  (`ui/mergeRequestsText.ts:123-125`).
- Headers: `ui/RangeView.vue:63-67` (computed), `:173-185` (two `<h3>` in grid cells, `text-fg-muted`, subject as
  `title`); header row `:105-170`. Props `leftSide`/`rightSide` from `ui/RangeApp.vue:149-158`; the bar stack
  `RangeApp.vue:144-147`; empty text `RangeApp.vue:66-68,160-172`.
- `rangePanes` titles from `sideHeading`: `ui/rangeSearch.ts:27-35`. `twoDotsHint` uses `sideLabel(right)`
  (`ui/rangeThreadText.ts:73-79`): unchanged.
- Chip look: `ui/KeymapList.vue:149` (`rounded border border-control-border bg-panel-inline px-1.5`); tokens in every
  theme (`style.css:24-60`, `themes/*.css`).
- Fixture: `ipc/fixtureRange.ts` (`CASE` 95-103, `missingCase` 105-112, `shownCase` 114-123, the source 140-173).
- `app-session`: `start-fixture` URL parameters `scripts/app-session/startArgs.ts:104-115`; `start-app` `opening`
  `:59-87`, `appArgs` `:238-261`; option specs and `USAGE` in `scripts/app-session/args.ts:17-44,88-119`.
- `RangeStart` literals in tests (typecheck finds every one): `ipc/fixtureGitLab.test.ts`, `ipc/fixtureRange.test.ts`,
  `ipc/fixtureReview.test.ts`, `ipc/rangeDomain.test.ts`, `ipc/tauriRange.test.ts`, `ui/mergeRequestsText.test.ts`,
  `ui/rangeText.test.ts`, `ui/rangeThreadText.test.ts`.
- From `mr-heading-rust` (its Contract, fixed): generated `MergeRequestNames { title, source, target }`, `RangeHeading =
  { kind: "typed" } | { kind: "mergeRequest"; iid: number; names } | { kind: "unnamedMergeRequest"; iid: number }`,
  `RangeTotals { added, removed }` (Rust's sum of the listed files' `counted` lines; never recompute it here),
  `RangeStart` gains `heading` and `totals`; the generated fixtures carry `"heading": { "kind": "typed" }` and `totals`.

## Target

**Owned:** `frontend/src/ipc/rangeDomain.ts`, `frontend/src/ipc/index.ts`, `frontend/src/ipc/fixtureRange.ts`,
`frontend/src/ipc/AGENTS.md`, `frontend/src/ui/rangeText.ts`, `frontend/src/ui/rangeSearch.ts`,
`frontend/src/ui/RangeApp.vue`, `frontend/src/ui/RangeView.vue`, `frontend/src/ui/RangeHeadingLine.vue` (new),
`frontend/src/ui/RangeColumnHeading.vue` (new), `frontend/src/ui/AGENTS.md`,
`frontend/scripts/app-session/startArgs.ts`, `frontend/scripts/app-session/args.ts`,
`frontend/src/**/*.test.ts` and `frontend/scripts/app-session/*.test.ts` (only for this slice's tests and the
`RangeStart` literals above).

`RangeApp.vue`, `ui/AGENTS.md` and the `*.test.ts` glob are owned by `mr-heading-sides` before you: you start only after
it is committed, so no two running builds own them.

**Read-only:** everything else; `frontend/src/ipc/bindings.ts` and `frontend/fixtures/**` are generated (never edit);
Rust is `mr-heading-rust`'s; `SideColumn.vue`, `App.vue`, `CompareApp.vue`, `fileListKey.ts` are `mr-heading-sides`'.

**Non-goals:** the OS title bar (Rust); any GitLab call; a click target on the line; per-file counts; the since view's
left heading (stays "As you reviewed it"); `sideLabel`/`twoDotsHint`; the merge and compare windows.

## Contract (fixed; you may add, never change)

```ts
// ipc/rangeDomain.ts (exported through ipc/index.ts)
export type MergeRequestNames = Readonly<Generated.MergeRequestNames>;
export type RangeHeading =
  | { readonly kind: "typed" }
  | {
      readonly kind: "mergeRequest";
      readonly iid: MergeRequestIid;
      readonly names: MergeRequestNames;
    }
  | { readonly kind: "unnamedMergeRequest"; readonly iid: MergeRequestIid };
export type RangeTotals = Readonly<Generated.RangeTotals>;
export type RangeStart = {
  readonly range: string;
  readonly heading: RangeHeading;
  readonly totals: RangeTotals;
  readonly left: RangeSide;
  readonly right: RangeSide;
  readonly files: readonly RangeEntry[];
};
// toRangeStart brands heading.iid with branded(iid, isMergeRequestIid, "heading.iid").

// ui/rangeText.ts — the one place a side's shown name is decided
export type ColumnName =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly branchedOff: string | null; // the branch that branched off here, shown "where <it> branched off"
      readonly shortId: string;
      readonly subject: string;
    }
  | { readonly kind: "commit"; readonly shortId: string; readonly subject: string };
export type ColumnNames = { readonly left: ColumnName; readonly right: ColumnName };
export type HeadingLine =
  | {
      readonly kind: "mergeRequest";
      readonly reference: string;
      readonly title: string;
      readonly source: string;
      readonly target: string;
    }
  | {
      readonly kind: "unnamedMergeRequest";
      readonly reference: string;
      readonly source: string;
      readonly target: string;
    }
  | {
      readonly kind: "typed";
      readonly left: string;
      readonly dots: ".." | "...";
      readonly right: string;
    };
export const RANGE_HEADING_LABEL = "What this window compares";
export function columnNames(start: Pick<RangeStart, "heading" | "left" | "right">): ColumnNames;
export function branchedOffNote(branch: string): string; // `where ${branch} branched off`
export function columnText(column: ColumnName): string;
export function headingLine(start: Pick<RangeStart, "heading" | "left" | "right">): HeadingLine;
export function emptyRangeText(start: Pick<RangeStart, "heading" | "left" | "right">): string;
// removed: sideHeading (no caller left). sideLabel stays.
```

**`columnNames`** (subject = the side's `subject` always):

| heading                                    | left                                                 | right                                                |
| ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| `typed`, label `named { name }`            | named `name`, `branchedOff` null                     | same rule                                            |
| `typed`, label `mergeBase { left, right }` | named `left`, `branchedOff` = `right`                | same rule (never produced for the right; exhaustive) |
| `mergeRequest { names }`                   | named `names.target`, `branchedOff` = `names.source` | named `names.source`, null                           |
| `unnamedMergeRequest`                      | commit                                               | commit                                               |

**`columnText`**: named with `branchedOff` → `main, where feature branched off (531ea52)`; named without → `feature
(9c1ba3f)`; commit → `9c1ba3f`. **`emptyRangeText`** → `${columnText(left)} and ${columnText(right)} have the same
files.` **`headingLine`**: `mergeRequest` → reference `mergeRequestReference(iid)`, title, source, target;
`unnamedMergeRequest` → reference, source = `right.shortId`, target = `left.shortId`; `typed` → left = the left label's
`name` (`mergeBase`: its `left`), right = the right label's `name` (`mergeBase`: its `right`), dots `...` when the left
label is `mergeBase`, else `..`.

**Components.**

- `ui/RangeColumnHeading.vue`, props `{ column: ColumnName }`: one `<h3 class="truncate border-b border-separator px-3
  py-1.5" :title="column.subject">` (grid placement classes fall through from the parent); named → `<span
  class="font-semibold text-fg">name</span>`, then when `branchedOff` `<span class="text-fg-muted">{{
  branchedOffNote(branchedOff) }}</span>`, then `<span class="font-mono text-fg-muted">shortId</span>`; commit → the
  short id span alone. Words separated by plain spaces, so a copy reads as the line does.
- `ui/RangeView.vue` props become `{ file: RangeEntry; columns: ColumnNames; shown: boolean; view: RangeViewKind }`; left
  header: since view → today's `<h3>` with `SINCE_REVIEW_HEADING`, else `RangeColumnHeading` of `columns.left`; right →
  `RangeColumnHeading` of `columns.right`.
- `ui/RangeHeadingLine.vue`, props `{ start: RangeStart }`: root `<div role="group" :aria-label="RANGE_HEADING_LABEL"
  class="flex h-9 shrink-0 items-center gap-2 island bg-panel px-3">`; parts set apart by `gap-2` and alignment only
  (VU18: no `·`, `|`, `•` or `-` text between them). `mergeRequest`: `<span class="shrink-0 text-fg-muted">!12</span>`,
  `<span class="min-w-0 flex-1 truncate font-semibold" :title>title</span>`, source chip, `<span class="shrink-0
  text-fg-muted">→</span>` (direction, content), target chip, totals. The source chip holds `names.source` as Rust sent
  it: `feature`, `sam:feature` for a fork, `(fork) feature` for a fork GitLab does not show (rule 5); never rewritten
  here. `unnamedMergeRequest`: reference, the two short-id chips with the arrow, totals. `typed`: left chip, `<span
  class="shrink-0 font-mono text-fg-muted">...</span>` (or `..`: the range's own syntax, content, since two and three
  dots compare different commits), right chip, totals. Chip: `<code class="max-w-64 min-w-0 truncate rounded border
  border-control-border bg-panel-inline px-1.5 font-mono text-code" :title="<full name>">`. Totals: `RangeCounts` with
  `{ kind: "counted", ...start.totals }` and `class="ml-auto"` (always at the right end).
- `ui/RangeApp.vue`: `<RangeHeadingLine v-if="start !== null && screen.kind === 'files'" :start="start" />` as the
  **first** child of the bar stack (before `ProblemBar`): on the files screen only (rule 2, rule 7), with or without a
  file; `v-if`, so the stack stays `empty:hidden` on Settings and the merge-request list. `columns =
  computed(columnNames(start))` passed to every `RangeView`.
- `ui/rangeSearch.ts`: pane titles `columnText(columnNames(start).left|right)`.

**Fixture `?heading=`** (`ipc/fixtureRange.ts`; replaces the shown case's `heading` only; its `totals`, labels and files
stay the case's; reviewed/threads/GitLab fixtures see the replaced start):

| value          | heading                                                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeRequest` | `{ kind: "mergeRequest", iid: 12, names: { title: "Reminders before a card is due", source: "feature", target: "main" } }`                                                                                                                            |
| `fork`         | `{ kind: "mergeRequest", iid: 8, names: { title: "Show every reminder of a board in one list, grouped by the day it is due, with a count per day and a link to each card", source: "sam:feature/reminders-grouped-by-due-day", target: "main" } }`    |
| `hiddenFork`   | `{ kind: "mergeRequest", iid: 8, names: { title: "Show every reminder of a board in one list, grouped by the day it is due, with a count per day and a link to each card", source: "(fork) feature/reminders-grouped-by-due-day", target: "main" } }` |
| `unnamed`      | `{ kind: "unnamedMergeRequest", iid: 12 }`                                                                                                                                                                                                            |

Absent or empty → the case's. Unknown → `log.info("range.fixture_heading_miss", { heading, known: "mergeRequest, fork,
hiddenFork, unnamed" })` and the case's. `CASE` parses `heading` (the three variants) and `totals`; `missingCase` has `{ kind:
"typed" }` and `{ added: 0, removed: 0 }`.

**`app-session`.**

- `start-fixture --heading <mergeRequest|fork|hiddenFork|unnamed>` → `&heading=<value>` after `reviewed` (order `threads`,
  `gitlab`, `reviewed`, `heading`), only with `--range-case`; the refusal becomes "start-fixture takes --threads,
  --gitlab, --reviewed, --heading and --ai only with --range-case".
- `start-app --mr-title <text> --mr-source <branch> --mr-target <branch>`: all three or none, only with `--review-of`
  (else "start-app --mr-title, --mr-source and --mr-target go together, with --review-of"); the range `Opening` gains
  `names: { title, source, target } | null`; `appArgs` adds `--mr-title=<text>`, `--mr-source=<branch>`,
  `--mr-target=<branch>` right after `--review-of=<…>`. `USAGE` names both.

## Change

1. `ipc/`: the domain types, `toRangeStart`, `index.ts` exports, the fixture's `CASE`, `missingCase` and `?heading`;
   `ipc/AGENTS.md`.
2. `ui/rangeText.ts`: the contract's functions; `sideHeading` removed; `emptyRangeText` on `columnText`.
3. `ui/RangeColumnHeading.vue`, `ui/RangeHeadingLine.vue`; `RangeView.vue` and `RangeApp.vue`; `rangeSearch.ts`;
   `ui/AGENTS.md` (the line, the headers, `columnNames` as the one naming rule).
4. Every `RangeStart` literal in tests gains `heading` and `totals`.
5. `app-session` flags and their tests.

## Acceptance

- `ipc/rangeDomain.test.ts`: `toRangeStart` keeps `heading` and `totals`, brands the iid; `heading.iid` −1 or 1.5
  throws naming `heading.iid`.
- `ui/rangeText.test.ts`: one test per `columnNames` row of the table (both sides); `columnText` of the three shapes;
  `emptyRangeText` for `main..dev` (`main (1b2cfed) and dev (2b3b4b5) have the same files.`), `main...feature` and a merge
  request; `headingLine` for each kind, `..` vs `...`; no header text of an `unnamedMergeRequest` start holds its labels'
  40-character names.
- `ui/rangeSearch.test.ts`: a merge-request start's pane titles are `main, where feature branched off (531ea52)` and
  `feature (9c1ba3f)`.
- `ipc/fixtureRange.test.ts`: `?range=review&heading=mergeRequest|fork|hiddenFork|unnamed` answer those headings with the case's
  totals and files; `&heading=nosuch` logs `range.fixture_heading_miss` and answers `typed`; no `heading` → `typed`.
- `scripts/app-session` tests: `--heading` only with `--range-case`, its place in the search; the three `--mr-*` flags
  reach the app after `--review-of=…`, refused partial or without `--review-of`.
- Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `just web-unused`,
  `just mutants HEAD`.
- WebKit (VF8: MiniBrowser through `just app-session`; Playwright's WebKit does not launch here): `just app-session
  start-fixture --name mhw --range-case review --heading mergeRequest --size 1280x800`, then `read` the line's text
  (`!12`, the title, `feature`, `→`, `main`, `+A −R` equal to `jq '.start.totals' frontend/fixtures/range/review.json`;
  no `·`, `|`, `•` or `-` in it), both headers' texts, the `+A` and `−R` spans' computed colours equal to a
  `RangeFileRow`'s, and that every `header` button's right edge is ≤ `innerWidth`; open Settings and the merge-request
  list: no line, no side column; back to files: both as before; `--heading fork` and `--heading hiddenFork` at 1280x800
  and 900x600 (chip `sam:feature/…` / `(fork) feature/…`, title truncated, chips truncated, header buttons visible);
  `--heading unnamed` (headers are short ids only); no `--heading` (chips `main` `...` `feature`, left header `main where
  feature branched off 531ea52`); `--range-case empty` (the line above the empty text). `shot` each, dark and light
  (`read --name mhw "document.documentElement.dataset.theme = 'light'"`).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://ipc-contract`, `skill://verification`.
