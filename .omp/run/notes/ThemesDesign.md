# 3.TH design: ten themes in the editors' own colours

I recommend **Option A**. Every colour lives in CSS, one file per editor theme. One TypeScript table holds each theme's kind and Settings words. An extended palette check proves the names, the CSS blocks and the native backgrounds match. Nothing was run or changed (read-only design). Sources: the brief, the request, all six notes (including `ThemeColoursAtomUi.md` and your `#526fff` correction), the tree at `17849b0`, and the installed `@lezer/javascript` 1.5.6, `@lezer/highlight` 1.2.5 and `tauri-specta` rc.25.

## Fixed contract (shared by every option; the builds rely on it)

### C1. Theme names

These are the settings-file values, and they also go into the page's `data-theme`.

| group | dark | light | Rust variant (`#[serde(rename_all = "kebab-case")]`) | button words |
|---|---|---|---|---|
| yamt | `dark` | `light` | `Dark` (default), `Light` | Dark / Light |
| WebStorm | `webstorm-dark` | `webstorm-light` | `WebstormDark`, `WebstormLight` | Islands Dark / Islands Light |
| VS Code | `vscode-dark` | `vscode-light` | `VscodeDark`, `VscodeLight` | Dark 2026 / Light 2026 |
| Zed | `zed-dark` | `zed-light` | `ZedDark`, `ZedLight` | One Dark / One Light |
| Atom | `atom-dark` | `atom-light` | `AtomDark`, `AtomLight` | One Dark / One Light |

- `dark` and `light` keep their spelling, so a file holding either still opens as today (rule 1).
- Native backgrounds equal each theme's `--color-window`. In `window.rs` they are constants `BACKGROUND_<NAME>`, upper snake case:

  | theme | background |
  |---|---|
  | dark | `#27252e` |
  | light | `#e9eaee` |
  | webstorm-dark | `#26282c` |
  | webstorm-light | `#e9eaee` |
  | vscode-dark | `#191a1b` |
  | vscode-light | `#fafafd` |
  | zed-dark | `#3b414d` |
  | zed-light | `#dcdcdd` |
  | atom-dark | `#21252b` |
  | atom-light | `#eaeaeb` |

### C2. Tokens every theme block defines

**Today's 57 colour tokens**, plus five new ones:
- `--color-sidebar`: the file list and the compare tab list. VS Code, Zed and Atom paint their side bar unlike the editor. In yamt's and WebStorm's themes it equals `--color-panel`.
- `--color-panel-border`: the line around a flat panel. In island themes it is the panel colour, which is WebStorm's own `Island.borderColor`.
- `--color-on-problem`, `--color-on-info`, `--color-on-success`: banner text. Atom's banners are pastel with dark text, so `text-fg` would be unreadable on them. In the other themes these equal `--color-fg`.

**Shape:**
- `--radius-island`: 10px for the island themes, 0px for flat ones.
- `--island-line`: 0px for island themes, 1px for flat ones.
- `--spacing-island` stays only in `@theme`, 5px for every theme, so the layout never moves.

**Syntax (39 colour tokens).** All are `--color-syntax-<token>`; the yamt column is what that tag gets today, so yamt Dark and Light look the same.

