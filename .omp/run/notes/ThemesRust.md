# ThemesRust (row 3a) — round 1, commit 2070cfe (bindings eab4a4c)

- summary: `Theme` ten variants, kebab-case serde, `name()` for all; `window.rs` ten one-line `BACKGROUND_<NAME>`
  constants, exhaustive `background()`.
- files: crates/settings/src/lib.rs, crates/settings/tests/themes.rs (new), src-tauri/src/window.rs.
- tests: `a_theme_name_is_its_serde_spelling` (ten), `the_two_first_names_still_read_as_dark_and_light`,
  `an_editor_theme_reads_by_its_kebab_name`, `a_theme_name_without_its_variant_is_broken_and_names_the_entry`
  ("vscode", "WebstormDark", "webstorm_dark" → Error::Broken naming `theme`), start-script test + `zed-light`.
- evidence: fmt clean; clippy -D warnings clean; yamt-settings 49 tests ok (themes.rs 3); yamt-app window 11 ok;
  bindings-check `Theme = "dark" | "light" | "webstorm-dark" | … | "atom-light"`.
- deviations: AGENTS.md unchanged (lists no names); tests in a new file; two-line comment above the constants.
- open risks: `BACKGROUND_LIGHT` = `BACKGROUND_WEBSTORM_LIGHT` (same colour by contract); comment says Light lives in
  style.css (row 3b moves it to themes/light.css) — sent to the review.
