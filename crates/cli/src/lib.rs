//! Headless command line front end: classify, scan, golden, fixture and compare tooling.
#![forbid(unsafe_code)]

mod args;
mod case;
mod classify;
mod compare;
mod fixture;
mod golden;
mod scan;

use std::ffi::OsString;
use std::fs;
use std::io::{self, Write};
use std::path::Path;
use std::process::ExitCode;

use args::Command;

const USAGE: &str = "usage:
  yamt-cli classify <base> <local> <remote> [--gap N] [--json]
  yamt-cli scan [<repo>]
  yamt-cli golden run|update [<dir>]
  yamt-cli fixture <case-dir>
  yamt-cli compare <case-dir>";
const USAGE_EXIT_CODE: u8 = 2;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{problem}\n{}", USAGE)]
    Usage { problem: String },
    #[error("cannot read {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: io::Error,
    },
    #[error("cannot write {path}: {source}")]
    Write {
        path: String,
        #[source]
        source: io::Error,
    },
    #[error("{case} is not a golden case: {problem}")]
    MalformedCase { case: String, problem: String },
    #[error("no golden cases in {dir}")]
    NoCases { dir: String },
    #[error("{failed} of {total} golden cases failed")]
    GoldenFailed { failed: usize, total: usize },
    #[error(transparent)]
    Session(#[from] yamt_session::Error),
    #[error("cannot serialise json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("cannot write to stdout: {0}")]
    Stdout(#[source] io::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl Error {
    #[must_use]
    pub fn exit_code(&self) -> ExitCode {
        match self {
            Error::Usage { .. } => ExitCode::from(USAGE_EXIT_CODE),
            Error::Read { .. }
            | Error::Write { .. }
            | Error::MalformedCase { .. }
            | Error::NoCases { .. }
            | Error::GoldenFailed { .. }
            | Error::Session(_)
            | Error::Json(_)
            | Error::Stdout(_) => ExitCode::FAILURE,
        }
    }
}

pub fn run(args: &[OsString]) -> Result<()> {
    match args::parse(args)? {
        Command::Classify {
            sides,
            options,
            json,
        } => classify::classify(&sides, options, json),
        Command::Scan { repo } => scan::scan(&repo),
        Command::GoldenRun { dir } => golden::run(&dir),
        Command::GoldenUpdate { dir } => golden::update(&dir),
        Command::Fixture { case_dir } => fixture::fixture(&case_dir),
        Command::Compare { case_dir } => compare::compare(&case_dir),
    }
}

fn print(text: &str) -> Result<()> {
    io::stdout()
        .lock()
        .write_all(text.as_bytes())
        .map_err(Error::Stdout)
}

fn print_lines(lines: &[String]) -> Result<()> {
    print(&(lines.join("\n") + "\n"))
}

fn read_text(path: &Path) -> Result<String> {
    fs::read_to_string(path).map_err(|source| read_error(path, source))
}

fn read_error(path: &Path, source: io::Error) -> Error {
    Error::Read {
        path: path.display().to_string(),
        source,
    }
}
