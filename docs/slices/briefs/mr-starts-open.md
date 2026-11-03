# Slice MrStartsOpen — a window started with `--mr` opens its merge-request page

Request `docs/slices/request-mr-starts.md` part B, the page side (rules B1, B3; acceptance B real app). Base: main
`6c34a149`. Rust's side is slice `MrStartsRust` (`briefs/mr-starts-rust.md`): it writes the start marker below. Shape
given by the request; no designer.

Known facts (tree at base):

- `frontend/src/main.ts`: in the app the page reads `document.documentElement.dataset` (`window` `:42`, `ai` `:71`);
  in fixture mode the URL search (`?diff`, `?range=…`, `?mr=<script>`, `?ai`). `startCompare`/`startRange`
  (`:59-84`) build the store and call `store.startUp()`.
- `ui/compareStore.ts:134` and `ui/rangeStore.ts:198`: `startUp: () => startUp(state, [settings.loadSettings(),
  mergeRequests.findProject()])`. `mergeRequests.findProject()` sets `project` (`{ kind: "found" | "none" }`) or
  reports the `find` problem; `mergeRequests.show()` opens the page (`screen.kind === "mergeRequests"`) and starts
  the first load (`ui/mergeRequests.ts:178-196`).
- `frontend/scripts/app-session/`: `start-app` passes the app `--diff` / `--diff=<range> --repo <dir>` / `--ai`
  (`startArgs.ts` `appArgs`); `start-fixture --mr <script>` adds `&mr=<script>` (`startArgs.ts:120-131`). The app's
  environment inherits the caller's (`start.ts:108-118`, `session.ts:13`), so `YAMT_AI=1 just app-session start-app …`
  reaches the app without a new option.

## Target

Owned: `frontend/src/main.ts`, `frontend/src/ui/compareStore.ts`, `frontend/src/ui/compareStore.test.ts`,
`frontend/src/ui/rangeStore.ts`, `frontend/src/ui/rangeStore.test.ts`, `frontend/src/ui/startScreen.ts` (new, if
needed) and its test, `frontend/scripts/app-session/**`.

Read-only: everything else; `frontend/src/ui/mergeRequests.ts` and `ui/AGENTS.md` (owned by `MrStartsAge`: a rule
for `ui/AGENTS.md` goes to `deviations_from_brief`); `src-tauri/**`; `docs/**`.

Non-goals: the merge window; opening the page later than the start (no remembered "open at start"); any change to
what the page does once shown.

## Contract (fixed)

- App: `document.documentElement.dataset["open"] === "mergeRequests"` asks for the page at start (written by Rust
  only for the compare and range windows). Fixture mode: `?open=mergeRequests` in the URL.
- The start screen is a TS sum (`"files" | "mergeRequests"`), read once in `main.ts` and handed to the store; the
  stores never read `document` or the URL.

## Change

1. `main.ts`: one function reading the start screen (app: dataset, fixture: URL), passed to `createCompareStore` and
   `createRangeStore`.
2. Stores: at start-up, once `findProject()` answered `found`, call `mergeRequests.show()` when the start screen is
   `mergeRequests`; `none` or a failed lookup leave the window on its files (rule B3). The rule lives once (a small
   shared function both stores call, e.g. `ui/startScreen.ts`), not copied into both `startUp`s. The page may open
   before the tabs/files answered; it must not be closed again by their answer (check `adoptList`/range start).
3. Tests (vitest, node): both stores open the page at start with `mergeRequests` + a found project; stay on files
   with `files`; stay on files with `mergeRequests` + `none`; and with `mergeRequests` + a failed lookup (problem
   shown as today).
4. `app-session`: `start-app --mr` (only with `--diff` or `--range`) passes the app `--mr`; `start-fixture --open-mr`
   (only with `--mr <script>`) adds `&open=mergeRequests`; `args.test.ts`/`startArgs.test.ts` and the usage text
   follow.

## Acceptance

- `pnpm -C frontend lint`, `typecheck`, `test` clean; `just mutants HEAD` (SP11).
- WebKit fixture: `just app-session start-fixture --name open --diff --mr list --open-mr` shows the merge-request
  page with its rows without a click (screenshot); without `--open-mr` the compare tabs as today; `--range-case
  <any> --mr list --open-mr` the same in the range window; `--diff --open-mr` with `--mr` unset is refused by the tool.
- Real app: needs `MrStartsRust`'s `--mr`. If it has landed in your base, `scripts/mr-conflict-repo.sh /tmp/<dir>`,
  `just app-session start-app --name mr --diff --dir /tmp/<dir> --glab mr-conflicts --mr` → page open at once;
  otherwise report it under `acceptance_not_run` (the verifier runs it).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
