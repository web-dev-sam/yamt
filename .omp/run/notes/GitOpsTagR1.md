# GitOpsTagR1 - notes (web-impl, 3.J row 13 fix round 1)

Output fields verbatim.

I fixed the tag's screen-reader text in `OperationLabel.vue` (#1451). Every acceptance item checks out in WebKit, and all five frontend recipes pass. I added one thing the brief didn't ask for (`aria-labelledby`), because the brief's steps alone don't give the name it requires.

summary
- The `role="status"` element now holds the visible tag in a `<span aria-hidden="true">` and the line in a `<span class="sr-only">`. `aria-label` is gone and `title` is still the hover.
- So a step change is now a text change, which a live region announces. "1 of 3" → "2 of 3" was silent before because only an attribute changed.
- `aria-labelledby="operation-line"` points the name at the `sr-only` span. Without it, WebKit named the element with its whole hover text, not the line.
- `ui/AGENTS.md` now says the line is the tag's screen-reader text and explains why it is named this way.

files_changed
- `frontend/src/ui/OperationLabel.vue`
- `frontend/src/ui/AGENTS.md`

tests_added
- None. The change is template-only and was checked in the WebKit session below.

smoke_evidence
- **Fixture session:** `just app-session start-fixture --name tagr1 --size 1600x1000` (MiniBrowser through tauri-driver), page loaded at `?operation=rebase`.
- **Before Continue, DOM:** `<p role="status" title="Rebasing feature/reminders onto main · 1 of 3\n\nAdd reminder dates\n\nCards keep a due date." aria-labelledby="operation-line" class="shrink-0 truncate px-3 pt-1.5 pb-1 text-xs font-semibold text-fg-muted"><span aria-hidden="true">REBASE</span><span id="operation-line" class="sr-only">Rebasing feature/reminders onto main · 1 of 3</span></p>`
  - `textContent`: `"REBASERebasing feature/reminders onto main · 1 of 3"`
- **Before Continue, WebDriver** (element `aside p[role=status]`):
  - `computedlabel` → `{"value":"Rebasing feature/reminders onto main · 1 of 3"}`
  - `computedrole` → `{"value":"status"}`
  - `text` → `{"value":"REBASE"}`
