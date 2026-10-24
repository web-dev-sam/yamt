# WebStorm 2026.2 (262.10968.77): Islands Dark and Islands Light colours

Most window and editor values are read straight from the theme and scheme files. The JavaScript/TypeScript code colours are the weak point: the JavaScript plugin's key-to-fallback wiring sits in compiled `.class` files my tools couldn't open, so most of Table B rests on `[INFERENCE]` and I could not confirm it. Some CSS, Markdown and Light values are `UNRESOLVED`. I had no shell, so nothing went to `/tmp/yamt-themes-webstorm/`; I read every jar member in place with the archive reader. I changed no file.

**Source abbreviations** (jar paths under `~/.local/share/JetBrains/WebStorm-262.10968.77/`):

| tag | file |
|---|---|
| ID | `lib/intellij.platform.ide.impl.jar:themes/islands/ManyIslandsDark.theme.json` |
| IL | `…:themes/islands/ManyIslandsLight.theme.json` |
| SD | `…:themes/islands/IslandSchemeDark.xml` (scheme "Islands Dark", parent `Darcula`) |
| SL | `…:themes/expUI/expUI_lightScheme.xml` (scheme "Light", parent `Default`, named by IL:6) |
| DC | `lib/intellij.platform.ide.impl.jar:DefaultColorSchemesManager.xml` ("Default" :2–1560, "Darcula" :1562–3035) |
| JD / JL | `plugins/javascript-plugin/lib/modules/intellij.javascript.backend.jar:colorSchemes/Darcula.xml` / `Default.xml`, merged into Darcula / Default (`javascript-plugin.jar:META-INF/plugin.xml:197-198`) |
| ECS | intellij-community tag `idea/262.10968.63` (closest tag to this build), `EditorColorsSchemeImpl.java:94-114` |
| ACS | same tag, `AbstractColorsScheme.java:408-410, 470, 897-937` |
| EMI | `EditorColorsManagerImpl.kt:872-876` (master branch) |
| TDF | same tag, `TextDiffTypeFactory.java` |
| MCP | same tag, `MixedColorProducer.java:48-52` |
| DLHC | `DefaultLanguageHighlighterColors.java` (tag `idea/233.11799.241`; I couldn't find the file at 262) |

`ID:`/`IL:` line numbers point at named colours; `ui` keys are given as JSON paths.

**How a scheme key resolves:**
1. Check the scheme's own map, then the parent's map (ECS:100, ACS:932-937).
2. If not found, walk the key's fallback chain, checking self and then parent at each step (ACS:897).
3. Then check the key's code default.

Two consequences:
- **Islands Dark** (SD) sees Darcula's values, including the JS plugin additions in JD. It never sees Default's: Darcula has `default_scheme="true"`, so no parent is attached at runtime (ACS:408-410).
- **Islands Light** (SL) sees Default's values plus the JS additions in JL.
- `baseAttributes="X"` in a scheme means "inherit along the fallback chain" (ACS:470).

## A. Window and editor colours — Islands Dark

| yamt token | value | editor key | source | how resolved |
|---|---|---|---|---|
| --color-window | #26282c | `MainWindow.background`, `MainToolbar.background` | ID ui; ID:218,168,24 | alias: main-window-bg → layer-1-bg → gray-30 |
| --color-panel | #191a1c | scheme `TEXT` background; `ToolWindow.background` | SD `TEXT`; ID:164,26 | direct; tool-window-bg → layer-0-bg → gray-10 |
| --color-panel-inline | #212326 | `Editor.SearchField.background` | ID ui; ID:166,25 | alias: editor-bg-inline → layer-0-bg-inline → gray-20 |
| --color-separator | #26282c | `EditorTabs.underTabsBorderColor`, `OnePixelDivider.background`, `ToolWindow.Header.borderColor` | ID ui; ID:210,165,24 | alias: editor-border / dialog-border → layer-0-border → gray-30 |
| --color-control-border | #40434a | `Component.borderColor`, `Button.startBorderColor` | ID ui; ID:225,22 | alias: control-border → gray-50 |
| --color-fg | #d1d3d9 | `*.foreground` | ID ui; ID:152,14 | alias: text-default → gray-130 |
| --color-fg-muted | #73767c | `*.infoForeground` | ID ui; ID:154,19 | alias: text-secondary → gray-80 |
| --color-code | #bcbec4 | scheme `TEXT` foreground | SD `TEXT` | direct |
| --color-gutter | #4b5059 | `LINE_NUMBERS_COLOR` | SD `<colors>` | direct |
| --color-gutter-active | #a1a3ab | `LINE_NUMBER_ON_CARET_ROW_COLOR` | SD `<colors>` | direct |
| --color-handle | #4b5059 | gap: WebStorm has no resize dots; closest is the line numbers | as gutter | closest element |
| --color-handle-active | #a1a3ab | gap; closest `LINE_NUMBER_ON_CARET_ROW_COLOR` | as gutter-active | closest element |
| --color-active-line | #1f2024 | `CARET_ROW_COLOR` | SD `<colors>` | direct |
| --color-selection | #214283 | `SELECTION_BACKGROUND` | DC:1611 (Darcula) | parent: SD doesn't set it |
| --color-caret | #ced0d6 | `CARET_COLOR` | SD `<colors>` | direct |
| --color-hover | #ffffff17 | `ActionButton.hoverBackground`, `*.hoverBackground` | ID ui; ID:243,141 | alias: toolbar-bg-hovered → core-bg-transparent-hovered → transparent-white-20 |
| --color-row-hover | #ffffff10 | `List.hoverBackground`, `Tree.hoverBackground` | ID ui; ID:272,140 | alias: selection-bg-hovered → transparent-white-10 |
| --color-row-selected | #2a4371 | `*.selectionBackground` | ID ui; ID:269,38 | alias: selection-bg-active → blue-50 |
| --color-primary | #3871e1 | `Button.default.startBackground` | ID ui; ID:232,35 | alias: control-brand-bg → accent-brand-bg → blue-80 |
| --color-on-primary | #ffffff | `Button.default.foreground` | ID ui | alias: text-over-accent → white |
| --color-problem | #56272b | `Banner.errorBackground` | ID ui; ID:71 | feedback-error-bg → accent-error-bg-secondary → red-40 |
| --color-problem-border | #80383e | `Banner.errorBorderColor` | ID ui; ID:69 | → accent-error-border-secondary → red-60 |
| --color-problem-error | #fa6675 | `ERRORS_ATTRIBUTES` wave colour (stripe #d64d5b; UI `Label.errorForeground` #f57e84) | SD; ID:65 | direct; UI: text-error → red-100 |
| --color-problem-warning | #f2c55c | `WARNING_ATTRIBUTES` wave colour (stripe #c29e4a; UI text-warning #d59637) | SD; ID:81 | direct |
| --color-problem-info | #857042 | `INFO_ATTRIBUTES` (weak warning) wave colour | SD | direct |
| --color-success-signal | #6db083 | `Label.successForeground` | ID ui; ID:49 | text-success → green-100 |
| --color-success | #203b2a | `Banner.successBackground` | ID ui; ID:55 | → accent-success-bg-secondary → green-40 |
| --color-success-border | #29583c | `Banner.successBorderColor` | ID ui; ID:53 | → green-60 |
| --color-info | #233558 | `Banner.infoBackground` | ID ui; ID:39 | feedback-brand-bg → accent-brand-bg-secondary → blue-40 |
| --color-info-border | #2e4d89 | `Banner.infoBorderColor` | ID ui; ID:37 | → blue-60 |
| --color-search-match | #114957 | `TEXT_SEARCH_RESULT_ATTRIBUTES` background `[INFERENCE: this is the find-in-file key]`; for comparison `SEARCH_RESULT_ATTRIBUTES` #2d543f, UI `SearchMatch` #ba9752 (ID:299) | SD | direct |
| --color-diff-wave | #555555 | `DIFF_SEPARATOR_WAVE` | DC:1616 | parent: SD doesn't set it |
| --color-syntax-* | see B | | | |
| --color-chunk-*, --color-mark-* | see C | | | |
| --color-minimap-slider | #80808059 | gap (no minimap); closest `ScrollBar.thumbColor` (the editor scrollbar may use scheme `ScrollBar.Transparent.thumbColor` #a6a6a647, DC:1662 `[INFERENCE]`) | ID ui `ScrollBar` | direct |
| --color-minimap-slider-hover | #8080808c | `ScrollBar.hoverThumbColor` (scheme: #a6a6a659, DC:1665) | ID ui | direct |
| --color-minimap-slider-active | #8080808c | gap: no pressed key; closest is hover | ID ui | closest element |
| panel border | none (5 px gaps) | `Island.borderColor` = panel colour #191a1c | ID ui `Island` | alias: tool-window-bg |
| header/tab bar background | #191a1c | `EditorTabs.background` | ID ui | alias: editor-bg → layer-0-bg |
| input background | #191a1c | `TextField.background` | ID ui | alias: control-bg → dialog-bg → layer-0-bg |
| input border | #40434a | `Component.borderColor` | ID ui | as control-border |
| menu background | #26282c | `Menu.background`, `PopupMenu.background` | ID ui | alias: popup-bg → layer-1-bg → gray-30 |
| menu border | #33353b | `Menu.borderColor` | ID ui | alias: popup-border → layer-1-border → gray-40 |
| tooltip background / border | #33353b / #33353b | `ToolTip.background` / `ToolTip.borderColor` | ID ui | alias: feedback-bg → layer-2-bg → gray-40, and the border is the same |
| editor hover tooltip background / border | #26282c / #33353b | `Editor.ToolTip.background` / `.border` | ID ui | alias: popup-bg / popup-border |
| scrollbar thumb | #80808059 (hover #8080808c) | `ScrollBar.thumbColor` | ID ui | direct |

## A. Window and editor colours — Islands Light

| yamt token | value | editor key | source | how resolved |
|---|---|---|---|---|
| --color-window | #e9eaee | `MainWindow.background` | IL ui; IL:218,164,12 | alias: main-window-bg → layer-0-bg → gray-150 |
| --color-panel | #ffffff | `EditorTabs.background`, `ToolWindow.background`; scheme `TEXT` background | IL:208,213,172; SL:452 | alias: editor-bg / tool-window-bg → layer-2-bg → white |
| --color-panel-inline | #f7f8f9 | `Editor.SearchField.background` | IL:677,209,173,11 | alias: editor-bg-inline → layer-2-bg-inline → gray-160 |
| --color-separator | #e9eaee | `EditorTabs.underTabsBorderColor` | IL:662,210,174 | alias: editor-border → layer-2-border → gray-150 |
| --color-control-border | #d1d3d9 | `Component.borderColor`, `Button.startBorderColor` | IL:583,497,225,14 | alias: control-border → gray-130 |
| --color-fg | #000000 | `ToolTip.foreground`, `MainToolbar.foreground` | IL:1050,1165,152 | alias: text-default → black (`*.foreground` isn't set in IL; it comes from the parent theme, which I didn't read) |
| --color-fg-muted | #73767c | `*.infoForeground` | IL:387,154,19 | alias: text-secondary → gray-80 |
| --color-code | #080808 | `TEXT` foreground | SL:451 | direct |
| --color-gutter | #aeb3c2 | `LINE_NUMBERS_COLOR` | SL:26 | direct |
| --color-gutter-active | #767a8a | `LINE_NUMBER_ON_CARET_ROW_COLOR` | SL:27 | direct |
| --color-handle / -active | #aeb3c2 / #767a8a | gap; closest is the line numbers | SL:26,27 | closest element |
| --color-active-line | #f5f8fe | `CARET_ROW_COLOR` | SL:15 | direct |
| --color-selection | #a6d2ff | `SELECTION_BACKGROUND` | SL:35 | direct |
| --color-caret | #000000 | `CARET_COLOR` | DC:24 (Default, value "0") | parent: SL doesn't set it |
| --color-hover | #00000012 | `*.hoverBackground`, `ActionButton.hoverBackground` | IL:385,243,197,146 | alias: toolbar-bg-hovered → core-bg-transparent-hovered → transparent-black-20 |
| --color-row-hover | #00000008 | `List.hoverBackground`, `Tree.hoverBackground` | IL:724,1210,272,145 | alias: selection-bg-hovered → transparent-black-10 |
| --color-row-selected | #d0dffe | `*.selectionBackground` | IL:379,269,29 | alias: selection-bg-active → blue-140 |
| --color-primary | #3871e1 | `Button.default.startBackground` | IL:506,232,177,35 | alias: control-brand-bg → accent-brand-bg → blue-80 |
| --color-on-primary | #ffffff | `Button.default.foreground` | IL:504 | text-over-accent → white |
| --color-problem / -border | #fff6f5 / #ffc4c5 | `Banner.errorBackground` / `errorBorderColor` | IL:462-463,183-184,59,62 | → accent-error-bg-secondary → red-160 / → red-130 |
| --color-problem-error | #ff0000 | `ERRORS_ATTRIBUTES` wave colour (stripe #cf5b56; UI text-error #c54e58) | DC:394,397; IL:159,67 | parent (Default); UI: red-80 |
| --color-problem-warning | #f2bf57 | Light draws no warning wave: `WARNING_ATTRIBUTES` is a #fcf4d4 background with an uncoloured underline. Closest is the stripe #f2bf57; UI text-warning #a56906 | SL:474-479; IL:160 | closest element |
| --color-problem-info | #cccccc | `INFO_ATTRIBUTES` wave colour (stripe #d9cfad) | DC:483,485 | parent (Default) |
| --color-success-signal | #338555 | `Label.successForeground` | IL:161,51 | text-success → green-80 |
| --color-success / -border | #f5faf3 / #bbdbc2 | `Banner.successBackground` / `BorderColor` | IL:466-467,191-192,43,46 | → green-160 / green-130 |
| --color-info / -border | #f7f8ff / #bdd3ff | `Banner.infoBackground` / `BorderColor` | IL:468-469,179-180,27,30 | → blue-160 / blue-130 |
| --color-search-match | #fcd47e | `TEXT_SEARCH_RESULT_ATTRIBUTES` `[INFERENCE: find-in-file key]`; for comparison `SEARCH_RESULT_ATTRIBUTES` #ccccff (DC:688), UI `SearchMatch` #fee6b1 (IL:299) | SL:458 | direct |
| --color-diff-wave | #d0d0d0 | `DIFF_SEPARATOR_WAVE` | DC:47 | parent (Default) |
| --color-minimap-slider / -hover / -active | #73737333 / #73737347 / #73737347 | gap; closest scheme `ScrollBar.Transparent.thumbColor` / `hoverThumbColor`. The theme's `ScrollBar.*` isn't in IL; it lives in the parent theme, unread: **UNRESOLVED** | DC:108,111 | closest element |
| panel border | none (gaps) | `Island.borderColor` = #ffffff | IL:411 | alias: tool-window-bg |
| header/tab bar background | #ffffff | `EditorTabs.background` | IL:658 | alias: editor-bg |
| input background / border | #ffffff / #d1d3d9 | `TextField.background` / `Component.borderColor` | IL:1039,222,202,169 | alias: control-bg → dialog-bg-inline → layer-1-bg-inline → white |
| menu background / border | #ffffff / #e9eaee | `Menu.background` / `Menu.borderColor.os.default` | IL:742-744,204,206 | alias: popup-bg → layer-2-bg; popup-border → layer-2-border |
| tooltip background / border | #ffffff / #d1d3d9 | `ToolTip.background` / `borderColor` (`Editor.ToolTip` uses the same values) | IL:1049,1054,254,255,166 | alias: feedback-bg → layer-2-bg; feedback-border → layer-0-border → gray-130 |
| scrollbar thumb | UNRESOLVED (theme); scheme #73737333 | — | DC:108 | the theme value sits in the parent theme, which I didn't read |

## B. Syntax (TS/TSX/JS, Vue, HTML, CSS, JSON, Markdown)

Unless a row says otherwise, the JS/TS key names and their fallbacks are `[INFERENCE]`. Evidence: Consulo's fork of the old JS plugin (`consulo-javascript/.../JavaScriptSyntaxHighlightKeys.java`) and SD's `JS.GLOBAL_FUNCTION baseAttributes="DEFAULT_FUNCTION_DECLARATION"`. IntelliJ writes the key's real fallback into `baseAttributes` on export (ACS:677).

| Lezer tag | example | Dark | Light | WebStorm key → resolution | font style (D / L) |
|---|---|---|---|---|---|
| keyword, controlKeyword, definitionKeyword, moduleKeyword, operatorKeyword, modifier | `const if import typeof readonly` | #cf8e6d | #0033b3 | JS.KEYWORD → DEFAULT_KEYWORD: SD / SL:205 | — |
| bool, null, self, atom | `true null this super` | #cf8e6d | #0033b3 | JS.KEYWORD (lexer keywords) | — |
| typeName (primitive) | `string number` | #cf8e6d | #0033b3 | JS.KEYWORD `[INFERENCE: WebStorm lexes them as keywords]` | — |
| typeName, definition(typeName), className, definition(className) | `Foo`, `class Foo` | #bcbec4 | #000000 | JS.CLASS / JS.INTERFACE → DEFAULT_CLASS_NAME / INTERFACE_NAME → DEFAULT_IDENTIFIER (DLHC): SD / DC:174 | — |
| TS type parameter (yamt tags it typeName) | `T` | #507874 | #20999d | TS.TYPE_PARAMETER, direct in the parent map: JD:37 / JL:43 (not SD's TYPE_PARAMETER_NAME_ATTRIBUTES #16baac) | — |
| string, special(string) | `"a"`, template | #6aab73 | #067d17 | JS.STRING → DEFAULT_STRING: SD / SL:246 | — |
| number | `1` | #2aacb8 | #1750eb | JS.NUMBER → DEFAULT_NUMBER: SD / SL:228 | — |
| regexp | `/a/` | #42c3d4 | #264eff | JS.REGEXP direct: SD / SL:406 | — |
| escape | `\n` | #cf8e6d | #0037a6 | JS.VALID_STRING_ESCAPE → DEFAULT_VALID_STRING_ESCAPE: SD / SL:255 | — |
| lineComment, blockComment | `// x` | #7a7e85 | #8c8c8c | DEFAULT_LINE / BLOCK_COMMENT: SD / SL:217 | normal / italic |
| docComment (Lezer doesn't emit it for JS) | `/** */` | #5f826b | #8c8c8c | JS.DOC_COMMENT → DEFAULT_DOC_COMMENT: SD / SL:141 | italic / italic |
| variableName, definition(variableName) (locals) | `x` | #a9b7c6 | #2a8c7c | JS.LOCAL_VARIABLE: Darcula map from JD:3-7 (SD doesn't set it) / SL:401 | — |
| variableName (parameter) | `(p)` | #bcbec4 | #080808 + black underline | JS.PARAMETER → DEFAULT_PARAMETER → DEFAULT_IDENTIFIER (SD). Light: JL:8-13 sets only an underline (EFFECT_TYPE 1) with colour #000000; the text keeps #080808 `[INFERENCE]` | — / underline |
| variableName (global) | `window` | #c77dba | #830091 | JS.GLOBAL_VARIABLE: SD / SL:391 | italic / normal |
| function(variableName), function(definition(variableName)) | `f()`, `function f` | #56a8f5 | #080808 | JS.GLOBAL_FUNCTION. Dark: SD inherit → DEFAULT_FUNCTION_DECLARATION. Light: JL:25-29 sets only italic, no colour → text #080808 `[INFERENCE]` | — / italic |
| function(propertyName) | `a.m()` | #56a8f5 | #914c07 | JS.INSTANCE_MEMBER_FUNCTION: SD / JL:30-34 (Default map) | — |
| static method | `A.m()` | #57aaf7 | #00627a | JS.STATIC_MEMBER_FUNCTION → DEFAULT_STATIC_METHOD: SD / SL:240 | italic / italic |
| propertyName, definition(propertyName), special(propertyName) | `a.b`, `{b:1}`, `#p` | #c77dbb | #871094 | JS.INSTANCE_MEMBER_VARIABLE → DEFAULT_INSTANCE_FIELD: SD / SL:193 | — |
| constant(variableName) (yamt tags it property today) | — | #c77dbb | #871094 | static field: DEFAULT_STATIC_FIELD (SD / SL:234); DEFAULT_CONSTANT #c77dbb / #871094 | italic / italic |
| labelName | `outer:` | #bcbec4 | #080808 + underline #808080 | JS.LABEL → DEFAULT_LABEL. Dark: → IDENTIFIER (SD). Light: SL:211 underline only | — |
| arithmetic/logic/compare/bitwise/update/definitionOperator, derefOperator | `+ && = .` | #bcbec4 | #080808 | JS.OPERATION_SIGN / DOT → DEFAULT_*: SD. Light: Default doesn't set them → TEXT | — |
| punctuation, separator, paren, squareBracket, brace, function(punctuation) | `, ; ( [ { =>` | #bcbec4 | #080808 | DEFAULT_COMMA / SEMICOLON / PARENTHS / BRACKETS / BRACES: SD. Light: DC:191,234 are empty → TEXT | — |
| special(brace) | `${ }` | UNRESOLVED | UNRESOLVED | template interpolation key unknown (closed source) | — |
| meta (decorator `@`) | `@Comp` | #b3ae60 | #9e880d | JS.ATTRIBUTE → DEFAULT_METADATA: SD / SL:223 | — |
| tagName (HTML/JSX/Vue) | `div` | #d5b778 | #0033b3 | Dark: HTML_TAG_NAME / XML_TAG_NAME (SD). Light: → XML_TAG_NAME → DEFAULT_KEYWORD `[INFERENCE chain]` | — |
| tagName (component) | `MyComp` | #2fbaa3 | #008077 | XML_CUSTOM_TAG_NAME: SD / SL:495. Lezer can't tell components apart | — |
| angleBracket | `< />` | #d5b778 | #080808 | HTML_TAG: SD. Light: → XML_TAG → DEFAULT_TAG; SL:252 is empty → TEXT `[INFERENCE chain]` | — |
| attributeName (HTML / Vue) | `class` | #bababa | #174ad4 | HTML_ATTRIBUTE_NAME: Darcula DC:2399 (SD doesn't set it). Light: → XML_ATTRIBUTE_NAME → DEFAULT_ATTRIBUTE `[INFERENCE chain]` | — |
| attributeName (JSX) | `onClick` | #bcbec4 | #174ad4 | XML_ATTRIBUTE_NAME `[INFERENCE: key]`: SD | — |
| keyword (Vue directive, `VueAttributeName`) | `v-if :x @y` | #bababa | #174ad4 | WebStorm draws directives as HTML_ATTRIBUTE_NAME `[INFERENCE]`. Lezer tags them keyword, so yamt would paint them as keywords | — |
| brace (Vue `{{ }}`) | `{{` | #bcbec4 | #080808 | VUE.SCRIPT_DELIMITERS → DEFAULT_SEMICOLON (intellij-plugins@idea/262.10968.63 `VueFileHighlighter.kt`) | — |
| attributeValue | `"x"` | #6aab73 | #067d17 | HTML_ATTRIBUTE_VALUE: SD inherit → DEFAULT_STRING / SL:246 | — |
| character (entity) | `&amp;` | #56a8f5 | #174be6 | HTML_ENTITY_REFERENCE: SD. Light: → DEFAULT_ENTITY SL:180 `[INFERENCE chain]` | — |
| content | text | #bcbec4 | #080808 | TEXT | — |
| documentMeta, processingInstruction | `<!doctype>` | #d5b778 | UNRESOLVED | XML_PROLOGUE: SD `[INFERENCE: key]` | — |
| color (CSS) | `#fff` | #56a8f5 | UNRESOLVED | CSS.COLOR: SD. Light: not in SL or Default; fallback is closed source | — |
| modifier (CSS `!important`) | — | #cf8e6d | UNRESOLVED | CSS.IMPORTANT: SD | bold / ? |
| CSS url | `url()` | #5c92ff | UNRESOLVED | CSS.URL: SD | — |
| CSS property / selector / unit / variableName / atom / function | — | UNRESOLVED | UNRESOLVED | CSS plugin keys and fallbacks are in closed classes. `[INFERENCE]` property → DEFAULT_INSTANCE_FIELD (#c77dbb / #871094) | — |
| propertyName (JSON) | `"k":` | #c77dbb | #871094 | JSON.PROPERTY_KEY → DEFAULT_INSTANCE_FIELD `[INFERENCE: not read]` | — |
| string / number / bool / null (JSON) | — | #6aab73 / #2aacb8 / #cf8e6d | #067d17 / #1750eb / #0033b3 | JSON.STRING / NUMBER / KEYWORD → DEFAULT_* `[INFERENCE]` | — |
| link, url (Markdown) | `[a](b)` | #56a8f5 | UNRESOLVED | MARKDOWN_LINK_TEXT / MARKDOWN_AUTO_LINK: SD (underlined). Light: fallbacks not read | underline |
| link (generic hyperlink) | — | #548af7 | #006dcc | HYPERLINK_ATTRIBUTES: SD / SL:372 | underline |
| heading, emphasis, strong, monospace, quote (Markdown) | `# H` | UNRESOLVED | UNRESOLVED | MARKDOWN_HEADER_* etc.; fallbacks not read | — |

**Groups — Islands Dark** (each line is one colour):
- #cf8e6d: keywords of every kind, bool, null, this, super, escapes, primitive types, CSS !important
- #6aab73: strings, attribute values
- #2aacb8: numbers
- #42c3d4: regexp
- #7a7e85: comments (doc comments separate: #5f826b italic)
- #56a8f5: function and method declarations and calls, entities, CSS colours, Markdown links
- #c77dbb: properties and fields
- #c77dba italic: globals
- #a9b7c6: local variables
- #bcbec4: parameters, classes and types, operators, punctuation, labels, JSX attribute names, text
- #b3ae60: decorators
- #d5b778: tags and angle brackets
- #2fbaa3: components
- #bababa: HTML/Vue attribute names
- #507874: type parameters
- #57aaf7 italic: static methods

**Groups — Islands Light:**
- #0033b3: keywords, tags
- #067d17: strings, attribute values
- #1750eb: numbers
- #264eff: regexp
- #0037a6: escapes
- #8c8c8c italic: comments
- #871094: properties
- #830091: globals
- #2a8c7c: locals
- #914c07: methods
- #080808: text, operators, punctuation, parameters (underlined), global functions (italic)
- #000000: classes and types
- #20999d: type parameters
- #9e880d: decorators
- #174ad4: attribute names
- #174be6: entities
- #008077: components
- #00627a italic: static methods

## C. Change colours

Line tint when the change also has word-level marks = `getIgnoredColor`, computed as c + round(0.6·(editor background − c)) per channel (TDF `MIDDLE_COLOR_FACTOR`, MCP:52; DiffDrawUtil.java:861). Editor background is #191a1c (Dark) and #ffffff (Light).

| kind | Dark value | Dark key / source | Light value | Light key / source | how resolved |
|---|---|---|---|---|---|
| inserted, line/word | #294436 | DIFF_INSERTED bg, DC:2269 | #bee6be | DC:510 | parent maps |
| inserted, line beside word marks | #1f2b26 | computed | #e5f5e5 | computed | D: 41−10, 68−25, 54−16. L: 190+39, 230+15, 190+39 |
| modified, word | #385570 | DIFF_MODIFIED bg, DC:2275 | #c2d8f2 | SL:262 | L: SL overrides Default's #cad9fa |
| modified, line beside word marks | #25323e | computed | #e7effa | computed | D: 56−19, 85−35, 112−50. L: 194+37, 216+23, 242+8 |
| deleted | #484a4a | DIFF_DELETED, DC:2263 | #d6d6d6 | DC:501 | — |
| deleted, beside word marks | #2c2d2e | computed | #efefef | computed | D: 72−28, 74−29, 74−28. L: 214+25 |
| conflict | #45302b | DIFF_CONFLICT, DC:2257 | #ffd5cc | DC:492 | — |
| conflict, beside word marks | #2b2322 | computed | #ffeeeb | computed | D: 69−26, 48−13, 43−9. L: 255, 213+25, 204+31 |
| inserted mark (scrollbar stripe) | #447152 | DIFF_INSERTED stripe, DC:2270 | #aadeaa | DC:511 | `getMarkerColor` |
| modified mark | #43698d | DC:2276 | #b6d2f2 | SL:263 | — |
| deleted mark | #656e76 | DC:2264 | #c8c8c8 | DC:502 | — |
| conflict mark | #8f5247 | DC:2258 | #ffc8bd | DC:494 | — |
| editor gutter added / modified / deleted | #549159 / #375fad / #868a91 | ADDED / MODIFIED / DELETED_LINES_COLOR, SD `<colors>` | #7fc784 / #88adf7 / #767a8a | SL:12,31,16 | direct |
| ignored-change gutter borders | #549159 / #375fad / #868a91 | IGNORED_*_LINES_BORDER_COLOR, SD | #7fc784 / #88adf7 / #767a8a | SL:21-23 | direct |
| collapsed-lines wave | #555555 | DIFF_SEPARATOR_WAVE, DC:1616 | #d0d0d0 | DC:47 | parent |
| collapsed-lines band background | #2b2d30 | DIFF_SEPARATORS_BACKGROUND, SD | #e4e6eb | SL:17 | direct |
| ours / theirs / base / "incoming"/"current" | none | WebStorm's merge view uses only the four DIFF_* kinds above | none | — | gap |

**Proposed mapping onto yamt tokens** (D / L). This is a proposal only; rule 5 is still waiting on the owner.
- `chunk-inserted` ← #294436 / #bee6be. yamt has no word marks for inserted text.
- `chunk-modified` ← line tint beside word marks, #25323e / #e7effa.
- `chunk-modified-word` ← #385570 / #c2d8f2.
- `chunk-deleted` ← #484a4a / #d6d6d6.
- `chunk-conflict` ← #2b2322 / #ffeeeb; `chunk-conflict-word` ← #45302b / #ffd5cc. These are WebStorm's salmon. Plan #32 asks for purple, and WebStorm has no purple conflict colour, so that is a gap.
- `chunk-modified-removal` / `chunk-conflict-removal` ← gap; closest is the type's full colour #385570 / #c2d8f2 and #45302b / #ffd5cc. `[INFERENCE: WebStorm's empty-range highlighter uses getColor; not read]`
- `mark-*` ← the stripe colours (#447152, #43698d, #656e76, #8f5247 / #aadeaa, #b6d2f2, #c8c8c8, #ffc8bd).
- `diff-wave` ← #555555 / #d0d0d0.
- WebStorm paints these opaque; yamt's chunk tokens today are translucent.

## D. Shape (both themes)

| item | value | source |
|---|---|---|
| panels | rounded islands with gaps; no outline (`Island.borderColor` = panel colour) | ID / IL `Island` (IL:404-414) |
| island corner | `Island.arc` 20, i.e. 10 px radius `[INFERENCE: arc is a diameter]` | same |
| gap | `Island.borderWidth` 6 (the visible gap is 5 px per 3.T; not re-checked) | same |
| buttons, inputs, combos | `Button.arc` 8, `Component.arc` 8, i.e. 4 px radius | ID ui; IL:495,580 |
| banners | `Banner.arc` 12, i.e. 6 px | ID ui; IL:472 |
| lines inside panels | `editor-border`: #26282c (D) / #e9eaee (L) | ID:210; IL:210 |
| menus, tooltips | 1 px border (D menu #33353b, tooltip border = its background #33353b; L menu #e9eaee, tooltip #d1d3d9); corner radius not in these theme files: **UNRESOLVED** | ID / IL ui |

## E. Kind

| theme | kind | source |
|---|---|---|
| Islands Dark | dark (`"dark": true`; parent `ExperimentalDark`; scheme "Islands Dark") | ID:3,5,6 |
| Islands Light | light (`"dark": false`; parent `ExperimentalLightWithLightHeader`; scheme "Light") | IL:3,5,6 |

## Checked against the earlier extractions

- **3.T (Islands Dark):** every listed value matches the jars: window, panel, panel-inline, separator, control-border, fg, fg-muted, active-line, hover, row-hover, row-selected, primary, problem, success, info. 3.T also called code, gutter, selection, caret and search-match "unchanged". I can't check that, because yamt's old dark palette is gone. The Islands Dark values are code #bcbec4, gutter #4b5059 / #a1a3ab, selection #214283, caret #ced0d6, search #114957.
- **3.S (Islands Light):** the parent chain, the scheme and the four DIFF_* colours all match.
- **Today's yamt Light (`style.css`)** matches the jars for window through info, plus diff-wave, the 10 syntax tokens' base keys, and mark inserted/modified/deleted. These differ:
  - `problem-error` #e55230 vs #ff0000 (wave) / #c54e58 (UI text-error)
  - `problem-warning` #e8a33e vs #f2bf57 (stripe; Light has no warning wave) / #a56906 (UI)
  - `problem-info` #8c8c8c vs #cccccc
  - `success-signal` #208a3c vs #338555
  - `search-match` #ccccff is `SEARCH_RESULT_ATTRIBUTES` (usages); find-in-file is `TEXT_SEARCH_RESULT` #fcd47e `[INFERENCE]`
  - `syntax-function` #00627a: what WebStorm actually paints for TS functions and methods is #080808 italic (global functions) and #914c07 (methods)
  - `chunk-*`: palette colours plus alpha, not WebStorm's DIFF_* colours
  - `minimap-slider*`: not WebStorm's scrollbar values
  - `mark-conflict` #c6bbf5 is purple by owner decision #32; WebStorm's is #ffc8bd

## Open doubts

1. JS/TS key names and fallbacks (JS.KEYWORD → DEFAULT_KEYWORD and so on) can't be read with my tools. You could confirm them with `unzip -p …/intellij.javascript.psi.impl.jar 'com/intellij/lang/javascript/highlighting/JSHighlighter$Keys.class' | strings` or with `javap` on `JSHighlighter$Keys` / `TypeScriptHighlighter$Keys`. The same goes for the CSS and Markdown keys, and for the XML/HTML fallback chain used in Light.
2. A few surprising results come straight from the resolution code but haven't been seen on screen:
   - Dark local variables #a9b7c6 (from the JS plugin's Darcula additions)
   - Dark type parameters #507874
   - Light methods #914c07
   - Light global functions without a colour (italic text colour)
   - Light parameters with a black underline

   A screenshot in WebStorm would confirm them.
3. The word-mark tint layering (line uses the "ignored" mix when word marks exist) and the empty-range (removal) colour are inferred from `DiffDrawUtil:861`; I didn't read `SimpleDiffChange` / `TextMergeChange`.
4. These Light parent-theme values are unread: `*.foreground`, the `ScrollBar.*` colours (shown as UNRESOLVED in the Light table), and `Popup.borderColor` → `popup-border-windows`. Popup and tooltip corner radii aren't in the theme JSONs either.
5. Which scrollbar colours the Linux editor uses (theme `ScrollBar.*` or the scheme's `ScrollBar.Transparent.*`) is `[INFERENCE]`.
6. Sources were read at intellij-community tag `idea/262.10968.63`, not .77. `DefaultLanguageHighlighterColors` was read at tag 233.