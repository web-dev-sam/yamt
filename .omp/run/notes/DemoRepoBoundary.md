```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "vision-2",
      "file": "scripts/demo-repo.sh",
      "line": 59,
      "problem": "The patch copies more than the 8-line `link_package` it reports. `link_modules` (lines 69-78) is `lsp-repo.sh`'s `link_web_modules` (358-368) without vue, and the frontend-tools guard (32-34) is `lsp-repo.sh:48-50` word for word. So two scripts now hold separate copies of the rule for how a scripted project gets its node_modules (oxlint and oxfmt linked whole, typescript linked with a copied package.json because of `crates/lsp-host/src/files.rs`, the `oxlint oxfmt tsc` list), and any change to that rule needs two edits that can drift apart.",
      "fix": "Move `link_package` plus a `require_frontend_tools` and a `link_frontend_tools <node_modules dir>` (oxlint, oxfmt, typescript, .bin) into `scripts/lsp-servers.sh`, which both scripts already source. Call them from `demo-repo.sh`, and have `lsp-repo.sh`'s `link_web_modules` call them plus `link_package vue`. The orchestrator must first grant `lsp-repo.sh`, which the brief made read-only."
    },
    {
      "severity": "block",
      "rule_id": "ownership",
      "file": "Agent brief Crisp code text rendering on macOS, Linux and Windows (Tauri).md",
      "line": 1,
      "problem": "The slice commit deletes the owner's root brief. That file is outside `Owned`, the implementer's report and the orchestrator's list of shared edits do not mention it, and it is the cited source of `docs/slices/SLICES.md:324` (and findings #779). Both now point at a file that does not exist.",
      "fix": "Restore the file from 7ac7468 in this slice. If the owner removed it on purpose, put that removal in its own commit and change SLICES.md:324 to cite `git show 7ac7468:'Agent brief Crisp code text rendering on macOS, Linux and Windows (Tauri).md'`."
    },
    {
      "severity": "should",
      "rule_id": "promote",
      "file": "scripts/demo-repo.sh",
      "line": 117,
      "problem": "The check \"list the unmerged paths, count them, die unless exactly N\" (117-119) is now in a third script (`conflict-repo.sh:71-73`, `lsp-repo.sh:402-404`). Each change to how conflicts are counted gets one more copy to edit; #287 promoted the same kind of copy into `git-sandbox.sh`.",
      "fix": "Add `require_conflicts <n>` to `scripts/git-sandbox.sh` that prints the paths or dies, and use it in all three scripts (orchestrator's file)."
    },
    {
      "severity": "should",
      "rule_id": "vision-2",
      "file": "scripts/lsp-servers.sh",
      "line": 185,
      "problem": "`install_typescript_server` repeats where the server lives (`$tsls_home/node_modules/.bin/typescript-language-server`, also on line 147) and the launch line (187 = 179). It also uses `ln -sfn` where `put_on_path` uses `ln -s`, so a new tsls layout needs two edits.",
      "fix": "Make `put_on_path` use `ln -sfn` and call `put_on_path typescript-language-server \"$tsls_program\"` with one `tsls_program` variable that `fill_servers_path` also uses. Move the launch `echo` into one `print_launch_line` used by both installers."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": ".omp/skills/project-map/SKILL.md",
      "line": 59,
      "problem": "map-check's `scripts/*` pathspec now covers the demo's data files, so the map line lists 15 file names (board, card, …, vite.config) only to satisfy the check. `.gitignore` passes without being named, because `${name%.*}` leaves an empty word. Every file added to the demo will need a map edit, though these files are data like `frontend/fixtures`, not modules a reader looks for.",
      "fix": "Exclude `':!scripts/demo/**'` in `scripts/map-check.sh`'s `git ls-files`, and replace the name list with \"scripts/demo/{base,main,feature}/: the project's files per side\"."
    },
    {
      "severity": "should",
      "rule_id": "principles §2",
      "file": "scripts/demo-repo.sh",
      "line": 95,
      "problem": "Which files each person changed is recorded twice: once in `scripts/demo/<side>/` and once in the `put` lists (95-113). A file added under `scripts/demo/main/` or `feature/` and left out of a `put` list is never committed, and nothing reports it.",
      "fix": "After each side's commits, die if `scripts/demo/<side>/` holds a file not put on that side, e.g. compare `(cd \"$files/$layer\" && find . -type f)` with the paths `put` recorded."
    },
    {
      "severity": "should",
      "rule_id": "vision-1",
      "file": "scripts/demo-repo.sh",
      "line": 52,
      "problem": "`commit_as` splits one `\"Name <email>\"` string with three parameter expansions (`${1% <*}`, `${1#*<}`, `${email%>}`) only to pass name and email to git separately. A reader who does not know Bash has to decode them. Nothing else gets harder.",
      "fix": "Pass name and email as separate arguments: `commit_as \"Maya Lindqvist\" maya@taskboard.example <date> <message>`."
    },
    {
      "severity": "should",
      "rule_id": "vision-2",
      "file": ".vscode/tasks.json",
      "line": 42,
      "problem": "The \"merge: new conflict project\" detail repeats the script header's facts: the seven conflicted paths, \"about 450 lines\" (440 on disk) and where the problems show. The open screenshot fixes #1256/#1257 change board.ts and where the error sits, so a third copy will go stale (header, task detail, map line).",
      "fix": "Keep the detail at the level of the other tasks (\"Taskboard, a TypeScript kanban app mid-merge: 7 conflicts incl. a long file, a binary and a delete; one merge-made TypeScript error and one oxlint warning; see scripts/demo-repo.sh\") and drop the path list and line count."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "scripts/demo-repo.sh",
      "line": 114,
      "problem": "`>/dev/null 2>&1` also drops git's stderr. Both precedent scripts keep it, so a fatal merge error here ends as \"expected 7 conflicted files, got 0\" without git's reason.",
      "fix": "Use `>/dev/null` as `conflict-repo.sh:69` and `lsp-repo.sh` do."
    }
  ],
  "checked": [
    "Ownership: apart from the root-brief deletion, every touched file is in Owned (demo-repo.sh, scripts/demo/**, .vscode/tasks.json, lsp-servers.sh), or is one of the orchestrator's named shared edits (project-map lines 58-60, git-sandbox.sh header lines 1-2).",
    "lsp-servers.sh changes only by addition: install_servers, fill_servers_path and the --path entry are unchanged, so what lsp-repo.sh gets stays the same (brief Target).",
    "demo-repo.sh uses git-sandbox.sh's helpers (die, require_empty_dir, isolate_git_config, repo_git) in the precedent order. It refuses a non-empty dir before installing anything or creating the dir, so a network failure in install_typescript_server leaves no half-built repository.",
    "RK19: commit_as sets GIT_AUTHOR_*/GIT_COMMITTER_*, which override repo_git's `-c user.name/user.email` (git's env precedence). Fixed dates make the commit hashes reproducible. isolate_git_config runs before the first git call.",
    "node_modules is created only after the merge, and base/.gitignore lists it, so `git status` shows no untracked tree (matches the reported status).",
    "The tasks.json yamt command uses the same `PATH=\"$(scripts/lsp-servers.sh --path):$PATH\" just app` form as \"lsp: open in yamt\". The WebStorm task keeps its env and statusbar. The other tasks are unchanged.",
    "The implementer's deviations: the map-check names are added by the orchestrator (map line 59); the git-sandbox.sh header now names demo-repo.sh. Per-side layout (full base/, only changed files in main/ and feature/) accepted: it keeps each side a plain diff and fits the brief's \"plain files … say why\". vite devDependency and vite.config.ts accepted as realism. link_package copy: not accepted, see the first finding.",
    "Open risks accepted: the old /tmp/yamt-conflict-project is used until \"conflict\" is clicked (the brief makes the owner's folder a non-goal); problems show after Apply (the brief allows this if stated, and the header and task detail state it). The screenshot risks belong to the orchestrator's #1255-#1257.",
    "Comments: the demo-repo.sh header states the job, the external fact (files.rs real-path rule) and its source, per CP4. The `$1:` lines on put, commit_as and link_package state positional parameters (CP4). There is no TODO or narration. The demo TS comments are the fictional project's own and read as a real codebase's.",
    "PM1-PM5 do not apply: no Rust crate, frontend module or import edge changes. The demo TS under scripts/ is outside frontend/'s oxlint, oxfmt and vue-tsc projects (the justfile web recipes run in frontend/), so its intended warning cannot fail `just check`.",
    "No docs/plan.md §2 row is contradicted: no product code changed. SLICES.md:777-780 (the board row) matches the delivered tasks and script.",
    "Docs: no README, architecture or verification text says the \"conflict\" button builds conflict-repo.sh's cases (grep over docs/, .omp/skills, README.md), so the switch leaves none of them stale. The verification skill keeps using conflict-repo.sh for automated checks, as the brief wants.",
    "Nothing run: no tests or tools; every finding comes from reading the patch and the files as they now are."
  ]
}
```