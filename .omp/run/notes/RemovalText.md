# RemovalText (board "Removal tooltip" row 1, brief `docs/slices/briefs/3.R-removal-text.md`)

## summary
`merge_core::Removal<L> { at, text }` replaces `removed_at`; `SideWordChanges.removals` sorted by place, one per place,
`text` never empty. In-line: removed tokens joined; whole lines before the bar: each line + `\n`; at the chunk side's end:
`\n` + each line; same-place removals join in base order; no `\r`. Bindings and fixtures regenerated; `toDomain` refuses
an empty `text`. `ipc/validate.ts` and `ipc/words.ts` new (orchestrator's answer to the 300-line cap on domain.ts).

## files_changed
Rust: `crates/merge-core/src/{word.rs,lib.rs}`, `tests/{marks/mod.rs,word_blocks.rs,word_catalogue.rs,word_changes.rs,
word_invariants.rs,word_stress.rs}`. Generated: `bindings.ts`, 10 golden fixtures, `showcase/word-marks.json`. ipc:
`domain.ts`, `fixture.ts`, `fixture.test.ts`, `tauri.test.ts`, new `validate.ts`, `words.ts`. editor: `words.ts` (loop only),
record shape in 13 `editor/internal/*.test.ts` + `problems.browser.test.ts`.

## tests_added
Notation `⟨text⟩` (`\n` as `↵`) pins every catalogue point's text (C4 `b, `, C15, C21 `;`, C27 `\t`, C28, M2
`if (ok) {↵\t` and `↵}`, M4, M5, M6, M7, M9, M10 `↵`, M12 no `\r`, M13, M14). New: `removed_crlf_lines_carry_no_carriage_return`,
`trailing_removed_tokens_join_removed_lines_at_the_chunk_end`, `removed_lines_around_a_kept_blank_line_join_into_one_removal`;
proptest `every_removal_text_is_base_text_of_its_chunk` (non-empty, whitespace-free substring of base, k breaks ↔ k whole
base lines); stress `WordDeleted` carries the word; fixture.test.ts: shape loads, string column / missing `at` / number
`text` / empty `text` refused naming the field.

## smoke_evidence
cargo test/clippy/fmt ok; `just golden` 10 ok; bindings-check, fixtures-check empty; arch-check ok; web typecheck/lint/
unused 0; web test 4 failed / 1335 passed: 3 known words.test.ts (`px-0.5`, #1056) + palette.test.ts window-background
(#1057, owner's dark `--color-window`); fmt:check only the 2 known files. Rendering: golden language-tools chunk 3
local 362:0 `"\tif (options.vueCompilerOptions.target >= 3.3) {\n"`, 373:65 `"\n\t\t}"`, remote 398:0
`"\t\tif (emitted) {\n"`; showcase M2 `"if (ok) {\n\t"`, `"\t"`, `"\n}"`; M10 `"\n"`. Fixtures 380K → 384K.

## deviations_from_brief
- `SideMarker` holds the chunk's base lines; `mark_pair(base_line, side_line)`; gap text from `&str` pieces.
- `mark_point` appends to the last removal at the same place (replaces `dedup`).
- Rule 4 [INFERENCE] false: a third meeting — a paired empty side line (width 0): gap before at (line,0) and chunk-end gap
  at (line,0) → `"a(1);\n\nb(1);"` (the kept blank line sits inside the joined text), pinned by a test.
- Catalogue tests live in `word_catalogue.rs` / `word_blocks.rs`.
- `words.test.ts` removals get the fixed text `"removed"` (shape-only change allowed).
- ipc split per orchestrator: `validate.ts` (`isNonNegativeInteger`, `invalid`), `words.ts` (word types, `toInlineRange`,
  `toInlinePoint`, `toSideWords`); domain.ts 228 lines, guards and `toWords` stay there.
- `Removal::at` doc still names `removed_at` (contract text copied word for word).

## open_risks
- `word.rs:125-129`: a chunk's last base line without a line break (end of file) still gets a `\n` in rules 2/3.
- `word.rs:164-173`: blank-line join shows the kept blank line inside the text.
- mutants not run by the implementer.
