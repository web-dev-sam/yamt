# Request — themes: WebStorm, VS Code, Zed and Atom, in their exact colours

Settled by the orchestrator as owner (OR13: the request states the feature; details are the boring choice); rule 5 is
the owner's answer (2026-10-23). A design may refine a detail a rule names, never reopen a rule.

## Owner's words

Chat (2026-10-23): "create a new branch, I want to enable different themes and add a zed, vscode and webstorm and atom
theme. I want the theme to be exactly those colors so that different editor users can a similar visual feel as their
favorite editor".

## Rules

1. **Which themes.** Settings → Theme lists one pair per editor, each editor's own default dark and light theme in the
   version installed here (Atom: its last release):

   | group    | dark                    | light           | source                                                                                |
   | -------- | ----------------------- | --------------- | ------------------------------------------------------------------------------------- |
   | yamt     | Dark (today's, default) | Light (today's) | `frontend/src/style.css` as it is (the owner's own dark, `3e465cb`)                   |
   | WebStorm | Islands Dark            | Islands Light   | WebStorm 2026.2 (`~/.local/share/JetBrains/WebStorm-262.10968.77`)                    |
   | VS Code  | Dark 2026               | Light 2026      | VS Code 1.143.0 (`/usr/share/code`; its defaults `COLOR_THEME_DARK/LIGHT`)            |
   | Zed      | One Dark                | One Light       | Zed 1.25.3 (its default settings: `"dark": "One Dark"`, `"light": "One Light"`)       |
   | Atom     | One Dark                | One Light       | Atom 1.60.0 (`atom/atom`, packages `one-dark-ui`/`-syntax`, `one-light-ui`/`-syntax`) |

   yamt Dark stays the default. A settings file holding today's `"dark"` or `"light"` keeps opening in yamt Dark or
   yamt Light.

2. **Exact colours.** Every colour yamt paints in an editor's theme is that editor's own value, read from its theme
   files: the window frame, panels, text, muted text, borders, the selection, the caret, the active line, line
   numbers, hovered and selected rows, primary buttons, find matches, problems (error, warning, info), notices, the
   minimap's slider, the code's syntax colours. Each value's source (file and key) is recorded next to it. Where yamt
   shows something the editor has no colour for (the wave line of collapsed lines, the strips between panes), it takes
   the editor's closest element, named in the record.
3. **Code colours.** yamt tells apart as many kinds of words as these editors colour differently (variables, types,
   parameters, properties, operators, punctuation, control keywords, …), so a VS Code user sees VS Code's light-blue
   variables and teal types and an Atom user Atom's red properties (Atom 1.60 parses with tree-sitter by default:
   plain variables stay uncoloured there, `ThemeColoursZedAtom` doubt 3). Which word is which kind comes from yamt's own
   parsers, as today; a word may now and then be classed unlike in the editor. yamt Dark and Light look as today.
4. **Shapes, as each editor draws them** (corrected after the research: VS Code 1.143's default layout is rounded
   cards): yamt's and WebStorm's themes keep today's islands (10 px corners, 5 px gaps, plan §2 #24); VS Code shows its
   cards (8 px corners, 4 px gaps, a 1 px border line); Zed and Atom show flat panels that touch, divided by one 1 px
   line. The file list's width handle and the pane dividers work as today in every shape. Sizes, font families and
   icons are unchanged everywhere; a code word's italic, bold, underline or strikethrough follows the theme where the
   editor's theme sets one (WebStorm's Islands Light draws comments italic).
5. **Change colours follow the editor** (owner 2026-10-23, "Follow the editor"): in an editor's theme, added, changed
   and removed lines and conflicts — tints, word marks, removal bars, strips, the minimap's marks — use that editor's
   own diff, merge and conflict colours; conflicts are purple only in yamt's own themes (plan §2 #32 keeps them).
   A kind the editor has no colour for takes that editor's closest one, named in the record. A conflict takes one
   colour family per theme for all its marks: the editor's whole-conflict colour where it has one (Zed, WebStorm),
   else the colours it gives the incoming/theirs side (VS Code, Atom).
6. **Switching** works as Dark/Light today (plan §2 #57): a pick recolours the whole window at once — every opened
   file, the compare window, the native window background — is stored in the settings file, and the next start opens
   in it with no frame of another colour.

## Acceptance

- Each of the ten themes, in WebKit (fixture page) and in the desktop app: the window, panels, text, selection,
  syntax and change colours computed in the page equal the recorded values; a screenshot per theme for the owner.
- A switch with two files open and the compare window open recolours all of them; the native background follows.
- A restart opens in the stored theme without a frame of another colour.
- A settings file with `"dark"` or `"light"` opens as before.

## Non-goals

Other themes of these editors (VS Code Dark Modern/Dark+, WebStorm Darcula, high contrast, Zed's Ayu/Gruvbox, …);
following the system's light/dark; importing theme files; user-made themes; fonts, font sizes, icons, scrollbars;
per-window themes.
