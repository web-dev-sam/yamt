use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use yamt_local_merge::{Leftover, LiveMerge, MergeView, PushOffer, PushReply, find_live};
use yamt_session::{
    Continued, DiskChange, DiskVersion, FileEntry, MergeSession, OperationKind, OperationView,
    Refreshed, SideNames, StopList,
};

use crate::ipc_error::IpcError;

const GIT_RUNNING_POLL: Duration = Duration::from_millis(50);

/// The stop this run works on (plan §2 #74, #88, #89, #141).
pub(crate) enum Merge {
    Held(Box<MergeSession>),
    /// git aborts or continues, or pushes a committed merge; the session is with the worker.
    Running(OperationKind),
    /// git moved on to another stop: the old session is dropped; the next list opens the new one,
    /// its disk versions above the old session's highest (#1383).
    MovedOn {
        root: PathBuf,
        highest_disk_version: DiskVersion,
    },
    Aborted(OperationKind),
    /// A merge yamt started is committed in `root`; the window asks whether to push it.
    Committed {
        root: PathBuf,
        offer: PushOffer,
    },
    Finished(OperationKind),
}

pub(crate) type MergeState = Mutex<Merge>;

/// The files of the stop as git sees them, or `MovedOn`: git is at another stop, the next list opens it.
#[derive(Debug, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
#[expect(
    clippy::large_enum_variant,
    reason = "one value per list, returned and serialized at once; never stored"
)]
pub enum Listing {
    Files {
        files: Vec<FileEntry>,
        disk_changes: Vec<DiskChange>,
        operation: Option<OperationView>,
        sides: SideNames,
        /// The merge yamt started at this stop, from its record; `None` for any other stop.
        merge_request: Option<MergeView>,
    },
    MovedOn,
}

/// What a Continue git accepted led to: the operation ended, a merge yamt started was committed and may be
/// pushed, or git stopped at another stop.
#[derive(Debug, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum ContinueReply {
    Finished,
    ReadyToPush { branch: String },
    Stopped { message: String },
}

/// What an Abort git accepted could not put back of a merge yamt started.
#[derive(Debug, PartialEq, Eq, serde::Serialize, specta::Type)]
pub struct AbortReply {
    pub leftovers: Vec<Leftover>,
}

pub(crate) fn lock(state: &MergeState) -> MutexGuard<'_, Merge> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The merge once no worker runs git: a close waits for git rather than killing it.
pub(crate) fn lock_when_git_is_done(state: &MergeState) -> MutexGuard<'_, Merge> {
    loop {
        let merge = lock(state);
        if !matches!(*merge, Merge::Running(_)) {
            return merge;
        }
        drop(merge);
        thread::sleep(GIT_RUNNING_POLL);
    }
}

impl Merge {
    pub(crate) fn session(&mut self) -> Result<&mut MergeSession, IpcError> {
        match self {
            Merge::Held(session) => Ok(session),
            Merge::Running(_) => Err(IpcError::GitRunning),
            Merge::MovedOn { .. } => Err(IpcError::StopMovedOn),
            Merge::Aborted(_) => Err(IpcError::MergeAborted),
            Merge::Finished(_) | Merge::Committed { .. } => Err(IpcError::MergeFinished),
        }
    }

    /// After a move, opens the new stop first; a list that finds git moved on drops the session.
    pub(crate) fn list_stop(&mut self) -> Result<Listing, IpcError> {
        if let Merge::MovedOn {
            root,
            highest_disk_version,
        } = self
        {
            let session = MergeSession::open_after(root, *highest_disk_version)?;
            *self = Merge::Held(Box::new(session));
        }
        let session = self.session()?;
        match session.refresh_stop()? {
            Refreshed::Files(StopList {
                files,
                disk_changes,
                operation,
                sides,
            }) => Ok(Listing::Files {
                files,
                disk_changes,
                operation,
                sides,
                merge_request: recorded_merge(session.root())?.map(|live| live.view()),
            }),
            Refreshed::MovedOn => {
                *self = moved_on(session);
                Ok(Listing::MovedOn)
            }
        }
    }

    /// git finished or aborted the operation: nothing is left for this window. A committed merge yamt started
    /// still asks whether to push it.
    pub(crate) fn has_ended(&self) -> bool {
        match self {
            Merge::Finished(_) | Merge::Aborted(_) => true,
            Merge::Held(_)
            | Merge::Running(_)
            | Merge::MovedOn { .. }
            | Merge::Committed { .. } => false,
        }
    }

    /// Keep Local: a committed merge yamt started ends without a push; any other state stays.
    pub(crate) fn end_committed(&mut self) {
        if let Merge::Committed { .. } = self {
            *self = Merge::Finished(OperationKind::Merge);
        }
    }

    fn hand_to_worker(&mut self) -> Result<Box<MergeSession>, IpcError> {
        let kind = self
            .session()?
            .operation_kind()
            .ok_or(IpcError::NoOperation)?;
        match std::mem::replace(self, Merge::Running(kind)) {
            Merge::Held(session) => Ok(session),
            refused @ (Merge::Running(_)
            | Merge::MovedOn { .. }
            | Merge::Aborted(_)
            | Merge::Committed { .. }
            | Merge::Finished(_)) => {
                *self = refused;
                self.hand_to_worker()
            }
        }
    }

