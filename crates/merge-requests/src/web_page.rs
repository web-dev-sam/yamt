use std::process::{Command, Stdio};
use std::thread;

use crate::{MergeRequestIid, PageOpened, WebPage};

pub(crate) const HTTPS: &str = "https://";
const JOBS_SEGMENT: &str = "/-/jobs/";
const MERGE_REQUESTS_SEGMENT: &str = "/-/merge_requests/";
const PARENT_SEGMENT: &str = "..";
#[cfg(target_os = "macos")]
const OPENER: &str = "/usr/bin/open";
#[cfg(windows)]
const OPENER: &str = "rundll32.exe";
#[cfg(windows)]
const URL_HANDLER: &str = "url.dll,FileProtocolHandler";
/// xdg-open (xdg-utils), found on PATH: the desktop's default browser.
#[cfg(not(any(target_os = "macos", windows)))]
const OPENER: &str = "xdg-open";

impl WebPage {
    /// The job log page `web_path` (`/<full_path>/-/jobs/<id>`) names on the GitLab at `origin`; `None` for any
    /// other origin or path.
    pub(crate) fn job(origin: &str, web_path: &str) -> Option<WebPage> {
        let (project, job) = web_path.rsplit_once(JOBS_SEGMENT)?;
        let full_path = project.strip_prefix('/')?;
        if !is_number(job) {
            return None;
        }
        project_page(origin, full_path, &format!("{JOBS_SEGMENT}{job}"))
    }

    /// Merge request `iid`'s page of project `full_path` (`group/project`) on the GitLab at `origin`; `None` for
    /// any other origin or path.
    pub(crate) fn merge_request(
        origin: &str,
        full_path: &str,
        iid: MergeRequestIid,
    ) -> Option<WebPage> {
        let tail = format!("{MERGE_REQUESTS_SEGMENT}{}", iid.0);
        project_page(origin, full_path, &tail)
    }

    /// The page's address.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// `<origin>/<full_path><tail>` when `origin` is `https://<host[:port]>` and `full_path` a plain project path, so a
/// page never leaves the project's GitLab.
fn project_page(origin: &str, full_path: &str, tail: &str) -> Option<WebPage> {
    let authority = origin.strip_prefix(HTTPS)?;
    let is_page = is_authority(authority) && is_full_path(full_path);
    is_page.then(|| WebPage(format!("{origin}/{full_path}{tail}")))
}

/// Asks the system's browser to show `page`; the opener runs on its own, in a process group of its own on Unix so
/// it outlives this one and the terminal, and a thread waits for its exit.
#[must_use]
pub fn open_page(page: &WebPage) -> PageOpened {
    let mut command = opener(page.as_str());
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(unix)]
    detach(&mut command);
    tracing::info!(page = page.as_str(), "opening a GitLab page");
    match command.spawn() {
        Ok(mut child) => {
            thread::spawn(move || {
                if let Err(error) = child.wait() {
                    tracing::warn!(%error, "the GitLab page's opener was not waited for");
                }
            });
            PageOpened::Opened
        }
        Err(error) => PageOpened::Failed {
            message: format!("cannot start {}: {error}", command.get_program().display()),
        },
    }
}

#[cfg(not(windows))]
fn opener(url: &str) -> Command {
    let mut command = Command::new(OPENER);
    command.arg(url);
    command
}

// Windows passes arguments as one command line; `project_page` lets no space or quote in, so none needs quoting.
#[cfg(windows)]
fn opener(url: &str) -> Command {
    let mut command = Command::new(OPENER);
    command.args([URL_HANDLER, url]);
    command
}

#[cfg(unix)]
fn detach(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

fn is_authority(authority: &str) -> bool {
    let is_host_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':');
    !authority.is_empty() && authority.chars().all(is_host_char)
}

/// `<group>/<project>`: URL path characters only, no empty or `..` segment.
fn is_full_path(full_path: &str) -> bool {
    let is_path_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '~' | '-');
    let is_segment = |segment: &str| {
        !segment.is_empty() && segment != PARENT_SEGMENT && segment.chars().all(is_path_char)
    };
    full_path.split('/').all(is_segment)
}

