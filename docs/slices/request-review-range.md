# Owner request — review a commit range (`yamt --diff=<range>`), threads posted to GitLab, an AI behind `--ai` (2026-10-24) — PLANNING

For the orchestrator. Status: intent captured; every question answered (#1625–#1627); no build started. Everything
under "Orchestrator defaults" is the boring choice the owner may veto. What is left open is design (designer).

## The owner's words

> "I want an --ai flag that enables all AI related features. The following is an AI feature.
> I also want the --diff flag to take an argument like --diff=1b2cfed8..2b3b4b5c which represents a git commit range and
> then the diff mode compares both states (for example --diff=dev..master to see changes in an MR), the left tab list
> then is a file list showing the changes like you would in gitlab for example. This is not the --ai part yet. The AI
> feature would then be a copy button that appears on hover of a line to copy a prompt including the position of the
> code like "relative/path/file.ts:12". The prompt is customízable in settings with a placeholder like
> "{{ RELATIVE_FILE_PATH_WITH_LINE }}". Both the button and settings related to that button is behind --ai. Actually...
> Now thinking about it, I would actually prefer a chat interface with the AI like a Gitlab discussion. I would dislike
> implementing all AI providers myself, so a simple command that can be set up in settings that could manage a omp (oh
> my pi) session, would be simpler. I dont mind forcing the user to use oh my pi for now. I'd like a normal Gitlab
> kindof chat with the AI and I would also like to promote a reply into an actual gitlab discussion via glab. This is
> all unspecific, lets plan"

Reopens (DR4, the owner's changed requirement): plan §2 #93's rejected "`git difftool`, file pairs" (a range compares two
git versions of files) and #94's "the shell never … runs git" (the range window reads git). `--diff` without a value
keeps #93–#101 unchanged.

## Three deliveries, in this order

- **A — the range window** (no AI): `yamt --diff=<range>`, changed files on the left, two read-only columns.
- **B — threads and posting to GitLab** (no AI): GitLab-style discussions of your own notes on any line; any message
  queued and sent with the others as pending GitLab line comments through glab. Needs A.
- **C — the AI behind `--ai`**: "Ask AI" in each thread, answered by omp in a temporary checkout of the reviewed
  commit. Needs B.

The first follow-up's answer moved threads and posting out of `--ai`, so they come before the AI.

## Questions (asked 2026-10-24; answers #1625–#1627)

| question                              | options                                                                                                                                          | answer                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What code does the AI read?           | **a temporary checkout of the reviewed commit, removed at close (default)** · the folder as it is now (may be another branch than the one shown) | **the temporary checkout**                                                                                                                                                                                                                |
| What may the AI do in the repository? | **read and search only; anything else declined (default)** · ask in the thread before each command or edit · anything                            | **"not checkout anywhere else, but edits allowed"**; the user's messages do not reach the AI by themselves: their own button, disabled while an AI turn runs, which can be interrupted, and the AI's thinking can be opened (C rules 2–3) |
| What does "Post to GitLab" do?        | **adds it to your pending review, submitted in GitLab as a batch (default)** · publishes it at once · both buttons                               | **a Post button per message, each its own GitLab discussion; one button sends all at once; they arrive as pending comments; the owner publishes in GitLab** (B rules 5–6)                                                                 |

Follow-ups:

| question                                                  | options                                                                                                                                                                                                                                   | answer                                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Threads and posting without `--ai`?                       | **yes: threads of your own notes and posting to GitLab always work in the range window; `--ai` adds "Ask AI" and the AI settings (default)** · no: threads and posting only with `--ai`                                                   | **yes**                                                                                                                                                       |
| What happens to the AI's edits in the temporary checkout? | **shown in the thread as a diff, gone when the window closes (default)** · the same plus "Copy as patch" on each edit · also postable to GitLab as a suggestion the MR's author applies with one click (edits on the thread's lines only) | **shown as a diff; "I dont want to lose the changes accidentally on close so it should ask to keep the changes and make it the preferred button"** (C rule 6) |

## A — rules (product terms, proposed)

1. **`yamt --diff=<a>..<b>` and `yamt --diff=<a>...<b>`**, with git's meaning: two dots compare the two tips, three dots
   compare where `b` branched off `a` with `b` (what a GitLab merge request's "Changes" shows: `--diff=master...dev` for
   an MR from `dev` into `master`). Either side is anything git names: branch, tag, `origin/x`, commit id, `HEAD~3`.
   Both sides are resolved to commit ids once at start; the column headers name each side and its short id.
2. **The repository** is the current directory's, or `--repo <path>` (allowed with a range; bare `--diff --repo` stays
   a usage error). Not a repository, an unknown name, or a malformed range: a message, exit 2, no window.
3. **Left panel = changed files**, as GitLab lists them: a mark per file (added, modified, deleted, renamed), `+n −m`
   line counts, the merge window's list/tree switch, its width handle and Ctrl/Cmd+B. The first file is shown at start.
4. **Two read-only columns** with the compare window's visuals (colours, word marks, removal bars, bands, locked
   scroll, find, previous/next change). Language from the file name, as in the merge window.
5. **Special files**: added → empty left column; deleted → empty right column; renamed → header "old → new"; binary,
   over 8 MiB, or only the file mode changed → one sentence instead of the columns.
6. **Nothing is stored** for A; several range windows may be open at once, one per repository and commit pair (B keeps
   threads per pair); the pasted-text window's one-window rule stays for `--diff` alone.

## B — threads and posting to GitLab (owner answers applied; the rest proposed)

1. **Starting a thread**: hovering a line number in either column shows a comment button, as GitLab does; a click opens
   a thread under that line, inside the code; the other column gets an equal gap so both stay aligned.
2. **Your messages are notes**: Ctrl/Cmd+Enter (or "Comment") adds your message to the thread. Without `--ai` that is
   all a thread holds; with it, nothing you write reaches the AI until you press "Ask AI" (C).
3. **Threads**: the line number carries a mark with the thread count; the file list shows a count per file. Threads
   collapse and open again.
4. **Threads survive a restart**: kept per repository and commit pair, with your messages, which of them are queued for
   GitLab, and (C) each thread's AI session id; they come back when the same range opens.
5. **"Post"** on every message, yours and the AI's (its final text only, never thinking or steps): opens an edit box
   with the text; confirming queues it as its own new GitLab discussion on the thread's file and line (`--line` for the
   new side, `--old-line` for a removed line). A queued message is marked; "Post" again takes it out of the queue.
