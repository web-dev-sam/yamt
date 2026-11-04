# Slice mr-fast-preview-verify — the gate, the WebKit fixture and the real app for the instant preview and the remembered login

Design: `docs/slices/briefs/mr-fast-preview-design.md` option A. Request acceptance:
`docs/slices/request-mr-fast-preview.md` "Acceptance". Plan §2 #186–#188 (proposed); RK54, RK66, RK67, RK72, RK73;
RK74–RK75 (proposed). Recipes: `skill://verification`. Windows open only on a private display. Screenshots come only
from the session or the private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-fast-preview-corpus`, `-remembered` (with `just bindings` applied), `-local` and `-panel` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-panel` is committed, beside the docs keeper.
- **Final pass**: once the docs keeper has named `editor/internal/localPreview.ts` and `frontend/fixtures/markdown/` in
  the project map, the command `ask_gitlab_again` and the method `askGitLabAgain` in `docs/architecture.md` §4 and
  `ipc-contract` (`just map-check`, PM6). Run `just check` once, then B–C.

**Non-goals:** the owner's playground check (below, for the orchestrator to hand on); fixing anything; `just mutants`.

## Contract

**Fixture `?mr=list`**: !637's d01 thread (open its panel by Shift over d01's row in !637's discussions box). Texts
starting `fail` fail GitLab's preview ("glab timed out") — only texts that reach GitLab, so they need a trigger
(`fail now #1`). Log lines: `mergeRequests.fixture_preview { iid }`, `fixture_ask_again {}`, `fixture_write { … }`,
and the window's `preview_local { iid, blocks }`, `preview_read { iid, kind, ms }` — never a text.

**Scenario `tests/glab/mr-threads/`** (logged in; !90 with d01–d13): the fake glab logs every call's `argv:` line.

**Texts** (JSON strings; type them as they decode):

````json
{
  "PLAIN": "Looks **good**, see `code`.\n\n- one\n- two",
  "RICH": "## Plan\n\n| a | b |\n| - | - |\n| `x` | **y** |\n\n```ts\nconst x: number = 1;\n```\n\n> note",
  "HI": "**Hi** there",
  "HI_ANNA": "**Hi** there @anna",
  "THANKS": "**Thanks** a lot",
  "FAIL": "fail now #1"
}
````

**Words:** "Write", "Preview", "Loading…", "Nothing to preview.", "Could not preview: glab timed out", "Add comment".

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** `just app-session start-fixture --name mfv --diff --mr list --size 1600x1000`, then the
merge-requests page. Every step in yamt Dark and yamt Light (`--settings '{"theme":"light"}'`) unless noted.

1. **A1 local.** d01's panel, type PLAIN, press Preview, `read` the preview box at once: a paragraph with bold "good" and
   the code span, a two-item list; no "Loading…" at any read after the click; the session log gains one `preview_local`
   and no `fixture_preview`.
2. **A1 blocks.** RICH: a heading, a table (header row bold), `x` as code, `y` bold, the `ts` block in yamt's code
   colours — the `colours` of its `const` equal those of a TypeScript keyword in d01's code comment — and a quote; no
   `fixture_preview`.
3. **A2 switch.** HI_ANNA → "Loading…", then the text with "@anna" as a link; one `fixture_preview`. Then `see #12`
   alone → one more `fixture_preview`.
4. **A3 one look.** HI previewed (local), then HI_ANNA (GitLab path): the bold "Hi" has the same computed font weight,
   size and colour, and the paragraph the same left and top inside the box, in both; only the link differs (`read`
   rects and computed styles, pasted).
5. **A3 posted.** Preview THANKS (local), then "Add comment": one `fixture_write { kind: comment }`; the posted
   comment's paragraph and bold "Thanks" have the same computed font and colour as the preview's had.
6. **A4.** An empty field's Preview: "Nothing to preview." and no `fixture_preview`, no `preview_local`; Write after a
   preview: the text and caret as typed; FAIL → "Could not preview: glab timed out", the text untouched.
7. **B2 Refresh.** The page's Refresh: one `fixture_ask_again`, before the list's load lines; the panel stays open
   (RK73).
8. `shot` of the panel with RICH previewed, dark and light.

**C. Real app.** `scripts/local-conflicts-repo.sh <scratch>/mfv`, `cargo tauri build --debug --no-bundle`, `just
app-session start-app --name mfv --diff --dir <scratch>/mfv --glab mr-threads --mr`, the merge-requests page; count the
session's fake glab `argv:` lines after each step:

1. **B1 once.** After the list, !90's discussions box and d01's panel are shown: exactly one `argv: auth status` and one
   `argv: api projects/:fullpath` so far.
2. **A1 none.** PLAIN previewed: no new `argv:` line.
3. **One call.** HI_ANNA previewed: exactly one new line, `argv: api --method POST markdown --input -`; the preview shows
   GitLab's answer (`markdown.json`).
4. **Reuse.** Shift over d02, then back over d01 (two thread reads), and "Add comment" with `Thanks`: their calls, and no
   `auth status` or `projects/:fullpath` line.
5. **Refresh.** The page's Refresh: the next lines start with one `argv: auth status` and one `argv: api
   projects/:fullpath`, then the list's query; a preview after it adds only its `markdown` line.
6. The Rust log (`RUST_LOG=info`): the remembered project's ask and forget lines (outcome and reason only, no path or
   text); the window log: `preview_local` for step 2.
7. `shot` dark and light.

## Acceptance

Each step: pass or fail, with the observed words, the `read` results, the computed styles, the app-log and fake-glab
log lines pasted verbatim, and the screenshots' paths.

**Owner check** (hand on, not run). The owner's playground (`samubr/glab-yamt-playground` on gitlab.com), the real app
logged in as `samubr`, an open merge request with a discussion:

1. Shift over the discussion's row; in the reply field type a plain comment with a heading, **bold**, a list and a
   fenced `ts` block; press Preview: it shows at once, with no "Loading…".
2. "Add comment": on yamt's thread and on GitLab's page the comment looks as the preview did (headings, bold, list,
   code colours in yamt).
3. Type `see #1 and @samubr`, press Preview: a short "Loading…", then `#1` and `@samubr` as links (as GitLab links
   them).
4. Optional, settles open question 2: post `| l | c |\n| :- | :-: |\n| 1 | 2 |` and say whether yamt's posted comment
   centres the second column.
5. Optional, B2: `glab auth logout` in a terminal, preview `@samubr` in yamt → "Could not preview: glab is not logged
   in: …"; `glab auth login`, press Refresh, preview again → the links.
