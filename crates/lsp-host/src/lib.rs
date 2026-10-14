//! Starts language servers, passes their framed messages both ways and stops them; never reads a message.
#![forbid(unsafe_code)]

mod files;
mod frame;
mod program;
mod run;

use std::collections::BTreeMap;
use std::mem;
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;

use serde::{Deserialize, Serialize};

pub use crate::files::ProjectFile;
pub use crate::program::{ProgramFound, ProgramPlace};
pub use crate::run::HostEvent;
use crate::run::Running;

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, specta::Type,
)]
pub struct RunId(u32);

/// `project`: the repository-relative folder the program runs in (`""` = the root, `/` separators).
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, specta::Type)]
pub struct ServerCommand {
    pub program: String,
    pub args: Vec<String>,
    pub project: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(tag = "kind")]
pub enum StartReply {
    Started {
        run: RunId,
    },
    NotFound {
        program: String,
        searched: Vec<String>,
    },
    SpawnFailed {
        program: String,
        message: String,
    },
    OutsideRepository {
        project: String,
    },
}

/// `root`: the repository's folder, `None` when its path is not UTF-8.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
pub struct ServerContext {
    pub root: Option<String>,
    pub process_id: u32,
}

/// The language servers running for one repository.
pub struct Host {
    root: PathBuf,
    next_run: u32,
    runs: BTreeMap<RunId, Running>,
}

impl Host {
    #[must_use]
    pub fn new(root: &Path) -> Host {
        Host {
            root: root.to_owned(),
            next_run: 0,
            runs: BTreeMap::new(),
        }
    }

    #[must_use]
    pub fn context(&self) -> ServerContext {
        ServerContext {
            root: self.root.to_str().map(str::to_owned),
            process_id: std::process::id(),
        }
    }

    /// `events` gets the run's messages and stderr lines, then one `Exited`; once `events` is
    /// dropped, the run stops itself at its next output.
    pub fn start(&mut self, command: &ServerCommand, events: Sender<HostEvent>) -> StartReply {
        self.runs.retain(|_, running| !running.is_finished());
        let Some(project) = files::in_repository(&self.root, &command.project) else {
            return StartReply::OutsideRepository {
                project: command.project.clone(),
            };
        };
        let program = match program::find(&self.root, &project, &command.program) {
            Ok(found) => found.path,
            Err(searched) => {
                return StartReply::NotFound {
                    program: command.program.clone(),
                    searched: texts(&searched),
                };
            }
        };
        match Running::start(&program, &command.args, &project, events) {
            Ok(running) => {
                let run = RunId(self.next_run);
                self.next_run = self.next_run.wrapping_add(1);
                self.runs.insert(run, running);
                StartReply::Started { run }
            }
            Err(error) => StartReply::SpawnFailed {
                program: command.program.clone(),
                message: error.to_string(),
            },
        }
    }

    /// Queues one message for the run's stdin; an unknown or finished run ignores it.
    pub fn send(&self, run: RunId, message: String) {
        if let Some(running) = self.runs.get(&run) {
            running.send(message);
        }
    }

    /// Closes the run's stdin, gives the program 2 s to exit, then kills it; returns at once.
    pub fn stop(&self, run: RunId) {
        if let Some(running) = self.runs.get(&run) {
            running.stop();
        }
    }

    /// Signals every run to stop and returns at once; each run's `Exited` follows.
    pub fn stop_every(&self) {
        for running in self.runs.values() {
            running.stop();
        }
    }

    /// Stops every run and returns once each program has been reaped.
    pub fn stop_all(&mut self) {
        self.stop_every();
        for running in mem::take(&mut self.runs).into_values() {
            running.wait();
        }
    }

    /// `NotFound` with nothing searched for a project outside the repository.
    #[must_use]
    pub fn find_program(&self, program: &str, project: &str) -> ProgramFound {
        let Some(project) = files::in_repository(&self.root, project) else {
            return ProgramFound::NotFound {
                searched: Vec::new(),
            };
        };
        match program::find(&self.root, &project, program) {
            Ok(found) => ProgramFound::Found {
                path: found.path.display().to_string(),
                place: found.place,
            },
            Err(searched) => ProgramFound::NotFound {
                searched: texts(&searched),
            },
        }
    }

    /// One answer per repository-relative path, in the same order.
    #[must_use]
    pub fn project_files(&self, paths: &[String]) -> Vec<ProjectFile> {
        paths
            .iter()
            .map(|path| files::project_file(&self.root, path))
            .collect()
    }
}

fn texts(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| path.display().to_string())
        .collect()
}
