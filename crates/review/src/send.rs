use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};

use yamt_gitio::{AuthStatus, Glab, Repo};
use yamt_range::{Compared, Range, RangeEntry, RangeFile};

use crate::gitlab::drafts::{DraftNote, draft_notes_from};
use crate::gitlab::line_range::MultiLine;
use crate::gitlab::{
    draft_notes, listed_from, merge_request_details, merge_request_from,
    merge_requests_from_branch, merge_requests_of_commit, post_draft_note,
};
use crate::glab_answer::{Outcome, answer, posted, run};
use crate::lines_up::{Found, LinedUp, candidates, lines_up};
use crate::position::{FileDiff, PostBody, line_place, multi_line, same_draft};
use crate::right_branch::right_branch;
use crate::thread_store::waiting::QueuedMessage;
use crate::{
    Error, GitLabCheck, LookedAt, NotLinedUp, Posting, Result, SendProgress, SendReply, ThreadList,
    ThreadPlace, ThreadStore,
};

const DIFFS_PAGE: &str = "/diffs";
const NO_LINES: &str = "the file has no lines";

/// Whether GitLab's diff of the merge request for the range's right side is exactly the window's (plan §2 #119).
#[must_use]
pub fn check_gitlab(range: &Range, glab: Option<&Glab>) -> GitLabCheck {
    let checked = match glab {
        None => Err(NotLinedUp::GlabMissing),
        Some(glab) => lined_up(glab, range),
    };
    match checked {
        Ok(lined_up) => GitLabCheck::LinedUp {
            merge_request: lined_up.merge_request.named,
        },
        Err(why) => GitLabCheck::NotLinedUp { why },
    }
}

/// Checks again, then posts every queued message as a draft note, one at a time in thread order, recording
/// each result in `threads` (locked only between glab calls) and reporting progress after each (plan §2 #118).
pub fn send_queue(
    range: &Range,
    glab: Option<&Glab>,
    threads: &Mutex<ThreadStore>,
    progress: &dyn Fn(SendProgress),
) -> Result<SendReply> {
    let Some(glab) = glab else {
        let why = NotLinedUp::GlabMissing;
        return Ok(SendReply::NotLinedUp { why });
    };
    match lined_up(glab, range) {
        Ok(target) => post_queue(glab, range, &target, threads, progress),
        Err(why) => Ok(SendReply::NotLinedUp { why }),
    }
}

struct Tally {
    done: u32,
    of: u32,
    sent: u32,
    refused: u32,
}

fn post_queue(
    glab: &Glab,
    range: &Range,
    target: &LinedUp,
    threads: &Mutex<ThreadStore>,
    progress: &dyn Fn(SendProgress),
) -> Result<SendReply> {
    let (queued, owned) = {
        let store = locked(threads);
        (store.queued(range), store.pending_draft_notes())
    };
    let mut tally = Tally {
        done: 0,
        of: u32::try_from(queued.len()).unwrap_or(u32::MAX),
        sent: 0,
        refused: 0,
    };
    let listed = answer(glab, range.root(), &draft_notes(&target.merge_request))
        .and_then(|json| draft_notes_from(&json));
    let mut drafts = match listed {
        Ok(drafts) => unowned(drafts, &owned),
        Err(reason) => return Ok(tally.stopped(locked(threads).list(range), reason)),
    };
    for message in queued {
        let stop = send_one(
            glab,
            range,
            target,
            threads,
            &mut drafts,
            &message,
            &mut tally,
        )?;
        if let Some(reason) = stop {
            return Ok(tally.stopped(locked(threads).list(range), reason));
        }
        tally.done += 1;
        progress(SendProgress {
            done: tally.done,
            of: tally.of,
        });
    }
    Ok(tally.sent(locked(threads).list(range)))
}

/// Posts the message's text as it is now, unless it no longer waits, and records the result only if the message
/// still waits with that text: the user may unqueue or edit it while the send runs. `Some` is why the send stops.
fn send_one(
    glab: &Glab,
    range: &Range,
    target: &LinedUp,
    threads: &Mutex<ThreadStore>,
    drafts: &mut Vec<DraftNote>,
    message: &QueuedMessage,
    tally: &mut Tally,
) -> Result<Option<String>> {
    let Some(text) = locked(threads).waiting_text(message.message) else {
        return Ok(None);
    };
    let (posting, count) = match outcome(glab, range, target, drafts, message, &text)? {
        Outcome::Drafted(draft_note) => (pending(target, &text, draft_note), &mut tally.sent),
        Outcome::Refused(reason) => {
            let refused = Posting::Refused {
                text: text.clone(),
                reason,
            };
            (refused, &mut tally.refused)
        }
        Outcome::Stop(reason) => return Ok(Some(reason)),
    };
    let recorded = locked(threads).record_if_waiting(message.message, &text, posting)?;
    if recorded {
        *count += 1;
    }
    Ok(None)
}

