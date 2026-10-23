# Atom 1.60.0, One Dark / One Light: the missing UI, change and shape tables

I filled every row the earlier note left UNRESOLVED. Four values are flagged in the doubts at the end: three sit on a rounding tie, and one depends on how LESS handles `luma()`. I did all the LESS maths by hand with LESS's own formulas, because this run had no shell. None of it was run through `lessc`. Atom compiles LESS with `less-cache` 1.1.0 (`package.json:117`), which uses `less ^2.7.1`, so that is the compiler to re-check with. I confirmed the github package version: `atom/atom@v1.60.0/package.json:71` and `:207` both say 0.36.9, and the tag `v0.36.9` exists on `atom/github`.

**How the UI colours are built.** One Dark UI and One Light UI do not hard-code their colours. Both start from the background of the active syntax theme: `ui-variables-custom.less:4` does `@import "syntax-variables"`, and Atom puts the active themes' `styles/` folders on the LESS import path (`src/theme-manager.js:440-462`). The values below assume the default pairs, one-dark-ui with one-dark-syntax and one-light-ui with one-light-syntax.

**Source abbreviations.** The `#Lnn` after an abbreviation is the line anchor on that URL.
- `D/uv`, `D/uvc`: https://github.com/atom/atom/blob/v1.60.0/packages/one-dark-ui/styles/ui-variables.less and `…/ui-variables-custom.less`
- `L/uv`, `L/uvc`: the same two files under `packages/one-light-ui/styles/`
- `ui/<f>`: https://github.com/atom/atom/blob/v1.60.0/packages/one-dark-ui/styles/<f>. Every file except the two variable files is the same git blob in `one-light-ui`; the GitHub API listing shows identical SHAs.
- `core/<f>`: https://github.com/atom/atom/blob/v1.60.0/static/atom-ui/styles/<f>
- `gd`: https://github.com/atom/atom/blob/v1.60.0/packages/git-diff/styles/git-diff.less
- `gh/<f>`: https://github.com/atom/github/blob/v0.36.9/styles/<f>
- `nt`: https://github.com/atom/notifications/blob/v0.72.1/styles/notifications.less (bundled 0.72.1, `package.json:129`)
- `tv`: https://github.com/atom/tree-view/blob/v0.229.1/styles/tree-view.less
- `sv`: one-dark-syntax / one-light-syntax `styles/syntax-variables.less`

**How LESS computes the values.** Colours made by `hsl()`, `lighten()` and the other functions keep fractional RGB channels, and LESS only rounds them (`Math.round`) when it writes the CSS. `fade`, `fadein` and `fadeout` set the alpha; I converted alpha to the `aa` byte as alpha × 255, rounded (0.15 → `26`, 0.25 → `40`, 0.35 → `59`, 0.5 → `80`, 0.6 → `99`, 0.66 → `a8`, 0.75 → `bf`). `mix(a,b,w)` is a×w + b×(1−w). `contrast(c, dark, light, t)` returns `light` when luma(c) < t, otherwise `dark`.

## Shared derivations

