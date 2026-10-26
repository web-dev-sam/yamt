use std::path::{Path, is_separator};
use std::sync::mpsc::Sender;

use yamt_gitio::Repo;
use yamt_pipe::{Framing, HostEvent, ProgramFolders, Running, find};

use crate::{AgentCommand, AgentStartReply};

/// Starts the command's program in `checkout`, looked up in PATH, then in the command's home folders;
/// `Err` is the reply that says why it did not start. A relative path such as `bin/agent` is refused: it
/// would name a file of the reviewed commit. The agent's environment names no repository
/// (`Repo::REPOSITORY_VARIABLES`), so its git finds the checkout's own.
pub(crate) fn start_in(
    checkout: &Path,
    command: &AgentCommand,
    events: Sender<HostEvent>,
) -> Result<Running, AgentStartReply> {
    let not_found = |searched: Vec<String>| AgentStartReply::NotFound {
        program: command.program.clone(),
        searched,
    };
    let program = Path::new(&command.program);
    if command.program.chars().any(is_separator) && !program.is_absolute() {
        return Err(not_found(Vec::new()));
    }
    let folders = ProgramFolders {
        project: Vec::new(),
        home: command.home_folders.clone(),
    };
    let found = find(checkout, checkout, &command.program, &folders).map_err(|searched| {
        not_found(
            searched
                .iter()
                .map(|folder| folder.to_string_lossy().into_owned())
                .collect(),
        )
    })?;
    let removed = Repo::REPOSITORY_VARIABLES;
    Running::start_without(
        &found.path,
        &command.args,
        checkout,
        Framing::Lines,
        events,
        &removed,
    )
    .map_err(|error| AgentStartReply::SpawnFailed {
        program: command.program.clone(),
        message: error.to_string(),
    })
}
