## Review: RVJsonrpc (`028d5f3`), boundary lens

**Verdict: pass.** There are no blocks. I found 4 `should` findings and 1 `nit`. I ran no tests (RV6).

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "PM5",
      "file": "frontend/scripts/fences.ts",
      "line": 115,
      "problem": "`jsonrpc/AGENTS.md` says the public surface is `index.ts`. But `connection.ts`, `messages.ts` and `timers.ts` sit at the top of `jsonrpc/`, not under `internal/`, so neither PM5 detector fires on a deep import such as `../../jsonrpc/connection` from `lsp/` or the coming `agent/`. Today every `lsp/` import goes through the index, but nothing keeps it that way. As the module grows, a helper exported only for `connection.ts` becomes reachable from both users without anyone noticing, which breaks vision 3: the boundary is described but not enforced.",
      "fix": "Move `connection.ts`, `messages.ts`, `timers.ts` and their tests into `frontend/src/jsonrpc/internal/` and keep `index.ts` as the only file at the top. The existing PM5 rule (`fences.ts` `pathFinding`'s `internal` check plus oxlint's `../**/internal` pattern) then covers it with no new rule. Then add one test to `fences.test.ts`: `src/lsp/internal/a.ts` importing `../../jsonrpc/internal/connection` → PM5. Both paths are inside the Owned glob `frontend/src/jsonrpc/**`."
    },
    {
      "severity": "should",
      "rule_id": "principles §2",
      "file": "frontend/src/jsonrpc/connection.ts",
      "line": 98,
      "problem": "`#start` takes a callback `deadline: (id, settle) => number | null` and calls it inside the Promise executor. `request` passes a closure that starts the timer, and `requestUntilAnswered` passes `() => null`. A reader has to follow a callback through three methods just to learn whether a request has a deadline. Nothing else builds on it, so nothing gets harder beyond this one function's reading cost.",
      "fix": "Make it `#start(method, params, timeoutMs: number | null)`. Inside the executor write `const timer = timeoutMs === null ? null : this.#timers.setTimeout(() => this.#timedOut(id, method, timeoutMs, settle), timeoutMs);`. `request` then passes `timeoutMs` and `requestUntilAnswered` passes `null`."
    },
    {
      "severity": "should",
      "rule_id": "vision 2",
      "file": "frontend/src/lsp/internal/answers.ts",
      "line": 5,
      "problem": "`METHOD_NOT_FOUND = -32601` and `INVALID_PARAMS = -32602` are JSON-RPC 2.0 error codes, but they stayed in `lsp/internal/` while the `Answer` type that carries them moved to `jsonrpc/`. C5b's `agent/internal/answers.ts` must answer the agent's unknown requests the same way. It cannot import `lsp/internal` (PM5), so the next slice will copy the constant.",
      "fix": "Move both constants into `jsonrpc/connection.ts` next to `Answer`, export them from `jsonrpc/index.ts`, and import them in `lsp/internal/answers.ts` and `answers.test.ts` from `../../jsonrpc`."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 1,
      "problem": "Three docs are now stale. (1) The map's `frontend/src/lsp` row still lists `connection`, `messages/protocol` and `timers` under `internal/`, and has no `frontend/src/jsonrpc` row. (2) Its dependency line says `lsp imports only ipc`, and PM3 does not list `jsonrpc`. (3) `docs/architecture.md:956` (§5.3b) says lsp 'imports only `ipc/`', and line 975 says '`connection.ts` owns request ids and time-outs' as if it were an lsp file. `just map-check` still passes only because the basenames `connection`, `messages` and `timers` happen to appear in the lsp row. A reader following the map goes to `lsp/internal/connection.ts`, which no longer exists. This is orchestrator-owned: outside Owned, reported in the implementer notes, and due once per feature (orchestrate §6).",
      "fix": "Orchestrator: add the implementer's proposed `frontend/src/jsonrpc` tree row, drop `connection`/`messages`/`timers` from the lsp row, write `ipc ◄── lsp ──► jsonrpc` (jsonrpc imports no `src/` module) in the dependency direction, add `jsonrpc/**` to PM3, and correct architecture §5.3b lines 956 and 975 to point at `jsonrpc/`."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": ".omp/run/notes/RVGlabR1Check.md",
      "line": 1,
      "problem": "This slice's commit also adds another slice's review verdict (RVGlabR1). Nothing gets harder in the code, only `git log`/blame for that note.",
      "fix": "Commit run notes with the slice they belong to."
    }
  ],
  "checked": [
    "Ownership: the code changes stay inside Owned (`frontend/src/jsonrpc/**`, `frontend/src/lsp/**`, `frontend/scripts/fences{,.test}.ts`). The `frontend/vite.config.ts` and `.oxlintrc.json` lines are the orchestrator's (brief: 'report lines'). `.omp/run/notes/*` is outside source and is covered by the nit.",
    "No connection logic is left behind in lsp: `lsp/internal/` no longer has `connection.ts`, `connection.test.ts`, `messages.ts` or `timers.ts` (glob). A grep of `frontend/src` finds no import of `./connection`, `./messages` or `./timers` outside `jsonrpc/`. `Answer` exists only in `jsonrpc/connection.ts:11`, and `answers.ts` imports it from `../../jsonrpc`.",
    "lsp reaches jsonrpc only through its index today: all 10 importers (`lsp/index.ts`, `index.test.ts`, `internal/{answers,attempt,attempt.test,documents,formatting,handshake,problems,server,serverDocs}.ts`) import `../jsonrpc` or `../../jsonrpc`. No detector enforces this (finding 1).",
    "The contract matches the brief. `Reply.error` carries `{code, message, data}`. `ConnectionHandlers` is unchanged. The constructor is `(handlers, timers, options)`. `request`, `requestUntilAnswered`, `notify`, `receive` and `close` have the brief's signatures. `index.ts` exports every contract name. The additions `parseWith`/`Parsed` (used by 6 lsp files), `Answer`, `ConnectionHandlers` and `ConnectionOptions` are allowed ('you may add').",
    "lsp passes `{ cancelNotification: \"$/cancelRequest\" }` (`attempt.ts:59`), its only `Connection` construction. The LSP timeout log line is unchanged ('…; cancelled'). The tests `connection.test.ts:100-111` and `lsp/index.test.ts:1521`/`:632` still pin `$/cancelRequest`.",
    "lsp's error handling still reads only `message`: `formatting.ts:61`, `problems.ts:126`, `server.ts:206`. No `code` or `data` is read in lsp.",
    "Removing the `Timers` re-export from `lsp/index.ts` is a clean cutover: its only importer, `lsp/index.test.ts`, moved to `../jsonrpc`. `LanguageServers`' constructor signature is unchanged (architecture §5.3b:961).",
    "Fences: `jsonrpc` is in `FRAMEWORK_FREE_MODULES` (fences.ts:37), so PM3 covers vue, `@vue`, `@vueuse`, `@tauri-apps` and icons without `?raw`. The jsonrpc→any-`src/` rule (fences.ts:115-117) uses `isInside`, so `../jsonrpcx` is caught, and `../../fixtures` (outside `src/`) is allowed. `fences.test.ts:266-316` has a failing-path test for each rule and a passing test for lsp→jsonrpc.",
    "The oxlint framework-free override now lists `src/jsonrpc/**` with PM3 messages. jsonrpc's 'no other `src/` module' rule is fences-only, like PM7/PM8, which the map also lists as fences-only.",
    "No import cycle is introduced: jsonrpc imports only valibot and its own files (`connection.ts:1-9`, `messages.ts:1`, `timers.ts` has no imports).",
    "Comments: no code comments were added (CP). `jsonrpc/AGENTS.md` follows the one-paragraph owner-skill pattern of `lsp/AGENTS.md`. The `lsp/AGENTS.md` edits only re-point the reading path to `jsonrpc/connection.ts` and name the allowed import.",
    "Dead weight: `Incoming`, `parseIncoming` and the four `*Text` exports have no importer outside `jsonrpc/` and its tests. They are contract-fixed, and `messages.test.ts` gives them a real check (the new error `data` parse, the outgoing texts), not just an import to satisfy knip. Accepted.",
    "Implementer deviations accepted: the needed vite line landed (`vite.config.ts:40`); the justfile mutants glob includes `frontend/src/jsonrpc/*.ts` (justfile:138); the oxlint line landed; the project map and architecture are open (finding 4); the `null`-cancel log wording 'within N s' without '; cancelled' is pinned by a test (`connection.test.ts:113-123`).",
    "Implementer open risks accepted: the `#timedOut` order (delete, then notify, then log) matches the old inline timer body.",
    "Decision record: the change matches plan §2 #109 ('the window's framework-free `agent/` speaks ACP over a shared `jsonrpc/` (connection, messages, timers, moved out of `lsp/internal`)') and AgentDesign R-AI8/C5a. It contradicts no row.",
    "Growth check: `Connection` keeps one job (request/response bookkeeping over a text channel). The new state (`#options`, a nullable `Pending.timer`) is written only in the constructor and in `#start`. The one new import edge (lsp → jsonrpc) is the one #109 decides.",
    "Mutation input: `RVJsonrpc.survivors.txt` shows the recipe ran before `jsonrpc/` was in scope. The lsp survivors are on lines whose only change is the import path. Grading test strength is the correctness lens's job."
  ]
}
```