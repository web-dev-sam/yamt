## B. Syntax: Islands Dark (D) and Islands Light (L), with the class-file fallback chains

All chains are now read. The few `[INFERENCE]` tags left are about which key WebStorm puts on a token (JSX tags and attributes, components, Vue directives, template text, doctype), not about chains. Two cases have a style I couldn't resolve: Dark Markdown bold/italic and Light strikethrough.

**How to read the "key → chain" column:**
- At every step the scheme map is checked before its parent. Dark: SD, then Darcula (which includes JD and MD). Light: SL, then Default (which includes JL and MDL). Source: EditorColorsSchemeImpl.java:100-113 and AbstractColorsScheme.java:897-937 at `idea/262.10968.63`.
- "→ text" means the entry found has no colour of its own (or nothing is found), so the scheme's `TEXT` colour shows: D #bcbec4 (SD `TEXT`), L #080808 (SL:451).
- `TS.X` falls back to `JS.X` (K).

**Sources** (jar paths under `~/.local/share/JetBrains/WebStorm-262.10968.77/`):

| tag | file |
|---|---|
| SD | `lib/intellij.platform.ide.impl.jar:themes/islands/IslandSchemeDark.xml` |
| SL | `…:themes/expUI/expUI_lightScheme.xml` |
| DC | `lib/intellij.platform.ide.impl.jar:DefaultColorSchemesManager.xml` (Default :2–1560, Darcula :1562–3035) |
| JD / JL | `plugins/javascript-plugin/lib/modules/intellij.javascript.backend.jar:colorSchemes/Darcula.xml` / `Default.xml` |
| MD / MDL | `plugins/markdown/lib/intellij.markdown.jar:colorSchemes/MarkdownDarcula.xml` / `MarkdownDefault.xml` (`META-INF/plugin.xml:358-359`) |
| K | `.omp/run/notes/ThemeColoursWebstormKeys.md` (javap chains) |
| X | intellij-community@`idea/262.10968.63` `xml/xml-psi-impl/src/com/intellij/openapi/editor/XmlHighlighterColors.java` |
| DL | same tag, `platform/core-api/src/com/intellij/openapi/editor/DefaultLanguageHighlighterColors.java` |
| VF | intellij-plugins@`idea/262.10968.63` `vuejs/vuejs-backend/src/org/jetbrains/vuejs/lang/html/highlighting/VueFileHighlighter.kt` |

### TS / TSX / JS

