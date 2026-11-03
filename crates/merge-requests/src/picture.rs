use std::path::Path;

use serde::Serialize;
use specta::Type;
use yamt_gitio::Glab;

use crate::web_page::{is_number, is_path_segment, is_web_path};

const MIB: usize = 1 << 20;
/// The largest picture yamt takes from GitLab.
pub const MAX_PICTURE_BYTES: usize = MIB;
/// The largest upload a description names that yamt takes from GitLab: a screenshot is often over 1 MiB.
pub const MAX_UPLOAD_BYTES: usize = 10 << 20;
/// glab's last line for an HTTP 403 or 404 ends so (`tests/glab/README.md`): GitLab older than 17.4 has no uploads
/// API, and a project you are no member of may refuse it.
const REFUSED_ENDINGS: [&str; 2] = ["(HTTP 403)", "(HTTP 404)"];

const UPLOADED_AVATARS: &str = "/uploads/-/system/user/avatar/";
const GRAVATAR_HOSTS: [&str; 2] = ["https://secure.gravatar.com", "https://www.gravatar.com"];
const GRAVATAR_PATH: &str = "/avatar/";
const MD5_HEX_DIGITS: usize = 32;
const SHA256_HEX_DIGITS: usize = 64;
const NOT_AN_IMAGE: &str = "GitLab's picture is not a PNG, JPEG, GIF or WebP image";
const PNG_START: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const JPEG_START: &[u8] = &[0xFF, 0xD8, 0xFF];
const GIF_START: &[u8] = b"GIF8";
const RIFF_START: &[u8] = b"RIFF";
const WEBP_MARK: &[u8] = b"WEBP";
const WEBP_MARK_AT: usize = 8;

/// A Gravatar picture's address: `https://secure.gravatar.com` or `https://www.gravatar.com`, the path
/// `/avatar/<32 or 64 hex digits>`, an optional query of `[A-Za-z0-9=&%._-]`; only `avatar_source` makes one.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(transparent)]
pub struct GravatarAddress(String);

/// A picture's address on the project's GitLab (never sent to the window): an uploaded avatar, or an upload a
/// description names; only `avatar_source` and `image_of` make one.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct PictureAddress(Address);

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Address {
    Avatar(String),
    /// `route`: the uploads API's `projects/<id or path>/uploads/<secret>/<file>`; `web`: its `https` address.
    Upload {
        route: String,
        web: String,
    },
}

impl PictureAddress {
    pub(crate) fn upload(route: String, web: String) -> PictureAddress {
        PictureAddress(Address::Upload { route, web })
    }

    /// The picture's `https` address.
    #[must_use]
    pub fn as_str(&self) -> &str {
        match &self.0 {
            Address::Avatar(address) => address,
            Address::Upload { web, .. } => web,
        }
    }
}

/// Where a person's `avatarUrl` points.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum AvatarSource {
    Uploaded(PictureAddress),
    Gravatar(GravatarAddress),
    None,
}

/// A picture's format, told by its first bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ImageKind {
    /// PNG.
    Png,
    /// JPEG.
    Jpeg,
    /// GIF.
    Gif,
    /// WebP.
    Webp,
}

impl ImageKind {
    /// The format's media type.
    #[must_use]
    pub fn mime(self) -> &'static str {
        match self {
            ImageKind::Png => "image/png",
            ImageKind::Jpeg => "image/jpeg",
            ImageKind::Gif => "image/gif",
            ImageKind::Webp => "image/webp",
        }
    }

    fn of(bytes: &[u8]) -> Option<ImageKind> {
        if bytes.starts_with(PNG_START) {
            Some(ImageKind::Png)
        } else if bytes.starts_with(JPEG_START) {
            Some(ImageKind::Jpeg)
        } else if bytes.starts_with(GIF_START) {
            Some(ImageKind::Gif)
        } else if bytes.starts_with(RIFF_START)
            && bytes
                .get(WEBP_MARK_AT..)
                .is_some_and(|rest| rest.starts_with(WEBP_MARK))
        {
            Some(ImageKind::Webp)
        } else {
            None
        }
    }
}

/// A picture GitLab sent, of a format the window shows.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Picture {
    /// Its format.
    pub kind: ImageKind,
    /// Its bytes, at most `MAX_PICTURE_BYTES`, or `MAX_UPLOAD_BYTES` for an upload.
    pub bytes: Vec<u8>,
}

