# Slice SearchTidy — the gate's section order, the preview's lost space, the choice view taking a hide go-to

Board "Search" row 6b (session 35). The search feature's slices are built (rows 2–6, notes `.omp/run/notes/Search*.md`);
three small defects remain, found in the connect fix round's WebKit run (`SearchConnectR1`, report at
`agent://SearchConnectR1`), each in a file no running slice owns. Rules: `docs/slices/request-search.md` (rules 1, 7),
`docs/plan.md` §2 **#127**.

1. **#1730 (block, the gate)** `pnpm -C frontend sfc-order` fails: `src/ui/SearchResults.vue:30: state after computed
   (order: import → type → macro → state → computed → watch → lifecycle → function)`. Reorder the `<script setup>`
   sections; no behaviour change.
2. **#1731 (block)** In WebKit a result row shows the match with no space after it ("constvue = …" for a line
   "const vue = …"): the preview's text after the match loses its leading whitespace between the `<mark>` and the rest.
   Keep every character of the preview (`before`, `match`, `after`) as written (e.g. `whitespace-pre` on the preview
   spans, or one text run without template whitespace between them); the row still truncates with an ellipsis at the
   right. Prove it in WebKit by reading each row's `textContent` against the line's text around the match, for a match
   followed by a space, preceded by a space, and with tabs.
3. **#1732 (should → promoted)** With a choice file shown (a file the editor cannot show, `ChoiceView.vue`), hiding the
   search from a body-focused page leaves focus on `<body>`: `focusShownFile()`'s request stays pending because no
   MergeView takes a choice file's path. `ChoiceView.vue` takes the request through `useSearchGoTo` (match `null` only:
   choice files have no rows) and focuses its first choice button; the request is cleared (`took`).

## Target

Owned: `frontend/src/ui/SearchResults.vue`, `frontend/src/ui/ChoiceView.vue`, `frontend/src/ui/searching.test.ts`,
`frontend/src/ui/useSearchGoTo.test.ts` (new — move the five `useSearchGoTo` tests and their helpers there from
`searching.test.ts`, unchanged, as the connect round asked).

Read-only: everything else.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- WebKit, merge fixture page (`just app-session start-fixture`, or a private WebKitWebDriver on Xvfb with
  `document.hasFocus()` true), dark and light: item 2's row texts; item 3 with a choice file shown (the fixture's
  choice files: pick one in the list), focus on body, Ctrl+Shift+S twice → the first choice button has the keyboard,
  `search.goTo` null. Paste values and screenshot paths.

## Skills

`skill://vue-conventions`, `skill://verification` (plus your autoloaded ones).
