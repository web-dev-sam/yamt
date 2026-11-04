use serde::{Deserialize, Serialize};
use specta::Type;

use crate::web_page::is_lower_hex;

/// GitLab's global id of a discussion (`Discussion.id`, measured on gitlab.com for every kind of discussion).
const GID_PREFIX: &str = "gid://gitlab/Discussion/";
const HEX_DIGITS: usize = 40;
const NOT_AN_ID: &str = "not a discussion id";

/// A discussion's id: GitLab's 40 lowercase hex digits, the REST routes' `:discussion_id` (from GraphQL
/// `gid://gitlab/Discussion/<hex>`). The window sends it back; nothing else deserializes.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
#[serde(try_from = "String", into = "String")]
pub struct DiscussionId(String);

impl DiscussionId {
    /// The prefix and 40 `[0-9a-f]` only.
    pub(crate) fn from_gid(gid: &str) -> Option<DiscussionId> {
        let hex = gid.strip_prefix(GID_PREFIX)?;
        is_id(hex).then(|| DiscussionId(hex.to_owned()))
    }

    /// The 40 hex digits.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for DiscussionId {
    type Error = String;

    fn try_from(hex: String) -> Result<DiscussionId, String> {
        if is_id(&hex) {
            Ok(DiscussionId(hex))
        } else {
            Err(NOT_AN_ID.to_owned())
        }
    }
}

impl From<DiscussionId> for String {
    fn from(id: DiscussionId) -> String {
        id.0
    }
}

fn is_id(hex: &str) -> bool {
    hex.len() == HEX_DIGITS && hex.chars().all(is_lower_hex)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::discussions::sample::hex;
    #[test]
    fn a_discussion_id_is_40_hex_or_nothing() {
        let gid = |hex: &str| format!("gid://gitlab/Discussion/{hex}");
        let id = DiscussionId::from_gid(&gid(&hex(1))).unwrap();
        assert_eq!(id.as_str(), hex(1));
        assert_eq!(serde_json::to_value(&id).unwrap(), json!(hex(1)));
        let upper = "A".repeat(40);
        let not_hex = "g".repeat(40);
        let short = &hex(1)[1..];
        let long = format!("{}0", hex(1));
        for odd in [upper.as_str(), &not_hex, short, &long, ""] {
            assert_eq!(DiscussionId::from_gid(&gid(odd)), None, "{odd}");
            let sent = serde_json::from_value::<DiscussionId>(json!(odd));
            assert!(sent.is_err(), "{odd}");
        }
        assert_eq!(DiscussionId::from_gid(&hex(1)), None);
        let note = format!("gid://gitlab/Note/{}", hex(1));
        assert_eq!(DiscussionId::from_gid(&note), None);
        let refused = DiscussionId::try_from(upper).unwrap_err();
        assert_eq!(refused, "not a discussion id");
        assert_eq!(DiscussionId::try_from(hex(1)), Ok(id.clone()));
        assert_eq!(
            serde_json::from_value::<DiscussionId>(json!(hex(1))).unwrap(),
            id
        );
    }
}
