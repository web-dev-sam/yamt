# Line-range threads — design: range anchor, file format step, GitLab multi-line position, drag and tint

Agent: `designer`. Output: two or three file-level options plus a recommendation (your output schema), the design
document `docs/slices/briefs/line-ranges-design.md`, and one brief per build of the recommended option
(`docs/slices/briefs/line-ranges-<build>.md`: at least `rust`, `editor`, `window`, `verify`). Builds run at most two at a
time; ownership lists are **disjoint** (name every file each creates or changes; never a generated file such as
`frontend/src/ipc/bindings.ts`, which the orchestrator regenerates between builds), ordered by dependency, every contract
between builds written in full (Rust types with serde shape, the `addThread` command signature, the TS domain types,
the controller's events and calls, fixture data). Each build ≤ ~25 files and ≤ ~1,500 changed lines.

The request: `docs/slices/request-line-ranges.md` (owner's words, GitLab's behaviour with sources, rules 1–10,
acceptance, non-goals, the proposed slice graph and its risks). Read it in full; a design may refine a detail a rule
names, never reopen a rule. The owner's answer #2052: a range may cover both sides (rule 2). Facts with path:line at
`c8c5c54a`: `.omp/run/notes/PlanScoutRangeThreads.md` (given, re-check only what you change).

## What each option must answer

1. **The anchor (rules 2, 9).** The Rust shape of a thread's place (today `ThreadLine`, `crates/review/src/thread_types.rs`)
   that makes an unordered or broken range unrepresentable where it can (vision 4), its serde/TS shape, how a one-line
   thread is expressed (one shape, not two code paths, unless you show why), and how `StoredThread`, `add_thread` and
   the hand-written TS domain (`frontend/src/ipc/threadLine.ts`) carry it.
2. **The file format step (rule 9).** `FORMAT` 1 → 2 or not, with the reason (an older yamt drops unknown fields on
   rewrite, scout §3); how a format-1 file loads (every thread a one-line range), when the file is written as 2, and
   the test that pins the on-disk JSON of both.
3. **GitLab (rule 10).** The `position[line_range]` body, the end line in `old_line`/`new_line`, and the exact
   `line_code` rule for an added, a removed and an unchanged line (`<sha1 of path>_<old>_<new>`: which numbers GitLab
   puts for the side a line does not have, which path for a renamed file), **sourced from GitLab's own code** (file and
   line in gitlab-org/gitlab). `same_draft` matching the range (`position.rs:80-87`), and what a draft read back
   without a range means. The fake-glab case under `tests/glab/` and the Rust tests that post a one-line and a
   both-sides range body.
4. **GitLab's one-column order over two columns (rule 2).** Where the order lives (a pure function over the reply's
   differences, as `anchorAt` reads them, `frontend/src/editor/internal/threadAnchor.ts`), how a pointer position in
   either column, including the empty space facing a one-sided change, maps to a place in it, and how a run of it
   becomes the anchor's two ends; the drag stops at a collapsed run (rule 3).
5. **The drag (rules 1, 3).** Events (today a gutter `mousedown` starts the thread, `threadNumbers.ts:103-128`; the
   merge window's pointer-capture drag `drag.ts:52-116` is the precedent), no text selection while dragging (the
   columns are selectable, `pane.ts:209-210`), Escape cancels, wheel scroll keeps the range under the pointer, the
   count badge keeps its press, press-release on one line is today's thread.
6. **Box, badge, tint, collapse (rules 4, 5, 8).** Where the box and badge sit (`threadRows.ts` `placeOf`/`gapAfter`,
   the badge key in `threadNumbers.ts:23-33`); the tint as decorations in both columns (drag, open draft, pointer over
   a box) and how a pointer over a box (a Vue component in a widget) reaches the editor; `columnFolds.ts` keeping every
   unchanged line of a range shown (today `len: 1`), split across differences.
7. **The window (rules 6, 7).** Drafts' identity for ranges (`rangeDrafts.ts:120-123`), `threadPlaceText` texts in all
   three cases with exact wording, the default first-message template's sentence about removed lines
   (`firstMessage.ts:11-19`, placeholder name unchanged, plan §2 #113), the seeded fixture threads (one inside a column,
   one across both) and a `?range` fixture for the WebKit acceptance.
8. **Tests per layer** with the bug each catches; the WebKit steps and the real-app steps (`scripts/range-repo.sh`,
   dark and light) per acceptance line of the request; which existing single-line tests change and why.
9. **Risk register rows** to add and **`docs/plan.md` §2 rows** to propose (as text for the orchestrator, DR5).

## Proposed builds (refine, keep disjoint)

`rust` (rust-impl): `crates/review/**`, `src-tauri/src/review.rs`, `tests/glab/<new case>/**`. Then `editor`
(web-impl): `frontend/src/editor/**`; and `window` (web-impl): `frontend/src/ui/range*`, `frontend/src/ipc/{threadLine,
fixture*,ReviewSource,tauriReview}.ts` as needed, `frontend/src/agent/internal/firstMessage.ts` — these two side by
side once `rust` and the regenerated bindings are committed; `window` wires the window (its commit starts the smoke
pass). `verify` (verifier): `just check`, the WebKit acceptance, the real app.
