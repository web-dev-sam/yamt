# Build W.2 — app-session: fix round 1

Board "Workflow" row 2. Round 1 is commit `e52a1f4` (report `.omp/run/notes/AppSession.md`).
Both reviews failed it on growth and safety blocks; the orchestrator triaged the rest (OR12): the
items below are the whole list, everything else was dropped. Ownership as round 1:
`frontend/scripts/app-session.ts`, `frontend/scripts/app-session/**` (new modules allowed inside).
Findings verbatim: `.omp/run/findings.jsonl` #753–#767.

## Blocks

1. **#753 start.ts has two jobs** (boundary): start-app's own steps and the session lifecycle that
   start-fixture shares (`tempFolder`, `launchTracked`, `withCleanup`, `Save`, `DRIVER_READY_MS`);
   fixture.ts imports from another command's module. → Move the lifecycle into one module, imported
   by start, fixture and focus; start.ts keeps only startApp's steps.
2. **#754 focus.ts writes the state file itself** (boundary): its own spawn-then-record step and its
   own logs-folder path next to start.ts's; the state file has two write paths. → focus-away/back go
   through the lifecycle module (launch-and-record; a matching untrack-and-save); one exported
   function derives the logs folder from the state, which also removes the `logDir` parameter
   threaded through the start/fixture steps.
3. **#755 (promoted) session.ts mixes three concepts** (boundary): repo-root paths, X display
   environment, state lookup; `readState(statePath(name))` is recomposed in start, stop and session.
   → session.ts becomes the lifecycle module of items 1–2 with one session lookup used by start, stop
   and the drive commands; `displayEnv` moves to processes.ts; `fromRoot` to a small `root.ts`.
4. **#760 colours.ts:82** (correctness): `framesWithMatch` with `> 0` → `<= 0` survives (symmetric
   test data). → Asymmetric data (e.g. `[[0],[0],[3]]` → 1, `[[1],[1],[0]]` → 2).
5. **#761 colours.ts:72** (correctness): `collapseRows` with `every` → `some` survives (each row change
   changes every column). → Rows differing in one column only (`[[0,5],[1,5]]` → two rows).
6. **#762 colours.ts:27/54** (correctness): frame size and the end-of-frame read are unpinned. →
   Assert `frameBytes(1600, 1000) === 4_800_000` (or a 2×2 frame in the split test) and that
   counting `000000` over a frame with no black pixel gives `[0]`.
7. **#763 (promoted) webdriver.ts:12 — no fetch timeout** (correctness): a wedged driver hangs
   `stop` before any kill (and `start` before cleanup). → `signal: AbortSignal.timeout(<one const>)`
   in the one fetch helper; `stop` reports "session not ended: …" and still kills the groups.
8. **#767 (promoted) state.ts — atomic write unpinned** (correctness): the rename test passes even if
   the target is written directly. → Write state A, make `<path>.partial` a directory so writing B
   throws, assert reading still gives A.

## Acceptance

- `pnpm -C frontend lint`, `typecheck`, `test`; `just web-unused` exit 0; paste the tails.
- Items 4–6 and 8: each new test fails with the mutation or the direct write put back (one line each).
- Real runs (now `just app-session …`): repeat round 1's start-app run with `--record` and `colours`,
  `click Settings`, `focus-away`/`focus-back`, `stop` (nothing left: `pgrep`, folders); and
  start-fixture → `click "Next change"` → `press Enter` → `stop`. Paste the outputs.
- List every module you created, renamed or removed, with its one job, for the project map.
