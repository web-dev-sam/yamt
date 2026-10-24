The ten palettes, the editors' panel shapes and the theme check are in place. yamt Dark and Light render with 0 differing pixels against the base commit. The five recipes pass and the theme check passes on the real tree. One gap before merge: `just map-check` will fail on the new `scripts/themes.ts` until the project map names it (see deviations).

**summary**
- Nine theme files in `frontend/src/themes/`: yamt Light moved over unchanged, plus WebStorm, VS Code, Zed and Atom dark and light. Each defines the full token set, and every line in an editor theme ends with its source.
- `style.css` now holds:
  - yamt Dark's `@theme static`, with the 5 new colour tokens, the 39 syntax colours, the 14 style variables and the 3 shape variables;
  - `--spacing-handle` and a derived `--island-overlap`;
  - the nine `@import`s and the `island`, `opaque-sidebar-scroller` and `panel-handle` utilities.
- Shapes: yamt and WebStorm keep islands (10/5/0 px). VS Code shows cards (8/4/1 px). Zed and Atom are flat, with one 1 px line between touching panels.
- The new check `scripts/themes.ts` proves names, blocks, tokens, allowed values, sources, native backgrounds, and that `background()` maps each theme to its own constant. `palette.ts` keeps only its literal and unknown-token rules, with literals allowed inside theme blocks.

**files_changed**
- `frontend/src/style.css`
- `frontend/src/themes/{light,webstorm-dark,webstorm-light,vscode-dark,vscode-light,zed-dark,zed-light,atom-dark,atom-light}.css` (new)
- `frontend/scripts/themes.ts`, `frontend/scripts/themes.test.ts` (new)
- `frontend/scripts/palette.ts`, `frontend/scripts/palette.test.ts`
- `frontend/src/ui/{FileList,FileTree,CompareTabList,PaneFrame,ChoiceView,StopView,ServerLogView,SettingsView,NoticeBar,ProblemBar,App,CompareApp,PanelWidthHandle}.vue`

**tests_added** (all in `scripts/themes.test.ts` unless noted)
- `the real source tree has one complete block per theme and its own native background`: the real tree passes, and `window.rs` is read.
- `a tree with every block, token, source and background in step violates nothing`
- `a theme name without its block is reported at the file it belongs in`: the missing-block path.
- `Dark's block is the @theme block of src/style.css`
- `a block without a theme name, in another theme's file or twice is an extra block`
- `a block must define exactly Dark's colour, shape and style variables`: missing and extra tokens.
- `a style variable takes only its allowed words and a shape variable only whole pixels`: bad style and shape values, in Dark's block too.
- `each allowed word passes for weight and line variables`
- `every definition in an editor's theme ends with its source, yamt's own themes need none`
- `each theme's native background equals its block's --color-window`: a background missing or different.
- `background() maps each theme to its own constant exactly once`: swapped, duplicated, unknown and missing arms; arms in other functions are ignored (your addition).
- `a window file without background() reports every theme's arm`
- `readThemeSources reads the window file of the nearest ancestor, as from a mutation sandbox`: moved here from `palette.test.ts`.
- In `palette.test.ts`:
  - `a literal inside a theme block is allowed, outside one it is refused`
  - `a theme block outside src/themes/ exempts nothing`

**smoke_evidence**
- `pnpm -C frontend fmt:check` → `All matched files use the correct format. Finished in 913ms on 435 files`
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0, no errors.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0, no findings. The first run found 3 issues (func-style, max-lines 303, a magic number); all were fixed.
- `pnpm -C frontend test` → `Test Files 149 passed (149)`, `Tests 1961 passed (1961)`, the real-tree theme and palette checks included.
- `pnpm -C frontend unused` → `$ knip --include exports,types`, exit 0, nothing reported.
- WebKit: `just app-session start-fixture --name th-pal` (it starts its own `just webdriver` and dev server), file `language-tools-script-setup.ts`, `dataset.theme` set per theme. Page values beside the theme file's values (`gap -1px` = the two 1 px borders overlap into one line):

  | theme | html (`--color-window`) | file list (`--color-sidebar`) | file list text (`--color-fg`) | pane (`--color-panel`) | radius | gap | file list right / pane left border | `.cm-content` (`--color-code`) | conflict band (`--color-chunk-conflict`) |
  |---|---|---|---|---|---|---|---|---|---|
  | dark | #27252e | #17161c | #d6d4dd | #17161c | 10px | 5px | 0px / 0px | #c4c2ce | #905fe124 |
  | light | #e9eaee | #ffffff | #000000 | #ffffff | 10px | 5px | 0px / 0px | #080808 | #967bef6b |
  | webstorm-dark | #26282c | #191a1c | #d1d3d9 | #191a1c | 10px | 5px | 0px / 0px | #bcbec4 | #2b2322 |
  | webstorm-light | #e9eaee | #ffffff | #000000 | #ffffff | 10px | 5px | 0px / 0px | #080808 | #ffeeeb |
  | vscode-dark | #191a1b | #191a1b | #bfbfbf | #121314 | 8px | 4px | 1px #2a2b2c / 1px #2a2b2c | #bbbebf | #40a6ff33 |
  | vscode-light | #fafafd | #ffffff | #202020 | #ffffff | 8px | 4px | 1px #e4e5e6 / 1px #e4e5e6 | #202020 | #40a6ff33 |
  | zed-dark | #3b414d | #2f343e | #dce0e5 | #282c33 | 0px | -1px | 1px #464b57 / 1px #464b57 | #acb2be | #74ade81a |
  | zed-light | #dcdcdd | #ebebec | #242529 | #fafafa | 0px | -1px | 1px #c9c9ca / 1px #c9c9ca | #242529 | #0588f080 |
  | atom-dark | #21252b | #21252b | #9da5b4 | #282c34 | 0px | -1px | 1px #181a1f / 1px #181a1f | #abb2bf | #33a0ff26 |
  | atom-light | #eaeaeb | #eaeaeb | #424243 | #fafafa | 0px | -1px | 1px #dbdbdc / 1px #dbdbdc | #383a42 | #52aeff26 |

  Every value equals the theme file's.
