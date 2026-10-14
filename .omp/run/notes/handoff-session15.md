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

- Rows 1–8, 3b, 6b, 9a: **done** (built, both reviews, fix rounds, re-checks pass). Last code commit before this note:
  `1d31e9d` (setup); docs after it.
- Row 9 (`3.Y-setup`, `1d31e9d`): **review**. Running when the context ran out (results will not reach the next
  session; re-spawn them):
  - boundary review `LspSetupBoundary` and correctness review `LspSetupCorrectness` of `git show 1d31e9d` (prompts
    as in this session: brief `docs/slices/briefs/3.Y-setup.md`, report `.omp/run/notes/LspSetup.md`);
  - `just mutants 0b4c487 > target/mutants-setup.log` (TypeScript only). If the log is incomplete, re-run it, then
    filter survivors to the lines changed in `1d31e9d` and send them to the correctness reviewer.
- Row 10 (final run): **planned**. Brief written: `docs/slices/briefs/3.YZ-verify.md` (verifier alone, OR10).
- `.omp/run/slices.json` still lists `LspSetup` (dead task): rewrite it with only live names before the next spawn.

## Next steps

1. Re-hydrate (`skill://orchestrate` §0). Re-spawn the two setup reviews and finish the mutants run (above).
2. Triage (OR12), fix round(s) for row 9 if blocks (it owns `ui/serverSetup.ts`, `LanguageServerSettings.vue`,
   `question.ts`, `QuestionDialog.vue`, `SettingsView.vue`, `App.vue`, `store.ts`, `settings.ts`, `main.ts`,
   `scripts/lsp-repo.sh`), re-check, commit.
3. Docs are already updated for the feature (architecture §3.3, §3.5, §3.6, §4, §5.1, §5.2, §5.3b; project map incl.
   setup files, `map-check: ok`; ipc-contract; cm6-rules CM5 + dependency list; risk-register RK5/RK17;
   rust-conventions RS5; CHANGELOG). Update the map's "Verified against commit" line and anything row 9's fix round
   adds.
4. Spawn the verifier with `briefs/3.YZ-verify.md` (base `16bc7f8`). Fix rounds for failures go to the owning row.
5. Report to the owner in plain words (OR-h): what was built, the decisions taken as owner (plan #71, #952), and the
   known limits below.

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
