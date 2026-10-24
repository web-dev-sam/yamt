use std::path::Path;
use std::sync::mpsc::Sender;

use yamt_pipe::{Framing, HostEvent, ProgramFolders, Running, find};

use crate::{AgentCommand, AgentStartReply};

/// Starts the command's program in `checkout`, looked up in PATH, then in the command's home folders;
/// `Err` is the reply that says why it did not start.
pub(crate) fn start_in(
    checkout: &Path,
    command: &AgentCommand,
    events: Sender<HostEvent>,
) -> Result<Running, AgentStartReply> {
    let folders = ProgramFolders {
        project: Vec::new(),
        home: command.home_folders.clone(),
    };
    let found = find(checkout, checkout, &command.program, &folders).map_err(|searched| {
        AgentStartReply::NotFound {
            program: command.program.clone(),
            searched: searched
                .iter()
                .map(|folder| folder.to_string_lossy().into_owned())
                .collect(),
        }
    })?;
    Running::start(&found.path, &command.args, checkout, Framing::Lines, events).map_err(|error| {
        AgentStartReply::SpawnFailed {
            program: command.program.clone(),
            message: error.to_string(),
        }
    })
}
