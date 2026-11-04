use yamt_gitio::Glab;

use crate::description::described_on;
use crate::discussions::{
    DiscussionNode, Fetch, NoteNode, later_page, merge_request_page, note_page, open_discussion,
    person_notes,
};
use crate::list::one_per_username;
use crate::people::People;
use crate::project::Project;
use crate::query::{discussions_args, draft_notes_args};
use crate::{
    DiscussionId, GitLabRepository, MergeRequestIid, OfferedPicture, OfferedUpload, WebPage,
};

use super::drafts::drafts_in;
use super::{
    Commenting, DiscussionComment, DiscussionThread, DiscussionThreadReply, NoteEdit, ReadThread,
};

/// Asks GitLab for the viewer's draft notes on the merge request.
pub(super) type FetchDrafts<'a> = dyn FnMut() -> Result<Vec<u8>, String> + 'a;

/// A thread read, and what the shell offers beside it.
pub(super) struct Read {
    thread: DiscussionThread,
    pages: Vec<WebPage>,
    uploads: Vec<OfferedUpload>,
    pictures: Vec<OfferedPicture>,
}

/// A thread's comments, and the pages and uploads they name, once each, in order.
struct Commented {
    comments: Vec<DiscussionComment>,
    pages: Vec<WebPage>,
    uploads: Vec<OfferedUpload>,
}

/// glab missing → `GlabMissing`; the remembered project; the discussions query for `[iid]`, then its later pages
/// until one holds the discussion with `id` (the same pages as `read_discussions`, the `Fetch` seam); then one
/// `Glab::get` of `draft_notes_args` (`--paginate`: one JSON array or one per page). A draft counts for `drafts` when
/// its `discussion_id` is `id`'s hex; every draft counts for `pending`. The batch failing, the merge request missing,
/// the 200-note rule or the draft list failing → `Failed`, its words through `logged_out_after`.
/// `pages`/`uploads`/`pictures` empty unless `Read`. One `tracing::info!`: iid, outcome, comments, drafts, pending,
/// pages, uploads, queries; never a name, text or address.
#[must_use]
pub fn read_discussion_thread(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
) -> ReadThread {
    let mut queries = 0;
    let read = offered(through_glab(
        repository,
        glab,
        iid,
        discussion,
        &mut queries,
    ));
    log_read(iid, &read, queries);
    read
}

/// The reply, and beside a thread read what the shell offers.
pub(super) fn offered(read: Result<Read, DiscussionThreadReply>) -> ReadThread {
    match read {
        Ok(read) => ReadThread {
            reply: DiscussionThreadReply::Read {
                thread: read.thread,
            },
            pages: read.pages,
            uploads: read.uploads,
            pictures: read.pictures,
        },
        Err(reply) => ReadThread {
            reply,
            pages: Vec::new(),
            uploads: Vec::new(),
            pictures: Vec::new(),
        },
    }
}

#[expect(
    clippy::result_large_err,
    reason = "the reply is returned at once, never stored"
)]
fn through_glab(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    discussion: &DiscussionId,
    queries: &mut u32,
) -> Result<Read, DiscussionThreadReply> {
    let Some(glab) = glab else {
        return Err(DiscussionThreadReply::GlabMissing);
    };
    let project = repository.logged_in_project(glab)?;
    let root = repository.root();
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| {
        *queries += 1;
        let args = discussions_args(&project.full_path, iids, after);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        glab.get(root, &args)
    };
    let mut fetch_drafts = || {
        let args = draft_notes_args(&project.full_path, iid);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        glab.get(root, &args)
    };
    let read = thread_from(iid, discussion, &project, &mut fetch, &mut fetch_drafts);
    if let Err(DiscussionThreadReply::Failed { message }) = &read
        && let Some(detail) = repository.logged_out_after(glab, message)
    {
        return Err(DiscussionThreadReply::NotLoggedIn { detail });
    }
    read
}

/// The thread of `discussion` from the discussions query for `[iid]` and its later pages, then the viewer's drafts.
#[expect(
    clippy::result_large_err,
    reason = "the reply is returned at once, never stored"
)]
pub(super) fn thread_from(
    iid: MergeRequestIid,
    discussion: &DiscussionId,
    project: &Project,
    fetch: &mut Fetch,
    fetch_drafts: &mut FetchDrafts,
) -> Result<Read, DiscussionThreadReply> {
    let (commenting, found) = found_discussion(iid, discussion, fetch)?;
    let may_resolve = found.resolvable && found.user_permissions.resolve_note;
    let notes = person_notes(found.notes).map_err(failed)?;
    let mut people = People::new(project.web_origin.as_deref());
    let commented = comments_of(&notes, iid, project, &mut people);
    let opened = open_discussion(discussion.clone(), notes, iid, project, &mut people)
        .ok_or(DiscussionThreadReply::NotFound)?;
    let listed = fetch_drafts()
        .and_then(|json| drafts_in(&json, discussion))
        .map_err(failed)?;
    let thread = DiscussionThread {
        discussion: opened,
        resolved: found.resolved,
        comments: commented.comments,
        drafts: listed.drafts,
        pending: listed.pending,
        commenting,
        may_resolve,
    };
    Ok(Read {
        thread,
        pages: commented.pages,
        uploads: commented.uploads,
        pictures: one_per_username(people.pictures),
    })
}

