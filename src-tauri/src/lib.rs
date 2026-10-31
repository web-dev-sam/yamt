//! Desktop shell: one window over a `MergeSession`, whose exit status says whether the merge is resolved, or
//! with `--diff` one compare window over the stored tabs, or with `--diff=<range>` one read-only commit range
//! (with `--ai`, an AI agent in its own checkout); the compare and range windows list the GitLab project's merge
//! requests and open one's changes in a second yamt.

mod ai;
#[cfg(target_os = "linux")]
mod appimage;
mod args;
mod clipboard;
mod commands;
mod compare;
#[cfg(target_os = "linux")]
mod font_rendering;
mod frontend_log;
#[cfg(target_os = "linux")]
mod graphics;
mod ipc_error;
mod merge;
mod merge_requests;
#[cfg(test)]
mod mock_window;
mod outcome;
mod range;
mod review;
mod second_window;
mod servers;
mod settings;
mod start_script;
mod window;

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use specta_typescript::Typescript;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::filter::LevelFilter;

use crate::args::{Invocation, START_FOLDER, USAGE};
use crate::outcome::{Ending, Startup, startup};

const LOG_FILTER_VAR: &str = "YAMT_LOG";

#[must_use]
pub fn run() -> ExitCode {
    #[cfg(target_os = "linux")]
    graphics::disable_dmabuf_on_nvidia();
    init_tracing();
    match args::parse(std::env::args_os().skip(1).collect()) {
        Ok(Invocation::Help) => {
            print!("{USAGE}");
            ExitCode::SUCCESS
        }
        Ok(Invocation::Version) => {
            println!("yamt {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        Ok(Invocation::Compare { ai }) => {
            window::run_compare(&from_start_dir(PathBuf::from(START_FOLDER)), ai).report()
        }
        Ok(Invocation::Merge { repo }) => merge(&from_start_dir(repo)).report(),
        Ok(Invocation::Range { spec, repo, ai }) => {
            range::run_range(&from_start_dir(repo), &spec, ai).report()
        }
        Err(problem) => Ending::failure(format!("{problem}\n{USAGE}")).report(),
    }
}

/// A window's folder as given, read from where yamt was started: an `AppImage` runs inside its own mount.
fn from_start_dir(folder: PathBuf) -> PathBuf {
    #[cfg(target_os = "linux")]
    let folder = appimage::repo_from_start_dir(folder);
    folder
}

pub fn export_bindings(path: &Path) -> Result<(), specta_typescript::Error> {
    commands::specta_builder::<tauri::Wry>().export(Typescript::default(), path)
}

fn merge(repo: &Path) -> Ending {
    match startup(repo) {
        Startup::Merge { session, claim } => {
            let ending = window::run(session);
            drop(claim);
            ending
        }
        Startup::Done(ending) => ending,
    }
}

fn init_tracing() {
    let filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .with_env_var(LOG_FILTER_VAR)
        .from_env_lossy();
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outside_an_appimage_a_window_s_folder_stays_as_given() {
        assert_eq!(
            from_start_dir(PathBuf::from(START_FOLDER)),
            PathBuf::from(".")
        );
        assert_eq!(from_start_dir(PathBuf::from("sub")), PathBuf::from("sub"));
    }
}
