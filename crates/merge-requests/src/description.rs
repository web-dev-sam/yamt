pub(crate) mod address;
mod element;
mod html;

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::Glab;

use crate::page::{NO_MERGE_REQUEST, NO_PROJECT, graphql_data};
use crate::project::{Project, logged_in_project};
use crate::query::description_args;
use crate::{GitLabRepository, MergeRequestIid, PictureAddress, WebPage};

pub use address::UploadKey;
use html::{Described, described};

/// How reading a merge request's description ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DescriptionReply {
    /// GitLab's rendering of the description as yamt shows it; no blocks for an empty one.
    Read {
        /// The description.
        description: Description,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab's or GitLab's words; `page.rs` `NO_MERGE_REQUEST` when GitLab names no such merge request.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// A merge request's description: GitLab's rendering, reduced to what yamt shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Description {
    /// Its blocks, in order.
    pub blocks: Vec<DescriptionBlock>,
}

/// A block of a description.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DescriptionBlock {
    /// A paragraph.
    Paragraph {
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// A heading.
    Heading {
        /// Its level.
        level: HeadingLevel,
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// A code block. Mermaid, math and other undrawn diagrams are code too.
    Code {
        /// GitLab's `data-canonical-lang` on the `<pre>` (else its `lang`); None when neither or empty.
        language: Option<String>,
        /// The `<pre>`'s text, one final "\n" removed.
        text: String,
    },
    /// A list.
    List {
        /// Bullets or numbers.
        numbering: ListNumbering,
        /// Its items.
        items: Vec<DescriptionItem>,
    },
    /// A block quote.
    Quote {
        /// Its content.
        blocks: Vec<DescriptionBlock>,
    },
    /// A horizontal rule.
    Rule,
    /// A table.
    Table {
        /// The rows of its head.
        head: Vec<DescriptionRow>,
        /// The rows of its body.
        body: Vec<DescriptionRow>,
    },
    /// A collapsible section.
    Details {
        /// Whether it starts open.
        open: bool,
        /// What shows while it is closed.
        summary: Vec<DescriptionInline>,
        /// What opening it shows.
        blocks: Vec<DescriptionBlock>,
    },
}

/// A heading's level, `<h1>` to `<h6>`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum HeadingLevel {
    /// `<h1>`.
    H1,
    /// `<h2>`.
    H2,
    /// `<h3>`.
    H3,
    /// `<h4>`.
    H4,
    /// `<h5>`.
    H5,
    /// `<h6>`.
    H6,
}

/// How a list numbers its items.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ListNumbering {
    /// `<ul>`.
    Bullets,
    /// `<ol>`.
    Numbers {
        /// The first item's number: `<ol start>`, else 1.
        start: u32,
    },
}

/// An item of a list.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionItem {
    /// Its task box.
    pub task: TaskBox,
    /// Its content.
    pub blocks: Vec<DescriptionBlock>,
}

/// GitLab's task box: `input.task-list-item-checkbox` first in the item; `data-inapplicable` → Inapplicable,
/// `checked` → Done, else Open; no such input → None.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TaskBox {
    /// No task box: a plain item.
    None,
    /// A task not done.
    Open,
    /// A task done.
    Done,
    /// A task GitLab marks not applicable.
    Inapplicable,
}

/// A row of a table.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionRow {
    /// Its cells.
    pub cells: Vec<DescriptionCell>,
}

/// A cell of a table: `header` for a `th`; `align` from `style="text-align: left|center|right"` exactly as GitLab
/// keeps it, else Start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionCell {
    /// Whether it is a header cell.
    pub header: bool,
    /// Its alignment.
    pub align: CellAlign,
    /// Its content.
    pub inlines: Vec<DescriptionInline>,
}

/// A table cell's alignment.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    /// Left, the default.
    Start,
    /// Centred.
    Center,
    /// Right.
    End,
}

