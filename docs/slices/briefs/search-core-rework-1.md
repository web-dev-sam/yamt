# Slice SearchCoreR1 — fix round 1: an opaque matcher, keys that never copy a line, the per-pane ordinal tested

Board "Search" row 2, fix round 1 (session 35). Round 1: `SearchCoreB`, commit `ec191ff`, brief
`docs/slices/briefs/search-core.md` (its Contract holds), notes `.omp/run/notes/SearchCore.md`. Both reviews failed.
The blocks, verbatim (promoted `should`s marked):

1. **#1697 (boundary, block)** `match.ts:3` — "`Matcher` has only the public field `readonly pattern: RegExp`, so
   outside code can pass any `{ pattern: new RegExp(text) }` where a `Matcher` is expected, and it can read
   `matcher.pattern` through the exported type." Fix: an ES private `readonly #pattern` (as
   `jsonrpc/internal/connection.ts`) and `paneHits` as a method `matcher.hits(text, limit)`; `matcherOf` the only way
   to get one.
2. **#1704 (correctness, block)** `places.ts:94` — "Each place key is built by copying the whole line text with
   `JSON.stringify` … four times per hit … one changed 64 KiB minified line with 1,024 hits of "a" per pane took one
   synchronous `filePlaces` call 12.7 s and kept 128 Mi key characters (263 MiB heap). The same text split into 1,024
   lines took 7 ms." Fix: a fixed-size digest of each line computed once in the hit scan (e.g. a 53-bit string hash
   beside the line), the group key and `PlaceKey` built from it, never from the text; #127's "key from … line text"
   holds through the digest. Add a test: a 1 MiB one-line text with many hits finishes within a small time budget
   (and the same for a 1 MiB text where every line matches).
3. **#1705 (correctness, block)** `places.test.ts:47` — the per-pane ordinal on hits outside changes (round 1's
   deviation 4) has no test. Fix: a merge case where a side's unchanged stretch is longer than the Result's, e.g.
   changes `[{l(0,1),c(0,1),r(0,1)},{l(4,1),c(2,1),r(4,1)}]` with "foo" on left lines 3 and 5 (both align to lead
   line 3); assert each place holds at most one hit per pane and both left hits are kept.
4. **#1698 (boundary, should → promoted)** `preview.ts:7` — `previewOf(lineText, from, to)` and `spotsOf(file, pane,
   lead)` take swappable same-typed parameters (TS7). Fix: `previewOf(hit)`; `spotsOf` takes the layout.
5. **#1699 (boundary, should → promoted)** `list.ts:106` — the pane-filter rule `place.hits.filter(on.has)` is written
   twice (`shownPlaces`, `goToPane`). Fix: one `shownHits(place, on)`.
6. **#1707 (correctness, should → promoted)** `list.test.ts:140` — `goToPane`'s "else the leftmost on pane" is checked
   only on a one-pane place. Fix: assert `goToPane(<a three-pane place>, new Set(["left", "right"]), MERGE)?.pane ===
   "left"`.

## Target

Owned: `frontend/src/search/**`. Read-only: everything else. The contract surface in `index.ts` is fixed (no export
renamed or reshaped; `Matcher` stays exported as a type only). Docs are the orchestrator's.

## Acceptance

- Each item's test fails on the bug it names (paste for items 2, 3, 6; a type error for item 1's `{ pattern }` object,
  pasted), then passes. Item 2's timed tests: the numbers before (on `ec191ff`) and after.
- Stryker over `search/` (as `just mutants` runs it): score and survivors pasted.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check` pass (`unused` may still flag the go-to slice's handle
  types until the window build; report anything new from `search/`).

## Skills

`skill://ts-conventions`, `skill://principles` (plus your autoloaded ones).
