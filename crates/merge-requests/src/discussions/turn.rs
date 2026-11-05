use crate::description::described_on;
use crate::people::People;
use crate::project::Project;
use crate::{MergeRequestIid, WebPage};

use super::answer::{DiscussionNode, NoteConnection, NoteNode, PositionNode};
use super::mentions::{Mention, mentions_in};
use super::{
    DiscussionId, DiscussionNote, DiscussionPlace, FirstComment, NOTES_READ, Offers,
    OpenDiscussion, TurnComment,
};

const ODD_ID: &str = "GitLab sent a discussion id yamt cannot read";

/// Each open discussion's id and person notes, in GitLab's order; an id yamt cannot read or a discussion over
/// `NOTES_READ` notes fails the row.
pub(super) fn open_notes(
    discussions: Vec<DiscussionNode>,
) -> Result<Vec<(DiscussionId, Vec<NoteNode>)>, String> {
    let mut open = Vec::new();
    for discussion in discussions {
        if !discussion.resolvable || discussion.resolved {
            continue;
        }
        let id = discussion.id.ok_or(ODD_ID)?;
        open.push((id, person_notes(discussion.notes)?));
    }
    Ok(open)
}

/// The notes written by a person, oldest first (RK61); `Err` when GitLab holds more than `NOTES_READ`.
pub(crate) fn person_notes(notes: NoteConnection) -> Result<Vec<NoteNode>, String> {
    if notes.page_info.has_next_page {
        return Err(format!(
            "a discussion has more than {NOTES_READ} notes; yamt reads no further"
        ));
    }
    Ok(notes
        .nodes
        .into_iter()
        .filter(|note| !note.system)
        .collect())
}

/// The turn data of discussion `id` from its person notes, oldest first; `None` when it has none. The box and the
/// thread both build it here. `offers` gains the last note's page, then the first comment's pages and uploads.
pub(crate) fn open_discussion(
    id: DiscussionId,
    notes: Vec<NoteNode>,
    iid: MergeRequestIid,
    project: &Project,
    people: &mut People,
    offers: &mut Offers,
) -> Option<OpenDiscussion> {
    let mut earlier = notes;
    let mut last = earlier.pop()?;
    let starter = earlier.first_mut().unwrap_or(&mut last);
    let place = place_of(starter.position.take());
    let first_at = starter.created_at.clone();
    let first_described = described_on(
        project,
        iid,
        starter.body_html.as_deref().unwrap_or_default(),
    );
    let turn_comment = |note: NoteNode| TurnComment {
        mentions: mentions_of(&note),
        author: note.author.map(|author| people.person(author)),
    };
    let earlier = earlier.into_iter().map(turn_comment).collect();
    let last = DiscussionNote {
        page: note_page(&last, iid, project),
        mentions: mentions_of(&last),
        author: last.author.map(|author| people.person(author)),
        created_at: last.created_at,
        text: last.body,
    };
    if let Some(page) = &last.page {
        offers.page(page.clone());
    }
    let first = FirstComment {
        created_at: first_at,
        body: offers.described(first_described),
    };
    Some(OpenDiscussion {
        id,
        place,
        first,
        earlier,
        last,
    })
}

fn place_of(position: Option<PositionNode>) -> DiscussionPlace {
    match position {
        None => DiscussionPlace::Overview,
        Some(position) => DiscussionPlace::File {
            path: position.file_path,
            line: position.new_line.or(position.old_line),
        },
    }
}

fn mentions_of(note: &NoteNode) -> Vec<Mention> {
    mentions_in(note.body_html.as_deref().unwrap_or_default())
}

/// A note's page: GitLab's `url` only when it is the one GitLab builds for this note (`WebPage::note`).
pub(crate) fn note_page(
    note: &NoteNode,
    iid: MergeRequestIid,
    project: &Project,
) -> Option<WebPage> {
    let origin = project.web_origin.as_deref()?;
    WebPage::note(origin, &project.web_path, iid, note.url.as_deref()?)
}
