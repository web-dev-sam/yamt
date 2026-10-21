# GitOpsTagVerify - final check (verifier, 3.J row 14)

Output verbatim.

Everything passed. The gate passed on `ce57f98` with a clean tree, and every smoke recipe in the 3.J brief passed. I did not run `just mutants`: neither you nor the brief named a `<base>`, and I didn't want to guess the commit before the feature. Name the base and I'll run it.

**Environment:** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0. WebKit sessions started through `just app-session`: the fixture page used WebKitWebDriver, and the real app ran under tauri-driver on private display `:2`. I stopped all sessions afterwards (each `stop` reported its webdriver/vite or tauri-driver/xvfb processes as "stopped") and didn't touch the owner's yamt.

```
gate      pass
failures  []
```

**`just check`:** exit 0 in 25.65 s, full log at `/tmp/yamt-tag/verify/check.log`. The last recipe, hooks-test, ended with `ℹ tests 16 ℹ pass 16 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0`.

## smoke

**1. Fixture page, 1600×1000, dark and light: pass**

`computedlabel` came from WebDriver's `GET /element/{id}/computedlabel`, and `computedrole` was `status`. Text and label were the same in both themes; the tag's colour was `rgb(129, 126, 141)` in dark and `rgb(115, 118, 124)` in light. In every row the tag's next sibling is the `separator`, so the tag is the last element in the file list.

| `?operation=` | tag text | `title` (lines joined by ⏎) | computedlabel |
|---|---|---|---|
| rebase | `REBASE` | `Rebasing feature/reminders onto main · 1 of 3`⏎⏎`Add reminder dates`⏎⏎`Cards keep a due date.` | `Rebasing feature/reminders onto main · 1 of 3` |
| merge | `MERGE` | `Merging feature/reminders into main` | same |
| squash | `SQUASH MERGE` | `Squash-merging feature/reminders into main` | same |
| cherry-pick | `CHERRY-PICK` | `Cherry-picking 3f1c2a9 Add reminder dates · 1 of 3` + the commit message | `Cherry-picking 3f1c2a9 Add reminder dates · 1 of 3` |
| revert | `REVERT` | `Reverting 3f1c2a9 Add reminder dates · 1 of 3` + the commit message | `Reverting 3f1c2a9 Add reminder dates · 1 of 3` |
| am | `AM` | `Applying patch 1 of 3: Add reminder dates` + the commit message | `Applying patch 1 of 3: Add reminder dates` |
| none | no element (`tag:null`) | — | "no element" |

- **Right column:** in dark, the first row's text begins with the toolbar (`Mark resolved Continue rebase 3 changes · 1 conflict …`, and for none `Mark resolved 3 changes · 1 conflict …`), with no operation line above it.
- **Light, first pass:** my first light pass left the Settings view open (Escape didn't close it), so that pass read the Settings page as the first row. I re-ran light closing Settings with `Back`; the tags and labels matched again. A spot read in light with `?operation=merge` gave a first row of `Mark resolved Commit merge 3 changes · 1 conflict …`.
- **Continue:** I resolved all 12 files with `Mark resolved` → `Save Current Result`. The page then said "All files are resolved. Continue rebase to let git go on." and `Continue rebase` was enabled. After clicking it, the same element (`sameElement:true`) read:
  - title: `Rebasing feature/reminders onto main · 2 of 3`⏎⏎`Show reminders on the board`⏎⏎`A bell marks a card that is due.`
  - label: `Rebasing feature/reminders onto main · 2 of 3`, and computedlabel matched.
- **Screenshots:** both show three panes and a gray `REBASE` at the bottom left of the file list, with the toolbar row at the top of the right column.
  - `/tmp/yamt-tag/verify/fixture-dark-rebase.png`
  - `/tmp/yamt-tag/verify/fixture-light-rebase.png`
  - `/tmp/yamt-tag/verify/fixture-dark-rebase-step2.png`

**2. Real app, `operations-repo.sh rebase`: pass**

The debug build exited 0. The script printed "stopped in rebase; conflicted files: assets/logo.bin docs/notes.md src/board.ts".

- **Tag:** the text is `REBASE`, placed last in the file list before the separator.
  - title: `Rebasing feature onto main · 1 of 3`⏎⏎`feature: board columns, logo and notes`⏎⏎`The board gets a doing column.`
  - label: `Rebasing feature onto main · 1 of 3`
- **Files:** the list showed the three conflicted files.
- **Right column:** the first row is `Continue rebase Abort rebase Local (yours): d5bd727 …`, with nothing above the toolbar.
- **Ctrl+B:** the file list went from 240 px wide, `display:flex`, tag visible to 0 px, `display:none`, tag not visible; a second press restored it. The list is hidden rather than removed, so my first DOM-presence check couldn't see the change and I switched to checking width and visibility.
- **Continue:** I resolved the files (Keep for the deleted file, Take left for the binary, Mark resolved → Save for `board.ts`) and clicked `Continue rebase`. The same element then read:
  - title: `Rebasing feature onto main · 2 of 3`⏎⏎`feature: card title`
  - label: `Rebasing feature onto main · 2 of 3`
  - `git status --short` showed `UU src/card.ts`.
- **Screenshots:**
  - `/tmp/yamt-tag/verify/app-rebase.png`
  - `/tmp/yamt-tag/verify/app-rebase-hidden.png`
  - `/tmp/yamt-tag/verify/app-rebase-step2.png`

**3. Real app, `operations-repo.sh stash-pop`: pass**

The script printed "stopped in stash-pop; conflicted files: src/board.ts".

- **No tag:** the tag element is null, and the file list reads only `Files`, `src/board.ts`.
- **Right column:** the first row is `Mark resolved 1 conflict Local (yours): topic …`.
- **Screenshot:** `/tmp/yamt-tag/verify/app-stash-pop.png`

**4. `just mutants <base>`: not run**

No `<base>` was named, so there are no survivors to report.