| Lezer tag | example | Dark | Light | key → chain (where it was found) | style D / L |
|---|---|---|---|---|---|
| keyword, controlKeyword, definitionKeyword, moduleKeyword, operatorKeyword, modifier | `const if import typeof readonly async` | #cf8e6d | #0033b3 | TS.KEYWORD → JS.KEYWORD → DEFAULT_KEYWORD (K). D: SD. L: SL:205 | — / — |
| bool, null, self, atom | `true null this super` | #cf8e6d | #0033b3 | same chain (lexer keywords) | — / — |
| typeName (primitive) | `string void` | #cf8e6d | #0033b3 | TS.PRIMITIVE.TYPES → TS.KEYWORD → JS.KEYWORD → DEFAULT_KEYWORD (K) | — / — |
| typeName, definition(typeName) (interface, type alias) | `Props` | #bcbec4 | #000000 | TS.TYPE.ALIAS → TS.INTERFACE → DEFAULT_INTERFACE_NAME → DEFAULT_IDENTIFIER (K, DL). D: SD DEFAULT_IDENTIFIER. L: DC:174 (Default, "0") | — / — |
| className, definition(className) (incl. enum, exported class) | `new Foo`, `class Foo` | #bcbec4 | #000000 | TS.CLASS → JS.CLASS → DEFAULT_CLASS_NAME → DEFAULT_IDENTIFIER. TS.ENUM and TS.EXPORTED_CLASS → TS.CLASS (K, DL) | — / — |
| typeName (type parameter) | `T` | #507874 | #20999d | TS.TYPE_PARAMETER is set directly in the parent map: D Darcula via JD:37-41; L Default via JL:43-47. SD's TYPE_PARAMETER_NAME_ATTRIBUTES is not reached | — / — |
| module name | `namespace N` | #bcbec4 | #000000 | TS.MODULE_NAME → DEFAULT_IDENTIFIER (K) | — / — |
| string | `"a"` | #6aab73 | #067d17 | TS.STRING → JS.STRING → DEFAULT_STRING. D: SD. L: SL:246 | — / — |
| special(string) | template text | #6aab73 | #067d17 | JS.STRING `[INFERENCE: key on template text]` | — / — |
| special(brace) | `${ }` | #bcbec4 | #080808 | JS.TEMPLATE_LITERAL_PLACEHOLDER_DELIMITERS → DEFAULT_BRACES (K). D: SD. L: in neither SL nor Default → text | — / — |
| number | `1` | #2aacb8 | #1750eb | JS.NUMBER → DEFAULT_NUMBER. D: SD. L: SL:228 | — / — |
| regexp | `/a/` | #42c3d4 | #264eff | JS.REGEXP set directly: SD / SL:406 (its fallback DEFAULT_STRING is not reached) | — / — |
| escape | `\n` | #cf8e6d | #0037a6 | JS.VALID_STRING_ESCAPE → DEFAULT_VALID_STRING_ESCAPE: SD / SL:255 | — / — |
| lineComment | `// x` | #7a7e85 | #8c8c8c | JS.LINE_COMMENT → DEFAULT_LINE_COMMENT: SD / SL:217 | — / italic |
| blockComment | `/* x */` | #7a7e85 | #8c8c8c | JS.BLOCK_COMMENT → DEFAULT_BLOCK_COMMENT: SD / SL ≈:129 | — / italic |
| docComment (Lezer emits blockComment) | `/** x */` | #5f826b | #8c8c8c | JS.DOC_COMMENT → DEFAULT_DOC_COMMENT: SD / SL:141 | italic / italic |
| variableName, definition(variableName) (local) | `x` | #a9b7c6 | #2a8c7c | TS.LOCAL_VARIABLE → JS.LOCAL_VARIABLE. D: Darcula map via JD:3-7; SD doesn't set it, so DEFAULT_LOCAL_VARIABLE is never reached. L: SL:401 | — / — |
| variableName (parameter) | `(p)` | #bcbec4 | #080808 | TS.PARAMETER → JS.PARAMETER → DEFAULT_PARAMETER → DEFAULT_IDENTIFIER. D: SD DEFAULT_IDENTIFIER. L: JS.PARAMETER is in Default via JL:8-13 as effect only (EFFECT_COLOR #000000, EFFECT_TYPE 1, no colour) → text | — / #000000 underline `[INFERENCE: EFFECT_TYPE 1 = underline]` |
| variableName, definition(variableName) (global, top-level, exported) | `window`, module `const` | #c77dba | #830091 | TS.EXPORTED_VARIABLE → TS.GLOBAL_VARIABLE → JS.GLOBAL_VARIABLE (K): SD / SL:391 | italic / — |
| enum member (Lezer has no tag for it) | `Color.Red` | #c77dbb | #871094 | TS.ENUM_MEMBER → TS.STATIC_MEMBER_VARIABLE → JS.STATIC_MEMBER_VARIABLE → DEFAULT_STATIC_FIELD: SD / SL:234 | italic / italic |
| function(variableName), function(definition(variableName)) (top-level, exported) | `f()`, `function f` | #56a8f5 | #080808 | TS.EXPORTED_FUNCTION → TS.GLOBAL_FUNCTION → JS.GLOBAL_FUNCTION. D: SD marks it `baseAttributes` (inherit) → DEFAULT_FUNCTION_DECLARATION in SD. L: JS.GLOBAL_FUNCTION is in Default via JL:25-29 as FONT_TYPE 2 only → text | — / italic |
| function(definition(variableName)) (nested) | inner `function g` | #56a8f5 | #00627a | TS.LOCAL_FUNCTION → JS.LOCAL_FUNCTION → DEFAULT_FUNCTION_DECLARATION: SD / SL:188 | — / — |
| function(propertyName) (method call or definition) | `a.m()` | #56a8f5 | #914c07 | TS.INSTANCE_MEMBER_FUNCTION → JS.INSTANCE_MEMBER_FUNCTION. D: SD. L: Default via JL:30-34. DEFAULT_INSTANCE_METHOD is not reached | — / — |
| function(propertyName) (static) | `A.m()` | #57aaf7 | #00627a | JS.STATIC_MEMBER_FUNCTION → DEFAULT_STATIC_METHOD: SD / SL:240 | italic / italic |
| propertyName, definition(propertyName), special(propertyName) | `a.b`, `{b: 1}`, `#p` | #c77dbb | #871094 | TS.INSTANCE_MEMBER_VARIABLE → JS.INSTANCE_MEMBER_VARIABLE → DEFAULT_INSTANCE_FIELD: SD / SL:193 | — / — |
| propertyName (static) | `A.b` | #c77dbb | #871094 | JS.STATIC_MEMBER_VARIABLE → DEFAULT_STATIC_FIELD: SD / SL:234 | italic / italic |
| labelName | `outer:` | #bcbec4 | #080808 | JS.LABEL → DEFAULT_LABEL. D: not in SD or Darcula → DEFAULT_IDENTIFIER in SD. L: SL:211 is effect only (#808080) → text | — / #808080 underline |
| arithmeticOperator, logicOperator, compareOperator, bitwiseOperator, updateOperator, definitionOperator | `+ && === ++ =` | #bcbec4 | #080808 | JS.OPERATION_SIGN → DEFAULT_OPERATION_SIGN. D: SD. L: not in SL or Default → text | — / — |
| derefOperator | `.` | #bcbec4 | #080808 | JS.DOT → DEFAULT_DOT: SD / → text | — / — |
| function(punctuation) | `=>` | #bcbec4 | #080808 | TS.FUNCTION_ARROW → JS.FUNCTION_ARROW → DEFAULT_OPERATION_SIGN (K) | — / — |
| separator, paren, squareBracket, brace, punctuation | `, ; ( [ { ...` | #bcbec4 | #080808 | JS.COMMA / SEMICOLON / PARENTHESES / BRACKETS / BRACES → DEFAULT_*. D: SD. L: DC:191 and DC:234 are empty; the rest are unset → text | — / — |
| meta (decorator) | `@Prop` | #b3ae60 | #9e880d | JS.DECORATOR → DEFAULT_METADATA (K): SD / SL:223. Lezer tags only the `@` as meta; the name is a variableName `[INFERENCE: WebStorm colours the whole decorator]` | — / — |

