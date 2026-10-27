All four fix rounds pass. Every listed item is fixed and nothing new reaches the block bar. I ran no tests (RV6). Each verdict rests on the code as it is now, the patches, and the implementers' pasted runs.

```json
[
  {
    "round": "3.RV-jsonrpc fix round 1 (a5a7f38)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`frontend/src/jsonrpc/` now holds only `index.ts` and `AGENTS.md` at the top, with `connection`, `messages` and `timers` (and their tests) under `internal/`. A grep finds no import of the old `jsonrpc/{connection,messages,timers}` paths anywhere in `src/` or `scripts/`. The new test `fences.test.ts:328-339` checks that `src/lsp/internal/a.ts` importing `../../jsonrpc/internal/connection` gives exactly one PM5 violation. `.oxlintrc.json:156` (`../**/internal`) also covers the deep import. The `jsonrpc/internal/*.ts` paths stay inside the `vite.config.ts:40` test glob and the `justfile:138` mutants glob."},
      {"item": 2, "status": "fixed", "evidence": "`connection.ts:99-112`: the signature is `#start(method, params, timeoutMs: number | null)`, and the timer is started inline in the executor (`timeoutMs === null ? null : this.#timers.setTimeout(…)`). `request` passes `timeoutMs` and `requestUntilAnswered` passes `null` (`:67-73`). The old order is kept: closed check, id increment, timer, `pending.set`, `send`."},
      {"item": 3, "status": "fixed", "evidence": "`METHOD_NOT_FOUND`/`INVALID_PARAMS` sit in `jsonrpc/internal/connection.ts:11-12` beside `Answer` and are exported from `index.ts:3-4`. `lsp/internal/answers.ts:1` and its test import them from `../../jsonrpc`, and lsp no longer has its own copy. The agent client (`agent/internal/answers.ts:2`) already uses the shared constants."},
      {"item": 4, "status": "fixed", "evidence": "`connection.test.ts:157-177` sends `requestUntilAnswered(\"session/prompt\")` as id 1 and the timed `session/new` as id 2. It checks the sent ids are [1, 2]. After 1000 ms the timed request is `timedOut` and `promptSettled` is still false; `advanceTimersByTimeAsync` flushes microtasks, so a prompt settled by the time-out would already show. The answer for id 1 then settles the prompt with that result. The test would fail if the two entry points kept separate id counters (ids [1, 1]) or if a time-out settled the wrong pending entry."}
    ],
    "survivors": [
      {"mutant": "jsonrpc/internal/connection.ts:11 METHOD_NOT_FOUND -32601 → +32601", "verdict": "drop", "why": "(b) gate-covered. `lsp/index.test.ts:1336-1339` asserts the literal `code: -32601` on an unknown server request; that answer is built through `answers.ts`'s import of this constant, so a hand mutation fails it. It survives only as a module-level mutant under the vitest runner (#732 class)."},
      {"mutant": "jsonrpc/internal/connection.ts:12 INVALID_PARAMS -32602 → +32602", "verdict": "keep, should (older value, not a block)", "why": "No test asserts the literal -32602 as output. `lsp/internal/answers.test.ts:48` and `agent/internal/answers.test.ts:144` compare against the symbol itself, and `agent/index.test.ts:400` uses -32602 only as input. This is a real constant gap under VF7, but the line is a move of a value that predates this round, and a wrong code is not visible to the user, so RV8 keeps it out of findings. Fix for a later round: assert `code: -32602` literally in `lsp/internal/answers.test.ts:48`."}
    ],
    "findings": [],
    "checked": [
      "Behaviour is unchanged by the refactor: `#timedOut` order (delete, cancel notify, log, settle) and `close()` match the pre-round code at `connection.ts:114-125` and `:90-97`.",
      "`index.ts` re-exports every earlier name, so the importers in `lsp/` and `agent/` are unaffected; the implementer's full `pnpm test` run shows 2147 passed.",
      "The implementer's two AGENTS.md edits (going beyond 'imports only' for `lsp/**`) only re-point paths to files that now exist. Accepted.",
      "The open risk on mutation of `#start` is answered by `RVJsonrpcR1.survivors.txt`: no mutant on lines 99-112 survived.",
      "Not this round's item: the project map and architecture rows for `jsonrpc/` (boundary should 4, orchestrator docs pass)."
    ]
  },
  {
    "round": "3.RV-pipe fix round 1 (ed82e72)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`crates/lsp-host/tests/run.rs` keeps exactly what the brief names: the Content-Length round trip (`:108`), the 8 KiB stderr cut (`:117`), `stop_all` (`:131`), `stop_every` (`:150`), the two project refusals, the missing folder/program case and the bare-name lookup. The stop grace, kill, exit-code, idle, burst, orphan, close-stderr and dropped-receiver tests are gone. `lsp-echo.rs` is now echo plus `--ignore-stop` only; no `--late-burst`, `--hold`, `--stderr-closed`, `spawn_copy` or `framed`."},
      {"item": 2, "status": "fixed", "evidence": "`frame.rs`: `Frame::Dropped(DropReason)` with `DropReason::{TooLong, NotUtf8}`. `run.rs:203-211` `dropped_line` builds `MAX_MESSAGE_BYTES / BYTES_PER_MIB`, and `lines.rs:18` pins the exact text \"yamt: dropped a message of more than 64 MiB\". The implementer broke `BYTES_PER_MIB` by hand and the test failed. `line-echo.rs:22` now reads `HUGE_LINE_BYTES = yamt_pipe::MAX_MESSAGE_BYTES + 1`. The 64 MiB value itself stays pinned by the literal 67108864/67108865 test in `frame.rs`."},
      {"item": 3, "status": "fixed", "evidence": "`Line::into_message(mut self)` pops a trailing `\\r` only when the line is not cut, and `String::from_utf8(bytes)` takes the Vec with no `to_vec()`. The `cut || len > MAX` check still comes before it. Traced by hand: exactly MAX plus `\\r` gives a Message; MAX+1 with no `\\r` is Dropped; a cut line is Dropped; a lone `\\r` becomes empty and is skipped. Same as before the round. Header lines go through `into_text` after the `cut` early return."},
      {"item": 4, "status": "fixed", "evidence": "`frame.rs:290-295` uses `\"y\".repeat(8 * 1024 + 5)` cut to `\"y\".repeat(8192)`. The implementer broke `MAX_LOG_LINE_BYTES` by hand and the test failed."}
    ],
    "survivors": [
      {"mutant": "crates/lsp-host/src/bin/lsp-echo.rs:12:54 replace == with != in main", "verdict": "drop", "why": "The mode is still used, by `stop_all_returns_with_no_child_left_also_one_that_ignores_stop` and `stop_every_signals_each_run_and_returns_before_they_exit` (run.rs:137,155: `[&[], &[\"--ignore-stop\"]]`). The mutant only swaps which of the two echoes ignores stop. (a) For `stop_all` that is equivalent: one run still ignores stop, so the kill-and-join path still runs and every assertion holds. For `stop_every`, `assert!(is_alive(runs[1]))` now reads a cooperative child that has exited but not yet been reaped: the supervisor polls `try_wait` every 20 ms, and a zombie still answers `kill -0`. So the mutant cannot be seen there. With the real flag that assertion still catches a `stop_every` that joins. It is a mutant of a test program, not a product guard. The kill-after-grace behaviour itself is pinned once, in `pipe/tests/lines.rs` `stop_kills_a_program_that_ignores_it_after_the_grace`. A cheap optional hardening: re-check `is_alive(runs[1])` after about 300 ms."}
    ],
    "findings": [],
    "checked": [
      "No Host-specific behaviour lost its test. `Host::send`/`stop` are `if let Some` lookups (lib.rs:117-128). `Host::stop` is no longer called by lsp-host's tests, but `src-tauri/src/servers.rs:239` (`stop_server` → `Exited` code 0) covers it under `just test` (b).",
      "Content-Length behaviour is unchanged: `lsp-echo`'s `answer` writes the same header plus body as the old `framed`. The removed `twice`/`split` cases are covered for Content-Length by `frame.rs:226` `frames_read_back_whole_also_one_byte_at_a_time`.",
      "Log texts are unchanged: the NotUtf8 line is still \"yamt: dropped a message that is not UTF-8\" (`lines.rs:19`); the TooLarge/Broken texts are untouched.",
      "The implementer's open risk (`pid_of` called only to check the prefix, `run.rs:39`) is accepted: it checks that the first log line is the echo's pid line.",
      "The two AGENTS.md edits are accepted as a deviation; they keep the docs true to the removed commands.",
      "Not this round's items: the `HostEvent` re-export through `yamt-agent` and the `ToServer` rename."
    ]
  },
  {
    "round": "3.RV-fixtures fix round 1 (c25b283)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`crates/cli/tests/range.rs` has no local `git()` and no `std::process::Command`. It builds its repository with `yamt_conflict_repo::diverged_repo` (main = the base commit, `local` = the local commit, conflict-repo lib.rs:158): a.txt changed, b.txt with `local: None`, c.bin added with `base: None`. The ranges are `main..local` and `nope..local`. The assertions are unchanged: ids 0..2 → a.txt, b.txt, c.bin; texts; deleted right `\"\"`; `{kind: binary}`; exit 2 with an empty stdout. The isolation now comes from `isolated_git` (RK19's named owner)."},
      {"item": 2, "status": "fixed", "evidence": "`git-sandbox.sh:52-62` holds the one `put <layer> <paths…>`, which reads the caller's `$files`/`$dir`. `range-repo.sh`'s copy is deleted, and its `files=` is set at `:19`. `demo-repo.sh:40-47` `put_recorded` calls `put \"$@\"`, then fills `was_put`, and every former `put` call uses it, so `require_all_put` is unchanged. Acceptance evidence in `RVFixturesR1.md`: the same five commit ids (4378055…, 9c1ba3f…, 7685b25…, 531ea52…, 5f9d381…, which agree with review.json's fork 531ea52 and empty.json's 9c1ba3f); `cmp` identical for review.json and empty.json; the demo still has the same 7 conflicted files; `cargo test -p yamt-cli` passes."}
    ],
    "survivors": [],
    "findings": [],
    "checked": [
      "No mutation input exists for this round. The changes are a Rust test file and bash scripts, which cargo-mutants and Stryker do not mutate.",
      "`golden-repo.sh:23` defines its own `put()` after sourcing `git-sandbox.sh` (`:5`), so it shadows the shared one and builds exactly as before. The file is outside this round's Owned list, so this is not a regression. It is a shadowed name, which a later docs or sandbox pass could rename.",
      "`demo-repo.sh`'s header (`:15`) and its `require_all_put` die message still say 'put line'. Still accurate: every line is a `put_recorded`.",
      "The boundary block on `justfile:48` (`hermetic_git`) is outside this brief; per the brief it was fixed by the orchestrator in `8b07afa`.",
      "The changed test comment ('Catches a range git cannot resolve exiting 1 like a read failure.') applies the correctness review's nit."
    ]
  },
  {
    "round": "3.RV-markdown fix round 3 (3ed112e)",
    "verdict": "pass",
    "items": [
      {"item": 1, "status": "fixed", "evidence": "`markdownInline.test.ts`: a new test, `60,000 code spans parse in linear time`, times only `parseInline(\"`a` \".repeat(60_000))` against `LINEAR_MS` and runs the 120k-node `toEqual` after the timer. Implementer's cursor-off run: `expected 2059.948464 to be less than 500` (FAIL). Cursor on: the test passes in 260 ms. The re-check's own earlier probe agrees independently: 60k spans 2,030 ms off vs 80 ms on. The cursor (`markdownInline.ts:58-64`, `#next`) is the only thing that keeps `closing` linear on this input."}
    ],
    "survivors": [],
    "findings": [],
    "checked": [
      "The cursor was turned off with the Map-stand-in probe, not by hand (`let index = 0`), because the ownership hook blocked the read-only file and Main approved it. Accepted: on this input (no parentheses, no emphasis) the stand-in only resets `#next`, which is the same as `let index = 0`; the patch shows only the test file changed.",
      "The memo half from round 2 still has its catch. Moving the code-span input out only lowers the shared test's baseline, so the memo-off failure (1,856 ms vs 500) is unaffected.",
      "Flakiness: the timed region is about 80 ms of a 500 ms window with the cursor on, and the off case is about 4× over the limit. The wall-clock limit is the existing pattern in this file.",
      "`editor/` is not mutated (VF7), so there is no survivor input; `pnpm -C frontend test` 2479 passed and `fmt:check` were pasted.",
      "Only one test file changed: no EditorState or line spaces (CM1–CM9 do not apply), and no RK owner is touched."
    ]
  }
]
```