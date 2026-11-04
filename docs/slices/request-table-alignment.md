# Request — table columns aligned as GitLab aligns them

Asked by the owner on 2026-11-04 (#2424, answering the fast-preview design's question 2: "Fix later, separately").
Base: whatever `main` is when this starts (after `request-mr-fast-preview.md` closes).

## What is wrong

A Markdown table column aligned with `:---:` or `---:` shows left-aligned in yamt's comments, the description panel
and the thread panel's preview, while GitLab's web page centres or right-aligns it. Measured: GitLab's `POST /markdown`
writes `align="center"` / `align="right"` on each cell (`.omp/run/notes/PlanFastPreviewCorpus.json` entry
`table_align`); the description reducer reads only `style="text-align: …"`
(`crates/merge-requests/src/description/element.rs:72-79`). Whether GitLab's `descriptionHtml` / `bodyHtml` use the
same attribute is unmeasured.

## Rules

1. A column aligned in Markdown shows aligned the same way wherever yamt draws GitLab's rendering (description,
   comments, the thread panel's preview).
2. The thread panel's local preview (fast-preview feature) shows the same alignment as GitLab's preview of the same
   text: both paths change together, never one alone.

## Acceptance

Rust test on the recorded `table_align` answer: center and end cells. The local preview's corpus test agrees with it.
WebKit fixture, dark and light: a description table with three aligned columns. `just check` passes.

## Non-goals

Any other table styling; tables in the AI chat.
