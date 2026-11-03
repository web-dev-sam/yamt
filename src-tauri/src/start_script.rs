use yamt_settings::Theme;

use crate::args::{Ai, StartScreen};
use crate::window::WindowKind;

// wry 0.57 injects it at document start (webkitgtk/mod.rs:822, wkwebview/mod.rs:787): "after the
// document element is created, but before any other content is loaded" (WKUserScriptInjectionTime).
pub(crate) fn start_script(theme: Theme, kind: WindowKind) -> String {
    let ai_line = match kind {
        WindowKind::Range { ai: Ai::On, .. } => " document.documentElement.dataset.ai = \"on\";",
        WindowKind::Range { ai: Ai::Off, .. } | WindowKind::Compare { .. } | WindowKind::Merge => {
            ""
        }
    };
    let open_line = match kind {
        WindowKind::Compare {
            start: StartScreen::MergeRequests,
        }
        | WindowKind::Range {
            start: StartScreen::MergeRequests,
            ..
        } => " document.documentElement.dataset.open = \"mergeRequests\";",
        WindowKind::Compare {
            start: StartScreen::Files,
        }
        | WindowKind::Range {
            start: StartScreen::Files,
            ..
        }
        | WindowKind::Merge => "",
    };
    format!(
        "document.documentElement.dataset.theme = \"{}\"; document.documentElement.dataset.window = \"{}\";{ai_line}{open_line}",
        theme.name(),
        kind.name()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const COMPARE: WindowKind = WindowKind::Compare {
        start: StartScreen::Files,
    };

    fn range(ai: Ai, start: StartScreen) -> WindowKind {
        WindowKind::Range { ai, start }
    }

    #[test]
    fn the_start_script_names_the_theme_and_the_window() {
        assert_eq!(
            start_script(Theme::Light, WindowKind::Merge),
            r#"document.documentElement.dataset.theme = "light"; document.documentElement.dataset.window = "merge";"#
        );
        assert_eq!(
            start_script(Theme::Dark, COMPARE),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "compare";"#
        );
        assert_eq!(
            start_script(Theme::ZedLight, WindowKind::Merge),
            r#"document.documentElement.dataset.theme = "zed-light"; document.documentElement.dataset.window = "merge";"#
        );
        assert_eq!(
            start_script(Theme::Dark, range(Ai::Off, StartScreen::Files)),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "range";"#
        );
    }

    // The page builds its agent client only under `data-ai`; a merge or compare page must never get it.
    #[test]
    fn the_start_script_marks_ai_only_when_on() {
        assert_eq!(
            start_script(Theme::Dark, range(Ai::On, StartScreen::Files)),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "range"; document.documentElement.dataset.ai = "on";"#
        );
        for kind in [WindowKind::Merge, COMPARE] {
            assert!(!start_script(Theme::Dark, kind).contains("dataset.ai"));
        }
        assert!(
            !start_script(Theme::Dark, range(Ai::Off, StartScreen::Files)).contains("dataset.ai")
        );
    }

    #[test]
    fn the_start_script_opens_the_merge_request_page_only_for_compare_and_range_with_mr() {
        assert_eq!(
            start_script(
                Theme::Dark,
                WindowKind::Compare {
                    start: StartScreen::MergeRequests
                }
            ),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "compare"; document.documentElement.dataset.open = "mergeRequests";"#
        );
        assert_eq!(
            start_script(Theme::Dark, range(Ai::On, StartScreen::MergeRequests)),
            r#"document.documentElement.dataset.theme = "dark"; document.documentElement.dataset.window = "range"; document.documentElement.dataset.ai = "on"; document.documentElement.dataset.open = "mergeRequests";"#
        );
        for kind in [
            WindowKind::Merge,
            COMPARE,
            range(Ai::Off, StartScreen::Files),
        ] {
            assert!(!start_script(Theme::Dark, kind).contains("dataset.open"));
        }
    }
}
