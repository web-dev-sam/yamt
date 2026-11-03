use serde::Serialize;
use specta::Type;
use url::Url;

use super::{DescriptionImage, DescriptionLink, OfferedUpload};
use crate::job_log::ESCAPED_SLASH;
use crate::web_page::{MERGE_REQUESTS_SEGMENT, PARENT_SEGMENT, is_number, is_web_path};
use crate::{PictureAddress, WebPage};

const HTTP_SCHEME: &str = "http";
const HTTPS_SCHEME: &str = "https";
const UPLOADS_SEGMENT: &str = "/uploads/";
const PROJECT_SEGMENT: &str = "/-/project/";
const SECRET_HEX_DIGITS: usize = 32;
const UPLOAD_KEY_PREFIX: &str = "upload~";

/// `upload~<the upload's 32 hex digit secret>`; `~` is in no username, so it never names an avatar. Only
/// `description/address.rs` makes one.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Type)]
#[serde(transparent)]
pub struct UploadKey(String);

impl UploadKey {
    /// The key as the window asks the picture scheme for it.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl WebPage {
    /// An http or https `url` as `url` serialises it.
    pub(crate) fn linked(url: &Url) -> Option<WebPage> {
        let is_web = matches!(url.scheme(), HTTP_SCHEME | HTTPS_SCHEME);
        is_web.then(|| WebPage(url.as_str().to_owned()))
    }
}

/// `address` when absolute, else resolved against `base`; None when `url` cannot read it or it is relative without
/// `base`.
fn resolved(base: Option<&Url>, address: &str) -> Option<Url> {
    Url::options().base_url(base).parse(address).ok()
}

/// An http or https address, absolute or resolved against `base` → `Page`; anything else → `Refused` as written.
pub(crate) fn link_of(base: Option<&Url>, href: &str) -> DescriptionLink {
    match resolved(base, href).as_ref().and_then(WebPage::linked) {
        Some(page) => DescriptionLink::Page { page },
        None => DescriptionLink::Refused {
            address: href.to_owned(),
        },
    }
}

/// The image and, for an upload, what to offer: an https upload on `base`'s origin → `Uploaded`; any other https
/// address → `Web`; anything else, or no address → `Refused`.
pub(crate) fn image_of(base: Option<&Url>, src: &str) -> (DescriptionImage, Option<OfferedUpload>) {
    if src.trim().is_empty() {
        return (DescriptionImage::Refused, None);
    }
    let https = resolved(base, src).filter(|url| url.scheme() == HTTPS_SCHEME);
    let Some(url) = https else {
        return (DescriptionImage::Refused, None);
    };
    if let Some(upload) = base.and_then(|base| upload_of(base, &url)) {
        let key = upload.key.clone();
        return (DescriptionImage::Uploaded { key }, Some(upload));
    }
    let address = url.as_str().to_owned();
    (DescriptionImage::Web { address }, None)
}

/// An upload on `base`'s origin: the path `[<segments>]/-/project/<digits>/uploads/<secret>/<file>` or `<the
/// project's web path>/uploads/<secret>/<file>`, its query and fragment dropped.
fn upload_of(base: &Url, url: &Url) -> Option<OfferedUpload> {
    if url.origin() != base.origin() {
        return None;
    }
    let (before, upload) = url.path().rsplit_once(UPLOADS_SEGMENT)?;
    let (secret, file) = upload.split_once('/')?;
    if !is_secret(secret) || !is_upload_file(file) {
        return None;
    }
    let project = project_of(base, before)?;
    let route = format!("projects/{project}/uploads/{secret}/{file}");
    let mut web = url.clone();
    web.set_query(None);
    web.set_fragment(None);
    Some(OfferedUpload {
        key: UploadKey(format!("{UPLOAD_KEY_PREFIX}{secret}")),
        address: PictureAddress::upload(route, web.as_str().to_owned()),
    })
}

/// The project in an upload's path before `/uploads/`, as the uploads API names it: `[<segments>]/-/project/<id>` →
/// the id; the merge request's project web path (`base` before `/-/merge_requests/`) → that path, "/" as "%2F".
fn project_of(base: &Url, before: &str) -> Option<String> {
    if let Some((root, id)) = before.rsplit_once(PROJECT_SEGMENT) {
        let is_root = root.is_empty() || is_web_path(root);
        return (is_root && is_number(id)).then(|| id.to_owned());
    }
    let (project, _) = base.path().rsplit_once(MERGE_REQUESTS_SEGMENT)?;
    let path = project.strip_prefix('/')?;
    (before == project).then(|| path.replace('/', ESCAPED_SLASH))
}

fn is_secret(secret: &str) -> bool {
    let is_lower_hex = |c: char| c.is_ascii_digit() || ('a'..='f').contains(&c);
    secret.len() == SECRET_HEX_DIGITS && secret.chars().all(is_lower_hex)
}

/// One segment of `[A-Za-z0-9._~%+-]`, not `..`.
fn is_upload_file(file: &str) -> bool {
    let is_file_char =
        |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '~' | '%' | '+' | '-');
    !file.is_empty() && file != PARENT_SEGMENT && file.chars().all(is_file_char)
}
