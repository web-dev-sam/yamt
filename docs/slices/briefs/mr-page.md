# Slice MrPage — the button, the merge-request page, rows, filters, CI box; both windows; real-app tooling

Board "Merge requests" row 6 (R3 · B5). Rules: `docs/slices/request-merge-requests.md` (rules 1–9, Acceptance),
`docs/plan.md` §2 #128–#135. Design (option A, chosen): `.omp/run/notes/MrOverviewDesign.md` — "What the page form
changes" (top of the note), §2.3 "Components", "The CI box", "New fence PM10", §5 "R3 · B5", §6 "B4 → B5" and "B3 → B5",
§7 rows `fences.test` and `startArgs.test`, §8 acceptance steps. Those are given; build them as written. Built and
committed before you: the Rust commands (`MrOpenCommands`), the pure core (`MrWindowCore`), sources, slice, seam,
words and stores (`MrWindowState`); notes `.omp/run/notes/Mr*.md`.

## Target

Owned: `frontend/src/ui/{MergeRequestsButton,MergeRequestsView,MergeRequestRow,MergeRequestFilter,CiStatusBox}.vue`,
`frontend/src/ui/{CompareView,RangeView,RangeApp,CompareApp}.vue`, `frontend/src/ui/AGENTS.md`,
`frontend/scripts/{fences.ts,fences.test.ts}`, `frontend/scripts/app-session/**`, `scripts/map-check.sh`.

Read-only: everything else. `docs/architecture.md`, the project map and `CHANGELOG.md` are not yours (the feature's
documentation pass follows you); put the lines they need, including `MergeRequestSource`'s methods for map-check, in
`deviations_from_brief`.

Non-goals: the request's Non-goals; the merge window; a key for the page; any change to the slice's contract.

## Contract

Fixed: design §6 "B4 → B5" as committed (its `Listing` is named `ListLoad`, #1941; use it, do not change it), the
request's rule 1 placement (icon-only Lucide
`git-pull-request`, `aria-label`/title "Merge requests", directly left of the gear in every header showing the gear,
the range window's empty-range header included), rule 2 page layout and closing (Back, Escape by `ServerLogView.vue`'s
rule, focus back where it was), rule 4 row content, rule 5 CI box, rule 6 filters, PM10 as design §2.3 states it.
app-session: `start-fixture --mr <script>` beside `--diff` / `--range-case`; `start-app --diff --dir <repo>` runs
tauri-driver in that folder; `--glab <scenario>` allowed with `--diff`, puts `scripts/fake-open` on PATH and logs
opens to `<session>/glab/opened.log`; `stop` sweeps child yamt processes of the session (design §8 "Real app").

## Acceptance

- `fences.test` (PM10 refuses a root import and an `lsp/` import from `MergeRequest*`/`mergeRequest*`/`CiStatus*`
  files under `src/ui/`), `startArgs.test` (`--diff --dir`, `--glab` with `--diff`, `--mr`).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused`, `sfc-order` pass.
- Design §8 WebKit fixture steps 1–9, both windows, dark and light, through `just app-session start-fixture`
  (private display): paste the observed values and screenshot paths per step.
- Design §8 real-app steps on `scripts/range-repo.sh`: range window and compare window, opened.log line, the child
  process and its `alreadyOpen`, refs/status/FETCH_HEAD unchanged, filters remembered across a restart with the same
  home, `--glab logged-out` and `merge-requests-timeout` sentences, light theme.
- `just mutants HEAD` run in your workspace (SP11; `editor/` untouched).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
