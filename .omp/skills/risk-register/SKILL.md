---
name: risk-register
description: The known failure modes of yamt (git index semantics, add/add, line endings, binary blobs, scroll drift, connector geometry) with the module that owns each and the test that proves it handled. Autoloaded into correctness-reviewer.
---

# Risk register

Source: `docs/plan.md` §6 + architecture §3.3. A reviewer uses the last column as the
checklist: if the slice touches the owner, the proving test must exist or be named in
`open_risks`.

| id | risk | owner | proving test |
|---|---|---|---|
| RK1 | `git add` collapses stages 1/2/3; reset impossible unless SHAs captured at load | `session::MergeSession::open` captures `stages`; `reset` replays via `update-index --index-info` then `checkout -m` | `session/tests`: finish then reset ⇒ `ls-files -u` identical to before finish |
| RK2 | add/add has no stage 1 ⇒ `stages[0]` lookup panics | `session`: `base = Some("")` | `merge-core` proptest: `base == ""` ⇒ one chunk, `Conflict` unless `local == remote`; `gitio/tests`: add/add repo fixture |
| RK3 | delete/modify: one side missing | `session`: `Content::Unsupported(SideMissing)` in v0 | `session/tests`: entry reports `supported = false` with reason |
| RK4 | "locked scrolling" ≠ shared `scrollTop`; naive sync drifts | `editor/internal/scrollSync.ts` piecewise-linear through chunk anchors | `scrollSync.test.ts`: drift ≤ 1 line at every anchor on a 2k-line fixture |
| RK5 | CRLF files silently rewritten to LF | `session` detects `Eol`; `editor` sets `lineSeparator`; `resultText()` uses `sliceDoc()` | `session/tests`: CRLF round-trip bytes identical; `pane.test.ts`: CRLF result contains `\r\n` |
| RK6 | binary / non-UTF-8 blob reaches the webview | `session`: NUL-in-first-8KiB or `from_utf8` failure ⇒ `Unsupported` | `session/tests`: binary fixture ⇒ `supported = false` |
| RK7 | chunk grouping gap is a tuning parameter with no correct value | `merge_core::DEFAULT_GAP`, goldens | `cli golden run` + human PhpStorm comparison (Gate C) |
| RK8 | Arch + NVIDIA blank webview (DMABUF) | `src-tauri/src/main.rs` env guard before builder | M3 manual; `main.rs` unit test: guard respects a preset value |
| RK9 | three-pane connector geometry has no reference implementation | `connectors/` pure geometry | `connectors/*.test.ts`: snapshot of band paths for fixture; chunk above/below/spanning viewport |
| RK10 | chunk ranges drift after user edits in the center pane | `editor/internal/chunkField.ts` maps via `tr.changes.mapPos` | `chunkField.test.ts`: insert before chunk ⇒ range shifts; insert inside ⇒ range grows; delete all ⇒ dismissed |
| RK11 | undo reverts text but not chunk status | `chunkField` effect with `invertedEffects` | `chunkField.test.ts`: apply → undo ⇒ status `pending` |
| RK12 | bulk apply yields N undo steps | `apply.ts` builds one `state.changes([...])` | `apply.test.ts`: bulk then one undo ⇒ original text |
| RK13 | `merge-core` chunks disagree with git's own merge | `merge_core::apply_non_conflicting` | `cli/tests`: for conflict-free triples, output == `git merge-file -p` |
| RK14 | chunks overlap or are unsorted | `merge_core::compute_chunks` sweep | proptest: sorted, pairwise disjoint in all three spaces |
| RK15 | git subprocess hangs or inherits a shell | `gitio`: explicit argv, `LC_ALL=C`, timeout, stderr captured | `gitio/tests`: failing command ⇒ `Error::GitFailed { stderr }` |
| RK16 | a mixed-EOL file is normalised | `session`: `Eol::Mixed` passes bytes through, UI banner | `session/tests`: mixed fixture round-trips byte-identical |
| RK17 | reset of a file after the app wrote the worktree leaves the worktree without markers | `session::reset` runs `git checkout -m -- <path>` after stage restore | `session/tests`: worktree contains `<<<<<<<` after reset |

Adding a risk: append a row with all four columns; a row without a proving test is a
`should` finding for whoever owns the module next.
