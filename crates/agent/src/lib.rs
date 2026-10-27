//! The AI's workspace for one range window: its temporary checkout of the right commit and the agent process running in it.
#![forbid(unsafe_code)]

mod checkout;
mod look;
mod process;
mod sweep;
mod workspace;

use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use crate::look::LookJob;
pub use crate::sweep::sweep_other_pairs;
pub use crate::workspace::{Pair, Workspace};
pub use yamt_pipe::HostEvent;

/// One agent process start; a later start gets a new number.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct AgentRun(pub u32);

/// The agent's program and arguments as the settings name them, and the home folders looked in after PATH.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Type)]
pub struct AgentCommand {
    pub program: String,
    pub args: Vec<String>,
    pub home_folders: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum AgentStartReply {
    Started {
        run: AgentRun,
    },
    NotFound {
        program: String,
        searched: Vec<String>,
    },
    SpawnFailed {
        program: String,
        message: String,
    },
    NoCheckout,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum CheckoutReply {
    Ready { folder: String },
    Failed { message: String },
}

/// What the checkout holds now; `Changed` lists at least one file or ref, or has `head_moved`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind")]
pub enum CheckoutLook {
    Missing,
    Clean,
    Changed {
        folder: String,
        files: Vec<String>,
        /// The AI's branches and stash (plan §2 #122): the clone starts with none.
        refs: Vec<String>,
        head_moved: bool,
    },
    Unreadable {
        folder: String,
        message: String,
    },
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
    #[error("cannot remove {}: {source}", folder.display())]
    Remove { folder: PathBuf, source: io::Error },
    #[error("cannot rename {} to {}: {source}", from.display(), to.display())]
    Rename {
        from: PathBuf,
        to: PathBuf,
        source: io::Error,
    },
}
