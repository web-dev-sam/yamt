The flat themes (Zed, Atom) no longer draw a border line along the window's edges. Hiding the side panel with Ctrl+B no longer clips the pane's content or the banners. The other six findings are fixed too. typecheck, test, lint, unused and fmt:check all pass, and the WebKit checks match the acceptance — with one difference on the hidden-list check (see deviations).

```
summary
  - Flat themes: lines show only where panels touch. The app root extends 1 px past every window edge
    (0 px in the island and card themes), and #app clips it with `overflow: clip`.
  - The 1 px overlap is now on the side panel itself (`mr-(--island-overlap)` on the <aside> of FileList and
    CompareTabList), so it goes away with the panel's v-show. The handle's maths is unchanged.
  - Banners sit in one wrapper that is moved back inside the window, so their borders are never clipped.
  - --color-syntax-attribute is #d291cc in Dark and #871094 in Light. Two source comments are corrected
    (WebStorm Island.borderWidth, Atom Light line numbers).
  - themes.ts reports one window-background per theme when window.rs is missing.
    palette.test.ts pins that a token defined outside @theme stays unknown.

files_changed
  frontend/src/style.css
  frontend/src/themes/light.css
  frontend/src/themes/atom-light.css
  frontend/src/themes/webstorm-dark.css
  frontend/src/themes/webstorm-light.css
  frontend/src/ui/App.vue
  frontend/src/ui/CompareApp.vue
  frontend/src/ui/FileList.vue
  frontend/src/ui/CompareTabList.vue
  frontend/scripts/themes.ts
  frontend/scripts/themes.test.ts
  frontend/scripts/palette.test.ts

tests_added
  themes.test.ts "a tree without the window file reports every theme's background"
    — with window.rs absent, the check reports BACKGROUND_DARK, BACKGROUND_LIGHT and BACKGROUND_ZED_DARK
      as window-background at line 1 (#1605; tests the `shell === undefined` branch at themes.ts:275).
  palette.test.ts "a token defined in src/style.css outside @theme stays unknown"
    — `--color-alias: var(--color-panel)` in an @utility is unknown-token where it is defined (style.css:6)
      and where it is used (`var(--color-alias)` in src/ui/extra.css:2) (#1607; tests the slice at palette.ts:25).

smoke_evidence
  pnpm -C frontend typecheck → `$ vue-tsc -b` (no output, exit 0)
  pnpm -C frontend test      → Test Files 149 passed (149); Tests 1963 passed (1963)
  pnpm -C frontend lint      → exit 0
  pnpm -C frontend unused    → exit 0
  pnpm -C frontend fmt:check → All matched files use the correct format. (435 files)

  WebKit, `just app-session start-fixture --name th-pal-r1 --size 1200x800`, DPR 2.
  Pixel runs are in device px; rects in CSS px.

  zed-dark, list shown: aside [-1,-1,239,765], section [238,39,1201,765], handle [236,0,241,764]
    left   y=1200: #2F343E ×6            top x=200: #2F343E ×6      top x=1800: #3B414D ×6
    right  y=1200: #282C33 ×6            bottom x=1800: #282C33 ×6
    between y=1200 x470..485: #2F343E ×6, #464B57 ×2, #282C33 ×8   ← one 1 px line
  zed-dark, Ctrl+B: aside hidden, section [-1,39,1201,765] (its 1 px line sits at x=-1, content from x=0);
    first .cm-content [35.4,78.5,…]
    left y=1200: #282C33 ×6; between x0..15: #282C33 ×16
  zed-dark, Ctrl+B again: aside [-1,-1,239,765]; same "between" run as before
  zed-dark, drag: 240 → aside [-1,-1,359,765], handle [356,0,361,764]; back → [-1,-1,239,765], handle [236,0,241,764]

  atom-light, list shown: aside [-1,-1,239,765], border rgb(219,219,220)
    left #EAEAEB ×6, top #EAEAEB ×6 (both columns), right #FAFAFA ×6, bottom #FAFAFA ×6
    between: #EAEAEB ×6, #DBDBDC ×2, #FAFAFA ×8
  atom-light, Ctrl+B: section [-1,39,1201,765], borderLeftWidth 1px; left #FAFAFA ×6
  atom-light, drag: 360 → aside [-1,-1,359,765], handle [356,0,361,764]; 240 → [-1,-1,239,765], handle [236,0,241,764]

  Banner (all files marked resolved → "All files are resolved…"):
    zed-dark and atom-light, list shown:  banner [239,0,1200,37.5]
      zed-dark run x470..: #2F343E ×6, #464B57 ×2, #38482F ×2 (banner border), …
    list hidden: banner [0,0,1200,37.5], section [-1,77.5,1201,765]
      zed-dark   left@y40 #38482F #38482F, top@x1200 #38482F #38482F, right@y40 …#38482F #38482F
      atom-light left/top/right #3BBA54 at the edge                       ← border whole on every side

  Compare window (`start-fixture --diff-case json-payload`), zed-dark and atom-light:
    aside [-1,-1,239,765], section [238,39,1201,765], handle "Tab list width" [236,0,241,764]
    edge and "between" runs identical to the merge window
    Ctrl+B: section [-1,39,1201,765], left run = panel colour ×6
    drag: 360 → [-1,-1,359,765] / [356,0,361,764]; 240 → [-1,-1,239,765] / [236,0,241,764]

  yamt Dark / Light, base c46c156 vs after, `compare -metric AE`
  (scratch trees in /tmp with a real copy of node_modules — see open_risks):
    dark-ts  0.000980392 (2.67341e-10)    dark-vue  0 (0)
    light-ts 0 (0)                        light-vue 0 (0)
    (the same 0.00098 shows between two base runs; it is below one pixel)
    The Vue file shows `<script setup lang="ts">` with its attributes in #d291cc in both.

deviations_from_brief
  - #1598 choice: the root is pulled past every window edge by --island-overlap (`past-window-edges`
    utility), and #app gets `display: flex; overflow: clip`. With `overflow: hidden`, focus or
    scrollIntoView could scroll the viewport by the 1 px that sticks out; `clip` cannot be scrolled.
  - The root is a flex item (`flex-1 min-w-0`) instead of `h-full`, because negative margins must enlarge it.
  - Not in the brief: the banners (NoticeBar, ProblemBar, the all-resolved line) are wrapped in
    `<div class="inside-window-edges flex shrink-0 flex-col gap-island empty:hidden">`.
    Without this, pulling the root out would clip the banners' top and right borders, and their left border
    whenever the list is hidden — the bug #1603 describes. In flat themes with the list shown, the banner's
    left border now sits next to the panel line instead of on top of it. Island and card themes: no change.
  - Acceptance says "the merge view's left edge sits at x = 0". Here the pane's 1 px line sits at x = −1,
    just outside the window, and the content starts at x = 0, unclipped. A line at x = 0 would be a line at
    the window edge, which #1598 removes.
  - Two new utilities in style.css (`past-window-edges`, `inside-window-edges`) and the #app rule.
    The project map's style.css entry should name them. That is docs/project-map, which I don't own;
    suggested addition: "`past-window-edges` / `inside-window-edges` (flat themes' lines outside the window,
    banners inside); `#app` clips with `overflow: clip`".
  - #1600: chose the header wording ("L:/N: line numbers are one-dark-syntax's, whose _base.less and base.less
    hold the same rules"). That the two files hold the same rules comes from the reviewer and was not
    re-read [INFERENCE].
  - Not done (named in the review notes but not in this brief): the `lineAt` dedupe nit, and the themes.test.ts
    sandbox using `nord.css`.

open_risks
  - frontend/src/style.css:197 — `overflow: clip` on #app is new. It creates no containing block or stacking
    context, so the OperationLabel tooltip should be unaffected; not re-checked in the app (only in the
    fixture, WebKit/MiniBrowser).
  - The AE check needed a real copy of node_modules (`cp -a`). With a node_modules symlink, Vite refused to
    serve the JetBrains Mono font (document.fonts status "error"). Every shot was then drawn in a fallback
    font and differed from the worktree by about 43k pixels. The 0-pixel result above is from runs with the
    font loaded.
  - The #1602 change makes no pixel difference yet: base, round 1 and now all draw attributes alike.
    Whether the editor actually reads --color-syntax-attribute is row 3c's wiring.
```

Main should run `just check` on the merged tree, and `just mutants aeb04c3` for scripts/themes.ts.