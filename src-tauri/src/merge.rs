use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

use yamt_session::{
    Continued, DiskChange, DiskVersion, FileEntry, MergeSession, OperationKind, OperationView,
    Refreshed, SideNames, StopList,
};

use crate::ipc_error::IpcError;

const GIT_RUNNING_POLL: Duration = Duration::from_millis(50);

/// The stop this run works on (plan §2 #74, #88, #89).
pub(crate) enum Merge {
    Held(Box<MergeSession>),
    /// git aborts or continues; the session is with the worker.
    Running(OperationKind),
    /// git moved on to another stop: the old session is dropped; the next list opens the new one,
    /// its disk versions above the old session's highest (#1383).
    MovedOn {
        root: PathBuf,
        highest_disk_version: DiskVersion,
    },
    Aborted(OperationKind),
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
    },
    MovedOn,
}

/// What a Continue git accepted led to: the operation ended, or git stopped at another stop.
#[derive(Debug, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum ContinueReply {
    Finished,
    Stopped { message: String },
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
            Merge::Finished(_) => Err(IpcError::MergeFinished),
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
            }),
            Refreshed::MovedOn => {
                *self = moved_on(session);
                Ok(Listing::MovedOn)
            }
        }
    }

    /// git finished or aborted the operation: nothing is left for this window.
    pub(crate) fn has_ended(&self) -> bool {
        match self {
            Merge::Finished(_) | Merge::Aborted(_) => true,
            Merge::Held(_) | Merge::Running(_) | Merge::MovedOn { .. } => false,
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
            | Merge::Finished(_)) => {
                *self = refused;
                self.hand_to_worker()
            }
        }
    }
}

fn moved_on(session: &MergeSession) -> Merge {
    Merge::MovedOn {
        root: session.root().to_path_buf(),
        highest_disk_version: session.highest_disk_version(),
    }
}

/// Runs `work` on a blocking worker while the merge is `Running`. git's refusal puts the session
/// back; a worker that panicked leaves `MovedOn` and answers `StopMovedOn`, so the window opens the stop git is at.
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
            *lock(state) = Merge::Held(session);
            Err(error.into())
        }
        Err(error) => {
            tracing::error!(%error, "yamt's worker stopped while git ran");
            *lock(state) = after_a_panic;
            Err(IpcError::StopMovedOn)
        }
    }
}

/// git's abort of the operation (plan §2 #88); `Aborted` only after git succeeded.
pub(crate) async fn abort_operation(state: &MergeState) -> Result<(), IpcError> {
    let (_session, kind) = on_worker(state, MergeSession::abort_operation).await?;
    *lock(state) = Merge::Aborted(kind);
    Ok(())
}

/// git's continue (plan §2 #89): finished, or stopped at another stop (`MovedOn`).
pub(crate) async fn continue_operation(state: &MergeState) -> Result<ContinueReply, IpcError> {
    let (session, continued) = on_worker(state, MergeSession::continue_operation).await?;
    let mut merge = lock(state);
    match continued {
        Continued::Finished { kind, output } => {
            tracing::info!(%output, "git finished the operation");
            *merge = Merge::Finished(kind);
            Ok(ContinueReply::Finished)
        }
        Continued::Stopped { message } => {
            *merge = moved_on(&session);
            Ok(ContinueReply::Stopped { message })
        }
    }
}

#[cfg(test)]
mod tests;
