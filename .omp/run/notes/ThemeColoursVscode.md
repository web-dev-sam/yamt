Every value below was read from VS Code 1.143.0's files and resolved by hand, following the code's own logic. I did not run VS Code to check what it actually paints.

**Source shorthand.** `T/` = `/usr/share/code/resources/app/extensions/theme-defaults/themes/`. Theme files are one-line JSON, so they are cited as line 1 plus the key.
- Dark files: D26 = `T/2026-dark.json:1`, DM = `T/dark_modern.json:1`, D+ = `T/dark_plus.json:1`, Dvs = `T/dark_vs.json:1`.
- Light files: L26 = `T/2026-light.json:1`, LM = `T/light_modern.json:1`, L+ = `T/light_plus.json:1`, Lvs = `T/light_vs.json:1`.
- `js:N@c` = `/usr/share/code/resources/app/out/vs/workbench/workbench.desktop.main.js` line N, column about c.
- `css:4@c` = `…/workbench.desktop.main.css` line 4, column about c.

**Include chains.** Dark: 2026-dark → dark_modern → dark_plus → dark_vs. Light: 2026-light → light_modern → light_plus → light_vs.
- `colors`: the later file wins (js:1732@22649).
- `tokenColors`: the parent file's rules come first and all of them stay in force. TextMate picks the most specific scope; for an equal scope the later rule wins.
- Defaults: VS Code's `registerColor` is `de(key,{dark,light,…})` in the bundle. In the transforms, `Ti` = transparent, `wp` = darken and `Xv` = lighten (js:108@885). darken and lighten work in HSL: `l ∓ l·f`, hue rounded, s and l rounded to 3 places (js:104@1267–1756, @5432).

## Dark 2026 and Light 2026

### A. Window and editor colours