/// A piece of a paragraph, heading, cell or summary.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DescriptionInline {
    /// Text as GitLab wrote it.
    Text {
        /// The text.
        text: String,
    },
    /// `<em>` or `<i>`.
    Emphasis {
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// `<strong>` or `<b>`.
    Strong {
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// `<del>`, `<s>` or `<strike>`.
    Strike {
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// `<code>` outside a `<pre>`, inline math too.
    Code {
        /// The code.
        text: String,
    },
    /// Never holds an Image: an image inside a link is lifted out after it; a link left with no inline is dropped.
    Link {
        /// Where it leads.
        link: DescriptionLink,
        /// Its content.
        inlines: Vec<DescriptionInline>,
    },
    /// An image.
    Image {
        /// Where it loads from.
        image: DescriptionImage,
        /// alt, else title, else the address as written (empty when there is none).
        caption: String,
    },
    /// `<br>`.
    LineBreak,
}

/// Where a link leads.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DescriptionLink {
    /// An http or https address, absolute or resolved against the merge request's GitLab page.
    Page {
        /// The page the opener may open.
        page: WebPage,
    },
    /// Any other address, or one yamt cannot read: as written, for the tooltip; opens nothing.
    Refused {
        /// The address as written.
        address: String,
    },
}

/// Where an image loads from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DescriptionImage {
    /// Uploaded to the project's GitLab: the window asks the picture scheme by `key` (offered with the reply).
    Uploaded {
        /// The upload's key.
        key: UploadKey,
    },
    /// Any other https address (`url`'s serialisation): the window loads it itself, without the login.
    Web {
        /// The address.
        address: String,
    },
    /// http, data, file, anything else or unreadable: nothing loads, the caption shows.
    Refused,
}

/// Not IPC: what the shell offers before it replies.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadDescription {
    /// The reply the window gets.
    pub reply: DescriptionReply,
    /// The pages its links lead to, once each, in document order.
    pub pages: Vec<WebPage>,
    /// The uploads its images name, once each, in document order.
    pub uploads: Vec<OfferedUpload>,
}

/// Not IPC: an upload a description named.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfferedUpload {
    /// The key the window asks by.
    pub key: UploadKey,
    /// Where it is on the project's GitLab.
    pub address: PictureAddress,
}

#[derive(Deserialize)]
struct DescriptionData {
    project: Option<DescriptionProject>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DescriptionProject {
    merge_request: Option<DescriptionNode>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DescriptionNode {
    description_html: Option<String>,
}

/// glab missing → `GlabMissing`; `logged_in_project`; `fetch_description`; then `described`. `pages` and `uploads`
/// once each, in document order; both empty unless `Read`. One `tracing::info!`: iid, outcome kind, blocks, pages,
/// uploads, web images; never text or an address.
pub fn read_description(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> ReadDescription {
    let read = read(repository, glab, iid);
    let (blocks, web_images) = read.as_ref().map_or((0, 0), |read| {
        (read.description.blocks.len(), read.web_images)
    });
    let (reply, pages, uploads) = match read {
        Ok(read) => {
            let description = read.description;
            (
                DescriptionReply::Read { description },
                read.pages,
                read.uploads,
            )
        }
        Err(reply) => (reply, Vec::new(), Vec::new()),
    };
    tracing::info!(
        iid = iid.0,
        outcome = outcome(&reply),
        blocks,
        pages = pages.len(),
        uploads = uploads.len(),
        web_images,
        "read a merge request's description"
    );
    ReadDescription {
        reply,
        pages,
        uploads,
    }
}

fn read(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> Result<Described, DescriptionReply> {
    let Some(glab) = glab else {
        return Err(DescriptionReply::GlabMissing);
    };
    let root = repository.root();
    let project = logged_in_project(glab, root)?;
    let html = fetch_description(glab, root, &project, iid)?;
    let base = project
        .web_origin
        .as_deref()
        .and_then(|origin| WebPage::merge_request(origin, &project.web_path, iid));
    Ok(described(&html, base.as_ref()))
}

/// The one request for a description (request-mr-links reuses it): one `Glab::get` of `description_args`.
pub(crate) fn fetch_description(
    glab: &Glab,
    root: &Path,
    project: &Project,
    iid: MergeRequestIid,
) -> Result<String, DescriptionReply> {
    let args = description_args(&project.full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    html_of(glab.get(root, &args))
}

/// `Err(line)` or a GraphQL error → `Failed` in those words; `project: null` → `Failed(NO_PROJECT)`; `mergeRequest:
/// null` → `Failed(NO_MERGE_REQUEST)`; `descriptionHtml: null` → "".
fn html_of(printed: Result<Vec<u8>, String>) -> Result<String, DescriptionReply> {
    let failed = |message: &str| DescriptionReply::Failed {
        message: message.to_owned(),
    };
    let data: DescriptionData = printed
        .and_then(|json| graphql_data(&json))
        .map_err(|message| failed(&message))?;
    let project = data.project.ok_or_else(|| failed(NO_PROJECT))?;
    let merge_request = project
        .merge_request
        .ok_or_else(|| failed(NO_MERGE_REQUEST))?;
    Ok(merge_request.description_html.unwrap_or_default())
}

/// The reply's kind, as the log names it: never the description's text or an address.
fn outcome(reply: &DescriptionReply) -> &'static str {
    match reply {
        DescriptionReply::Read { .. } => "read",
        DescriptionReply::GlabMissing => "glabMissing",
        DescriptionReply::NotLoggedIn { .. } => "notLoggedIn",
        DescriptionReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests;