**One Dark.** `@ui-syntax-color` = `@syntax-background-color` = hsl(220,13%,18%) (D/uvc#L7, one-dark-syntax). The guards at D/uvc#L10-33 give `@ui-hue` 220, `@ui-saturation` 13%, `@ui-lightness` = min(18%,20%) = 18%, and `@ui-lightness-border` = 18% × 0.6 = 10.8%.

| var | LESS chain | computed | hex |
|---|---|---|---|
| `@ui-fg` = `@text-color` | `hsl(@ui-hue, min(13%,18%), max(18%*3,66%))` D/uvc#L36 | hsl(220,13%,66%): m2 .7042, m1 .6158 → 157.03, 164.54, 179.57 | `#9da5b4` |
| `@ui-bg` = `@base-background-color` = `@level-2-color` | D/uvc#L37, D/uv#L34 | hsl(220,13%,18%) → 39.93, 43.91, 51.87 | `#282c34` |
| `@ui-border` = `@base-border-color` | `hsl(220,13%,10.8%)` D/uvc#L38 | m2 .12204, m1 .09396 → 23.96, 26.35, 31.12 | `#181a1f` |
| `@level-1-color` | `lighten(@base-background-color,6%)` D/uvc#L56 | l 24% → 53.24, 58.55, 69.16 | `#353b45` |
| `@level-3-color` | `darken(…,3%)` D/uvc#L58 | l 15% → 33.28, 36.59, 43.22 | `#21252b` |
| `@level-3-color-hover` | `lighten(@level-3-color,6%)` D/uvc#L60 | l 21% → 46.59, 51.23, 60.51 | `#2f333d` |
| `@background-color-highlight` | `lighten(@base-background-color,4%)` D/uv#L28 | l 22% → 48.81, 53.67, 63.39 | `#31363f` |
| `@background-color-selected`, `@button-background-color-hover` | `lighten(base,8%)` D/uv#L29; `lighten(@level-1-color,2%)` D/uv#L57 | both l 26% → 57.68, 63.43, 74.92 | `#3a3f4b` |
| `@text-color-subtle` | `fadeout(@text-color,40%)` D/uv#L13 | alpha 0.6 | `#9da5b499` |
| `@text-color-highlight` | `lighten(@text-color,20%)` D/uv#L14 | l 86% | `#d7dae0` |
| `@input-background-color` | `darken(base,6%)` D/uv#L41 | l 12% → 26.62, 29.27, 34.58 | `#1b1d23` |
| `@overlay-background-color` | `mix(@level-2-color,@level-3-color)` D/uv#L53 | 50/50 → 36.61, 40.25, 47.54 | `#252830` |
| `@scrollbar-color`, `@scrollbar-color-editor` | `lighten(@ui-syntax-color,16%)` D/uvc#L94,96 | l 34% → 75.43, 82.94, 97.97 | `#4b5362` |
| `@accent-luma` | `luma(hsl(220,50%,50%))` D/uvc#L64 | sRGB-linear (.25, .4167, .75) → .0508761, .1448502, .522522 → 0.2126·r + 0.7152·g + 0.0722·b = 15.2139% | — |
| `@accent-color` | `mix(hsv(220,100%,66%), hsl(220,100%,70%), @accent-luma)` D/uvc#L67 | hsv → (0, 56.1, 168.3); hsl → (102, 153, 255); w .152139 → 86.48, 138.26, 241.81 | `#568af2` |
| `@accent-bg-color` | `mix(hsv(220,66%,66%), hsl(220,66%,60%), @accent-luma*2)` D/uvc#L71 | (57.22, 94.25, 168.3) and (85.68, 130.56, 220.32), w .304278 → 77.02, 119.51, 204.49 | `#4d78cc` |
| `@accent-bg-text-color` | `contrast(@accent-bg-color, hsl(220,100%,10%), #fff, 30%)` D/uvc#L72 | luma .193 < .30 → light | `#ffffff` |
| `@accent-only-text-color` | `mix(hsv(220,100%,66%), hsl(220,100%,77%), @accent-luma)` D/uvc#L75 | (137.7, 176.8, 255) mixed → 116.75, 158.44, 241.81 | `#759ef2` |

**One Light.** `@ui-syntax-color` = hsl(230,1%,98%) (L/uvc#L7). `@ui-hue` is 230 (L/uvc#L10-13), `@ui-saturation` = min(1%,24%) = 1% (L/uvc#L15), and `@ui-lightness` = max(98%,92%) = 98% (L/uvc#L16).

| var | LESS chain | computed | hex |
|---|---|---|---|
| `@ui-fg` = `@text-color` | `hsl(230,1%,98%-72%)` L/uvc#L19 | l 26%: m2 .2626, m1 .2574 → 65.64, 65.86, 66.96 | `#424243` |
| `@ui-bg` = base = `@level-2-color` | L/uvc#L20 | → 249.85, 249.87, 249.95 | `#fafafa` |
| `@level-1-color` | `lighten(base,4%)` L/uvc#L39 | l clamps at 100% | `#ffffff` |
| `@level-3-color` | `darken(base,6%)` L/uvc#L41 | l 92% → 234.40, 234.46, 234.80 | `#eaeaeb` |
| `@ui-border` = `@base-border-color`; also `@level-3-color-hover`, `@background-color-selected` | `darken(@level-3-color,6%)` L/uvc#L21, #L43, L/uv#L29 | l 86% → 218.94, 219.06, 219.66 | `#dbdbdc` |
| `@background-color-highlight` | `darken(@level-3-color,2%)` L/uv#L28 | l 90% → 229.25, 229.33, 229.76 | `#e5e5e6` |
| `@text-color-subtle` | `lighten(@text-color,30%)` L/uv#L13 | l 56% → 141.68, 142.05, 143.92 | `#8e8e90` |
| `@button-background-color-hover` | `darken(@button-background-color,4%)` L/uv#L57 | white → l 96% → 244.8 | `#f5f5f5` |
| `@overlay-background-color` | `mix(@level-2-color,@level-3-color)` L/uv#L53 | → 242.12, 242.17, 242.38 | `#f2f2f2` |
| `@scrollbar-color` | `darken(@level-3-color,14%)` L/uvc#L77 | l 78% → 198.34, 198.53, 199.46 | `#c6c7c7` |
| `@scrollbar-color-editor` | `contrast(@ui-syntax-color, darken(@ui-syntax-color,14%), lighten(@ui-syntax-color,9%))` L/uvc#L79 | bg luma .955 ≥ .43 → returns the darken arm, l 84% → 213.79, 213.93, 214.61 | `#d6d6d7` |
| `@accent-luma` | `luma(hsl(230,50%,50%))` L/uvc#L47 | linear (.25, .3333, .75) → .0508761, .0908415, .522522 → 11.3513%; ×2 = 22.7025% | — |
| `@accent-color` | `mix(hsv(230,60%,60%), hsl(230,100%,68%), @accent-luma*2)` L/uvc#L50 | (61.2, 76.5, 153) and (91.8, 119, 255) → 84.85, 109.35, 231.84 | `#556de8` |
| `@accent-bg-color` | `mix(hsv(230,40%,72%), hsl(230,100%,66%), @accent-luma*2)` L/uvc#L54 | (110.16, 122.4, 183.6) and (81.6, 110.5, 255) → 88.08, 113.20, 238.79 | `#5871ef` |
| `@accent-bg-text-color` | `contrast(…, hsl(230,100%,10%), #fff, 40%)` L/uvc#L55 | luma .2015 < .40 → light | `#ffffff` |
| `@accent-only-text-color` | `mix(hsv(230,70%,50%), hsl(230,100%,60%), @accent-luma*2)` L/uvc#L58 | (38.25, 53.13, 127.5) and (51, 85, 255) → 48.11, 77.76, 226.05 | `#304ee2` |

## A. Window and UI colours (rows that were UNRESOLVED)

| yamt token (its job in yamt) | One Dark | One Light | Atom variable / element | source | how resolved |
|---|---|---|---|---|---|
| `--color-window` (html background, the frame) | `#21252b` | `#eaeaeb` | `atom-workspace` background = `@app-background-color` = `@level-3-color` | ui/atom.less#L10; D/uv#L31, L/uv#L31 | alias chain (derivations above) |
| `--color-separator` (lines under headers, between panes) | `#181a1f` | `#dbdbdc` | `@base-border-color` on pane, dock and panel edges | ui/panes.less#L5-6, ui/docks.less#L27,30, ui/panels.less#L6-18 | alias of `@ui-border` |
| `--color-control-border` (button and input borders) | `#181a1f` | `#dbdbdc` | `@button-border-color`, `@input-border-color` = `@base-border-color` | D/uv#L42,59; ui/buttons.less#L1,9; ui/editor.less#L19 | alias |
| `--color-fg` | `#9da5b4` | `#424243` | `@text-color` = `@ui-fg` (`.text(normal)`) | D/uv#L12, ui/ui-mixins.less#L4-7 | computed (above) |
| `--color-fg-muted` | `#9da5b499` (≈ `#6b727d` over `#21252b`, ≈ `#6e7581` over `#282c34`) | `#8e8e90` | `@text-color-subtle` | D/uv#L13, L/uv#L13 | dark: fadeout 40% gives alpha .6. The two composites are [INFERENCE]: browser blend of rgba(157,165,180,.6) |
| `--color-handle` (resize dots at rest) | `#4b5362` | `#c6c7c7` | gap: Atom paints no resize handle. The tree-view handle sets width only (ui/tree-view.less#L40-44), dock handles set position only (ui/docks.less#L4-23), and the tree-view package sets no colour. Closest drag grip: `@scrollbar-color` | D/uvc#L94, L/uvc#L77 | [INFERENCE] closest. Alternative that follows yamt's own convention (handle = gutter): `#636d83` / `#9d9d9f` |
| `--color-handle-active` (dots on hover or drag) | `#568af2` | `#556de8` | gap; closest: `@accent-color`, which Atom paints while dragging (tab drop bar) and on the focused pane's tab marker | ui/tabs.less#L170,226 | [INFERENCE] closest. Gutter alternative: `#abb2bf` / `#383a42` |
| `--color-hover` (hovered button or menu item) | `#31363f` | `#e5e5e6` | `.dropdown-menu > li > a:hover` → `@background-color-highlight` | ui/dropdowns.less#L11-13 | computed. Alternatives: status-bar item hover `@level-3-color-hover` `#2f333d` / `#dbdbdc` (ui/status-bar.less#L28); `.btn` hover `@button-background-color-hover` `#3a3f4b` / `#f5f5f5` (ui/buttons.less#L13-15) |
| `--color-row-hover` | `#31363f` | `#e5e5e6` | gap: tree rows have no `:hover` (neither ui/tree-view.less nor tv has one). Closest is `@background-color-highlight` | ui/dropdowns.less#L13 | [INFERENCE] closest. Atom does not tell row hover apart from generic hover |
| `--color-row-selected` | `#3a3f4b` | `#dbdbdc` | tree `.selected:before` and select-list `li.selected` → `@background-color-selected` | ui/tree-view.less#L18-19, ui/lists.less#L75 | computed. When the tree has focus: `@button-background-color-selected` = `@accent-bg-color` `#4d78cc` / `#5871ef` with text `contrast(…)` = `#ffffff` (ui/tree-view.less#L23-31) |
| `--color-primary` (primary button; focus ring; accent text) | `#4d78cc` | `#5871ef` | `.btn.btn-primary` → `.btn-variant(@accent-bg-color)` | ui/buttons.less#L76-77; D/uvc#L71, L/uvc#L54 | computed. The fill is a gradient from `lighten(@accent-bg-color,2%)` (`#557ecf` / `#6179f0`, computed) to the colour (ui/buttons.less#L10-11). Border: dark `#181a1f`; light transparent, because `@ui-lightness` 98% > 50% (ui/buttons.less#L43-44). Focus ring and border are `.focus()` → `@accent-color` `#568af2` / `#556de8` (ui/ui-mixins.less#L33-36). Accent text is `@accent-only-text-color` `#759ef2` / `#304ee2` |
| `--color-on-primary` | `#ffffff` | `#ffffff` | `@_text-color: contrast(@color, white, hsl(0,0%,20%), 33%)` | ui/buttons.less#L34,41 | the arms swap (white is lighter). Luma of accent-bg is .193 (dark) / .2015 (light), both < .33 → white |
| `--color-problem` (error banner background) | `#e89d96` | `#f1b1ac` | error notification `.content` → `lighten(@background-color-error, 25%)` | nt#L237, nt#L258-259; D/uv#L26, L/uv#L26 | dark hsl(5,64%,75%) → 232.05, 157.25, 150.45. Light hsl(5,72%,81%) → 241.43, 177.48, 171.67 |
| `--color-problem-border` | `#d13b2e` | `#e04b3e` | notification icon strip → `@background-color-error` | nt#L272-273 | dark hsl(5,64%,50%) → 209.1, **59.5**, 45.9 (G is a tie; doubt 1). Light hsl(5,72%,56%) → 223.58, 75.48, 62.02 |
| notification text (not a yamt token) | error `#7a1200`, info `#0e3377`, success `#1f5130` | `#4e0404`, `#002647`, `#041007` | `.content` color `darken(@txt, 40%)` | nt#L258 | computed (for example hsl(9,100%,24%)). **Gap:** ProblemBar, NoticeBar and App.vue's line use `text-fg`, which on these pastel backgrounds would read `#9da5b4` (low contrast). Atom draws dark text there |
| `--color-problem-error` | `#ff6347` | `#f42a2a` | `@text-color-error` (`.text-error`, `.status-removed`) | D/uv#L20, L/uv#L20; ui/text.less#L42; ui/git.less#L5 | hsl(9,100%,64%) → 255, 98.94, 71.4. hsl(0,90%,56%) → 243.78, 41.82, 41.82 |
| `--color-problem-warning` | `#e2c08d` | `#d5880b` | `@text-color-warning` | D/uv#L19, L/uv#L19 | hsl(36,60%,72%) → 226.44, 192.17, 140.76. hsl(37,90%,44%) → 213.18, 135.76, 11.22 |
| `--color-problem-info` | `#6494ed` | `#1492ff` | `@text-color-info` | D/uv#L17, L/uv#L17 | hsl(219,79%,66%) → 99.81, 147.75, 236.79. hsl(208,100%,54%) → 20.4, 145.52, 255 |
| `--color-success-signal` | `#73c990` | `#2db448` | `@text-color-success` (`.status-added`) | D/uv#L18, L/uv#L18; ui/git.less#L2 | hsl(140,44%,62%) → 115.46, 200.74, 143.89. hsl(132,60%,44%) → 44.88, 179.52, 71.81 |
| `--color-success` | `#72da87` | `#96dea5` | success notification `.content` → `lighten(@background-color-success,25%)` | nt#L249,259; D/uv#L24, L/uv#L24 | hsl(132,58%,65%) → 113.99, 217.52, 134.69. hsl(132,52%,73%) → 150.35, 221.95, 164.67 |
| `--color-success-border` | `#2ba143` | `#3bba54` | icon strip → `@background-color-success` | nt#L273 | hsl(132,58%,40%) → 42.84, 161.16, 66.5. hsl(132,52%,48%) → 58.75, 186.05, 84.21 |
| `--color-info` (notice banner background) | `#7ebef7` | `#9ed2ff` | info notification `.content` → `lighten(@background-color-info,25%)` | nt#L245,259; D/uv#L23, L/uv#L23 | hsl(208,88%,73%) → 125.56, 190.19, 246.74. hsl(208,100%,81%) → 158.1, 209.78, 255 |
| `--color-info-border` | `#0f82e6` | `#1f96ff` | icon strip → `@background-color-info` | nt#L273 | hsl(208,88%,48%) → 14.69, 129.58, 230.11. hsl(208,100%,56%) → 30.6, 150.28, 255 |
| `--color-panel-inline` (find bar `.cm-panels`, inline inputs, kbd) | `#21252b` | `#eaeaeb` | the find-and-replace panel is an `atom-panel.bottom` → `@tool-panel-background-color` = `@level-3-color` | core/panels.less#L6-11; D/uv#L44 | alias. Find-and-replace 0.219.8 sets no panel background of its own. Inputs inside it use `@input-background-color` (row below). Atom's `.key-binding` (kbd) is `@accent-bg-color` with white text (ui/key-binding.less#L9-11) |
| `--color-minimap-slider` | `#4b5362` | `#d6d6d7` | closest: the editor scrollbar thumb, `@scrollbar-color-editor` | ui/atom.less#L55-57 | computed. Opaque thumb, 10 px track, 3 px border in the track colour (the editor background), `background-clip: content-box`, so the thumb is 4 px wide, radius 5 px (ui/atom.less#L25-29). [INFERENCE] Applies only under `.scrollbars-visible-always` (legacy scrollbar style, src/workspace-element.js#L36-49) |
| `--color-minimap-slider-hover` | `#4b5362` | `#d6d6d7` | no hover rule exists | ui/atom.less | same colour |
| `--color-minimap-slider-active` | `#4b5362` | `#d6d6d7` | `:active` changes only the shape (radius 0, side borders 0) | ui/atom.less#L36-46 | same colour |
| panel border | `#181a1f` | `#dbdbdc` | `@base-border-color` | ui/panes.less#L5-6, ui/docks.less#L27,30, ui/panels.less#L6-18 | alias |
| side bar (tree view) background | `#21252b` | `#eaeaeb` | `@tree-view-background-color` = `@level-3-color` | ui/tree-view.less#L5; D/uv#L67 | alias. Differs from the editor (`#282c34` / `#fafafa`) |
| header / tab bar background | `#21252b` | `#eaeaeb` | `@tab-bar-background-color` = `@level-3-color` | ui/tabs.less#L12; D/uv#L61 | alias. Active editor tab = `@tab-background-color-editor` = syntax background `#282c34` / `#fafafa` (ui/tabs.less#L244). Bar bottom line = `@tab-border-color` `#181a1f` / `#dbdbdc` (ui/tabs.less#L11) |
| input background | `#1b1d23` | `#ffffff` | `@input-background-color` on `atom-text-editor[mini]` | ui/editor.less#L20; D/uv#L41, L/uv#L41 | computed / alias of level-1. Focused: `@input-background-color-focus`, dark `mix(@accent-bg-color, @input-background-color, 10%)` → `#202634`; light `hsl(230,100%,96%)` → `#ebeeff` (ui/editor.less#L37) |
| input border | `#181a1f` | `#dbdbdc` | `@input-border-color` | ui/editor.less#L19 | alias. Focused: border plus a 1 px ring in `@accent-color` `#568af2` / `#556de8` (ui/ui-mixins.less#L33-36) |
| menu / drop-down background | `#252830` | `#f2f2f2` | `.dropdown-menu`, popover select list → `@overlay-background-color` | ui/dropdowns.less#L2, ui/lists.less#L110 | computed. Border 1 px `#181a1f` / `#dbdbdc` (ui/dropdowns.less#L4); item hover = `--color-hover` row |
| tooltip background | `#4d78cc` | `#5871ef` | `@tooltip-background-color` = `@accent-bg-color` | ui/tooltips.less#L14; D/uvc#L106 | alias. Text `#ffffff` (ui/tooltips.less#L15). Opacity 1 (ui/tooltips.less#L5-8 overrides core's .9) |
| tooltip border | none | none | no border in ui/tooltips.less#L11-18 or core/tooltip.less#L36-43 | — | none drawn |
| scrollbar thumb (UI) | `#4b5362` | `#c6c7c7` | `@scrollbar-color` on track `@level-3-color` | ui/atom.less#L21-29 | computed (above) |

## C. Change colours

`@syntax-color-*` come from sv#L28-31, and their hsl → hex maths is already in the earlier note. All alpha values below come from `fade` / `fadein`.

| kind | One Dark | One Light | Atom variable / element | source | how resolved |
|---|---|---|---|---|---|
| git-diff gutter: added | `#43d08a` | `#2db448` | `.line-number.git-line-added { border-left: 2px solid @syntax-color-added }` | gd#L12-13 | alias |
| git-diff gutter: modified | `#e0c285` | `#f2a60d` | `.git-line-modified { border-left: 2px solid @syntax-color-modified }` | gd#L7-8 | alias |
| git-diff gutter: removed | `#e05252` | `#ff1414` | `.git-line-removed:before` / `.git-previous-line-removed:before`: a 4 px CSS triangle, `border-left-color: @syntax-color-removed`, on the line boundary | gd#L17-36 | alias. The icon variant (`.gutter.git-diff-icon`) uses the same three colours (gd#L57,62,69) |
| line tint: added (github diff view) | `#1aff5b26` | `#1aff5b26` | `@github-diff-added: fade(hsl(137,100%,55%),15%)` on `.github-FilePatchView-line--added` | gh/variables.less#L15; gh/file-patch-view.less#L237-238 | hsl → m1 .1, m2 1 → R **25.5** (tie, doubt 1), G 255, B 90.53. Same in both themes. Cursor line: `fadein(…,3%)` → `#1aff5b2e` (L240) |
| line tint: deleted | `#ff526626` | `#ff526626` | `@github-diff-deleted: fade(hsl(353,100%,66%),15%)` | gh/variables.less#L14; gh/file-patch-view.less#L231-232 | → 255, 81.6, 101.83. Cursor line `#ff52662e` |
| word mark: added / deleted (PR comment snippets only) | `#38e06240` / `#fb566940` | same | `@github-diff-added-highlight: fade(hsl(135,73%,55%),25%)`; `@github-diff-deleted-highlight: fade(hsl(353,95%,66%),25%)` | gh/variables.less#L17-18; gh/pr-comment.less#L121-135 | → 56.48, 224.02, 98.37 / 250.67, 85.94, 105.15 |
| conflict ours (lines + `<<<<<<<` banner) | `#d633ff26` | `#dc52ff26` | `@conflict-color-ours: spin(@syntax-color-renamed, 80)`, then `.generate-conflicts(Ours, fade(…,15%))` → `.github-ConflictOurs` and `…OursBanner` | gh/conflicting-editor.less#L3,53-65,80 | renamed hsl(208,100%,60%/66%) → hue 288: dark → 214.2, 51, 255; light → 220.32, 81.6, 255. Hue 288° is magenta-purple |
| conflict theirs (lines + `>>>>>>>` banner) | `#33a0ff26` | `#52aeff26` | `@conflict-color-theirs: @syntax-color-renamed` | gh/conflicting-editor.less#L4,81 | renamed: dark 51, 159.8, 255; light 81.6, 174.08, 255 |
| conflict base (lines + `\|\|\|\|\|\|\|` banner) | `#99999926` | `#a8a8a826` | `@conflict-color-base: desaturate(@syntax-color-renamed, 100%)` | gh/conflicting-editor.less#L5,82 | s → 0: l .60 → 153; l .66 → 168.3 |
| marker `=======` (separator) | `#99999926`; text `#999999a8` | `#a8a8a826`; text `#a8a8a8a8` | `.github-ConflictSeparator` = base at 15%; span `fade(base,66%)` | gh/conflicting-editor.less#L88-92 | alias + alpha |
| marker text on an unmodified banner | side colour at `a8` (e.g. `#d633ffa8`) | e.g. `#dc52ffa8` | `.github-ConflictUnmodifiedBanner span { fade(@color,66%) }` | gh/conflicting-editor.less#L64 | alpha .66 |
| conflict side edited by the user | `#e0c28526` | `#f2a60d26` | `@conflict-color-modified: @syntax-color-modified` → `.github-ConflictModified` / `…ModifiedBanner` | gh/conflicting-editor.less#L6,83; class picked in `lib/models/conflicts/side.js#L38-52` | alias + alpha |
| conflict cursor line (any side) | side colour at `40` (e.g. `#d633ff40`) | e.g. `#dc52ff40` | `&.cursor-line { fadein(@color,10%) }` | gh/conflicting-editor.less#L57,63 | .15 + .10 = .25 |
| conflict control block ("Use me" bar) | background side at `59`; text `#ffffff80`; button = solid side colour, white text | background side at `59`; text `#000000a8` | `.github-Conflict…Block`: `fadein(@color,20%)`; `contrast(@syntax-background-color, hsla(0,0%,0%,.66), hsla(0,0%,100%,.5))`; `.btn` `fade(@color,100%)` | gh/conflicting-editor.less#L67-76 | .35 → `59`. Editor luma .024 → light arm; .955 → dark arm |
| resolved | `#43d08a26` (cursor line `#43d08a40`) | `#2db44826` (`#2db44840`) | `@conflict-color-resolved: @syntax-color-added` → `.github-ResolvedLines` | gh/conflicting-editor.less#L7,97-99 | alias + alpha |

**Mapping onto yamt.** The job of each token comes from `frontend/src/editor/theme.css:3-95` and `editor/internal/minimapRows.ts:77-84`.

| yamt token | job | proposed Atom colour | One Dark | One Light | gap? |
|---|---|---|---|---|---|
| `--color-chunk-inserted` | inserted-line band | `@github-diff-added` | `#1aff5b26` | `#1aff5b26` | — |
| `--color-chunk-deleted` | deleted-line band | `@github-diff-deleted` | `#ff526626` | `#ff526626` | — (Atom paints red where yamt paints grey) |
| `--color-chunk-modified` | modified-line band | gap: the diff view has no "modified" line tint. Closest is `.github-ConflictModified` | `#e0c28526` | `#f2a60d26` | yes |
| `--color-chunk-conflict` | conflict band | gap: Atom has no single conflict tint, it colours each side. Closest is Ours (the local side, yamt's left) | `#d633ff26` | `#dc52ff26` | yes. Ours is magenta-purple: rule 5 says to follow the editor, but also says conflicts are purple only in yamt's themes, so the design has to choose. The non-purple option is Theirs `#33a0ff26` / `#52aeff26` |
| `--color-chunk-modified-word` | changed-word mark | gap (no word level for modified). Closest: modified tint at Atom's emphasis step (`fadein` 10%) | `#e0c28540` | `#f2a60d40` | yes |
| `--color-chunk-conflict-word` | conflict word mark | gap. Closest: the chosen conflict side at `fadein` 10% | `#d633ff40` | `#dc52ff40` | yes |
| `--color-chunk-modified-removal` | 4 px "lines removed here" bar | git-diff removed marker `@syntax-color-removed` | `#e05252` | `#ff1414` | — |
| `--color-chunk-conflict-removal` | the same bar inside a conflict | gap. Closest: solid conflict colour (block button `fade(@color,100%)`) | `#d633ff` | `#dc52ff` | yes |
| `--color-mark-inserted` | minimap edge mark | git-diff added | `#43d08a` | `#2db448` | Atom has no minimap or scrollbar marks; the gutter colour is the closest |
| `--color-mark-modified` | — | git-diff modified | `#e0c285` | `#f2a60d` | same note |
| `--color-mark-deleted` | — | git-diff removed | `#e05252` | `#ff1414` | same note |
| `--color-mark-conflict` | — | gap. Closest: solid Ours (or Theirs `#33a0ff` / `#52aeff`) | `#d633ff` | `#dc52ff` | yes |

## D. Shape

The shape is identical in both themes: every non-variable file is the same blob.

| item | value | source |
|---|---|---|
| panels | Flat, no gaps; areas touch and are divided by 1 px lines in `@base-border-color` (`#181a1f` / `#dbdbdc`) | — |
| lines drawn | between panes: `atom-pane` right and bottom borders (last pane: no right border) | ui/panes.less#L5-6,17-20 |
| | dock edges | ui/docks.less#L27,30 |
| | `atom-panel` edges (find panel included): bottom border; `.top`, `.left`, `.bottom` add a right border; `.right` adds a left border; the last footer has none | ui/panels.less#L6-24 |
| | tab bar bottom line (inset box-shadow) | ui/tabs.less#L11 |
| | 1 px border-left between tabs | ui/tabs.less#L38 |
| | right edge of the last tab | ui/tabs.less#L49,52 |
| | panel-heading bottom border | ui/panels.less#L50 |
| | dropdown border | ui/dropdowns.less#L4 |
| | modal list border and row separators | ui/modal.less#L29,40 |
| | Status bar: background only, no line of its own (ui/status-bar.less#L8; the status-bar 1.8.17 package has no border rule). [INFERENCE] The line above it is the pane's bottom border | — |
| focus | 1 px ring and border in `@accent-color`; the active tab of the focused pane gets a 2 px left marker in `@accent-color` (unfocused: `mix(@text-color, @tab-background-color-editor, 33%)`) | ui/ui-mixins.less#L33-36; ui/tabs.less#L210-227 |
| `@component-border-radius` | 3px | D/uv#L85, L/uv#L85 |
| buttons | 3px (core radius; the theme does not override it), 1 px border | core/buttons.less#L23; ui/buttons.less#L9 |
| inputs (mini editor) | 3px | ui/editor.less#L17; core/inputs.less#L29 |
| menus / drop-downs, popover lists | 3px | ui/dropdowns.less#L3; ui/lists.less#L113 |
| modal container | 6px (`@component-border-radius*2`) | ui/modal.less#L97 |
| tooltips | 3px, no border; keystroke chip `max(2px, 3px/2)` = 2px | ui/tooltips.less#L13,24 |
| notifications | 3px (icon strip left corners, content right corners) | nt#L75,124 |
| key-binding chip | 3px | ui/key-binding.less#L9 |
| tabs | 0 (`.tab-bar` radius 0); tab close button 3px | ui/tabs.less#L15,88 |
| scrollbar thumb | 5px | ui/atom.less#L26 |
| conflict block corners | 4.5px (`@component-border-radius * 1.5`) | gh/conflicting-editor.less#L42-48 |

## E. Kind

| theme | package.json `theme` | keywords | source | conclusion |
|---|---|---|---|---|
| One Dark UI | `"ui"` | `"dark"`, `"adaptive"`, `"ui"` | `packages/one-dark-ui/package.json#L3,L6-10` (v1.12.5) | dark |
| One Dark Syntax | `"syntax"` | `"dark"`, `"blue"`, `"syntax"` | `packages/one-dark-syntax/package.json#L3,L6-10` (v1.8.4) | dark |
| One Light UI | `"ui"` | `"light"`, `"adaptive"`, `"ui"` | `packages/one-light-ui/package.json#L3,L6-10` | light |
| One Light Syntax | `"syntax"` | `"light"`, `"syntax"` | `packages/one-light-syntax/package.json#L3,L6-9` | light |

Atom has no dark/light type field. `theme` only separates `ui` from `syntax` themes; dark or light is declared only in `keywords`. "adaptive" means the UI colours are derived from the syntax background (D/uvc#L4-38).

## Doubts

1. **Three channels sit exactly on a .5 tie, and float error decides them.**
   - One Dark `@background-color-error` G = 59.5. A float trace gives 59.49999999999998, so `3b` → `#d13b2e`; the other outcome is `#d13c2e`.
   - `@github-diff-added` R = 25.5. The float m1 is 0.1000000000000001, so `1a`; the other outcome is `19`.

   Re-check both with `lessc` 2.7.
2. **`@accent-bg-color` blue channel depends on `luma()` rounding.** The dark value B = 204.49 is only 0.009 from the rounding point and depends on `luma()` not being rounded. I assumed LESS 2.x does not round it, which reproduces the commonly cited `#4d78cc` / `#568af2`. If it does round (15%), the results are `#4d78cd` / `#578af2`.
3. **The handle and hover rows are inferred closest elements**, not colours Atom paints for the same job. Atom draws no resize grips and no tree-row hover.
4. **The banner text-colour gap.** Atom's notifications are pastel backgrounds with dark text. yamt's banners use `--color-fg`, which would be unreadable on them in One Dark.
## Orchestrator check (LESS 2.7.3, the compiler Atom's `less-cache` 1.1.0 uses; real CSS output)

Every `ui-variables(-custom).less` variable of both UI themes, compiled with the matching syntax theme on the import
path, plus the github package's diff and conflict expressions (`gh/variables.less`, `gh/conflicting-editor.less`
`@conflict-color-*` with `fade`/`fadein`) and the notification backgrounds (`lighten(@background-color-*, 25%)`,
`lighten(@accent-bg-color, 2%)`): all match this note. Doubt 1 settled as written (`#d13b2e`, `#1aff5b26`: LESS
prints `#d13b2e` and `rgba(26, 255, 91, 0.15)`); doubt 2 settled as written (`#4d78cc`, `#568af2`). Not re-checked: the
notification text colours (`darken(@txt, 40%)`), the `[INFERENCE]` composites. Scripts: `/tmp/yamt-atom/`.