| token | Lezer tags | yamt value = today's |
|---|---|---|
| `keyword` | `keyword`, `modifier`, `operatorKeyword` | keyword |
| `control-keyword` | `controlKeyword`, `moduleKeyword` | keyword |
| `definition-keyword` | `definitionKeyword` | keyword |
| `bool` | `bool` | keyword |
| `null` | `null` | keyword |
| `self` | `self`, `atom` | keyword |
| `string` | `string`, `special(string)`, `attributeValue` | string |
| `character` | `character` | string |
| `number` | `number` | number |
| `unit` | `unit` | keyword |
| `colour-literal` | `color` | code |
| `regexp` | `regexp` | regexp |
| `escape` | `escape` | keyword |
| `comment` | `comment` | comment |
| `variable` | `variableName` | code |
| `variable-definition` | `definition(variableName)` | code |
| `function` | `function(variableName)`, `function(definition(variableName))` | function |
| `method` | `function(propertyName)` | function |
| `property` | `propertyName`, `special(propertyName)`, `constant(variableName)` | property |
| `property-definition` | `definition(propertyName)` | property |
| `type` | `typeName`, `definition(typeName)`, `className`, `definition(className)`, `namespace` | code |
| `operator` | `operator` and its kinds, except `derefOperator` | code |
| `arrow` | `function(punctuation)` | code |
| `punctuation` | `punctuation`, `separator`, `bracket`, `paren`, `brace`, `squareBracket`, `derefOperator` | code |
| `interpolation` | `special(brace)` | code |
| `decorator` | `meta` | decorator |
| `markup-mark` | `processingInstruction` | decorator |
| `tag` | `tagName`, `standard(tagName)` | tag |
| `angle-bracket` | `angleBracket` | tag |
| `attribute` | `attributeName` | code |
| `heading` | `heading` | code |
| `emphasis` | `emphasis` | code |
| `strong` | `strong` | code |
| `strikethrough` | `strikethrough` | code |
| `quote` | `quote` | code |
| `content-separator` | `contentSeparator` | code |
| `monospace` | `monospace` | code |
| `link` | `link` | link |
| `url` | `url` | link |

**Font styles (14 variables).** Each value is set in every theme block:
- `--syntax-comment-style`, `--syntax-heading-weight`, `--syntax-heading-style`, `--syntax-emphasis-style`, `--syntax-strong-weight`, `--syntax-strikethrough-line`
- `--syntax-link-line`, `--syntax-link-style`, `--syntax-url-line`, `--syntax-url-style`, `--syntax-function-style`, `--syntax-quote-style`, `--syntax-content-separator-weight`, `--syntax-content-separator-style`

Allowed values: `-style` is normal | italic; `-weight` is normal | bold; `-line` is none | underline | line-through. yamt keeps today's look: heading and strong bold, emphasis italic, strikethrough line-through, everything else normal or none.

### C3. Format and utilities

- **Block format:** one block per file, `frontend/src/themes/<name>.css` → `:root[data-theme="<name>"] { … }`. A header comment names the editor version and its source shorthands. In the editor themes, every definition line ends with `/* <file> <key> */`; that is an external fact, allowed by CP1.
- **New utilities in `style.css`:**
  - `island`: `border-radius: var(--radius-island)`, plus `outline: var(--island-line) solid var(--color-panel-border)` with `outline-offset: calc(-1 * var(--island-line))`. An outline never moves the layout, and island themes draw none.
  - `opaque-sidebar-scroller`: background `--color-sidebar`.
  - New Tailwind colours: `bg-sidebar`, `text-on-problem`, `text-on-info`, `text-on-success`.

## Option A — CSS holds every colour; one TS table holds kind and words; the palette check proves they agree (recommended)

The data structures:
- Rust `enum Theme` (10 variants) → generated `Theme` union.
- `ipc/themes.ts`: `THEMES: Readonly<Record<Theme, { group: ThemeGroup; label: string; kind: "dark" | "light" }>>`, plus `themeOf`, `themeKind` and `themeRows`.
- Ten CSS blocks, each holding the same set of variables.
- Ten `BACKGROUND_*` constants in Rust.

Visions served: 2 (each fact has one owner), 3 (one check proves them in step), 4 (the table is exhaustive over the generated union), 1 (a theme is a file of values with their sources).

**Q1. One source per fact**

| fact | where it lives |
|---|---|
| name | Rust enum → `bindings.ts` |
| label, group, kind | `ipc/themes.ts`, exhaustive `Record<Theme,…>`; this follows `ipc/keys.ts`, which also holds labels in `ipc/` |
| native background | `window.rs`, required equal to the block's `--color-window` |
| shape and colours | the CSS block |

