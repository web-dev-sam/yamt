**Verdict: pass.** I found no `block`, one `should` and no `nit`. I ran no tests (RV6): no block depended on one.

The move keeps language-server behaviour the same. That covers ids, time-outs, the cancel sent on a time-out, `close()` rejecting pending requests, and late answers. The agent client gets what it needs:
- a request with no deadline;
- no cancel sent on a time-out when `cancelNotification` is `null`;
- error replies that keep `code`, `message` and `data`.

The added tests would catch a real bug. The one gap is below.

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/jsonrpc/connection.test.ts",
      "line": 139,
      "problem": "Every `requestUntilAnswered` test starts on a fresh connection with id 1 and never has a timed `request` pending at the same time. So no test would notice if the two entry points stopped sharing ids, or if one's time-out or answer settled the other. The agent client relies on exactly this mix: a `session/prompt` with no deadline stays pending while another thread's `session/new` or `session/load` runs with a deadline (AgentDesign §3, 'Several threads at once over one process'). Today only `#start`'s structure guarantees it; if that changes, an answer could settle the wrong promise and no test would see it.",
      "fix": "Add one test. Start `requestUntilAnswered(\"session/prompt\")` (id 1), then `request(\"session/new\", …, 1000)` (id 2). Check the sent ids are [1, 2]. Advance 1000 ms: the timed request is `timedOut` and the prompt has not settled. Then send the answer for id 1 and check the prompt settles with that result."
    }
  ],
  "checked": [
    "Language-server behaviour is unchanged. I compared the old `lsp/internal/connection.ts` at `028d5f3~1` with `jsonrpc/connection.ts:65-181`. The timer still starts before `pending.set` and `send`, as in the old order. The closed check still runs before the id counter goes up. On a time-out the order is still: delete the pending entry, send `$/cancelRequest {id}`, log '…within N s; cancelled', settle `timedOut`. `close()` still clears every timer, logs each pending method and settles it `closed`. A late answer still finds no pending entry and does nothing.",
    "The language-server wiring is pinned at integration level. `attempt.ts:59` passes `{ cancelNotification: \"$/cancelRequest\" }`, and it is the only place a `Connection` is built. `lsp/index.test.ts:632` (shutdown → `$/cancelRequest` → exit) and `:1521` (a formatting time-out cancels by id) would fail if it passed `null`.",
    "The language-server code reads only `message` from an error reply (`problems.ts:126`; `formatting.ts`, `server.ts` per the boundary review). Adding `code` and `data` to `Reply.error` breaks no consumer, and no lsp code builds a `Reply` itself (grep for `Reply` in `lsp/`).",
    "The `null`-cancel path is pinned (`connection.test.ts:113-123`). Nothing is logged at 1499 ms, the time-out fires at 1500 ms, nothing besides the request is ever sent, and the log line is exact. So a hard-coded `$/cancelRequest` or an off-by-one deadline would fail.",
    "`requestUntilAnswered` creates no timer. The test advances a day of fake time and checks `cleared` is `[]` after the answer, so a timer added and cleared on settle would fail it, and `#clearTimer`'s `!== null` guard is pinned both ways. The answered-request test (`:89-98`) catches a missing `clearTimeout` through a second send.",
    "`requestUntilAnswered` settles `closed` on `close()` with the 'server stopped' log line (`:139-148`). A later call returns `closed` at once and sends nothing.",
    "`data` survives the round trip. `messages.ts:36-47` keeps `error.data` (`undefined` when absent), and `#dispatch` (`connection.ts:136-139`) passes `code` and `data` on. omp's `-32603 / 'Internal error' / data.details` reply is checked with `toStrictEqual` in `connection.test.ts:75-86` and `messages.test.ts:12-43`. An error whose id is `null` settles nothing (`:150-162`).",
    "Error paths are unchanged from before the move: a malformed message is logged and dropped (`:211-226`), and a request after `close` sends nothing (`:164-183`). If a handler's `send` throws, the pending entry stays until its time-out or `close`, as it did before. For `requestUntilAnswered` that leaks no timer.",
    "The implementer's open risks are accepted. The `vite.config.ts:40` include line and the justfile mutants glob for `frontend/src/jsonrpc/*.ts` (`justfile:138`) have landed. The `#timedOut` order matches the old code.",
    "Mutation: the orchestrator's run predates `jsonrpc/` being in the recipe's scope. The implementer's Stryker on `connection.ts` reports 95 killed, 0 survived and 2 no coverage, on the `never` default in `#dispatch`; that default cannot run, so it is dropped under VF7 (a). The `messages.ts` and `timers.ts` mutants are module-level and not re-evaluated (#732). The `data` schema line is still covered by `messages.test.ts` and the connection error-reply test. The lsp survivors sit in files whose only change is the import path, so they predate this slice. `fences.ts` shows 42 survivors over the whole file; the survivors file gives no per-line list, so I accept the implementer's `fences.ts:115-117` report (16 killed, 0 survived)."
  ]
}
```