# Request — an instant comment preview when yamt can render it, and GitLab's login and project asked once

Asked by the owner on 2026-11-04 (#2419–#2420, answers #2421–#2422); details by the orchestrator as owner (OR13),
marked "(orchestrator)", the owner may veto. A design may refine a detail it names, never reopen a rule. Base: main
`4843fe18`. Window: the thread panel's Write / Preview (`ui/mergeRequestThread.ts` `preview`,
`ui/MergeRequestThread.vue`, `ui/MergeRequestReplyField.vue`), the preview command
(`crates/merge-requests/src/markdown_preview.rs`, `src-tauri/src/merge_requests/discussion_thread.rs`), the
description's reducer and renderers (`crates/merge-requests/src/description/**`, `ui/MergeRequestDescription*.vue`),
yamt's own Markdown subset (plan #112: `editor/internal/markdownBlocks.ts` `parseBlocks`, `markdownInline.ts`,
`markdownTable.ts`), and the login check and project lookup (`crates/merge-requests/src/project.rs`
`logged_in_project`, 15 callers in `yamt-merge-requests`; `gitio` `Glab::auth_status`).

## Owner's words

> why does the preview need to load for about a second?

> I think it would be cool to detect if the local renderer is enough (cuz its only text or only headings or only the
> subset that the local renderer supports and only check with gitlab if there are things that we dont support like
> gitlab?)

Measured before the request (#2419; from this machine against gitlab.com, three runs each): one preview runs three
glab calls in a row: `glab auth status` 0.61–0.66 s, `glab api projects/<path>` 0.69–0.84 s, `glab api markdown`
0.65–0.66 s; `glab --version` alone 0.04 s, so the wait is the network and GitLab, not starting glab.

## Part A — the preview is instant when yamt can render the text itself (#2420, #2421)

- **A1. Local when safe.** Preview shows yamt's own rendering, with no GitLab call and no "Loading…", when the text
  uses only what yamt's Markdown subset renders exactly as GitLab does: paragraphs, emphasis, strong, strikethrough,
  inline code, fenced code, lists, headings, quotes, tables, rules (the design measures which of these match).
- **A2. GitLab whenever unsure.** Anything GitLab may render differently goes to GitLab as today. At least
  (orchestrator, cautious): a reference or mention start (`#`, `!`, `&`, `~`, `%`, `$`, `@` followed by a word or a
  number), an emoji code (`:name:`), a web address (`http`, `https`, `www.`, an e-mail address), a hexadecimal word of
  7 to 40 characters (a commit), a link, image, footnote or task-list bracket (`[`), raw HTML (`<`), an attribute
  list (`{`), a backslash escape, math (`$`…`$`), and a fenced block whose language GitLab draws (mermaid, plantuml,
  math, and the like). A doubt in the design is a trigger, never a guess (owner #2421: a missed trigger shows text
  plainly that GitLab would link).
- **A3. One look.** The local preview looks exactly like GitLab's preview of the same text and like the posted
  comment: the same building blocks drawn by the description panel's components, the same code colours, the same
  spacing. Switching a text from local to GitLab (typing `#12`) changes only what GitLab adds.
- **A4. Nothing else changes.** An empty text still reads "Nothing to preview.", Write keeps the text and caret, a
  GitLab failure still reads "Could not preview: …". The AI chat's Markdown look and behaviour are unchanged.

## Part B — GitLab's login and the project are asked once (#2422)

- **B1. Asked once.** The login check and the project lookup that today precede every GitLab action of the
  merge-request page (list, description, links, discussions, CI log, people, re-request, open, resolve, thread read,
  writes, preview) run once per repository while yamt runs; later actions reuse the answer. A preview through GitLab
  is then one glab call; a reply one write plus the thread read.
- **B2. Forgotten when wrong.** A GitLab answer that says the login is gone or the project is not found forgets the
  remembered answer; that action fails with today's words ("not logged in" with glab's detail, or the project
  failure), and the next action asks again. Every explicit refresh button asks both again: the page's Refresh (and its
  Retry) and the discussions box's reload button (owner #2423).
