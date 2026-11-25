use std::ffi::{OsStr, OsString};
use std::path::PathBuf;

use yamt_range::{MergeRequestNames, RangeSpec};

pub(crate) const USAGE: &str = "\
usage: yamt [--repo <path>]
       yamt --mr
       yamt --diff [--mr]
       yamt --diff=<a>..<b> [--repo <path>] [--mr]
       yamt --diff=<a>...<b> [--repo <path>] [--mr]

Resolves the conflicted files of the merge in progress in <path> (default: the current directory).
With --diff, compares any two pasted texts in two columns: no repository needed, its tabs kept between runs.
With --diff=<range>, shows read-only what changed between two commits of the repository: a..b compares the
two commits, a...b compares where b branched off a with b (a merge request's changes). Either side is any
name git knows (branch, tag, commit id, HEAD~3); an empty side is HEAD.

  --repo <path>     any directory inside the work tree
  --diff            compare pasted texts instead of merging
  --diff=<range>    review a commit range
  --mr              open the merge-request page at start; without --diff=<range> it means --diff
  --ai              with --diff=<range>: an AI agent answers review comments in its own checkout; with --diff or
                    --diff=<range>: the changes windows its merge-request page opens get it too
  --review-of=<project>!<iid>  with --diff=<range>: remember Reviewed marks for this merge request
                    (the merge-request page passes it)
  --mr-title=<text> --mr-source=<branch> --mr-target=<branch>
                    with --review-of: the merge request's title and branches the window shows
                    (the merge-request page passes them)
  YAMT_AI=1         in the environment: every start behaves as with --ai (unset, empty or 0: off)
  --help            print this help
  --version         print the version
";

const DIFF_WITH_REPO: &str = "--diff compares pasted text and takes no --repo";
const DIFF_TWICE: &str = "give --diff or one --diff=<range>, not both";
const RANGE_FLAG: &str = "--diff=";
const REVIEW_OF_FLAG: &str = "--review-of=";
const REVIEW_OF_WITHOUT_RANGE: &str = "--review-of goes with --diff=<range>";
const REVIEW_OF_TWICE: &str = "give one --review-of=<project>!<iid>";
const MR_TITLE_FLAG: &str = "--mr-title=";
const MR_SOURCE_FLAG: &str = "--mr-source=";
const MR_TARGET_FLAG: &str = "--mr-target=";
const MR_NAMES_APART: &str = "give --mr-title, --mr-source and --mr-target together, each once";
const MR_NAMES_WITHOUT_REVIEW_OF: &str =
    "--mr-title, --mr-source and --mr-target go with --review-of=<project>!<iid>";
/// The folder yamt was started in: a merge's or range's repository unless `--repo` names one, and where the
/// compare window's merge-request page looks for a repository (plan §2 #94 as amended for #128–#135).
pub(crate) const START_FOLDER: &str = ".";

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Invocation {
    Merge {
        repo: PathBuf,
    },
    Compare {
        ai: Ai,
        start: StartScreen,
    },
    Range {
        spec: RangeSpec,
        repo: PathBuf,
        ai: Ai,
        start: StartScreen,
        range_of: RangeOf,
    },
    Help,
    Version,
}

/// `--ai` or `YAMT_AI`: accepted with every mode, kept by a range window and by the compare window for the range
/// windows its merge-request page opens (plan §2 #108, #144).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Ai {
    Off,
    On,
}

/// `--mr`: the compare or range window opens on its merge-request page instead of its files.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum StartScreen {
    Files,
    MergeRequests,
}

/// What a range window is of: its two sides by name, or a merge request's changes (`--review-of`), which its Reviewed
/// marks and its heading follow (plan §2 #195, #199).
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RangeOf {
    SideNames,
    MergeRequest {
        project: String,
        iid: u32,
        names: Option<MergeRequestNames>,
    },
}

impl RangeOf {
    fn with_review_of(self, text: &str) -> Result<RangeOf, String> {
        match self {
            RangeOf::SideNames => merge_request_of(text),
            RangeOf::MergeRequest { .. } => Err(REVIEW_OF_TWICE.to_owned()),
        }
    }

    fn named(self, names: Option<MergeRequestNames>) -> Result<RangeOf, String> {
        match (self, names) {
            (range_of, None) => Ok(range_of),
            (RangeOf::MergeRequest { project, iid, .. }, Some(names)) => {
                Ok(RangeOf::MergeRequest {
                    project,
                    iid,
                    names: Some(names),
                })
            }
            (RangeOf::SideNames, Some(_)) => Err(MR_NAMES_WITHOUT_REVIEW_OF.to_owned()),
        }
    }
}

/// Which of the three `--mr-*` flags an argument is.
#[derive(Clone, Copy)]
enum NameFlag {
    Title,
    Source,
    Target,
}

/// The `--mr-*` flags seen so far, each at most once.
#[derive(Default)]
struct NameFlags {
    title: Option<String>,
    source: Option<String>,
    target: Option<String>,
}

impl NameFlags {
    fn with(mut self, flag: NameFlag, value: &str) -> Result<NameFlags, String> {
        let held = match flag {
            NameFlag::Title => &mut self.title,
            NameFlag::Source => &mut self.source,
            NameFlag::Target => &mut self.target,
        };
        if held.is_some() {
            return Err(MR_NAMES_APART.to_owned());
        }
        *held = Some(value.to_owned());
        Ok(self)
    }