### HTML / JSX / Vue

| Lezer tag | example | Dark | Light | key → chain (where it was found) | style D / L |
|---|---|---|---|---|---|
| tagName (HTML, Vue template) | `div` | #d5b778 | #0033b3 | HTML_TAG_NAME → DEFAULT_KEYWORD (X). D: SD. L: SL:205 | — / — |
| tagName (JSX) | `div` | #d5b778 | #0033b3 | XML_TAG_NAME → DEFAULT_KEYWORD (X) `[INFERENCE: JSX uses the XML_* keys]` | — / — |
| tagName (component) | `MyComp` | #2fbaa3 | #0033b3 (HTML) / #008077 (XML) | HTML_CUSTOM_TAG_NAME → HTML_TAG_NAME → DEFAULT_KEYWORD; XML_CUSTOM_TAG_NAME → XML_TAG_NAME (X). D: SD sets both. L: SL:495 sets only the XML key `[INFERENCE: which key a component tag gets]` | — / — |
| angleBracket | `< />` | #d5b778 | #080808 | HTML_TAG / XML_TAG → DEFAULT_TAG → TEXT (X, DL). D: SD. L: SL:252 is empty → text | — / — |
| attributeName (HTML, Vue) | `class` | #bababa | #174ad4 | HTML_ATTRIBUTE_NAME → DEFAULT_ATTRIBUTE → DEFAULT_IDENTIFIER (X, DL). D: Darcula DC:2399 (SD doesn't set it). L: SL DEFAULT_ATTRIBUTE ≈:124 | — / — |
| attributeName (JSX) | `onClick` | #bcbec4 | #174ad4 | XML_ATTRIBUTE_NAME → DEFAULT_ATTRIBUTE (X). D: SD. L: SL ≈:124 `[INFERENCE: JSX uses XML_*]` | — / — |
| keyword (Vue `VueAttributeName`) | `v-if :x @y` | #bababa | #174ad4 | HTML_ATTRIBUTE_NAME chain as above `[INFERENCE: directives are keyed as HTML attributes]`. Lezer tags these as keyword | — / — |
| attributeValue | `"x"` | #6aab73 | #067d17 | HTML_ATTRIBUTE_VALUE / XML_ATTRIBUTE_VALUE → DEFAULT_STRING (X). D: SD marks it inherit → SD DEFAULT_STRING (Darcula's #a5c261 is not reached). L: SL:246 | — / — |
| character (entity) | `&amp;` | #56a8f5 | #174be6 | HTML_ENTITY_REFERENCE → DEFAULT_ENTITY → DEFAULT_IDENTIFIER (X). D: SD. L: SL:180 | — / — |
| blockComment (HTML) | `<!-- -->` | #7a7e85 | #8c8c8c | HTML_COMMENT → DEFAULT_LINE_COMMENT (X): SD / SL:217 | — / italic |
| content | text | #bcbec4 | #080808 | HTML_CODE / XML_TAG_DATA → TEXT (X) | — / — |
| documentMeta, processingInstruction | `<!doctype html>` | #d5b778 | #080808 | XML_PROLOGUE → TEXT (X). D: SD. L: Default DC:976-979 is empty → text `[INFERENCE: key on the doctype token]` | — / — |
| definitionOperator (HTML) | `=` inside a tag | #d5b778 | #080808 | part of the HTML_TAG token → DEFAULT_TAG `[INFERENCE: token key]` | — / — |
| brace (Vue) | `{{ }}` | #bcbec4 | #080808 | VUE.SCRIPT_DELIMITERS → DEFAULT_SEMICOLON (VF). D: SD. L: DC:234 is empty → text | — / — |

