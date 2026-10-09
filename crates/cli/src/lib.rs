//! Headless command line front end: classify, scan, golden and fixture tooling.
#![forbid(unsafe_code)]

mod args;
mod case;
mod classify;
mod fixture;
mod golden;
mod scan;

use std::fmt;
use std::io::{self, Write};
use std::process::ExitCode;

use args::Command;

const USAGE: &str = "usage:
  yamt-cli classify <base> <local> <remote> [--gap N] [--json]
  yamt-cli scan [<repo>]
  yamt-cli golden run|update [<dir>]
  yamt-cli fixture <case-dir>";
const USAGE_EXIT_CODE: u8 = 2;

#[derive(Debug)]
pub enum Error {
    Usage { problem: String },
    Read { path: String, source: io::Error },
    Write { path: String, source: io::Error },
    MalformedCase { case: String, problem: String },
    NoCases { dir: String },
    GoldenFailed { failed: usize, total: usize },
    Session(yamt_session::Error),
    Json(serde_json::Error),
    Stdout(io::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Usage { problem } => write!(f, "{problem}\n{USAGE}"),
            Error::Read { path, source } => write!(f, "cannot read {path}: {source}"),
            Error::Write { path, source } => write!(f, "cannot write {path}: {source}"),
            Error::MalformedCase { case, problem } => {
                write!(f, "{case} is not a golden case: {problem}")
            }
            Error::NoCases { dir } => write!(f, "no golden cases in {dir}"),
            Error::GoldenFailed { failed, total } => {
                write!(f, "{failed} of {total} golden cases failed")
            }
            Error::Session(source) => write!(f, "{source}"),
            Error::Json(source) => write!(f, "cannot serialise json: {source}"),
            Error::Stdout(source) => write!(f, "cannot write to stdout: {source}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<yamt_session::Error> for Error {
    fn from(source: yamt_session::Error) -> Self {
        Error::Session(source)
    }
}

impl From<serde_json::Error> for Error {
    fn from(source: serde_json::Error) -> Self {
        Error::Json(source)
    }
}

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

pub fn run(args: &[String]) -> Result<()> {
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
