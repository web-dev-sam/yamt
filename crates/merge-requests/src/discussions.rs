use std::path::Path;

use serde::Serialize;
use specta::Type;
use yamt_gitio::Glab;

use crate::list::one_per_username;
use crate::page::{Complexity, Connection};
use crate::people::People;
use crate::project::{Project, logged_in_project};
use crate::query::discussions_args;
use crate::{GitLabRepository, MergeRequestIid, OfferedPicture, Person, WebPage};

use answer::{DiscussionNode, NoteNode, parsed_batch};

mod answer;

/// Merge requests read in one glab call: 20 took 4.47 s on gitlab-org/gitlab, 100 took 22.22 s, past glab's 20 s
/// deadline (orchestrator, measured 2026-11-03).
pub const DISCUSSION_BATCH: usize = 20;
/// GitLab's largest page of a connection without a page size of its own (`default_max_page_size`).
pub(crate) const DISCUSSIONS_PER_PAGE: u32 = 100;
/// The last notes read per discussion: GitLab scores `notes(last: 20)` as `notes(last: 1)`.
pub(crate) const NOTES_READ: u32 = 20;
const MAX_DISCUSSION_PAGES: u32 = 10;
const TOO_MANY_DISCUSSIONS: &str = "more than 1,000 discussions";
const NO_CURSOR: &str = "GitLab says more discussions follow, but sent no cursor for them";

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

/// An open discussion: where it is and its last note written by a person (system notes skipped).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpenDiscussion {
    /// Where the discussion is.
    pub place: DiscussionPlace,
    /// Its last note written by a person.
    pub last: DiscussionNote,
}

/// Where a discussion is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionPlace {
    /// On the merge request itself: the last person's note has no `position`.
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
}

/// What the shell gets: the rows answered, and the uploaded pictures of their authors (one per username).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadDiscussions {
    /// One per merge request answered, in the asked order.
    pub rows: Vec<RowDiscussions>,
    /// The uploaded pictures of the notes' authors, one per username.
    pub pictures: Vec<OfferedPicture>,
}

/// Asks GitLab for the discussions of `iids` (all of them, or one merge request's after a cursor).
type Fetch<'a> = dyn FnMut(&[MergeRequestIid], Option<&str>) -> Result<Vec<u8>, String> + 'a;

/// One call's rows and pictures, and what its log line counts besides them.
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
            },
            queries: 0,
            complexity: None,
        }
    } else {
        through_glab(repository.root(), glab, &asked)
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
    };
    Answered {
        read,
        queries: 0,
        complexity: None,
    }
}

fn through_glab(root: &Path, glab: Option<&Glab>, asked: &[MergeRequestIid]) -> Answered {
    let Some(glab) = glab else {
        return unanswered(asked, &DiscussionsAnswer::GlabMissing);
    };
    let project = match logged_in_project(glab, root) {
        Ok(project) => project,
        Err(refused) => return unanswered(asked, &refused.into()),
    };
    let mut fetch = |iids: &[MergeRequestIid], after: Option<&str>| {
        let args = discussions_args(&project.full_path, iids, after);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        glab.get(root, &args)
    };
    answered(asked, &project, &mut fetch)
}

/// Each asked row from the batch's answer and its later pages; a failing batch fails each row.
fn answered(asked: &[MergeRequestIid], project: &Project, fetch: &mut Fetch) -> Answered {
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
                ..unanswered(asked, &DiscussionsAnswer::Failed { message })
            };
        }
    };
    let mut found = first.merge_requests;
    let mut people = People::new(project.web_origin.as_deref());
    let mut rows = Vec::new();
    for &iid in asked {
        let notes = found
            .remove(&iid)
            .ok_or_else(|| not_sent(iid))
            .and_then(|discussions| every_discussion(iid, discussions, &mut counted))
            .and_then(last_persons_notes);
        let answer = match notes {
            Ok(notes) => DiscussionsAnswer::Open {
                discussions: notes
                    .into_iter()
                    .map(|note| open_discussion(note, iid, project, &mut people))
                    .collect(),
            },
            Err(message) => DiscussionsAnswer::Failed { message },
        };
        rows.push(RowDiscussions { iid, answer });
    }
    let pictures = one_per_username(people.pictures);
    Answered {
        read: ReadDiscussions { rows, pictures },
        queries,
        complexity: first.complexity,
    }
}

fn not_sent(iid: MergeRequestIid) -> String {
    format!("GitLab sent no merge request !{}", iid.0)
}

/// `first` and each later page of merge request `iid`'s discussions, at most `MAX_DISCUSSION_PAGES` pages.
fn every_discussion(
    iid: MergeRequestIid,
    first: Connection<DiscussionNode>,
    fetch: &mut Fetch,
) -> Result<Vec<DiscussionNode>, String> {
    let mut discussions = first.nodes;
    let mut page_info = first.page_info;
    let mut pages = 1;
    while page_info.has_next_page {
        if pages == MAX_DISCUSSION_PAGES {
            return Err(TOO_MANY_DISCUSSIONS.to_owned());
        }
        let cursor = page_info.end_cursor.ok_or(NO_CURSOR)?;
        let mut later = fetch(&[iid], Some(&cursor)).and_then(|json| parsed_batch(&json))?;
        let page = later
            .merge_requests
            .remove(&iid)
            .ok_or_else(|| not_sent(iid))?;
        discussions.extend(page.nodes);
        page_info = page.page_info;
        pages += 1;
    }
    Ok(discussions)
}

/// The last note written by a person of each open discussion, in GitLab's order; a discussion whose notes read are
/// all GitLab's own fails when earlier notes exist, and is left out when none do (GitLab never makes it resolvable).
fn last_persons_notes(discussions: Vec<DiscussionNode>) -> Result<Vec<NoteNode>, String> {
    let mut notes = Vec::new();
    for discussion in discussions {
        if !discussion.resolvable || discussion.resolved {
            continue;
        }
        let earlier = discussion.notes.page_info.has_previous_page;
        let mut read = discussion.notes.nodes.into_iter().rev();
        match read.find(|note| !note.system) {
            Some(note) => notes.push(note),
            None if earlier => {
                return Err(format!(
                    "a discussion's last {NOTES_READ} notes are all GitLab's own; yamt reads no further"
                ));
            }
            None => {}
        }
    }
    Ok(notes)
}

fn open_discussion(
    note: NoteNode,
    iid: MergeRequestIid,
    project: &Project,
    people: &mut People,
) -> OpenDiscussion {
    let place = match note.position {
        None => DiscussionPlace::Overview,
        Some(position) => DiscussionPlace::File {
            path: position.file_path,
            line: position.new_line.or(position.old_line),
        },
    };
    let address = project.web_origin.as_deref().zip(note.url.as_deref());
    let page = address.and_then(|(origin, url)| WebPage::note(origin, &project.web_path, iid, url));
    let last = DiscussionNote {
        author: note.author.map(|author| people.person(author)),
        created_at: note.created_at,
        text: note.body,
        page,
    };
    OpenDiscussion { place, last }
}

/// Counts and GitLab's score only: never a name, a body or an address.
fn log_read(call: &Answered) {
    let rows = &call.read.rows;
    let open = rows
        .iter()
        .filter(|row| matches!(row.answer, DiscussionsAnswer::Open { .. }))
        .count();
    tracing::info!(
        asked = rows.len(),
        answered = open,
        failed = rows.len() - open,
        queries = call.queries,
        score = call.complexity.map(|complexity| complexity.score),
        limit = call.complexity.map(|complexity| complexity.limit),
        "read merge requests' open discussions"
    );
}

#[cfg(test)]
mod tests;
