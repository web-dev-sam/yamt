# Handoff — review a commit range (`yamt --diff=<range>`, threads → GitLab, AI behind `--ai`), session 29

Written 2026-10-24 on the owner's word (#1628: "dont spawn anymore agents, lets the current ones finish. then write a
handoff document"). **No agent is running.** `.omp/run/slices.json` is `{}`. Branch `feat/review-range` off main
`bc69714`, HEAD `d595fd0` (+ this note), 70+ commits, nothing pushed. Next findings id: **#1629**.

## Where the truth lives

- Owner's request, rules, answers, defaults: `docs/slices/request-review-range.md` (A rules 1–6, B 1–7, C 1–8).
- Decisions: `docs/plan.md` §2 **#103–#120** (A #103–#107, C #108–#115, B #116–#120); #93/#94/#101 amended (DR4).
- Board: `docs/slices/SLICES.md` section "Review a commit range" rows 1–13 (statuses current at `d595fd0`).
- Designs: `.omp/run/notes/{RangeDesign,AgentDesign,ThreadsDesign}.md`. Every build/review: `.omp/run/notes/<Name>.md`,
  patches `.omp/run/patches/<Name>.patch`, mutation results `.omp/run/mutants/<Name>.survivors.txt`, findings
  `.omp/run/findings.jsonl` (every promoted/dropped triage written).
- Briefs: `docs/slices/briefs/3.RV-*.md` (all builds, fix rounds and the ones not yet run).

## State per delivery

**A — range window: code complete.** Accepted: gitio range reads, `yamt-range`, shell, IPC, root window, columns (all
with fix rounds + re-checks). Open: **RVFixturesR1** (`briefs/3.RV-fixtures-rework-1.md`: cli test's own git isolation →
`yamt_conflict_repo`; one `put` in `scripts/git-sandbox.sh`) then its re-check.

**B — threads + GitLab: backend done, window half missing.**

- Accepted: `yamt-review` thread store (`e31e24e`), glab runner + fake (`41dc675`).
- Committed, open:
  - **RVGitlab** (`94f5062`): fix round **not started** — `briefs/3.RV-gitlab-rework-1.md` (3 blocks: mid-send
    unqueue/edit honoured; a draft owned once; one short id per commit via `Compared` + 7 promoted).
  - **RVReviewShell** (`bed557d`): boundary + correctness reviews not started (mutants clean).
  - **RVThreadRows** (`049bf0f` + fix `1162c4e`): re-check of the fix round not started.
- Not built: **review IPC** (`3.RV-review-ipc.md`) → **thread state** (`3.RV-thread-state.md`; also make
  `RangeController`'s `events` required, delete `NO_EVENTS`, update `useRangeController.ts:129` and
  `range.browser.test.ts:119`, own `editor/range.ts`) → **thread boxes** (`3.RV-thread-boxes.md`).

**C — AI: Rust side done, window side missing.**

- Committed: Markdown (`ae46983`, fix `189fb06`), pipe `yamt-pipe` (`7b820f8`), checkout reads (`006c484`), `jsonrpc/`
  (`028d5f3`), agent settings Rust (`2a7eadb`), `yamt-agent` (`040cc47`), AI shell `--ai` (`3d746d5`).
- Open: **RVMarkdownR2** (`3.RV-markdown-rework-2.md`, the **last allowed round**: regex `s` flags, tables vs dashes
  rows, linear-time tests; if its re-check still blocks → Gate B to the owner). Reviews **not started** for pipe
  (mutants: 11 missed, untriaged — many Windows-only/moved), checkout reads (clean), jsonrpc, settings Rust (clean),
  agent crate (10 missed, untriaged), AI shell (mutants not run).
- Not built: **agent settings web** (`3.RV-agent-settings-web.md`) → **agent client** (`3.RV-agent-client.md`, records
  real `omp acp` fixtures) → **turn view** (`3.RV-turn-view.md`, no harness page) → **C8 integration** (brief **not
  written**). C8 needs a small Rust part too: `ThreadStore` has a `session` field and `MessageBody::AiAnswer { turn }`
  but no command sets them — add e.g. `set_thread_session(thread, session)` and `add_ai_answer(thread, turn)` (or fold
  the turn index rule into one command), then wire Ask AI / Stop / Retry / `loadConversation` into `RangeThreadBox`,
  the close guard (`aiMayClose`) into `RangeApp`, `<AgentSettings>` into `SettingsView`'s slot only with `data-ai`,
  `main.ts` building `AgentClient` only under `data-ai` (fence), `firstMessage` values from `threadPlaceText`.

## The tree right now