/// A draft GitLab already holds for the message is taken (once) instead of posting it again.
fn outcome(
    glab: &Glab,
    range: &Range,
    target: &LinedUp,
    drafts: &mut Vec<DraftNote>,
    message: &QueuedMessage,
    text: &str,
) -> Result<Outcome> {
    let file = message.file;
    let entry = range.entry(file).ok_or(Error::UnknownFile { file })?;
    let place = match line_place(entry, message.place.end) {
        Ok(place) => place,
        Err(reason) => return Ok(Outcome::Refused(reason.to_owned())),
    };
    let multi_line = if message.place.is_one_line() {
        None
    } else {
        match range_ends(range, entry, message.place) {
            Ok(ends) => Some(ends),
            Err(reason) => return Ok(Outcome::Refused(reason)),
        }
    };
    let body = PostBody {
        note: text.to_owned(),
        diff_refs: target.diff_refs.clone(),
        place,
        multi_line,
    };
    if let Some(index) = drafts.iter().position(|draft| same_draft(&body, draft)) {
        return Ok(Outcome::Drafted(drafts.swap_remove(index).id));
    }
    let args = post_draft_note(&target.merge_request);
    Ok(posted(run(glab, range.root(), &args, Some(body.json()))))
}

/// GitLab's ends of a place on several lines, numbered from the file's differences as the range shows them now;
/// `Err` is why the message cannot be posted.
fn range_ends(
    range: &Range,
    entry: &RangeEntry,
    place: ThreadPlace,
) -> std::result::Result<MultiLine, String> {
    let diff = match range.load(entry.id) {
        Ok(RangeFile::Texts {
            left,
            right,
            differences,
            ..
        }) => FileDiff {
            differences,
            left_is_empty: left.is_empty(),
            right_is_empty: right.is_empty(),
        },
        Ok(
            RangeFile::Binary
            | RangeFile::TooLarge { .. }
            | RangeFile::NotUtf8 { .. }
            | RangeFile::ModeOnly { .. }
            | RangeFile::KindChanged { .. }
            | RangeFile::Submodule { .. },
        ) => return Err(NO_LINES.to_owned()),
        Err(error) => return Err(error.to_string()),
    };
    multi_line(entry, &diff, place).map_err(str::to_owned)
}

fn pending(target: &LinedUp, text: &str, draft_note: u64) -> Posting {
    let named = &target.merge_request.named;
    Posting::Pending {
        text: text.to_owned(),
        draft_note,
        merge_request: named.reference.clone(),
        link: format!("{}{DIFFS_PAGE}", named.web_url),
    }
}

fn locked(threads: &Mutex<ThreadStore>) -> MutexGuard<'_, ThreadStore> {
    threads.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Tally {
    fn sent(&self, list: ThreadList) -> SendReply {
        SendReply::Sent {
            list,
            sent: self.sent,
            refused: self.refused,
        }
    }

    fn stopped(&self, list: ThreadList, reason: String) -> SendReply {
        SendReply::Stopped {
            list,
            sent: self.sent,
            refused: self.refused,
            reason,
        }
    }
}

/// The drafts no message of the store already owns: only those may stand in for a post that timed out.
fn unowned(mut drafts: Vec<DraftNote>, owned: &[u64]) -> Vec<DraftNote> {
    drafts.retain(|draft| !owned.contains(&draft.id));
    drafts
}

fn lined_up(glab: &Glab, range: &Range) -> std::result::Result<LinedUp, NotLinedUp> {
    let root = range.root();
    require_logged_in(glab, root)?;
    let compared = range.compared();
    let repo = Repo::discover(root).map_err(|error| failed(error.to_string()))?;
    let branch =
        right_branch(&repo, &compared.right_label).map_err(|error| failed(error.to_string()))?;
    let (looked_at, args) = lookup(branch, &compared);
    let listed = answer(glab, root, &args)
        .and_then(|json| listed_from(&json))
        .map_err(failed)?;
    let mut merge_requests = Vec::new();
    for listed in candidates(listed, &looked_at, &compared.right) {
        let request = answer(glab, root, &merge_request_details(&listed))
            .and_then(|json| merge_request_from(&json))
            .map_err(failed)?;
        merge_requests.push(request);
    }
    let found = Found {
        looked_at,
        merge_requests,
    };
    lines_up(&compared, found)
}

/// What the merge requests are looked up by, and the glab call that lists them.
fn lookup(branch: Option<String>, compared: &Compared) -> (LookedAt, Vec<String>) {
    if let Some(name) = branch {
        let args = merge_requests_from_branch(&name);
        return (LookedAt::Branch { name }, args);
    }
    let short_id = compared.right_short_id.clone();
    (
        LookedAt::Commit { short_id },
        merge_requests_of_commit(compared.right.as_str()),
    )
}

fn require_logged_in(glab: &Glab, root: &Path) -> std::result::Result<(), NotLinedUp> {
    match glab.auth_status(root) {
        AuthStatus::LoggedIn => Ok(()),
        AuthStatus::LoggedOut { detail } => Err(NotLinedUp::NotLoggedIn { detail }),
        AuthStatus::Failed { message } => Err(failed(message)),
    }
}

fn failed(message: String) -> NotLinedUp {
    NotLinedUp::Failed { message }
}
