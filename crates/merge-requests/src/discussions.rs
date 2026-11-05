use serde::Serialize;
use specta::Type;
use yamt_gitio::Glab;

use crate::list::one_per_username;
use crate::page::Complexity;
use crate::people::People;
use crate::project::Project;
use crate::query::discussions_args;
use crate::{
    Description, GitLabRepository, MergeRequestIid, OfferedPicture, OfferedUpload, Person, WebPage,
};

use answer::parsed_batch;
pub(crate) use answer::{DiscussionNode, NoteNode};
pub use id::DiscussionId;
pub use mentions::Mention;
pub(crate) use offers::Offers;
use pages::{every_discussion, not_sent};
pub(crate) use pages::{later_page, merge_request_page};
use turn::open_notes;
pub(crate) use turn::{note_page, open_discussion, person_notes};

mod answer;
mod id;
mod mentions;
mod offers;
mod pages;
mod turn;

#[cfg(test)]
pub(crate) mod sample;

/// Merge requests read in one glab call. Logged in on gitlab-org/gitlab (glab 1.126.0, 2026-11-04), the 20 open
/// merge requests with the most comments of the 100 last updated took 31.7 s and GitLab answered "Timeout on
/// MergeRequest.iid"; their first 10 took 23.5 s (score 64 of 250, 2.7 MB), their second 10 12.2 s. Over 10 s for
/// 20, so 10 (`docs/slices/briefs/mr-threads-crate.md` step 1).
pub const DISCUSSION_BATCH: usize = 10;
/// GitLab's largest page of a connection without a page size of its own (`default_max_page_size`).
pub(crate) const DISCUSSIONS_PER_PAGE: u32 = 100;
/// The most notes read per discussion: `Discussion.notes`' `max_page_size` (facts §5).
pub(crate) const NOTES_READ: u32 = 200;

/// One merge request's open discussions, or why they were not read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RowDiscussions {
    /// The merge request.
    pub iid: MergeRequestIid,
    /// Its open discussions, or why there are none to show.
    pub answer: DiscussionsAnswer,
}

/// How asking for a merge request's open discussions ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionsAnswer {
    /// Its resolvable, unresolved discussions, in GitLab's order.
    Open {
        /// The discussions.
        discussions: Vec<OpenDiscussion>,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab failed, timed out or answered something unexpected, in glab's or yamt's words.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// A discussion and what the turn rule needs of it: every note written by a person (system notes skipped).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpenDiscussion {
    /// Its id.
    pub id: DiscussionId,
    /// Where it is: the first person note's `position` (GitLab's place of the discussion).
    pub place: DiscussionPlace,
    /// The first person note (`earlier[0]`, else `last`): its time and its rendering.
    pub first: FirstComment,
    /// Every person note before `last`, oldest first: `earlier[0]` (or `last` when empty) started the discussion.
    pub earlier: Vec<TurnComment>,
    /// Its last person note.
    pub last: DiscussionNote,
}

/// The note that started a discussion, as the person view shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FirstComment {
    /// When it was written: GitLab's ISO 8601 time, as sent.
    pub created_at: String,
    /// Its `bodyHtml` reduced by `described_on` on the merge request's page (RK60, RK66: no other path).
    pub body: Description,
}

/// A person note before the last, as the turn rule reads it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TurnComment {
    /// Who wrote it; `None` for a deleted user.
    pub author: Option<Person>,
    /// The users it mentions.
    pub mentions: Vec<Mention>,
}

/// Where a discussion is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionPlace {
    /// On the merge request itself: the first person's note has no `position`.
    Overview,
    /// On the diff: `filePath`, and `newLine`, else `oldLine` (both may be null).
    File {
        /// The file's path.
        path: String,
        /// The line, on the new side when it has one.
        line: Option<u32>,
    },
}

/// A note as the window shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionNote {
    /// Who wrote it; `None` for a deleted user.
    pub author: Option<Person>,
    /// When it was written: GitLab's ISO 8601 time, as sent.
    pub created_at: String,
    /// Its raw body.
    pub text: String,
    /// Its page on GitLab; `None` when GitLab's `url` is not the one it builds for this note.
    pub page: Option<WebPage>,
    /// The users it mentions.
    pub mentions: Vec<Mention>,
}

/// What the shell gets: the rows answered, the uploaded pictures of their authors (one per username), and the pages
/// and uploads it offers beside them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadDiscussions {
    /// One per merge request answered, in the asked order.
    pub rows: Vec<RowDiscussions>,
    /// The uploaded pictures of the notes' authors, one per username.
    pub pictures: Vec<OfferedPicture>,
    /// Every answered last note's page, then every page its first comment links, once each, in order.
    pub pages: Vec<WebPage>,
    /// Every upload the first comments name, once each.
    pub uploads: Vec<OfferedUpload>,
}

/// Asks GitLab for the discussions of `iids` (all of them, or one merge request's after a cursor).
pub(crate) type Fetch<'a> =
    dyn FnMut(&[MergeRequestIid], Option<&str>) -> Result<Vec<u8>, String> + 'a;

/// One call's read (rows, pictures, pages, uploads) and what its log line counts besides it.
struct Answered {
    read: ReadDiscussions,
    /// The discussions queries run: the batch's and each later page's.
    queries: u32,
    /// GitLab's score of the batch's query; `None` when it sent none.
    complexity: Option<Complexity>,
}

