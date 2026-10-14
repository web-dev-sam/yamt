# LanguageServerDesign (3.Y, board "Language servers and saving" row 1)

Chosen: option A (plan §2 #70) — yamt's own client in `frontend/src/lsp/`, Rust a framed pipe (`yamt-lsp-host`),
`@codemirror/lint`, formatting applied as yamt's own line diff.

- Revision 1 (options A/B/C, host threads, documents, pull problems, answers table, formatting, problems, status
  area, log, platforms, fixture mode, ownership split, proposed rows, risks): `.omp/run/notes/LanguageServerDesign-rev1.md`
  (copied from `history://LanguageServerDesign`, transcript lines 188–427).
- Revision 2 (detection presets, per-repository answer and added servers in the settings file, the Save contract
  `MergeController.format(): Promise<FormatOutcome>`, the three status-area placements, files shared with Save,
  revised split): `.omp/run/notes/LanguageServerDesign-rev2.md`.

Key facts it established (sourced): `@codemirror/lsp-client` 6.3.0 serves one server per editor and answers every
server request with -32601; eslint's server and TypeScript 7's serve problems only on request; oxfmt's server
returns one edit spanning first to last difference (would collapse open blocks, CM8); Tauri `Channel` needs no
capability change.