**Q1. The check:** new `frontend/scripts/themes.ts`.
- It reads the names from `bindings.ts`'s `export type Theme`.
- It requires exactly one block per name. `dark` is the `@theme static` block; the other nine are `src/themes/<name>.css`. No block may exist without a name.
- Every block defines exactly the `@theme` block's `--color-*`, `--radius-island`, `--island-line` and `--syntax-*-{style,weight,line}`, each with an allowed value.
- Every name has a `BACKGROUND_<NAME>` constant equal to its block's `--color-window`.
- Every definition line in an editor-theme file carries a source comment.

`palette.ts` keeps its literal and unknown-token rules, with literals allowed inside every theme block. Its light and window rules move into `themes.ts`.

**Q1. An unknown name in the file**
- **Today:** serde refuses it as `Error::Broken` (`` `theme`: unknown variant … ``). `stored_at_start` opens in yamt Dark, the window reports a broken settings file, and changes are refused until it is fixed.
- **After:** the same rule, and the message now lists ten names.

**Q2. Palettes**
- yamt Dark stays in `@theme static`, which is Tailwind's token registry.
- `style.css` `@import`s the nine files right after `@import "tailwindcss"`. Today's light block moves to `themes/light.css` unchanged.
- The blocks are unlayered, so they beat `@layer theme`.
- Sources sit as end-of-line comments, which the check enforces.

**Q3. Kind in one place:** `THEMES[t].kind`, read through `themeKind`.
- `useThemeAttribute` (`ui/settingsStore.ts`) is already the only later writer of `data-theme`. It now also writes `documentElement.style.colorScheme`.
- `@layer base :root { color-scheme: dark }` remains for the frames before mount. These show only the window colour, which comes from the block.
- In `pane.ts` the theme compartment holds:
  - `EditorView.darkTheme.of(themeKind(theme) === "dark")`, and
  - a new `paneTheme` facet carrying the theme name.
- `minimap.ts` compares that facet, not the dark flag. Today a switch between two dark themes would keep stale minimap colours. The minimap's softening still follows the dark facet.
- This changes one detail of plan #57 ("color-scheme moves into the CSS"). The new information is that ten themes make kind a fact both CSS and the editor need.

**Q4. Code colours**
- The table in C2 becomes `editor/internal/syntax.ts`: rows of `{ tag, token, styles }` with `styles ⊆ ["style", "weight", "line"]`, plus `syntaxColourClasses` and `paletteHighlight`. These move out of `pane.ts`, which is at the 300-line cap. The minimap reads the same table.
- **Precedence:** CodeMirror picks the first tag in `tag.set` that has a rule, most specific first.
  - For `function(definition(variableName))` the set is `[itself, definition(variableName), function(variableName), variableName, …]`, because `definition` was created before `function`.
  - So `function foo` would get the variable-definition colour unless it has its own row.
  - Explicit rows are needed for the same reason: `derefOperator` (else operator), `angleBracket` and `special(brace)` (else punctuation), `processingInstruction` (else decorator), `unit` (else keyword), `character` (else string), `atom` (else keyword).
  - `tagName` is a child of `typeName`, so it keeps its own row.
