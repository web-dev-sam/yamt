# Request — a failed CI job's log inside yamt, opened by a Shift press, with a remembered search

Asked by the owner on 2026-11-03 (planning conversation, #2154–#2155); details by the orchestrator as owner (OR13).
A design may refine a detail it names, never reopen a rule. Base: main `5f7630af`. Window: the merge-request page
(`frontend/src/ui/CiStatusBox.vue`, `useHoverBox.ts`, `useShiftHeld.ts`; failed jobs `crates/merge-requests/src/lib.rs:92-116`,
query `query.rs:59-61`). Facts: `.omp/run/notes/PlanScoutCiLogFacts.md`.

## Owner's words

- "Currently the MR list shows failed CI jobs and on click it opens browser. Can you make it so that I can see the logs
  of the failed CI job in my application […] to the left a hovered window appears thats scrollable, auto-scrolled to the
  end showing the logs of that job, the logs are colored in gitlab if I remember, that would also make it easier to see
  where exactly the error is, also on the top of that appeared window add a search bar to search the logs for and it
  auto scrolls and highlights the finding."
- "I think its better to make the user not hold down shift but simply press it when hovering a job so that the user can
  actually type/search without holding down shift."
- "it would be great if the application remembers the user input in search field per CI job name so that if I search
  for something in a phpunit fail, I dont have to remember and type it again"

## Rules

1. **A Shift press opens it.** With the pointer over a failed job in the CI box (or keyboard focus on it), one press of
   Shift opens that job's log box; Shift need not stay down. A click still opens the job on GitLab, unchanged (plan
   §2 #133). Shift with focus in a text field (the log's own search field included) opens nothing, so capitals can be
   typed. Shift over another failed job while a log box is open shows that job's log instead. A job without a GitLab
   page (`page: null`) has no log: Shift does nothing there. The job's hover text names the key ("Shift: show the log
   here"), so the feature can be found.
2. **Placement.** The log box sits to the left of the CI box, its top level with the CI box's top, kept inside the
   window (today's clamping rule); large enough to read a log (size in the design). The CI box stays open beside it.
3. **It stays while used.** On opening, focus moves into the search field. The log box (and the CI box) stay open while
   the pointer or focus is inside either; a scroll inside the log does not close them. Escape closes the log box first
   and puts focus back on its job; a second Escape closes the CI box (today's rule). A click or a scroll outside both
   closes both.
4. **The log as GitLab shows it.** Colours, bold, italic, underline as GitLab's job page renders them (GitLab's own
   renderer `lib/gitlab/ci/ansi2html.rb` is the reference: 16 colours and their light variants, 256 colours, bold
   foreground as the light variant, no truecolor). Other control sequences, GitLab's section markers and the per-line
   timestamp prefix (GitLab 18.9+) are not shown; section headers show as plain lines. Colours stay readable in every
   yamt theme, dark and light. The text can be selected and copied. The log text is never interpreted as markup.
5. **At the end.** The log opens scrolled to its last line, monospace, long lines wrapped.
6. **Search.** A field at the top of the log box. Typing highlights every match (plain text, case-insensitive) and
   scrolls to the current one, which is marked more strongly than the others; a count "3 of 17" beside the field; Enter
   goes to the next match, Shift+Enter to the previous, both wrapping. The first current match is the last one in the
   log (the log opens at its end, where failures usually are). No match: "No results", the scroll position stays.
7. **Remembered per job name** (owner #2155). The search text is kept per CI job name (the exact name GitLab shows, e.g.
   `phpunit`), for every merge request, across restarts. Opening a job's log fills the field with that name's text,
   selected (typing replaces it) and already searched (rule 6). Emptying the field forgets it.
8. **Long logs.** Only the last 500 KB are shown, cut at a line start (GitLab's own job page shows the same tail,
   `Stream::LIMIT_SIZE`); a cut log starts with one line saying earlier lines are on GitLab, with the job's page link
   (opens as a job click does). Search covers what is shown.
9. **Fetching.** The log comes through the app (the window cannot reach GitLab, CSP), only for a job the list offered
   (plan §2 #133, risks RK41/RK53). A failed job's log does not change: each one is fetched once per app run and kept.
   While it loads, the box says so; a failure (glab missing, logged out, no log, time-out) shows its reason in the box,
   never a problem box.

## To be measured by the design (unverified)

- The job id: the number in `webPath` `/-/jobs/<n>` (`WebPage::job`) versus GraphQL `id`; that `<n>` is the REST id for
  `glab api projects/:fullpath/jobs/<n>/trace`.
- Whether the raw `/trace` keeps the timestamp prefix on gitlab.com today, and its exact shape (stream.rb:10-13).
- Memory: `Glab::run` holds all of glab's stdout (`glab.rs:22-33`); a 50 MB log is read whole before rule 8's cut.
  Whether a byte range (`Range: bytes=-512000` through `glab api -H`) is honoured by `/trace`, else the cost of reading it whole.
- Where the colour parsing lives (Rust or the framework-free `mergeRequests/` core) and the shape crossing the IPC.
- Rendering cost of 500 KB (~10k lines) of styled runs in the webview, with highlights, in WebKit; whether the box
  needs to render only visible lines.
- How the log box joins `useHoverBox`'s inside rule (pointer, focus, Escape, scroll outside) without a second copy of
  it, and how the Shift press (a keydown, not `useShiftHeld`'s held state) is read without a second Shift listener rule.
- The search matcher: `search/` `matcherOf` (fenced, reachable through `search/index.ts`) or the core's own.
- Colour tokens for the 16 GitLab colours per theme; the 256-colour table.

## Acceptance

Rust: against the fake glab (`tests/glab/<case>/` with a coloured trace file incl. section markers, timestamps and a
log over 500 KB): an offered job returns its log cut at a line start with the cut flagged; a job not offered is
refused; a missing trace (404), glab missing and logged out each give their reply; a second request for the same job
runs no glab. WebKit fixture (`?mr=list`, a fixture log per job): hover a failed job, press and release Shift → the log
box opens to the left, at the end, coloured, focus in the field; typing capitals opens nothing new; search highlights,
count, Enter/Shift+Enter wrap; reopen the same job name on another merge request → its text is back, searched; after a
reload → still back; Escape twice closes log then CI box; click outside closes both; dark and light themes. Real app on
the fake glab: the same open, search, remember. `just check` passes. Owner check on the GitLab playground: a real
failed pipeline's log looks like GitLab's job page.

## Non-goals

Folding sections; logs of running, pending or passed jobs; live following of a running log; retrying a job; artifacts;
regex or match-case search; showing timestamps; searching across jobs; a log for a job the list did not offer; any
change to the merge, compare or range windows.

## Owner's answers

- (#2154, 2026-11-03) A press, not a hold, so the search can be typed (rule 1).
- (#2155, 2026-11-03) The search text is remembered per CI job name (rule 7).

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                      | owner       | owns (coarse)                                                                                                                             | needs |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | design: the measured facts above, the shape crossing the IPC, render and search approach, Shift press      | designer    | `docs/slices/briefs/ci-job-log-*.md`                                                                                                      | —     |
| 2   | rust: job id, offered-only `/trace` fetch, 500 KB tail cut, per-run memory, command, fake glab trace route | rust-impl   | `crates/merge-requests/**`, `src-tauri/src/merge_requests*`, `scripts/fake-glab/**`, `tests/glab/<case>/**`                               | 1     |
| 3   | core: colour codes → styled runs (GitLab's rules), search over runs, remembered-text rule                  | web-impl    | `frontend/src/mergeRequests/**`                                                                                                           | 1     |
| 4   | page: log box, Shift press, placement, search field, remembered text, ipc + fixtures; wires the window     | web-impl    | `frontend/src/ui/CiStatus*`, `frontend/src/ui/useHoverBox.ts`, `frontend/src/ipc/*MergeRequest*`, `frontend/src/ipc/fixtureMergeRequest*` | 2, 3  |
| 5   | docs keeper: architecture, project map, ipc contract, plan rows                                            | docs-keeper | —                                                                                                                                         | 4     |
| 6   | verify: smoke after 4; final `just check`, WebKit, real app                                                | verifier    | —                                                                                                                                         | 4     |

Risks: a new reply type crosses the IPC (bindings); log text in the window is untrusted (rule 4: never markup); a
very large trace read whole into memory (measured above); a second Shift rule beside `useShiftHeld` (one source of
truth, vision 2).