- One line where flat panels touch, read from the shots at device pixels (472+i, y=1200), DPR 2:
  - zed-dark: `#2F343E ×6, #464B57 ×2, #282C33…` (sidebar, one 1 px border line, pane)
  - atom-light: `#EAEAEB ×6, #DBDBDC ×2, #FAFAFA…`
  - vscode-dark: 14 × `#191A1B` (the 4 px gap) then `#2A2B2C` (the card border)
- Shots: `/tmp/yamt-themes/<name>-palettes.png` for all ten themes.
- yamt Dark and Light, base vs after, `compare -metric AE`:
  - `dark-before.png` vs `dark-after.png` → `0 (0)`
  - `light-before.png` vs `light-after.png` → `0 (0)`
- Drag in zed-dark, file list width: start 240 → +120 → 360 → −120 → 240 → +60 → 300 → double-click → 240.
  - The handle is 5 px at 237–242, centred on the shared line at 239–240.
  - The Local/Result divider dragged +100: panes `424/424/424` → `524/324/424`; double-click → `424/424/424`.
- Drag in vscode-dark: start 240 → 360 → 240 → 300 → double-click → 240.
  - The handle is 5 px at 243.5–248.5, centred on the 4 px gap at 244–248.
  - The divider dragged: `419/419/419` → `519/319/419`; double-click → back to `419/419/419`.

**deviations_from_brief**
- **`PanelWidthHandle.vue` changed** (you approved it). Its class is `panel-handle`, a `style.css` utility, not the arbitrary class I proposed. With a border-drawn line its offset must also include `--island-line` and the overlap: right = −((spacing + overlap + handle)/2 + line), width `--spacing-handle`.
- **How the single line is drawn:**
  - `island` draws the line as a `border` (width `--island-line`, colour `--color-panel-border`), not the design's outline. An outline paints under positioned or scrolling children, and the file list's scroller would hide it in VS Code.
  - Two touching flat panels overlap by one line through `ml-(--island-overlap)` on the right column of `App.vue` and `CompareApp.vue`, so one line shows.
  - `--island-overlap: min(0px, calc(var(--spacing-island) - var(--island-line)))` is derived in `@theme`. It is 0 for yamt, WebStorm and VS Code and −1px for Zed and Atom. It is not a per-theme token, and the check ignores it.
  - In island themes the border is 0px, so layout and pixels are unchanged.
- **Window edges:** in Zed and Atom the panels' own lines also show at the window edges.
- **Value choices the notes left open** (the named gaps are in each line's comment):
  - WebStorm `type` takes the class colour; `url` takes the link destination (italic).
  - WebStorm Dark emphasis and strong stay normal (unresolved in the notes). Light strikethrough is `none`.
  - Atom `angle-bracket` takes the TSX `<` colour (hue-1). Zed and Atom strikethrough lines are `none` (their themes set colour only).
  - For tags a TS file never emits (`character`, `markup-mark`), I took the HTML entity and the Markdown marker colours.
- **`light.css` keeps its `color-scheme: light;`** so it stays pixel-identical; it is not a custom property. Moving `color-scheme` is row 3c's.
- **Needed outside my globs:** `just map-check` (PM6) requires `frontend/scripts/themes.ts` in `.omp/skills/project-map/SKILL.md`. Suggested change to its `frontend/scripts` line, after `palette.ts (VU17)`: `+ themes.ts (one block per Theme name in src/style.css @theme / src/themes/<name>.css, the same tokens, allowed style/shape values, editor-line sources, window.rs BACKGROUND_<NAME> and background()'s arms)`. The `style.css` line and the new `src/themes/` folder also need describing. Row 3c's docs step covers the map, architecture and AGENTS files.

**open_risks**
- `frontend/src/ui/App.vue:73`, `frontend/src/ui/CompareApp.vue:79`: with the file list hidden (Ctrl+B) in Zed or Atom, the right column sits 1 px past the window's left edge. The pane's left line is off-screen and 1 px of padding is clipped.
- `frontend/src/themes/atom-light.css`: the `N:`/`L:` line numbers in the syntax sources are One Dark's (the notes give dark numbers); the values are One Light's.
- `frontend/scripts/themes.ts`: blocks are found by regex, so a `:root[data-theme=…]` in a commented-out CSS region would count as a block.
- Not run: `just mutants`, `pnpm test:browser`, `just check`. Please run them on the merged tree.