# Request — `@` completion while writing a comment

Asked by the owner on 2026-11-05 ("Implement @ autocomplete when authoring comments/discussions (Plan first)").
Base: `180d6c6c`. Facts: `.omp/run/notes/PlanScoutMentionFacts.md`. Reopens the threads request's non-goal
"`@` completion" (`request-mr-threads.md` Non-goals; `briefs/mr-threads-panel.md`).

## What the owner gets

Typing `@` and the start of a name in a comment field shows a short list of people under the caret; picking one
writes `@username ` in place of what was typed, as GitLab's own comment field does. Nothing is sent but the search.

## Fields (owner 2026-11-05: "Reply box and range window's \"Text to post\"")

1. The thread panel's reply field (`MergeRequestReplyField.vue`, compare and range windows: its text is posted as a
   reply or a draft reply).
2. The range window's "Text to post" box (`RangeMessageEditor.vue` `box="post"`, queued and sent as a pending GitLab
   comment). Its "this merge request's people" (rule 2) are those of the merge request the range lines up with, when
   the window knows it (design decides how; none known → search results only).

Not the range window's local note boxes (`RangeThreadBox.vue`) nor its "Edit" box: their text stays local.

## Rules (orchestrator defaults, GitLab's behaviour unless said; the owner may veto)

1. **Start.** The list opens when `@` is typed at the start of the text or after a space, a line break or an opening
   bracket, and stays while the caret is in that word (`@` then username characters, no space). It closes on a space,
   a caret moved out of the word, focus leaving the field, Preview, or a send.
2. **Who, in which order.** First this merge request's people (author, assignees, reviewers, approvers, then everyone
   who wrote in the shown thread), already known to the window, shown at once — a bare `@` shows them; then GitLab's
   project search (the people box's search, 250 ms after the last key) for the typed text. Matching on name or
   username, those that start with the text before those that contain it; each person once; at most 10 lines. Each
   line as the people box: picture, name, muted `@username`.
3. **Keys.** Up/Down move the highlight (first line highlighted); Enter or Tab writes the highlighted person; a click
   writes the clicked one; Escape closes the list only (the field and the panel stay; the next Escape works as today,
   RK73). Ctrl+Enter still sends. An IME composition never opens or drives the list.
4. **Writing.** The typed `@text` becomes `@username ` (one space after), caret after it; one undo step takes it back
   when the browser allows (unverified in WebKitGTK).
5. **When GitLab cannot search** (glab missing, not logged in, GitLab before 16.3, a failure): the merge request's
   people still show; one muted line under them says why the search is missing, in the people box's words.
6. **Independent.** The people box's search and the mention list never change each other's results.
7. **Safety.** The search writes nothing (RK54); pictures show only after Rust offered them (RK53).

## Acceptance

Core tests: where a mention word starts and ends (start of text, after space/line break/bracket, not inside
`a@b.c`, the caret in the middle of the word); the order of rule 2 (merge request's people before search results,
starts-with before contains, each person once, at most 10). WebKit fixture (`?mr=list`), dark and light: `@an` in the
reply field lists Anna under the caret, Down + Enter writes `@anna `, Escape closes only the list, a second Escape
the panel; a bare `@` lists the merge request's people with no search call (fixture log); the people box's search is
unchanged with a list open in the panel; the range window's "Text to post" box lists and writes the same way (range
fixture). Real app on the fake glab: one search call per pause, none for a bare `@`.
`just check` passes. Owner check on the GitLab playground: a reply written with the list mentions the person on
GitLab (a link, a to-do for them).

## Non-goals

Groups and `@all` (owner 2026-11-05: "People only"); other references (`#`, `!`, `~`, `%`, `:emoji:`); the
description and new discussions (yamt writes neither); a Markdown editor (toolbar, colours); people outside the
project; the range window's note and Edit boxes (owner, "Fields").
