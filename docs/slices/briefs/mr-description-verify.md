# Slice mr-description-verify — the gate, the WebKit fixture and the real app for the description panel

Design: `docs/slices/briefs/mr-description-design.md` option A. Request acceptance:
`docs/slices/request-mr-description.md` "Acceptance". Proposed plan §2 #171–#174; RK41 (rewritten), RK53 (amended),
RK66, RK67. Recipes: `skill://verification`. Windows open only on a private display. Screenshots come only from the
session or the private display.

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:**

- `mr-description-rust`, `-look`, `-app` (with `just bindings` applied), `-state` and `-page` committed.
- **Smoke pass** (steps B–C, no `just check`): as soon as `-page` is committed, beside its reviewers.
- **Final pass**: once the docs keeper has named every new file in the project map (`just map-check`, PM6), and
  `read_description`, `MergeRequestSource.readDescription` and `uploadedImage` in architecture and ipc-contract. Run
  `just check` once, then B–C.

**Non-goals:**

- The owner's playground check (below, for the orchestrator to hand on).
- Fixing anything.
- `just mutants`.

## Contract

**Fixture `?mr=list`**, as `mr-description-state` built it:

- !638 has no description (no button).
- `readDescription` answers after 400 ms:
  - !640 rich, every element of rule 3. Links: `#12` (page `…/-/issues/12`), `https://docs.example/x`,
    `mailto:anna@example.com` and `javascript:window.yamtPlanted=true` (both refused). Images: uploaded `…01` loads,
    uploaded `…02` broken ("broken screenshot"), a stand-in for another site, refused ("refused picture").
  - !639 long (120 paragraphs).
  - !637 empty.
  - !636 fails once ("glab timed out", the fixture's `TIMED_OUT`), then reads.
  - !635: markup-looking text.
  - Every other row: "Description of !<iid>.".
- Log lines: `mergeRequests.fixture_description { iid }`, `mergeRequests.fixture_page { page }`,
  `mergeRequests.description_shown { iid, kind, blocks, ms }`.

**Scenario `tests/glab/mr-description/`**, as `mr-description-rust` recorded it:

- User `sam`, project 7 `taskboard/taskboard` on `https://gitlab.com` (uploads are fetched with the login only there,
  #2280); `mr-description/self-managed/` (on `https://gitlab.example`) is exercised by the Rust tests only.
- !52 rich, with uploads:
  - A (`shot.png`, REST);
  - B (`old.png`, web path);
  - C (`gone.png`, neither);
  - `https://images.example/cat.png`;
  - `https://evil.example/-/project/7/uploads/<hex D>/x.png`;
  - `http://plain.example/p.png`.
- !51 empty. !50 planted. !49 glab fails. !48 no merge request. !47 white space and !46 null: no button.

**Words:**

- "Show description", "Close", "Loading…", "No description.", "Retry", "Done", "Not done", "Not applicable".
- "Could not read the description: …".
- "This link was not listed by GitLab, so yamt did not open it." and "Could not open the link" (problem bar).

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. WebKit fixture.** Run `just app-session start-fixture --name mdv --diff --mr list --size 1600x1000`, then open the
merge-requests page. Run every step in both windows (`--diff`, and `--range-case review --mr list`) and in yamt Dark
and yamt Light (`--settings '{"theme":"light"}'`) unless noted.

1. **Column (rule 1).**
   - The info column is between the approvals and the CI box on every row.
   - !638 has none, and the CI boxes of !639, !638 and !637 share one x (WebDriver rects).
   - The tooltip reads "Show description". A click logs no `fixture_page`.
2. **Every element (rule 3).** Open !640 and check each of these in the DOM and on a `shot`:
   - headings h1–h3;
   - emphasis, strong, strike, inline code, a line break;
   - the ruby block coloured (`span` with the panes' classes); the plain block and the mermaid block plain;
   - bullets; numbers starting at 3; task icons with "Done", "Not done", "Not applicable";
   - the table aligned start/centre/end; the quote; the rule;
   - the closed `details`, which opens on a click on its summary.
3. **Images (rule 5).**
   - The upload and the stand-in load (`naturalWidth` > 0), each at most the panel's width.
   - "broken screenshot" and "refused picture" show in their place.
   - A click on an image logs nothing.
4. **Links (rule 4).**
   - `#12` logs `fixture_page` with `…/-/issues/12`; the panel stays; `location.href` is unchanged.
   - The `mailto:` and `javascript:` links show their address as tooltip; a click logs nothing.
   - `window.yamtPlanted` stays undefined.
   - No element in the panel has an `href`.
5. **Closing (rule 2).** Each closes the panel:
   - Escape (focus then on !640's button);
   - the close button;
   - a press on the page header;
   - a second click on !640's button.
6. **Replace and keep (rule 2).**
   - With !640 open, !639's button gives one panel, !639's.
   - A wheel over the list behind leaves it open.
   - Refresh leaves it as loaded.
7. **Scroll (rule 2).** !639 scrolls inside the panel; the panel is at most 85% of the window's height and centred.
8. **Fresh (rule 7).** Close and reopen !640: two `fixture_description { iid: 640 }` lines, each with "Loading…" first.
9. **Empty and failed (rules 1, 7).**
   - !637 "No description.".
   - !636 shows "Could not read the description: glab timed out" and Retry; Retry shows the rich description.
10. **Planted as text (rule 6).** !635 shows its three lines literally. No `script`, `iframe` or `img` is in the panel,
    and `window.yamtPlanted` is undefined.
11. **Keyboard.**
    - Tab reaches !640's info button; Enter opens; focus is in the panel.
    - Tab: close button, then links and summaries in order.
    - Escape: closed, focus on the button.
12. `shot` of the open panel and of a row, in dark and light.

**C. Real app.** Run `scripts/local-conflicts-repo.sh <scratch>/mpv`, then `cargo tauri build --debug --no-bundle`,
then `just app-session start-app --name mdv --diff --dir <scratch>/mpv --glab mr-description`. Open the
merge-requests page.

1. **List (rule 1, 8).**
   - !52–!48 have the button; !47 and !46 do not.
   - The fake glab log's list `argv:` holds `description` and not `descriptionHtml`.
2. **!52 (rules 3, 5, 6).**
   - Every element of rule 3.
   - Images A and B load from `yamt-picture://localhost/upload~…`; C shows its caption.
   - `images.example`, `evil.example` and `plain.example` images show their captions (no network), or load (network),
     and never appear in the fake glab log.
   - The log has `argv: api projects/7/uploads/<hex A>/shot.png`, and `argv: api projects/7/uploads/<hex B>/old.png`
     followed by `argv: api https://gitlab.com/-/project/7/uploads/<hex B>/old.png`.
   - No `stdin:` line and no `-X`.
3. **Links (rule 4).**
   - `https://docs.example/x` and `#12` reach the fake xdg-open (`https://gitlab.com/taskboard/taskboard/-/issues/12`).
   - `mailto:`, `file:` and `javascript:` reach nothing.
4. **!50 planted (rule 6).**
   - `window.yamtPlanted` is undefined.
   - The document has no `iframe`, `form`, `object`, `embed`, `video`, `audio` or `base` element.
   - No new `style` or `link` element beyond the code colours' one `style.markdown-highlight-styles`.
   - `getComputedStyle(document.body).display` is not `none`.
   - The page did not navigate.
5. **!51** "No description."; **!49** the deadline sentence with Retry; **!48** GitLab's answer names no merge request.
6. The app log has one `description_shown` line per open, with iid, kind and counts, and never text or an address.
   `shot` in dark and light.

## Acceptance

Each step: pass or fail, with the observed words, the `read` results, the app-log and fake-glab log lines pasted
verbatim, and the screenshots' paths.

**Owner check** (hand on, not run). The owner's playground (`samubr/glab-yamt-playground`, private, a personal
project on gitlab.com), with the real app logged in as `samubr`:

1. On GitLab, give one merge request a description holding:
   - a table with a centred column;
   - a task list with one box ticked;
   - an uploaded screenshot (pasted into GitLab's editor);
   - an image from another site (`![cat](https://…)`);
   - a link to an issue (`#1`);
   - a `<details>` block;
   - a code block in a known language.
2. In yamt, open that merge request's info button. It looks like GitLab's page:
   - the table and its alignment;
   - the ticked and unticked boxes;
   - both images shown (the uploaded one on a private project: with the login);
   - the code coloured;
   - the details closed.
3. Click the issue link and the outside link: each opens in the browser.
4. Close with Escape, reopen, then change the description on GitLab and reopen: the change shows.
