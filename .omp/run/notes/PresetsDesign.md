# Design 3.Y-presets: language-server presets for more languages

## Read this first

**1. Phpactor can already run phpcs.** The brief says Phpactor's tool integrations are PHPStan, Psalm, PHP-CS-Fixer and Mago, but not phpcs. That is out of date:
- Phpactor's configuration reference has a `PhpCodeSnifferExtension` with `php_code_sniffer.enabled` (default false) and `php_code_sniffer.bin` (default `%project_root%/vendor/bin/phpcs`) — https://raw.githubusercontent.com/phpactor/phpactor/master/doc/reference/configuration.rst (lines 1716–1776).
- Its integration page says Phpactor uses PHP_CodeSniffer to "format your code via the LSP `textDocument/formatting` action" and to "provide diagnostics" — https://raw.githubusercontent.com/phpactor/phpactor/master/doc/integrations/phpcs.rst.

The owner's answer #994 ("leave phpcs out; Phpactor shows PHPStan, Psalm and PHP-CS-Fixer through its own integrations") was based on the old belief. With this fact, phpcs fits the owner's own rule ("Phpactor's own integrations") at no extra cost. The design below turns it on the same way as the other three. If #994 stands as written, drop one line from the Phpactor table. Open question 1 asks this.

**2. Two facts about this machine.** I looked at the folders; I ran nothing.
- `~/.cargo/bin/rust-analyzer` is only rustup's proxy. No toolchain under `~/.rustup/toolchains/*/bin/` has the rust-analyzer component (the only components are rustfmt and clippy, `rust-toolchain.toml`). So yamt would find the program and start it, and it would stop at once.
- `~/go/bin/gopls` exists, but that folder is not on yamt's PATH. That is why the brief says "no gopls".

---

## options

Every option uses the same preset list (table P below) and the same Settings picker. They differ in three ways: who owns the bin-folder list, where the "which folder is the project" rule lives, and how Vue gets problems.

### Data shared by every option: preset table P

