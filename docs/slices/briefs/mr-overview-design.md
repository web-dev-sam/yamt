# Merge requests — design: the GitLab MR overview in the compare and range windows (board "Merge requests" row 1)

Agent: `designer` (read-only). Output: two or three file-level options plus a recommendation (your output schema). You
design; the orchestrator chooses; builds then run at most two at a time (proposal in the request: Rust list ∥ window
core, then Rust open/opener ∥ window). Your recommendation must split the files into **disjoint** ownership lists per
build (name every file each build creates or changes), order them by dependency, and write every contract between
builds in full (types, signatures, IPC commands, store fields, fake-glab scenario layout). Each build ≤ ~25 files and
≤ ~1,500 changed lines.

The request: `docs/slices/request-merge-requests.md` (owner's words, rules 1–9, acceptance, non-goals, reopened rows,
sourced facts, risks). Read it in full; a design may refine a detail it names, never reopen a rule. Scout facts with
`path:line` at `d97a270`: `.omp/run/notes/PlanScoutMrGitlab.md`, `.omp/run/notes/PlanScoutMrChrome.md` (given; re-check
only `[INFERENCE]` lines you rely on).

**The three product answers** (owner 2026-10-30, #1766–#1768, also messaged to you): an MR's changes open in a **new
window**; the list is a **full page like Settings** (a screen beside `settings`/`serverLog` in each window's store,
Back in Settings' place, Escape closes as on the server log page) — not a drop-down; filters are **remembered per
repository** across restarts. Say what the page form decides: the screen kind, focus return, where Back, Refresh and
the filters sit.

## Fixed constraints

1. **GitLab only through glab** (plan §2 #118): the runner in `crates/gitio/src/glab.rs`, its environment, deadline and
   value-not-error answers. A Rust GitLab client or HTTP from the page is out (CSP, #118's rejection). Say whether the
   MR code is a new crate or a module of an existing one, citing #117's reason for `yamt-review` (a component with a
   second job is growth harm) and `scripts/arch-check.sh`.
2. **Detection never waits on the network** (rule 1): decide what "a GitLab project" means offline (the remotes against
   glab's configured hosts, a host name rule, …), what happens when glab is missing or logged out (rule 8: the button
   shows, the panel says why), and where the compare window gets its repository (start folder, `OWD` under an
   AppImage, `appimage.rs`). `--diff --repo` stays refused (#101).
3. **One query shape, measured limits**: the GraphQL fields of the request's facts; page size and whether failed jobs
   come with the list or on hover, from GitLab's complexity rule (250 logged in) — compute the score of your query by
   GitLab's documented rule and state it; 500-MR cap; partial lists while pages arrive (rule 3, risk "many MRs").
   Fields a self-hosted GitLab may lack: name each field's first GitLab version you rely on, or say how a missing field
   degrades.
4. **Opening an MR's changes** (rule 7): which remote is fetched and how it is found; the refspec (MR head, the base
   commit); no branch created or moved, no checkout, index and working tree untouched; prompts fail fast; then a new
   process `yamt --diff=<base>..<head>` in that repository (the program path under an AppImage, a `.deb`, macOS and
   Windows builds; the child outlives the parent; how a refusal — the pair already open, an unknown commit — reaches
   the row). The opened range must pass #119 by construction (`lines_up.rs`).
5. **The opener** (rule 5, reopening #112/#115/#118 for job links only): a dependency (`tauri-plugin-opener`) or yamt's
   own per-OS program run (DR3: name what the stack cannot do without it); only `https` addresses on the project's own
   GitLab host built from a job's `webPath`; the command refuses anything else. Capabilities and CSP changes, if any.
6. **One panel per window** (risk "many views"): the button sits in every header beside `SettingsButton.vue`, but the
   panel, its list and filter state exist once per window; the compare and range roots never import each other
   (PM7/PM9, `frontend/scripts/fences.ts` `WINDOW_FILE`); name the shared seam (as `settingsStore.ts` is for Settings).
7. **Pure core** (vision 2, 3): filter values and counts, Me/None, any-within/all-across, Draft three-way, the cut
   summary, newest-first order, relative time (`Intl.RelativeTimeFormat`, no dependency), the CI box's job order, a
   checked value kept at 0 — one framework-free module (like `search/`), pure-tested.
8. **Hover box you can click into** (rule 5): none exists; one component, opens at once (#100's precedent), stays open
   while the pointer is in the icon or the box, keyboard reachable; checklists reuse `useDropdownMenu` where it fits.
9. **Remembered filters** (rule 6, question 3): keyed per repository; the range page has no root today (`RangeStart`);
   localStorage (`serverPins.ts` precedent) or the settings file — choose with reason.
10. **Test doubles**: fake-glab GraphQL answers (scenario files, `tests/glab/README.md`), browser fixtures for both
    windows (`?gitlab=`-style scripts or a new parameter), a stand-in opener and a stand-in process start for the real
    app; the real-app recipe (`frontend/scripts/app-session/`) for the compare window with the fake glab.

## What each option must answer

1. Data structures first: an MR row as it crosses IPC (`skill://ipc-contract`: brands, sum types for pipeline status
   and the list's outcome — loaded, cut, glab missing, logged out, failed), the filter state, the remembered form.
2. Rust: crate/module, functions, the glab calls with their exact arguments, commands per window (registered for
   compare and range, state each needs), errors as values; the fetch and launch steps; the opener command.
3. Window: components, the shared seam, store fields per root, sources (`CompareSource`/`RangeSource` gain what;
   `scripts/map-check.sh` needs each new method named in `docs/architecture.md`), fixture sources.
4. The ownership split per build with changed-line estimates, the dependency order, which builds run side by side.
5. Tests per layer with the bug each catches; the WebKit fixture steps and real-app steps per acceptance line
   (Playwright's WebKit cannot launch here; MiniBrowser through `just webdriver` is the engine of record).
6. Proposed `docs/plan.md` §2 rows (replacement rows for #94 and #112/#115/#118's link rule, the new decisions), as text
   for the orchestrator (DR5).

Read: `skill://ipc-contract`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://rust-conventions`,
`skill://risk-register`, `skill://decision-record`, `skill://project-map`, `docs/architecture.md` §0, §3.2, §3.5,
§3.8, §4, §5.1, §5.4, §5.5, `docs/plan.md` §2 #94, #100, #101, #103, #107, #112, #115, #117–#120.