6. **"Send to GitLab (n)"**, one toolbar button, sends the whole queue at once as pending comments of your GitLab
   review (glab's draft comments). Each sent message then shows "Pending on GitLab" with its link; you publish the
   review in GitLab. A message GitLab refused stays queued with the reason; the others are sent.
7. **Only when it lines up**: glab is installed and logged in; an open merge request has the right side's branch as its
   source; and that MR's current diff is exactly the two compared commits. Otherwise both buttons are disabled and their
   hover text says why ("the MR is at `def123`, this window shows `abc456`").

## C — the AI behind `--ai` (owner answers applied; the rest proposed)

1. **`--ai`** is accepted with every mode; today only the range window uses it. Without it: no "Ask AI", no AI section
   in Settings, no agent process and no temporary checkout ever started.
2. **"Ask AI"** (one per thread) sends the AI every message of yours written since its last answer; the thread's first
   turn goes out wrapped in the "First message" template. Disabled while this thread's AI turn runs (other threads can
   ask at the same time); "Stop" interrupts the turn, what came so far stays, marked as stopped.
3. **The AI's answer** shows its final text as Markdown with highlighted code; above it a collapsed "Thinking and steps"
   section holds its thinking and each step (a file read, a search, a command and its output, an edit as a diff), live
   while it runs, openable at any time and afterwards.
4. **Conversations**: each thread is its own AI conversation (none sees the others); one agent process per window. The
   AI's side lives in omp's own session (yamt keeps only its id) and comes back when the same range opens.
5. **Where the AI works**: a temporary checkout of the right side's commit, made at the window's first "Ask AI"; never
   your own folder. It may read, search, run commands and edit files there. One checkout per repository and commit
   pair, shared by its threads: an edit made in one thread is seen by the others.
6. **Closing the window**: a checkout without changes (nothing `git status` reports) is removed without a word. One
   with changes asks first, "Keep the AI's changes?", naming the changed files and the checkout's folder: **"Keep
   Changes"** is the preferred button (Enter) and leaves the checkout where it is, so the next window on the same range
   continues in it; "Discard Changes" removes it; Escape cancels the close.
