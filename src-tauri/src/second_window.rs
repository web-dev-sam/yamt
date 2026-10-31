use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;

use yamt_merge_requests::{OpenReply, RangeToOpen};

use crate::args::Ai;

/// Starts a second yamt on the range, `yamt --diff=<spec> --repo <root>`, with `--ai` when `ai` is on.
pub(crate) fn start_range(range: &RangeToOpen, ai: Ai) -> OpenReply {
    match spawn(range_arguments(range, ai), &range.root) {
        Ok(()) => OpenReply::Opened,
        Err(message) => OpenReply::StartFailed { message },
    }
}

/// Starts a second yamt on the merge in `root`, `yamt --repo <root>`; `Err` is why it did not start.
pub(crate) fn start_merge(root: &Path) -> Result<(), String> {
    spawn(merge_arguments(root), root)
}

/// Starts yamt with `arguments` in `root` on its own: in a process group of its own, so it outlives this one and
/// the terminal; a thread waits for its exit.
fn spawn(arguments: Vec<OsString>, root: &Path) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|error| format!("cannot find yamt's own program: {error}"))?;
    let mut command = Command::new(program(running_appimage(), exe));
    command
        .args(arguments)
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    detach(&mut command);
    tracing::info!(program = ?command.get_program(), arguments = ?command.get_args(), "starting a second window");
    let child = command
        .spawn()
        .map_err(|error| format!("cannot start {}: {error}", command.get_program().display()))?;
    reap(child);
    Ok(())
}

fn range_arguments(range: &RangeToOpen, ai: Ai) -> Vec<OsString> {
    let mut arguments = vec![
        format!("--diff={}", range.spec).into(),
        "--repo".into(),
        range.root.clone().into(),
    ];
    match ai {
        Ai::Off => {}
        Ai::On => arguments.push("--ai".into()),
    }
    arguments
}

fn merge_arguments(root: &Path) -> Vec<OsString> {
    vec!["--repo".into(), root.into()]
}

/// The program a second yamt runs: the `AppImage` file when this one runs from it, else this binary.
fn program(appimage: Option<PathBuf>, exe: PathBuf) -> PathBuf {
    appimage.unwrap_or(exe)
}

#[cfg(target_os = "linux")]
fn running_appimage() -> Option<PathBuf> {
    crate::appimage::running_appimage()
}

#[cfg(not(target_os = "linux"))]
fn running_appimage() -> Option<PathBuf> {
    None
}