    /// The committed merge yamt started, taken out for a push while `Running`; any other state stays and
    /// answers `NoOperation`.
    fn take_committed(&mut self) -> Result<(PathBuf, PushOffer), IpcError> {
        match std::mem::replace(self, Merge::Running(OperationKind::Merge)) {
            Merge::Committed { root, offer } => Ok((root, offer)),
            kept @ (Merge::Held(_)
            | Merge::Running(_)
            | Merge::MovedOn { .. }
            | Merge::Aborted(_)
            | Merge::Finished(_)) => {
                *self = kept;
                Err(IpcError::NoOperation)
            }
        }
    }
}

/// The merge yamt started in `root`, read fresh from its record while git is still in it.
fn recorded_merge(root: &Path) -> Result<Option<LiveMerge>, IpcError> {
    find_live(root).map_err(|error| IpcError::Git {
        message: error.to_string(),
    })
}

/// The recorded merge at the held stop; read before the session goes to a worker.
fn held_recorded_merge(state: &MergeState) -> Result<Option<LiveMerge>, IpcError> {
    let root = lock(state).session()?.root().to_path_buf();
    recorded_merge(&root)
}

fn moved_on(session: &MergeSession) -> Merge {
    Merge::MovedOn {
        root: session.root().to_path_buf(),
        highest_disk_version: session.highest_disk_version(),
    }
}

/// Runs `work` on a blocking worker while the merge is `Running`. git's refusal puts the session
/// back; a stop git left meanwhile (`StopMovedOn`) or a worker that panicked leaves `MovedOn`, so the
/// next list opens the stop git is at.
async fn on_worker<T, F>(state: &MergeState, work: F) -> Result<(Box<MergeSession>, T), IpcError>
where
    T: Send + 'static,
    F: FnOnce(&mut MergeSession) -> yamt_session::Result<T> + Send + 'static,
{
    let mut session = lock(state).hand_to_worker()?;
    let after_a_panic = moved_on(&session);
    let worker = tauri::async_runtime::spawn_blocking(move || {
        let result = work(&mut session);
        (session, result)
    });
    match worker.await {
        Ok((session, Ok(value))) => Ok((session, value)),
        Ok((session, Err(error))) => {
            *lock(state) = if matches!(error, yamt_session::Error::StopMovedOn) {
                moved_on(&session)
            } else {
                Merge::Held(session)
            };
            Err(error.into())
        }
        Err(error) => {
            tracing::error!(%error, "yamt's worker stopped while git ran");
            *lock(state) = after_a_panic;
            Err(IpcError::StopMovedOn)
        }
    }
}

/// git's abort of the operation (plan §2 #88), then, for a merge yamt started, the checkout put back as its
/// record says (#140); `Aborted` only after git succeeded.
pub(crate) async fn abort_operation(state: &MergeState) -> Result<AbortReply, IpcError> {
    let live = held_recorded_merge(state)?;
    let aborted = on_worker(state, move |session| {
        let kind = session.abort_operation()?;
        let leftovers = live.map(LiveMerge::restore).unwrap_or_default();
        Ok((kind, leftovers))
    });
    let (_session, (kind, leftovers)) = aborted.await?;
    *lock(state) = Merge::Aborted(kind);
    Ok(AbortReply { leftovers })
}

/// git's continue (plan §2 #89): finished, committed a merge yamt started (`Committed`, #141), or stopped at
/// another stop (`MovedOn`).
pub(crate) async fn continue_operation(state: &MergeState) -> Result<ContinueReply, IpcError> {
    let live = held_recorded_merge(state)?;
    let (session, continued) = on_worker(state, MergeSession::continue_operation).await?;
    let mut merge = lock(state);
    match continued {
        Continued::Finished { kind, output } => {
            tracing::info!(%output, "git finished the operation");
            let Some(live) = live else {
                *merge = Merge::Finished(kind);
                return Ok(ContinueReply::Finished);
            };
            let offer = live.committed();
            let branch = offer.branch().to_owned();
            let root = session.root().to_path_buf();
            *merge = Merge::Committed { root, offer };
            Ok(ContinueReply::ReadyToPush { branch })
        }
        Continued::Stopped { message } => {
            *merge = moved_on(&session);
            Ok(ContinueReply::Stopped { message })
        }
    }
}

/// Pushes the committed merge yamt started on a worker while `Running` (#141): pushed → `Finished`; refused,
/// or a worker that panicked, → `Committed` again, so the window may ask once more.
pub(crate) async fn push_merged_branch(state: &MergeState) -> Result<PushReply, IpcError> {
    let (root, offer) = lock(state).take_committed()?;
    let worker = {
        let (root, offer) = (root.clone(), offer.clone());
        tauri::async_runtime::spawn_blocking(move || yamt_local_merge::push(&root, &offer))
    };
    let pushed = worker.await;
    let mut merge = lock(state);
    match pushed {
        Ok(PushReply::Pushed) => {
            *merge = Merge::Finished(OperationKind::Merge);
            Ok(PushReply::Pushed)
        }
        Ok(failed @ PushReply::Failed { .. }) => {
            *merge = Merge::Committed { root, offer };
            Ok(failed)
        }
        Err(error) => {
            tracing::error!(%error, "yamt's worker stopped while git pushed");
            *merge = Merge::Committed { root, offer };
            Err(IpcError::WorkerStopped)
        }
    }
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod merge_request_tests;