- **Nesting:** in a Markdown span with classes from several tokens, CSS takes the later rule. So container tokens (heading, emphasis, strong, strikethrough, quote, content-separator) come first in the table and inner ones (link, url, monospace) last. `paletteIndex` then takes the **last** matching class, so the minimap agrees with the text.
- **Styles:** a row emits only its own style properties, `fontStyle: var(--syntax-<t>-style)` and so on. That way heading-bold and emphasis-italic still combine, as today.
- **One rule for clashing tags:** a tag used by TS/JS keeps its TS meaning in every language. CSS `.btn` is coloured as a type, CSS properties and JSON keys as properties, CSS value names as `self`, CSS `rgb(` as keyword, and labels go unruled.
- **Words an editor tells apart that yamt's parsers can't:**

  | editor | the shared kind takes |
  |---|---|
  | WebStorm | locals (`#a9b7c6`/`#2a8c7c`), not globals; global function (D `#56a8f5`, L `#080808` italic); instance property and method, not static or enum; type parameters and primitives as `type`; HTML tag over component; HTML attribute over JSX; parameters as `variable-definition` (local); `@` alone as decorator |
  | VS Code | `const` (`#79c0ff`/`#0550ae`) for definitions, not parameters or `let`; object key (`#9cdcfe`/`#001080`), not class fields or methods; in-block punctuation (`#c9d1d9`/`#1f2328`); `#569cd6`/`#0000ff` for `await`/`as`; heading-mark colour for `markup-mark` |
  | Zed | variable colour for definitions (parameters' `#d07277` dropped); property colour for definitions (method `#73ade9` dropped) |
  | Atom | `this` plain; calls' hue-2 also for TS declarations; TS operators hue-1 |

**Q5. Shapes**

| themes | radius | gaps | line |
|---|---|---|---|
| yamt, WebStorm | 10px (`Island.arc` 20) | 5px | none |
| VS Code, Zed, Atom | 0 | 5px (unchanged) | 1px `--color-panel-border` (VS Code `sideBar.border` `#2a2b2c`/`#f0f1f2`; Zed `border` `#464b57`/`#c9c9ca`; Atom `@base-border-color` `#181a1f`/`#dbdbdc`) |

- The line is drawn by `island` on FileList, CompareTabList, the PaneFrame section, the ChoiceView section, StopView, SettingsView and ServerLogView.
- These stay where they are: the width handle in the gap (`-right-island w-island`), the dividers and their dots (#84), the toolbar and banners on the frame.
- The sidebar uses the frame colour in VS Code and Atom, so the file list reads as their side bar with a line.

**Q6. Change colours** (dark / light; yamt unchanged, purple per #32)

| token | WebStorm | VS Code | Zed | Atom |
|---|---|---|---|---|
| chunk-inserted | `#294436`/`#bee6be` DIFF_INSERTED | `#347d3926`/`#9bb95533` insertedLineBackground | `#27a6571f`/`#27a65729` | `#1aff5b26` github-diff-added |
| chunk-modified | `#25323e`/`#e7effa` (mixed with the editor background like WebStorm's `getIgnoredColor`) | `#9bb95533` mergeEditor.change.background | `#dec1841a`/`#faf2e6` modified.background | `#e0c28526`/`#f2a60d26` |
| chunk-deleted | `#484a4a`/`#d6d6d6` | `#c93c3726`/`#ff000033` | `#e06c761f`/`#e06c7629` | `#ff526626` |
| chunk-conflict | `#2b2322`/`#ffeeeb` | `#40a6ff33` merge.incomingContentBackground | `#74ade81a`/`#0588f080` conflict_marker.theirs | `#33a0ff26`/`#52aeff26` theirs |
| chunk-modified-word | `#385570`/`#c2d8f2` | `#9ccc2c33`/`#9ccc2c66` change.word | `#2ea04859` word_added | `#e0c28540`/`#f2a60d40` |
| chunk-conflict-word | `#45302b`/`#ffd5cc` | `#40a6ff80` incomingHeader | `#2ea04859` | `#33a0ff40`/`#52aeff40` |
| chunk-modified-removal | `#385570`/`#c2d8f2` | `#f28772`/`#ad0707` gutter deleted | `#e06c76` | `#e05252`/`#ff1414` |
| chunk-conflict-removal | `#45302b`/`#ffd5cc` | `#40a6ff80` ruler incoming | `#dec184`/`#a48819` conflict | `#33a0ff`/`#52aeff` |
| mark inserted, modified, deleted, conflict | `#447152 #43698d #656e76 #8f5247` / `#aadeaa #b6d2f2 #c8c8c8 #ffc8bd` | `#72c892 #0078d4 #f28772 #fcba03` / `#587c0c #005fb8 #ad0707 #fcba03` | `#27a657 #d3b020 #e06c76 #dec184` / `… #a48819` | `#43d08a #e0c285 #e05252 #33a0ff` / `#2db448 #f2a60d #ff1414 #52aeff` |
| diff-wave | `#555555`/`#d0d0d0` | `#cccccc33`/`#22222233` diagonalFill | `#878a98`/`#7e8086` placeholder | `#abb2bf`/`#383a42` fold marker |

The settled rule: where an editor tints each side of a conflict, yamt's single conflict tint takes the theirs/incoming side. No new change token is needed.

**Q7. Picker**
- SettingsView's Theme section gets five rows from `themeRows()`. Each row is `<div role="group" aria-labelledby>`: the editor name, then one `ChoiceButtons` holding its pair with `:pressed="settings.theme"`. Only the chosen button is pressed, across all rows.
- Today's toggle-button control is kept; there is no new component.
- Words are as in C1. "One Dark" appears twice, inside two named groups.

**Q8. Start and switch**
- `main.ts`: `const startTheme = themeOf(dataset["theme"])`. Any of the ten names passes; anything else gives `"dark"`.
- The shell builds the window with `background(theme)` and its start script, as today. Every settings reply calls `show_theme`, now with ten arms.
- Fixture mode: no attribute means Dark, and a pick lives in memory. No change is needed.

**Q9. Tests**

Rust:
- `a_theme_name_is_its_serde_spelling`, extended to all ten. It catches `data-theme` differing from the file.
- `a_file_with_dark_or_light_opens_yamt_s_own_themes`. It catches a renamed old name.
- `an_unknown_theme_name_is_a_broken_file`. It catches a typo being accepted silently.

TypeScript (node):
- `themes.test.ts`: `themeOf` accepts the ten names and maps `undefined`, `""`, `"Dark"` and `"zed"` to `dark` (catches a wrong start parse); `themeKind` for each theme (a light theme flagged dark breaks the editor's dark flag and the minimap); `themeRows` has five groups in order with ten themes (catches one missing from the picker).
- `syntax.test.ts`: each probed tag gets its token, covering the precedence cases above; minimap classes equal the highlight tokens, nested Markdown included; style properties appear only on their rows (catches lost heading bold).
- `minimapRows.test.ts`: the last class wins.
- `pane.test.ts`: the dark flag for all ten themes.
- `settingsStore.test.ts`: `color-scheme` is `light` for `vscode-light`.
- `scripts/themes.test.ts`: each failure path (missing block, extra block, missing or extra token, bad style value, background missing or different, a line without a source), and the real tree passes.
- `palette.test.ts`: a literal inside a theme block is allowed, outside one it is refused.

The type check covers exhaustiveness: a `Record<Theme,…>` missing a name does not compile. All of these files are under the `just mutants` scope.

Browser test `editor/themes.browser.test.ts` (WebKit):
- For each theme, it compares computed values in a TS merge view against the values parsed from that theme's CSS text (`?raw`). Probes: panel and gutter backgrounds, code colour, each syntax token's span colour and style, a band fill, a word mark.
- It also switches between two dark themes with the minimap shown and checks a code pixel changes.

**Q10, Q11:** see Builds and the draft row below.

## Option B — Rust owns kind and background, exported as a generated constant

Data structures: `Theme::kind()` in `yamt-settings` and `background()` in `window.rs`. `tauri_specta::Builder::constant("THEME_KINDS", …)` (present in rc.25, not used yet) generates `THEME_KINDS` into `bindings.ts`; the TS table keeps only words. Visions: 2, 4; costs on 5.

| Q | how it differs from A |
|---|---|
| 1 | Rust also holds kind; the check is the same; unknown-name behaviour is the same. |
| 2 | Same as A. |
| 3 | The start script also sets `style.colorScheme`, so even the first frame is exact. On a switch, TS writes it from `THEME_KINDS`. |
| 4–7 | Same as A. |
| 8 | The start script writes two attributes. |
| 9 | Plus a Rust kind test; TS exhaustiveness depends on how specta types a map constant, which I have not checked. |
| 10 | The Rust build becomes about 200 lines, and build W2 cannot type-check until the generated constant exists, so the builds run in series. |
| 11 | The row adds the first exported constant. |

Cost: a new mechanism for one table, and a UI-only fact (kind) in the Rust crates.

## Option C — window colours in CSS, code colours as per-theme TS tables

Data structures:
- All ten window blocks in `style.css`.
- `editor/internal/syntaxThemes/<name>.ts`: `Readonly<Record<SyntaxToken, { colour; style?; weight?; line? }>>`, from which one `HighlightStyle` per theme is built and swapped through the theme compartment.
- The minimap reads the TS table directly.

Visions: 4 (a missing token does not compile), 1 for styles. It goes against 2: the architecture names "palette … lives in one place", and the palette rule VU14/VU17 would need TS exceptions.

| Q | how it differs from A |
|---|---|
| 1 | Plus TS colour tables. |
| 2 | One CSS file of about 900 lines plus ten TS files. |
| 3 | Same as A. |
| 4 | Styles live in the TS objects with no CSS variables; precedence rules are the same as A. |
| 5–8 | Same as A. |
| 9 | Code colours checked by type, not by script; the browser test compares against the TS tables. |
| 10 | W2 grows by about 700 lines; W1 shrinks. |
| 11 | The row amends VU14/VU17. |

## Recommendation: Option A

Its costs:
- About 55 more variables per theme block: 39 syntax colours, 14 style values and 2 shape values. The style values are checked by script, not by type.
- `color-scheme` moves from CSS to `useThemeAttribute`, a change to one detail of #57.
- Five new tokens (sidebar, panel-border, three banner-text tokens).
- Flat themes keep yamt's 5px frame between panels.
- `pane.ts` loses its syntax table to `syntax.ts`.

## Builds (Option A) — disjoint ownership; contract C1–C3

**R (`rust-impl`), about 120 lines**
- Changes `crates/settings/src/lib.rs` (enum, `name`, three tests) and `src-tauri/src/window.rs` (ten constants, match).
- Regenerates `frontend/src/ipc/bindings.ts` with `just bindings`.
- Updates `crates/settings/AGENTS.md` if it names the themes.

**W1 (`web-impl`, palettes), about 1,100 lines**
- `frontend/src/style.css`: new tokens and default style values in `@theme static`, nine `@import`s, the `island` and `opaque-sidebar-scroller` utilities, the light block removed.
- Creates `frontend/src/themes/{light,webstorm-dark,webstorm-light,vscode-dark,vscode-light,zed-dark,zed-light,atom-dark,atom-light}.css`, about 105 lines each.
- Class swaps in:
  - FileList, FileTree, CompareTabList (`island`, `bg-sidebar`, sidebar scroller);
  - PaneFrame, ChoiceView, StopView, ServerLogView (`island`);
  - NoticeBar, ProblemBar, App.vue (`text-on-*`).

**W2 (`web-impl`, code, check, docs), about 1,400 lines**
- New `ipc/themes.ts` + test; `ipc/index.ts`.
- New `editor/internal/syntax.ts` + test; changes to `pane.ts`, `pane.test.ts`, `minimap.ts`, `minimapRows.ts` + test.
- New `editor/themes.browser.test.ts`.
- `main.ts`; `ui/settingsStore.ts` + test; `ui/SettingsView.vue` (picker and `island`).
- New `scripts/themes.ts` + test; changes to `scripts/palette.ts` and `palette.test.ts`.
- Docs: `docs/architecture.md`, `.omp/skills/project-map/SKILL.md`, the `ipc`/`editor`/`ui` `AGENTS.md` files, `CHANGELOG.md`.

The three builds can run side by side. The real-tree theme check passes only once all three have landed. Checks to run after that: `just check`, `pnpm -C frontend test:browser`, `just mutants <base>`.

## WebKit and real-app steps

**WebKit (fixture page):**
1. Run `just webdriver 4447`, then `just app-session start-fixture --name th`.
2. Click the first file, then the gear.
3. For each theme: click its button (`--nth` for One Dark/Light); `read` the computed window, panel, sidebar, fg, code, selection, a keyword span, a band and a word mark; compare them with the theme file; `shot /tmp/yamt-themes/<name>.png` for you.

**Real app:**
1. **Start without a flash:** for each theme, `start-app --fresh-repo --settings '{"theme":"<name>"}' --record <f>.mkv --record-seconds 4`, then `colours <f>.mkv` with the other nine window colours and white. None may appear.
2. **Old files:** `--settings '{"theme":"light"}'` reads back `data-theme` `light` and window `#e9eaee`.
3. **Switch everywhere:** open two files, start a second session with `--diff`, switch in the merge window, then `focus-away`/`focus-back` the compare window. Read `data-theme` in both and take `shot --display` of both. A recording of the switch should show the native background colour.

## Draft plan §2 #102

| 102 | **Ten themes in the editors' own colours** (owner 2026-10-23; rules 1–6 in `docs/slices/request-themes.md`; design `briefs/3.TH-themes-design.md` option A).<br>**Names:** `dark`, `light`, `{webstorm,vscode,zed,atom}-{dark,light}` (Rust `Theme`, kebab-case serde; an unknown name is a broken file, as before).<br>**Facts:** kind, group and words in `ipc/themes.ts` (exhaustive over the generated union); colours, shape and code font styles in one CSS block per theme (`@theme static` = yamt Dark, `src/themes/<name>.css`), every editor value with its source on its line; native backgrounds in `window.rs`; `scripts/themes.ts` proves names, blocks, tokens, values and backgrounds in step.<br>**Kind:** the dark flag, the minimap's softening and `color-scheme` (written by `useThemeAttribute`, amending #57) all read it.<br>**Code:** 39 syntax tokens; a TS tag keeps its TS meaning in every language; explicit rows for compound tags; the minimap reads the same table and the same last class.<br>**Shapes:** islands for yamt and WebStorm (#24); square panels with a 1px border-colour outline for VS Code, Zed and Atom; 5px gaps everywhere.<br>**Changes:** each editor's diff, merge and conflict colours, the theirs tint for a conflict; purple only in yamt's themes (#32). | Rust owning kind and background as an exported constant (a new mechanism for one table; a UI fact in Rust); code colours as TS tables per theme (the palette in two places, VU14/VU17); kind from the name's suffix (clever); per-language highlight styles (a second table per language); closing the gaps in flat themes (moves the layout and the width handle) | 2, 3, 4, 1, 5 |

## Questions for you

1. **VS Code's layout.** VS Code 1.143's own default layout is rounded 8px cards, 4px apart, with 1px borders. That is not flat (VS Code note, D). Should VS Code keep rule 4's square panels with lines, or show its real default (8px corners plus the line)?
2. **Gaps in flat themes.** Flat themes keep yamt's 5px frame between panels, while Zed and Atom have none. Closing the gaps would move panels by 5–10px and put the width handle over the line. Is keeping them acceptable?
3. **Conflict colour.** yamt shows one conflict tint. I took each editor's theirs/incoming colour: blue in VS Code, Zed and Atom. The alternatives are Atom's ours (magenta-purple) or VS Code's merge-editor yellow (`#ffea0047`).
4. **VS Code Light.** Inserted and modified lines get the same tint (`#9bb95533`), because VS Code paints them alike there. Only the minimap marks tell them apart. Is that acceptable?

## Open risks and deviations

- **Tailwind:** that `@theme static` emits `--syntax-*` and `--island-line` (not Tailwind namespaces) is [INFERENCE]. The WebKit read proves or refutes it; the fallback is a plain `:root` rule.
- **Missing values:** the WebStorm Markdown styles noted as unresolved, and CSS `--x`/`*` and Light strikethrough, are left for the builds. Missing styles take `normal`/`none`; missing colours take the code colour, named in each file.
- **Licence:** the colour values are copied from the VS Code (MIT), Atom (MIT), Zed and WebStorm theme files. #24 set the precedent without a notice; whether `THIRD_PARTY_NOTICES` should name them is open.
- **Deviation:** five new non-syntax tokens. The brief's "new token only if…" applies to change colours; these cover side-panel, panel-line and banner-text colours that no existing token can express.