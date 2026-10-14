# Handoff — session 15: language servers and saving (owner go #876)

Board: `docs/slices/SLICES.md` section "Language servers and saving" (rows 1–10). Decisions: `docs/plan.md` §2
#65–#67, #69–#71. Findings: `.omp/run/findings.jsonl` up to #965 (next free: check the last line). Notes per build:
`.omp/run/notes/<Name>.md`.

## Owner's instruction in force (#876)

"Implement the language server plan. Dont ask the user any questions, they will be gone. If you need a decision,
youre the product owner, orient yourself on the vision of a clean user experience." The whole board section is in
scope (Save included). Product decisions taken as owner are in plan #71 and #952 (Gate B for the editor: a third
round with the rule "formatting never touches a change that still waits, nor its edge lines").

## State at handoff

- **Feature complete.** Rows 1–10, 3b, 6b, 9a done. Row 9's round 1 is `2ed501d` (#966–#976; survivors #977–#981
  dropped). Final run `LspVerify` at `71896bd`: `just check` pass, every survivor judged (#983), real app 4.1–4.14
  and the fixture page pass (notes `LspVerify.md`). Map verified at `2ed501d`.

## Next steps

1. Owner report sent at the end of session 15 (what was built, the decisions taken as owner — plan #71, #952 — and
   the known limits below). Next: the owner's call; before the next milestone's first spawn, a retro with `curator`
   over `findings.jsonl` since the last retro (orchestrate §7).

## Known limits (accepted, logged; not blocks)

- `project_files` refuses paths whose real location is outside the repository, so a project whose
  `node_modules/typescript` links out of it (pnpm's global virtual store, a linked workspace) does not detect
  TypeScript (`.omp/run/notes/LspSetup.md` open risks). Candidate for a later row.
- oxfmt answers a format request with nothing until its own configuration request is answered (~1 s after start), so a
  Save in that first second reports "unchanged" (`LspClient.md`).
- Playwright WebKit does not launch on this host; the WebKit probes (`*.browser.test.ts`) were checked through
  MiniBrowser instead. Windows-only Rust tests (`PATHEXT`, `CREATE_NO_WINDOW`) need Windows CI.
- A pure line insertion just before a waiting change cannot happen through formatting any more (#952), but typing
  there still joins the change (CM1, unchanged).
- Plan #57 still says "14 actions" (historical row; Save and Toggle file list were added later by #61/#65).
