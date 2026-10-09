use std::ffi::OsString;
use std::path::PathBuf;

use yamt_merge_core::Options;

use crate::{Error, Result};

const DEFAULT_REPO: &str = ".";
const DEFAULT_GOLDEN_DIR: &str = "tests/golden";

pub(crate) enum Command {
    Classify {
        sides: [PathBuf; 3],
        options: Options,
        json: bool,
    },
    Scan {
        repo: PathBuf,
    },
    GoldenRun {
        dir: PathBuf,
    },
    GoldenUpdate {
        dir: PathBuf,
    },
    Fixture {
        case_dir: PathBuf,
    },
}

pub(crate) fn parse(args: &[OsString]) -> Result<Command> {
    let args = utf8_args(args)?;
    let (command, rest) = args
        .split_first()
        .ok_or_else(|| usage("missing command".to_owned()))?;
    match command.as_str() {
        "classify" => parse_classify(rest),
        "scan" => Ok(Command::Scan {
            repo: optional_path(rest, DEFAULT_REPO)?,
        }),
        "golden" => parse_golden(rest),
        "fixture" => Ok(Command::Fixture {
            case_dir: required_path(rest, "<case-dir>")?,
        }),
        other => Err(usage(format!("unknown command `{other}`"))),
    }
}

fn utf8_args(args: &[OsString]) -> Result<Vec<String>> {
    let mut utf8 = Vec::with_capacity(args.len());
    for arg in args {
        let arg = arg
            .to_str()
            .ok_or_else(|| usage(format!("argument `{}` is not UTF-8", arg.to_string_lossy())))?;
        utf8.push(arg.to_owned());
    }
    Ok(utf8)
}

fn parse_classify(args: &[String]) -> Result<Command> {
    let mut paths = Vec::new();
    let mut options = Options::default();
    let mut json = false;
    let mut args = args.iter();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--json" => json = true,
            "--gap" => options.gap = parse_gap(args.next())?,
            flag if flag.starts_with("--") => {
                return Err(usage(format!("unknown option `{flag}`")));
            }
            path => paths.push(PathBuf::from(path)),
        }
    }
    let sides = <[PathBuf; 3]>::try_from(paths)
        .map_err(|_| usage("classify needs exactly <base> <local> <remote>".to_owned()))?;
    Ok(Command::Classify {
        sides,
        options,
        json,
    })
}

fn parse_gap(value: Option<&String>) -> Result<u32> {
    value
        .and_then(|value| value.parse().ok())
        .ok_or_else(|| usage("--gap needs a whole number of lines".to_owned()))
}

fn parse_golden(args: &[String]) -> Result<Command> {
    let (action, rest) = args
        .split_first()
        .ok_or_else(|| usage("golden needs `run` or `update`".to_owned()))?;
    let dir = optional_path(rest, DEFAULT_GOLDEN_DIR)?;
    match action.as_str() {
        "run" => Ok(Command::GoldenRun { dir }),
        "update" => Ok(Command::GoldenUpdate { dir }),
        other => Err(usage(format!("unknown golden action `{other}`"))),
    }
}

fn optional_path(args: &[String], default: &str) -> Result<PathBuf> {
    match args {
        [] => Ok(PathBuf::from(default)),
        [path] => Ok(PathBuf::from(path)),
        [_, extra, ..] => Err(usage(format!("unexpected argument `{extra}`"))),
    }
}

fn required_path(args: &[String], name: &str) -> Result<PathBuf> {
    match args {
        [] => Err(usage(format!("missing {name}"))),
        [path] => Ok(PathBuf::from(path)),
        [_, extra, ..] => Err(usage(format!("unexpected argument `{extra}`"))),
    }
}

fn usage(problem: String) -> Error {
    Error::Usage { problem }
}