fn is_number(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGIN: &str = "https://gitlab.example";
    const PAGE: &str = "https://gitlab.example/a/b/-/jobs/1";
    const IID: MergeRequestIid = MergeRequestIid(12);

    fn job(origin: &str, web_path: &str) -> Option<String> {
        WebPage::job(origin, web_path).map(|page| page.as_str().to_owned())
    }

    fn merge_request(origin: &str, full_path: &str) -> Option<String> {
        WebPage::merge_request(origin, full_path, IID).map(|page| page.as_str().to_owned())
    }

    #[test]
    fn a_job_path_on_an_https_gitlab_is_its_page() {
        let page = job(ORIGIN, "/taskboard/taskboard/-/jobs/301");
        assert_eq!(
            page.as_deref(),
            Some("https://gitlab.example/taskboard/taskboard/-/jobs/301")
        );
        let with_port = job("https://gitlab-2.example:8443", "/a/b.c_d~e-f/-/jobs/7");
        assert_eq!(
            with_port.as_deref(),
            Some("https://gitlab-2.example:8443/a/b.c_d~e-f/-/jobs/7")
        );
    }

    #[test]
    fn another_origin_or_an_odd_path_is_no_page() {
        let origins = [
            "http://gitlab.example",
            "https://",
            "https://sam@gitlab.example",
            "https://gitlab.example/",
        ];
        for origin in origins {
            assert_eq!(job(origin, "/a/b/-/jobs/1"), None, "{origin}");
        }
        let paths = [
            "//evil.example/a/-/jobs/1",
            "/a/../../b/-/jobs/1",
            "/a/-/jobs/1?x=1",
            "/a/-/jobs/1#log",
            "/a/-/jobs/",
            "/a/-/jobs/-1",
            "/a/-/pipelines/1",
            "a/-/jobs/1",
            "https://evil.example/a/-/jobs/1",
            "/-/jobs/1",
            "/a b/-/jobs/1",
        ];
        for path in paths {
            assert_eq!(job(ORIGIN, path), None, "{path}");
        }
    }

    #[test]
    fn a_merge_request_of_a_nested_project_on_an_https_gitlab_with_a_port_is_its_page() {
        let page = merge_request("https://gitlab-2.example:8443", "group/sub.group/b_c~d-e");
        assert_eq!(
            page.as_deref(),
            Some("https://gitlab-2.example:8443/group/sub.group/b_c~d-e/-/merge_requests/12")
        );
    }

    #[test]
    fn another_origin_or_an_odd_full_path_gives_a_merge_request_no_page() {
        let origins = [
            "http://gitlab.example",
            "https://",
            "https://sam@gitlab.example",
            "https://gitlab.example/",
        ];
        for origin in origins {
            assert_eq!(merge_request(origin, "a/b"), None, "{origin}");
        }
        let full_paths = [
            "", "/a/b", "a/b/", "a//b", "a/../b", "..", "a b/c", "a/b?x=1", "a/b#c", "a@b/c",
        ];
        for full_path in full_paths {
            assert_eq!(merge_request(ORIGIN, full_path), None, "{full_path}");
        }
    }

    fn program_and_args(command: &Command) -> Vec<&std::ffi::OsStr> {
        let mut words = vec![command.get_program()];
        words.extend(command.get_args());
        words
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_opens_a_page_with_open() {
        assert_eq!(program_and_args(&opener(PAGE)), ["/usr/bin/open", PAGE]);
    }

    #[cfg(windows)]
    #[test]
    fn windows_opens_a_page_with_the_url_protocol_handler() {
        assert_eq!(
            program_and_args(&opener(PAGE)),
            ["rundll32.exe", "url.dll,FileProtocolHandler", PAGE]
        );
    }

    #[cfg(not(any(target_os = "macos", windows)))]
    #[test]
    fn other_systems_open_a_page_with_xdg_open() {
        assert_eq!(program_and_args(&opener(PAGE)), ["xdg-open", PAGE]);
    }

    // A process group of its own: its id is the process's (setpgid(2) with pgid 0).
    #[cfg(unix)]
    #[test]
    fn a_detached_opener_leads_a_process_group_of_its_own() {
        let mut command = Command::new("sh");
        command.args(["-c", "ps -o pid= -o pgid= -p $$"]);
        detach(&mut command);

        let output = command.output().unwrap();

        let text = String::from_utf8(output.stdout).unwrap();
        let ids: Vec<&str> = text.split_whitespace().collect();
        assert_eq!(ids.len(), 2, "{text}");
        assert_eq!(ids[0], ids[1], "{text}");
    }
}