/// Whether the viewer may comment on merge request `iid`, and its discussion `discussion`: pages are read until one
/// holds it (`NotFound` when GitLab answered the merge request without it).
#[expect(
    clippy::result_large_err,
    reason = "the reply is returned at once, never stored"
)]
fn found_discussion(
    iid: MergeRequestIid,
    discussion: &DiscussionId,
    fetch: &mut Fetch,
) -> Result<(Commenting, DiscussionNode), DiscussionThreadReply> {
    let node = merge_request_page(iid, None, fetch).map_err(failed)?;
    let commenting = commenting(node.user_permissions.create_note, node.discussion_locked);
    let is_asked = |found: &DiscussionNode| found.id.as_ref() == Some(discussion);
    let mut page = Some(node.discussions);
    let mut pages = 0;
    while let Some(read) = page {
        pages += 1;
        if let Some(found) = read.nodes.into_iter().find(is_asked) {
            return Ok((commenting, found));
        }
        page = later_page(iid, read.page_info, pages, fetch).map_err(failed)?;
    }
    Err(DiscussionThreadReply::NotFound)
}

fn failed(message: String) -> DiscussionThreadReply {
    DiscussionThreadReply::Failed { message }
}

fn commenting(create_note: bool, discussion_locked: bool) -> Commenting {
    match (create_note, discussion_locked) {
        (true, _) => Commenting::Allowed,
        (false, true) => Commenting::Locked,
        (false, false) => Commenting::NotAllowed,
    }
}

/// Each note as a comment, its body through `described_on` (RK60); every page (the note's own, then its links') and
/// every upload once.
fn comments_of(
    notes: &[NoteNode],
    iid: MergeRequestIid,
    project: &Project,
    people: &mut People,
) -> Commented {
    let mut commented = Commented {
        comments: Vec::new(),
        pages: Vec::new(),
        uploads: Vec::new(),
    };
    for note in notes {
        let page = note_page(note, iid, project);
        let described = described_on(project, iid, note.body_html.as_deref().unwrap_or_default());
        for offered in page.iter().cloned().chain(described.pages) {
            if !commented.pages.contains(&offered) {
                commented.pages.push(offered);
            }
        }
        for upload in described.uploads {
            if !commented
                .uploads
                .iter()
                .any(|offered| offered.key == upload.key)
            {
                commented.uploads.push(upload);
            }
        }
        commented.comments.push(DiscussionComment {
            author: note.author.clone().map(|author| people.person(author)),
            created_at: note.created_at.clone(),
            edited: edit_of(note, people),
            body: described.description,
            page,
        });
    }
    commented
}

/// GitLab's `Note#edited?`: an editor named and `lastEditedAt` after `createdAt` (design §1.3).
fn edit_of(note: &NoteNode, people: &mut People) -> Option<NoteEdit> {
    let by = note.last_edited_by.clone()?;
    let at = note.last_edited_at.clone()?;
    // GitLab's `Time` is ISO 8601 in UTC to the second (measured on gitlab.com, design §1.3), so later sorts after.
    (at > note.created_at).then(|| NoteEdit {
        at,
        by: people.person(by),
    })
}

/// Counts only: never a name, a text or an address.
fn log_read(iid: MergeRequestIid, read: &ReadThread, queries: u32) {
    let (comments, drafts, pending) = match &read.reply {
        DiscussionThreadReply::Read { thread } => {
            (thread.comments.len(), thread.drafts.len(), thread.pending)
        }
        DiscussionThreadReply::NotFound
        | DiscussionThreadReply::GlabMissing
        | DiscussionThreadReply::NotLoggedIn { .. }
        | DiscussionThreadReply::Failed { .. } => (0, 0, 0),
    };
    tracing::info!(
        iid = iid.0,
        outcome = outcome(&read.reply),
        comments,
        drafts,
        pending,
        pages = read.pages.len(),
        uploads = read.uploads.len(),
        queries,
        "read a discussion's thread"
    );
}

pub(super) fn outcome(reply: &DiscussionThreadReply) -> &'static str {
    match reply {
        DiscussionThreadReply::Read { .. } => "read",
        DiscussionThreadReply::NotFound => "notFound",
        DiscussionThreadReply::GlabMissing => "glabMissing",
        DiscussionThreadReply::NotLoggedIn { .. } => "notLoggedIn",
        DiscussionThreadReply::Failed { .. } => "failed",
    }
}