/// Answers the first `DISCUSSION_BATCH` distinct iids of `iids`, in their order, each once; nothing only for an empty
/// `iids` (then no glab run). The batch is one glab call; a merge request with more discussions than one page asks
/// for its later pages alone. A failure of the login, the project or the batch's call answers each row with it; a
/// failure of one merge request's discussions answers that row alone.
#[must_use]
pub fn read_discussions(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iids: &[MergeRequestIid],
) -> ReadDiscussions {
    let asked = batch(iids);
    let call = if asked.is_empty() {
        Answered {
            read: ReadDiscussions {
                rows: Vec::new(),
                pictures: Vec::new(),
                pages: Vec::new(),
                uploads: Vec::new(),
            },
            queries: 0,
            complexity: None,
        }
    } else {
        through_glab(repository, glab, &asked)
    };
    log_read(&call);
    call.read
}

/// The same batch cut, each `Failed { message }`: for a window without a GitLab project, and for a failed call.
#[must_use]
pub fn unread_discussions(iids: &[MergeRequestIid], message: &str) -> Vec<RowDiscussions> {
    let failed = DiscussionsAnswer::Failed {
        message: message.to_owned(),
    };
    unanswered(&batch(iids), &failed).read.rows
}

/// The first `DISCUSSION_BATCH` distinct iids, in their order.
fn batch(iids: &[MergeRequestIid]) -> Vec<MergeRequestIid> {
    let mut batch = Vec::new();
    for &iid in iids {
        if batch.len() == DISCUSSION_BATCH {
            break;
        }
        if !batch.contains(&iid) {
            batch.push(iid);
        }
    }
    batch
}

/// Each of `asked` answered `answer`, without a query.
fn unanswered(asked: &[MergeRequestIid], answer: &DiscussionsAnswer) -> Answered {
    let row = |&iid| RowDiscussions {
        iid,
        answer: answer.clone(),
    };
    let read = ReadDiscussions {
        rows: asked.iter().map(row).collect(),
        pictures: Vec::new(),
        pages: Vec::new(),
        uploads: Vec::new(),
    };
    Answered {
        read,
        queries: 0,
        complexity: None,
    }
}

fn through_glab(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    asked: &[MergeRequestIid],
) -> Answered {
    let Some(glab) = glab else {
        return unanswered(asked, &DiscussionsAnswer::GlabMissing);
    };
    let project = match repository.logged_in_project(glab) {
        Ok(project) => project,
        Err(refused) => return unanswered(asked, &refused.into()),
    };
    let root = repository.root();
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| {
        let args = discussions_args(&project.full_path, iids, after);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        glab.get(root, &args)
    };
    let batch_failed = |message| DiscussionsAnswer::from(repository.refusal(glab, message));
    answered(asked, &project, &mut fetch, &batch_failed)
}

/// Each asked row from the batch's answer and its later pages; a failing batch answers each row
/// `batch_failed(its words)`.
fn answered(
    asked: &[MergeRequestIid],
    project: &Project,
    fetch: &mut Fetch,
    batch_failed: &dyn Fn(String) -> DiscussionsAnswer,
) -> Answered {
    let mut queries = 0;
    let mut counted = |iids: &[MergeRequestIid], after: Option<&str>| {
        queries += 1;
        fetch(iids, after)
    };
    let first = match counted(asked, None).and_then(|json| parsed_batch(&json)) {
        Ok(first) => first,
        Err(message) => {
            return Answered {
                queries,
                ..unanswered(asked, &batch_failed(message))
            };
        }
    };
    let mut found = first.merge_requests;
    let mut people = People::new(project.web_origin.as_deref());
    let mut offers = Offers::new();
    let mut rows = Vec::new();
    for &iid in asked {
        let open = found
            .remove(&iid)
            .ok_or_else(|| not_sent(iid))
            .and_then(|node| every_discussion(iid, node.discussions, &mut counted))
            .and_then(open_notes);
        let answer = open_answer(open, iid, project, &mut people, &mut offers);
        rows.push(RowDiscussions { iid, answer });
    }
    let read = ReadDiscussions {
        rows,
        pictures: one_per_username(people.pictures),
        pages: offers.pages,
        uploads: offers.uploads,
    };
    Answered {
        read,
        queries,
        complexity: first.complexity,
    }
}

/// Row `iid`'s answer from its open discussions' notes, or why they were not read.
fn open_answer(
    open: Result<Vec<(DiscussionId, Vec<NoteNode>)>, String>,
    iid: MergeRequestIid,
    project: &Project,
    people: &mut People,
    offers: &mut Offers,
) -> DiscussionsAnswer {
    match open {
        Ok(open) => DiscussionsAnswer::Open {
            discussions: open
                .into_iter()
                .filter_map(|(id, notes)| open_discussion(id, notes, iid, project, people, offers))
                .collect(),
        },
        Err(message) => DiscussionsAnswer::Failed { message },
    }
}

/// Counts and GitLab's score only: never a name, a body or an address.
fn log_read(call: &Answered) {
    let read = &call.read;
    let open = read
        .rows
        .iter()
        .filter(|row| matches!(row.answer, DiscussionsAnswer::Open { .. }))
        .count();
    tracing::info!(
        asked = read.rows.len(),
        answered = open,
        failed = read.rows.len() - open,
        pages = read.pages.len(),
        uploads = read.uploads.len(),
        queries = call.queries,
        score = call.complexity.map(|complexity| complexity.score),
        limit = call.complexity.map(|complexity| complexity.limit),
        "read merge requests' open discussions"
    );
}

#[cfg(test)]
mod tests;
