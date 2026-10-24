# WebStorm 2026.2 — JavaScript/TypeScript attribute keys and their fallbacks (read by the orchestrator)

Source: `plugins/javascript-plugin/lib/modules/intellij.javascript.psi.impl.jar`, classes
`com/intellij/lang/javascript/highlighting/{JavaScriptHighlightDescriptor,TypeScriptHighlightDescriptor,TypeScriptHighlighter}.class`,
disassembled with `javap -c -p -constants` (static initialisers). `JS.<NAME>` is created with the fallback on the
right; `TS.<NAME>` falls back to the `JS.` key unless named otherwise.

| JS key                                     | fallback                      |
| ------------------------------------------ | ----------------------------- |
| JS.KEYWORD                                 | DEFAULT_KEYWORD               |
| JS.STRING                                  | DEFAULT_STRING                |
| JS.NUMBER                                  | DEFAULT_NUMBER                |
| JS.REGEXP                                  | DEFAULT_STRING                |
| JS.LINE_COMMENT                            | DEFAULT_LINE_COMMENT          |
| JS.BLOCK_COMMENT                           | DEFAULT_BLOCK_COMMENT         |
| JS.DOC_COMMENT                             | DEFAULT_DOC_COMMENT           |
| JS.OPERATION_SIGN                          | DEFAULT_OPERATION_SIGN        |
| JS.PARENTHESES                             | DEFAULT_PARENTHS              |
| JS.BRACKETS                                | DEFAULT_BRACKETS              |
| JS.BRACES                                  | DEFAULT_BRACES                |
| JS.COMMA                                   | DEFAULT_COMMA                 |
| JS.DOT                                     | DEFAULT_DOT                   |
| JS.SEMICOLON                               | DEFAULT_SEMICOLON             |
| JS.BAD_CHARACTER                           | BAD_CHARACTER                 |
| JS.DOC_TAG                                 | DEFAULT_DOC_COMMENT_TAG       |
| JS.DOC_TAG_NAMEPATH                        | DEFAULT_DOC_COMMENT_TAG_VALUE |
| JS.DOC_TYPE                                | JS.DOC_TAG_NAMEPATH           |
| JS.VALID_STRING_ESCAPE                     | DEFAULT_VALID_STRING_ESCAPE   |
| JS.INVALID_STRING_ESCAPE                   | DEFAULT_INVALID_STRING_ESCAPE |
| JS.LOCAL_VARIABLE                          | DEFAULT_LOCAL_VARIABLE        |
| JS.PARAMETER                               | DEFAULT_PARAMETER             |
| JS.INSTANCE_MEMBER_VARIABLE                | DEFAULT_INSTANCE_FIELD        |
| JS.STATIC_MEMBER_VARIABLE                  | DEFAULT_STATIC_FIELD          |
| JS.GLOBAL_VARIABLE                         | DEFAULT_GLOBAL_VARIABLE       |
| JS.GLOBAL_FUNCTION                         | DEFAULT_FUNCTION_DECLARATION  |
| JS.LOCAL_FUNCTION                          | DEFAULT_FUNCTION_DECLARATION  |
| JS.DECORATOR (field ES6_DECORATOR)         | DEFAULT_METADATA              |
| JS.STATIC_MEMBER_FUNCTION                  | DEFAULT_STATIC_METHOD         |
| JS.INSTANCE_MEMBER_FUNCTION                | DEFAULT_INSTANCE_METHOD       |
| JS.CLASS                                   | DEFAULT_CLASS_NAME            |
| JS.INTERFACE                               | DEFAULT_INTERFACE_NAME        |
| JS.TYPE_ALIAS                              | JS.INTERFACE                  |
| JS.LABEL                                   | DEFAULT_LABEL                 |
| JS.MODULE_NAME                             | DEFAULT_IDENTIFIER            |
| JS.FUNCTION_ARROW                          | DEFAULT_OPERATION_SIGN        |
| JS.PRIMITIVE_TYPE                          | JS.KEYWORD                    |
| JS.EXPORTED_VARIABLE                       | JS.GLOBAL_VARIABLE            |
| JS.EXPORTED_FUNCTION                       | JS.GLOBAL_FUNCTION            |
| JS.EXPORTED_CLASS                          | JS.CLASS                      |
| JS.JSX_CLIENT_COMPONENT                    | XML_CUSTOM_TAG_NAME           |
| JS.TEMPLATE_LITERAL_PLACEHOLDER_DELIMITERS | DEFAULT_BRACES                |

