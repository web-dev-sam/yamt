# LspDetect (3.Y-detect, board row 9a)

I built detection as the brief describes, with one change you need to decide on: `detect` takes a third argument, `root`. The three new files are `presets.ts`, `detect.ts` and `packageManager.ts` in `lsp/internal/`, each with a node test. All acceptance lines were observed. Two results don't match the brief's wording: `pnpm unused` exits 1 on the three new exports, and in the run against this repository eslint shows up with an install hint.

```
summary
  New exports from frontend/src/lsp/index.ts:
  - detect(paths, lookups, root): the servers this repository's projects use, one spec per tool per project folder, in the order oxfmt, oxlint, TypeScript, eslint.
  - addedSpecs(added, taken): turns servers added by hand into specs (project "", formats true).
  - type ProjectLookups: Pick<ServerHost, "findProgram" | "projectFiles">.
  Internal: PRESETS (the one table of the four servers), packageManager and LOCK_FILES (which package manager the project uses).

files_changed
  frontend/src/lsp/index.ts (exports only)
  frontend/src/lsp/AGENTS.md
  frontend/src/lsp/internal/presets.ts (new)
  frontend/src/lsp/internal/presets.test.ts (new)
  frontend/src/lsp/internal/detect.ts (new)
  frontend/src/lsp/internal/detect.test.ts (new)
  frontend/src/lsp/internal/packageManager.ts (new)
  frontend/src/lsp/internal/packageManager.test.ts (new)

tests_added
  detect.test.ts (fake lookups over an in-memory tree; findProgram looks in node_modules/.bin up to the root, then PATH):
  - "project folders: the nearest package.json walking up, the file's own folder first": nested, root and inner projects; one batched package.json read in walk-up order; projects sorted.
  - "project folders: a file at the root belongs to the root project": also checks oxlint's workspaceUri is file:///repo.
  - "project folders: files with no package.json above them are served by no preset": no program lookups at all.
  - "project folders: a folder named package.json is no project".
  - "project folders: two files in one project check it once": 2 projectFiles calls, one oxlint lookup.
  - "oxlint and oxfmt: found in the project (or above it), formatter first, with their options": full specs.
  - "oxlint and oxfmt: a global install does not count".
  - "TypeScript 7 or later: the project's own tsc in language-server mode".
  - "TypeScript 5 with the native preview installed: tsgo".
  - "TypeScript 6: typescript-language-server from the project or PATH, else an install hint": project and PATH cases.
  - "TypeScript 5.9 without its server: install hint with the version, folder and manager": version 5.9.3, folder frontend, manager pnpm.
  - "TypeScript: the package counts up to the root, jsconfig.json counts as config".
  - "TypeScript: the nearest typescript package decides the version".
  - "TypeScript: not detected without a config, without the package, or with no version": covers malformed JSON, a non-numeric version and a NotText package.json.
  - "eslint: config, package and its server found on PATH or in the project".
  - "eslint: without its server, an install hint for vscode-langservers-extracted".
  - "eslint: not detected without a config or without the package": a TooLarge .eslintrc.yml still counts as a config.
  - "names are unique across projects; a tool in one project keeps its plain name".
  - "package manager: the lock file nearest the project folder, up to the root": every lock file; NotText and TooLarge mean the file exists; a Folder does not.
  - "package manager: the project's field beats a lock file; a malformed package.json has none".
  - "a rejecting lookup means not found": both lookups.
  - "a short answer from projectFiles leaves the rest missing".
  - "addedSpecs: the program's file name, served at the repository root, formatting allowed": "/" and "\" paths.
  - "addedSpecs: a repeated or taken name gets (2), (3) …; an empty command is skipped".
  packageManager.test.ts:
  - every field form (pnpm@12.0.0, yarn@1.22.0, yarn@4.1.0, yarn@2.0.0, npm@10, bun@1.1, pnpm with a +sha suffix);
  - every lock file;
  - a field beats a lock file; an unknown or versionless field falls back to the lock file;
  - neither → null.
  presets.test.ts: the order, the formats flags, every file-type list, oxlint's initializationOptions and eslint's settings, the 12 eslint config names.

smoke_evidence
  - pnpm -C frontend exec vitest run --project node <the 3 new tests>
    → Test Files 3 passed (3), Tests 32 passed (32)
  - Acceptance 2: throwaway /tmp/yamt-detect-run.mts (fs/child_process fake of both lookups, same rules as the Rust host), run with tsx for ["frontend/src/main.ts", "crates/session/src/lib.rs"]. Specs, file types left out:
      oxfmt      oxfmt --lsp   project "frontend"  formats true  install null
      oxlint     oxlint --lsp  project "frontend"  initializationOptions [{"workspaceUri":"file:///home/wds/.omp/wt/t81895756b/m/frontend","options":{"run":"onType"}}]  install null
      TypeScript typescript-language-server --stdio  project "frontend"
                 install {"package":"typescript-language-server","program":"typescript-language-server","folder":"frontend","manager":"pnpm","reason":{"kind":"typescript","version":"5.9.3"}}
      eslint     vscode-eslint-language-server --stdio  project "frontend"  settings {"validate":"on","run":"onType"}
                 install {"package":"vscode-langservers-extracted","program":"vscode-eslint-language-server","folder":"frontend","manager":"pnpm","reason":{"kind":"eslint"}}
      Nothing for crates/session/src/lib.rs. The script was deleted (rm /tmp/yamt-detect-run.mts).
  - pnpm -C frontend lint → "$ oxlint --type-aware && eslint …", exit 0
  - pnpm -C frontend typecheck → "$ vue-tsc -b", exit 0
  - pnpm -C frontend test → Test Files 88 passed (88), Tests 1087 passed (1087), exit 0
  - pnpm -C frontend fmt:check → "All matched files use the correct format.", exit 0
  - pnpm -C frontend unused → exit 1, as the brief expected; no importer was added:
      Unused exports (2): addedSpecs src/lsp/index.ts:14:10, detect src/lsp/index.ts:14:22
      Unused exported types (1): ProjectLookups src/lsp/index.ts:15:15

deviations_from_brief
  - detect has a third parameter, `root: string` (the host context's root). The fixed contract shows two parameters; the brief allowed "take it as a parameter or build it at start". I took the parameter because building the URI at start means editing handshake.ts, which is not mine. The setup slice passes root from host.context().
  - Acceptance 2 expected "eslint only if its server is found". frontend/ has an eslint config and the eslint package, so eslint is detected and gets an install hint. That follows Behaviour 2 and Acceptance 1 ("without its server → install").
  - Two projects using the same tool get "<tool> (<folder>)"; for the root folder the label is "repository root" (my choice).
  - The TypeScript native preview counts as installed when node_modules/@typescript/native-preview/package.json exists in the project or above it. It is read in the same batch, not through findProgram("tsgo").
  - The nearest typescript package decides the version. If its version is unreadable (malformed JSON, not text, no leading number), TypeScript is not detected, since InstallHint.reason needs a version string.
  - An added server with an empty command gives no spec (there is no program to name or start).
  - Configs (tsconfig/jsconfig, eslint configs) are only looked for in the project folder itself; installed packages and lock files are looked for up to the root.
  - The design's `--clientProcessId <pid>` for tsc/tsgo is left out; the brief's commands don't have it.
  - .omp/skills/project-map/SKILL.md (not mine) should list presets.ts, detect.ts and packageManager.ts. scripts/map-check.sh already lists every lsp/internal file as missing.

open_risks
  - frontend/src/lsp/internal/detect.ts:217 (`detect`): the root parameter is outside the fixed contract; Main or the setup slice should accept it.
  - frontend/src/lsp/internal/detect.ts:142 (`typescript`): whether TS 7 installs as node_modules/typescript/package.json is unverified (design §8).
  - frontend/src/lsp/internal/detect.ts:85 (`projectFolders`): it reads one package.json per ancestor folder for every path in a single projectFiles call; a very long conflicted-file list makes this one large batch.
```

Checks for Main: `just map-check` once the project map lists the lsp files, `just check`, and `just mutants` on `lsp/internal/{detect,presets,packageManager}.ts`.