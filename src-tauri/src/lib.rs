//! Desktop shell: one window over a `MergeSession`, whose exit status says whether the merge is resolved, or
//! with `--diff` one compare window over the stored tabs.

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
#[cfg(test)]
mod mock_window;
mod outcome;
mod servers;
mod settings;
mod window;

use std::path::Path;
use std::process::ExitCode;

use specta_typescript::Typescript;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::filter::LevelFilter;

use crate::args::{Invocation, USAGE};
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
        Ok(Invocation::Compare) => window::run_compare().report(),
        Ok(Invocation::Merge { repo }) => {
            #[cfg(target_os = "linux")]
            let repo = appimage::repo_from_start_dir(repo);
            merge(&repo).report()
        }
        Err(problem) => Ending::failure(format!("{problem}\n{USAGE}")).report(),
    }
}

pub fn export_bindings(path: &Path) -> Result<(), specta_typescript::Error> {
    commands::specta_builder::<tauri::Wry>().export(Typescript::default(), path)
}

fn merge(repo: &Path) -> Ending {
    match startup(repo) {
        Startup::Merge(session) => window::run(session),
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