- **B3. Nothing else changes.** No action that today fails with "not logged in" succeeds silently or fails with
  other words; the range window's review send keeps its own check. Accepted exception (owner #2423): after a glab
  logout while yamt runs, a public project's reads answer what anyone may see until a refresh button is pressed.

## To be measured by the design (unverified)

- A: GitLab's rendering (`POST /markdown` on gitlab.com, `gfm: true`, with a project) of each subset construct and
  of their edge cases: a single line break inside a paragraph, intraword `_`, heading anchors, a table's alignment,
  nested lists, a numbered list's start, an indented code block, `***`; which of these produce the same
  `Description` blocks as a local rendering. A corpus of text → GitLab answer pairs is recorded as a test fixture.
- A: where the local rendering happens: in the window (yamt's TS parser turned into `Description` blocks, a second
  builder of them) or in Rust (a Markdown crate's HTML through the same `described_on`, one reducer, a new
  dependency); the trigger check's home and its one owner; how the panel keeps one preview state for both paths.
- B: where the remembered project lives (the shell's state per repository, or the crate), its key (the repository
  root and its remote), which GitLab answers mean "forget" (HTTP 401, 403, 404 on the project route; glab's own
  "not logged in" line), how B2's "not logged in" detail is obtained once the check no longer runs first, and the
  15 callers moved without a second path.

## Acceptance

Core or Rust tests: every A2 trigger sends the text to GitLab; every A1 construct of the corpus renders locally to
the same blocks GitLab's recorded answer gives; a doubtful text goes to GitLab. Rust against the fake glab: a second
preview, a second thread read and a second write run no `auth status` and no project call (calls log); after a 401
the next action runs both again; Refresh runs both again; every failure reply keeps today's words. WebKit fixture
(`?mr=list`), dark and light: a plain comment previews with no `fixture_preview` and no "Loading…", looking the same
as the GitLab preview of it; typing `#12` or `@anna` previews through `fixture_preview`. Real app on the fake glab:
one preview through GitLab logs exactly one glab line, a plain one none. `just check` passes. Owner check on the
GitLab playground: a plain comment previews at once and looks the same after posting; a comment with `#1` and
`@samubr` previews with their links.

## Non-goals

A Markdown editor; changing how posted comments, the description or the AI chat render; previews anywhere but the
thread panel; caching GitLab's preview answers; the range window's login check; offline posting.

## Reopens (DR4: the owner's changed requirement)

- Plan #182 (every preview is GitLab's Markdown API) for texts A1 accepts; the threads design's rejection of yamt's
  own Markdown subset for the preview (`briefs/mr-threads-design.md` §1.3), now bounded by A2 and A3.
- Plan #112's "yamt's own Markdown subset" reaching only the AI chat (`ui/useMarkdown.ts` only) if the design renders
  locally in the window.
- Every `logged_in_project` caller's "asked before each action" (`project.rs`), and RK54/RK60 if a local preview
  crosses their rules.

## Owner's answers

- (#2421) "Local when safe, else GitLab", chosen over "local at once, GitLab replaces it" and "only cut the repeated
  lookups".
- (#2422) "Yes, remember them": the login check and the project lookup are remembered; a logged-out failure is the
  cost.

## Slice graph (proposal; refined after the design)

| row | slice                                                                                           | owner                 | needs |
| --- | ----------------------------------------------------------------------------------------------- | --------------------- | ----- |
| 1   | design: GitLab corpus, local path and its home, triggers, remembered project and its forgetting | designer              | —     |
| 2   | Rust: the remembered login and project (B1–B3), its callers, fake glab                          | rust-impl             | 1     |
| 3   | local preview: triggers, local blocks, the corpus tests (TS or Rust per the design)             | web-impl or rust-impl | 1     |
| 4   | panel: one preview state for both paths, no "Loading…" on the local one; wires the window       | web-impl              | 3     |
| 5   | docs keeper; verify: smoke after 4, final `just check`, WebKit, real app                        | docs-keeper, verifier | 2, 4  |
| 6   | owner check on the GitLab playground                                                            | human                 | 5     |
