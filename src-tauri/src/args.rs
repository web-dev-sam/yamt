use std::ffi::OsString;
use std::path::PathBuf;

use yamt_range::RangeSpec;

pub(crate) const USAGE: &str = "\
usage: yamt [--repo <path>]
       yamt --diff
       yamt --diff=<a>..<b> [--repo <path>]
       yamt --diff=<a>...<b> [--repo <path>]

Resolves the conflicted files of the merge in progress in <path> (default: the current directory).
With --diff, compares any two pasted texts in two columns: no repository needed, its tabs kept between runs.
With --diff=<range>, shows read-only what changed between two commits of the repository: a..b compares the
two commits, a...b compares where b branched off a with b (a merge request's changes). Either side is any
name git knows (branch, tag, commit id, HEAD~3); an empty side is HEAD.

  --repo <path>     any directory inside the work tree
  --diff            compare pasted texts instead of merging
  --diff=<range>    review a commit range
  --ai              with --diff=<range>: an AI agent answers review comments in its own checkout; with --diff or
                    --diff=<range>: the changes windows its merge-request page opens get it too
  --help            print this help
  --version         print the version
";

const DIFF_WITH_REPO: &str = "--diff compares pasted text and takes no --repo";
const DIFF_TWICE: &str = "give --diff or one --diff=<range>, not both";
const RANGE_FLAG: &str = "--diff=";
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
    },
    Range {
        spec: RangeSpec,
        repo: PathBuf,
        ai: Ai,
    },
    Help,
    Version,
}

/// `--ai`: accepted with every mode, kept by a range window and by the compare window for the range windows its
/// merge-request page opens (plan §2 #108, #144).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Ai {
    Off,
    On,
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
}

