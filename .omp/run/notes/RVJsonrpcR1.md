**summary**
- All four review findings are fixed. `frontend/src/jsonrpc/index.ts` is now the only top-level file in `jsonrpc/`. `connection.ts`, `messages.ts` and `timers.ts`, with their tests, are in `jsonrpc/internal/`, so the existing PM5 rule now stops deep imports into them.
- `#start(method, params, timeoutMs: number | null)` starts the timer inline in the executor. `request` passes `timeoutMs`; `requestUntilAnswered` passes `null`.
- `METHOD_NOT_FOUND` (-32601) and `INVALID_PARAMS` (-32602) now sit beside `Answer` and are exported from the index. `lsp/internal/answers.ts` and its test import them from `../../jsonrpc`.
- There is a new test that runs an untimed and a timed request together on one connection, and a new fences test for the deep import.
- All five commands ran. Only the expected failures remain: typecheck and lint in `ui/problemText.ts`, and `unused` naming `RangeSideLabel`.

**files_changed**
- `frontend/src/jsonrpc/index.ts`: re-exports from `./internal/*` and adds the two constants.
- `frontend/src/jsonrpc/internal/connection.ts`: moved; new `#start` signature; the two constants added.
- `frontend/src/jsonrpc/internal/connection.test.ts`: moved; imports `../index`; one new test.
- `frontend/src/jsonrpc/internal/messages.ts`, `frontend/src/jsonrpc/internal/timers.ts`: moved, content unchanged.
- `frontend/src/jsonrpc/internal/messages.test.ts`: moved; imports `../index`.
- `frontend/src/jsonrpc/AGENTS.md`
- `frontend/src/lsp/internal/answers.ts`, `frontend/src/lsp/internal/answers.test.ts`
- `frontend/src/lsp/AGENTS.md`
- `frontend/scripts/fences.test.ts`

The old top-level `frontend/src/jsonrpc/{connection,connection.test,messages,messages.test,timers}.ts` are gone. I moved them with plain `mv` (no git commands), so the commit needs to record the moves.

**tests_added**
- `connection.test.ts` › "a timed request and an unanswered prompt share ids and settle apart". It starts `requestUntilAnswered("session/prompt")` (id 1), then `request("session/new", …, 1000)` (id 2), and checks:
  - the sent ids are [1, 2];
  - after 1000 ms the timed request is `timedOut` and the prompt has not settled;
  - the answer for id 1 then settles the prompt with `{stopReason: "end_turn"}`.

  This shows the two entry points share one id counter and that one request's time-out or answer never settles the other.
- `fences.test.ts` › "lsp importing jsonrpc's internal/ violates PM5": `src/lsp/internal/a.ts` importing `../../jsonrpc/internal/connection` gives one PM5 violation.
- I updated the existing jsonrpc fence tests to the new paths. The allowed-imports case now also covers `internal/connection.test.ts` importing `../index`.

**smoke_evidence**
- `pnpm -C frontend fmt:check` → `All matched files use the correct format. Finished in 964ms on 493 files`. The first run flagged `scripts/fences.test.ts`; I fixed it with `oxfmt` and re-ran.
- `pnpm -C frontend typecheck` → only `src/ui/problemText.ts(120,64): error TS2366: Function lacks ending return statement…` (the expected one).
- `pnpm -C frontend lint` → only `src/ui/problemText.ts:122:11: error typescript(switch-exhaustiveness-check): Switch is not exhaustive…` (the expected one). Because oxlint failed, the eslint step after it in the same script did not run; it checks only `.vue` files, and this slice changes none.
- `pnpm -C frontend test` → `Test Files  168 passed (168)`, `Tests  2147 passed (2147)`.
- Targeted run, `vitest run --project node src/jsonrpc scripts/fences.test.ts src/lsp/internal/answers.test.ts` → `Test Files  4 passed (4)`, `Tests  67 passed (67)`.
- `pnpm -C frontend unused` → `Unused exported types (2)`: `RangeSideLabel` in `src/ipc/index.ts:92:3` and `src/ipc/rangeDomain.ts:6:13` (the expected one); nothing else.

**deviations_from_brief**
- `frontend/src/lsp/AGENTS.md` (lines 1 and 9) and `frontend/src/jsonrpc/AGENTS.md` now point at `jsonrpc/internal/{connection,messages}.ts` and `internal/timers.ts`. The jsonrpc one also names the two error codes. This is outside the brief's "imports and constants only" for `lsp/**`, but without it these docs would point at files that no longer exist.
- I did not change `fences.ts`: the existing `internal` rule already catches the deep import, as the new test shows.
- The project map and `docs/architecture.md` are still stale (boundary finding 4). That is yours to fix: the `frontend/src/jsonrpc` row should list `index.ts` + `internal/{connection,messages,timers}`.

**open_risks**
- The Stryker mutation run (`just mutants`) was not part of this slice's commands, so I have not checked whether the mutants on the new `#start` line (`frontend/src/jsonrpc/internal/connection.ts:107-110`) are killed. The brief says the mutation recipe already covers `jsonrpc/internal/*.ts`.