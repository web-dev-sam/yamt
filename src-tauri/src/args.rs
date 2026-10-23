use std::ffi::OsString;
use std::path::PathBuf;

pub(crate) const USAGE: &str = "\
usage: yamt [--repo <path>]
       yamt --raw

Resolves the conflicted files of the merge in progress in <path> (default: the current directory).
With --raw, compares any two pasted texts in two columns: no repository needed, its tabs kept between runs.

  --repo <path>  any directory inside the work tree
  --raw          compare pasted texts instead of merging
  --help         print this help
  --version      print the version
";

const RAW_WITH_REPO: &str = "--raw compares pasted text and takes no --repo";

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Invocation {
    Merge { repo: PathBuf },
    Compare,
    Help,
    Version,
}

pub(crate) fn parse(args: Vec<OsString>) -> Result<Invocation, String> {
    let mut args = args.into_iter();
    let mut repo = None;
    let mut raw = false;
    while let Some(arg) = args.next() {
        match arg.to_str() {
            Some("--help") => return Ok(Invocation::Help),
            Some("--version") => return Ok(Invocation::Version),
            Some("--raw") => raw = true,
            Some("--repo") => {
                repo = Some(
                    args.next()
                        .map(PathBuf::from)
                        .ok_or("--repo needs a path")?,
                );
            }
            _ => return Err(format!("unknown argument {}", arg.to_string_lossy())),
        }
    }
    match (raw, repo) {
        (true, Some(_)) => Err(RAW_WITH_REPO.to_owned()),
        (true, None) => Ok(Invocation::Compare),
        (false, repo) => Ok(Invocation::Merge {
            repo: repo.unwrap_or_else(|| PathBuf::from(".")),
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
    fn raw_opens_the_compare_window() {
        assert_eq!(parsed(&["--raw"]), Ok(Invocation::Compare));
    }

    #[test]
    fn raw_with_a_repo_in_either_order_is_a_usage_error() {
        let refused = Err(RAW_WITH_REPO.to_owned());
        assert_eq!(parsed(&["--raw", "--repo", "p"]), refused);
        assert_eq!(parsed(&["--repo", "p", "--raw"]), refused);
    }

    #[test]
    fn help_wins_over_raw() {
        assert_eq!(parsed(&["--raw", "--help"]), Ok(Invocation::Help));
        assert_eq!(
            parsed(&["--raw", "--repo", "p", "--version"]),
            Ok(Invocation::Version)
        );
    }

    #[test]
    fn the_usage_names_raw() {
        assert!(USAGE.contains("       yamt --raw\n"), "{USAGE}");
        assert!(USAGE.contains("  --raw  "), "{USAGE}");
    }
}