- **Without `aria-labelledby`** (the brief's markup alone): `computedlabel` → `{"value":"Rebasing feature/reminders onto main · 1 of 3\n\nAdd reminder dates\n\nCards keep a due date."}`, i.e. the `title`. That fails the acceptance line, which is why I added the attribute.
- **Continue:** marked all 12 files resolved (each question confirmed), then clicked the visible "Continue rebase". No dialog appeared, and the element is the same one as before (`sameElement: true`).
  - DOM: the `sr-only` span now reads `Rebasing feature/reminders onto main · 2 of 3`, and the title starts `Rebasing feature/reminders onto main · 2 of 3\n\nShow reminders on the board…`.
  - `textContent`: `"REBASERebasing feature/reminders onto main · 2 of 3"`
  - Same WebDriver element id: `computedlabel` → `{"value":"Rebasing feature/reminders onto main · 2 of 3"}`, `computedrole` → `{"value":"status"}`, `text` → `{"value":"REBASE"}`
- **Pixel compare:** the tag's rectangle is page rect (5, 929, 240, 26) at devicePixelRatio 2, so the crop is `480x52+10+1858`. Compared with `magick compare -metric AE` against round 1's `/tmp/yamt-tag/filelist-{dark,light}.png`:

  | Theme | Tag rectangle | Whole file-list crop `490x1928+0+0` |
  |---|---|---|
  | Dark | `0 (0)` | `0.000980392`: one pixel at (9,1838), above the tag, max channel difference 1/255 |
  | Light | `0 (0)` | `0 (0)` |

  - Light was set the way round 1 did it: `data-theme="light"` by script.
  - New screenshots and crops are in `/tmp/yamt-tag-r1/`. The crops show "REBASE" in both themes.
- **Session stopped:** `{"stopped":"tagr1","session":"ended",…"webdriver"…"stopped"…"vite"…"stopped"}`
- **Recipes:**
  - `pnpm -C frontend typecheck`: `$ vue-tsc -b`, exit 0
  - `pnpm -C frontend test`: `Test Files  126 passed (126)` / `Tests  1756 passed (1756)`
  - `pnpm -C frontend lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
  - `pnpm -C frontend unused`: `$ knip --include exports,types`, exit 0
  - `pnpm -C frontend fmt:check`: `All matched files use the correct format. Finished in 768ms on 365 files using 24 threads.`

deviations_from_brief
- **Added `aria-labelledby="operation-line"` and `id="operation-line"` on the `sr-only` span.** The brief expected the line to become the name once `aria-label` was dropped, but a `status` element only takes its name from an attribute, never from its text, and WebKit fell back to `title` (the reading above). The fixed id follows the static-id pattern already used in `QuestionDialog.vue`, `KeyRecorder.vue` and `SettingsView.vue`, since FileList renders the tag once.
- **The `ui/AGENTS.md` sentence is longer than step 2 asked.** It also says why the name comes through `aria-labelledby`.
- **`pnpm install` ran once inside this worktree**, triggered by `just app-session`. The lockfile was unchanged.

open_risks
- `frontend/src/ui/OperationLabel.vue:16`: the id `operation-line` is global. It is fine while `FileList.vue:119` is the only place the tag renders; a second instance would need `useId()`.
- `frontend/src/ui/OperationLabel.vue:13`: I did not test with a real screen reader (Orca). The evidence for "announced" is that the region's text now changes while the element stays mounted, plus WebKit's computed label and role.

## Re-checks: boundary pass, correctness pass, no findings

```json
{
  "verdict": "pass",
  "round": "3.J-operation-tag fix round 1 (6a4e7fb), boundary lens, RV8",
  "blocks_fixed": [
    {
      "id": "#1451",
      "status": "fixed",
      "evidence": "OperationLabel.vue:19-20: the visible tag is now `<span aria-hidden=\"true\">` and the line is a `sr-only` span inside the `role=\"status\"` element. A step change (1 of 3 → 2 of 3) now changes the region's text and not just an attribute. Notes: the same mounted element (`sameElement: true`) has textContent and computedlabel going from '· 1 of 3' to '· 2 of 3'."
    }
  ],
  "findings": [],
  "checked": [
    "Ownership: the patch touches only frontend/src/ui/OperationLabel.vue and frontend/src/ui/AGENTS.md, which are the brief's two Owned files.",
    "Deviation accepted (aria-labelledby + static id): the notes have a WebKit reading without it, where computedlabel = the full `title` tooltip. That fails the acceptance line ('computedlabel = that line'). Under ARIA, a `status` role takes its name from the author only, so some author-side naming is required. The extra attribute is the smallest way to meet the acceptance line.",
    "Static id vs useId(): no file under frontend/src uses useId(). Static ids paired with aria-labelledby are the established pattern: QuestionDialog.vue:26/30, KeyRecorder.vue:126/130, SettingsView.vue:77-104, LanguageServerSettings.vue:62-111. Choosing useId here would have started a second convention.",
    "The id is unique: App.vue:69 mounts FileList exactly once, FileList.vue:119 is the only place OperationLabel renders (under `v-if`), and grep finds `operation-line` nowhere else in frontend/. The implementer's open_risk ('a second instance would need useId()') is accepted, since no second instance exists or is planned in the brief.",
    "Vue conventions: VU1 block order holds (script setup → template). VU2: the script is unchanged (imports → macros → computed). VU6: the template stays declarative, with `line` derived in a computed. VU14: Tailwind's `sr-only` utility is used and no `<style>` block was added.",
    "Single source of words: the tag comes from operationTag and the line and tooltip from operationLine in operationText.ts. No operation word was copied into the template.",
    "Layout unchanged: `sr-only` takes the span out of flow inside the `truncate` <p>. The notes report 0 differing pixels in the tag rectangle against round 1's crops, dark and light.",
    "ui/AGENTS.md:13: the sentence correctly names the sr-only span, the aria-hidden tag, why it is a text change (live regions announce text, not attributes), and why aria-labelledby is needed (a status takes its name from the author; WebKit otherwise uses `title`). This is an external fact stated in module docs, not a code comment, so comment-policy is not touched. The sentence is longer than step 2 asked, and that deviation is accepted.",
    "No other status region changed: the role=status elements in App.vue:85, ChoiceView.vue:122, KeyRecorder.vue:177, MergeToolbar.vue:204, NoticeBar.vue:14 and ServerStatus.vue:52/58 are untouched.",
    "Growth check: OperationLabel still has one job (showing the tag and its line). No new state, no new import edge, no new export. PM2/PM3 are unaffected because the template change adds no imports.",
    "No comments were added to OperationLabel.vue, and no decision in docs/plan.md §2 (#92) is contradicted: the tag looks the same and its hover is still the line's tooltip."
  ]
}
```

```json
{
  "verdict": "pass",
  "round": "3.J-operation-tag fix round 1 (6a4e7fb), correctness lens, RV8 re-check",
  "blocks_rechecked": [
    {
      "id": "#1451",
      "status": "fixed",
      "evidence": "OperationLabel.vue:13-21 at HEAD. The role=\"status\" <p> now holds `<span aria-hidden=\"true\">{{ operationTag(kind) }}</span>` and `<span id=\"operation-line\" class=\"sr-only\">{{ line.text }}</span>`, and aria-label is gone. The region's text is the line now. operationText.ts:159-162 builds that line from the operation, including its kind and step, so a step change ('1 of 3' → '2 of 3') or a kind change changes the region's text, which a live region announces. It is no longer only an attribute change. The notes paste WebKit reads on the same element (`sameElement: true`) before and after Continue: textContent 'REBASERebasing feature/reminders onto main · 1 of 3' → '… · 2 of 3', computedlabel 1 of 3 → 2 of 3, computedrole status both ti…
    }
  ],
  "findings": [],
  "checked": [
    "Deviation accepted: `aria-labelledby=\"operation-line\"`. The status role takes its name only from the author (ARIA 1.2), and the notes paste WebKit's computedlabel without it: the whole `title` tooltip. The brief's Acceptance requires computedlabel = the line, so the attribute is needed to meet it, and the pasted read with it is exactly the line.",
    "The static id is safe. App.vue:69 renders FileList once (v-show), and FileList.vue:119 is the only OperationLabel use (grep `OperationLabel` in frontend/src), so `operation-line` appears once in the page. It follows the existing static-id pattern (QuestionDialog.vue:30, KeyRecorder.vue:130, SettingsView.vue:78-99). The implementer's open_risk about a second instance is noted, and nothing renders one today.",
    "The visible tag is hidden from assistive tech without hiding the region. aria-hidden is on the inner span only, and role/title/aria-labelledby stay on the <p>. WebDriver `text` still reads 'REBASE', so the visible text is unchanged. The notes paste AE 0 on the tag rectangle in dark and light.",
    "Double reading: the name and the content are now both the line, and `title` (operationText.ts:161: the line plus the commit messages) is the description. The live announcement reads only the region's content (aria-hidden excluded), which is the line once. Name and content repeating each other is what the brief designed ('The accessible name and the announced text are then the line'). The description repeating the line was already there in round 1 (aria-label = line, title kept), and the brief keeps `title`. Under RV8 this does not reach the block bar, so it is not reported.",
    "The sr-only span sits inside a `truncate` <p>. It is absolutely positioned and clipped at its static position, and AE 0 on the tag rectangle and on the light file-list crop confirms no layout change. One dark pixel off by 1/255 above the tag is outside the element.",
    "Kind changes: the line comes from `lineText(operation)` and the tag from `operationTag(operation.kind)`, both reactive through `props.operation`. `operation` still has one writer (listing.ts refreshFiles, ui/AGENTS.md:13), so no new state and no second writer.",
    "ui/AGENTS.md:13 sentence (read at 6a4e7fb) matches the markup: sr-only line, aria-hidden tag, name through aria-labelledby, and the WebKit title fallback as the reason.",
    "Growth: two template-only lines in the one owned component. No new state, import edge or copied rule. Words stay only in operationText.ts.",
    "Tests: none added; the brief asked for none. The acceptance evidence is the pasted WebKit reads, which a deleted fix would fail (computedlabel would be the title, and textContent would not change between steps).",
    "Survivor list: no mutants run was supplied for this template-only round (no .ts logic changed), so there is nothing to triage.",
    "No targeted test run: no block depends on one."
  ]
}
```

[Some lines truncated to 768 chars. Use agent://GitOpsTagR1Check:raw:9-9 to read line 9 whole]