| yamt token | Dark 2026 | Light 2026 | VS Code key | source | how resolved |
|---|---|---|---|---|---|
| `--color-window` | `#191a1b` | `#fafafd` | `modernUI.shellBackground` → `titleBar.activeBackground` (also sideBar, activityBar, tab bar, status bar) | js:632@41550; css:4@207628; D26/L26 `titleBar.activeBackground` | alias: shellBackground is unset → its default is `titleBar.activeBackground`, set directly by the theme |
| `--color-panel` | `#121314` | `#ffffff` | `editor.background` (= `editorGutter.background`) | D26/L26 | direct |
| `--color-panel-inline` | `#202122` | `#fafafd` | `editorWidget.background` (find widget) | D26/L26 | direct |
| `--color-separator` | `#ffffff17` | `#e5e5e5` | `editorGroup.border` (line between split editors) | DM / LM `editorGroup.border` | direct, inherited from Dark/Light Modern; 2026 does not override it. Line under the tab bar: `editorGroupHeader.tabsBorder` = `#2a2b2c` / `#f0f1f2`. Find-widget border: `widget.border` = `#2a2b2c` / `#e2e2e5` |
| `--color-control-border` | `#333536` | `#d8d8d866` | `input.border` | D26/L26 | direct. `dropdown.border` = `#333536` / `#d8d8d8`; `button.secondaryBorder` = `#333536` / `#eaeaea` |
| `--color-fg` | `#bfbfbf` | `#202020` | `foreground` | D26/L26 | direct |
| `--color-fg-muted` | `#8c8c8c` | `#606060` | `descriptionForeground` | D26/L26 | direct |
| `--color-code` | `#bbbebf` | `#202020` | `editor.foreground` (also the default token colour, js:1732@12573) | D26/L26 | direct |
| `--color-gutter` | `#858889` | `#606060` | `editorLineNumber.foreground` | D26/L26 | direct |
| `--color-gutter-active` | `#bbbebf` | `#202020` | `editorLineNumber.activeForeground` | D26/L26 | direct |
| `--color-handle` | `#bfbfbf66` | `#20202066` | `modernSash.gripForeground`: three 2 px dots ±5 px apart on every sash (modern UI) | js:632@39318; css:4@1454574, @1455055 | default = `foreground`, transparent 0.4: alpha 0.4·255 = 102 = `66` |
| `--color-handle-active` | `#3994bcb3` | `#0069cc` | `sash.hoverBorder` → `focusBorder` | js:108@3656; css:4@26935; D26/L26 `focusBorder` | alias. On hover or drag VS Code hides the dots (opacity 0) and fills the sash line instead |
| `--color-active-line` | `#242526` | `#eaeaea40` | `editor.lineHighlightBackground` | D26/L26 | direct. `editor.lineHighlightBorder` (`#282828` / `#eeeeee`) is not drawn: only drawn when the background is missing or transparent, or the theme sets the border (js:118@59008). The gutter is not highlighted: `renderLineHighlight` = `"line"` (js:39@95024) |
| `--color-selection` | `#276782dd` | `#0069cc40` | `editor.selectionBackground` | D26/L26 | direct. Unfocused: `inactiveSelectionBackground` = `#27678260` / `#0069cc1a` |
| `--color-caret` | `#bbbebf` | `#202020` | `editorCursor.foreground` | D26/L26 | direct |
| `--color-hover` | `#5a5d5e50` | `#0000001f` | `toolbar.hoverBackground` | js:108@12166 (dark default); L26 | Dark: default (not set by the theme chain). Light: direct |
| `--color-row-hover` | `#ffffff14` | `#00000014` | `list.hoverBackground` | D26/L26 | direct |
| `--color-row-selected` | `#ffffff22` | `#00000025` | `list.activeSelectionBackground` | D26/L26 | direct. Menu item focus uses `menu.selectionBackground` = `#3994bc26` / `#0069cc1a` |
| `--color-primary` | `#297aa0` | `#0069cc` | `button.background` | D26/L26 | direct. Focus rings use `focusBorder` = `#3994bcb3` / `#0069cc` |
| `--color-on-primary` | `#ffffff` | `#ffffff` | `button.foreground` | D26/L26 | direct |
| `--color-problem` | `#3a1d1d` | `#fdeded` | `inputValidation.errorBackground` | D26/L26 | direct |
| `--color-problem-border` | `#be1100` | `#ad0707` | `inputValidation.errorBorder` | D26/L26 | direct |
| `--color-problem-error` | `#f14c4c` | `#e51400` | `editorError.foreground` (squiggles; = `problemsErrorIcon.foreground`, js:108@14696) | js:108@6558 | default. Other error colours: `errorForeground` = `#f48771` / `#ad0707`; `editorOverviewRuler.errorForeground` = `#f48771` / `#ad0707`; `minimap.errorHighlight` = `#ff1212b3` (rgba(255,18,18,.7)) |
| `--color-problem-warning` | `#cca700` | `#bf8803` | `editorWarning.foreground` | js:108@6858 | default. `problemsWarningIcon.foreground`: Dark = `#cca700` (default), Light = `#895503` (set by L26). `minimap.warningHighlight` = `editorWarning.foreground` |
| `--color-problem-info` | `#59a4f9` | `#0063d3` | `editorInfo.foreground` | js:108@6858 | default. Hints use `editorHint.foreground` = `#eeeeeeb3` (#eeeeee × 0.7) / `#6c6c6c` (js:108@7184) |
| `--color-success-signal` | `#73c991` | `#73c991` | `testing.iconPassed` | js:4019@7464 | default. `gitDecoration.addedResourceForeground` = `#73c991` / `#587c0c` |
| `--color-success` | `#347d3926` | `#9bb95533` | **GAP**: no success banner. Closest green surface: `diffEditor.insertedLineBackground` | D26; js:108@11030 | Dark: direct. Light: default rgba(155,185,85,.2) → `33` |
| `--color-success-border` | `#72c892` | `#587c0c` | **GAP**. Closest: `editorGutter.addedBackground` | D26/L26 | direct |
| `--color-info` | `#1e3a47` | `#e6f2fa` | `inputValidation.infoBackground` | D26/L26 | direct |
| `--color-info-border` | `#3994bc` | `#0069cc` | `inputValidation.infoBorder` | D26/L26 | direct |
| `--color-search-match` | `#27678280` | `#0069cc1a` | `editor.findMatchHighlightBackground` (other matches) | D26/L26 | direct. Current match: `editor.findMatchBackground` = `#27678290` / `#0069cc40`, no outline (`findMatchBorder` is null, js:108@8976) |
| `--color-diff-wave` | `#cccccc33` | `#22222233` | **GAP**: VS Code has no wave line. Closest candidate: `diffEditor.diagonalFill` (hatch where a side has no lines) | js:108@11618 | default. Collapsed-region bar: `unchangedRegionBackground` = `#191a1b` / `#f8f8f8`, `unchangedRegionForeground` = `#bfbfbf` / `#202020`, `unchangedRegionShadow` = `#000000` / `#737373bf` |
| `--color-syntax-keyword` | split | split | see B | — | No single value. Control/module keywords `#c586c0` / `#af00db`; `const`/`function`/`class` `#ff7b72` / `#cf222e`; modifiers, `typeof`, bool, null `#569cd6` / `#0000ff`; `this`/`super` `#79c0ff` / `#0550ae`; escape `#d7ba7d` / `#ee0000` |
| `--color-syntax-string` | `#a5d6ff` | `#0a3069` | `string` | D26/L26 | direct rule |
| `--color-syntax-number` | `#b5cea8` | `#098658` | `constant.numeric` | Dvs/Lvs | inherited rule; 2026 has no more specific rule |
| `--color-syntax-comment` | `#8b949e` | `#6e7781` | `comment` | D26/L26 | direct rule |
| `--color-syntax-function` | `#d2a8ff` | `#8250df` | `entity.name.function` | D26/L26 (overrides D+/L+) | later rule, same scope |
| `--color-syntax-property` | `#c9d1d9` | `#1f2328` | `variable.other` (TS members) | D26/L26 | Object-literal keys `#9cdcfe` / `#001080`; CSS properties `#9cdcfe` / `#e50000`; JSON keys `#7ee787` / `#116329` (see B) |
| `--color-syntax-decorator` | `#bbbebf` | `#202020` | `punctuation.decorator.ts`, no rule | default rule | falls to `editor.foreground` |
| `--color-syntax-tag` | `#7ee787` | `#116329` | `entity.name.tag` | D26/L26 | Angle brackets are `#808080` / `#800000` (Dvs/Lvs `punctuation.definition.tag`) |
| `--color-syntax-regexp` | `#a5d6ff` | `#0a3069` | `string.regexp` | D26/L26 | later rule overrides Dvs `#d16969` / Lvs `#811f3f` |
| `--color-syntax-link` | `#a5d6ff` | `#0a3069` | `string.other.link` (Markdown link text) | D26/L26 | URLs are `#bbbebf` / `#202020`, underlined |
| `--color-chunk-inserted` | `#347d3926` | `#9bb95533` | `diffEditor.insertedLineBackground` | see C | see C |
| `--color-chunk-modified` | `#9bb95533` | `#9bb95533` | GAP → `mergeEditor.change.background` | see C | see C |
| `--color-chunk-deleted` | `#c93c3726` | `#ff000033` | `diffEditor.removedLineBackground` | see C | see C |
| `--color-chunk-conflict` | `#ffa6007a` | `#ffa600` | GAP → `mergeEditor.conflict.unhandledUnfocused.border` | see C | see C |
| `--color-chunk-modified-word` | `#57ab5a4d` | `#587c0c26` | `diffEditor.insertedTextBackground` | see C | see C |
| `--color-chunk-conflict-word` | `#9ccc2c33` | `#9ccc2c66` | GAP → `mergeEditor.change.word.background` | see C | see C |
| `--color-chunk-modified-removal` | `#f28772` | `#ad0707` | `editorGutter.deletedBackground` | see C | see C |
| `--color-chunk-conflict-removal` | `#ffa600` | `#ffa600` | GAP → `mergeEditor.conflict.unhandledFocused.border` | see C | see C |
| `--color-mark-inserted` | `#72c892` | `#587c0c` | `minimapGutter.addedBackground` | see C | see C |
| `--color-mark-modified` | `#0078d4` | `#005fb8` | `minimapGutter.modifiedBackground` | see C | see C |
| `--color-mark-deleted` | `#f28772` | `#ad0707` | `minimapGutter.deletedBackground` | see C | see C |
| `--color-mark-conflict` | `#fcba03` | `#fcba03` | `mergeEditor.conflict.unhandled.minimapOverViewRuler` | see C | see C |
| `--color-minimap-slider` | `#a8a9aa85` | `#646464c0` | `minimapSlider.background` | D26/L26 | direct. Shown only while the minimap is hovered (css:4@6956) |
| `--color-minimap-slider-hover` | `#a8a9aa90` | `#646464d0` | `minimapSlider.hoverBackground` | D26/L26 | direct |
| `--color-minimap-slider-active` | `#a8a9aa9c` | `#646464e0` | `minimapSlider.activeBackground` | D26/L26 | direct |
| panel border | `#2a2b2c` | `#f0f1f2` | `sideBar.border`, `panel.border` (classic layout) | D26/L26 | direct. Modern-UI card border: `surface.border` / `modernPanel.border` / `editor.border` = `#2a2b2c` / `#e4e5e6` (js:632@38992) |
| side bar background | `#191a1b` | `#ffffff` | `surface.background` (modern-UI side-bar card, css:4@202798) | D26/L26 | direct. Classic layout: `sideBar.background` = `#191a1b` / `#fafafd` |
| header / tab bar background | `#191a1b` | `#fafafd` | `editorGroupHeader.tabsBackground` | D26/L26 | direct. Active tab: `tab.activeBackground` = `#121314` / `#ffffff` |
| input background | `#191a1b` | `#ffffff` | `input.background` | D26/L26 | direct |
| input border | `#333536` | `#d8d8d866` | `input.border` | D26/L26 | direct |
| menu background | `#202122` | `#fafafd` | `menu.background` | D26/L26 | direct. `menu.border` = `#2a2b2c` / `#e4e5e6`; `dropdown.background` = `#191a1b` / `#ffffff` |
| tooltip background | `#202122` | `#fafafd` | `editorHoverWidget.background` | D26/L26 | direct. Text: `editorHoverWidget.foreground` → `editorWidget.foreground` = `#bfbfbf` / `#202020` (js:108@9461) |
| tooltip border | `#2a2b2c` | `#e4e5e6` | `editorHoverWidget.border` | D26/L26 | direct |
| scrollbar thumb | `#a8a9aa85` | `#646464c0` | `scrollbarSlider.background` | D26/L26 | direct. Hover `#a8a9aa90` / `#646464d0`; active `#a8a9aa9c` / `#646464e0` |
| secondary button | `#00000000` / text `#cccccc` | `#eaeaea` / text `#202020` | `button.secondaryBackground` / `button.secondaryForeground` | DM; L26 | Dark: inherited from Dark Modern. Light: direct |

### B. Syntax

**How the colours are picked.** Semantic highlighting is **on** in both themes: `"semanticHighlighting":true`, and `editor.semanticHighlighting.enabled` defaults to `"configuredByTheme"` (js:546@36219). Neither theme sets semantic colours for TypeScript; the inherited `semanticTokenColors` cover only `newOperator`, `stringLiteral`, `customLiteral` and `numberLiteral`. So TS/JS semantic tokens use VS Code's fallback scopes (js:621@559–2872), scored by `resolveScopes` (js:1732@15828): `(depth+1)·65536 + selector length`, and the later rule wins a tie.

Tokens with no matching rule take the enclosing scope's colour. Inside `{…}` statement blocks that is `meta.block` (`#c9d1d9` / `#1f2328`); otherwise it is `editor.foreground` (`#bbbebf` / `#202020`). Grammar sources: `extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json:1` and `TypeScriptReact…:1`, `css/syntaxes/css.tmLanguage.json:1`, `html/…/html.tmLanguage.json:1`, `json/…/JSON.tmLanguage.json:1`, `markdown-basics/…/markdown.tmLanguage.json:1`; repository key in brackets.

**TS / TSX / JS**

| Lezer tag | example token | Dark 2026 | Light 2026 | VS Code scope | source (winning rule) | font style |
|---|---|---|---|---|---|---|
| `controlKeyword` | `if` `else` `for` `return` `throw` `try` `switch` `break` | `#c586c0` | `#af00db` | `keyword.control.{conditional,loop,flow,trycatch,switch}.ts` [control-statement] | D+ `keyword.control` (beats Dvs `#569cd6` and D26 `keyword` `#ff7b72`) · L+ `keyword.control` | – |
| `moduleKeyword` | `import` `export` `from` | `#c586c0` | `#af00db` | `keyword.control.import/export/from.ts` | D+ / L+ `keyword.control` | – |
| `definitionKeyword` | `const` `let` `var` `function` `class` `interface` `type` `enum` `namespace` | `#ff7b72` | `#cf222e` | `storage.type{,.function,.class,.interface,.type,.enum,.namespace}.ts` | D26 / L26 `storage.type` | – |
| `definitionKeyword` | `extends` `implements` `declare` | `#569cd6` | `#0000ff` | `storage.modifier.ts` [class-or-interface-heritage] | Dvs / Lvs `storage.modifier` | – |
| `modifier` | `async` `static` `readonly` `public` `abstract` `override` | `#569cd6` | `#0000ff` | `storage.modifier{,.async}.ts` | Dvs / Lvs `storage.modifier` | – |
| `modifier` | `get` `set` | `#ff7b72` | `#cf222e` | `storage.type.property.ts` | D26 / L26 `storage.type` | – |
| `modifier` | `*` (generator) | `#ff7b72` | `#cf222e` | `keyword.generator.asterisk.ts` | D26 / L26 `keyword` | – |
| `operatorKeyword` | `typeof` `instanceof` `in` `of` `void` `delete` `keyof` `infer` `is` | `#569cd6` | `#0000ff` | `keyword.operator.expression.*.ts` | Dvs / Lvs `keyword.operator.expression` | – |
| `operatorKeyword` | `await` `yield` `as` `satisfies` | `#c586c0` | `#af00db` | `keyword.control.flow/as/satisfies.ts` | D+ / L+ `keyword.control` | – |
| `operatorKeyword` | `asserts` | `#d4d4d4` | `#000000` | `keyword.operator.type.asserts.ts` | Dvs / Lvs `keyword.operator` | – |
| `keyword` | `new` | `#569cd6` | `#0000ff` | `keyword.operator.new.ts` | Dvs / Lvs `keyword.operator.new` | – |
| `keyword` | `with` | `#c586c0` | `#af00db` | `keyword.control.with.ts` | D+ / L+ `keyword.control` | – |
| `keyword` | `debugger` | `#ff7b72` | `#cf222e` | `keyword.other.debugger.ts` | D26 / L26 `keyword` (inherited) | – |
| `self` | `this` | `#79c0ff` | `#0550ae` | `variable.language.this.ts` | D26 / L26 `variable.language` (later than Dvs/Lvs) | – |
| `atom` | `super` | `#79c0ff` | `#0550ae` | `variable.language.super.ts` | same | – |
| `bool` | `true` | `#569cd6` | `#0000ff` | `constant.language.boolean.true.ts` | Dvs / Lvs `constant.language` | – |
| `null` | `null` (and `undefined`, which Lezer tags `variableName`) | `#569cd6` | `#0000ff` | `constant.language.null/undefined.ts` | same | – |
| `number` | `42` | `#b5cea8` | `#098658` | `constant.numeric.decimal.ts` | Dvs / Lvs `constant.numeric` | – |
| `string` | `"hi"` `'a'` | `#a5d6ff` | `#0a3069` | `string.quoted.double/single.ts` | D26 / L26 `string` | – |
| `special(string)` | `` `a${b}` `` | `#a5d6ff` | `#0a3069` | `string.template.ts` | D26 / L26 `string` | – |
| `special(brace)` | `${` `}` | `#569cd6` | `#0000ff` | `punctuation.definition.template-expression.begin/end.ts` | Dvs / Lvs | – |
| (text inside `${}`) | `${a + b}` | `#d4d4d4` | `#000000` | `meta.template.expression.ts`, `meta.embedded.line.ts` | Dvs / Lvs | – |
| `escape` | `\n` | `#d7ba7d` | `#ee0000` | `constant.character.escape.ts` | D+ / L+ `constant.character.escape` | – |
| `regexp` | `/a+/g` | `#a5d6ff` | `#0a3069` | `string.regexp.ts` | D26 / L26 `string.regexp`. Inside: quantifier `#d7ba7d` / `#000000`, groups `#ce9178` / `#d16969`, classes `#d16969` / `#811f3f`, escapes `#7ee787` / `#116329` (bold) | escape bold |
| `lineComment` | `// x` | `#8b949e` | `#6e7781` | `comment.line.double-slash.ts` | D26 / L26 `comment` | – |
| `blockComment` | `/* */` `/** */` | `#8b949e` | `#6e7781` | `comment.block(.documentation).ts`. JSDoc `@param` = `storage.type.class.jsdoc` → `#ff7b72` / `#cf222e`; `{T}` → `#4ec9b0` / `#267f99`; param name → `#c9d1d9` / `#1f2328` | D26 / L26 | – |
| `variableName` | `foo` (reference) | `#c9d1d9` | `#1f2328` | `variable.other.readwrite.ts`; semantic `variable` → `variable.other.readwrite` | D26 / L26 `variable.other` | – |
| `definition(variableName)` | `const x` | `#79c0ff` | `#0550ae` | `meta.definition.variable.ts variable.other.constant.ts` | D26 / L26 `variable.other.constant` | – |
| `definition(variableName)` | `let x` | `#c9d1d9` | `#1f2328` | `variable.other.readwrite.ts` | D26 / L26 `variable.other` | – |
| `definition(variableName)` | parameter `(a)` | `#ffa657` | `#953800` | `variable.parameter.ts` | D26 / L26 `variable` | – |
| `function(variableName)` | `foo()`, tagged template | `#d2a8ff` | `#8250df` | `meta.function-call.ts entity.name.function.ts` | D26 / L26 `entity.name.function` | – |
| `function(definition(variableName))` | `function foo` | `#d2a8ff` | `#8250df` | `meta.definition.function.ts entity.name.function.ts` | same | – |
| `propertyName` | `obj.prop` | `#c9d1d9` | `#1f2328` | `variable.other.property.ts` / `variable.other.object.property.ts` | D26 / L26 `variable.other`. ALL_CAPS members (`variable.other.constant.property.ts`) → `#79c0ff` / `#0550ae` | – |
| `special(propertyName)` | `this.#x` | `#c9d1d9` | `#1f2328` | `variable.other.property.ts` | same | – |
| `function(propertyName)` | `obj.run()` | `#d2a8ff` | `#8250df` | `entity.name.function.ts`; semantic `method` → `entity.name.function.member` | same | – |
| `definition(propertyName)` | object key `{ key: 1 }` | `#9cdcfe` | `#001080` | `meta.object.member.ts meta.object-literal.key.ts` | D+ / L+ `meta.object-literal.key` | – |
| `definition(propertyName)` | class field `x = 1;` | `#ffa657` | `#953800` | `meta.definition.property.ts variable.object.property.ts` | D26 / L26 `variable` | – |
| `definition(propertyName)` | method `run() {}` | `#d2a8ff` | `#8250df` | `meta.definition.method.ts entity.name.function.ts` | D26 / L26 `entity.name.function` | – |
| `definition(className)` | `class Foo` | `#4ec9b0` | `#267f99` | `entity.name.type.class.ts` | D+ / L+ `entity.name.type` | – |
| `className` | `new Foo()` | `#d2a8ff` (TextMate) → `#4ec9b0` (semantic) | `#8250df` → `#267f99` | `new.expr.ts meta.function-call.ts entity.name.function.ts`; semantic `class` | D26 / L26; D+ / L+ | – |
| `typeName` | `: Foo`, `string` | `#4ec9b0` | `#267f99` | `entity.name.type.ts`, `support.type.primitive.ts` | D+ / L+ `entity.name.type`, `support.type` | – |
| `definition(typeName)` | `interface Foo`, `type T` (also `extends Foo`) | `#4ec9b0` | `#267f99` | `entity.name.type.interface/alias.ts`, `entity.other.inherited-class.ts` | D+ / L+ | – |
| `labelName` | `outer:` | `#c8c8c8` | `#000000` | `entity.name.label.ts` | D+ / L+ `entity.name.label` | – |
| `meta` | `@` of `@Dec` | `#bbbebf` | `#202020` | `meta.decorator.ts punctuation.decorator.ts` (no rule) | default (`editor.foreground`). Decorator name: `@Dec()` → `#d2a8ff` / `#8250df`; `@Dec` → `#c9d1d9` / `#1f2328` | – |
| `definitionOperator`, `arithmeticOperator`, `logicOperator`, `compareOperator`, `bitwiseOperator`, `updateOperator` | `=` `+` `&&` `===` `\|` `++` | `#d4d4d4` | `#000000` | `keyword.operator.{assignment,arithmetic,logical,comparison,relational,bitwise,increment}.ts` | Dvs / Lvs `keyword.operator` | – |
| `function(punctuation)` | `=>` | `#ff7b72` | `#cf222e` | `storage.type.function.arrow.ts` | D26 / L26 `storage.type` | – |
| `punctuation` | `:` (type), `...` | `#d4d4d4` | `#000000` | `keyword.operator.type.annotation.ts`, `keyword.operator.spread/rest.ts` | Dvs / Lvs | – |
| `punctuation` | `:` in an object literal | `#9cdcfe` | `#001080` | `meta.object-literal.key.ts punctuation.separator.key-value.ts` (takes the key's colour) | D+ / L+ | – |
| `derefOperator`, `separator`, `paren`, `squareBracket`, `brace` | `.` `,` `;` `()` `[]` `{}` | in blocks `#c9d1d9`; top level `#bbbebf` | in blocks `#1f2328`; top level `#202020` | `punctuation.accessor.ts`, `punctuation.separator.comma.ts`, `punctuation.terminator.statement.ts`, `meta.brace.round/square.ts`, `punctuation.definition.block.ts` (no rules; take the enclosing colour) | D26 / L26 `meta.block`; otherwise default | – |
| `tagName` / `standard(tagName)` (JSX) | `<div>` `<Foo>` | `#7ee787` | `#116329` | `entity.name.tag.tsx`, `support.class.component.tsx` | D26 / L26 `entity.name.tag`, `support.class.component` | – |
| `angleBracket` (JSX) | `<` `/>` | `#808080` | `#800000` | `punctuation.definition.tag.begin/end.tsx` | Dvs / Lvs `punctuation.definition.tag` | – |
| `attributeName` (JSX) | `className` | `#9cdcfe` | `#e50000` | `entity.other.attribute-name.tsx` | Dvs / Lvs `entity.other.attribute-name` | – |
| `attributeValue` (JSX) | `"x"` | `#a5d6ff` | `#0a3069` | `string.quoted.double.tsx` | D26 / L26 `string` | – |
| `content` (JSX text) | text | `#c9d1d9` | `#1f2328` | `meta.jsx.children.tsx` | D26 / L26 | – |
| `local(variableName)`, `special(variableName)`, `constant(variableName)`, `docComment` | – | – | – | not emitted by these grammars (checked their `styleTags`) | – | – |

**TS/JS semantic overlay** (overrides the TextMate colour of identifiers whenever the TypeScript server sends a token)

| semantic token (fallback scope) | Dark 2026 | Light 2026 | winning rule |
|---|---|---|---|
| `variable` (`variable.other.readwrite`) | `#c9d1d9` | `#1f2328` | D26 / L26 `variable.other` |
| `variable.readonly` (`const`, all references) (`variable.other.constant`) | `#79c0ff` | `#0550ae` | D26 / L26 (later than D+ `#4fc1ff` / L+ `#0070c1`) |
| `parameter` (`variable.parameter`) | `#ffa657` | `#953800` | D26 / L26 `variable` (later than D+ `#9cdcfe` / L+ `#001080`) |
| `property` (`variable.other.property`) | `#c9d1d9` | `#1f2328` | `variable.other` |
| `property.readonly` (`variable.other.constant.property`) | `#79c0ff` | `#0550ae` | `variable.other.constant` |
| `function`, `method` (`entity.name.function[.member]`) | `#d2a8ff` | `#8250df` | D26 / L26 |
| `function.defaultLibrary` (`support.function`) | `#dcdcaa` | `#795e26` | D+ / L+ |
| `class`, `interface`, `type`, `typeParameter`, `enum`, `namespace`, `*.defaultLibrary` types (`entity.name.type…`, `entity.name.namespace`, `support.type/class`) | `#4ec9b0` | `#267f99` | D+ / L+ |
| `enumMember` (`variable.other.enummember`) | `#79c0ff` | `#0550ae` | D26 / L26 (beats Dvs, D+, Lvs, L+) |
| `variable/property.defaultLibrary` (`console`, `document`) (`support.variable`, `support.constant`) | `#79c0ff` | `#0550ae` | D26 / L26 |

**HTML / CSS / JSON / Markdown / Vue**

| Lezer tag | example token | Dark 2026 | Light 2026 | VS Code scope | source | font style |
|---|---|---|---|---|---|---|
| `tagName` (HTML) | `div` | `#7ee787` | `#116329` | `entity.name.tag.html` | D26 / L26 `entity.name.tag` | – |
| `angleBracket` (HTML) | `<` `>` `</` | `#808080` | `#800000` | `punctuation.definition.tag.begin/end.html` | Dvs / Lvs | – |
| `attributeName` (HTML) | `class` | `#9cdcfe` | `#e50000` | `entity.other.attribute-name.html` | Dvs / Lvs | – |
| `attributeValue` (HTML) | `"x"` | `#a5d6ff` | `#0000ff` | `string.quoted.double.html` | D26 `string` · Lvs `string.quoted.double.html` | – |
| `definitionOperator` (HTML) | `=` | `#bbbebf` | `#202020` | `punctuation.separator.key-value.html` (no rule) | default | – |
| `character` (HTML) | `&amp;` | `#ff7b72` | `#cf222e` | `constant.character.entity.named.amp.html` | D26 / L26 `constant.character` | – |
| `blockComment` (HTML) | `<!-- -->` | `#8b949e` | `#6e7781` | `comment.block.html` | D26 / L26 | – |
| `documentMeta` | `<!DOCTYPE html>` | `<!` `>` `#808080`, `DOCTYPE` `#7ee787`, `html` `#9cdcfe` | `#800000`, `#116329`, `#e50000` | `meta.tag.metadata.doctype.html` + tag / attribute scopes | as above | – |
| `processingInstruction` (HTML) | `<?xml ?>` | `<?` `#808080`, `xml` `#7ee787` | `#800000`, `#116329` | `meta.tag.metadata.processing.xml.html` | as above | – |
| `content` (HTML) | text | `#bbbebf` | `#202020` | none | default | – |
| `propertyName` (CSS) | `color` | `#9cdcfe` | `#e50000` | `support.type.property-name.css` | Dvs / Lvs `support.type.property-name` | – |
| `atom` (CSS ValueName / FontName) | `block` `Arial` | `#ce9178` | `#0451a5` | `support.constant.property-value.css`, `support.constant.font-name.css` | D+ · Lvs / L+ | – |
| `keyword` (CSS KeywordQuery) | `screen` | `#ce9178` | `#0451a5` | `support.constant.media.css` | D+ · Lvs | – |
| `color` | `#fff` `red` | `#ce9178` | `#0451a5` | `constant.other.color.rgb-value.hex.css`, `support.constant.color.*.css` | D+ · Lvs / L+ | – |
| `number`, `unit` (CSS) | `10` `px` | `#b5cea8` | `#098658` | `constant.numeric.css`, `keyword.other.unit.px.css` | Dvs / Lvs | – |
| `tagName` (CSS) | `div` | `#d7ba7d` | `#116329` | `entity.name.tag.css` | Dvs `entity.name.tag.css` · L26 `entity.name.tag` | – |
| `className`, `labelName` (IdName), `constant(className)`, `derefOperator` (PseudoOp) | `.btn` `#main` `:hover` | `#d7ba7d` | `#800000` | `entity.other.attribute-name.{class,id,pseudo-class}.css` | Dvs / Lvs (including the `source.css entity.other.attribute-name.pseudo-class` rule) | – |
| `attributeName` (CSS) | `[href]` | `#9cdcfe` | `#e50000` | `entity.other.attribute-name.css` | Dvs / Lvs | – |
| `definitionOperator` (CSS) | `*` `&` | `#7ee787` | `#116329` | `entity.name.tag.wildcard/nesting.css` | D26 / L26 `entity.name.tag` | – |
| `definitionKeyword` (CSS) | `@media` `@import` | `#c586c0` | `#af00db` | `keyword.control.at-rule.*.css` | D+ / L+ `keyword.control` | – |
| `keyword` (CSS) | `from` `to` (keyframes) | `#79c0ff` | `#0550ae` | `entity.other.keyframe-offset.css` | D26 / L26 `entity` | – |
| `labelName` (KeyframeName), `variableName` | `spin`, `--gap` | `#9cdcfe` | `#e50000` | `variable.parameter.keyframe-list.css`, `variable.css`, `variable.argument.css` | Dvs / Lvs `source.css variable` | – |
| `operatorKeyword` (Callee) | `rgb(` `var(` `calc(` | `#dcdcaa` | `#795e26` | `support.function.{misc,calc,…}.css` | D+ / L+ `support.function` | – |
| `operatorKeyword` (`and` `not`), `logicOperator`, `compareOperator`, `arithmeticOperator` | `and` `>` `=` `+` | `#d4d4d4` | `#000000` | `keyword.operator.{logical…media,combinator,pattern,arithmetic}.css` | Dvs / Lvs `keyword.operator` | – |
| `modifier` (CSS) | `!important` | `#ff7b72` | `#cf222e` | `keyword.other.important.css` | D26 / L26 `keyword` | – |
| `string`, `blockComment` (CSS) | `"a"`, `/* */` | `#a5d6ff` · `#8b949e` | `#0a3069` · `#6e7781` | `string.quoted.*.css`, `comment.block.css` | D26 / L26 | – |
| `namespace` (CSS) | `svg` in `@namespace svg` | `#d2a8ff` | `#8250df` | `entity.name.function.namespace-prefix.css` | D26 / L26 `entity.name.function` | – |
| `punctuation`, `separator`, `brace`, `paren` (CSS) | `:` `;` `{}` | `#bbbebf` | `#202020` | `punctuation.*.css` (no rule) | default | – |
| `propertyName` (JSON) | `"key"` | `#7ee787` | `#116329` | `string.json support.type.property-name.json` | D26 / L26 `support.type.property-name.json` | – |
| `string`, `number`, `bool`, `null` (JSON) | `"v"` `1` `true` `null` | `#a5d6ff`, `#b5cea8`, `#569cd6`, `#569cd6` | `#0a3069`, `#098658`, `#0000ff`, `#0000ff` | `string.quoted.double.json`, `constant.numeric.json`, `constant.language.json` | D26 · Dvs / L26 · Lvs | – |
| `separator`, `brace`, `squareBracket` (JSON) | `,` `:` `{}` `[]` | `#bbbebf` | `#202020` | `punctuation.*.json` (no rule) | default | – |
| `heading1`–`heading6`, HeaderMark | `# Title` | `#79c0ff` | `#0550ae` | `markup.heading.markdown`, `entity.name.section.markdown`, `punctuation.definition.heading.markdown` | D26 / L26 `markup.heading`, `markup.heading entity.name` | bold |
| `heading` (table header) | header row | `#bbbebf` | `#202020` | `markup.table.markdown` (no rule) | default | – |
| `strong`, `emphasis` (and their marks) | `**b**`, `*i*` | `#c9d1d9` | `#1f2328` | `markup.bold.markdown`, `markup.italic.markdown` | D26 / L26 | bold / italic |
| `strikethrough` | `~~s~~` | `#bbbebf` | `#202020` | `markup.strikethrough.markdown` | D26 / L26 (style only) | strikethrough |
| `monospace` | `` `code` `` | `#79c0ff` | `#0550ae` | `markup.inline.raw.string.markdown`. Fenced block: `markup.fenced_code.block.markdown` → `#bbbebf` / `#202020` plus the embedded grammar | D26 / L26 `markup.inline.raw` | – |
| `link`, `string` (LinkTitle), `labelName` (LinkLabel) | `[text]`, `"title"`, `[ref]` | `#a5d6ff` | `#0a3069` | `string.other.link.title.markdown`, `string.other.link.description.title.markdown`, `constant.other.reference.link.markdown` | D26 / L26 | – |
| `url` | `https://…` | `#bbbebf` | `#202020` | `markup.underline.link.markdown` | Dvs/D26 · Lvs/L26 `markup.underline` (style only) | underline |
| `labelName` (CodeInfo), LinkMark | `ts`, `[` `](` | `#bbbebf` | `#202020` | `fenced_code.block.language.markdown`, `punctuation.definition.link.*` (no rule) | default | – |
| `quote` / QuoteMark | `> q` / `>` | `#7ee787` / `#6a9955` | `#116329` / `#0451a5` | `markup.quote.markdown` / `punctuation.definition.quote.begin.markdown` | D26 · Dvs / L26 · Lvs | – |
| `list` (ListMark) / item text | `-` `1.` / text | `#ffa657` / `#bbbebf` | `#953800` / `#202020` | `punctuation.definition.list.begin.markdown` / `markup.list.*` | D26 / L26 · default | – |
| `contentSeparator` | `---` | `#79c0ff` | `#0550ae` | `meta.separator.markdown` | D26 / L26 | bold |
| `escape` (Markdown) | `\*` | `#d7ba7d` | `#ee0000` | `constant.character.escape.markdown` | D+ / L+ | – |
| `comment` (Markdown) | `<!-- -->` | `#8b949e` | `#6e7781` | `comment.block.html` | D26 / L26 | – |
| `atom` (TaskMarker), `character` (Entity), `content` (Paragraph) | `[x]`, `&amp;`, text | `#bbbebf` | `#202020` | `meta.paragraph.markdown` / list scopes (no rule) [INFERENCE for `[x]` and `&amp;`] | default | – |
| Vue tags (`keyword` for `v-if`, `brace` for `{{ }}`, `punctuation` for `@` `:`, …) | `.vue` file | `#bbbebf` | `#202020` | stock VS Code has **no Vue grammar**; only `ms-vscode.js-debug` mentions `vue`. `.vue` opens as plain text. With the Vue extension, template parts would take the HTML/TS rows above [INFERENCE] | default | – |

**Groups (tags VS Code paints alike).** Each group is one possible yamt token.

| # | Dark 2026 | Light 2026 | members |
|---|---|---|---|
| 1 | `#c586c0` | `#af00db` | `controlKeyword`, `moduleKeyword`, `await`/`yield`/`as`/`satisfies`/`with`, CSS @-rules |
| 2 | `#ff7b72` | `#cf222e` | `definitionKeyword` (`const`…`namespace`), `get`/`set`, `*`, `=>`, `debugger`, `!important`, HTML entities, JSDoc tags |
| 3 | `#569cd6` | `#0000ff` | `modifier` (`async`/`static`/`readonly`/access/`abstract`/`override`/`declare`/`extends`/`implements`), `operatorKeyword` (`typeof`/`instanceof`/`in`/`of`/`keyof`/`is`…), `new`, `bool`, `null`, `special(brace)`, JSON constants. Light also: HTML attribute values |
| 4 | `#d4d4d4` | `#000000` | all operators, type `:`, `...`, `${…}` interior, CSS combinators. Light also: JS labels |
| 5 | `#c9d1d9` | `#1f2328` | `let` variables, TS `propertyName`, JSX text, in-block punctuation, Markdown strong/emphasis |
| 6 | `#79c0ff` | `#0550ae` | `self`, `atom` (`super`), `const` variables, readonly properties, enum members, built-in globals, Markdown heading / inline code / `---` |
| 7 | `#ffa657` | `#953800` | parameters, class fields (TextMate only), Markdown list marks |
| 8 | `#d2a8ff` | `#8250df` | all `function(...)` tags and method names |
| 9 | `#dcdcaa` | `#795e26` | built-in functions, CSS function names |
| 10 | `#4ec9b0` | `#267f99` | `typeName`, `definition(typeName)`, `definition(className)`, `className` (semantic), namespaces |
| 11 | `#9cdcfe` | `#001080` (keys) / `#e50000` (attributes, CSS) | object keys (TextMate); `attributeName`, CSS `propertyName`, CSS variables. Light splits this group in two |
| 12 | `#a5d6ff` | `#0a3069` | strings, template strings, attribute values (Dark), regexp, Markdown links |
| 13 | `#b5cea8` | `#098658` | numbers, units |
| 14 | `#d7ba7d` | `#ee0000` / `#800000` | Dark: escapes and CSS class/id/pseudo/tag selectors. Light splits: escapes `#ee0000`; selectors `#800000`, the same colour as angle brackets |
| 15 | `#ce9178` | `#0451a5` | CSS values, colours, media types. Light also: Markdown `>` |
| 16 | `#7ee787` | `#116329` | `tagName` (HTML/JSX; Light also CSS tag selectors), JSON keys, `*`/`&`, Markdown quote |
| 17 | `#808080` | `#800000` | `angleBracket` |
| 18 | `#8b949e` | `#6e7781` | comments |
| 19 | `#c8c8c8` | (in group 4) | JS labels |
| 20 | `#6a9955` | (in group 15) | Markdown `>` |
| 21 | `#bbbebf` | `#202020` | everything else (`editor.foreground`) |

### C. Change colours

| kind | VS Code key | Dark 2026 | Light 2026 | source | how resolved |
|---|---|---|---|---|---|
| inserted line | `diffEditor.insertedLineBackground` | `#347d3926` | `#9bb95533` | D26; js:108@11030 | Dark: direct. Light: default rgba(155,185,85,.2) |
| inserted words | `diffEditor.insertedTextBackground` | `#57ab5a4d` | `#587c0c26` | D26 / L26 | direct |
| removed line | `diffEditor.removedLineBackground` | `#c93c3726` | `#ff000033` | D26; js:108@11030 | Dark: direct. Light: default rgba(255,0,0,.2) |
| removed words | `diffEditor.removedTextBackground` | `#f470674d` | `#ad070726` | D26 / L26 | direct |
| text borders | `diffEditor.insertedTextBorder` / `removedTextBorder` | none | none | js:108@11378 | null for dark and light |
| diff gutter | `diffEditorGutter.inserted/removedLineBackground` | `#347d3926` / `#c93c3726` | `#9bb95533` / `#ff000033` | js:108@11378; css:4@40227 | null → CSS falls back to `var(--…LineBackground)` |
| diff overview ruler | `diffEditorOverview.inserted/removedForeground` | `#57ab5a99` / `#f4706799` | `#587c0c4d` / `#ad07074d` | js:544@37280 | null → `insertedTextBackground.transparent(2)`. Dark: 77/255 = .302 ×2 = .604 → CSS "0.60" → 153 = `99`. Light: 38/255 = .149 ×2 = .298 → "0.30" → 77 = `4d` |
| border between sides | `diffEditor.border` | none | none | js:108@11618 | null |
| missing-lines filler | `diffEditor.diagonalFill` | `#cccccc33` | `#22222233` | js:108@11618 | default |
| collapsed unchanged lines | `diffEditor.unchangedRegionBackground` / `…Foreground` / `…Shadow` / `unchangedCodeBackground` | `#191a1b` / `#bfbfbf` / `#000000` / `#74747429` | `#f8f8f8` / `#202020` / `#737373bf` / `#b8b8b829` | js:108@11972; js:542@12063; Lvs | background → `sideBar.background` (Dark) / set by Lvs (Light); foreground → `foreground`; the rest are defaults |
| moved code | `diffEditor.move.border` / `moveActive.border` | `#8b8b8b9c` / `#ffa500` | `#8b8b8b9c` / `#ffa500` | js:542@12063 | default |
| merge editor: changed lines (inputs) | `mergeEditor.change.background` | `#9bb95533` | `#9bb95533` | js:4149@7125 | default |
| merge editor: changed words | `mergeEditor.change.word.background` | `#9ccc2c33` | `#9ccc2c66` | js:4149@7125 | default |
| merge editor: base side | `mergeEditor.changeBase.background` / `.word.background` | `#4b1818` / `#6f1313` | `#ffcccc` / `#ffa3a3` | js:4149@7125 | default |
| merge editor: open conflict | `mergeEditor.conflict.unhandledUnfocused.border` / `unhandledFocused.border` | `#ffa6007a` / `#ffa600` | `#ffa600` / `#ffa600` | js:4149@7599 | default |
| merge editor: resolved conflict | `mergeEditor.conflict.handledUnfocused.border` / `handledFocused.border` | `#86868649` / `#c1c1c1cc` | same | js:4149@7599 | default |
| merge editor: minimap/ruler | `mergeEditor.conflict.unhandled.minimapOverViewRuler` / `handled…` | `#fcba03` / `#adaca8ee` | same | js:4149@7985 | default |
| merge editor: misc | `mergeEditor.conflictingLines.background` | `#ffea0047` | same | js:4149@7985 | default |
| merge editor: conflict inputs | `mergeEditor.conflict.input1.background` / `input2.background` | `#40c8ae33` / `#40a6ff33` | same | js:4149@7985 | `merge.current/incomingHeaderBackground` × 0.4 → alpha .5 × .4 = .2 → `33` |
| inline conflict, current (ours) | `merge.currentHeaderBackground` / `currentContentBackground` | `#40c8ae80` / `#40c8ae33` | same | js:108@13336, @13481 | `#40C8AE` × .5 → 127.5 → `80`; content = header × .4 = .2 → `33` |
| inline conflict, incoming (theirs) | `merge.incomingHeaderBackground` / `incomingContentBackground` | `#40a6ff80` / `#40a6ff33` | same | same | `#40A6FF` × .5; content × .4 |
| inline conflict, common (base) | `merge.commonHeaderBackground` / `commonContentBackground` | `#60606066` / `#60606029` | same | same | `#606060` × .4 → `66`; × .4 again = .16 → 40.8 → `29` |
| inline conflict border | `merge.border` | none | none | js:108@13994 | null |
| conflict ruler marks | `editorOverviewRuler.current/incoming/commonContentForeground` | `#40c8ae80` / `#40a6ff80` / `#60606066` | same | js:108@13994 | header colour × 1 |
| SCM gutter added | `editorGutter.addedBackground` | `#72c892` | `#587c0c` | D26 / L26 | direct |
| SCM gutter modified | `editorGutter.modifiedBackground` | `#0078d4` | `#005fb8` | DM / LM | direct, inherited from Dark/Light Modern |
| SCM gutter deleted | `editorGutter.deletedBackground` | `#f28772` | `#ad0707` | D26 / L26 | direct |
| SCM gutter secondary added | `editorGutter.addedSecondaryBackground` | `#2c7145` | `#97d314` | js:709@23031 | Dark: darken(#72c892, .5): hsl(142, .439, .616) → l .308 → rgb(44,113,69). Light: lighten(#587c0c, .7): hsl(79, .824, .267) → l .454 → rgb(151,211,20) |
| SCM gutter secondary modified | `editorGutter.modifiedSecondaryBackground` | `#003c6a` | `#3aa0ff` | js:709@23031 | Dark: darken(#0078d4, .5): hsl(206, 1, .416) → .208 → rgb(0,60,106). Light: lighten(#005fb8, .7): hsl(209, 1, .361) → .614 → rgb(58,160,255) |
| SCM gutter secondary deleted | `editorGutter.deletedSecondaryBackground` | `#c43012` | `#e10909` | js:709@23739 | Dark: darken(#f28772, .4): hsl(10, .831, .698) → .419 → rgb(196,48,18). Light: lighten(#ad0707, .3): hsl(0, .922, .353) → .459 → rgb(225,9,9) |
| minimap marks | `minimapGutter.added/modified/deletedBackground` | `#72c892` / `#0078d4` / `#f28772` | `#587c0c` / `#005fb8` / `#ad0707` | js:709@23739 | alias → the `editorGutter.*` colours above |
| scrollbar (overview ruler) marks | `editorOverviewRuler.added/modified/deletedForeground` | `#73c991` / `#6ab890` / `#f48771` | `#587c0c` / `#0069cc` / `#ad0707` | D26 / L26 | direct (the defaults would be gutter × .6) |
| file-list status | `gitDecoration.added/modified/deleted/untracked/conflictingResourceForeground` | `#73c991` / `#e5ba7d` / `#f48771` / `#73c991` / `#f48771` | `#587c0c` / `#667309` / `#ad0707` / `#587c0c` / `#ad0707` | D26 / L26 | direct |
| diff-file syntax | `markup.inserted` / `markup.deleted` / `markup.changed` | `#7ee787` / `#ffa198` / `#ffa657` | `#116329` / `#82071e` / `#953800` | D26 / L26 tokenColors | direct |

**Proposed mapping onto yamt**

| yamt token (what it paints) | proposed VS Code element | Dark | Light | gap |
|---|---|---|---|---|
| `--color-chunk-inserted` (line band and strip fill) | `diffEditor.insertedLineBackground` | `#347d3926` | `#9bb95533` | – |
| `--color-chunk-deleted` | `diffEditor.removedLineBackground` | `#c93c3726` | `#ff000033` | – |
| `--color-chunk-modified` | `mergeEditor.change.background` | `#9bb95533` | `#9bb95533` | **gap**: the diff editor has no "modified" tint (it shows removed on the left, inserted on the right). The only "modified" colour is the solid gutter `#0078d4` / `#005fb8` |
| `--color-chunk-conflict` | `mergeEditor.conflict.unhandledUnfocused.border` | `#ffa6007a` | `#ffa600` | **gap**: no conflict tint; the merge editor outlines conflicts. Per-side tints exist: `merge.currentContentBackground` `#40c8ae33`, `incomingContentBackground` `#40a6ff33`, `commonContentBackground` `#60606029` |
| `--color-chunk-modified-word` | `diffEditor.insertedTextBackground` (after side) | `#57ab5a4d` | `#587c0c26` | before side would be `removedTextBackground` `#f470674d` / `#ad070726` |
| `--color-chunk-conflict-word` | `mergeEditor.change.word.background` | `#9ccc2c33` | `#9ccc2c66` | **gap**: no conflict word colour |
| `--color-chunk-modified-removal` (4 px removal bar) | `editorGutter.deletedBackground` | `#f28772` | `#ad0707` | closest solid "deleted" mark |
| `--color-chunk-conflict-removal` | `mergeEditor.conflict.unhandledFocused.border` | `#ffa600` | `#ffa600` | **gap** |
| `--color-mark-inserted` (minimap edge) | `minimapGutter.addedBackground` | `#72c892` | `#587c0c` | – |
| `--color-mark-modified` | `minimapGutter.modifiedBackground` | `#0078d4` | `#005fb8` | – |
| `--color-mark-deleted` | `minimapGutter.deletedBackground` | `#f28772` | `#ad0707` | – |
| `--color-mark-conflict` | `mergeEditor.conflict.unhandled.minimapOverViewRuler` | `#fcba03` | `#fcba03` | – |

### D. Shape

**Default 1.143 layout is rounded floating cards, not flat panels.** `workbench.experimental.modernUI` defaults to `true` with `experiment:{mode:"auto"}` (js:867@13723). This turns on the `floating-panels` and `modern-ui` classes (js:5416@47541, @73240). In that mode:
- The side bar, auxiliary bar and panel are cards: 1 px border `surface.border` / `modernPanel.border` (= `#2a2b2c` / `#e4e5e6`) and radius `cornerRadius.large` = 8 px (css:4@202798, @203673).
- The cards sit 4 px apart (`spacing.size40`, css:4@201702) on `modernUI.shellBackground` = `#191a1b` / `#fafafd` (css:4@207628).
- The editor part has radius 8 px (css:4@204853) and border `editor.border` → `surface.border` (css:4@1424931).
- Sashes show three 2 px round dots (`modernSash.gripForeground`, css:4@1454574).

**Classic layout (modernUI off): flat panels with 1 px lines.**
- `activityBar.border`, `sideBar.border`, `sideBarSectionHeader.border`, `panel.border`, `titleBar.border`, `statusBar.border`, `editorGroupHeader.tabsBorder`, `tab.border` = `#2a2b2c` / `#f0f1f2`.
- `editorGroup.border` = `#ffffff17` / `#e5e5e5`.
- `panelSection.border` = `#2a2b2c` / `#e4e5e6`.
- The minimap has no border of its own; the overview ruler border is `editorOverviewRuler.border` = `#2a2b2c` / `#f0f1f2`.

**Radii** (size tokens: js:1744@975–1398; the themes set no sizes):

| element | radius | source |
|---|---|---|
| buttons (`.monaco-text-button`) | 4 px | css:4@45946 |
| inputs (`.monaco-inputbox`) | 4 px | css:4@84058 |
| select box | `cornerRadius.small` = 4 px | css:4@14127 |
| context menus | `cornerRadius.large` = 8 px, 1 px `strokeThickness` border | js:1144, js:1358 |
| menu items | `cornerRadius.medium` = 6 px, 4 px side margin | js:1264 |
| editor hover | 8 px | css:4@103024 |
| workbench tooltip | 5 px (3 px with pointer) | css:4@333012 |
| find widget | 8 px | css:4@78483 |
| quick input | `cornerRadius.xLarge` = 12 px | css:4@171129 |

### E. Kind

| theme | kind | source |
|---|---|---|
| Dark 2026 | dark: `uiTheme: "vs-dark"`, `"type":"dark"` | `extensions/theme-defaults/package.json:1` `contributes.themes[1]`; D26 `type`. Default via `COLOR_THEME_DARK="Dark 2026"` (js:632@62267) |
| Light 2026 | light: `uiTheme: "vs"`, `"type":"light"` | same `package.json:1` `contributes.themes[0]`; L26 `type`. Default via `COLOR_THEME_LIGHT="Light 2026"` (js:632@62267) |

### Open doubts

1. **Layout vs. rule 4.** VS Code 1.143's default layout is rounded floating cards (`modernUI: true`), which contradicts request rule 4 ("flat panels"); the orchestrator should decide. The experiment service may change that default per user [INFERENCE on what `mode:"auto"` does]. I also did not resolve the modern-UI tab colours (`modernTab.*`, `modernEditorTab.*`).
2. **Alpha as painted.** VS Code writes translucent colours as `rgba(…, alpha.toFixed(2))` (js:104@8420). That the CSS variables go through this path is [INFERENCE]. If so, these are painted one step off the hex in the tables:
   - `#276782dd` → alpha .87 (`de`)
   - `#ffffff22` → .13 (`21`)
   - `#00000025` → .14 (`24`)
   - `#5a5d5e50` → .31 (`4f`)
   - `#27678290` and `#a8a9aa90` → .56 (`8f`)
   - `#646464c0` → .75 (`bf`)
   - `#646464d0` → .82 (`d1`)
   - `#86868649` → .29 (`4a`)
   - `#adaca8ee` → .93 (`ed`)
3. **Dark 2026's mixed look is computed, not observed.** Dark 2026 keeps Dark+/Dark-VS rules wherever they are more specific than its own GitHub-style rules. That gives `if`/`return`/`import` `#c586c0`, `async`/`readonly` `#569cd6`, numbers `#b5cea8`, operators `#d4d4d4`, object keys `#9cdcfe`. This follows from the include order (js:1732@22649) and TextMate specificity; I did not look at a running VS Code.
4. **Semantic recolouring of some identifiers is [INFERENCE].** It assumes the TypeScript server sends tokens for object-literal keys (making them `#c9d1d9` / `#1f2328`) and for JSX component names.
5. **Context-dependent punctuation.** Punctuation and `.` take `meta.block` inside blocks but `editor.foreground` at top level: two values for one Lezer tag.
6. **Gaps.** No VS Code colour exists for:
   - the success banner and its border;
   - the diff wave;
   - a "modified" chunk tint;
   - conflict tint, conflict words and conflict removal marks.

   The closest elements are named in A and C.
7. **Vue.** Stock VS Code has no Vue grammar; `.vue` files open as plain text.