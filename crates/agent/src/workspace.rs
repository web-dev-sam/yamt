use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;

use yamt_pipe::{HostEvent, Running};

use crate::checkout;
use crate::look::LookJob;
use crate::process;
use crate::sweep;
use crate::{AgentCommand, AgentRun, AgentStartReply, CheckoutReply, Error};

/// The range window's repository, its pair folder (held by its `PairLock`) and the right commit's full id.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pair {
    pub repo: PathBuf,
    pub folder: PathBuf,
    pub new_commit: String,
}

/// The AI's checkout and the agent running in it. Every removal stops and reaps the agent first; only the
/// agent's own process is reaped, never a process it started (a build it runs may outlive it).
pub struct Workspace {
    pair: Pair,
    /// `Some` once `prepare` made or reused a complete checkout.
    checkout: Option<PathBuf>,
    agent: Option<(AgentRun, Running)>,
    next_run: u32,
}

impl Workspace {
    #[must_use]
    pub fn new(pair: Pair) -> Workspace {
        Workspace {
            pair,
            checkout: None,
            agent: None,
            next_run: 0,
        }
    }

    /// Makes `<pair folder>/checkout` or reuses the one there, with whatever it holds. Blocks for as
    /// long as git writes the work tree.
    pub fn prepare(&mut self) -> CheckoutReply {
        match checkout::made_or_reused(&self.pair.folder, &self.pair.repo, &self.pair.new_commit) {
            Ok(folder) => {
                let reply = CheckoutReply::Ready {
                    folder: folder.to_string_lossy().into_owned(),
                };
                self.checkout = Some(folder);
                reply
            }
            Err(error) => CheckoutReply::Failed {
                message: error.to_string(),
            },
        }
    }

    /// Starts the agent in the checkout, after stopping and reaping one that runs. Blocks until that
    /// earlier agent is reaped: up to about 3 s for one that ignores its stdin closing.
    pub fn start(&mut self, command: &AgentCommand, events: Sender<HostEvent>) -> AgentStartReply {
        let Some(folder) = self.checkout.clone() else {
            return AgentStartReply::NoCheckout;
        };
        self.stop_and_reap();
        match process::start_in(&folder, command, events) {
            Ok(running) => {
                let run = AgentRun(self.next_run);
                self.next_run += 1;
                self.agent = Some((run, running));
                AgentStartReply::Started { run }
            }
            Err(reply) => reply,
        }
    }

    /// Sends one line to the agent of `run`; for an earlier run it is dropped.
    pub fn send(&self, run: AgentRun, message: String) {
        if let Some(running) = self.running(run) {
            running.send(message);
        }
    }

    /// Asks the agent of `run` to stop; `Exited` follows on its events.
    pub fn stop(&self, run: AgentRun) {
        if let Some(running) = self.running(run) {
            running.stop();
        }
    }

    pub fn stop_agent(&self) {
        if let Some((_, running)) = &self.agent {
            running.stop();
        }
    }

    #[must_use]
    pub fn look_job(&self) -> LookJob {
        LookJob::in_pair(&self.pair.folder, self.pair.new_commit.clone())
    }

    /// Stops and reaps the agent, then removes the checkout, kept changes included.
    pub fn discard(&mut self) -> Result<(), Error> {
        self.stop_and_reap();
        self.checkout = None;
        checkout::remove(&self.pair.folder)
    }

    /// At exit: stops and reaps the agent, looks again, and removes the checkout only when it is clean.
    pub fn end(mut self) {
        self.stop_and_reap();
        checkout::remove_when_clean(&self.pair.folder, self.pair.new_commit);
    }

    /// What crashes and kills left in `range_dir`: in this pair only the partial and removing folders
    /// (its checkout is reused); in every other pair no window holds, also a clean checkout.
    pub fn sweep_leftovers(&mut self, range_dir: &Path) {
        sweep::logged(checkout::remove_leftovers(&self.pair.folder));
        sweep::sweep_other_pairs(range_dir, &self.pair.folder);
    }

    fn running(&self, run: AgentRun) -> Option<&Running> {
        match &self.agent {
            Some((current, running)) if *current == run => Some(running),
            Some(_) | None => None,
        }
    }

    fn stop_and_reap(&mut self) {
        if let Some((_, running)) = self.agent.take() {
            running.stop();
            running.wait();
        }
    }
}