#[cfg(unix)]
fn detach(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

// Process creation flags (Microsoft Learn, "Process Creation Flags"): no console of the parent's, and a group of
// its own, so closing the parent's console does not end it.
#[cfg(windows)]
const DETACHED_PROCESS: u32 = 0x0000_0008;
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
#[cfg(windows)]
const DETACH_FLAGS: u32 = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP;

#[cfg(windows)]
fn detach(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(DETACH_FLAGS);
}

fn reap(mut child: Child) {
    thread::spawn(move || match child.wait() {
        Ok(status) => tracing::info!(%status, "a window this one started ended"),
        Err(error) => tracing::warn!(%error, "a window this one started was not waited for"),
    });
}

#[cfg(test)]
mod tests {
    use yamt_range::RangeSpec;

    use super::*;
    use crate::args::Invocation;

    const EXE: &str = "/tmp/.mount_yamtAbC/usr/bin/yamt";
    const APPIMAGE: &str = "/home/sam/yamt.AppImage";
    const ROOT: &str = "/home/sam/taskboard";
    const SPEC: &str =
        "531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19";

    #[test]
    fn the_second_yamt_is_asked_for_the_range_in_its_repository_with_the_windows_ai() {
        let range = RangeToOpen {
            root: ROOT.into(),
            spec: SPEC.to_owned(),
        };
        for ai in [Ai::Off, Ai::On] {
            let invocation = crate::args::parse(range_arguments(&range, ai));

            let wanted = Invocation::Range {
                spec: RangeSpec::parse(SPEC).unwrap(),
                repo: ROOT.into(),
                ai,
            };
            assert_eq!(invocation, Ok(wanted), "{ai:?}");
        }
    }

    #[test]
    fn the_second_yamt_is_asked_for_the_merge_in_its_repository() {
        let arguments = merge_arguments(Path::new(ROOT));

        assert_eq!(arguments, [OsString::from("--repo"), OsString::from(ROOT)]);
        let wanted = Invocation::Merge { repo: ROOT.into() };
        assert_eq!(crate::args::parse(arguments), Ok(wanted));
    }

    #[test]
    fn a_merge_window_that_cannot_start_answers_why() {
        let folder = yamt_conflict_repo::TempDir::new().unwrap();
        let missing = folder.path().join("missing");

        let message = start_merge(&missing).unwrap_err();

        assert!(message.starts_with("cannot start "), "{message}");
    }

    #[test]
    fn a_second_yamt_starts_from_the_appimage_when_there_is_one() {
        assert_eq!(
            program(Some(APPIMAGE.into()), EXE.into()),
            PathBuf::from(APPIMAGE)
        );
        assert_eq!(program(None, EXE.into()), PathBuf::from(EXE));
    }

    #[test]
    fn outside_an_appimage_a_second_yamt_starts_from_this_binary() {
        assert_eq!(running_appimage(), None);
    }

    #[cfg(target_os = "linux")]
    mod inside_an_appimage {
        use yamt_conflict_repo::run_ignored_in_child;

        use super::*;

        const CHOICE_TEST: &str =
            "second_window::tests::inside_an_appimage::the_program_is_the_appimage_file";

        #[test]
        fn a_second_yamt_starts_from_the_appimage_file_its_variables_name() {
            let exe = std::env::current_exe().unwrap();
            let appdir = exe.parent().unwrap().to_owned();

            let ran = run_ignored_in_child(&[CHOICE_TEST], |child| {
                child.env("APPIMAGE", APPIMAGE).env("APPDIR", appdir);
            });

            ran.unwrap_or_else(|error| panic!("{error}"));
        }

        #[test]
        #[ignore = "run by a_second_yamt_starts_from_the_appimage_file_its_variables_name"]
        fn the_program_is_the_appimage_file() {
            let exe = std::env::current_exe().unwrap();

            assert_eq!(program(running_appimage(), exe), PathBuf::from(APPIMAGE));
        }
    }

    #[cfg(windows)]
    #[test]
    fn the_detach_flags_are_detached_process_and_a_new_process_group() {
        assert_eq!(DETACH_FLAGS, 0x0000_0208);
    }

    // A process group of its own: its id is the process's (setpgid(2) with pgid 0).
    #[cfg(unix)]
    #[test]
    fn a_detached_child_leads_a_process_group_of_its_own() {
        let mut command = Command::new("sh");
        command.args(["-c", "ps -o pid= -o pgid= -p $$"]);
        detach(&mut command);

        let output = command.output().unwrap();

        let text = String::from_utf8(output.stdout).unwrap();
        let ids: Vec<&str> = text.split_whitespace().collect();
        assert_eq!(ids.len(), 2, "{text}");
        assert_eq!(ids[0], ids[1], "{text}");
    }

    // An exited child stays in /proc as a zombie (proc(5), state Z) until its parent waits for it.
    #[cfg(target_os = "linux")]
    #[test]
    fn a_started_child_that_exits_is_waited_for() {
        use std::time::{Duration, Instant};
        const REAP_WAIT: Duration = Duration::from_secs(10);
        const POLL: Duration = Duration::from_millis(10);
        let child = Command::new("true").spawn().unwrap();
        let stat = PathBuf::from(format!("/proc/{}/stat", child.id()));

        reap(child);

        let deadline = Instant::now() + REAP_WAIT;
        while std::fs::read_to_string(&stat).is_ok() {
            assert!(Instant::now() < deadline, "never waited for");
            thread::sleep(POLL);
        }
    }
}
