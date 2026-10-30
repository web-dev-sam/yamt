use std::path::Path;
use std::process::ExitCode;

use yamt_local_merge::{WindowClaim, claim_window, find_live};
use yamt_session::{MergeSession, OperationKind, Refreshed};

use crate::merge::{Merge, MergeState, lock_when_git_is_done};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Exit {
    Success = 0,
    Unresolved = 1,
    Failure = 2,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Ending {
    pub(crate) exit: Exit,
    pub(crate) message: Option<String>,
}

impl Ending {
    pub(crate) fn failure(message: String) -> Ending {
        Ending {
            exit: Exit::Failure,
            message: Some(message),
        }
    }

    pub(crate) fn report(self) -> ExitCode {
        if let Some(message) = self.message {
            eprintln!("yamt: {message}");
        }
        ExitCode::from(self.exit as u8)
    }
}

pub(crate) enum Startup {
    /// `claim`: this window's hold on a merge yamt started, kept until the window closes (RK47).
    Merge {
        session: Box<MergeSession>,
        claim: Option<WindowClaim>,
    },
    Done(Ending),
}

/// A merge yamt started opens the window even without a conflicted file, so its merge can be committed.
pub(crate) fn startup(repo: &Path) -> Startup {
    let session = match MergeSession::open(repo) {
        Ok(session) => session,
        Err(error) => return Startup::Done(Ending::failure(error.to_string())),
    };
    let claim = match claim_recorded_merge(session.root()) {
        Ok(claim) => claim,
        Err(ending) => return Startup::Done(ending),
    };
    if session.files().is_empty() && claim.is_none() {
        return Startup::Done(Ending {
            exit: Exit::Success,
            message: Some(format!("nothing to merge in {}", session.root().display())),
        });
    }
    Startup::Merge {
        session: Box::new(session),
        claim,
    }
}

/// The window's claim on the merge yamt started in `root`, if there is one; another window holding it is the
/// ending instead.
fn claim_recorded_merge(root: &Path) -> Result<Option<WindowClaim>, Ending> {
    let failure = |error: yamt_local_merge::Error| Ending::failure(error.to_string());
    let Some(live) = find_live(root).map_err(failure)? else {
        return Ok(None);
    };
    match claim_window(root).map_err(failure)? {
        Some(claim) => Ok(Some(claim)),
        None => Err(Ending::failure(format!(
            "the merge of !{} is already open in another yamt window",
            live.iid()
        ))),
    }
}

/// The ending when the window closes: once no worker runs git.
pub(crate) fn ending_when_git_is_done(state: &MergeState) -> Ending {
    ending_on_close(&mut lock_when_git_is_done(state))
}

/// The ending of a merge no worker runs git for; see `merge::lock_when_git_is_done`.
pub(crate) fn ending_on_close(merge: &mut Merge) -> Ending {
    match merge {
        Merge::Held(session) => held_merge_ending(session),
        Merge::MovedOn { root, .. } => moved_on_ending(root),
        Merge::Aborted(kind) => Ending {
            exit: Exit::Unresolved,
            message: Some(format!("{} aborted", operation_name(*kind))),
        },
        Merge::Finished(kind) => finished_ending(*kind),
        Merge::Committed { .. } => finished_ending(OperationKind::Merge),
        Merge::Running(kind) => Ending::failure(format!(
            "closed while git ran the {}",
            operation_name(*kind)
        )),
    }
}

fn finished_ending(kind: OperationKind) -> Ending {
    Ending {
        exit: Exit::Success,
        message: Some(format!("{} finished", operation_name(kind))),
    }
}

fn operation_name(kind: OperationKind) -> &'static str {
    match kind {
        OperationKind::Merge => "merge",
        OperationKind::SquashMerge => "squash merge",
        OperationKind::Rebase => "rebase",
        OperationKind::CherryPick => "cherry-pick",
        OperationKind::Revert => "revert",
        OperationKind::Am => "patch application",
    }
}

/// git's view at close: the stop's list, or the stop git moved on to (plan §2 #41).
fn held_merge_ending(session: &mut MergeSession) -> Ending {
    match session.refresh_stop() {
        Ok(Refreshed::Files(_)) => unresolved_ending(session),
        Ok(Refreshed::MovedOn) => moved_on_ending(session.root()),
        Err(error) => {
            tracing::warn!(%error, "exit status from the session's statuses: git could not list the unmerged files");
            unresolved_ending(session)
        }
    }
}

/// The stop git moved on to, as git lists it: opened only to count, nothing settled or staged.
fn moved_on_ending(root: &Path) -> Ending {
    match MergeSession::open(root) {
        Ok(session) => unresolved_ending(&session),
        Err(error) => Ending::failure(error.to_string()),
    }
}

fn unresolved_ending(session: &MergeSession) -> Ending {
    let unresolved = session.remaining();
    if unresolved == 0 {
        return Ending {
            exit: Exit::Success,
            message: None,
        };
    }
    Ending {
        exit: Exit::Unresolved,
        message: Some(format!(
            "{unresolved} of {} files still unresolved",
            session.files().len()
        )),
    }
}

#[cfg(test)]
mod tests;
