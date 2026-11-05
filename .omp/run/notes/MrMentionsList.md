# MrMentionsList

Agent output (`agent://MrMentionsList`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsList.md), collected 2026-11-05T09:58:59.167Z.

{
  "summary": "`@` completion now works in the thread panel's reply field. `mergeRequestMentionLines.ts` (pure) builds the list, reads the word, maps keys, keeps the highlight and places the list. `textareaCaret.ts` measures the caret (mirror div) and the visible room. `useMentions` wires one field to `mentionSearch`; `MergeRequestMentionList.vue` draws the listbox under the `@`. Also: `wrappedIndex`, `MENTION_PEOPLE`, the fake-glab anna answer, AGENTS docs. A pick keeps execCommand insertText (Main agreed).",
  "files_changed": [
    "frontend/src/ui/mergeRequestMentionLines.ts",
    "frontend/src/ui/mergeRequestMentionLines.test.ts",
    "frontend/src/ui/mergeRequestMentions.ts",
    "frontend/src/ui/MergeRequestMentionList.vue",
    "frontend/src/ui/textareaCaret.ts",
    "frontend/src/ui/textareaCaret.test.ts",
    "frontend/src/ui/menuKeys.ts",
    "frontend/src/ui/menuKeys.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/MergeRequestReplyField.vue",
    "frontend/src/ui/MergeRequestThreadPanel.test.ts",
    "frontend/src/ui/AGENTS.md",
    "tests/glab/mr-threads/graphql-people-an.json",
    "tests/glab/README.md"
  ],
  "tests_added": [
    {
      "name": "known_people_show_at_once_and_search_results_follow",
      "proves": "An empty search lists the known people (picture is the Person, the label falls back to the username). `found` and `searching` people follow, filtered again by the typed text."
    },
    {
      "name": "a_refused_or_failed_search_keeps_the_known_people_with_the_people_box_words",
      "proves": "Rule 5: a glabMissing refusal and a WorkerStopped failure keep the known lines and add peopleSearchText's sentence; a note alone still opens the list."
    },
    {
      "name": "nothing_to_show_closes_the_list",
      "proves": "No line and no note gives null, including `searching` and `found []` with no known match."
    },
    {
      "name": "a_composition_never_opens_the_list",
      "proves": "RK76: `composing` makes mentionRead null, and an isComposing key is the field's."
    },
    {
      "name": "a_selection_opens_no_list / a_dismissed_word_stays_closed_until_another_word_starts",
      "proves": "A selection gives null. The dismissed start stays closed while the caret is in that word; another word opens."
    },
    {
      "name": "an_open_list_takes_escape_enter_tab_and_arrows_only",
      "proves": "RK73, design §2.6 table: Escape closes, arrows step ±1, Enter/Tab pick. Any modifier, isComposing or a closed list gives null. With a note only, Enter, Tab and arrows are null and Escape closes."
    },
    {
      "name": "the_highlight_stays_while_the_people_stay_and_resets_otherwise",
      "proves": "The highlight is kept for the same usernames and reset to 0 otherwise, including a username split differently (ab,c vs a,bc). mentionOptionId gives `${listId}-${index}`."
    },
    {
      "name": "the_list_sits_below… / flips_above… / takes_the_larger_side… / moves_left…",
      "proves": "mentionPlace's below, above and larger-side choices (equal room goes below) with maxHeight, and the left clamp to room.right and room.left."
    },
    {
      "name": "the_mirror_copies_what_moves_a_glyph_and_wraps_like_the_field",
      "proves": "Every listed property and every font-* property is copied and others are not. Box-sizing, pre-wrap, break-word and the hidden absolute position are set. Width = clientWidth − both paddings."
    },
    {
      "name": "wrappedIndex wraps both ways (menuKeys.test.ts)",
      "proves": "Wraps forward and back. The stepMenuItem tests are unchanged and green."
    },
    {
      "name": "the_reply_field_offers_mentions (SSR)",
      "proves": "The textarea has aria-autocomplete=\"list\" and no aria-activedescendant or aria-controls, and no listbox is rendered."
    }
  ],
  "smoke_evidence": [
    {
      "command": "Step 1 measure (fixture, d01 of !637): type @an, ArrowDown Enter, then document.execCommand(\"undo\"). Webdriver and xdotool Ctrl+Z do not undo even plain typing.",
      "observed": "Before: [\"@anna \",6], r:true. After: [\"@an\", sel 0, end 3], one step. Real app: the same. setRangeText+input on \"hello @an\", then undo: \"hello @anna @an\" (corrupted). Main agreed: keep insertText."
    },
    {
      "command": "Fixture step 1: type @. Step 2: type an.",
      "observed": "Step 1: Dmitri (author), Sam, Anna, Ben (approvers; d01's writers already listed), the first [selected], aria-controls v-1, activedescendant v-1-0, logs []. Step 2: one fixture_people_search {text:\"an\"}; \"ABAnna Berg@anna\" with img loaded and muted span \"@anna\"."
    },
    {
      "command": "Step 3: placement reads (contentTop 854.5, lineHeight 20, contentLeft 617, font 13px/20px system-ui)",
      "observed": "`@an`: list top 874.5, left 617. `x\\ny\\n@an`: top 914.5 (854.5+60). `hello @an`: left 650.3 vs canvas 617+33.32=650.32. 13 lines then @an (scrollTop 36): top 918.5, the caret line's bottom; panel bottom 962. Bare @ there: list bottom 898.5 = caret top (flipped above)."
    },
    {
      "command": "Step 4: Down Enter; undo; ArrowRight; Enter; type @an; click Anna's option",
      "observed": "[\"@anna \",6], list gone. Undo gives \"@an\" sel 0–3 and no list (a selection). ArrowRight shows the list again; Enter gives [\"@anna \",6]. The click gives [\"@anna @anna \",12], focus kept, list gone."
    },
    {
      "command": "Step 5: @an, Escape, Escape",
      "observed": "After the first Escape: options null, dialog true, focus in the field. After the second: dialog false."
    },
    {
      "command": "Step 6: Ctrl+Enter, Shift+Enter, Tab with the list open",
      "observed": "Ctrl+Enter: one fixture_write {kind:\"comment\", iid:637, discussion d01}, list null. Shift+Enter: \"@an\\n\", list closed. Tab: \"@an\\n@anna \" sel 10."
    },
    {
      "command": "Step 7 (people box opened by keyboard: the panel covers !637's opener), then 7.5",
      "observed": "Add assignee shows Me@sam, Dmitri, Anna, Ben, Chiara; no mention list. `er`: one people_search \"er\", options Sam, Anna, Erik. Two Escapes close the box. Clicking back in the field, and again after closing and reopening the panel: the list shows only Anna."
    },
    {
      "command": "Step 8: Preview with the list open, then Write; ArrowLeft; End and type \" @b\"",
      "observed": "Preview: listbox gone, field wrapper display none. Write: [\"@an\",3,focus] and no list. ArrowLeft (still in the word): no list. A new word `@b` lists Ben and Anna; Enter gives \"@an @ben \"."
    },
    {
      "command": "Wiring checks: arrows, synthetic compositionstart/input/compositionend, blur(), focus(), field scrollTop=0",
      "observed": "Down Down puts * on Anna; typing b resets it to Ben, Backspace to Dmitri; ArrowUp from 0 wraps to Ben. Composition: start → null, input → null, end → list back. blur gives null; focus() brings it back. Scroll: list top moves from 918.5 to 896.5, above the new caret line."
    },
    {
      "command": "Step 9: shot of step 2 (dark, then light via <html data-theme=\"light\">)",
      "observed": "/tmp/mml-shots/dark-crop.png and light-crop.png: the list under `@an` with the AB picture, \"Anna Berg\" and a muted \"@anna\", inside the panel, styled for each theme."
    },
    {
      "command": "Real app: local-conflicts-repo.sh /tmp/mml-scratch/mml; cargo tauri build --debug --no-bundle; start-app mmla --glab mr-threads --mr; !90 d01",
      "observed": "`@`: 4 people, no `search=` line. `an`: one `argv: … search=an`, Anna with yamt-picture://localhost/anna (naturalWidth 16). Down Enter: \"@anna \" 6, no new line. Typed with pauses: exactly `search=a`, `search=an`, `search=ann`. `ann` shows Anna plus a muted role=status note \"fake glab: the scenario has no answer graphql-people-ann.json\". Session stopped."
    },
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order; test",
      "observed": "All exit clean. \"All matched files use the correct format.\" Test Files 305 passed (305); Tests 4545 passed (4545)."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 63.50% (341 killed, 19 survived, 177 no-cov). menuKeys.ts and mergeRequestMentionLines.ts 100%; the no-cov in mergeRequestsText.ts are older default branches.",
    "survivors": [
      "mergeRequestMentions.ts:152 input listener event \"\" — wiring: smoke steps 1–2 (typing opens and filters the list)",
      "mergeRequestMentions.ts:157 click/keyup array and strings — wiring: step 7.5 (a click reopens the list) and step 4 (ArrowRight keyup reopens it)",
      "mergeRequestMentions.ts:163 focus listener event \"\" — wiring: blur() then focus() brings the list back",
      "mergeRequestMentions.ts:167 compositionstart/end array, strings and call — wiring: the synthetic composition check (start closes, end reopens)",
      "mergeRequestMentions.ts:171 blur event \"\" — wiring: blur() closes the list",
      "mergeRequestMentions.ts:174 scroll event \"\" — wiring: scrollTop=0 re-places the list (918.5 → 896.5)",
      "mergeRequestMentions.ts:150 listen() body / :229 listen(state) removed — wiring: steps 1–8 (no reads, no list)",
      "mergeRequestMentions.ts:187 open===null→true and :216 composing:true — wiring: step 1 (the list would never open)",
      "mergeRequestMentions.ts:197 watch getter → undefined — wiring: the highlight resets when the lines change (Down Down, then b resets to Ben)",
      "mergeRequestMentions.ts:223, 225 aria-controls/aria-activedescendant → undefined — wiring: step 1 read shows controls v-1 and active v-1-0",
      "mergeRequestMentions.ts:236 keydown → undefined — wiring: steps 4–6 (Enter picks, Escape twice, Tab picks)",
      "All no-cov mutants in mergeRequestMentions.ts and in textareaCaret.ts caretBox/visibleRoom — wiring, DOM only: placement in step 3, picks in steps 4 and 6, the scroll check"
    ]
  },
  "acceptance_not_run": [
    "The Ctrl+Z key press (step 4, change step 1): webdriver and xdotool Ctrl+Z undo nothing here, even typed text. Undo ran as execCommand(\"undo\"), the same editor command: `@an` came back selected (0–3), so the list returns only once the caret collapses.",
    "Step 7.2's press on Add assignee: at 1600×1000 the thread panel covers !637's people opener and box. The box was opened by keyboard (focus() on the opener, Enter), so the panel stayed open. The rule-6 checks (7.2–7.5) were observed."
  ],
  "deviations_from_brief": [
    "Write path: the brief's rule (\"`@an` and 3, else setRangeText\") would have shipped setRangeText, whose undo was measured to corrupt the text. Main approved keeping execCommand(\"insertText\") under design §2.7's trigger (one undo step restores `@an`). The undo leaves the word selected.",
    "caretBox reads the span's first client rect, with the line box derived from line-height (CSS 2.1 §10.8.1 half-leading), instead of offsetLeft/Top/Height. An inline span's offsetHeight covers all of its lines and is the glyph box, not the line box.",
    "mirrorStyle uses kebab-case CSS property names (getPropertyValue/setProperty). caretBox passes every computed property, and mirrorStyle copies the listed ones plus every `font*` one.",
    "MergeRequestMentionList.vue splits the panel classes in two. The outer element is `absolute z-10 overflow-y-auto rounded-md shadow-lg` with left/top/maxHeight. The inner one is measured and carries `border border-control-border bg-panel-inline`. Measuring a capped scroller would pin the list to its capped side.",
    "`close()` (send, Preview) also dismisses the word under the caret, so keepFocus or Write cannot reopen it at once. `blur` only closes. `focus` reads one task later, because WebKit reports selectionStart 0 during the focus event and its microtasks.",
    "A read with no word ends mentionSearch when a word was open, not only when the list was open, so a pending search with no line is ended too. compositionstart also reads, so an open list closes at once.",
    "Additions: an exported `mentionOptionId(listId, index)` (used by the list and the field's aria-activedescendant) and a FieldRead/MentionInput export. The reply textarea gains `block`, so its new wrapper adds no baseline gap.",
    "Smoke light theme: start-fixture has no --settings, so <html data-theme=\"light\"> and colorScheme were set live."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestMentions.ts:104-115 (pick)",
      "risk": "After a pick, undo restores `@an` selected (0–3), not with the caret at 3, so the list reopens only after the caret collapses. The real Ctrl+Z key path was not observed in this harness."
    },
    {
      "location": "frontend/src/ui/mergeRequestMentions.ts:160-167",
      "risk": "The focus read waits one task (setTimeout) for WebKit to restore the caret. This was measured on WebKitGTK 2.54 only; a slower restore would read caret 0 and close the list until the next click or key."
    },
    {
      "location": "frontend/src/ui/textareaCaret.ts:56-84",
      "risk": "The caret measure is proven only in WebKit at 13px/20px system-ui, LTR, one font (smoke step 3). Mixed fonts on one line, RTL or `line-height: normal` (the glyph-height fallback) were not observed."
    },
    {
      "location": "frontend/src/ui/mergeRequestMentions.ts (whole composable)",
      "risk": "No node test covers the composable: its behaviour is proven only by the WebKit smoke. A regression there shows only in the verifier's smoke."
    }
  ]
}
