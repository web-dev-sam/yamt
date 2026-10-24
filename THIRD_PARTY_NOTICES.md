# Third-party notices

yamt is MIT-licensed ([LICENSE](LICENSE)). The app bundles the software below under its own license.
Every copyright line and license text is in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt), which
ships inside the AppImage, the `.deb` and the macOS app next to `LICENSE`.

## How the full text is made

`scripts/third-party-licenses.sh` (`just third-party-licenses`) writes `THIRD_PARTY_LICENSES.txt`; the
release jobs regenerate it and fail when the committed copy is out of date.

- **Rust crates**: every crate the app builds on Linux x86_64 and macOS (`cargo metadata`, normal and
  build dependencies, no dev-dependencies), quoted from the license files in each crate. When a crate
  offers MIT as one choice and ships an MIT file, its other license files are left out. A crate that
  ships no license file (for example the `objc2` and `specta` families) gets the standard text of its
  declared license with the holder from its `Cargo.toml`. The MPL-2.0 crates (`cssparser`,
  `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`) are used unmodified; their source is on
  [crates.io](https://crates.io).
- **JavaScript packages**: `pnpm -C frontend licenses list --prod`, quoted from each package's license
  file. The list includes Vue's compiler packages, which the build uses but the app does not carry.
- **Icons**: hand-checked. Lucide (ISC, Lucide Contributors; some icons derived from Feather, MIT, Cole
  Bemis) and vscode-icons (MIT, Roberto Huertas) are build-time packages (`@iconify-json/*`); the build
  copies the SVGs the app uses into its code. Holder and license come from each package's `info.json`.
- **Copied code**: hand-checked. The minimap's glyph intensities and character index are copied from Visual
  Studio Code (MIT, Microsoft Corporation; `minimapPreBaked.ts`, `minimapCharSheet.ts`) into
  `frontend/src/editor/internal/minimapGlyphs.ts`; `minimapLayout.ts` and `minimapPixels.ts` follow its minimap
  layout and glyph drawing (`minimap.ts`, `minimapCharRenderer.ts`).
- **Theme colours**: hand-checked. The eight editor themes in `frontend/src/themes/` hold colour values (no
  code) read from each editor's theme files, and every value names its file: Visual Studio Code 1.143's
  `theme-defaults` (MIT, Microsoft Corporation); Atom 1.60's One themes and its `github` package (MIT, GitHub
  Inc.); Zed 1.25's One themes (`assets/themes/one`, MIT, GitHub Inc.), with Zed's own defaults for the keys
  they leave out; WebStorm 2026.2's Islands themes and colour schemes from the IntelliJ Platform
  (`intellij-community`, Apache-2.0, JetBrains s.r.o.).
- **System libraries in the AppImage**: the Linux AppImage carries the GTK and WebKitGTK libraries of the
  Ubuntu 22.04 build machine (LGPL-2.1-or-later and other licenses). The full-text file names their Ubuntu
  source packages; the release job appends the installed versions and the GNU LGPL and GPL texts before
  bundling. The `.deb` and the macOS app use the system's copies instead.

If a package has neither a license file nor a license the script knows, the script stops and names it.

## Main components

| component                                                                                           | used for                               | license                     |
| --------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------- |
| [Tauri](https://tauri.app) 2.12.1 (`tauri`, `wry`, `tao`, `@tauri-apps/api`)                        | the desktop shell                      | MIT or Apache-2.0           |
| [Vue](https://vuejs.org) 3.5                                                                        | the window's chrome                    | MIT                         |
| [CodeMirror](https://codemirror.net) 6 and Lezer                                                    | the three editor panes, syntax colours | MIT                         |
| [VueUse](https://vueuse.org)                                                                        | Vue helpers                            | MIT                         |
| [Valibot](https://valibot.dev)                                                                      | data checks                            | MIT                         |
| [Lucide](https://lucide.dev) icons                                                                  | toolbar, arrow and mark icons          | ISC, Lucide Contributors    |
| [vscode-icons](https://github.com/vscode-icons/vscode-icons)                                        | file-type icons                        | MIT, Roberto Huertas        |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) via `@fontsource/jetbrains-mono` 5.3.0 | the editor font                        | OFL-1.1, notice in the file |
| [Visual Studio Code](https://github.com/microsoft/vscode) minimap                                   | the Result's minimap                   | MIT, Microsoft Corporation  |
| Theme colours of Visual Studio Code, Atom, Zed and WebStorm                                         | the eight editor themes                | MIT; Apache-2.0 (WebStorm)  |
