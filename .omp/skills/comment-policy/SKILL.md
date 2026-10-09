---
name: comment-policy
description: When a comment is allowed in yamt code and how reviewers judge one. Rule R-open-1, deliberately open for refinement. Autoloaded into implementers and reviewers.
---

# Comment policy (R-open-1 — open for refinement)

Owner's position: a comment is evidence that the code was not readable; structure and names
come first. AI tends to over-comment and to narrate. The policy is therefore strict by
default and measured each milestone (`skill://guardrail-evolution` step 4).

## Allowed

- [CP1] An **external fact** the code cannot express, with a reference: git behaviour
  (`git checkout -m` regenerates markers only while the index is unmerged — git-checkout(1)),
  a WebKit quirk (link to the Tauri/WebKit issue), a CodeMirror API subtlety (`mapPos` side
  semantics, link to the docs). One or two lines, placed at the statement that depends on it.
- [CP2] A `///` one-liner on a public item, stating what it is: required on `merge-core` (`missing_docs`; a
  field or variant whose name says it all may restate it); elsewhere only if the reviewer test fails.
- [CP3] A `//!` crate-level line in `lib.rs` naming the crate's single responsibility.

## Never

- What the code does (`// increment the counter`), section headers (`// ---- helpers ----`),
  TODO/FIXME/XXX (open work goes to `open_risks` or the board), commented-out code, change
  history, author tags, restating a type or a name, `# Examples`/`# Errors`/`# Panics` doc
  sections (tests are the examples; `Error` enums document themselves).

## The reviewer test

Delete the comment mentally. Is anything lost that a rename, an extracted function, or a
stronger type could not restore? If no → `should` finding with the fix being the rename or
extraction, not "remove comment". If yes and it has no reference → `should` finding "add
the source".

## Measurement

The curator counts comments added per milestone, classifies each as information-carrying
or narrating, and proposes tightening (promote to a grep-based L1 check on `//` outside
tests) or loosening (named exceptions) with examples from the actual code. Until then this
is L0.
