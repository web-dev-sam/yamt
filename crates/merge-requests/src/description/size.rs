use dom_query::NodeRef;
use serde::Serialize;
use specta::Type;

/// GitLab's `\d{1,4}`: at most four digits.
const MAX_DIGITS: usize = 4;

/// GitLab's `width`/`height` on an image, each only in GitLab's form `\A\d{1,4}(%|px)?\z` (Banzai
/// `AttributesFilter::VALID_SIZE_REGEX`); a value outside it is as if not written (request A3).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ImageSize {
    /// A width alone.
    Width {
        /// The width.
        width: ImageLength,
    },
    /// A height alone.
    Height {
        /// The height.
        height: ImageLength,
    },
    /// A width and a height.
    Both {
        /// The width.
        width: ImageLength,
        /// The height.
        height: ImageLength,
    },
}

/// One length: a bare number is pixels, as on GitLab.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ImageLength {
    /// `12` or `12px`.
    Pixels {
        /// 0 to 9999.
        value: u16,
    },
    /// `40%`.
    Percent {
        /// 0 to 9999, as written.
        value: u16,
    },
}

/// Pure: GitLab's form only; leading/trailing whitespace, a sign, a fraction, five digits, `em`, `PX` → None.
pub(crate) fn image_length(written: &str) -> Option<ImageLength> {
    let (digits, is_percent) = match written.strip_suffix('%') {
        Some(digits) => (digits, true),
        None => (written.strip_suffix("px").unwrap_or(written), false),
    };
    let is_gitlabs = digits.len() <= MAX_DIGITS && digits.bytes().all(|byte| byte.is_ascii_digit());
    let value = digits.parse().ok().filter(|_| is_gitlabs)?;
    if is_percent {
        Some(ImageLength::Percent { value })
    } else {
        Some(ImageLength::Pixels { value })
    }
}

/// The `<img>`'s `width` and `height` read with `image_length`; None when neither is in GitLab's form.
pub(super) fn image_size(image: &NodeRef) -> Option<ImageSize> {
    let length = |name: &str| image.attr(name).and_then(|written| image_length(&written));
    match (length("width"), length("height")) {
        (Some(width), Some(height)) => Some(ImageSize::Both { width, height }),
        (Some(width), None) => Some(ImageSize::Width { width }),
        (None, Some(height)) => Some(ImageSize::Height { height }),
        (None, None) => None,
    }
}
