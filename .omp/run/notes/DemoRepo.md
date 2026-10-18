The demo project is built and the "conflict", "yamt" and "WebStorm" buttons now use it. The screenshot is at `/tmp/yamt-demo/screenshot.png` (3200×2000) and the extra 1280×640 one you asked for is at `/tmp/yamt-demo/social-1280x640.png`; neither is in the patch. One thing you need to do before `just check`: `just map-check` will fail on the new files until the project map names them (exact list under deviations).

```
summary
  Taskboard is a small TypeScript kanban web app (Vite, oxlint, oxfmt), stopped while `main` (Maya Lindqvist: swimlanes by person) merges
  `feature/reminders` (Tomás Herrera: dueDate → dueAt, reminders), with 7 conflicts across docs/, public/, src/api, src/board, src/ui.
  scripts/demo-repo.sh 124 lines; scripts/lsp-servers.sh 204 (+10); scripts/demo/ 38 files, 2,411 text lines;
  src/board/board.ts is 391 lines in base, 415 on main, 414 on feature/reminders, 440 on disk after the merge.
  Screenshot: /tmp/yamt-demo/screenshot.png (3200×2000); extra: /tmp/yamt-demo/social-1280x640.png.

files_changed
  scripts/demo-repo.sh (new)
  scripts/demo/base/** (the project where the branches split: package.json, tsconfig.json, .oxlintrc.json, .oxfmtrc.json, .gitignore,
    index.html, README.md, docs/shortcuts.md, public/logo.png, src/{main.ts,styles.css}, src/api/{client,mockBoards}.ts,
    src/board/{board,card,storage,types}.ts, src/ui/cardView.ts)
  scripts/demo/main/** (only the files Maya changes)
  scripts/demo/feature/** (only the files Tomás changes, plus vite.config.ts)
  scripts/lsp-servers.sh (adds install_typescript_server; header line)
  .vscode/tasks.json (the three "merge:" tasks)

tests_added
  none. This is dev tooling; the checks are the scripts' own guards: exactly 7 conflicts, refuse a non-empty folder,
  require the frontend tools.

smoke_evidence
  1. scripts/demo-repo.sh /tmp/yamt-demo/a → exit 0:
       lsp-servers: typescript-language-server 6.0.2
       lsp-servers: launch yamt with PATH=/home/wds/.cache/yamt/servers-path:$PATH
       demo-repo: /tmp/yamt-demo/a is mid-merge (main merging feature/reminders); conflicted files:
       docs/shortcuts.md public/logo.png src/api/client.ts src/api/mockBoards.ts src/board/board.ts src/board/card.ts src/ui/cardView.ts
     `git ls-files -u | cut -f2 | sort -u` → the same 7 paths.
     `git log --oneline --graph --all`:
       * 132efe8 Refresh the logo
       * 0b58918 Mock board: people on the cards, ?mocks on any host
       * a7cdb35 Swimlanes: group a column's cards by person
       | * e82c960 Reminders before a card is due
       | * 27234d8 Store due times instead of days (dueDate → dueAt)
       | * 3c7a790 Drop the mock board: pnpm dev proxies /api to staging
       |/
       * 9c19e34 Add the logo and the list of keyboard shortcuts
       * 612480f Load boards from the API, with a mock board on localhost
       * 6fc5bc1 Board model: columns, cards, labels and the activity feed
       * e195ef2 Set up Vite, TypeScript, oxlint and oxfmt
     `git status --short`: M README.md, UU docs/shortcuts.md, UU public/logo.png, UU src/api/client.ts, UD src/api/mockBoards.ts,
       UU src/board/board.ts, UU src/board/card.ts, M src/board/storage.ts, M src/board/types.ts, M src/styles.css,
       UU src/ui/cardView.ts, A vite.config.ts
     Second run → "demo-repo: refusing to overwrite /tmp/yamt-demo/a: it exists and is not empty", exit 1.
     Each branch alone (base plus that side's files, scratch copy): tsc 0, oxfmt --check clean. oxlint is clean on
     feature/reminders; on main it gives only the intended warning (`terms`).
  2. The problems are real. The Result text was copied out of yamt (click in the Result, Ctrl+A, Ctrl+C, xclip on the
     private display) into a scratch copy. card.ts was replaced by main's version, because tsc reports only syntax errors while card.ts
     has conflict markers:
       tsc -p tsconfig.result.json → src/board/board.ts(142,39): error TS2551: Property 'dueDate' does not exist on type 'Card'. Did you mean 'dueAt'?
       (the other errors are in card.ts itself: main's dueDate against the merged types)
       oxlint src/board/board.ts → src/board/board.ts:362:9: warning eslint(no-unused-vars): Variable 'terms' is declared but never used.
     They show after three Apply clicks on main's changes: » on the lanesOf insertion (the error), and » on the `terms` line and
     the assignee line in searchCards (the warning). As yamt opens the file it shows 0 errors and 0 warnings.
  3. tasks.json still parses (node JSON.parse: 7 tasks). Commands run in bash from the repo root. I used a scratch root
     (/tmp/yamt-demo/root: scripts/ linked to this tree, frontend/node_modules linked to the main checkout's, which this tree lacks)
     and /tmp/yamt-demo/conflict-project in place of /tmp/yamt-conflict-project:
       conflict task → same output as in 1, exit 0.
       "make it if missing" part → exit 0 when the project exists; builds it when it is missing.
       scripts/lsp-servers.sh --path → PATH=/home/wds/.cache/yamt/servers-path:...;
       servers-path/typescript-language-server → ~/.cache/yamt/typescript-language-server-6.0.2/node_modules/.bin/typescript-language-server
  4. shellcheck is not installed. bash -n on scripts/demo-repo.sh and scripts/lsp-servers.sh: ok.
     scripts/lsp-repo.sh --servers /tmp/yamt-demo/lsp → exit 0, 9 conflicted files; servers-path still holds all 9 links.
  5. /tmp/yamt-demo/screenshot.png, 3200×2000 (real app, GDK_SCALE=2, 1600×1000 window, dark theme, greyscale text, scratch
     settings and storage). Input was clicks, WebDriver wheel/pointer/Alt key actions, Ctrl+A/C and the toolbar's "Previous change";
     no DOM edits or injected styles. What it shows:
     - File list as a tree (docs, public, src/api, src/board, src/ui) with board.ts selected: left column.
     - Default toolbar ("9 changes · 1 conflict"); status area "1 error, 1 warning" with oxfmt, oxlint and TypeScript running: top right.
     - Insertion: Local 174–176 moveToLane, green.
     - Removal bar: Remote 156 `createCard(input|)`.
     - Modification: Local 152–158 moveCard's signature, blue; Remote 20–21, blue.
     - Conflict: Local 166–168 and Remote 143–145, purple; its × « icons at Result 160.
     - Collapsed waves: Remote between 25 and 129; Result at the bottom edge.
     - Tooltip: over Result 142 `card.dueDate`, reading "Property 'dueDate' does not exist on type 'Card'. Did you mean 'dueAt'? TypeScript 2551".
     - Alt held: minimap at the right edge. Its box covers lines ~131–174, not the top. A red and a yellow problem mark sit on its
       left edge; change marks sit on its right edge.
     The tooltip and Alt coexist. The tooltip's right end overlaps the minimap's left part a little.
     Other candidates beside it: cand-tooltip-no-alt.png, cand-no-tooltip-no-alt.png, s1–s13.png.
     Extra, per your note: /tmp/yamt-demo/social-1280x640.png, 1280×640 at scale 1. The file list is hidden with Ctrl+B, because
     with it shown the narrow Result pane cut `card.dueDate` off and there was nothing to hover. It shows the tooltip, the Alt
     minimap, the conflict, the modification and waves. The green insertion and the removal bar don't fit in 640 px.
     A variant with the tree, Alt held and no tooltip: social-1280x640-tree.png.
  6. Fingerprints before and after (names, sizes, mtimes) are identical: ~/.config/yamt 2ea5ff5be14633b5;
     ~/.local/share/dev.yamt.merge 7bf5c3f0ab035e24; ~/.cache/dev.yamt.merge (empty) e3b0c44298fc1c14;
     ~/go/bin 820e560b94353aae; ~/.cargo/bin ad4b70f15d929c2b; ~/.local/bin 663ca867f983db5c.
     pgrep -af for target/release/yamt, tauri-driver, Xvfb, WebKitWebDriver, typescript-language-server, tsserver, oxlint, oxfmt
     → only pids 33199 (oxlint --lsp) and 33240 (oxfmt --lsp) from the main checkout's frontend/node_modules, both running before I started.

deviations_from_brief
  - Needs your edit: `just map-check` (PM6) will fail. It checks every file under scripts/ by name, including scripts/demo/**.
    Missing names: demo-repo, board, card, cardView, storage, mockBoards, shortcuts, logo, styles, .oxlintrc, .oxfmtrc.
    Suggested map line: `scripts/demo-repo.sh <dir>`: the demo project behind the VS Code "conflict"/"yamt"/"WebStorm" buttons
    (Taskboard: main merging feature/reminders, 7 conflicts); scripts/demo/{base,main,feature}/ hold its files: board, card,
    cardView, storage, types, client, mockBoards, main, styles, index, shortcuts, logo, .oxlintrc, .oxfmtrc, vite.config.
    The other way out is to exclude scripts/demo from map-check.
  - scripts/git-sandbox.sh's header still lists its sourcing scripts without demo-repo.sh; that file is read-only for this slice.
  - link_package is an 8-line copy of lsp-repo.sh's. Sharing it would mean editing lsp-repo.sh, which is read-only.
  - File layout: base/ is the full tree where the branches split; main/ and feature/ hold only the files each person changed. That keeps each
    side's change visible as a plain diff against base. The script commits them in path groups, with authors and dates per commit.
  - Extra files I chose for realism: vite as a devDependency (not linked into node_modules, and tsc doesn't need it),
    vite.config.ts on the feature branch, and the logos made with ImageMagick.
  - Your note added the 1280×640 screenshot, which the brief had as a non-goal ("a second screenshot"). It is left out of the patch as you asked.

open_risks
  - In the main screenshot, Local 152–158 has a keyboard-focus outline left by the "Previous change" clicks used to scroll back.
    WebDriver wheel events with a negative delta did nothing here, so those clicks were the way back up.
  - The tooltip partly covers the minimap's left edge in screenshot.png. The tooltip sits where the error starts, so another hover spot would not move it.
  - tasks.json: until "conflict" is clicked once, the "yamt" and "WebStorm" buttons open whatever /tmp/yamt-conflict-project already
    holds, since they only build it when it is missing. Right now that is the old conflict-repo.sh project.
  - demo-repo.sh: the tasks' "detail" text and the script header say the problems show only after Apply on main's changes,
    not as the file opens.
  - Scratch left in /tmp/yamt-demo (check scripts, root mirror, repos a/, shot/, lsp/, result-check/, chk*); none of it is in the tree.
```