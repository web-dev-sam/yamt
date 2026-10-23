# Zed 1.25.3: One Dark / One Light

**Sources.** `one.json` is `zed-industries/zed@v1.25.3/assets/themes/one/one.json`. The tag resolves to commit `8dd255c3`. `default.json:9-12` sets `"theme": {"mode":"system","light":"One Light","dark":"One Dark"}`.

**How omitted keys fall back.** `crates/theme_settings/src/theme_settings.rs:294-350` (`refine_theme`) starts from `ThemeColors::dark()/light()` (`crates/theme/src/default_colors.rs:51,205`). It then applies the per-key fallbacks in `crates/theme_settings/src/schema.rs`. Syntax uses only the theme's own `syntax` map, with no merge (`theme_settings.rs:335-350`).

**How captures match theme keys.** The longest dot-prefix wins: `variable.parameter` matches `variable.parameter`, and `function.method` matches `function` (`crates/syntax_theme/src/syntax_theme.rs:87-102`). A capture with no matching key is never pushed and leaves the colour beneath it (`crates/language/src/buffer.rs:5761-5764`). When two captures cover the same node, the later pattern wins, because the stack top is used (`buffer.rs:5952`). [INFERENCE: tree-sitter returns captures in pattern order.]

**Line numbers.** Light UI keys have their own line numbers. Light syntax keys sit at the dark line + 417.

## A. Window and editor

