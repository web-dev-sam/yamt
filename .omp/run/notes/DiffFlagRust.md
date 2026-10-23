# DiffFlagRust (3.R-diff-flag-rust, release 0.5.0 row 1a)

Brief `docs/slices/briefs/3.R-diff-flag-rust.md`; plan §2 #101; owner #1586.

## Summary

`yamt --diff` opens the compare window; `--raw` falls to the unknown-argument path (exit 2). Help, usage error
("--diff compares pasted text and takes no --repo"), lock ("another yamt --diff window is open (…)"), IPC
`ReadFailed` message, doc comments, `src-tauri/AGENTS.md`, `crates/merge-core/AGENTS.md` say `--diff`;
`DIFF_WITH_REPO`, tests renamed (same rules). No bindings change.

## Evidence

fmt, clippy (`yamt-app`, `yamt-compare`, `-D warnings`), tests (yamt_app 92 + 5, yamt_compare 11/18/10/19) pass;
`grep -- '--raw' src-tauri crates` empty. `--help` shows `yamt --diff`; `--diff --repo x` → usage error, 2; `--raw` →
"unknown argument --raw", 2. Real app (debug, private Xvfb, scratch `XDG_DATA_HOME`): "Compare — yamt"; second
`--diff` → "another yamt --diff window is open (/tmp/…/yamt/compare)", exit 2.

## Deviations (accepted)

- No test pins `--raw` as unknown (the generic unknown-flag test covers it).
- `pnpm install --frozen-lockfile` in the worktree to build the app.
