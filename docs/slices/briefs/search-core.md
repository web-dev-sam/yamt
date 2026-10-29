# Slice SearchCore — the framework-free search core: matcher, place rule, order, filters, dismissals, cap

Board "Search" row 2 (session 35). Request `docs/slices/request-search.md` (read it whole: rules 5, 7, 9, 10, 12 are
yours); decision `docs/plan.md` §2 **#127** (read it whole). Design: `.omp/run/notes/SearchDesign.md` option A — §3.1
(data structures, matcher, place rule, order, key, preview, dismissals, cap) and §3.6 "Pure tests (B2)" are your spec
(given facts; re-check only `[INFERENCE]`). You build the designer's "B2". Beside you, `SearchGoTo` builds the editor
go-to (no shared files). Later builds import exactly the surface below.

Orchestrator-applied already: `frontend/vite.config.ts` node include `src/search/**/*.test.ts`; `frontend/.oxlintrc.json`
lists `src/search/**` as framework-free (PM3); `justfile` `mutants` covers `frontend/src/search/*.ts` and
`internal/*.ts`.

## Target

Owned: `frontend/src/search/index.ts`, `frontend/src/search/internal/*.ts` (`match`, `places`, `preview`, `results`,
`list` — split as fits, each with its `.test.ts`), `frontend/src/search/AGENTS.md`, `frontend/scripts/fences.ts`,
`frontend/scripts/fences.test.ts`.

Read-only: everything else. Docs are the orchestrator's.

Non-goals: any UI, store, IPC or editor code; whole word, regular expressions, replace, include/exclude; F4 keys.

## Contract (fixed; you may add, never change)

```ts
// frontend/src/search/index.ts — the module's only surface; imports no other src/ module (fence like jsonrpc/)
export type Query = { readonly text: string; readonly matchCase: boolean };
export type LineRange = { readonly start: number; readonly len: number }; // 0-based lines of one pane's text
export type Layout<P extends string> = { readonly panes: readonly [P, ...P[]]; readonly lead: P };
export type SearchedFile<P extends string> = {
  readonly path: string;
  readonly texts: Readonly<Record<P, string | null>>;           // null: the pane has no text
  readonly changes: readonly Readonly<Record<P, LineRange>>[];  // sorted and disjoint in every pane
};
export type PaneHit = { readonly line: number; readonly from: number; readonly to: number }; // UTF-16 columns in that line
export type PaneEntry<P extends string> = { readonly pane: P; readonly hit: PaneHit };
export type PlaceKey = string & { readonly __brand: "PlaceKey" }; // built only inside search/
export type Preview = { readonly before: string; readonly match: string; readonly after: string };
export type Place<P extends string> = {
  readonly key: PlaceKey;
  readonly hits: readonly [PaneEntry<P>, ...PaneEntry<P>[]]; // layout order, at most one per pane
  readonly preview: Preview;                                  // from the lead hit, else the first hit
};
export type FileGroup<P extends string> = {
  readonly path: string;
  readonly rank: number;                     // index in the window's file order
  readonly places: readonly Place<P>[];      // rule-7 order
  readonly dismissed: ReadonlySet<PlaceKey>; // only keys still among `places`
};
export type SearchResults<P extends string> = {
  readonly query: Query;
  readonly groups: readonly FileGroup<P>[];     // by rank; only files with places
  readonly dismissedFiles: ReadonlySet<string>; // kept across one-file re-runs, cleared by a full run
  readonly found: number;                       // places kept, ≤ MAX_ROWS
  readonly cut: boolean;
};
export type ListRow<P extends string> =
  | { readonly kind: "group"; readonly path: string; readonly count: number; readonly open: boolean }
  | { readonly kind: "place"; readonly path: string; readonly place: Place<P>; readonly shown: readonly [PaneEntry<P>, ...PaneEntry<P>[]] };
export type Summary =
  | { readonly kind: "searching" }
  | { readonly kind: "noResults" }
  | { readonly kind: "filteredOut" }
  | { readonly kind: "results"; readonly rows: number; readonly files: number; readonly cut: boolean };

export const MAX_ROWS = 20_000;
export type Matcher; // opaque (a branded or class type): one RegExp built once per query
export function matcherOf(query: Query): Matcher | null; // null for empty text
export function filePlaces<P extends string>(file: SearchedFile<P>, matcher: Matcher, layout: Layout<P>, limit: number): { readonly places: readonly Place<P>[]; readonly cut: boolean };
export function emptyResults<P extends string>(query: Query): SearchResults<P>;
export function withFile<P extends string>(results: SearchResults<P>, file: { readonly path: string; readonly rank: number; readonly places: readonly Place<P>[]; readonly cut: boolean }): SearchResults<P>;
export function dismissPlace<P extends string>(results: SearchResults<P>, path: string, key: PlaceKey): SearchResults<P>;
export function dismissFile<P extends string>(results: SearchResults<P>, path: string): SearchResults<P>;
export function listRows<P extends string>(results: SearchResults<P>, on: ReadonlySet<P>, closed: ReadonlySet<string>): readonly ListRow<P>[];
export function summaryOf<P extends string>(results: SearchResults<P> | null, on: ReadonlySet<P>, running: boolean): Summary | null; // null: empty box
export function goToPane<P extends string>(place: Place<P>, on: ReadonlySet<P>, layout: Layout<P>): PaneEntry<P> | null;
```

Rules (design §3.1, given): the matcher (`gu`/`giu` over the escaped text, `matchAll` over the whole text, line = count
of `\n` before the match, a trailing `\r` left out of the line's text, never a cross-line match, `limit` hits per
pane); the place rule (inside change `k` → key `("in", k, lineText, from, ordinal)` pairing identical lines
first-with-first; outside → aligned lead line `x − end_p(c) + end_lead(c)` from the last change ending at or before
`x`, key `("out", alignedLead, from)`); the order tuple; the key and its ordinal; the preview (26 characters before the
match, leading whitespace trimmed, `…` when cut); dismissals across a one-file re-run; the cap in `withFile`.

## Change

1. `search/` as above, split into small internal files (TS11 caps), pure, no DOM, no other `src/` import.
2. `scripts/fences.ts` + `fences.test.ts`: `search/` imports no other `src/` module (as `jsonrpc/`), with the failing
   path tested.
3. `search/AGENTS.md`: what the module owns (#127), its one surface, the rule that it imports nothing from `src/`.

## Acceptance

- Node: every test in design §3.6 "Pure tests (B2)" (each named for the bug it catches), passing; each fails on its
  bug (Stryker over `search/` kills the mutants on your lines, SP5 — run it on your files and paste the score).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass (`unused`: every export used by a test or
  listed in the contract; say which knip ignores, if any, you need — orchestrator-owned config).

## Skills

`skill://ts-conventions`, `skill://principles` (plus your autoloaded ones).