/// `origin` the project's `web_origin` (`None` off https). Uploaded: a path starting with `/`, or an `https` address of
/// that origin, whose path is `(/segment)*/uploads/-/system/user/avatar/<digits>/<file>` (segments and file of
/// `[A-Za-z0-9._~-]`, no `..`, an optional query of `[A-Za-z0-9=&._-]`). Gravatar: as `GravatarAddress` says.
/// Anything else (`http`, another host, a custom Gravatar URL, null) → None.
pub(crate) fn avatar_source(origin: Option<&str>, avatar_url: Option<&str>) -> AvatarSource {
    let Some(avatar_url) = avatar_url else {
        return AvatarSource::None;
    };
    if is_gravatar(avatar_url) {
        return AvatarSource::Gravatar(GravatarAddress(avatar_url.to_owned()));
    }
    let Some(origin) = origin else {
        return AvatarSource::None;
    };
    let path = avatar_url.strip_prefix(origin).unwrap_or(avatar_url);
    if is_uploaded_avatar(path) {
        AvatarSource::Uploaded(PictureAddress(Address::Avatar(format!("{origin}{path}"))))
    } else {
        AvatarSource::None
    }
}

fn is_gravatar(address: &str) -> bool {
    let Some(path) = GRAVATAR_HOSTS
        .iter()
        .find_map(|host| address.strip_prefix(host))
    else {
        return false;
    };
    let (hash, query) = split_query(path);
    let is_hash = |hash: &str| {
        matches!(hash.len(), MD5_HEX_DIGITS | SHA256_HEX_DIGITS)
            && hash.chars().all(|c| c.is_ascii_hexdigit())
    };
    let is_gravatar_query_char = |c: char| is_query_char(c) || c == '%';
    hash.strip_prefix(GRAVATAR_PATH).is_some_and(is_hash)
        && query.chars().all(is_gravatar_query_char)
}

fn is_uploaded_avatar(path: &str) -> bool {
    let (path, query) = split_query(path);
    let Some((root, avatar)) = path.split_once(UPLOADED_AVATARS) else {
        return false;
    };
    let Some((user, file)) = avatar.split_once('/') else {
        return false;
    };
    let is_root = root.is_empty() || is_web_path(root);
    let is_avatar = is_number(user) && is_path_segment(file);
    is_root && is_avatar && query.chars().all(is_query_char)
}

/// The address before `?`, and the query after it (empty without one).
fn split_query(address: &str) -> (&str, &str) {
    address.split_once('?').unwrap_or((address, ""))
}

fn is_query_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '=' | '&' | '.' | '_' | '-')
}

/// An avatar: `glab api <address>`. An upload: `glab api <its uploads API route>`, then, when that ends in HTTP 403
/// or 404, `glab api <its web address>`. In `root`, stdin closed; `Err` in glab's words, or when GitLab's answer is
/// no picture yamt shows or larger than `MAX_PICTURE_BYTES` (an avatar) or `MAX_UPLOAD_BYTES` (an upload).
pub fn fetch_picture(
    glab: &Glab,
    root: &Path,
    address: &PictureAddress,
) -> Result<Picture, String> {
    fetched(address, &mut |args| glab.get(root, args))
}

/// What `glab <args>` printed in the repository's root.
type Get<'a> = dyn FnMut(&[&str]) -> Result<Vec<u8>, String> + 'a;

fn fetched(address: &PictureAddress, get: &mut Get) -> Result<Picture, String> {
    match &address.0 {
        Address::Avatar(address) => picture_from(get(&["api", address])?, MAX_PICTURE_BYTES),
        Address::Upload { route, web } => {
            let bytes = match get(&["api", route]) {
                Err(line) if REFUSED_ENDINGS.iter().any(|end| line.ends_with(end)) => {
                    get(&["api", web])
                }
                answered => answered,
            };
            picture_from(bytes?, MAX_UPLOAD_BYTES)
        }
    }
}

fn picture_from(bytes: Vec<u8>, largest: usize) -> Result<Picture, String> {
    if bytes.len() > largest {
        return Err(format!(
            "GitLab's picture is larger than {} MiB",
            largest / MIB
        ));
    }
    let kind = ImageKind::of(&bytes).ok_or(NOT_AN_IMAGE)?;
    Ok(Picture { kind, bytes })
}

#[cfg(test)]
mod tests;
