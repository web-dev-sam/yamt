use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;

use yamt_merge_requests::{OpenReply, RangeToOpen};

/// Starts a second yamt, `yamt --diff=<spec> --repo <root>`, on its own: in a process group of its own, so it
/// outlives this one and the terminal; a thread waits for its exit.
pub(crate) fn start(range: &RangeToOpen) -> OpenReply {
    let exe = match std::env::current_exe() {
        Ok(exe) => exe,
        Err(error) => {
            return OpenReply::StartFailed {
                message: format!("cannot find yamt's own program: {error}"),
            };
        }
    };
    let mut command = Command::new(program(running_appimage(), exe));
    command
        .arg(format!("--diff={}", range.spec))
        .arg("--repo")
        .arg(&range.root)
        .current_dir(&range.root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    detach(&mut command);
    tracing::info!(program = ?command.get_program(), spec = range.spec, "starting a range window");
    match command.spawn() {
        Ok(child) => {
            reap(child);
            OpenReply::Opened
        }
        Err(error) => OpenReply::StartFailed {
            message: format!("cannot start {}: {error}", command.get_program().display()),
        },
    }
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
fn detach(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
}

fn reap(mut child: Child) {
    thread::spawn(move || match child.wait() {
        Ok(status) => tracing::info!(%status, "a range window this one started ended"),
        Err(error) => tracing::warn!(%error, "a range window this one started was not waited for"),
    });
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::*;

    const EXE: &str = "/tmp/.mount_yamtAbC/usr/bin/yamt";
    const APPIMAGE: &str = "/home/sam/yamt.AppImage";
    const REAP_WAIT: Duration = Duration::from_secs(10);
    const POLL: Duration = Duration::from_millis(10);

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
