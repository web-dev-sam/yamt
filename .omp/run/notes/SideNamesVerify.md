# SideNamesVerify — 3.N final run, gate pass

Brief `docs/slices/briefs/3.N-verify.md`, at `1a7a8d6`. Transcript `history://SideNamesVerify`.

- `just check` exit 0: 377 Rust tests passed (1 skipped), 695 web tests in 62 files, bindings-check/fixtures-check
  empty diffs, arch-check ok, map-check ok, 10 goldens ok, hooks-test 16/16.
- `just mutants cb0151e`: Rust 30 tested, 15 caught, 15 unviable, 0 missed; Stryker 89.74 %, survivors on changed
  lines only those already judged in `.omp/run/mutants/SideNamesWeb.survivors.txt`; the rest on unchanged lines.
- Real app (Xvfb `:2`, own HOME, `just app-session`), text and `title` of each header:
  1. merge: `docs/removed.md`, `assets/logo.bin`, `vOn.ts` → "Local (yours): local" / "Remote (theirs): remote";
     `/tmp/yamt-verify-3n-shots/merge-text.png`.
  2. tag `local` beside branch `local` → "Local (yours): local" (no `heads/`).
  3. detached HEAD `a66ce0f` → "Local (yours): a66ce0f Detached subject", title "Detached subject\n\nDetached body
     line."; `/tmp/yamt-verify-3n-shots/detached.png`.
  4. rebase (HEAD `d8ac39b remote`, REBASE_HEAD `7eef99f local`) → "Local (yours): d8ac39b remote" / "Remote
     (theirs): 7eef99f local"; `/tmp/yamt-verify-3n-shots/rebase.png`.
- Environment: rustc 1.99.0, node 24.21.0, pnpm 12.0.0, git 2.56.0, cargo-mutants 27.1.0, webkit2gtk-4.1 2.54.1.