### CSS

| Lezer tag | example | Dark | Light | key → chain (where it was found) | style D / L |
|---|---|---|---|---|---|
| propertyName | `color:` | #bababa | #174ad4 | CSS.PROPERTY_NAME → HTML_ATTRIBUTE_NAME → DEFAULT_ATTRIBUTE (K, X). D: Darcula DC:2399. L: SL ≈:124 | — / — |
| tagName (selector) | `div {` | #d5b778 | #0033b3 | CSS.TAG_NAME → HTML_TAG_NAME → DEFAULT_KEYWORD. D: SD HTML_TAG_NAME. L: SL:205 | — / — |
| className, constant(className), labelName (`#id`), attributeName, definitionOperator (`&`) | `.a :hover #b [href] &` | #d5b778 | #0033b3 | CSS.CLASS_NAME / CSS.PSEUDO / CSS.HASH / CSS.ATTRIBUTE_NAME / CSS.AMPERSAND → CSS.IDENT → HTML_TAG_NAME → DEFAULT_KEYWORD (K) | — / — |
| color | `#fff` | #56a8f5 | #0033b3 | CSS.COLOR: D SD sets it. L → CSS.IDENT → HTML_TAG_NAME → DEFAULT_KEYWORD | — / — |
| atom (value names) | `block bold` | #6aab73 | #067d17 | CSS.PROPERTY_VALUE → HTML_ATTRIBUTE_VALUE → DEFAULT_STRING. D: SD inherit → DEFAULT_STRING. L: SL:246 `[INFERENCE: value identifiers get CSS.PROPERTY_VALUE]` | — / — |
| unit | `px` | #6aab73 | #067d17 | CSS.UNIT → CSS.PROPERTY_VALUE → … (K) | — / — |
| atom (CallTag), operatorKeyword (Callee) | `rgb( var( url(` | #d5b778 | #0033b3 | CSS.FUNCTION → HTML_TAG_NAME → DEFAULT_KEYWORD (K) | — / — |
| url | `url(x)` | #5c92ff | #067d17 | CSS.URL: D SD sets it. L → HTML_ATTRIBUTE_VALUE → DEFAULT_STRING | — / — |
| number | `10` | #2aacb8 | #1750eb | CSS.NUMBER → DEFAULT_NUMBER | — / — |
| string | `"a"` | #6aab73 | #067d17 | CSS.STRING → DEFAULT_STRING | — / — |
| definitionKeyword, keyword | `@media from` | #cf8e6d | #0033b3 | CSS.KEYWORD → DEFAULT_KEYWORD | — / — |
| modifier | `!important` | #cf8e6d | #0033b3 | CSS.IMPORTANT: D SD sets it (FONT_TYPE 1). L → DEFAULT_KEYWORD | bold / — |
| blockComment | `/* */` | #7a7e85 | #8c8c8c | CSS.COMMENT → HTML_COMMENT → DEFAULT_LINE_COMMENT (K, X) | — / italic |
| compareOperator, logicOperator, arithmeticOperator | `> + ~` | #bcbec4 | #080808 | CSS.OPERATORS → DEFAULT_OPERATION_SIGN | — / — |
| punctuation, derefOperator | `:` | #bcbec4 | #080808 | CSS.COLON → TEXT | — / — |
| separator, paren, squareBracket, brace | `; , ( [ {` | #bcbec4 | #080808 | CSS.SEMICOLON / COMMA / PARENTHESES / BRACKETS / BRACES → DEFAULT_* | — / — |
| variableName (custom property) | `--x` | UNRESOLVED | UNRESOLVED | no CSS key for it in K | — |
| namespace, definitionOperator (`*`) | `svg|a`, `*` | UNRESOLVED | UNRESOLVED | no CSS key for them in K | — |

