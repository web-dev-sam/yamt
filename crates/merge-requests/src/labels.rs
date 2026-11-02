use serde::{Deserialize, Serialize};
use specta::Type;

const SHORT_HEX_DIGITS: usize = 3;
const LONG_HEX_DIGITS: usize = 6;

/// A label's colours as GitLab sends them, each `#rgb` or `#rrggbb` (checked: `#` then 3 or 6 hex digits).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelColors {
    /// The chip's colour.
    pub background: String,
    /// The colour of its title.
    pub text: String,
}

/// A label of a merge request; `colors` is `None` when either colour is missing or not `#rgb`/`#rrggbb`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Label {
    /// Its title.
    pub title: String,
    /// Its colours.
    pub colors: Option<LabelColors>,
}

/// A label as the list query asks for it.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LabelNode {
    title: String,
    color: Option<String>,
    text_color: Option<String>,
}

pub(crate) fn label(node: LabelNode) -> Label {
    let colors = node.color.zip(node.text_color);
    let colors =
        colors.filter(|(background, text)| is_hex_colour(background) && is_hex_colour(text));
    Label {
        title: node.title,
        colors: colors.map(|(background, text)| LabelColors { background, text }),
    }
}

fn is_hex_colour(text: &str) -> bool {
    text.strip_prefix('#').is_some_and(|hex| {
        matches!(hex.len(), SHORT_HEX_DIGITS | LONG_HEX_DIGITS)
            && hex.chars().all(|c| c.is_ascii_hexdigit())
    })
}