**How a tool counts as used** (one rule for all):
- If the project shows it uses the tool (a config file, a config section, or the language's manifest), the server counts wherever it is: in the project or on PATH.
- If the only sign is the program inside the project, then only that copy counts.

This is how eslint works today, and it is the board's acceptance rule.

**Cut-off rule for "popular options":**
- The language is in GitHub's top 10 (Python, JS, TS, Java, C#, C++, PHP, Shell, C, Go — https://github.blog/news-insights/octoverse/octoverse-2024), or the owner named it (Rust, Vue).
- Its main server speaks plain stdio LSP and gives problems without editor-specific glue.
- The repository has a cheap sign that it is used.

| # | Preset (spec order: formatters first) | Command | Sign that the project uses it (where its project folder is) | File types | Formats | settings / initializationOptions | Push or pull | Extra server requests | Source |
|---|---|---|---|---|---|---|---|---|---|
| 1 | oxfmt | `oxfmt --lsp` | program in the project (unchanged) | unchanged | yes | – | – | – | plan #70 |
| 2 | **Biome** | `biome lsp-proxy` | program `biome` in the project's `node_modules/.bin` (`package.json`) | js jsx mjs cjs ts tsx mts cts json jsonc css graphql | yes | none | push (publishDiagnostics; no `textDocument/diagnostic` listed) | registerCapability ✓ | https://biomejs.dev/reference/language-server/ ; `lsp-proxy` "ensures the daemon is running" https://biomejs.dev/reference/cli/ ; the proxy starts the daemon with `ensure_daemon(true)` → `--stop-on-disconnect` (daemon.rs ~L162, service/unix.rs ~L191 in biomejs/biome), so a daemon yamt started exits with yamt |
| 3 | oxlint, TypeScript, eslint | unchanged; TypeScript gains Vue (option-dependent, below) | | | | | | | plan #70 |
| 4 | **rust-analyzer** | `rust-analyzer` | `Cargo.toml` (project = nearest `Cargo.toml` containing a `[workspace]` line, else nearest `Cargo.toml`: one server per workspace) | rs | yes (rustfmt; `document_formatting_provider: true`, capabilities.rs L83) | init `{checkOnSave:false}`, settings `{"rust-analyzer":{checkOnSave:false}}` | **pull** for its own diagnostics (`diagnostic_provider`, capabilities.rs L167); push for `cargo check` (turned off) | refreshes / progress / registerCapability ✓ | configuration_generated.md (`checkOnSave` default true: "Run the check command for diagnostics on save"); main_loop.rs L401–410, L530–540 (it also runs `cargo check` once after loading); install `rustup component add rust-analyzer` https://rust-analyzer.github.io/book/rust_analyzer_binary.html |
| 5 | **gopls** | `gopls` | `go.work` (nearest), else `go.mod` (nearest) | go | yes (gofmt) | none (section `gopls`) | push [INFERENCE]; diagnostics on edit by default (`diagnosticsTrigger: "Edit"`) | progress ✓ | https://raw.githubusercontent.com/golang/tools/master/gopls/doc/settings.md ; workspace.md ; index.md (`go install golang.org/x/tools/gopls@latest`; needs `go` on PATH); `cmd = { 'gopls' }` in nvim-lspconfig `lsp/gopls.lua` |
| 6 | **ruff** | `ruff server` | `ruff.toml`, `.ruff.toml`, a `[tool.ruff…` line in `pyproject.toml`, or the program in the project's venv (project = nearest `pyproject.toml`/`setup.py`/`setup.cfg`/`requirements.txt`) | py pyi | yes (offered statically because yamt sends `dynamicRegistration:false`, ruff_server/src/server.rs L164–182) | none | **pull** (`diagnostic_provider`, server.rs L218) | – | https://docs.astral.sh/ruff/editors/ ; https://docs.astral.sh/ruff/configuration/ |
| 7 | **ty** | `ty server` | `ty.toml`, `[tool.ty…`, or the program in the venv | py pyi | no | none | [INFERENCE] pull | – | https://docs.astral.sh/ty/editors/ ; finds `.venv` in the project root itself https://docs.astral.sh/ty/modules/ |
| 8 | **basedpyright** | `basedpyright-langserver --stdio` | `[tool.basedpyright…`, or the program in the venv | py pyi | no | none (uses `.venv` in the project root by default) | [INFERENCE] push | registerCapability ✓ | nvim-lspconfig `lsp/basedpyright.lua`; https://docs.basedpyright.com/v1.40.0/usage/import-resolution |
| 9 | **pyright** | `pyright-langserver --stdio` | `pyrightconfig.json` or `[tool.pyright…` | py pyi | no | `{python:{pythonPath:<the project venv's python>}}` when one is found (else pyright uses the `python` on PATH) | [INFERENCE] push | ✓ | https://raw.githubusercontent.com/microsoft/pyright/main/docs/import-resolution.md (environment order, lines 74–80); nvim `lsp/pyright.lua` |
| 10 | **Phpactor** (PHP: first found of 10 and 11) | `phpactor language-server` | `composer.json` (nearest) | php | only when its php-cs-fixer or phpcs integration is on | init: `language_server_phpstan.enabled`, `language_server_psalm.enabled`, `language_server_php_cs_fixer.enabled`, `php_code_sniffer.enabled` — each true only when the project has `vendor/bin/<tool>` and that tool's config (`phpstan.neon`/`.neon.dist`/`.dist.neon`; `psalm.xml(.dist)` [INFERENCE]; `.php-cs-fixer(.dist).php` [INFERENCE]; `.phpcs.xml`/`phpcs.xml`/`.phpcs.xml.dist`/`phpcs.xml.dist`) | [INFERENCE] push; `diagnostics_on_update` default true | `window/showMessageRequest` (trust prompt, `enable_trust_check` default true) → answered null, which today's table already does | `cmd` in nvim `lsp/phpactor.lua`; init_options "maps directly to Phpactor's configuration" (doc/lsp/vim.rst L38); configuration.rst; PHPStan checks a temp copy of the text (https://phpactor.readthedocs.io/en/master/integrations/phpstan.html); needs PHP 8.2, installed as a PHAR (doc/usage/standalone.rst) |
| 11 | **Intelephense** | `intelephense --stdio` | `composer.json` | php | **no** (its own style, not the project's) | none | [INFERENCE] push | ✓ | https://intelephense.com/docs ; nvim `intelephense.lua`; closed-source, free core (https://intelephense.com/eula) |
| 12 | **clangd** | `clangd` | `compile_commands.json`, `build/compile_commands.json`, `compile_flags.txt` or `.clangd` up the folder chain | c h cc cpp cxx hh hpp hxx | only with a `.clang-format`/`_clang-format` up the chain (otherwise it would restyle the code to LLVM's style) | none | [INFERENCE] push | – | https://clangd.llvm.org/installation ; nvim `lsp/clangd.lua` |
| 13 | Deno *(Settings list only)* | `deno lsp` | – | js jsx ts tsx mjs mts | yes | init `{enable:true,lint:true}`, settings `{deno:{enable:true,lint:true}}` | [INFERENCE] push | notification `deno/registryState` → logged | https://docs.deno.com/runtime/reference/lsp_integration/ |
| 14 | bash-language-server *(Settings list only: no repository sign)* | `bash-language-server start` | – | sh bash | via shfmt if installed | none | – | – | https://raw.githubusercontent.com/bash-lsp/bash-language-server/main/README.md (needs shellcheck for linting) |

**Not answered by today's table:** only Deno's `deno/registryState` and Vue's `tsserver/request` (option C). Both are logged and dropped. So `answers.ts` does not change in any option.

**Left out, with reasons:**
- Java (jdtls needs a JDK 21, a `-data` folder outside the project and launcher arguments [INFERENCE]).
- C# (Roslyn's server needs a custom `solution/open` notification [INFERENCE]).
- Ruby (not in the top 10; ruby-lsp writes `.ruby-lsp/` into the project [INFERENCE]).
- Prettier and mypy (no language server).
- phpcs on its own (no server; it comes through Phpactor).

**`didSave`:** yamt keeps sending none (#70).
- rust-analyzer's `cargo check` reads the disk. During a merge the disk holds git's markers in every conflicted file, including the waiting conflicts that Save writes back as markers (#69).
- So its problems would point at disk line numbers, and yamt would draw them on the Result's different lines. Its own diagnostics, pulled as you type, read the text yamt sends, so `checkOnSave:false` it is.
- Cost: no borrow-checker or rustc-only errors. Open question 5 asks the owner.

**Overlaps:**
- Biome with oxlint/eslint, if a project configures more than one.
- ruff F401 with pyright/basedpyright unused-import hints.
- Phpactor with Intelephense — avoided by "first found".

When two formatters serve one file type, table order decides: oxfmt beats Biome for js/ts. No other file type has two.

### Data shared by every option: the Settings picker (owner #995: yes)

**Where the list comes from:**
- `lsp/index.ts` exports `presetChoices(): readonly PresetChoice[]`, built from `PRESETS`. There is no second list (vision 2).
- `PresetChoice = { name: string; command: readonly [string, ...string[]]; fileTypes: readonly string[] }`.
- `command` is the preset's own server command, e.g. `typescript-language-server --stdio` for TypeScript and `ruff server` for ruff.

**What is stored:**
- The settings file keeps `AddedServer { command, fileTypes }` unchanged: no Rust change, no bindings change, nothing to migrate.

**How the extras survive:**
- `addedSpecs` matches each added server to a preset: the program's file name (without the folder and without `.exe`/`.cmd`/`.bat`) plus exactly the same arguments.
- A match gets the preset's name, `settings`, `initializationOptions` (built for the repository root) and its formats rule. Formats is "yes" unless the preset's rule is "never": the user chose the tool on purpose.
- A hand-typed `ruff server` therefore behaves like the picked one ("derive, don't sync", vision 2).
- Rejected: storing `preset: "ruff"` in the file. It is a second copy of a fact, it goes stale when a preset is renamed, and it means a Rust settings change plus bindings.

**Where programs are looked for:**
- A hand-added server is searched for in every ecosystem's bin folders, then PATH. So `ruff server` finds `.venv/bin/ruff`, and the smoke script's `.venv/bin/ruff` workaround goes away.

**Files:**
- `ui/LanguageServerSettings.vue`: a "From the list" select above Command / File types; picking fills both fields, still editable; the picker logic stays inline.
- The `addedSpecs(added, taken, root)` signature change in `ui/serverSetup.ts`.

### Option A — one ecosystem table; the window gives the bin folders; Vue through the TypeScript plugin (recommended)

**Data structures** (`lsp/internal/`):

```ts
// ecosystems.ts (new): the one place that knows each language's project and bin folders
type ProjectRule = { readonly manifests: readonly string[]; readonly holding: RegExp | null };
type Ecosystem = "node" | "python" | "rust" | "go" | "php" | "clang";
const ECOSYSTEMS: Readonly<Record<Ecosystem, {
  readonly rules: readonly ProjectRule[];   // tried in order; each = nearest folder up to the root holding one of the manifests (whose text matches `holding`)
  readonly bins: readonly string[];         // node_modules/.bin | .venv/bin .venv/Scripts venv/bin venv/Scripts | vendor/bin | rust/go/clang: []
}>>;
// rust: [{["Cargo.toml"], /^\[workspace[\].]/m}, {["Cargo.toml"], null}]; go: [{["go.work"]}, {["go.mod"]}]

// presets.ts
type Signal = { kind: "file"; name: string } | { kind: "section"; file: string; line: RegExp } | { kind: "package"; name: string } | { kind: "program" };
type Server = { readonly command: Command; readonly recipe: InstallRecipe };
type Look =
  | { kind: "used"; signals: readonly Signal[]; server: Server }          // [] = the ecosystem's manifest alone; [program] = today's projectProgram (removed)
  | { kind: "firstFound"; servers: readonly [Server, ...Server[]] }       // PHP: Phpactor, then Intelephense
  | { kind: "typescript"; …today…; vue: { package: "vue"; plugin: "@vue/typescript-plugin" } }
  | { kind: "eslint"; …today… };
type Formats = { kind: "always" } | { kind: "never" } | { kind: "withConfig"; files: readonly string[] };
type PresetContext = { readonly workspaceUri: string; readonly folderPath: string; readonly programs: ReadonlyMap<string, string>; readonly files: Files };
type Preset = { name; ecosystem: Ecosystem; look: Look; fileTypes; formats: Formats;
  settings: (at: PresetContext) => unknown; initializationOptions: ((at: PresetContext) => unknown) | null };

// spec.ts: InstallHint as a sum type (vision 4)
type InstallHint =
  | { kind: "node"; package; program; folder; manager: PackageManager | null; reason: { kind: "typescript"; version } | { kind: "eslint" } | { kind: "vue" } | { kind: "server" } }
  | { kind: "python"; package; program; folder; manager: "uv" | "poetry" | "pdm" | null }  // uv.lock / poetry.lock / pdm.lock
  | { kind: "rustup"; component: "rust-analyzer" }
  | { kind: "go"; module: string; program }                                                 // golang.org/x/tools/gopls@latest
  | { kind: "download"; program; url: string; needs: string | null };                       // Phpactor PHAR (PHP 8.2), clangd
type ServerSpec = { …today…; bins: readonly string[]; install: InstallHint | null; help: InstallHint | null }; // help only if open question 4 is yes
```

**Detection:**
- One pure `detect`. Pass 1: one `projectFiles` batch over every ecosystem's manifests along every conflicted path's folder chain.
- Then, per (ecosystem, folder) pair, one candidates batch: configs, sections, lock files, `node_modules/*/package.json`. Then `findProgram(program, folder, ecosystem.bins)`.
- Specs are sorted by folder, then table order. The "(frontend)" names work as today.
- Vision 2: one walking function, two tables.

**Vue (V1):**
- When the project's TypeScript is 5.x/6.x and `node_modules/vue` and `node_modules/@vue/typescript-plugin` are found up the chain, the TypeScript spec adds `vue` to its file types and sends `initializationOptions: { plugins: [{ name: "@vue/typescript-plugin", location: <absolute project folder>, languages: ["vue"] }] }`.
- Why the project folder works: `location` is "a directory in which tsserver will try to import the plugin `name` using Node's require" (https://raw.githubusercontent.com/typescript-language-server/typescript-language-server/master/docs/configuration.md); the setup is from https://raw.githubusercontent.com/wiki/vuejs/language-tools/Neovim.md.
- One tsserver serves both `.ts` and `.vue`. A separate Vue-only server would leave `.ts` files reporting "Cannot find module './App.vue'".
- `vue` present but the plugin missing → a never-started "Vue (not installed)" spec with the hint `pnpm add -D @vue/typescript-plugin`. After the install and coming back to the window, it disappears and TypeScript restarts with `.vue`.

**Rust host:**
- `ServerCommand.bins: Vec<String>` and `find_program(program, project, bins)`: the given folders in the project and each parent up to the root, in order, then PATH.
- `node_modules/.bin` leaves Rust. Rust still learns no server name and now no ecosystem either (vision 2/3).

**Vision:** 2 (one table per fact), 4 (sum types), 1 (one walking path to read).

**Cost:**
- An IPC signature change that touches about 20 files, mostly one-line test fixtures.
- One new idea for the reader: the ecosystem.
- No relay; `.vue` template-syntax and CSS problems are not shown (only type problems in script and template [INFERENCE]).

### Option B — Rust keeps a fixed bin list; each preset carries its project rule; Vue as in A

- `program.rs` `folders` searches `node_modules/.bin`, `.venv/bin`, `.venv/Scripts`, `venv/bin`, `venv/Scripts`, `vendor/bin` in every folder up to the root. No IPC change, no `bins` field.
- `Preset` carries `project: readonly ProjectRule[]` itself (python's rule written once as a constant and shared by ruff/ty/basedpyright/pyright).
- **Vision:** 5 (smallest change).
- **Cost:**
  - Ecosystem facts split across two languages: Rust knows `.venv`/`vendor`, TS knows the projects and install hints. A future ecosystem means a Rust change.
  - An `oxlint` inside `.venv/bin` would count as "the project's".
  - Hand-added servers get the same fixed list.
  - Saves about 15 fixture edits and one bindings regeneration.

### Option C — A plus Vue's own server with a relay (client change)

- Adds a "Vue" preset `vue-language-server --stdio` (npm `@vue/language-server`; https://raw.githubusercontent.com/vuejs/language-tools/master/packages/language-server/README.md) and a relay in `lsp/`:
  - Vue's notification `tsserver/request` `[[id, command, payload]]` is routed in `attempt.ts #notified` to a new `relay.ts`.
  - `relay.ts` finds the running TypeScript server of the same project and sends it `workspace/executeCommand {command: "typescript.tsserverRequest", arguments: [command, payload]}` (documented in typescript-language-server's README).
  - The answer `.body` goes back to Vue's server as the notification `tsserver/response` `[[id, body]]`, with `null` on error or no answer (https://raw.githubusercontent.com/neovim/nvim-lspconfig/master/lsp/vue_ls.lua).
- `ServerSpec.relayTo: string | null`; a valibot schema in `protocol.ts`; cross-server lookup in `index.ts`.
- **What it adds:** Vue's own template-compiler and CSS problems [INFERENCE].
- **Cost:**
  - About 6 files and ~450 lines including tests.
  - A second process per Vue project.
  - The owner must follow one message through five hops (Vue server → attempt → relay → TS server's connection → back to Vue).
- **Vision:** 1 suffers, for a gain the owner did not ask for.

**TypeScript 7 / `tsgo` in every option:**
- TS 7 has "no programmatic API or plugin mechanism" and "no tsserver at all". Vue's packages "still require the TypeScript 6 JS API" (maintainer, https://github.com/vuejs/language-tools/issues/5381). Microsoft: "Projects using Vue … will need to continue using TypeScript 6.0" (quoted in the same issue from the TS 7.0 announcement).
- So in a TS ≥ 7 project, `tsc --lsp` serves `.ts` only and `.vue` files get no type problems in any option. oxlint and eslint still lint `.vue`. Option C's relay has nothing to relay to.
- Whether to say so in the chrome is open question 6.

## recommendation

**Option A.**

**What it costs:**
- An IPC change (`bins` on `ServerCommand`, `findProgram`) touching about 20 files, most of them fixture one-liners.
- One more idea in detection (the ecosystem).
- Rust problems without `cargo check`.
- Vue: type problems only (no template-syntax/CSS problems; option C can be added later as its own slice); none at all in TS 7 projects.
- PHP: one server per project.

**Decision rows to record (DR5: for the orchestrator):**
1. **Presets beyond JS/TS:** table P, with its cut-off rule (vision 2, 5).
2. **Projects per ecosystem, bin folders given by the window:** `ECOSYSTEMS`; Rust searches the folders a command names, then PATH. Rejected: Rust's fixed list (option B: ecosystem facts in two languages) and one detector per language (copied walking code) (vision 2, 3).
3. **rust-analyzer runs without `cargo check`; yamt still sends no `didSave`.** Rejected: `didSave` after yamt's write (the check reads files with markers and its lines do not match the Result) (vision 2, 1).
4. **Vue through `@vue/typescript-plugin` in the project's TypeScript 5/6 server.** Rejected: Vue's server with a relay (option C: a second process, five hops to read); a separate Vue-only tsserver (false "cannot find module" in `.ts` files) (vision 1, 5).
5. **PHP: one server per project, Phpactor first, else Intelephense;** Phpactor's PHPStan, Psalm, PHP-CS-Fixer and phpcs integrations are on when the project has the tool in `vendor/bin` plus its config (vision 1, 2).
6. **Only a tool the project uses formats:** Intelephense never; clangd only with `.clang-format`; rust-analyzer and gopls always (rustfmt/gofmt are those languages' standard formatters) (vision 1).
7. **The Settings picker lists `PRESETS`;** the file keeps `AddedServer`; extras come back by matching program and arguments (vision 2).

**Install texts** (`ui/serverText.ts`, one `steps: readonly InstallStep[]` list per hint kind):

| Hint kind | In the project | For all projects | Extra lines |
|---|---|---|---|
| node | today's commands | today's commands | – |
| python, `uv` | `uv add --dev <pkg>` (https://docs.astral.sh/uv/concepts/projects/dependencies/) | `uv tool install <pkg>` [INFERENCE] | – |
| python, `poetry` | `poetry add --group dev <pkg>` (https://python-poetry.org/docs/cli/) | `pipx install <pkg>` | – |
| python, `pdm` | `pdm add -d <pkg>` [INFERENCE] | `pipx install <pkg>` | – |
| python, none | `python -m pip install <pkg>` in the project's venv | `pipx install <pkg>` | – |
| rustup | – | `rustup component add rust-analyzer` | – |
| go | – | `go install golang.org/x/tools/gopls@latest` | "It goes to `$(go env GOPATH)/bin` (usually `~/go/bin`); that folder must be on the PATH yamt starts with." |
| download (Phpactor) | – | `curl -Lo ~/.local/bin/phpactor https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar && chmod a+x ~/.local/bin/phpactor` | "Needs PHP 8.2." |
| download (clangd) | – | "Install clangd with your system's package manager" | – |

Every hint keeps the PATH line and the come-back line.

### Builds: disjoint ownership lists and the contract between them

**Wave 1, two builds in parallel**

**H — Rust host and IPC: bin folders** (about 22 files, ~350 lines, mostly fixtures). Owns:
- `crates/lsp-host/src/lib.rs`, `src/program.rs` (`BIN_FOLDER` removed; each `bins` entry checked to be plain path segments, like `files::in_repository`; unit tests), `tests/run.rs`, `crates/lsp-host/AGENTS.md`
- `src-tauri/src/servers.rs`
- `frontend/src/ipc/bindings.ts` (via `just bindings`), `ipc/domain.ts`, `ipc/ServerHost.ts`, `ipc/tauri.ts`, `ipc/tauri.test.ts`
- `lsp/internal/spec.ts` (the `bins` field only), `lsp/internal/server.ts` (passes `spec.bins`), `lsp/internal/detect.ts` and `lsp/internal/added.ts` (only `NODE_BINS = ["node_modules/.bin"]` passed and set)
- spec literals in `lsp/index.test.ts`, `lsp/internal/{attempt,detect,added,spec}.test.ts`, `ui/{serverSetup,servers,question,serverText}.test.ts`
- `docs/architecture.md` §3.5 and `.omp/skills/ipc-contract/SKILL.md`

Contract:
```rust
pub struct ServerCommand { pub program: String, pub args: Vec<String>, pub project: String,
    /// project-relative folders ("/" separators, plain names) searched in `project`, then each parent up to the root, in this order, before PATH
    pub bins: Vec<String> }
pub fn find_program(&self, program: &str, project: &str, bins: &[String]) -> ProgramFound // place Project for a bins hit
```
```ts
findProgram(program: string, project: string, bins: readonly string[]): Promise<ProgramFound>;
ServerSpec.bins: readonly string[];
```

**D — smoke repository and server installer** (about 4 files, ~450 lines). Owns:
- `scripts/lsp-repo.sh`, grown with projects:
  - `web/`: the existing project, plus a conflicted `.vue` file and `@vue/typescript-plugin`
  - `biome/`
  - `py/`: `pyproject.toml` with `[tool.ruff]` and `[tool.basedpyright]`, `.venv`
  - `rs/`: a 2-crate workspace
  - `go/`: `go.mod`
  - `php/`: `composer.json`
  - `c/`: `compile_commands.json` + `.clang-format`
  - each with one conflicted file, one seeded problem outside the conflict and one badly formatted line
  - drops the hand-added ruff
- New `scripts/lsp-servers.sh`: pinned installs into `~/.cache/yamt/<tool>-<version>`, then linked into each project's bin folder or a `servers-path/` folder to put first on PATH
- `.vscode/tasks.json` if its arguments change
- `.omp/skills/project-map/SKILL.md` (the scripts line)

**Wave 2, after H and D land**

**B1 — detection core** (about 14 files, ~1,400 lines including tests). Owns:
- `lsp/internal/ecosystems.ts` (new) with `ecosystems.test.ts`
- `lsp/internal/presets.ts`, `detect.ts`, `packageManager.ts` (adds the Python lock files), `spec.ts` (the `InstallHint` sum, `help`), `languageIds.ts` (php, pyi, c, h, cc, cpp, cxx, hh, hpp, hxx, bash), `added.ts` (preset match; bins = every ecosystem's bins, de-duplicated)
- `lsp/index.ts` (`presetChoices`, `PresetChoice`, the new types; `addedSpecs(added, taken, root)`)
- their tests
- `ui/serverSetup.ts` and `serverSetup.test.ts` (the `root` argument only)
- `lsp/AGENTS.md`, `docs/architecture.md` §5.3b, `.omp/skills/project-map/SKILL.md` (lsp line)
- Every row of table P except the Vue branch, Phpactor's integration flags and pyright's `pythonPath` (those are B2's).

Contract for C:
```ts
export type InstallHint = /* the union above, exactly */;
export type PresetChoice = { readonly name: string; readonly command: readonly [string, ...string[]]; readonly fileTypes: readonly string[] };
export function presetChoices(): readonly PresetChoice[];
// ServerSpec.help: InstallHint | null — the hint of a found preset server, for a server that stops at start (only if open question 4 = yes)
```

**Wave 3, in parallel**

**B2 — Vue, Phpactor integrations, pyright's venv** (about 4 files, ~500 lines). Owns `lsp/internal/presets.ts`, `detect.ts` (TypeScript Vue branch; `PresetContext.programs` and `files`) and their tests. No new export; touches no doc outside `lsp/AGENTS.md`.

**C — chrome texts and the picker** (about 7 files, ~450 lines). Owns:
- `ui/serverText.ts` and `serverText.test.ts`: every hint kind; the `vue` reason "This project uses Vue; its files need the package @vue/typescript-plugin in this project."
- `ui/ServerMenu.vue`: a variable number of steps, the `needs` line, the `help` hint under Stopped/failed if question 4 = yes
- `ui/LanguageServerSettings.vue`: the picker
- `docs/architecture.md` §5.4, `CHANGELOG.md`, `.readmer/readme.json` and `README.md` (regenerated)

**Option C later:** V-relay — `lsp/internal/relay.ts` (new), `attempt.ts`, `protocol.ts`, `index.ts`, `presets.ts` (Vue row), tests; about 6 files, ~450 lines; after B2.

**Checks for the main agent after all builds land:** `just check`, `just bindings-check`, `just map-check`, `pnpm -C frontend test`, then the real-app check below.

### Real-app check on this machine (D's script, throwaway folders)

| Language | Install into a throwaway folder | What can be shown |
|---|---|---|
| TS/JS, Vue, Biome | npm `--prefix ~/.cache/yamt/…` (typescript-language-server 6.0.2 as today; `@vue/typescript-plugin` and `vue` into `web/node_modules`; `@biomejs/biome`) | everything; plus TS 7 in a second project: `.ts` problems only, nothing in `.vue`. Check after closing yamt that no `biome __run_server` is left |
| Rust | the release binary `rust-analyzer-x86_64-unknown-linux-gnu.gz` into a cache folder put **first** on PATH (not `rustup component add`, which changes the user's toolchain) | problems as you type, rustfmt on Save; **and**, with the default PATH, the rustup proxy's stop at start (log line; the `help` hint if question 4 = yes) |
| Go | `GOBIN=~/.cache/yamt/gopls-<v> go install golang.org/x/tools/gopls@<v>`, or the existing `~/go/bin` on PATH | problems, gofmt; with the default PATH: "gopls (not installed)" and the PATH note |
| Python | `uv venv py/.venv && uv pip install ruff ty basedpyright` | ruff (lint and format), ty and basedpyright as project programs. pyright via npm prefix + PATH (its pip wrapper may download at first start [INFERENCE]) |
| PHP | Intelephense via npm prefix (a Node program, no PHP needed) | Intelephense problems; Phpactor only as "not installed" with its hint. Its integrations (PHPStan, Psalm, php-cs-fixer, phpcs) and formatting **cannot be shown without PHP**, unless the orchestrator accepts downloading a static PHP binary plus `composer.phar` into a throwaway folder [INFERENCE that such builds run here] |
| C/C++ | clangd is installed | problems; clang-format with `.clang-format` present; no formatting without it |
| Picker | – | pick "ruff" / "bash-language-server" → fields filled; Add; it runs (bash-language-server via npm; shellcheck may be missing [INFERENCE]) |

Leftovers after closing yamt: `pgrep -af` for every command in table P, `biome __run_server` included.

## open_questions

1. **phpcs (new fact, reopens #994's premise).** Phpactor can run phpcs itself (problems, plus formatting via phpcbf) exactly like PHPStan. Should yamt turn it on when the project has `vendor/bin/phpcs` and a phpcs config, at no extra cost, though you answered "leave phpcs out" when we believed Phpactor could not? If not, phpcs projects get Phpactor without phpcs underlines.
2. **PHP with both servers installed.** Run only the first found (Phpactor, else Intelephense), or both? Running both underlines many problems twice. The other can still be added from the Settings list.
3. **Standard install folders.** Should yamt also look in `~/go/bin`, `~/.cargo/bin`, `~/.local/bin` (pipx, uv tool, the Phpactor PHAR) and Composer's global bin after PATH? Without it, a desktop-launched yamt shows "gopls (not installed)" on this very machine although gopls is in `~/go/bin`. Cost: a fixed list in Rust and a longer "looked in" line.
4. **A found server that stops at start.** For example rustup's `rust-analyzer` stub without the component, as on this machine. Should its menu show the install commands under "Stopped: exited with code 1"? Without it, the user only sees rustup's message in the log.
5. **Rust problems.** As you type, without `cargo check` (no borrow-checker or rustc-only errors), or `cargo check` after each Save? The check reads the files on disk, which during a merge contain git's markers, so its problems would land on the wrong lines of the Result.
6. **Vue in TypeScript 7 projects.** Show a line "Vue files get no type problems: TypeScript 7 runs no plugins (Vue needs TypeScript 6)" in the TypeScript menu, or nothing?