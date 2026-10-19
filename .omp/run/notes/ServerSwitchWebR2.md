#1288 is fixed. The switch is now a `<button role="switch">`, so the browser can't toggle it on its own: `aria-checked` changes only when the stored setting changes, however fast the reply arrives. All three acceptance lines were checked in WebKit and in the real app, and every session I started is stopped. Nothing is committed.

```
summary
  frontend/src/ui/LanguageServerSettings.vue: the native checkbox inside a <label> is replaced by
  <button type="button" role="switch" :aria-checked="!off.has(spec.key)">. A click (or Space/Enter, as on any
  button) calls switchServer(spec.key, off.has(spec.key)). The button holds a small box (border-control-border
  while off; border-primary bg-primary text-on-primary with a lucide Check size-3.5 while on, aria-hidden) and the
  server's name, which is its accessible name. The button is muted while off, as before.

files_changed
  frontend/src/ui/LanguageServerSettings.vue

tests_added
  none. The brief names no test. The behaviour is the shown state in WebKit and the app, observed below; this
  component has no node test.

smoke_evidence
  1. Recipes (exit codes read separately)
     pnpm -C frontend lint      → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", lint=0
     pnpm -C frontend typecheck → "$ vue-tsc -b", tc=0
     pnpm -C frontend test      → "Test Files  116 passed (116)", "Tests  1574 passed (1574)", test=0
     pnpm -C frontend unused    → "$ knip --include exports,types", unused=0
     pnpm -C frontend fmt:check → "All matched files use the correct format.", fmt=0
     pnpm -C frontend sfc-order → "$ tsx scripts/check-sfc-order.ts", sfc=0
  2. WebKit: app-session start-fixture --name q5r2-fx --size 1600x1000, then location.href="/?servers"
     → question "oxlint, TypeScript, Vue (not installed), eslint (not installed) — the repository root"
     → Don't start → Settings
     Switches at first: "oxlint=true ; TypeScript=true ; Vue=true ; eslint=true"
     click "TypeScript" --role switch → {"clicked":{"role":"switch","name":"TypeScript"}}
       right after: {"muted":true,"t":22501,"checked":"false"}   +500 ms: {"muted":true,"t":23245,"checked":"false"}
       header list (Back, "Language servers"): ["oxlint","Vue","eslint"]
     again → right after {"muted":false,"t":59088,"checked":"true"}   +500 ms {"muted":false,"t":59804,"checked":"true"}
       header list: ["oxlint","TypeScript","Vue","eslint"]
     Space with the switch focused (activeElement "switch:TypeScript"):
       → {"muted":true,"t":70566,"checked":"false"} / +500 ms {"muted":true,"t":71292,"checked":"false"};
         header ["oxlint","Vue","eslint"]
       → (light theme) {"muted":false,"t":74413,"checked":"true"} / +500 ms {"muted":false,"t":75133,"checked":"true"}
     Enter also: false/false (75568/76282), then true/true (76771/77502)
     In-page check, read inside the page right around the click:
       {"before":"true","sync":"false","afterTask":"false","frame":"false","after500":"false","muted":true}
       {"before":"false","sync":"true","afterTask":"true","frame":"true","after500":"true","muted":false}
     Screenshots: /tmp/yamt-q5r2/webkit-dark-ts-off.png, /tmp/yamt-q5r2/webkit-light-ts-off.png
       (TypeScript box empty and its name muted; the other three show a filled box with a check)
     stop → "session":"ended", vite and webdriver stopped
  3. Real app: cargo tauri build --debug --no-bundle → "Built application at: …/target/debug/yamt"
     scripts/lsp-repo.sh --servers /tmp/yamt-q5r2/lsp; PATH=~/.cache/yamt/servers-path:$PATH
     app-session start-app --name q5r2-app --repo /tmp/yamt-q5r2/lsp --home /tmp/yamt-q5r2/home
     Start → opened py/api/stats.py → pgrep "724715 /tmp/yamt-q5r2/lsp/py/.venv/bin/ruff server"
     Settings: "Biome=true ; clangd=true ; gopls=true ; Phpactor=true ; ruff=true ; ty=true ; basedpyright=true ;
       rust-analyzer=true ; oxfmt=true ; oxlint=true ; TypeScript=true"
     click ruff --role switch → {"muted":true,"checked":"false"} right after and +500 ms; pgrep → none
       (screenshot /tmp/yamt-q5r2/app-dark-ruff-off.png)
     click again → {"muted":false,"checked":"true"} right after and +500 ms; pgrep "726287 …/py/.venv/bin/ruff server"
     Settings folder 755 → chmod a-w → 555; click ruff:
       before / right after / +500 ms / +2 s → all {"muted":false,"checked":"true"}
       role=alert: ["Could not use the settings file: writing /tmp/yamt-q5r2/home/.config/yamt/settings.json failed:
         Permission denied (os error 13)"]
       file still "off": {}; ruff still running (pid 726287); screenshot /tmp/yamt-q5r2/app-dark-readonly.png shows
         the problem bar
     chmod 755 → "755 /tmp/yamt-q5r2/home/.config/yamt"
     stop → "session":"ended" (tauri-driver, xvfb stopped);
       pgrep for tauri-driver, target/debug/yamt, MiniBrowser, Xvfb :2 → "no sessions left"

deviations_from_brief
  - The name is inside the button rather than referenced through aria-labelledby. The brief allows either. Keys
    contain spaces and parentheses, so they cannot be used as id values. Clicking the name still toggles the switch,
    as the old <label> did.
  - The header list was read after pressing "Back": the Settings screen covers the merge view, so the group button is
    hidden while Settings is shown.
  - .omp/run/slices.json shows as modified in this tree. It was already changed before I started; I did not touch it.

open_risks
  - frontend/src/ui/LanguageServerSettings.vue:76-96: focus is shown by the global :focus-visible outline
    (style.css:168). Space, Enter and focus were observed, but neither screenshot shows the focus outline (I focused
    the switch from script for the light shot).
```