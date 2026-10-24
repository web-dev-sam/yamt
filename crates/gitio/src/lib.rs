//! Git subprocess layer: reads and writes index stages and blobs as bytes, reads what git is doing
//! (`Repo::stop`), the merge heads, the refs that point at them, the merge message, the paths rerere still
//! tracks and the merge driver config, re-runs git's merge of one file, aborts or continues the operation,
//! lists the files that changed between two commits, and makes and reads a shared clone (`checkout.rs`);
//! runs glab, GitLab's command line, the same way.
#![forbid(unsafe_code)]

mod abort_continue;
mod attributes;
mod blob;
mod checkout;
mod diff;
mod entry;
mod glab;
mod merge_config;
mod merge_file;
mod names;
mod operation;
mod program;
mod repo;
mod rerere;
mod run;
mod sequence;
mod todo;
mod version;

pub use abort_continue::GitRun;
pub use attributes::{AttributeValue, MergeAttributes};
pub use blob::BlobReader;
pub use checkout::StatusEntry;
pub use diff::{Changed, ChangedFile, Numstat, TreeSide};
pub use entry::{Oid, Stage, StageEntry};
pub use glab::{GLAB_TIMEOUT, Glab, GlabRun};
pub use merge_config::MergeConfig;
pub use merge_file::{MergeFileOptions, OURS_LABEL, THEIRS_LABEL};
pub use names::CommitSummary;
pub use operation::{Operation, Progress, Rebase, Stop, StopId};
pub use repo::Repo;
pub use version::GitVersion;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("git executable not found on PATH")]
    GitNotFound,
    #[error("`{}` failed with {}: {stderr}", args.join(" "), exit_description(*status))]
    GitFailed {
        args: Vec<String>,
        status: Option<i32>,
        stderr: String,
    },
    #[error("`{}` timed out after {after:?}", args.join(" "))]
    Timeout {
        args: Vec<String>,
        after: std::time::Duration,
    },
    #[error("blob {} missing from the object database", oid.as_str())]
    BlobMissing { oid: Oid },
    #[error("unexpected output from git {command}: {output}")]
    UnexpectedOutput {
        command: &'static str,
        output: String,
    },
    #[error("cannot read {}: {source}", path.display())]
    ReadFailed {
        path: std::path::PathBuf,
        source: std::io::Error,
    },
    #[error("cannot write {}: {source}", path.display())]
    WriteFailed {
        path: std::path::PathBuf,
        source: std::io::Error,
    },
    #[error("i/o error while running git: {0}")]
    Io(#[from] std::io::Error),
    #[error("i/o error while running {}: {source}", program.display())]
    GlabIo {
        program: std::path::PathBuf,
        source: std::io::Error,
    },
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

fn exit_description(status: Option<i32>) -> String {
    match status {
        Some(code) => format!("exit status {code}"),
        None => "killed by signal".to_owned(),
    }
}
