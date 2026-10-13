use gtk::prelude::GtkSettingsExt;
use yamt_settings::Antialiasing;

const ANTIALIAS_ON: i32 = 1;
const SUBPIXEL_ORDERS: [&str; 4] = ["rgb", "bgr", "vrgb", "vbgr"];
const SUBPIXEL_WITHOUT_DESKTOP_ORDER: &str = "rgb";
const GREYSCALE: &str = "none";

/// Sets yamt's own GTK font settings, which outrank the desktop's and which the webview reads
/// when it is built (measured, plan §2 #60).
pub(crate) fn apply(antialiasing: Antialiasing) {
    let Some(settings) = gtk::Settings::default() else {
        tracing::warn!(
            antialiasing = antialiasing.name(),
            "no GTK settings: text is drawn as the desktop says"
        );
        return;
    };
    let rgba = chosen_rgba(antialiasing, settings.gtk_xft_rgba().as_deref());
    settings.set_gtk_xft_antialias(ANTIALIAS_ON);
    settings.set_gtk_xft_rgba(Some(rgba));
    tracing::info!(
        antialiasing = antialiasing.name(),
        rgba,
        "font rendering set"
    );
}

fn chosen_rgba(antialiasing: Antialiasing, desktop: Option<&str>) -> &'static str {
    match antialiasing {
        Antialiasing::Subpixel => desktop
            .and_then(|value| SUBPIXEL_ORDERS.into_iter().find(|order| *order == value))
            .unwrap_or(SUBPIXEL_WITHOUT_DESKTOP_ORDER),
        Antialiasing::Greyscale => GREYSCALE,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subpixel_keeps_the_desktops_subpixel_order() {
        for order in ["rgb", "bgr", "vrgb", "vbgr"] {
            assert_eq!(chosen_rgba(Antialiasing::Subpixel, Some(order)), order);
        }
    }

    #[test]
    fn subpixel_is_rgb_when_the_desktop_has_no_subpixel_order() {
        for desktop in [None, Some("none"), Some(""), Some("RGB"), Some("unknown")] {
            assert_eq!(chosen_rgba(Antialiasing::Subpixel, desktop), "rgb");
        }
    }

    #[test]
    fn greyscale_is_none_whatever_the_desktop_says() {
        for desktop in [
            None,
            Some("none"),
            Some("rgb"),
            Some("vbgr"),
            Some("unknown"),
        ] {
            assert_eq!(chosen_rgba(Antialiasing::Greyscale, desktop), "none");
        }
    }
}