TypeScript differences: `TS.INTERFACE` → DEFAULT_INTERFACE_NAME; `TS.TYPE.ALIAS` → `TS.INTERFACE`;
`TS.PRIMITIVE.TYPES` → `TS.KEYWORD`; `TS.DOC_TYPE` → `TS.DOC_TAG_NAMEPATH`; `TS.EXPORTED_*` → `TS.GLOBAL_*`/`TS.CLASS`;
`TS.FUNCTION_ARROW` → `JS.FUNCTION_ARROW`; descriptor keys (`TypeScriptHighlightDescriptor`): MODULE_NAME →
DEFAULT_IDENTIFIER, ENUM → `TS.CLASS`, ENUM_MEMBER → `TS.STATIC_MEMBER_VARIABLE`, TYPE_PARAMETER → (switch default,
no fallback read); `TS.TYPE_GUARD` has no fallback.

## CSS, Markdown, JSON (same method)

`plugins/css-plugin/lib/modules/intellij.css.common.psi.jar` `com/intellij/psi/css/impl/util/CssHighlighter.class`:
CSS.IDENT → HTML_TAG_NAME; CSS.COMMENT → HTML_COMMENT; CSS.PROPERTY_NAME → HTML_ATTRIBUTE_NAME; CSS.PROPERTY_VALUE →
HTML_ATTRIBUTE_VALUE; CSS.UNIT → CSS.PROPERTY_VALUE; CSS.TAG_NAME → HTML_TAG_NAME; CSS.STRING → DEFAULT_STRING;
CSS.NUMBER → DEFAULT_NUMBER; CSS.KEYWORD → DEFAULT_KEYWORD; CSS.IMPORTANT → DEFAULT_KEYWORD; CSS.FUNCTION →
HTML_TAG_NAME; CSS.URL → HTML_ATTRIBUTE_VALUE; CSS.OPERATORS → DEFAULT_OPERATION_SIGN; CSS.PARENTHESES/BRACKETS/
BRACES/DOT/SEMICOLON/COMMA → DEFAULT_*; CSS.COLON → TEXT; CSS.COLOR, CSS.PSEUDO, CSS.HASH (id selector),
CSS.AMPERSAND, CSS.UNICODE.RANGE, CSS.CLASS_NAME, CSS.ATTRIBUTE_NAME → CSS.IDENT.

`plugins/markdown/lib/intellij.markdown.jar` `org/intellij/plugins/markdown/highlighting/MarkdownHighlighterColors.class`:
MARKDOWN_TEXT → TEXT; MARKDOWN_BOLD, _ITALIC, _UNORDERED_LIST, _ORDERED_LIST, _HTML_BLOCK, _INLINE_HTML, _LIST_ITEM,
_LINK_DEFINITION, _REFERENCE_LINK → no fallback; *_MARKER (bold, italic, code span, block quote, list, header, code
fence), _HRULE, _TABLE_SEPARATOR, _LINK_LABEL → DEFAULT_KEYWORD; _CODE_SPAN, _BLOCK_QUOTE, _CODE_BLOCK, _CODE_FENCE,
_EXPLICIT_LINK, _LINK_TITLE → DEFAULT_STRING; _HEADER_LEVEL_1…6, _CODE_FENCE_LANGUAGE → DEFAULT_CONSTANT;
_STRIKE_THROUGH → DEPRECATED_ATTRIBUTES; _IMAGE → INJECTED_LANGUAGE_FRAGMENT; _LINK_TEXT, _AUTO_LINK →
HYPERLINK_ATTRIBUTES; _LINK_DESTINATION → DEFAULT_STATIC_METHOD; _COMMENT → DEFAULT_LINE_COMMENT.

`plugins/json/lib/intellij.json.jar` `com/intellij/json/highlighting/JsonSyntaxHighlighterFactory.class`:
JSON.BRACKETS/BRACES/COMMA/NUMBER/STRING/KEYWORD/LINE_COMMENT/BLOCK_COMMENT/IDENTIFIER → DEFAULT_*; JSON.COLON →
DEFAULT_SEMICOLON; JSON.PROPERTY_KEY → DEFAULT_INSTANCE_FIELD; JSON.VALID_ESCAPE/INVALID_ESCAPE → DEFAULT_*_STRING_ESCAPE;
JSON.PARAMETER → DEFAULT_KEYWORD.

Not read here (open source, intellij-community `idea/262.10968.63`): `XmlHighlighterColors.java` (HTML_* → XML_* →
DEFAULT_*) and `DefaultLanguageHighlighterColors.java` (DEFAULT_* → DEFAULT_IDENTIFIER etc.).