| yamt token | One Dark | One Light | Zed key | source (dark / light) | how resolved |
|---|---|---|---|---|---|
| `--color-window` | `#3b414d` | `#dcdcdd` | `background` (app frame, title and status bar) | one.json:18 / :437 | direct |
| `--color-panel` | `#282c33` | `#fafafa` | `editor.background` | :58 / :477 | direct. The side bar uses `panel.background` (see extra rows) |
| `--color-panel-inline` | `#2f343e` | `#ebebec` | `elevated_surface.background` (menus, popovers) | :16 / :435 | direct. The find bar sits on `toolbar.background` `#282c33`/`#fafafa` (:43/:462) |
| `--color-separator` | `#464b57` | `#c9c9ca` | `border` | :10 / :429 | direct. Dock edge `dock.rs:1341`, tab bar bottom `tab_bar.rs:126-127`, `pane_group_border`→`border` (schema.rs:503-507) |
| `--color-control-border` | `#363c46` | `#dfdfe0` | `border.variant` | :11 / :430 | direct. Used by inputs (`ui_input/src/input_field.rs:159`), menus and tooltips (`ui/src/traits/styled_ext.rs:10`). Outlined buttons use `border` instead (`button_like.rs:282`) |
| `--color-fg` | `#dce0e5` | `#242529` | `text` | :30 / :449 | direct |
| `--color-fg-muted` | `#a9afbc` | `#58585a` | `text.muted` | :31 / :450 | direct |
| `--color-code` | `#acb2be` | `#242529` | `editor.foreground` | :57 / :476 | direct |
| `--color-gutter` | `#4e5a5f` | `#b4b4bb` | `editor.line_number` | :63 / :482 | direct (6-digit hex, opaque) |
| `--color-gutter-active` | `#d0d4da` | `#44454b` | `editor.active_line_number` | :64 / :483 | direct |
| `--color-handle` | `#464b57` | `#c9c9ca` | `border` | :10 / :429 | closest: Zed draws no grab dots, only the divider line |
| `--color-handle-active` | `#47679e` | `#7d82e8` | `border.focused` | :12 / :431 | [INFERENCE] closest; Zed has no hover colour for dividers |
| `--color-active-line` | `#2f343ebf` | `#ebebecbf` | `editor.active_line.background` | :61 / :480 | direct. Over the editor background: dark 40+(47−40)·0.749=45, 44+8·0.749=50, 51+11·0.749=59 → `#2d323b`; light → `#efeff0` |
| `--color-selection` | `#74ade83d` | `#5c78e23d` | `players[0].selection` | :153 / :570 | direct (the editor uses `players().local()`) |
| `--color-caret` | `#74ade8` | `#5c78e2` | `players[0].cursor` | :151 / :568 | direct |
| `--color-hover` | `#363c46` | `#dfdfe0` | `ghost_element.hover` | :26 / :445 | direct (subtle-button hover, `button_like.rs:299`) |
| `--color-row-hover` | `#363c46` | `#dfdfe0` | `element.hover` | :20 / :439 | direct (project panel hover, `project_panel.rs:665`) |
| `--color-row-selected` | `#454a56` | `#cacaca` | `element.selected` | :22 / :441 | direct (project panel marked row, `project_panel.rs:667`) |
| `--color-primary` | `#74ade8` | `#5c78e2` | `text.accent` / `icon.accent` | :34 / :453 | direct. Zed has no filled accent button |
| `--color-on-primary` | `#dce0e5` | `#242529` | `text` | :30 / :449 | closest: label of the accent-tinted button (`button_like.rs:74-78`; that button's background is `info.background`, border `info.border`) |
| `--color-problem` | `#d072771a` | `#fbdfd9` | `error.background` | :117 / :534 | direct |
| `--color-problem-border` | `#4c2b2c` | `#f6c6bd` | `error.border` | :118 / :535 | direct |
| `--color-problem-error` | `#d07277` | `#d36151` | `error` | :116 / :533 | direct |
| `--color-problem-warning` | `#dec184` | `#a48819` | `warning` | :146 / :563 | direct |
| `--color-problem-info` | `#74ade8` | `#5c78e2` | `info` | :128 / :545 | direct. Zed also has `hint` `#788ca6`/`#7274a7` (:122/:539) |
| `--color-success-signal` | `#a1c181` | `#669f59` | `success` | :140 / :557 | direct |
| `--color-success` | `#a1c1811a` | `#dfeadb` | `success.background` | :141 / :558 | direct |
| `--color-success-border` | `#38482f` | `#c8dcc1` | `success.border` | :142 / :559 | direct |
| `--color-info` | `#74ade81a` | `#e2e2fa` | `info.background` | :129 / :546 | direct |
| `--color-info-border` | `#293b5b` | `#cbcdf6` | `info.border` | :130 / :547 | direct |
| `--color-search-match` | `#74ade866` | `#5c79e266` | `search.match_background` | :47 / :466 | direct. Active match `search.active_match_background` `#e8af7466` / `#d0a92366` (:48/:467) |
| `--color-diff-wave` | `#878a98` | `#7e8086` | `text.placeholder` | :32 / :451 | closest: the "⋯" fold placeholder text (`editor/src/display_map/fold_map.rs:66`) |
| `--color-syntax-*` | see B | | | | |
| `--color-chunk-*`, `--color-mark-*` | see C | | | | |
| `--color-minimap-slider` | `#c8ccd44c` | `#383a414c` | `minimap_thumb_background` | schema.rs:524 → one.json:52 / :471 | fallback to `scrollbar.thumb.background`, then `ensure_non_opaque`: a=0.298 ≤ 0.7, unchanged (schema.rs:883-893) |
| `--color-minimap-slider-hover` | `#363c46b3` | `#dfdfe0b3` | `minimap_thumb_hover_background` | schema.rs:529 → :53 / :472 | fallback to `scrollbar.thumb.hover_background` `ff`, alpha capped at 0.7; 0.7×255=178.5→179=`b3` [rounding INFERENCE] |
| `--color-minimap-slider-active` | `#c8ccd44c` | `#383a414c` | `minimap_thumb_active_background` | schema.rs:263-267, 534 | the active scrollbar thumb is omitted, so it falls back to the scrollbar thumb, then `ensure_non_opaque` |
| panel border | `#464b57` | `#c9c9ca` | `border` | :10 / :429 | direct |
| side bar background | `#2f343e` | `#ebebec` | `panel.background` | :49 / :468 | direct (`dock.rs:1340`) |
| header / tab bar background | `#2f343e` | `#ebebec` | `tab_bar.background` (active tab `tab.active_background` `#282c33`/`#fafafa`) | :44,:46 / :463,:465 | direct |
| input background | `#282c33` | `#fafafa` | `editor.background` | input_field.rs:158 | direct |
| input border | `#363c46` | `#dfdfe0` | `border.variant` (focused: `border.focused` `#47679e`/`#7d82e8`) | input_field.rs:159,198 | direct |
| menu / drop-down background | `#2f343e` | `#ebebec` | `elevated_surface.background` | context_menu.rs:2278 → styled_ext.rs:7 | direct |
| tooltip background / border | `#2f343e` / `#363c46` | `#ebebec` / `#dfdfe0` | `elevated_surface.background` / `border.variant` | tooltip.rs:226 → styled_ext.rs:7-10 | direct |
| scrollbar thumb | `#c8ccd44c` | `#383a414c` | `scrollbar.thumb.background` | :52 / :471 | direct |
| focus ring | `#47679e` | `#7d82e8` | `border.focused` | :12 / :431 | direct |

## B. Syntax

**Captures used.** TS/TSX/JS captures come from `crates/grammars/src/{typescript,tsx,javascript}/highlights.scm` (TS line numbers given). CSS, JSON and Markdown use `crates/grammars/src/{css,json,markdown,markdown-inline}/highlights.scm`. HTML uses `extensions/html/languages/html/highlights.scm` (in-repo extension). Zed's Vue support is an extension and was not read.

**Lezer side.** The Lezer tags come from the `styleTags` calls in `frontend/node_modules/.pnpm/@lezer+javascript@1.5.6/…/dist/index.js:101-158`, `@lezer+css@1.3.9 …:89-122`, `@lezer+html@1.3.13 …:227-240`, `@lezer+json@1.0.3 …:4-13`, `@lezer+markdown@1.8.0 …:1966-1988,2043-2189` and `@codemirror+lang-vue@0.1.3 …:32-42`.

**LSP colours.** Semantic tokens are off by default (`default.json:1434`), so only tree-sitter colours apply.

| Lezer tag | example | One Dark | One Light | Zed capture → key | source | style |
|---|---|---|---|---|---|---|
| `keyword` | `new` `with` `debugger` | `#b477cf` | `#a449ab` | `@keyword` → keyword | ts:439; one.json:253 | |
| `controlKeyword` | `if` `return` | `#b477cf` | `#a449ab` | `@keyword.control` → keyword | ts:475 | |
| `operatorKeyword` | `typeof` `in` `as` `await` | `#b477cf` | `#a449ab` | `@keyword` / `@keyword.control` → keyword | ts:439,475 | |
| `definitionKeyword` | `const` `class` `interface` `type` | `#b477cf` | `#a449ab` | `@keyword.declaration` → keyword | ts:450 | |
| `moduleKeyword` | `import` `export` `from` | `#b477cf` | `#a449ab` | `@keyword.import` → keyword | ts:456 | |
| `modifier` | `static` `async` `readonly` `get` | `#b477cf` | `#a449ab` | `@keyword` → keyword | ts:439 | |
| `bool` | `true` | `#bf956a` | `#ad6e25` | `@boolean` | ts:251; one.json:198 | |
| `null` | `null` (also `undefined`) | `#dfc184` | `#c18401` | `@constant.builtin` → constant | ts:246; :213 | |
| `self` | `this` | `#bf956a` | `#ad6e25` | `@variable.special` | ts:239; :403 | |
| `atom` | `super` (JS) | `#bf956a` | `#ad6e25` | `@variable.special` | ts:241 | |
| `atom` | CSS `flex` `solid` | `#dfc184` | `#c18401` | `@constant.builtin` → constant | css.scm (plain_value) | |
| `string` | `"hi"` | `#a1c181` | `#649f57` | `@string` | ts:269; :348 | |
| `special(string)` | `` `a${b}` `` | `#a1c181` | `#649f57` | `@string` | ts:269 | |
| `number` | `42` | `#bf956a` | `#ad6e25` | `@number` | ts:277; :278 | |
| `regexp` | `/a+/g` | `#bf956a` | `#ad6e26` | `@string.regex` | ts:273; :358 | |
| `escape` | `\n` | `#878e98` | `#7c7e86` | `@string.escape` | ts:271; :353 | |
| `lineComment` / `blockComment` | `// x` | `#5d636f` | `#a2a3a7` | `@comment` | ts:261; :203 | |
| `docComment` | — | `#878e98` | `#7c7e86` | `comment.doc` | :208 | Lezer JS does not emit this tag (`BlockComment`→`blockComment`) |
| `variableName` | `x` | `#acb2be` | `#242529` | `@variable` | ts:2; :393 | ALL_CAPS → `@constant` `#dfc184`/`#c18401` (ts:98-103) |
| `definition(variableName)` | `const x =` | `#acb2be` | `#242529` | `@variable` (with a function value: `@function`) | ts:2,170 | |
| parameter (Lezer: `definition(variableName)`) | `(a) =>` | `#d07277` | `#d3604f` | `@variable.parameter` | ts:187-236; :398 | Zed-only distinction; Lezer has no parameter tag |
| `function(variableName)` | `foo()` | `#73ade9` | `#5b79e3` | `@function` | ts:116; :243 | |
| `function(definition(variableName))` | `function foo` | `#73ade9` | `#5b79e3` | `@function` | ts:136 | |
| `propertyName` | `a.b`, `{b: 1}` | `#d07277` | `#d3604f` | `@property` | ts:106; :303 | |
| `function(propertyName)` | `a.b()` | `#73ade9` | `#5b79e3` | `@function.method` → function | ts:123 | |
| `definition(propertyName)` | method `m() {}` / field `x = 1` | `#73ade9` / `#d07277` | `#5b79e3` / `#d3604f` | `@function.method` / `@property` | ts:142,106 | `constructor` → `@constructor` `#73ade9`/`#5c78e2` (ts:145; :218) |
| `special(propertyName)` | `#priv` | `#d07277` | `#d3604f` | `@property` | ts:112 | |
| `className` | `new Foo` | `#6eb4bf` | `#3882b7` | `@type.class` → type | ts:126; :388 | |
| `definition(className)` | `class Foo` | `#6eb4bf` | `#3882b7` | `@type.class` → type | ts:30 | |
| `typeName` | `: string`, `Foo` | `#6eb4bf` | `#3882b7` | `@type` / `@type.builtin` | ts:13-17 | |
| `definition(typeName)` | `interface Foo` | `#6eb4bf` | `#3882b7` | `@type` | ts:20,27 | |
| `labelName` | JS `outer:` | `#acb2be` | `#242529` | no capture (editor fg) | — | |
| `labelName` | CSS `#id` | `#dfc184` | `#669f59` | `@selector.id` → selector | css.scm; :338 | |
| `namespace` | CSS `@namespace svg` | `#dce0e5` | `#242529` | `@namespace` | css.scm; :273 | |
| arithmetic / logic / compare / bitwise / update operators, `definitionOperator` `=` | `+` `&&` `===` `=` | `#6eb4bf` | `#3882b7` | `@operator` | ts:289-336; :283 | |
| `function(punctuation)` | `=>` | `#6eb4bf` | `#3882b7` | `@operator` | ts:336 | |
| `punctuation` | `:` `...` | `#b2b9c6`; in a type annotation `#b1574b`; `...` `#6eb4bf` | `#4d4f52` / `#b92b46` / `#3882b7` | `@punctuation.delimiter` / `.special` / `@operator` | ts:287,382 | |
| `separator` | `,` `;` | `#b2b9c6` | `#4d4f52` | `@punctuation.delimiter` | ts:287; :318 | |
| `derefOperator` | `.` | `#b2b9c6` | `#4d4f52` | `@punctuation.delimiter` | ts:287 | |
| `paren` / `squareBracket` / `brace` | `( [ {` | `#b2b9c6` | `#4d4f52` | `@punctuation.bracket` | ts:354; :313 | |
| `special(brace)` | `${ }` | `#b1574b` | `#b92b46` | `@punctuation.special` | ts:357; :333 | |
| `meta` | decorator `@` | `#b1574b` | `#b92b46` | `@punctuation.special` | ts:373 | the decorator name is `@function`/`@variable` |
| `tagName` / `standard(tagName)` | `<div>` (HTML, JSX, Vue) | `#74ade8` | `#5c78e2` | `@tag` / `@tag.jsx` | html.scm; tsx:470-480; :373 | JSX components `@tag.component.jsx` → tag (tsx:410-468) |
| `angleBracket` | `<` `/>` | `#b2b9c6` | `#4d4f52` | `@punctuation.bracket.(jsx\|html)` → punctuation.bracket | tsx:485-501; html.scm | |
| `attributeName` | `class=` | `#74ade8` | `#5c78e2` | `@attribute` | html.scm; tsx:483; :193 | |
| `attributeValue` | `"x"` | `#a1c181` | `#649f57` | `@string` | html.scm | |
| `content` | HTML/JSX text, Markdown paragraph | `#acb2be` | `#242529` | `@text.jsx` / `@text` (no key) → editor fg | tsx:506; md.scm | |
| `character` | `&amp;` | `#bf956a` | `#ad6e26` | `@string.special` | html.scm; tsx:508; :363 | |
| `documentMeta` | `<!doctype>` | `#74ade8` | `#5c78e2` | `@tag.doctype` → tag | html.scm | |
| `heading1`–`6` | `# T` | `#d07277` | `#d3604f` | `@title.markup` → title | md.scm; :383 | weight 400 |
| `heading` | GFM table header | `#acb2be` | `#242529` | `@text` (no key) | md.scm | |
| `processingInstruction` | `#` `*` `-` `` ``` `` marks | heading `#d07277`; list marker `#d07277`; fence/info `#acb2be` | `#d3604f` / `#d3604f` / `#242529` | `@title.markup` / `@punctuation.list_marker.markup` / `@punctuation.embedded.markup` → punctuation | md.scm; :323,:308 | |
| `emphasis` | `*a*` | `#74ade8` | `#5c78e2` | `@emphasis.markup` | md-inline.scm; :228 | `font_style` null, so not italic |
| `strong` | `**a**` | `#bf956a` | `#ad6e25` | `@emphasis.strong.markup` | :233 | bold (700) |
| `strikethrough` | `~~a~~` | `#acb2be` | `#242529` | `@strikethrough.markup` (no key) | md-inline.scm | |
| `link` | `[text]` | `#73ade9` | `#5b79e3` | `@link_text.markup` | :263 | italic |
| `url` | `(http://…)` | `#6eb4bf` | `#3882b7` | `@link_uri.markup` | :268 | |
| `monospace` | `` `code` `` | `#a1c181` | `#649f57` | `@text.literal.markup` | :378 | |
| `quote` | `> q` | marker `#d07277`, text `#acb2be` | `#d3604f` / `#242529` | `@punctuation.markup` / `@text` | md.scm; :328 | |
| `contentSeparator` | `---` | `#d07277` | `#d3604f` | `@title.markup` | md.scm | |
| `list` | list item | `#acb2be` | `#242529` | `@text` | md.scm | |
| `labelName` | Markdown code info | `#acb2be` | `#242529` | `@punctuation.embedded.markup` → punctuation | md.scm | |
| CSS `propertyName` | `color:` | `#d07277` | `#d3604f` | `@property` | css.scm | |
| CSS `variableName` | `--x` | `#acb2be` | `#242529` | `@variable` (later pattern beats `@property`) | css.scm | |
| CSS `className` | `.foo` | `#dfc184` | `#669f59` | `@selector.class` → selector | css.scm; :338 | |
| CSS `constant(className)` | `:hover` | `#74ade8` | `#5c78e2` | `@selector.pseudo` | :343 | |
| CSS `tagName` | `div` | `#74ade8` | `#5c78e2` | `@tag` | css.scm | |
| CSS `definitionOperator` | `*` `&` | `#74ade8` | `#5c78e2` | `@tag` (universal / nesting selector) | css.scm | |
| CSS `unit` | `px` | `#6eb4bf` | `#3882b7` | `@type.unit` → type | css.scm | |
| CSS `color` | `#fff` | `#bf956a` | `#ad6e26` | `@string.special` | css.scm | |
| CSS `definitionKeyword` / `keyword` / `modifier` | `@media`, `from`, `!important` | `#b477cf` | `#a449ab` | `@keyword` | css.scm | |
| CSS `operatorKeyword` | `rgb(` (Callee) / `and` | `#73ade9` / `#b477cf` | `#5b79e3` / `#a449ab` | `@function` / `@keyword.operator` | css.scm | |
| CSS `labelName` | keyframe name | `#dfc184` | `#c18401` | `@constant.builtin` | css.scm | |
| JSON `propertyName` | `"key":` | `#d07277` | `#d3604f` | `@property.json_key` → property | json.scm | |
| JSON `null` | `null` | `#dfc184` | `#c18401` | `@constant.builtin` | json.scm | |
| Vue `keyword` (`VueAttributeName`) | `v-if` `@click` | UNRESOLVED | UNRESOLVED | Vue extension (non-goal) | — | |

**Groups (Zed).**
- `#b477cf`/`#a449ab`: every keyword kind, CSS at-rules and `!important`.
- `#73ade9`/`#5b79e3`: functions, methods, CSS functions, Markdown link text.
- `#74ade8`/`#5c78e2`: tags, attributes, doctype, CSS pseudo, `*`/`&`, emphasis. These are a separate key from functions and only 1 step apart.
- `#6eb4bf`/`#3882b7`: types, classes, operators, `=>`, CSS units, URLs.
- `#bf956a`/`#ad6e25`: numbers, booleans, `this`/`super`, regexp, CSS colours, entities, strong.
- `#dfc184`/`#c18401`: null/undefined, ALL_CAPS constants, CSS values and keyframe names. In dark, CSS selectors are this same colour.
- `#d07277`/`#d3604f`: properties, JSON keys, CSS properties, parameters, headings, list markers.
- `#a1c181`/`#649f57`: strings, attribute values, inline code.
- `#878e98`/`#7c7e86`: escapes.
- `#5d636f`/`#a2a3a7`: comments.
- `#b2b9c6`/`#4d4f52`: brackets and delimiters.
- `#b1574b`/`#b92b46`: `${}`, `@`, type `:`.
- `#acb2be`/`#242529`: variables and plain text.

That is 13 distinctions; parameters need a tag Lezer lacks.

## C. Change colours

| kind | One Dark | One Light | Zed key | source | how resolved |
|---|---|---|---|---|---|
| added line background | `#27a6571f` | `#27a65729` | `editor_diff_hunk_added_background` | schema.rs:16,19,614-618; one.json:100/:519 | omitted, so `version_control.added` × opacity: dark 0.12×255=30.6→`1f`, light 0.16→40.8→`29` |
| deleted line background | `#e06c761f` | `#e06c7629` | `editor_diff_hunk_deleted_background` | schema.rs:629-633; :104/:523 | same math applied to `version_control.deleted` |
| hollow (secondary) background | `#27a6570f` / `#e06c760f` | `#27a65714` / `#e06c7614` | `…_hollow_background` | schema.rs:17,20,619-638 | 0.06→15.3→`0f`; 0.08→20.4→`14` |
| hollow border | `#27a6575c` / `#e06c765c` | `#27a6577a` / `#e06c767a` | `…_hollow_border` | schema.rs:18,21 | 0.36→91.8→`5c`; 0.48→122.4→`7a` |
| word added | `#2ea04859` | `#2ea04859` | `version_control.word_added` | :102 / :521; element.rs:4749 | direct |
| word deleted | `#78081bcc` | `#f85149cc` | `version_control.word_deleted` | :103 / :522 | direct |
| gutter strip and scrollbar mark: added | `#27a657` | `#27a657` | `version_control.added` | :100 / :519; element.rs:5370-5383, 6386-6394 | direct |
| … modified | `#d3b020` | `#d3b020` | `version_control.modified` | :101 / :520 | direct |
| … deleted | `#e06c76` | `#e06c76` | `version_control.deleted` | :104 / :523 | direct |
| conflict: ours rows + `<<<<<<<` line | `#a1c1811a` | `#2b9a6680` | `version_control.conflict_marker.ours` | :105 / light omitted → default_colors.rs:179 (`green().light().step_10()`=`#2b9a66`, :2105) ×0.5 | conflict_view.rs:303,319-322; 0.5×255=127.5→`80` [rounding INFERENCE] |
| conflict: whole region, theirs rows + `>>>>>>>` line | `#74ade81a` | `#0588f080` | `version_control.conflict_marker.theirs` | :106 / default_colors.rs:180 (`blue().light().step_10()`=`#0588f0`, :1849) ×0.5 | conflict_view.rs:304,318,326-329 |
| conflict action-bar border | `#74ade833` | `#5c78e233` | `text_accent.opacity(0.2)` | conflict_view.rs:646 | 0.2×255=51=`33` |
| conflict status (file list) | `#dec184`, background `#dec1841a`, border `#5d4c2f` | `#a48819`, `#faf2e6`, `#f4e7d1` | `conflict` / `.background` / `.border` | :107-109 / :524-526; color.rs:96 | direct |
| `version_control_conflict` | `#878a98` | `#7e8086` | falls back to status `ignored` | schema.rs:776-780; :125 / :542 | fallback |
| created / modified / deleted status | `#a1c181`(bg `1a`) / `#dec184` / `#d07277` | `#669f59` / `#a48819` / `#d36151` | `created`, `modified`, `deleted` | :110,:131,:113 / :527,:548,:530 | direct (color.rs:94-99) |
| diff-file syntax | `#98c379` / `#e06c75` | `#50a14f` / `#e45649` | `diff.plus` / `diff.minus` | :413,:418 | direct |

**Proposed mapping onto yamt:**
- `chunk-inserted` → added line background.
- `chunk-deleted` → deleted line background.
- `chunk-modified` is a gap: Zed draws a modified hunk as deleted + added rows. Closest is `modified.background` `#dec1841a`/`#faf2e6` (:132/:549).
- `chunk-conflict` → the theirs-region tint (Zed paints the whole conflict region in it; ours is a second tint yamt lacks).
- `chunk-modified-word` → `word_added`.
- `chunk-conflict-word` is a gap. Closest is `word_added`.
- `chunk-modified-removal` → `version_control.deleted`.
- `chunk-conflict-removal` → `conflict`.
- `mark-inserted`, `mark-modified`, `mark-deleted` → `version_control.added`, `.modified`, `.deleted`.
- `mark-conflict` is a gap: Zed's scrollbar has no conflict mark. Closest is `conflict` `#dec184`/`#a48819`.

## D. Shape

- **Panels are flat**, divided by 1 px `border` lines: the dock edge (dock.rs:1341), the tab bar bottom and sides (tab_bar.rs:109-148), and pane splits (`pane_group_border` → `border`).
- **Buttons:** `rounded_sm` = 4 px (button_like.rs:805-809; gpui_macros/styles.rs:1241-1243).
- **Inputs:** `rounded_md` = 6 px, 1 px `border.variant` (input_field.rs:192-195).
- **Menus, tooltips, popovers:** `rounded_lg` = 8 px, 1 px `border.variant` and a shadow (styled_ext.rs:6-11; tooltip.rs:226; context_menu.rs:2278).
- **Fold placeholder:** `rounded_xs` = 2 px.
- All radii assume rem = 16 px (`ui_font_size` 16, default.json:71) [INFERENCE: the rem follows the UI font size].

## E. Kind

One Dark is `"appearance": "dark"` (one.json:8). One Light is `"appearance": "light"` (one.json:427).

---

# Atom 1.60.0: One Dark / One Light

**Sources.** Theme files come from `atom/atom@v1.60.0/packages/one-{dark,light}-syntax`. The default themes are `['one-dark-ui','one-dark-syntax']` (`src/config-schema.js:103`). Tree-sitter parsing is on by default (`config-schema.js:395-397`), so the grammars are the tree-sitter ones from the bundled tarballs listed in `package.json`: language-typescript 0.6.3, language-javascript 0.134.1, language-css 0.45.1, language-html 0.53.1, language-json 1.0.5, and language-gfm 0.90.8 (TextMate). The github package is 0.36.9 (`package.json:71`).

**Rule order.** `index.less` imports `syntax-legacy/_base.less` first and `syntax/base.less` later. Where the two have equal specificity, the later `syntax/base.less` wins.

**Colour math.** All hues were converted with LESS's hsl→rgb, then each channel ×255 and rounded. I did this by hand; `node` was not available, since this run had no shell. The palette below reproduces the known One Dark/One Light hex values. I hand-checked every value except `#cb7701`, the one entry that does not match the commonly cited One Light orange (see doubts).

**Palette (colors.less, lines 7-9, 12-15, 17-18, 20-21, 24-28; same layout in both themes):**

| var | One Dark: hsl → hex | One Light: hsl → hex |
|---|---|---|
| `@mono-1` | (220,14%,71%): C=.0812, m=.6694 → `#abb2bf` | (230,8%,24%) → `#383a42` |
| `@mono-2` | (220,9%,55%) → `#828997` | (230,6%,44%) → `#696c77` |
| `@mono-3` | (220,10%,40%) → `#5c6370` | (230,4%,64%) → `#a0a1a7` |
| `@hue-1` | (187,47%,55%) → `#56b6c2` | (198,99%,37%) → `#0184bc` |
| `@hue-2` | (207,82%,66%) → `#61afef` | (221,87%,60%) → `#4078f2` |
| `@hue-3` | (286,60%,67%) → `#c678dd` | (301,63%,40%) → `#a626a4` |
| `@hue-4` | (95,38%,62%) → `#98c379` | (119,34%,47%) → `#50a14f` |
| `@hue-5` | (355,65%,65%) → `#e06c75` | (5,74%,59%) → `#e45649` |
| `@hue-5-2` | (5,48%,51%) → `#be5046` | (344,84%,43%) → `#ca1243` |
| `@hue-6` | (29,54%,61%) → `#d19a66` | (35,99%,36%) → `#b76b01` |
| `@hue-6-2` | (39,67%,69%) → `#e5c07b` | (35,99%,40%): C=.792, X=.462, m=.004 → `#cb7701` |

## A. Window and editor

`syntax-variables.less` line numbers are the same in both themes.

| yamt token | One Dark | One Light | Atom variable | source | how resolved |
|---|---|---|---|---|---|
| `--color-panel` (editor) | `#282c34` | `#fafafa` | `@syntax-background-color` = `@syntax-bg` | colors.less:25; syntax-variables.less:10; editor.less `atom-text-editor` | hsl(220,13%,18%): C=.0468, m=.1566 → 40,44,52 / hsl(230,1%,98%) → 250,250,250 |
| `--color-code` | `#abb2bf` | `#383a42` | `@syntax-text-color` = `@mono-1` | syntax-variables.less:6 | alias |
| `--color-gutter` | `#636d83` | `#9d9d9f` | `@syntax-gutter-text-color` | :22; colors.less:26 | dark `darken(@mono-1,26%)` → l=.71−.26=.45 → 98.7,109.4,130.8; light `darken(@syntax-bg,36%)` → l=.62 → 157.1,157.4,159.1 |
| `--color-gutter-active` | `#abb2bf` (row background `#3a3f4b`) | `#383a42` (row background `#e5e5e6`) | `@syntax-gutter-text-color-selected`, `…-background-color-selected` | :23,:25 | `@syntax-fg`; dark `lighten(bg,8%)` → l=.26; light `darken(bg,8%)` → l=.90 |
| `--color-active-line` | `#99bbff0a` (= `#2d323c` over the editor background) | `#383a420d` (= `#f0f0f1`) | `@syntax-cursor-line` | :50 | dark hsla(220,100%,80%,.04): 153,187,255, a=.04×255=10.2→`0a`; composite 40+113×.04=44.5, 44+143×.04=49.7, 52+203×.04=60.1. Light fade(@mono-1,5%): a=12.75→`0d`; composite 250−194×.05=240.3, 240.4, 240.8 |
| `--color-selection` | `#3e4451` | `#e5e5e6` | `@syntax-selection-color` | :8 | dark `lighten(bg,10%)` → l=.28 → 62.1,68.3,80.7; light `darken(bg,8%)` → l=.90 → 229.2,229.3,229.8 |
| `--color-caret` | `#528bff` | `#526eff` | `@syntax-cursor-color` = `@syntax-accent` | :7; colors.less:28 | hsl(220,100%,66%) → 81.6,139.4,255. Light hsl(230,…): G = 110.4999…, which rounds to 110 or 111 depending on float error (the known value is `6e`). Cursor is drawn as a 2 px left border (editor.less) |
| `--color-search-match` | `#528bff3d` | `#526eff33` | `@syntax-result-marker-color` | :18 | fade(accent,24%) → 61.2→`3d`; light fade 20% → 51=`33`. The current result adds a 2 px accent border with radius 2 px (editor.less) |
| `--color-diff-wave` | `#abb2bf` | `#383a42` | `.fold-marker:after` colour = `@syntax-gutter-text-color-selected` | editor.less (last rule) | closest: Atom's fold marker for collapsed lines |
| indent and wrap guide | `#abb2bf26` | `#383a4233` | `@syntax-guide` | colors.less:27 | fade(fg,15%)=38.25→`26`; fade(fg,20%)=51→`33` |
| `--color-window`, `--color-separator`, `--color-control-border`, `--color-fg`, `--color-fg-muted`, `--color-handle*`, `--color-hover`, `--color-row-hover`, `--color-row-selected`, `--color-primary`, `--color-on-primary`, `--color-problem*`, `--color-success*`, `--color-info*`, panel border, header/tab bar, input, menu, tooltip, scrollbar thumb, `--color-panel-inline` | UNRESOLVED | UNRESOLVED | `one-dark-ui` / `one-light-ui` `styles/ui-variables.less` | — | Not fetched: the run hit its request budget before the UI packages were read |
| `--color-minimap-slider*` | UNRESOLVED | UNRESOLVED | — | — | Atom has no built-in minimap. The closest element would be the UI scrollbar thumb (not read) |

## B. Syntax

TS lines refer to `tree-sitter-typescript.cson`. JS selectors are quoted from `tree-sitter-javascript.cson`. "L" is legacy `syntax-legacy/_base.less`; "N" is `syntax/base.less` (dark line numbers; light line numbers differ where marked).

| Lezer tag | example | One Dark | One Light | Atom scope | rule (source) | style |
|---|---|---|---|---|---|---|
| `keyword` / `controlKeyword` / `moduleKeyword` | `if` `return` `import` `new` | `#c678dd` | `#a626a4` | `keyword.control` (TS:190-213, 181) | `.syntax--keyword` L:23, N:13 | |
| `operatorKeyword` | `typeof` `in` `as` | `#c678dd` | `#a626a4` | TS `keyword.control` (TS:178-182); JS `keyword.operator.typeof` | L:30 / N:13 | `keyof`/`satisfies` are unscoped → mono-1 |
| `definitionKeyword` | `const` `let` `class` `function` / `interface` `type` | `#c678dd` | `#a626a4` | `storage.type`, `storage.modifier` (TS:128-134); `keyword.modifier` (TS:224-234) | `.syntax--storage` L:43; `.syntax--keyword` | |
| `modifier` | `static` / `async` / `get` `set` | `#c678dd`; `get`/`set` in TS `#56b6c2` | `#a626a4` / `#0184bc` | `storage.modifier`, `keyword.control`, `keyword.operator.setter` (TS:184) | typescript.less `.syntax--source.syntax--ts .syntax--keyword.syntax--operator` → `@hue-1` | |
| `bool` / `null` | `true` `null` `undefined` | `#d19a66` | `#b76b01` | `constant.language.*` (TS:107-110) | `.syntax--constant` L:61, N:148 | |
| `self` | `this` | `#abb2bf` | `#383a42` | not scoped in TS or JS cson → editor text | — | |
| `atom` | `super(…)` | `#56b6c2` | `#0184bc` | `support.function.super` (TS:79) | `.syntax--support.syntax--function` L:170 | bare `super` is unscoped |
| `string` / `special(string)` | `"a"`, template string | `#98c379` | `#50a14f` | `string.quoted(.template)` (TS:103,106) | `.syntax--string` L:97, N:108 | inside `${}`: `embedded.source` → mono-1 (L:100) |
| `special(brace)` | `${` `}` | `#be5046` | `#ca1243` | `punctuation.section.embedded` (TS:114-117) | L:148-150 (3 classes beat N:102) | |
| `number` | `42` | `#d19a66` | `#b76b01` | `constant.numeric` (TS:102) | L:72 | |
| `regexp` | `/a/` | `#98c379` | `#50a14f` | `string.regexp` (TS:104) | N:127 `@hue-4` beats L:104 `@hue-1` (equal specificity, later file) | |
| `escape` | `\n` | `#98c379` | `#50a14f` | `constant.character.escape` (TS:105) | N:156 beats L:68 (`@hue-1`) | |
| comment | `// x` | `#5c6370` | `#a0a1a7` | `comment.block` / `comment.line` (TS:111) | L:3-5, N:276-278 | italic |
| `variableName` / `definition(variableName)` | `x` | `#abb2bf` | `#383a42` | unscoped → editor text (TS:84-100 match only special names) | — | ALL_CAPS → `constant.other` `#d19a66`/`#b76b01`. Capitalized → TS `support.type` `#56b6c2`/`#0184bc`, JS `meta.class` `#e5c07b`/`#cb7701` (L:207). `window`/`document`/`console` → `support.variable` `#e06c75` |
| parameter | `(a)` | `#abb2bf` | `#383a42` | TS: unscoped; JS `variable.parameter.function` | L:92 | |
| `function(variableName)` | `foo()` | `#61afef` | `#4078f2` | `entity.name.function` (TS:74-77) | L:180 | `require` → `support.function` `#56b6c2` |
| `function(definition(variableName))` | `function foo` | JS `#61afef` / TS `#abb2bf` | JS `#4078f2` / TS `#383a42` | JS `function_declaration > identifier` → `entity.name.function`; TS cson only has `function > identifier` (TS:71) | L:180 | [INFERENCE] the TS declaration node is `function_declaration`, so the name is unscoped |
| `propertyName` / `definition(propertyName)` | `a.b`, `{b: 1}` | `#e06c75` | `#e45649` | `variable.other.object.property` (TS:41-48) | `.syntax--variable` L:85 | ALL_CAPS → `#d19a66` |
| `function(propertyName)` / method definition | `a.b()`, `m() {}` | `#61afef` | `#4078f2` | `entity.name.function` (TS:81-82, 219-222) | L:180 | |
| `special(propertyName)` | `#p` | `#abb2bf` | `#383a42` | unscoped | — | |
| `typeName` / `definition(typeName)` / `className` / `definition(className)` (TS) | `Foo`, `string`, `class Foo` | `#56b6c2` | `#0184bc` | `support.storage.type` / `support.type` (TS:57-60, 215-217) | `.syntax--support.syntax--type` L:166 (beats `.syntax--storage`) | |
| `className` (JS) | `new Foo` | `#e5c07b` | `#cb7701` | `meta.class` | L:207 | |
| operators | `+` `===` `=` `:` `?` `...` | TS/TSX `#56b6c2`; JS `#c678dd` | TS `#0184bc`; JS `#a626a4` | `keyword.operator.js` (TS:137-176) | typescript.less (TSX program is also `source.ts`, tsx.cson:58); JS L:30 | |
| `function(punctuation)` | `=>` | `#c678dd` | `#a626a4` | `storage.type.function.arrow` (TS:135) | L:43 | |
| `separator` / `derefOperator` / `paren` / `squareBracket` / `brace` | `, ; . ( [ {` | `#abb2bf` | `#383a42` | `meta.delimiter.*`, `punctuation.definition.*`, `punctuation.terminator` (TS:120-126,187-188) | N:88 `.syntax--punctuation` | |
| `meta` | `@decorator` | `#abb2bf` | `#383a42` | no decorator rule in the cson | — | |
| `tagName` | `<div>` HTML / JSX | `#e06c75` | `#e45649` | `entity.name.tag` (html.cson; tsx.cson:231-233) | L:193 | [INFERENCE] JSX components are also `entity.name.tag`: the later identical selector overwrites the `support.type` rule |
| `angleBracket` | `<` `>` | HTML `#abb2bf`; TSX `#56b6c2` | `#383a42` / `#0184bc` | HTML `punctuation.definition.tag.*`; TSX `"<"` → `keyword.operator.js` | N:88 / typescript.less | [INFERENCE] TSX case |
| `attributeName` | `class=` | `#d19a66` | `#b76b01` | `entity.other.attribute-name` | L:197 | |
| `attributeValue` | `"x"` | `#98c379` | `#50a14f` | `string.html` / `string.quoted` | L:97 | |
| `content` / `character` / `documentMeta` | text, `&amp;`, `<!doctype>` | `#abb2bf` | `#383a42` | unscoped / unscoped / `meta.tag.doctype.html` | L:242 | |
| CSS `tagName` / `definitionOperator` | `div`, `*` `&` | `#e06c75` | `#e45649` | `entity.name.tag` | L:193 | |
| CSS `className` / `constant(className)` | `.a`, `:hover` | `#d19a66` | `#b76b01` | `entity.other.attribute-name.class` / `.pseudo-class` | L:197 | |
| CSS `labelName` (#id) | `#a` | `#61afef` | `#4078f2` | `entity.other.attribute-name.id` | L:200 | |
| CSS `propertyName` | `color:` | `#abb2bf` | `#383a42` | `support.property-name` | legacy css.less `.syntax--property-name.syntax--support` → mono-1 | |
| CSS `variableName` | `--x` | `#e06c75` | `#e45649` | `variable.css` | L:85 | |
| CSS `atom` (values) | `flex` | `#abb2bf` | `#383a42` | `support.constant.property-value.css` | css.less (both) `.syntax--support` → mono-1 | named colours → `#d19a66` (new css.less `.syntax--constant.syntax--color`) |
| CSS `number` / `unit` / `color` | `3px`, `#fff` | `#d19a66` | `#b76b01` | `numeric.constant`, `keyword.other.unit`, `constant.other.color` | new css.less numeric/color (0,4,0); L:38 | |
| CSS `operatorKeyword` (Callee) | `rgb(` | `#56b6c2` | `#0184bc` | `support.function` | L:170 | |
| CSS `definitionKeyword` / `modifier` / combinators | `@media` `!important` `>` | `#c678dd` | `#a626a4` | `keyword.control.at-rule`, `keyword.other.important.css`, `keyword.operator.combinator` | L:23 | |
| CSS `namespace` / `punctuation` | `svg\|`, `:` | `#abb2bf` | `#383a42` | `entity.namespace.name` / unscoped | N:33 | |
| JSON `propertyName` | `"k"` | `#e06c75` | `#e45649` | `string.quoted.double.dictionary.key.json` | json.less `.syntax--meta…dictionary.syntax--json > .syntax--string.syntax--quoted.syntax--json` | |
| JSON `string` / `number` / `bool` / `null` | | `#98c379` / `#d19a66` | `#50a14f` / `#b76b01` | `string.quoted.double`, `constant.numeric`, `constant.language` | L:97, L:61 | |
| `heading1`–`6` | `# T` | `#e06c75` | `#e45649` | `markup.heading.heading-N.gfm` (gfm.json:147-237) | N:176 | normal weight |
| `emphasis` / `strong` | `*a*` / `**a**` | `#c678dd` / `#d19a66` | `#a626a4` / `#b76b01` | `markup.italic.gfm` / `markup.bold.gfm` (gfm.json:1733,1690) | N:198 / N:192 | italic / bold |
| `strikethrough` | `~~a~~` | `#e06c75` | `#e45649` | `markup.strike.gfm` (:1407) | N:210 | |
| `monospace` | `` `c` `` | `#98c379` | `#50a14f` | `markup.raw.gfm` (:1438) | N:215 | |
| `link` | `[text]` | `#61afef` | `#4078f2` | `entity.gfm` inside `link` (:1548) | gfm.less `.syntax--link .syntax--entity` | |
| `url` | `(http…)` | `#56b6c2` | `#0184bc` | `markup.underline.link.gfm` (:1557) | N:204/220 | underline |
| `quote` / `contentSeparator` | `> q`, `---` | `#5c6370` | `#a0a1a7` | `comment.quote.gfm` / `comment.hr.gfm` (:1317,:1275) | L:3 | italic |
| `processingInstruction` | list `-`, `#` | list marker `#e06c75`; heading `#` `#e06c75` | `#e45649` | `variable.unordered.list.gfm` (:1293); `markup.heading.marker.gfm` | L:85 / N:176 | fence `support.gfm` → mono-1 |
| Vue tags | `v-if` | UNRESOLVED | UNRESOLVED | Atom ships no Vue grammar | — | |

**Groups (Atom).**
- hue-3: every keyword, storage (`const`/`function`/`class`), `=>`, JS operators, CSS at-rules and combinators, Markdown italic.
- hue-1: TS types and classes, TS/TSX operators, `super()`, `require`, CSS functions, URLs.
- hue-2: function calls, definitions and methods, CSS `#id`, Markdown link text.
- hue-4: strings, regexp, escapes, attribute values, inline code.
- hue-5: properties, tags, JSON keys, CSS `--vars`, headings, list markers, strike.
- hue-6: numbers, booleans, null, ALL_CAPS constants, attribute names, CSS classes, pseudo-classes, units and colours, bold.
- hue-6-2: JS classes.
- hue-5-2: `${}`.
- mono-1: variables, `this`, parameters, punctuation, CSS properties and values.
- mono-3 italic: comments, quotes.

That is 10 colour groups.

## C. Change colours

| kind | One Dark | One Light | Atom variable | source | math |
|---|---|---|---|---|---|
| added | `#43d08a` | `#2db448` | `@syntax-color-added` | syntax-variables.less:29 | hsl(150,60%,54%): C=.552, X=.276, m=.264 → 67.3,208.1,137.7 / hsl(132,60%,44%) → 44.9,179.5,71.8 |
| modified | `#e0c285` | `#f2a60d` | `@syntax-color-modified` | :30 | hsl(40,60%,70%) → 224.4,193.8,132.6 / hsl(40,90%,50%) → 242.3,165.8,12.8 |
| removed | `#e05252` | `#ff1414` | `@syntax-color-removed` | :31 | hsl(0,70%,60%) → 224.4,81.6,81.6 / hsl(0,100%,54%) → 255,20.4,20.4 |
| renamed | `#33a0ff` | `#52aeff` | `@syntax-color-renamed` | :28 | hsl(208,100%,60%) → 51,159.8,255 / (208,100%,66%) → 81.6,174.1,255 |
| removed-line dotted underline in gutter | `#e0525280` | `#ff141480` | `fade(@syntax-color-removed,50%)` | editor.less `.git-line-removed::after` | 0.5 → `80` [rounding] |
| diff-file syntax inserted / deleted / changed | `#98c379` / `#e06c75` / `#c678dd` | `#50a14f` / `#e45649` / `#a626a4` | `markup.inserted/deleted/changed` | L:274-300 | alias |
| git-diff gutter markers, any line tints | UNRESOLVED | UNRESOLVED | `packages/git-diff/styles` | — | not read (run budget) |
| conflict, ours/theirs, marker lines (github 0.36.9) | UNRESOLVED | UNRESOLVED | `atom/github@v0.36.9/styles` | — | not read (run budget) |

**Proposed mapping onto yamt:**
- `mark-inserted`, `mark-modified`, `mark-deleted` → added, modified, removed.
- `chunk-modified-removal` → removed.
- `chunk-*` tints, word marks and every conflict colour: open until git-diff and github are read. The syntax variables define no tint and no conflict colour.

## D. Shape

The only shape read is the editor's find-result marker: radius 2 px and a 2 px border (editor.less). Panels, lines and the radii of buttons, inputs, menus and tooltips are UNRESOLVED, because one-dark-ui/one-light-ui were not read. [INFERENCE] flat panels with 1 px lines.

## E. Kind

One Dark is dark and One Light is light. This is [INFERENCE] from the names and the background lightness (18% / 98%); the packages' `package.json` was not read.

---

**Open doubts**
1. **Atom UI not read.** Every Atom UI token (window, side panels, text, borders, rows, buttons, problems, notices, inputs, menus, tooltips, scrollbar), the git-diff package styles and github 0.36.9's conflict colours still need reading from `one-{dark,light}-ui/styles/ui-variables.less`, `packages/git-diff/styles` and `atom/github@v0.36.9/styles`. The request budget ran out before them.
2. **Atom LESS math is hand-computed.** It was done without `node`. `#526eff` (G = 110.5) and `#cb7701` need checking with `less`. `#cb7701` follows the file's `hsl(35,99%,40%)`, not the commonly quoted `#c18401`.
3. **Atom variables are not red under tree-sitter.** The owner expects "Atom's red variables", but with tree-sitter on (the default) plain identifiers have no scope and are drawn in `#abb2bf`. Only properties are red. The red variables come from the TextMate grammars.
4. **Atom regexp and escape colours.** They resolve to green because `syntax/base.less` overrides the legacy cyan at equal specificity. This follows from the cascade but was not checked on screen.
5. **Atom tree-sitter scope rules.** The overwrite rule for duplicate selectors (JSX components, TSX `<`) and the unscoped TS `function foo` name are inferred; `syntax-scope-map.js:14-110` was only partly read.
6. **Zed alpha and rounding.** The alpha byte rounding (0.7→`b3`, 0.5→`80`) is assumed. Zed also round-trips colours through HSLA, which may shift a channel by 1.
7. **Zed has no conflict tint for yamt's single conflict colour.** It paints ours and theirs separately, and in One Light both fall back to the code defaults.
8. **Zed emphasis is not italic.** One's `emphasis` has `font_style: null`.