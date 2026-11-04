use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_gitio::Glab;

use crate::description::{Described, described_on};
use crate::project::Project;
use crate::query::{markdown_args, markdown_body};
use crate::{Description, GitLabRepository, MergeRequestIid, OfferedUpload, WebPage};

const NOT_A_PREVIEW: &str = "GitLab's preview is not JSON with html";

/// How previewing a text as GitLab renders it ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MarkdownPreviewReply {
    /// GitLab's rendering of the text as yamt shows it; no blocks for a blank text.
    Read {
        /// The rendering.
        preview: Description,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab's or GitLab's words, or `page.rs` `NO_PROJECT`.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// Not IPC: what the shell offers before it replies.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadPreview {
    /// The reply the window gets.
    pub reply: MarkdownPreviewReply,
    /// The pages its links lead to, once each, in document order.
    pub pages: Vec<WebPage>,
    /// The uploads its images name, once each, in document order.
    pub uploads: Vec<OfferedUpload>,
}

/// GitLab's answer of `POST /markdown` (docs.gitlab.com/api/markdown).
#[derive(Deserialize)]
struct Rendered {
    html: String,
}

/// A blank text → `Read` with no blocks and no glab run. Else glab missing → `GlabMissing`; the remembered project;
/// one `Glab::post(root, markdown_args, markdown_body)`; `Err` → its words through `refusal`; the answer's `html` (a
/// string) through `described_on(project, iid, html)`, else Failed "GitLab's preview is not JSON with html". Never a
/// write: no `--include`, nothing counted (RK54). One `tracing::info!`: iid, outcome, blocks, pages, uploads.
#[must_use]
pub fn preview_markdown(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    text: &str,
) -> ReadPreview {
    let read = match rendered(repository, glab, iid, text) {
        Ok(Some(described)) => ReadPreview {
            reply: MarkdownPreviewReply::Read {
                preview: described.description,
            },
            pages: described.pages,
            uploads: described.uploads,
        },
        Ok(None) => ReadPreview {
            reply: MarkdownPreviewReply::Read {
                preview: Description { blocks: Vec::new() },
            },
            pages: Vec::new(),
            uploads: Vec::new(),
        },
        Err(reply) => ReadPreview {
            reply,
            pages: Vec::new(),
            uploads: Vec::new(),
        },
    };
    log_read(iid, &read);
    read
}

/// GitLab's rendering of `text` walked on the merge request's page; `None` for a blank text, asked of no one.
fn rendered(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    text: &str,
) -> Result<Option<Described>, MarkdownPreviewReply> {
    if text.trim().is_empty() {
        return Ok(None);
    }
    let Some(glab) = glab else {
        return Err(MarkdownPreviewReply::GlabMissing);
    };
    let root = repository.root();
    let project = repository.logged_in_project(glab)?;
    let args = markdown_args();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let body = markdown_body(text, &project.full_path);
    let json = glab
        .post(root, &args, body)
        .map_err(|message| repository.refusal(glab, message))?;
    let described = preview_of(&json, &project, iid);
    described
        .map(Some)
        .ok_or_else(|| MarkdownPreviewReply::Failed {
            message: NOT_A_PREVIEW.to_owned(),
        })
}

/// The answer's `html` walked on merge request `iid`'s page; `None` when the answer is not JSON with a string `html`.
fn preview_of(json: &[u8], project: &Project, iid: MergeRequestIid) -> Option<Described> {
    let rendered: Rendered = serde_json::from_slice(json).ok()?;
    Some(described_on(project, iid, &rendered.html))
}

/// Counts only: never the text or an address.
fn log_read(iid: MergeRequestIid, read: &ReadPreview) {
    let (outcome, blocks) = match &read.reply {
        MarkdownPreviewReply::Read { preview } => ("read", preview.blocks.len()),
        MarkdownPreviewReply::GlabMissing => ("glabMissing", 0),
        MarkdownPreviewReply::NotLoggedIn { .. } => ("notLoggedIn", 0),
        MarkdownPreviewReply::Failed { .. } => ("failed", 0),
    };
    tracing::info!(
        iid = iid.0,
        outcome,
        blocks,
        pages = read.pages.len(),
        uploads = read.uploads.len(),
        "previewed a text as GitLab renders it"
    );
}

#[cfg(test)]
mod tests {
    use yamt_conflict_repo::{TempDir, git_ok};

    use super::*;
    use crate::discussions::sample::project;
    use crate::{DescriptionBlock, DescriptionInline, DescriptionLink, gitlab_repository};

    #[test]
    fn a_blank_preview_runs_no_glab() {
        let repo = TempDir::new().unwrap();
        git_ok(repo.path(), &["init", "-q"]).unwrap();
        let remote = "https://gitlab.example/taskboard/taskboard.git";
        git_ok(repo.path(), &["remote", "add", "origin", remote]).unwrap();
        let repository = gitlab_repository(repo.path()).unwrap();
        let glab = Glab::at(repo.path().join("no-such-glab"));
        let iid = MergeRequestIid(90);

        for blank in ["", " \n\t "] {
            let read = preview_markdown(&repository, Some(&glab), iid, blank);

            let empty = MarkdownPreviewReply::Read {
                preview: Description { blocks: Vec::new() },
            };
            assert_eq!(read.reply, empty);
            assert_eq!((read.pages, read.uploads), (Vec::new(), Vec::new()));
        }
        let tried = preview_markdown(&repository, Some(&glab), iid, "x").reply;
        assert!(
            matches!(tried, MarkdownPreviewReply::Failed { .. }),
            "{tried:?}"
        );
        let missing = preview_markdown(&repository, None, iid, "x").reply;
        assert_eq!(missing, MarkdownPreviewReply::GlabMissing);
    }

    #[test]
    fn a_previews_html_is_described_on_the_merge_requests_page() {
        let json = br##"{"html":"<p><strong>x</strong> <a href=\"#note_3\">here</a><script>alert(1)</script></p>"}"##;

        let described = preview_of(json, &project(), MergeRequestIid(90)).unwrap();

        let here = "https://gitlab.example/taskboard/taskboard/-/merge_requests/90#note_3";
        let pages: Vec<&str> = described.pages.iter().map(WebPage::as_str).collect();
        assert_eq!(pages, [here]);
        let DescriptionBlock::Paragraph { inlines } = &described.description.blocks[0] else {
            panic!("not a paragraph: {:?}", described.description);
        };
        let Some(DescriptionInline::Link { link, .. }) = inlines.get(2) else {
            panic!("no link third: {inlines:?}");
        };
        assert!(matches!(link, DescriptionLink::Page { page } if page.as_str() == here));
        let sent = serde_json::to_string(&described.description).unwrap();
        assert!(!sent.contains("alert"), "{sent}");
        assert!(preview_of(br#"{"html":null}"#, &project(), MergeRequestIid(90)).is_none());
        assert!(preview_of(b"<p>x</p>", &project(), MergeRequestIid(90)).is_none());
    }
}