pub(crate) fn parse(args: Vec<OsString>) -> Result<Invocation, String> {
    let mut args = args.into_iter();
    let mut repo = None;
    let mut ai = Ai::Off;
    let mut window = Ok(Window::Merge);
    while let Some(arg) = args.next() {
        match arg.to_str() {
            Some("--help") => return Ok(Invocation::Help),
            Some("--version") => return Ok(Invocation::Version),
            Some("--diff") => window = window.and_then(Window::with_compare),
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
            _ => return Err(format!("unknown argument {}", arg.to_string_lossy())),
        }
    }
    match (window?, repo) {
        (Window::Compare, Some(_)) => Err(DIFF_WITH_REPO.to_owned()),
        (Window::Compare, None) => Ok(Invocation::Compare { ai }),
        (Window::Range(spec), repo) => Ok(Invocation::Range {
            spec,
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
            ai,
        }),
        (Window::Merge, repo) => Ok(Invocation::Merge {
            repo: repo.unwrap_or_else(|| PathBuf::from(START_FOLDER)),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed(args: &[&str]) -> Result<Invocation, String> {
        parse(args.iter().map(OsString::from).collect())
    }

    #[test]
    fn no_arguments_merge_in_the_current_directory() {
        assert_eq!(
            parsed(&[]),
            Ok(Invocation::Merge {
                repo: PathBuf::from(".")
            })
        );
    }

    #[test]
    fn repo_option_names_the_repository() {
        assert_eq!(
            parsed(&["--repo", "/tmp/some repo"]),
            Ok(Invocation::Merge {
                repo: PathBuf::from("/tmp/some repo")
            })
        );
    }

    #[test]
    fn repo_without_a_value_is_a_usage_error() {
        assert_eq!(parsed(&["--repo"]), Err("--repo needs a path".to_owned()));
    }

    #[test]
    fn unknown_flag_is_a_usage_error() {
        assert_eq!(
            parsed(&["--repo", "p", "--force"]),
            Err("unknown argument --force".to_owned())
        );
    }

    #[test]
    fn help_and_version_win_over_other_arguments() {
        assert_eq!(parsed(&["--repo", "p", "--help"]), Ok(Invocation::Help));
        assert_eq!(parsed(&["--version"]), Ok(Invocation::Version));
    }

    #[test]
    fn diff_opens_the_compare_window() {
        assert_eq!(parsed(&["--diff"]), Ok(Invocation::Compare { ai: Ai::Off }));
    }

    #[test]
    fn diff_with_a_repo_in_either_order_is_a_usage_error() {
        let refused = Err(DIFF_WITH_REPO.to_owned());
        assert_eq!(parsed(&["--diff", "--repo", "p"]), refused);
        assert_eq!(parsed(&["--repo", "p", "--diff"]), refused);
    }

    #[test]
    fn help_wins_over_diff() {
        assert_eq!(parsed(&["--diff", "--help"]), Ok(Invocation::Help));
        assert_eq!(
            parsed(&["--diff", "--repo", "p", "--version"]),
            Ok(Invocation::Version)
        );
    }

    #[test]
    fn help_wins_over_a_range_error() {
        assert_eq!(
            parsed(&["--diff", "--diff=a..b", "--help"]),
            Ok(Invocation::Help)
        );
        assert_eq!(
            parsed(&["--diff=main", "--version"]),
            Ok(Invocation::Version)
        );
    }

    #[test]
    fn the_usage_names_diff() {
        assert!(USAGE.contains("       yamt --diff\n"), "{USAGE}");
        assert!(USAGE.contains("  --diff  "), "{USAGE}");
    }

    fn range(text: &str, repo: &str) -> Invocation {
        Invocation::Range {
            spec: RangeSpec::parse(text).unwrap(),
            repo: PathBuf::from(repo),
            ai: Ai::Off,
        }
    }

    // A merge window that kept the flag would start an agent nobody can see.
    #[test]
    fn ai_is_accepted_with_every_mode_and_reaches_the_range_and_compare_windows() {
        let merge = Invocation::Merge {
            repo: PathBuf::from("p"),
        };
        assert_eq!(parsed(&["--ai", "--repo", "p"]), Ok(merge));
        assert_eq!(
            parsed(&["--diff", "--ai"]),
            Ok(Invocation::Compare { ai: Ai::On })
        );
        assert_eq!(
            parsed(&["--ai", "--diff"]),
            Ok(Invocation::Compare { ai: Ai::On })
        );
        assert_eq!(parsed(&["--ai", "--help"]), Ok(Invocation::Help));
        assert_eq!(parsed(&["--ai", "--version"]), Ok(Invocation::Version));
        let with_ai = Invocation::Range {
            spec: RangeSpec::parse("a...b").unwrap(),
            repo: PathBuf::from("."),
            ai: Ai::On,
        };
        assert_eq!(parsed(&["--diff=a...b", "--ai"]), Ok(with_ai));
        assert_eq!(parsed(&["--diff=a...b"]), Ok(range("a...b", ".")));
        assert!(USAGE.contains("  --ai              "), "{USAGE}");
    }

    #[test]
    fn a_range_takes_the_current_directory_or_a_repo_in_either_order() {
        assert_eq!(
            parsed(&["--diff=main...feature"]),
            Ok(range("main...feature", "."))
        );
        assert_eq!(
            parsed(&["--diff=a..b", "--repo", "p"]),
            Ok(range("a..b", "p"))
        );
        assert_eq!(
            parsed(&["--repo", "p", "--diff=a..b"]),
            Ok(range("a..b", "p"))
        );
    }

    #[test]
    fn each_malformed_range_is_its_usage_line() {
        let refusals = [
            ("--diff=", "--diff= needs a range, such as main...dev"),
            (
                "--diff=main",
                "--diff=main: a range needs two dots (a..b) or three (a...b); yamt does not compare the working tree",
            ),
            (
                "--diff=a....b",
                r#"--diff=a....b: a range holds one ".." or "...""#,
            ),
            (
                "--diff=a..b..c",
                r#"--diff=a..b..c: a range holds one ".." or "...""#,
            ),
            (
                "--diff=-x..b",
                r#"--diff=-x..b: a side may not start with "-""#,
            ),
        ];
        for (arg, line) in refusals {
            assert_eq!(parsed(&[arg]), Err(line.to_owned()), "{arg}");
        }
    }

    #[test]
    fn diff_and_a_range_or_two_ranges_are_a_usage_error() {
        let refused = Err("give --diff or one --diff=<range>, not both".to_owned());
        assert_eq!(parsed(&["--diff", "--diff=a..b"]), refused);
        assert_eq!(parsed(&["--diff=a..b", "--diff"]), refused);
        assert_eq!(parsed(&["--diff=a..b", "--diff=a..b"]), refused);
    }

    #[test]
    fn the_usage_names_the_range_forms() {
        assert!(
            USAGE.contains("       yamt --diff=<a>..<b> [--repo <path>]\n"),
            "{USAGE}"
        );
        assert!(
            USAGE.contains("       yamt --diff=<a>...<b> [--repo <path>]\n"),
            "{USAGE}"
        );
        assert!(USAGE.contains("  --diff=<range>    "), "{USAGE}");
    }
}
