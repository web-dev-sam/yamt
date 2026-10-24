I've added the `yamt-cli range` command, the smoke repository script `scripts/range-repo.sh`, and the two range fixtures. Every acceptance line was observed, but `just map-check` will fail until the project map names the new script (see deviations), and the two `justfile` changes still need applying.

```
summary
  - `yamt-cli range <repo-dir> <range>` prints `{ "start": RangeStart, "files": RangeFile[] }`, where `files[i]` is the
    load of entry id i, in list order. A malformed range is a usage error (the range's own usage line plus the cli
    usage, exit 2). Any `yamt-range` error prints its message on stderr and exits 2.
  - `scripts/range-repo.sh <dir>` builds the smoke repository with fixed names and dates and prints
    `yamt --diff=main...feature --repo <absolute dir>`.
  - `frontend/fixtures/range/review.json` (main...feature, 13 files) and `empty.json` (feature..feature) are generated.

files_changed
  crates/cli/Cargo.toml
  crates/cli/src/args.rs
  crates/cli/src/lib.rs
  crates/cli/src/range.rs                 (new)
  crates/cli/tests/range.rs               (new)
  scripts/range-repo.sh                   (new)
  frontend/fixtures/range/review.json     (new, generated)
  frontend/fixtures/range/empty.json      (new, generated)

tests_added
  crates/cli/tests/range.rs:
    - range_prints_the_start_and_every_file_at_its_id: in a 2-commit temp repo, the ids are 0,1,2 for
      a.txt, b.txt and c.bin, and files[0..2] are a text pair, a deleted file (right "") and binary. This proves the
      index is the id.
    - a_malformed_range_exits_2_with_its_usage_line: `range <dir> main` exits 2 with empty stdout. Stderr begins
      "yamt-cli: --diff=main: a range needs two dots (a..b) or three (a...b); yamt does not compare the working
      tree\nusage:" and contains the `yamt-cli range <repo-dir> <range>` line.
    - an_unknown_name_exits_2_with_the_range_error: `nope..HEAD` exits 2 with stderr
      `yamt-cli: git names no commit "nope"` and empty stdout.
    - range_without_both_arguments_is_a_usage_error: exits 2 with "range needs exactly <repo-dir> <range>".

smoke_evidence
  scripts/range-repo.sh target/range-repo; then target/debug/yamt-cli range target/range-repo main...feature →
    0 config (modified) → kindChanged file→link
    1 data/big.txt (added) → tooLarge limit 8388608
    2 docs/current.md (modified) → texts, mode same       [link retargeted, its target shown as text]
    3 docs/keys.md (renamed from docs/shortcuts.md) → texts
    4 docs/legacy.txt (modified) → notUtf8 sides both      [Latin-1]
    5 public/logo.png (modified) → binary
    6 src/api/mockBoards.ts (deleted) → texts
    7 src/board/board.ts (modified) → texts, 7 differences
    8 src/board/reminders.ts (added) → texts
    9 tools/build.sh (modified) → modeOnly file→executable
    10 tools/deploy.sh (modified) → texts, mode changed file→executable
    11 tools/setup.cmd (modified) → texts                  [CRLF]
    12 vendor/ui (modified) → submodule 1111…→2222…        [gitlink]
  yamt-cli range target/range-repo main..feature → left label named "main"; the list starts with "README.md modified"
    and has the same 13 paths after it.
  Two builds (target/range-repo, target/range-repo2), `git log --all --format='%H %s'`, identical in both:
    437805506eab02eaba409bdeffd00e0383476e35 README: swimlanes
    9c1ba3fc606a3776061d23006b83e2af2a357112 New logo, staging config and release tools
    7685b254e6e1b9199692006c4d3bcd647ca7f914 Reminders before a card is due
    531ea52dfb892e20206010fb6cd6161d9c88964a Build tools, the old notes and the vendored UI kit
    5f9d381d2306ae5110df08ef1fa0d0cbd04edb3b Taskboard: board model, API client and the logo
  Regenerated from the second repository: `yamt-cli range target/range-repo2 main...feature | cmp - frontend/fixtures/range/review.json`
    → "review IDENTICAL"; the same for feature..feature → "empty IDENTICAL".
  pnpm -C frontend exec vitest run --project node src/ipc/fixtureRange.test.ts → Test Files 1 passed, Tests 9 passed
  Throwaway vitest check (outside the tree, deleted): `createFixtureRangeSource` with `?range=review` and
    `?range=empty` over both JSON files. No `range.fixture_miss`. "review main...feature 13", all 13 files load
    with the kinds above, "empty feature..feature 0".
  cargo fmt --check → exit 0
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile …", no warnings
  cargo test -q -p yamt-cli → every binary ok (17, 2, 4, 4 passed; 0 failed)
  bash -n scripts/range-repo.sh → ok. shellcheck: not installed, not run.

deviations_from_brief
  - justfile (shared; orchestrator), lines 33–45 become:
      fixtures-check: (fixtures-into "target/fixtures-check")
          diff -ru frontend/fixtures/golden target/fixtures-check/golden
          diff -ru frontend/fixtures/showcase target/fixtures-check/showcase
          diff -ru frontend/fixtures/compare target/fixtures-check/compare
          diff -ru frontend/fixtures/range target/fixtures-check/range

      # Window fixtures: goldens, tests/showcase/ demo cases, tests/compare/ pairs (plan §2 #95), range cases over scripts/range-repo.sh (#103).
      [private]
      fixtures-into dir:
          rm -rf {{ dir }}/golden {{ dir }}/showcase {{ dir }}/compare {{ dir }}/range && mkdir -p {{ dir }}/golden {{ dir }}/showcase {{ dir }}/compare {{ dir }}/range
          cargo build --quiet -p yamt-cli
          for case in tests/golden/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/golden/$(basename "$case").json"; done
          for case in tests/showcase/*/; do target/debug/yamt-cli fixture "$case" > "{{ dir }}/showcase/$(basename "$case").json"; done
          for case in tests/compare/*/; do target/debug/yamt-cli compare "$case" > "{{ dir }}/compare/$(basename "$case").json"; done
          rm -rf target/range-repo && scripts/range-repo.sh target/range-repo > /dev/null
          target/debug/yamt-cli range target/range-repo main...feature > "{{ dir }}/range/review.json"
          target/debug/yamt-cli range target/range-repo feature..feature > "{{ dir }}/range/empty.json"
    I did not run these lines through `just`. The ownership hook blocks writes under target/ from my shell, so I
    ran the same commands by hand and compared the output with `cmp`.
  - Docs, not owned:
    - `just map-check` (PM6) will fail until the project map names `scripts/range-repo.sh`. Suggested line:
      "`<dir>`: the range window's smoke repository, main + feature with one changed file per RangeFile shape,
      fixed names and dates (plan §2 #103/#105)".
    - The map's cli line should add "range (`range <repo-dir> <range>`: `{start, files}`, the range window's
      fixtures)".
    - The frontend/fixtures line should add "range/<case>.json GENERATED by `just fixtures`".
    - crates/cli/AGENTS.md may need the same addition.
  - git-sandbox.sh's `write` takes a printf format as `$2`, not text on stdin as the brief says. I used it as it
    is. The longer reminders.ts text is a printf format too.
  - The script uses one fixed author and committer (yamt, 2026-10-01 … 10-07 +02:00) rather than demo-repo's people.
    The commit ids only need fixed values.
  - The gitlink records made-up commit ids (1111… on main, 2222… on feature). No submodule repository or
    .gitmodules is needed.
  - `Error::Range` exits 2 like `Usage`, as the Contract says. No other cli error changed.

open_risks
  - scripts/range-repo.sh: built and run on Linux only. It uses `ln -s`, `chmod +x` and a 0x00 / `tr`
    generated 8 MiB + 1 file. Run on Windows/Git Bash, the links and the exec bit may not be recorded, so the
    fixtures would differ. `just check` is local-only, so CI does not run it.
  - frontend/fixtures/range/review.json is 43 KB because board.ts's two texts are inlined; `big.txt` is not stored
    because it loads as tooLarge.
  - crates/cli/tests/range.rs `git()`: these tests run git themselves with GIT_CONFIG_GLOBAL=/dev/null and
    GIT_CONFIG_NOSYSTEM=1. They do not depend on `just test`'s hermetic wrapper.
```