7. **Settings (only with `--ai`)**: "Agent command" (default `omp acp`) and "First message" (a template). Placeholders:
   `{{ RELATIVE_FILE_PATH_WITH_LINE }}` (`src/board.ts:12`, the old path and line for a removed line),
   `{{ MESSAGE }}` (your messages since the AI's last answer), `{{ RANGE }}` (as typed), `{{ OLD_COMMIT }}`,
   `{{ NEW_COMMIT }}`.
8. **Failures**: agent command not found, crashed, or refused; checkout failed: the thread says so in one sentence
   with "Retry".

## Orchestrator defaults (boring choices; the owner may veto)

- The copy-prompt button is dropped: the owner preferred the chat; its template carries over as "First message".
- Single-line threads first; a range of lines (drag over line numbers, glab `--line 10:15`) later.
- Whole files, as the compare window shows them; collapsing unchanged lines (the merge window's wavy line) later.
- `--ai` is a flag only, never remembered in the settings file.
- One window per repository and commit pair: its threads and its checkout are stored per pair, so a second window on
  the same pair would be a second writer; it refuses with a message naming the open one (as `--diff` alone does).
- The right column keeps showing the commit; the AI's edits show only in its threads (as diffs) and in the checkout.

## Facts for the design (sourced)

- **omp 18.12.6** (`~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent`): `omp acp` "Run omp as an ACP (Agent
  Client Protocol) server over stdio" (`omp acp --help`). `src/modes/acp/acp-agent.ts:835-844` advertises
  `loadSession: true`, prompt images and embedded context; `:885` `loadSession` (replays history), `:897`
  `listSessions`, `:914` `resumeSession`, `:925` `unstable_forkSession`, `:946` `setSessionMode` (a plan mode,
  `:2241`). `acp-client-bridge.ts:32-38`: permission requests always go to the client; file reads/writes go to the
  client only when it advertises `fs` capabilities. Also present: `--mode rpc`, `-p`, `--resume`, `--tools=<list>`.
- **Thinking and steps reach the client**: `acp-event-mapper.ts:304` streams thinking as `agent_thought_chunk`;
  `:216`/`:239` each step as `tool_call_update` (running, then completed or failed, with its output); `:737` an edit as
  `{ type: "diff", path, oldText, newText }` (C rule 3).
- **omp asks nothing by default**: `src/tools/settings.ts:313-317` `tools.approvalMode` defaults to `yolo` ("auto-
  approves every tier"); `always-ask` prompts for write and exec tools, `write` only for exec; the CLI flag is
  `--approval-mode` (`omp --help`). Whether `omp acp` honours that flag is unverified [INFERENCE].
- **glab** (`docs.gitlab.com/cli/mr/note/create`, `…/draft/create`, GitLab docs 19.6): `glab mr note create [<id> |
  <branch>] --file <path> --line <n|a:b> | --old-line <n> -m <text>` and `glab mr note draft create` (same flags, a
  pending review). Both **target the latest merge-request diff version** and both are marked EXPERIMENTAL. glab is not
  installed on the owner's workstation (`command -v glab` empty, 2026-10-24).
- **Arguments**: `src-tauri/src/args.rs` is a hand parser; `--diff` is a boolean today (`:35`), `DIFF_WITH_REPO` (`:17`).
- **Git layer**: `yamt-gitio` already runs `cat-file --batch` (blob texts); no `diff --name-status` reader exists.
- **No Markdown renderer** in `frontend/package.json` runtime dependencies (vision 5: a renderer is a dependency
  decision or yamt's own).
- **Process piping exists for language servers** (`yamt-lsp-host`, plan §2 #70: Rust a pipe, the window speaks the
  protocol); its framing is LSP's `Content-Length`, the agent protocol is one JSON message per line.

## Non-goals

The working tree or staged changes (`--diff=main` alone); editing in the range window; whitespace options; GitLab's
"viewed" checkboxes; showing, replying to or resolving existing GitLab discussions in yamt; GitHub; AI in the merge
window or the pasted-text window; agents other than through the one command setting.

## Risks

- **Lines drift between yamt and GitLab**: glab posts against the MR's latest diff; a stale local branch or a two-dot
  range puts the comment on the wrong line. B rule 7 is the guard.
- **The AI can still reach outside its checkout**: a command or an absolute path writes wherever it likes, and omp's
  default approval asks yamt about nothing, so yamt never sees a command before it runs. The checkout as its working
  folder is the boundary; a hard one would need a sandbox (not planned).
- **A crash or kill skips the close question**: the checkout stays (and, if it is a git worktree, its entry in the
  repository's worktree list). Never deleted unasked: the next window on the same pair continues in it; only a
  leftover without changes is removed.
- **A restored conversation needs its folder**: omp's sessions record their working folder; the checkout must come back
  at the same path for the same repository and commit pair, or `session/load` may refuse (design checks).
- **glab's line-comment commands are experimental**; GitLab's discussions REST API through `glab api` is the stable
  fallback (design decides).
- **omp's sessions can be cleaned up by omp** (`omp gc`); a thread whose session is gone shows that in one sentence.
- **A thread box inside one column** breaks the line alignment both columns rely on unless the other column gets the
  same gap (B rule 1).

## Suggested order (refine at slice mapping)

1. Designer for A: the argument (`--diff[=<range>]`), resolving the range and listing changed files in `yamt-gitio`,
   where the range window lives beside the pasted-text window (shell mode, page root, store) with disjoint files, the
   file list reused from the merge window, plan §2 rows (#93/#94 amended, new ones).
2. Builds for A; final run.
3. Designer for B (threads inside the columns and their aligned gaps, the thread store per pair, glab and the lines-up
   check), builds, final run. Then the same for C (the agent pipe beside the language-server host, the window's agent
   client, the checkout's life, Markdown, the close question).
