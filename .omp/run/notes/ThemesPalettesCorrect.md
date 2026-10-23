```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/App.vue",
      "line": 73,
      "rule_id": "plan §2 #102 shapes / brief amendment 1",
      "problem": "In zed-* and atom-* themes, hiding the file list with Ctrl+B (or the compare tab list, CompareApp.vue:79) hides the side panel, but the right column keeps `ml-(--island-overlap)` = -1px. The column then starts at x = -1, so the NoticeBar, ProblemBar and all-resolved line lose their 1px left border and half their rounded left corners. The pane's left line is gone while its top, right and bottom lines still show. This is the implementer's open risk, and a user can see it.",
      "fix": "Remove `ml-(--island-overlap)` from the right column in App.vue and CompareApp.vue, and put `mr-(--island-overlap)` on the `<aside>` of FileList.vue:57 and CompareTabList.vue:73. The overlap then goes away with the panel's `v-show`. The handle's `right` is measured from the aside's padding box, so it does not move."
    },
    {
      "severity": "should",
      "file": "frontend/src/style.css",
      "line": 136,
      "rule_id": "brief amendment 1 (\"as each editor draws them\")",
      "problem": "The listed deviation \"lines also show at the window edges\" comes from `island` drawing its 1px border on all four sides. In zed-* and atom-* the window gets a border-colour frame at the top, left, bottom and right. Neither editor draws lines at the window edge: Atom draws pane right and bottom edges with no right border on the last pane (AtomUi notes :153), and Zed draws the dock edge only (dock.rs:1341). If it stays, later shape work starts from a frame that no source supports.",
      "fix": "Either draw the flat line only where panels touch (the side panel's inner edge and the line under the header rows), or record in plan §2 #102 that the owner accepts the window-edge frame."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/themes.ts",
      "line": 275,
      "rule_id": "VF7",
      "problem": "Survivors 275:5 (`shell === undefined` → false) and the no-coverage 276:9 show that the silent skip of every background and arm rule when window.rs is absent is never tested. Today only the real-tree test's `toContain(WINDOW_FILE)` stops a missing shell from passing quietly. A later caller of `findThemeViolations` without that assertion would get no background checks and no warning.",
      "fix": "When the window file is absent, report one `window-background` per theme (as a missing constant already is) and add a fixture tree without the window file that expects those findings."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/themes.test.ts",
      "line": 288,
      "rule_id": "VF7",
      "problem": "Survivor 289:47 (`globSync` without `cwd`) lives because the sandbox test writes `src/themes/zed-dark.css`, and that name also exists in the real tree. A glob relative to the process cwd finds the same name and the `existsSync` filter keeps it, so the test does not pin that theme files are read from `frontendRoot`.",
      "fix": "Write a theme name the real tree lacks (for example `src/themes/nord.css`) and expect `[\"src/themes/nord.css\"]`."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/palette.ts",
      "line": 25,
      "rule_id": "VF7 / VU17",
      "problem": "Survivor 25:32 (the `slice` to the `@theme` span is dropped) shows that no test proves a `--color-x:` defined in style.css outside `@theme` (in a utility or a plain `:root` rule) stays unknown. Such a definition would let `var(--color-x)` pass the palette check, and themes.ts would never require `--color-x` in the nine theme blocks.",
      "fix": "Add a palette test where style.css defines `--color-alias: var(--color-panel);` in an `@utility` outside `@theme`, and expect `unknown-token` for a `var(--color-alias)` use in another file."
    }
  ],
  "survivors": [
    {"mutant": "palette.ts:25:32 slice dropped", "triage": "real gap → finding 5 (should). Bug behind it: a token defined outside @theme in style.css counts as known."},
    {"mutant": "palette.ts:38:41 `>=`→`>`", "triage": "(a) equivalent: index == span.start is the `@` of `@theme` or the `:` of `:root[`, and no hex, functional colour or `--color-` match can start there."},
    {"mutant": "palette.ts:38:59 `<`→`<=`", "triage": "(a) equivalent in practice: index == span.end is the character right after the closing `}`. A literal or token glued to `}` (`}#fff`) is not formatter output (fmt:check covers css). No plausible bug."},
    {"mutant": "themes.ts:66:33 `<=` text.length", "triage": "(a) equivalent: `text[text.length]` is undefined and changes no depth."},
    {"mutant": "themes.ts:69:29 `index - 1`", "triage": "(a) equivalent for formatted input: the span loses the `}` and the line break before it, and every definition or arm ends on an earlier line. `--x: y;}` on one line would lose that definition, but loudly, as a missing token. No silent pass."},
    {"mutant": "themes.ts:87:85 `[]`→[\"Stryker was here\"]", "triage": "(a) equivalent: `inside()` destructures start/end from a string as undefined and both comparisons are false."},
    {"mutant": "themes.ts:107:18 trim dropped", "triage": "(a) equivalent under the formatter: `:\\s*` already eats leading space, and only `#fff ;` would differ. That fails loudly (bad-value or window mismatch), never silently."},
    {"mutant": "themes.ts:136:17 optional chaining ×2, 136:42 `path === BINDINGS_FILE`→true", "triage": "(a) equivalent: bindings.ts is the first file in both `readThemeSources` and `tree()`. If it were missing or not first, the union is undefined and every block becomes `extra-block`, or the code throws. Loud either way."},
    {"mutant": "themes.ts:199:58 `?? []`→[\"Stryker…\"]", "triage": "(a) equivalent: only reached when Dark's block is missing (already `missing-block`). `THEMED_TOKEN.test(undefined)` is false, so the reference set stays empty."},
    {"mutant": "themes.ts:242:31 `[]`→[\"Stryker…\"]", "triage": "(a) equivalent: a string arm has variant and constant undefined. It counts as first, and `variants.get(undefined) !== undefined` is false, so the output is the same (killed by nothing; same findings)."},
    {"mutant": "themes.ts:275:5 `shell === undefined`→false (+ NoCoverage 276:9)", "triage": "real gap → finding 3 (should). The real-tree test asserts window.rs is read, so no bug today."},
    {"mutant": "themes.ts:289:47 globSync without cwd", "triage": "real gap → finding 4 (should). A wrong cwd gives `missing-block` everywhere, which is loud. The test just does not pin cwd."},
    {"mutant": "17 NoCoverage `?? \"\"` defaults (palette.ts:26,59; themes.ts:103×3,119,137×2,226×4,246×2, …)", "triage": "(a) equivalent: every group they default (DEFINITION, BLOCK_OPENER, THEME_UNION, QUOTED, BACKGROUND_CONSTANT, BACKGROUND_ARM, TOKEN_DEFINITION, TOKEN_USE) is required, so it is never undefined on a match."}
  ],
  "checked": [
    "Brief check failure paths each have a test: missing block (themes.test.ts 'a theme name without its block'), extra block / misplaced / twice, missing and extra token, bad style and shape values incl. Dark's block, no-source incl. `/**/`, background different and missing (ZED constant absent → line 1), arms swapped, duplicated, unknown, missing and no background(), real tree passes and asserts window.rs and zed-light.css are read.",
    "The reference token set is Dark's THEMED_TOKEN subset. `--spacing-handle`, `--island-overlap` and `--font-*` stay Dark-only, and an extra `--font-sans` in a theme block is reported (test line ~165). Dropping the filter is killed by the in-step fixture, whose DARK has --font-sans and --spacing-handle.",
    "39 `--color-syntax-*` names in style.css equal the design's C2 table names (sorted compare). The 14 style variables are present.",
    "Panel-handle math worked by hand. Islands: right -5px, width 5 = the 5px gap, same as the old `-right-island w-island`. VS Code: right -5.5px from the padding edge, centre at W+2 = centre of the 4px gap. Zed/Atom: right -3px from the padding edge (W-1), centre at W-0.5 = centre of the shared border px [W-1,W]. Matches the report's 243.5–248.5 and 237–242.",
    "`--island-overlap` is a custom property computed on :root, where the theme blocks set --spacing-island and --island-line: 0 for yamt, WebStorm and VS Code, -1px for Zed and Atom. For island themes, `island` = `border: 0px solid …` + radius and `ml-(0px)`, so no layout change. The report's 0-pixel AE for Dark and Light is consistent with this.",
    "light.css matches the removed `:root[data-theme=\"light\"]` block value for value (all 47 old tokens). New tokens keep the look (sidebar = panel #ffffff, on-* = fg #000000, extra syntax tokens = code #080808 or the old token's colour). `color-scheme: light` kept. Dark's @theme keeps every old value (comment, function, property, decorator and tag were only reordered).",
    "Specificity and cascade: the theme blocks `:root[data-theme]` (0,2,0) are unlayered imports and win over Tailwind's layered @theme :root. The imports come before any rule.",
    "Amendment 2 conflict families verified: vscode-dark/light #40a6ff33/#40a6ff80/#40a6ff80/#40a6ff80; zed-dark #74ade81a/#74ade833/#74ade8/#74ade8; zed-light #0588f080/#5c78e233/#0588f0/#0588f0. WebStorm and Atom match design Q6 (#2b2322/#45302b/#45302b/#8f5247; #33a0ff26/#33a0ff40/#33a0ff/#33a0ff). VS Code Light inserted = modified = #9bb95533.",
    "Colour sample against the notes: Zed dark window #3b414d, panel #282c33, separator #464b57, code #acb2be; Atom dark/light window #21252b/#eaeaeb, border #181a1f/#dbdbdc; VS Code dark window #191a1b, panel #121314, code #bbbebf, string #a5d6ff, function #d2a8ff, keyword (modifiers) #569cd6; WebStorm dark keyword #cf8e6d, string #6aab73, property #c77dbb, character #56a8f5, heading #c77dbb italic, url #57aaf7 italic, link underline. All equal the ThemeColours* rows.",
    "Shape values: VS Code 8/4/1 with panel-border #2a2b2c/#e4e5e6; Zed and Atom 0/0/1 with #464b57/#c9c9ca and #181a1f/#dbdbdc; WebStorm 10/5/0.",
    "No `{` or `}` inside comments in src/themes/*.css or style.css, so the brace counter in `blockEnd` cannot be thrown off by a source comment.",
    "Single line where flat panels touch: the right column is later in DOM order and paints its left border over the file list's right border. With the list shown there is one line, as the report's pixel run #2F343E×6, #464B57×2 (DPR 2) shows.",
    "Implementer deviations accepted: PanelWidthHandle.vue edit (approved), border instead of outline (an outline under the scroller would hide), `--island-overlap` derived rather than a token (not themed, so the check ignores it), the value gaps named with `gap:` comments, light.css keeps color-scheme. The project map already names scripts/themes.ts and src/themes/.",
    "Not run: no targeted test was needed. The block above comes from reading the layout (static `ml-(--island-overlap)` beside a `v-show` sibling in a `p-0 gap-0` flex row)."
  ]
}
```