- Rust: builds and tests per crate (each build ran `cargo test`/clippy). Not run as a whole: `just check`.
- Frontend: **does not type-check or lint** at `d595fd0` (39 TS errors in settings tests/fixtures + `problemText.ts`
  not exhaustive over `AiOff`, `EmptyMessage`, `MessagePending`, `RemoveFailed`, `SendRunning`, `UnknownMessage`,
  `UnknownThread`). Expected: the regenerated bindings carry kinds the next web builds handle (agent settings web fixes
  `StoredSettings.agent`/`setAgent`; review IPC handles the thread/GitLab kinds and `problemText`; the agent client the
  AI kinds). Run those three first.
- `just map-check` fails until the docs pass (below).

## Order to resume (re-hydrate per `skill://orchestrate` §0 first)

1. Web lane (one at a time where files overlap): agent settings web → review IPC (both touch `ipc/`, sequential) →
   thread state → thread boxes; then agent client → turn view → C8.
2. Rust lane: RVFixturesR1, RVGitlabR1, then the C8 Rust part.
3. Reviews/re-checks listed above (boundary + correctness for each new build; one consolidated re-check per fix round).
4. Docs pass (orchestrator, before the verifier): `docs/architecture.md` (§1, §2, §3 crates `yamt-range`,
   `yamt-review`, `yamt-pipe`, `yamt-agent`; §3.2 glab/checkout; §3.5 every new command; §4 IPC; §5 the third root,
   threads, `jsonrpc/`, `agent/`, Markdown; §7 crate list; §8), `skill://project-map` (every new file — the
   implementers' notes list the lines; PM1 edges; PM9; mutation scope), `skill://ipc-contract` (commands, `RangeSource`/
   `ReviewSource`/`AgentSource` methods), `skill://risk-register` (designers' RK28–RK36), `skill://cm6-rules` (CM15:
   block rows from a field, persistent hosts), AGENTS.md lines named in notes (`crates/gitio`, `crates/range`,
   `crates/review`, `src-tauri`, `frontend/src/{ui,ipc,editor}`), `tests/glab/README.md` (the twelve scenarios use
   `range-repo.sh`'s ids; `refusal/post-2.err` imitated, not measured), `scripts/git-sandbox.sh` header (range-repo.sh),
   README + CHANGELOG.
5. Verifier alone: `just check`, `just mutants bc69714`, WebKit (MiniBrowser) and real-app smoke (`just app-session
   start-app --range main...feature --repo <scripts/range-repo.sh dir> [--glab <scenario>] [--ai]`), one real `omp acp`
   turn, Keep/Discard at close.
6. Report to the owner (plain language): what works, then ask the one open product question — **deleting or editing
   your own comments before they are sent** (not in the rules; #120 default: neither) — and list the defaults he may
   veto (#103, #115, #120). His one real-GitLab check (ThreadsDesign §8 "What only a real GitLab can prove"): glab is
   not installed here.

## Gotchas learned this session

- **Write `.omp/run/slices.json` in one call, spawn in the next**: parallel write+spawn fails the fan-out hook.
  One isolated spawn per call. Max 3 live agents, max 2 implementers (I broke it once; stopped the extra at once).
- **Patch merges can drop `crates/*/Cargo.toml`** (orchestrator-editable): after a new crate, check `git status`; the
  pipe crate's manifest had to be copied from `~/.omp/wt/<id>/m/`. One patch (RVGitlab) was not auto-applied:
  `git apply <session>/RVGitlab.patch` worked.
- New crates: add root `members` + `[workspace.dependencies]`, switch `src-tauri/Cargo.toml` to `.workspace = true`,
  run `cargo metadata` to refresh `Cargo.lock`; regenerate `bindings.ts` with `just bindings` after any Rust IPC change.
- **Playwright WebKit cannot launch** here (`libicudata.so.74` vs ICU 78, #423/#1074): every browser check ran in
  MiniBrowser through `just app-session start-fixture` + `just webdriver` with throwaway scripts; the `*.browser.test.ts`
  files added this session have never run.
- **Tests must never exec a file they just wrote** (ETXTBSY under parallel threads): symlink to the committed script.
- `just mutants` now includes `frontend/src/{jsonrpc,agent}/` (`ed4796a` justfile change); module-level valibot constants
  survive under Stryker (#732 class); Windows-only `cfg(not(unix))` bodies show as missed on Linux.
- `rm -rf` outside `target/`, `node_modules/`, `dist/`, `/tmp` is blocked: move strays to `/tmp`.
- Measured `omp acp` 18.12.6 facts (permission asks, cancel, `session/load` needs the same cwd, two processes can load
  one session) are in `briefs/3.RV-agent-design.md`; glab 1.124.0's binary was at `/tmp/glab-probe/bin/glab` (tmp).
