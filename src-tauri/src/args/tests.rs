use super::*;

fn parsed(args: &[&str]) -> Result<Invocation, String> {
    parsed_with_variable(args, None)
}

fn parsed_with_variable(args: &[&str], ai_variable: Option<&str>) -> Result<Invocation, String> {
    parse(
        args.iter().map(OsString::from).collect(),
        ai_variable.map(OsStr::new),
    )
}

fn compare(ai: Ai, start: StartScreen) -> Invocation {
    Invocation::Compare { ai, start }
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
    assert_eq!(
        parsed(&["--diff"]),
        Ok(compare(Ai::Off, StartScreen::Files))
    );
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
    assert!(USAGE.contains("       yamt --diff [--mr]\n"), "{USAGE}");
    assert!(USAGE.contains("  --diff  "), "{USAGE}");
}

fn range(text: &str, repo: &str) -> Invocation {
    range_on(text, repo, StartScreen::Files)
}

fn range_on(text: &str, repo: &str, start: StartScreen) -> Invocation {
    Invocation::Range {
        spec: RangeSpec::parse(text).unwrap(),
        repo: PathBuf::from(repo),
        ai: Ai::Off,
        start,
        marks: MarksOf::SideNames,
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
        Ok(compare(Ai::On, StartScreen::Files))
    );
    assert_eq!(
        parsed(&["--ai", "--diff"]),
        Ok(compare(Ai::On, StartScreen::Files))
    );
    assert_eq!(parsed(&["--ai", "--help"]), Ok(Invocation::Help));
    assert_eq!(parsed(&["--ai", "--version"]), Ok(Invocation::Version));
    let with_ai = Invocation::Range {
        spec: RangeSpec::parse("a...b").unwrap(),
        repo: PathBuf::from("."),
        ai: Ai::On,
        start: StartScreen::Files,
        marks: MarksOf::SideNames,
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
        USAGE.contains("       yamt --diff=<a>..<b> [--repo <path>] [--mr]\n"),
        "{USAGE}"
    );
    assert!(
        USAGE.contains("       yamt --diff=<a>...<b> [--repo <path>] [--mr]\n"),
        "{USAGE}"
    );
    assert!(USAGE.contains("  --diff=<range>    "), "{USAGE}");
}

#[test]
fn mr_alone_or_with_diff_in_either_order_opens_the_compare_window_on_its_page() {
    let on_the_page = Ok(compare(Ai::Off, StartScreen::MergeRequests));
    assert_eq!(parsed(&["--mr"]), on_the_page);
    assert_eq!(parsed(&["--diff", "--mr"]), on_the_page);
    assert_eq!(parsed(&["--mr", "--diff"]), on_the_page);
    assert_eq!(parsed(&["--mr", "--mr"]), on_the_page);
}

#[test]
fn mr_with_a_range_opens_the_range_window_on_its_page() {
    assert_eq!(
        parsed(&["--diff=a..b", "--mr"]),
        Ok(range_on("a..b", ".", StartScreen::MergeRequests))
    );
    assert_eq!(
        parsed(&["--mr", "--diff=a..b", "--repo", "p"]),
        Ok(range_on("a..b", "p", StartScreen::MergeRequests))
    );
}

#[test]
fn mr_with_a_repo_and_no_range_is_refused_as_diff_with_a_repo() {
    let refused = Err(DIFF_WITH_REPO.to_owned());
    assert_eq!(parsed(&["--mr", "--repo", "p"]), refused);
    assert_eq!(parsed(&["--repo", "p", "--mr"]), refused);
}

#[test]
fn help_and_version_win_over_mr() {
    assert_eq!(parsed(&["--mr", "--help"]), Ok(Invocation::Help));
    assert_eq!(parsed(&["--mr", "--version"]), Ok(Invocation::Version));
}

#[test]
fn the_usage_names_mr() {
    assert!(USAGE.contains("       yamt --mr\n"), "{USAGE}");
    assert!(USAGE.contains("  --mr              "), "{USAGE}");
}

#[test]
fn review_of_with_a_range_names_the_merge_request_s_marks() {
    let marked = |project: &str, iid| Invocation::Range {
        spec: RangeSpec::parse("a..b").unwrap(),
        repo: PathBuf::from("."),
        ai: Ai::Off,
        start: StartScreen::Files,
        marks: MarksOf::MergeRequest {
            project: project.to_owned(),
            iid,
        },
    };
    assert_eq!(
        parsed(&["--diff=a..b", "--review-of=group/sub/project!12"]),
        Ok(marked("group/sub/project", 12))
    );
    assert_eq!(
        parsed(&["--review-of=g/p!7", "--diff=a..b"]),
        Ok(marked("g/p", 7))
    );
    assert_eq!(
        parsed(&["--diff=a..b", "--review-of=g!p!3"]),
        Ok(marked("g!p", 3))
    );
}

#[test]
fn review_of_without_a_range_or_malformed_is_refused() {
    let without_range = Err(REVIEW_OF_WITHOUT_RANGE.to_owned());
    assert_eq!(parsed(&["--review-of=g/p!1"]), without_range);
    assert_eq!(parsed(&["--diff", "--review-of=g/p!1"]), without_range);
    assert_eq!(parsed(&["--review-of=g/p!1", "--mr"]), without_range);
    assert_eq!(parsed(&["--review-of=g/p!1", "--repo", "p"]), without_range);
    for text in ["g/p", "!3", "g/p!0", "g/p!x", "g/p!"] {
        let flag = format!("--review-of={text}");
        let refused = Err(format!("{flag}: give <group/project>!<iid>"));
        assert_eq!(parsed(&["--diff=a..b", &flag]), refused, "{text}");
    }
    assert_eq!(
        parsed(&["--diff=a..b", "--review-of=g/p", "--help"]),
        Ok(Invocation::Help)
    );
}

#[test]
fn a_second_review_of_is_refused_as_a_second_range_is() {
    let refused = Err("give one --review-of=<project>!<iid>".to_owned());
    for second in ["--review-of=g/p!2", "--review-of=g/p!1"] {
        let args = ["--diff=a..b", "--review-of=g/p!1", second];
        assert_eq!(parsed(&args), refused, "{second}");
    }
}

#[test]
fn the_usage_names_review_of() {
    assert!(
        USAGE.contains("  --review-of=<project>!<iid>  with --diff=<range>: "),
        "{USAGE}"
    );
}

#[test]
fn yamt_ai_unset_empty_or_zero_is_off_and_any_other_value_on() {
    let cases = [
        (None, Ai::Off),
        (Some(""), Ai::Off),
        (Some("0"), Ai::Off),
        (Some("1"), Ai::On),
        (Some("yes"), Ai::On),
    ];
    for (variable, ai) in cases {
        assert_eq!(
            parsed_with_variable(&["--diff"], variable),
            Ok(compare(ai, StartScreen::Files)),
            "{variable:?}"
        );
    }
    assert!(USAGE.contains("  YAMT_AI=1         "), "{USAGE}");
}

#[test]
fn ai_flag_wins_over_yamt_ai_zero() {
    assert_eq!(
        parsed_with_variable(&["--diff", "--ai"], Some("0")),
        Ok(compare(Ai::On, StartScreen::Files))
    );
}

#[cfg(unix)]
#[test]
fn yamt_ai_that_is_not_utf8_is_on() {
    use std::os::unix::ffi::OsStrExt;
    let variable = OsStr::from_bytes(&[0xff]);
    assert_eq!(
        parse(vec![OsString::from("--diff")], Some(variable)),
        Ok(compare(Ai::On, StartScreen::Files))
    );
}