    fn names(self) -> Result<Option<MergeRequestNames>, String> {
        match (self.title, self.source, self.target) {
            (Some(title), Some(source), Some(target)) => Ok(Some(MergeRequestNames {
                title,
                source,
                target,
            })),
            (None, None, None) => Ok(None),
            _ => Err(MR_NAMES_APART.to_owned()),
        }
    }
}

/// The flag `arg` is, and its value: everything after the prefix.
fn name_flag(arg: &str) -> Option<(NameFlag, &str)> {
    let flags = [
        (MR_TITLE_FLAG, NameFlag::Title),
        (MR_SOURCE_FLAG, NameFlag::Source),
        (MR_TARGET_FLAG, NameFlag::Target),
    ];
    flags
        .into_iter()
        .find_map(|(prefix, flag)| Some((flag, arg.strip_prefix(prefix)?)))
}

/// What the `--diff` flags seen so far ask for.
enum Window {
    Merge,
    Compare,
    Range(RangeSpec),
}

impl Window {
    fn with_compare(self) -> Result<Window, String> {
        match self {
            Window::Merge | Window::Compare => Ok(Window::Compare),
            Window::Range(_) => Err(DIFF_TWICE.to_owned()),
        }
    }

    fn with_range(self, text: &str) -> Result<Window, String> {
        match self {
            Window::Merge => RangeSpec::parse(text)
                .map(Window::Range)
                .map_err(|error| error.to_string()),
            Window::Compare | Window::Range(_) => Err(DIFF_TWICE.to_owned()),
        }
    }

    fn started_on(self, start: StartScreen) -> Window {
        match (self, start) {
            (Window::Merge, StartScreen::MergeRequests) => Window::Compare,
            (window, StartScreen::Files | StartScreen::MergeRequests) => window,
        }
    }
}

fn ai_from_variable(value: Option<&OsStr>) -> Ai {
    match value {
        None => Ai::Off,
        Some(value) if value.is_empty() || value == "0" => Ai::Off,
        Some(_) => Ai::On,
    }
}

fn merge_request_of(text: &str) -> Result<RangeOf, String> {
    if let Some((project, iid)) = text.rsplit_once('!')
        && !project.is_empty()
        && let Ok(iid) = iid.parse::<u32>()
        && iid > 0
    {
        return Ok(RangeOf::MergeRequest {
            project: project.to_owned(),
            iid,
            names: None,
        });
    }
    Err(format!(
        "{REVIEW_OF_FLAG}{text}: give <group/project>!<iid>"
    ))
}

pub(crate) fn parse(
    args: Vec<OsString>,
    ai_variable: Option<&OsStr>,
) -> Result<Invocation, String> {
    let mut args = args.into_iter();
    let mut repo = None;
    let mut ai = ai_from_variable(ai_variable);
    let mut start = StartScreen::Files;
    let mut window = Ok(Window::Merge);
    let mut range_of = Ok(RangeOf::SideNames);
    let mut names = Ok(NameFlags::default());
    while let Some(arg) = args.next() {
        match arg.to_str() {
            Some("--help") => return Ok(Invocation::Help),
            Some("--version") => return Ok(Invocation::Version),
            Some("--diff") => window = window.and_then(Window::with_compare),
            Some("--mr") => start = StartScreen::MergeRequests,
            Some("--ai") => ai = Ai::On,
            Some("--repo") => {
                repo = Some(
                    args.next()
                        .map(PathBuf::from)
                        .ok_or("--repo needs a path")?,
                );
            }
            Some(text) if let Some(range) = text.strip_prefix(RANGE_FLAG) => {
                window = window.and_then(|window| window.with_range(range));
            }
            Some(text) if let Some(review) = text.strip_prefix(REVIEW_OF_FLAG) => {
                range_of = range_of.and_then(|range_of| range_of.with_review_of(review));
            }
            Some(text) if let Some((flag, value)) = name_flag(text) => {
                names = names.and_then(|names| names.with(flag, value));
            }
            _ => return Err(format!("unknown argument {}", arg.to_string_lossy())),
        }
    }
    let range_of = range_of?.named(names?.names()?)?;
    invocation(window?.started_on(start), repo, range_of, ai, start)
}

fn invocation(
    window: Window,
    repo: Option<PathBuf>,
    range_of: RangeOf,
    ai: Ai,
    start: StartScreen,
) -> Result<Invocation, String> {
    match (window, repo, range_of) {
        (Window::Compare | Window::Merge, _, RangeOf::MergeRequest { .. }) => {
            Err(REVIEW_OF_WITHOUT_RANGE.to_owned())
        }
        (Window::Compare, Some(_), RangeOf::SideNames) => Err(DIFF_WITH_REPO.to_owned()),
        (Window::Compare, None, RangeOf::SideNames) => Ok(Invocation::Compare { ai, start }),
        (Window::Range(spec), repo, range_of) => Ok(Invocation::Range {
            spec,
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
            ai,
            start,
            range_of,
        }),
        (Window::Merge, repo, RangeOf::SideNames) => Ok(Invocation::Merge {
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
        }),
    }
}

#[cfg(test)]
mod tests;
