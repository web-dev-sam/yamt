//! Git subprocess layer: reads and writes index stages and blobs as bytes, and reads the merge
//! heads, the refs that point at them and the merge message.
#![forbid(unsafe_code)]

mod blob;
mod entry;
mod repo;
mod run;

pub use blob::BlobReader;
pub use entry::{Oid, Stage, StageEntry};
pub use repo::{CommitSummary, Repo};

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
        #[source]
        source: std::io::Error,
    },
    #[error("i/o error while running git: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

fn exit_description(status: Option<i32>) -> String {
    match status {
        Some(code) => format!("exit status {code}"),
        None => "killed by signal".to_owned(),
    }
}
