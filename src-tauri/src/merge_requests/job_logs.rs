use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard, PoisonError};

use yamt_merge_requests::{Glab, JobLog, JobLogReply, WebPage, read_job_log};

use super::{MergeRequestState, NO_PROJECT, offered};

/// The run's logs: the latest `Log` per page; a failure is never kept, so the next ask reads GitLab again.
#[derive(Default)]
pub(super) struct JobLogs(Mutex<BTreeMap<WebPage, JobLog>>);

impl JobLogs {
    fn kept(&self) -> MutexGuard<'_, BTreeMap<WebPage, JobLog>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// A page no list sent is `NotOffered` without glab; a kept log comes without glab; else glab reads it, and a log is
/// kept. Never holds the logs while glab runs, never together with `pages`.
pub(super) fn job_log_reply(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    page: &WebPage,
) -> JobLogReply {
    if !offered(&state.pages).contains(page) {
        tracing::warn!(page = page.as_str(), "a job log no list sent");
        return JobLogReply::NotOffered;
    }
    let kept = state.job_logs.kept().get(page).cloned();
    if let Some(log) = kept {
        return JobLogReply::Log { log };
    }
    let Some(repository) = &state.gitlab else {
        return JobLogReply::Failed {
            message: NO_PROJECT.to_owned(),
        };
    };
    let reply = read_job_log(repository, glab, page);
    if let JobLogReply::Log { log } = &reply {
        state.job_logs.kept().insert(page.clone(), log.clone());
    }
    reply
}
