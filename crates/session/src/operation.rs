use serde::Serialize;
use specta::Type;
use yamt_gitio::{Operation, Progress, Rebase, Repo, Stop};

use crate::disk::DiskChange;
use crate::session::{FileEntry, LOG_TARGET, MergeSession};
use crate::side_names::{
    SideName, SideNames, checked_out, commit_name, merge_head_name, named, revert_name, text,
};
use crate::{Error, Result};

/// What git is doing, with the names of what it applies (plan §2 #87).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum OperationView {
    Merge {
        merging: Option<SideName>,
        into: Option<SideName>,
    },
    SquashMerge {
        merging: Option<SideName>,
        into: Option<SideName>,
    },
    Rebase {
        branch: Option<String>,
        onto: Option<SideName>,
        replaying: Option<SideName>,
        progress: Option<ProgressView>,
        editor_steps_ahead: bool,
    },
    CherryPick {
        picking: Option<SideName>,
        progress: Option<ProgressView>,
    },
    Revert {
        reverting: Option<SideName>,
        progress: Option<ProgressView>,
    },
    Am {
        subject: String,
        message: String,
        progress: Option<ProgressView>,
    },
}

/// Step `step` of `total`, 1 ≤ step ≤ total.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct ProgressView {
    pub step: u32,
    pub total: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum OperationKind {
    Merge,
    SquashMerge,
    Rebase,
    CherryPick,
    Revert,
    Am,
}

/// A list of the stop this session opened, or `MovedOn`: git is at another stop now, nothing was settled.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
#[expect(
    clippy::large_enum_variant,
    reason = "one value per list, returned and serialized at once; never stored"
)]
pub enum Refreshed {
    Files(StopList),
    MovedOn,
}

/// The files as git sees them, the disk changes settled while looking, what git is doing now and both
/// sides' names as read at open.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct StopList {
    pub files: Vec<FileEntry>,
    pub disk_changes: Vec<DiskChange>,
    pub operation: Option<OperationView>,
    pub sides: SideNames,
}

/// What a Continue git accepted led to: the operation ended, or git stopped again at another stop.
/// Tagged `outcome`: `kind` is the finished operation's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "outcome")]
pub enum Continued {
    Finished { kind: OperationKind, output: String },
    Stopped { message: String },
}

impl MergeSession {
    /// Reads the stop first: another stop than the one opened → `MovedOn`, nothing settled or staged.
    /// Otherwise `refresh`'s settle and git's marks, plus the operation as read now and the names read at open.
    pub fn refresh_stop(&mut self) -> Result<Refreshed> {
        let now = self.repo.stop()?;
        if self.has_moved_on_to(&now) {
            return Ok(Refreshed::MovedOn);
        }
        let disk_changes = self.settle_and_mark()?;
        Ok(Refreshed::Files(StopList {
            files: self.files(),
            disk_changes,
            operation: view(&self.repo, &now),
            sides: (*self.side_names).clone(),
        }))
    }

    /// Re-reads the stop: none → `NoOperation`; another stop → `StopMovedOn`; else git's abort.
    pub fn abort_operation(&mut self) -> Result<OperationKind> {
        let operation = self.operation_still_here()?;
        self.repo.abort(&operation)?;
        Ok(kind_of(&operation))
    }

    /// Re-reads the stop as `abort_operation` does, runs git's continue, re-reads the stop: none →
    /// `Finished`; the same stop → `GitRefused` with git's output; another → `Stopped`.
    pub fn continue_operation(&mut self) -> Result<Continued> {
        let operation = self.operation_still_here()?;
        let run = self.repo.continue_operation(&operation)?;
        let message = text(&run.output).trim_end().to_owned();
        let after = self.repo.stop()?;
        if after.operation.is_none() {
            let kind = kind_of(&operation);
            return Ok(Continued::Finished {
                kind,
                output: message,
            });
        }
        if after.id() == self.stop.id() {
            return Err(Error::GitRefused { message });
        }
        Ok(Continued::Stopped { message })
    }

    /// The operation of the stop this session opened, read again from git.
    fn operation_still_here(&self) -> Result<Operation> {
        let now = self.repo.stop()?;
        if self.has_moved_on_to(&now) {
            return Err(Error::StopMovedOn);
        }
        now.operation.ok_or(Error::NoOperation)
    }

    /// git records an operation that is not the stop this session opened. An operation that ended or
    /// was aborted outside (none recorded now) has not moved on: the list is git's view (plan §2 #89).
    fn has_moved_on_to(&self, now: &Stop) -> bool {
        now.operation.is_some() && now.id() != self.stop.id()
    }
}

fn kind_of(operation: &Operation) -> OperationKind {
    match operation {
        Operation::Merge { .. } => OperationKind::Merge,
        Operation::SquashMerge { .. } => OperationKind::SquashMerge,
        Operation::Rebase(_) => OperationKind::Rebase,
        Operation::CherryPick { .. } => OperationKind::CherryPick,
        Operation::Revert { .. } => OperationKind::Revert,
        Operation::Am { .. } => OperationKind::Am,
    }
}

fn view(repo: &Repo, stop: &Stop) -> Option<OperationView> {
    let head = stop.head.as_ref();
    Some(match stop.operation.as_ref()? {
        Operation::Merge { merging } => OperationView::Merge {
            merging: name_or_warn("merging", merge_head_name(repo, merging).map(Some)),
            into: name_or_warn("into", checked_out(repo, head)),
        },
        Operation::SquashMerge { merging } => OperationView::SquashMerge {
            merging: name_or_warn("merging", named(repo, merging.as_ref(), merge_head_name)),
            into: name_or_warn("into", checked_out(repo, head)),
        },
        Operation::Rebase(rebase) => rebase_view(repo, rebase),
        Operation::CherryPick { picking, progress } => OperationView::CherryPick {
            picking: name_or_warn("picking", named(repo, picking.as_ref(), commit_name)),
            progress: progress.map(progress_view),
        },
        Operation::Revert {
            reverting,
            progress,
        } => OperationView::Revert {
            reverting: name_or_warn("reverting", named(repo, reverting.as_ref(), revert_name)),
            progress: progress.map(progress_view),
        },
        Operation::Am {
            subject,
            message,
            progress,
        } => OperationView::Am {
            subject: text(subject),
            message: text(message).trim().to_owned(),
            progress: progress.map(progress_view),
        },
    })
}

fn rebase_view(repo: &Repo, rebase: &Rebase) -> OperationView {
    OperationView::Rebase {
        branch: rebase.branch.as_deref().map(text),
        onto: name_or_warn("onto", named(repo, rebase.onto.as_ref(), merge_head_name)),
        replaying: name_or_warn(
            "replaying",
            named(repo, rebase.replaying.as_ref(), commit_name),
        ),
        progress: rebase.progress.map(progress_view),
        editor_steps_ahead: rebase.editor_steps_ahead,
    }
}

fn progress_view(progress: Progress) -> ProgressView {
    ProgressView {
        step: progress.step(),
        total: progress.total(),
    }
}

fn name_or_warn(name: &'static str, read: Result<Option<SideName>>) -> Option<SideName> {
    match read {
        Ok(found) => found,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "operation_name_unread", name, %error, "this name is left out");
            None
        }
    }
}
