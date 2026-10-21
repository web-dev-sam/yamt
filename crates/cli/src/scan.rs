use std::path::Path;

use yamt_merge_core::Chunk;
use yamt_session::{FileStatus, MergeSession, UnsupportedReason};

use crate::classify::kind_summary;
use crate::{Result, print_lines};

pub(crate) fn scan(repo: &Path) -> Result<()> {
    let mut session = MergeSession::open(repo)?;
    let mut report = Vec::new();
    for entry in session.files() {
        let detail = match entry.unsupported {
            Some(reason) => format!("unsupported {}", reason_name(reason)),
            None => chunk_summary(&mut session, &entry.path)?,
        };
        report.push(format!(
            "{} {} {detail}",
            entry.path,
            status_name(entry.status)
        ));
    }
    report.push(format!("remaining: {}", session.remaining()));
    print_lines(&report)
}

fn chunk_summary(session: &mut MergeSession, path: &str) -> Result<String> {
    let data = session.load(path)?;
    let chunks: Vec<Chunk> = data.chunks.iter().map(|merge| merge.chunk).collect();
    Ok(kind_summary(&chunks))
}

fn status_name(status: FileStatus) -> &'static str {
    match status {
        FileStatus::Unresolved => "Unresolved",
        FileStatus::Remembered => "Remembered",
        FileStatus::Resolved => "Resolved",
    }
}

fn reason_name(reason: UnsupportedReason) -> &'static str {
    match reason {
        UnsupportedReason::Binary => "Binary",
        UnsupportedReason::NonUtf8 => "NonUtf8",
        UnsupportedReason::TooLarge => "TooLarge",
        UnsupportedReason::LocalDeleted => "LocalDeleted",
        UnsupportedReason::RemoteDeleted => "RemoteDeleted",
        UnsupportedReason::Symlink => "Symlink",
        UnsupportedReason::Submodule => "Submodule",
    }
}
