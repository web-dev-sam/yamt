use yamt_settings::Theme;

use crate::args::Ai;
use crate::window::WindowKind;

// wry 0.57 injects it at document start (webkitgtk/mod.rs:822, wkwebview/mod.rs:787): "after the
// document element is created, but before any other content is loaded" (WKUserScriptInjectionTime).
pub(crate) fn start_script(theme: Theme, kind: WindowKind, ai: Ai) -> String {
    let ai_line = match (kind, ai) {
        (WindowKind::Range, Ai::On) => " document.documentElement.dataset.ai = \"on\";",
        (WindowKind::Range, Ai::Off)
        | (WindowKind::Merge | WindowKind::Compare, Ai::On | Ai::Off) => "",
    };
    format!(
        "document.documentElement.dataset.theme = \"{}\"; document.documentElement.dataset.window = \"{}\";{ai_line}",
        theme.name(),
        kind.name()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_start_script_names_the_theme_and_the_window() {
        assert_eq!(
            start_script(Theme::Light, WindowKind::Merge, Ai::Off),
            r#"document.documentElement.dataset.theme = "light"; document.documentElement.dataset.window = "merge";"#
        );
        assert_eq!(
            start_script(Theme::Dark, WindowKind::Compare, Ai::Off),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "compare";"#
        );
        assert_eq!(
            start_script(Theme::ZedLight, WindowKind::Merge, Ai::Off),
            r#"document.documentElement.dataset.theme = "zed-light"; document.documentElement.dataset.window = "merge";"#
        );
        assert_eq!(
            start_script(Theme::Dark, WindowKind::Range, Ai::Off),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "range";"#
        );
    }

    // The page builds its agent client only under `data-ai`; a merge or compare page must never get it.
    #[test]
    fn the_start_script_marks_ai_only_when_on() {
        assert_eq!(
            start_script(Theme::Dark, WindowKind::Range, Ai::On),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "range"; document.documentElement.dataset.ai = "on";"#
        );
        for kind in [WindowKind::Merge, WindowKind::Compare] {
            assert!(!start_script(Theme::Dark, kind, Ai::On).contains("dataset.ai"));
        }
        assert!(!start_script(Theme::Dark, WindowKind::Range, Ai::Off).contains("dataset.ai"));
    }
}