### JSON

| Lezer tag | example | Dark | Light | key → chain (where it was found) | style D / L |
|---|---|---|---|---|---|
| propertyName | `"k":` | #c77dbb | #871094 | JSON.PROPERTY_KEY → DEFAULT_INSTANCE_FIELD (K) | — / — |
| string | `"v"` | #6aab73 | #067d17 | JSON.STRING → DEFAULT_STRING | — / — |
| number | `1` | #2aacb8 | #1750eb | JSON.NUMBER → DEFAULT_NUMBER | — / — |
| bool, null | `true null` | #cf8e6d | #0033b3 | JSON.KEYWORD → DEFAULT_KEYWORD | — / — |
| separator | `, :` | #bcbec4 | #080808 | JSON.COMMA → DEFAULT_COMMA; JSON.COLON → DEFAULT_SEMICOLON. L: DC:191 and DC:234 are empty → text | — / — |
| squareBracket, brace | `[ {` | #bcbec4 | #080808 | JSON.BRACKETS / BRACES → DEFAULT_* | — / — |

### Markdown

| Lezer tag | example | Dark | Light | key → chain (where it was found) | style D / L |
|---|---|---|---|---|---|
| heading, heading1–6 | `# H` | #c77dbb | #871094 | MARKDOWN_HEADER_LEVEL_n → DEFAULT_CONSTANT (K): SD / SL ≈:135. MD/MDL's `MARKDOWN_HEADER` is a different key | italic / italic |
| processingInstruction, contentSeparator | `# * \` > -`, `---` | #cf8e6d | #0033b3 | MARKDOWN_*_MARKER / MARKDOWN_HRULE / MARKDOWN_TABLE_SEPARATOR → DEFAULT_KEYWORD | — / — |
| monospace | `` `x` ``, code block | #6aab73 | #067d17 | MARKDOWN_CODE_SPAN / CODE_BLOCK / CODE_FENCE → DEFAULT_STRING | — / — |
| quote | `> q` | #6aab73 | #067d17 | MARKDOWN_BLOCK_QUOTE → DEFAULT_STRING | — / — |
| link | `[text]` | #56a8f5 | #006dcc | MARKDOWN_LINK_TEXT: D SD sets it. L → HYPERLINK_ATTRIBUTES SL:372 | underline / underline |
| url (autolink) | `<http://…>` | #56a8f5 | #006dcc | MARKDOWN_AUTO_LINK: D SD sets it. L → HYPERLINK_ATTRIBUTES SL:372 | underline / underline |
| url (inline link destination) | `(http://…)` | #57aaf7 | #00627a | MARKDOWN_LINK_DESTINATION → DEFAULT_STATIC_METHOD: SD / SL:240 | italic / italic |
| labelName (CodeInfo) | ` ```ts ` | #c77dbb | #871094 | MARKDOWN_CODE_FENCE_LANGUAGE → DEFAULT_CONSTANT | italic / italic |
| labelName (LinkLabel) | `[ref]:` | #cf8e6d | #0033b3 | MARKDOWN_LINK_LABEL → DEFAULT_KEYWORD | — / — |
| string (LinkTitle) | `"title"` | #6aab73 | #067d17 | MARKDOWN_LINK_TITLE → DEFAULT_STRING | — / — |
| emphasis | `*a*` | #bcbec4 | #080808 | MARKDOWN_ITALIC has no fallback (K). D: not in SD or Darcula; its code default wasn't read → style UNRESOLVED. L: MDL sets FONT_TYPE 2 | UNRESOLVED / italic |
| strong | `**a**` | #bcbec4 | #080808 | MARKDOWN_BOLD, same situation; L: MDL sets FONT_TYPE 1 | UNRESOLVED / bold |
| strikethrough | `~~a~~` | #bcbec4 | #080808 | MARKDOWN_STRIKE_THROUGH → DEPRECATED_ATTRIBUTES. D: SD strikeout, effect #bcbec4. L: DEPRECATED_ATTRIBUTES not read → UNRESOLVED | strikeout / UNRESOLVED |
| comment | `<!-- -->` | #7a7e85 | #8c8c8c | MARKDOWN_COMMENT → DEFAULT_LINE_COMMENT | — / italic |
| list, content | list items, text | #bcbec4 | #080808 | MARKDOWN_*_LIST has no fallback; MARKDOWN_TEXT → TEXT | — / — |
| escape, character | `\*`, `&amp;` | UNRESOLVED | UNRESOLVED | not in K | — |

### Colour groups (one line per colour)

**Islands Dark:**
- #cf8e6d: every JS keyword incl. bool, null, this, super and primitive types; escapes; CSS at-rules and `!important` (bold); Markdown markers and link labels; JSON bool/null
- #6aab73: strings, template text, HTML/JSX attribute values, CSS values, units and strings; Markdown code, quotes and link titles; JSON strings
- #2aacb8: numbers
- #42c3d4: regexp
- #7a7e85: comments (JS, HTML, CSS, Markdown)
- #5f826b italic: doc comments
- #56a8f5: functions and methods (declarations and calls, global, local and instance), HTML entities, CSS colour literals, Markdown link text and autolinks
- #57aaf7 italic: static methods, Markdown link destinations
- #c77dbb: properties, JSON keys
- #c77dbb italic: static fields, enum members, Markdown headings, fence language
- #c77dba italic: global and exported variables
- #a9b7c6: local variables
- #bcbec4: parameters, classes, interfaces, type aliases, module names, labels, operators, punctuation, `${ }`, Vue `{{ }}`, JSX attribute names, plain text
- #507874: type parameters
- #b3ae60: decorators
- #d5b778: HTML/JSX tag names and angle brackets, doctype, CSS selectors (tag, class, id, pseudo, attribute, `&`), CSS functions
- #2fbaa3: component tags
- #bababa: HTML and Vue attribute names, CSS property names
- #5c92ff: CSS `url()`

**Islands Light:**
- #0033b3: keywords, primitive types, HTML/JSX tag names (and HTML component tags), CSS selectors, functions, colour literals, at-rules and `!important`; Markdown markers and link labels; JSON bool/null
- #067d17: strings, attribute values, CSS values, units, strings and `url()`; Markdown code, quotes and link titles; JSON strings
- #1750eb: numbers
- #264eff: regexp
- #0037a6: escapes
- #8c8c8c italic: all comments
- #2a8c7c: local variables
- #830091: global and exported variables
- #914c07: methods
- #00627a: nested functions
- #00627a italic: static methods, Markdown link destinations
- #080808: text, operators, punctuation, angle brackets, doctype, `${ }`, Vue `{{ }}`
- #080808 italic: top-level and exported functions
- #080808 with #000000 underline: parameters
- #080808 with #808080 underline: labels
- #000000: classes, interfaces, type aliases, module names
- #871094: properties, JSON keys
- #871094 italic: static fields, enum members, Markdown headings, fence language
- #20999d: type parameters
- #9e880d: decorators
- #174ad4: HTML, Vue and JSX attribute names; CSS property names
- #174be6: entities
- #008077: XML/JSX component tags
- #006dcc underlined: Markdown links and autolinks

## A. Islands Light, corrected rows

These rows replace the earlier ones. They resolve along `parentTheme`: Islands Light → `expUI/expUI_light_with_light_header.theme.json` (EH, its line 5) → `expUI/expUI_light.theme.json` (EL, its line 5) → `themes/intellijlaf.theme.json` (IJ), all inside `lib/intellij.platform.ide.impl.jar`.

| yamt token | value | editor key | source | how resolved |
|---|---|---|---|---|
| --color-fg | #000000 | `*.foreground` | IJ:56 → IJ:29 → IJ:8 | alias chain: none of IL, EH or EL sets `*.foreground` (EL's `*` block at :109 has no foreground) → IJ `"foreground": "foreground"` → `"black"` → #000000 |
| --color-minimap-slider | #73737333 | gap (no minimap); closest `ScrollBar.thumbColor` (`ScrollBar.Transparent.thumbColor` is the same, IJ:735) | IJ:707 | IL, EH and EL set no `ScrollBar`, so the base theme applies. The macOS variant `ScrollBar.Mac.thumbColor` is #00000033 (IJ:717) |
| --color-minimap-slider-hover | #73737347 | `ScrollBar.hoverThumbColor` (Transparent is the same, IJ:732) | IJ:704 | direct (base theme). Mac: #00000080 (IJ:714) |
| --color-minimap-slider-active | #73737347 | gap: no pressed key; closest is hover | IJ:704 | closest element |
| scrollbar thumb | #73737333 (hover #73737347) | `ScrollBar.thumbColor` / `hoverThumbColor` | IJ:707, IJ:704 | direct (base theme); the scheme `ScrollBar.Transparent.*` values in Default match (DC:108, DC:111) |
| popup border | #d1d3d9 | `Popup.borderColor` | IL:893 → IL:365 → IL:14 | alias: popup-border-windows → gray-130. IL overrides EL:540 (`windowsPopupBorder` #b9bdc9) and applies on every OS |
| menu border | #e9eaee | `Menu.borderColor` → `os.default` (on Windows: popup-border-windows #d1d3d9) | IL:743-745 → IL:206 → IL:174 → IL:12 | alias: popup-border → layer-2-border → gray-150 |