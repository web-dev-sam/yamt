use std::ffi::{OsStr, OsString};
use std::path::PathBuf;

use yamt_range::RangeSpec;

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
        marks: MarksOf,
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

/// What a range window's Reviewed marks belong to: its two sides by name, or the merge request `--review-of` names
/// (plan §2 #195).
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum MarksOf {
    SideNames,
    MergeRequest { project: String, iid: u32 },
}

impl MarksOf {
    fn with_review_of(self, text: &str) -> Result<MarksOf, String> {
        match self {
            MarksOf::SideNames => merge_request_marks(text),
            MarksOf::MergeRequest { .. } => Err(REVIEW_OF_TWICE.to_owned()),
        }
    }
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

fn merge_request_marks(text: &str) -> Result<MarksOf, String> {
    if let Some((project, iid)) = text.rsplit_once('!')
        && !project.is_empty()
        && let Ok(iid) = iid.parse::<u32>()
        && iid > 0
    {
        return Ok(MarksOf::MergeRequest {
            project: project.to_owned(),
            iid,
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
    let mut marks = Ok(MarksOf::SideNames);
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
                marks = marks.and_then(|marks| marks.with_review_of(review));
            }
            _ => return Err(format!("unknown argument {}", arg.to_string_lossy())),
        }
    }
    invocation(window?.started_on(start), repo, marks?, ai, start)
}

fn invocation(
    window: Window,
    repo: Option<PathBuf>,
    marks: MarksOf,
    ai: Ai,
    start: StartScreen,
) -> Result<Invocation, String> {
    match (window, repo, marks) {
        (Window::Compare | Window::Merge, _, MarksOf::MergeRequest { .. }) => {
            Err(REVIEW_OF_WITHOUT_RANGE.to_owned())
        }
        (Window::Compare, Some(_), MarksOf::SideNames) => Err(DIFF_WITH_REPO.to_owned()),
        (Window::Compare, None, MarksOf::SideNames) => Ok(Invocation::Compare { ai, start }),
        (Window::Range(spec), repo, marks) => Ok(Invocation::Range {
            spec,
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
            ai,
            start,
            marks,
        }),
        (Window::Merge, repo, MarksOf::SideNames) => Ok(Invocation::Merge {
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
        }),
    }
}

#[cfg(test)]
mod tests;
