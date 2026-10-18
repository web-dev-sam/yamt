All nine blocks are fixed and both images are retaken from the real app; nothing is committed and the images are not in the patch. The README image is at `/tmp/yamt-demo/screenshot.png` (3200×2000) and the social one at `/tmp/yamt-demo/social-1280x640.png` (1280×640). I didn't run `just check` or shellcheck, which isn't installed here; `bash -n` passes on all five scripts.

```
summary
  The demo project's node_modules rule (link_package, require_frontend_tools, link_frontend_tools) now lives only in
  scripts/lsp-servers.sh. The conflict count check is one require_conflicts in scripts/git-sandbox.sh, used by all three
  repo scripts. demo-repo.sh dies when scripts/demo/<side>/ holds a file no put line commits. The three merge task
  details are short. board.ts is rewritten so every line from the lanes code to reorderCard is ≤ 46 characters, and
  the error now sits at column 15 of a short line. Line counts: scripts/demo-repo.sh 112, scripts/lsp-servers.sh 245;
  board.ts is 470 lines in base, 504 on main, 493 on feature, 524 on disk after the merge.
  Images: /tmp/yamt-demo/screenshot.png (3200×2000) and /tmp/yamt-demo/social-1280x640.png (1280×640). Round 1's images
  were renamed to screenshot-round1.png and social-1280x640-round1.png.

files_changed
  scripts/demo-repo.sh, scripts/lsp-servers.sh, scripts/lsp-repo.sh, scripts/conflict-repo.sh, scripts/git-sandbox.sh,
  .vscode/tasks.json, scripts/demo/base/.oxfmtrc.json (printWidth 100 → 80),
  scripts/demo/{base,main,feature}/src/board/board.ts (rewritten part),
  files reformatted by oxfmt at 80 with no code change: scripts/demo/base/src/{api/client.ts,api/mockBoards.ts,
  board/storage.ts,board/types.ts,main.ts}, scripts/demo/feature/{src/api/client.ts,src/board/storage.ts,
  src/board/types.ts,src/ui/cardView.ts,vite.config.ts}, scripts/demo/main/src/api/{client.ts,mockBoards.ts}

tests_added
  None committed: this is dev tooling. The block-4 check was run on its failing path (acceptance 3 below).

smoke_evidence
  A1 / round-1 acceptance 1: after/scripts/demo-repo.sh /tmp/yamt-demo/r2/final → exit=0
      lsp-servers: typescript-language-server 6.0.2
      lsp-servers: launch yamt with PATH=/home/wds/.cache/yamt/servers-path:$PATH
      demo-repo: /tmp/yamt-demo/r2/final is mid-merge (main merging feature/reminders); conflicted files:
      docs/shortcuts.md public/logo.png src/api/client.ts src/api/mockBoards.ts src/board/board.ts src/board/card.ts src/ui/cardView.ts
    `git ls-files -u | cut -f2 | sort -u` gives the same 7 paths.
    `git log --oneline --graph --all`: f71cc59 Refresh the logo / 65262cf Mock board… / 4cb3a81 Swimlanes… on main;
      67fcf1b Reminders… / 142fa74 Store due times… / 6f9eee2 Drop the mock board… on feature/reminders;
      fork 1f9d776; then a7c81c8, 015ef66, 2603b91.
    `git status --short`: M README.md; UU docs/shortcuts.md; UU public/logo.png; UU src/api/client.ts;
      UD src/api/mockBoards.ts; UU src/board/board.ts; UU src/board/card.ts; M storage.ts, types.ts, styles.css;
      UU src/ui/cardView.ts; A vite.config.ts.
    Second run into the same folder → "demo-repo: refusing to overwrite /tmp/yamt-demo/r2/a: it exists and is not empty", exit=1.
    board.ts on disk has one conflict, in moveCard (markers at lines 225/228/231).
    Each side alone (base, base+main, base+feature): tsc=0 and fmt=0 (oxfmt --check). oxlint gives only main's
    `terms` warning.
    No board.ts line between lines 164 and 262 of the merged file is longer than 46 characters.
  Round-1 acceptance 2 (the problems are real): scratch copy of the demo repo whose board.ts is the screenshot's
    Result text (base plus main's applied lanes section and `terms` line), with card.ts replaced by main's version:
      src/board/board.ts(204,15): error TS2551: Property 'dueDate' does not exist on type 'Card'. Did you mean 'dueAt'?
      src/board/board.ts:462:9: warning eslint(no-unused-vars): Variable 'terms' is declared but never used.
    tsc also lists three errors inside card.ts itself (main's dueDate against the merged types); they are not in board.ts.
    Both problems show after two Apply clicks on main's changes (the lanes section and the `terms` line). As yamt
    opens the file it shows 0 errors and 0 warnings.
  Round-1 acceptance 4: shellcheck not installed; bash -n ok on all five scripts; tasks.json goes through node JSON.parse.
  A2 (before = bafe527 from `git archive` in /tmp/yamt-demo/r2/before, after = this tree in /tmp/yamt-demo/r2/after):
    conflict-repo.sh, before and after, exit=0, printed list and ls-files -u both:
      assets/logo.bin docs/removed.md notes/crlf.txt packages/compiler-core/src/transforms/vOn.ts
      packages-private/sfc-playground/src/App.vue packages/react-query-persist-client/src/PersistQueryClientProvider.tsx src/added.ts
    lsp-repo.sh --servers, before and after, exit=0, same server line, printed list and ls-files -u both:
      biome/src/index.js c/src/main.c go/calc/calc.go php/src/Stats.php py/api/stats.py rs/core/src/lib.rs
      web/src/App.vue web/src/greet.ts web/src/math.ts
    The web/ and biome/ node_modules link sets are equal except for the before/after root path. The index differs
    only in c/compile_commands.json, which holds the repo's absolute path.
  A3: scratch copy /tmp/yamt-demo/r2/extra with scripts/demo/main/src/board/lanes.ts added →
      demo-repo: scripts/demo/main/src/board/lanes.ts is never committed: add it to a put line   (exit=1)
    `git status --short scripts/demo/main` in this tree shows only my three edits, no untracked file.
  A4 / round-1 acceptance 5 (real app, release binary, scratch settings and storage, dark, greyscale):
    screenshot.png 3200×2000 (GDK_SCALE=2, 1600×1000 window):
    - #1255: no focus outline anywhere. Scrolling was X wheel notches (xdotool buttons 4/5 on the private display)
      over the Result and Local panes, plus WebDriver pointer clicks on two » icons. No toolbar arrows were used.
    - #1256: every line in Local (204–259) and Result (200–255) fits its pane; the Remote is cut only under the minimap.
    - #1257: the tooltip sits over Result 202–203 and ends at about x 2610; the minimap starts at about x 2860.
    - Tree with board.ts selected; default toolbar "10 changes · 1 conflict"; status "1 error, 1 warning" with
      oxfmt, oxlint and TypeScript running.
    - Insertion: Local 214 `lane?: string,` (green).
    - Modifications: Local 255 `unshift` (blue), and Result 243 / Remote 204 createCard.
    - Removal bar: Remote 204 `createCard(input|)`.
    - Conflict: Local 224–226 and Remote 181–183 (purple).
    - Wave: across all three panes below Local 230.
    - Tooltip: "Property 'dueDate' does not exist on type 'Card'. Did you mean 'dueAt'? TypeScript 2551".
    - Alt held: minimap box at about Result 200–255, not at the top; red and yellow marks on its left edge;
      change marks on its right edge.
    social-1280x640.png 1280×640 (GDK_SCALE=1). The file list is hidden with Ctrl+B. All input was xdotool (wheel,
    clicks, pointer, Alt), no WebDriver. No outline; Local 202–228 and Result 200–226 fit; tooltip ends at x 1062,
    minimap starts at x 1138; Alt minimap with both kinds of marks; insertion, conflict and the error in view.
  Round-1 acceptance 6: fingerprints of ~/.config/yamt, ~/.local/share/dev.yamt.merge, ~/.cache/dev.yamt.merge,
    ~/go/bin, ~/.cargo/bin and ~/.local/bin are identical before and after (2ea5ff5b…, 4662f33f…, e3b0c442…,
    820e560b…, ad4b70f1…, 663ca867…).
    pgrep finds only 33199 (oxlint --lsp) and 33240 (oxfmt --lsp) from the main checkout's frontend/node_modules.
    Both were already running in round 1.

deviations_from_brief
  - Map lines to change (no new file names):
    - scripts/lsp-servers.sh: also holds require_frontend_tools, link_package and link_frontend_tools <node_modules>,
      the node_modules rule for demo-repo.sh and lsp-repo.sh.
    - scripts/git-sandbox.sh: add require_conflicts.
    - scripts/demo-repo.sh: no change needed.
  - #1263: I chose the check, not lists derived from the folders. A `was_put` map is filled by put;
    require_all_put <layer> runs after the base commits, after feature's and after main's. Base is checked too.
  - #1256: printWidth is now 80 (Prettier's default, common in real projects; it was 100). All files on all three
    sides were reformatted with oxfmt so the diffs stay plain.
  - board.ts code changes, on all sides:
    - New helpers fullError(column) and remove(ids, cardId), placed after isFull.
    - moveCard: `const at = …`.
    - addCard: record before push.
    - reorderCard: param renamed to `position` so its signature breaks onto short lines.
    - Main: lanes code = constants, moveToLane, lanesOf (ReadonlyMap), bySoonest, dueOf, with the error in dueOf.
      moveToLane moved into that section; its param is `laneName`.
    - Main's new modification in addCard: push → unshift.
  - lsp-repo.sh keeps link_web_modules, now link_frontend_tools plus link_package vue.
  - The note that the package.json files are copies (crates/lsp-host/src/files.rs) moved from demo-repo.sh's header
    to lsp-servers.sh's.
  - lsp-repo.sh's variable `modules` is now lsp-servers.sh's `frontend_modules`.
  - The WebDriver Alt key and pointer were used for the README image, as in round 1, because the Xvfb screen the
    app-session helper starts is 1600×1000 while the window at scale 2 is 3200×2000. xdotool reaches only the top-left
    quarter, enough for wheeling over the Local and Result panes but not for the hover point.

open_risks
  - The README image puts the tooltip above the error line, over Result 202–203 and the top of Remote 162–164. That
    is where CodeMirror places it.
  - scripts/demo/main/src/board/board.ts:255: unshift is 7 lines below feature's createCard change. With DEFAULT_GAP=1
    they stay separate chunks (seen in the app), but moving either line closer could merge them into a second conflict.
  - scripts/demo/base/src/board/board.ts:16-20: the Activity union lines are 52–80 characters. They are outside the
    screenshot, but a scroll position near the top of the file would show them cut.
  - Scratch left in /tmp/yamt-demo/r2/ (before/, after/, extra/, repos, check scripts, candidate shots b*/c*/s*.png);
    none of it is in the tree.
```