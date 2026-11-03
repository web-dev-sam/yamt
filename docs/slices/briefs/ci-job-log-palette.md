# Slice ci-job-log-palette — the 16 terminal colours in every theme, readable by rule

Feature: CI job log (request `docs/slices/request-ci-job-log.md` rule 4 "Colours stay readable in every yamt theme,
dark and light" and the acceptance's "dark and light themes"; design `docs/slices/briefs/ci-job-log-design.md` option
A, §1.8; proposed plan §2 #159; proposed RK58). Sourced data like the themes of plan §2 #102, plus its detector.
Needs nothing; runs beside `ci-job-log-state` (or in wave 1 when three implementers fit).

## Target

Owned: `frontend/src/style.css` (only the new `--color-ansi-*` lines inside `@theme static`),
`frontend/src/themes/*.css` (only the new `--color-ansi-*` lines in each block, and a header line naming new sources),
`frontend/scripts/themes.ts`, `frontend/scripts/themes.test.ts`.

Read-only: everything else — every other token and comment in the theme files, `frontend/scripts/palette.ts` (its
token rules already cover new `--color-*` names), `.omp/run/notes/ThemeColours*.md`, the installed editors the
themes cite (their headers: VS Code under `/usr/share/code/resources/app/…`, WebStorm jars under
`~/.local/share/JetBrains/WebStorm-262.10968.77/`, Zed `zed-industries/zed@v1.25.3`, Atom `atom/atom@v1.60.0`),
`docs/**` (the docs keeper's).

Non-goals: using the tokens (the page slice maps the core's `AnsiColour` to `text-ansi-*`/`bg-ansi-*`); any token but
these 16; changing another token's value; 256-colour values (the core maps them onto these 16).

## Contract

Fixed. Sixteen tokens in `style.css`'s `@theme static` (yamt Dark) and in every `:root[data-theme="…"]` block of
`frontend/src/themes/*.css` (the themes fence then requires them everywhere, `scripts/themes.ts:161-174`), each value
`#rrggbb` (six lower-case hex digits, no alpha), in this order after the `--color-search-match`/`--color-diff-wave`
group:

```css
--color-ansi-black; --color-ansi-red; --color-ansi-green; --color-ansi-yellow;
--color-ansi-blue; --color-ansi-magenta; --color-ansi-cyan; --color-ansi-white;
--color-ansi-bright-black; --color-ansi-bright-red; --color-ansi-bright-green; --color-ansi-bright-yellow;
--color-ansi-bright-blue; --color-ansi-bright-magenta; --color-ansi-bright-cyan; --color-ansi-bright-white;
```

Tailwind v4 makes `text-ansi-red`, `bg-ansi-bright-red`, … from them (the page slice uses exactly those 32 names).

**Values**, each from the theme's own editor, its source in the line's comment as the file's other lines do (an
imported theme's line without one is refused, `themes.ts:186-196`):

- `webstorm-dark` / `webstorm-light`: the scheme's console colours (`CONSOLE_BLACK_OUTPUT` … and their bright keys,
  read in `IslandScheme{Dark,Light}.xml` and the parent scheme in `DefaultColorSchemesManager.xml`, names as found).
- `vscode-dark` / `vscode-light`: `terminal.ansiBlack` … `terminal.ansiBrightWhite` from the theme chain the header
  names, else the registered defaults in the bundle (`workbench.desktop.main.js`, cited `js:N@c`).
- `zed-dark` / `zed-light`: `terminal.ansi.black` … `terminal.ansi.bright_white` in `assets/themes/one/one.json`.
- `atom-dark` / `atom-light`: Atom has no terminal — "gap": the One syntax hues of `colors.less` (`@hue-1` cyan,
  `@hue-2` blue, `@hue-3` purple as magenta, `@hue-4` green, `@hue-5` red, `@hue-6-2` yellow; the `@mono-*` greys for
  black/white and the bright greys; `@hue-5-2`/`@hue-6` where they name a brighter variant), each line saying which.
- yamt Dark (`style.css`) and yamt Light (`themes/light.css`): yamt's own themes (#57, "after WebStorm Islands"):
  WebStorm Islands Dark's and Light's console colours (no source comment required, `YAMT_THEMES`, but name them).

**Readable by rule** (VS Code's own for its terminal: "increasing or reducing the luminance of the text's foreground
color until a 4.5:1 contrast ratio is met", the default; docs `code.visualstudio.com/docs/terminal/appearance`
"Minimum contrast ratio"): every one of the 16 must reach **4.5:1** against its block's `--color-panel` (WCAG 2
contrast: channel `c/255`, linear `c ≤ 0.04045 ? c/12.92 : ((c + 0.055)/1.055)^2.4`, `L = 0.2126 R + 0.7152 G +
0.0722 B`, ratio `(L_light + 0.05)/(L_dark + 0.05)`). A source value below it is moved the way VS Code's terminal
moves it — xterm.js `ensureContrastRatio` (read it in the installed VS Code bundle or `xtermjs/xterm.js`
`src/common/Color.ts` and cite where): lighter on a dark panel, darker on a light one, in its steps, until 4.5:1 —
and the comment keeps the source value: `/* SD CONSOLE_BLACK_OUTPUT #000000, raised to 4.5:1 over --color-panel
(VS Code minimumContrastRatio) */`.

**Detector** (`scripts/themes.ts`, vision 3): `ThemeViolation.rule` gains `"ansi-contrast"`; `ALLOWED_VALUES` gains `{
name: /^--color-ansi-/, value: /^#[0-9a-f]{6}$/ }` (anything else is `bad-value`); a block whose `--color-ansi-*`
value is below 4.5:1 against the same block's `--color-panel` (itself `#rrggbb`) reports `{ rule: "ansi-contrast",
file, line, match: "--color-ansi-black: #000000 1.1:1" }` (ratio to one decimal, rounded down).

## Change

1. Read the four editors' terminal palettes (as the theme headers name the files); write a scratch table (theme ×
   16: source value, ratio, final value) in your scratch folder, not in the repository.
2. The 16 lines in `style.css` and in each of the nine theme files, with their comments; a header line per theme
   for any new source file.
3. `scripts/themes.ts`: the value rule and `ansi-contrast`; `themes.test.ts`: the failing paths.

## Acceptance

- Vitest (`pnpm -C frontend test -- scripts/themes scripts/palette`): the existing "the real source tree has no …
  violations" tests stay green with the new lines (themes and palette); new
  `an_ansi_colour_below_4_5_to_1_against_its_panel_is_reported` (a sample block: black `#000000` on `#17161c` →
  `ansi-contrast` with file, line and "1.1:1"), `an_ansi_colour_with_alpha_or_three_digits_is_a_bad_value`,
  `the_contrast_uses_the_same_blocks_panel` (a light block's white `#ffffff` on `#ffffff` reported, the dark block's
  passing white not).
- The scratch table pasted (every theme, every token: source value, ratio before, final value, ratio after ≥ 4.5).
- `pnpm -C frontend lint`, `typecheck`, `test`: summary lines; `just map-check` unchanged (no new file).
- `just mutants HEAD` in your workspace (SP11; `scripts/themes.ts` is in its scope).

## Skills

`skill://ts-conventions`, `skill://comment-policy`, `skill://risk-register` (proposed RK58), `skill://verification`.
