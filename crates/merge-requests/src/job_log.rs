use serde::Serialize;
use specta::Type;
use yamt_gitio::Glab;

use crate::project::{Project, logged_in_project};
use crate::web_page::is_web_path;
use crate::{GitLabRepository, WebPage};

/// The most of a log the window shows: GitLab's job page shows the same tail (`Gitlab::Ci::Trace::Stream::LIMIT_SIZE`,
/// 500 KiB).
pub const MAX_LOG_BYTES: usize = 500 * 1024;
/// glab's last line for an HTTP 404 ends so (`tests/glab/README.md`); GitLab answers 404 for a job without a log.
const NOT_FOUND: &str = "(HTTP 404)";
pub(crate) const ESCAPED_SLASH: &str = "%2F";

/// A failed job's log as the window shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobLog {
    /// The log as GitLab stores it, colour codes and all; bytes that are not UTF-8 read as U+FFFD.
    pub text: String,
    /// Whether earlier lines were left out: the log was longer than `MAX_LOG_BYTES`.
    pub cut: bool,
}

/// How asking for a failed job's log ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum JobLogReply {
    /// GitLab's log of the job.
    Log {
        /// The log.
        log: JobLog,
    },
    /// This window's list never offered that job page (or the page is no job's), so nothing was asked.
    NotOffered,
    /// GitLab has no log for the job: an empty answer or HTTP 404.
    NoLog,
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab failed, timed out or answered something unexpected, in glab's or yamt's words.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// `page`'s log, read through glab in the repository's root: a page that is no job's is `NotOffered` before any glab
/// run; the log is asked from the job's own project, read whole, and cut as GitLab's job page cuts it.
pub fn read_job_log(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    page: &WebPage,
) -> JobLogReply {
    let read = trace(repository, glab, page);
    let bytes = read.as_ref().map_or(0, Vec::len);
    let reply = match read {
        Ok(trace) => log_reply(&trace),
        Err(reply) => reply,
    };
    let cut = matches!(&reply, JobLogReply::Log { log } if log.cut);
    tracing::info!(
        page = page.as_str(),
        outcome = outcome(&reply),
        bytes,
        cut,
        "read a failed job's log"
    );
    reply
}

/// The job's log as glab printed it, or the reply when there is none to read.
fn trace(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    page: &WebPage,
) -> Result<Vec<u8>, JobLogReply> {
    let Some(glab) = glab else {
        return Err(JobLogReply::GlabMissing);
    };
    if page.job_parts().is_none() {
        return Err(JobLogReply::NotOffered);
    }
    let root = repository.root();
    let project = logged_in_project(glab, root).map_err(JobLogReply::from)?;
    let route = trace_route(&project, page).ok_or(JobLogReply::NotOffered)?;
    glab.get(root, &["api", &route]).map_err(failure_reply)
}

fn log_reply(trace: &[u8]) -> JobLogReply {
    if trace.is_empty() {
        return JobLogReply::NoLog;
    }
    JobLogReply::Log { log: tail(trace) }
}

fn failure_reply(line: String) -> JobLogReply {
    if line.ends_with(NOT_FOUND) {
        return JobLogReply::NoLog;
    }
    JobLogReply::Failed { message: line }
}

/// GitLab's `Stream#limit`: at most `MAX_LOG_BYTES` → the whole log; more → from just after the first `\n` at or
/// after `len − MAX_LOG_BYTES` to the end, so the line the cut lands in is dropped even when the cut lands on a line
/// start; no `\n` there → empty. Then lossy UTF-8.
pub(crate) fn tail(bytes: &[u8]) -> JobLog {
    let cut = bytes.len() > MAX_LOG_BYTES;
    let kept = if cut {
        let last = bytes.get(bytes.len() - MAX_LOG_BYTES..).unwrap_or_default();
        after_first_line_break(last)
    } else {
        bytes
    };
    JobLog {
        text: String::from_utf8_lossy(kept).into_owned(),
        cut,
    }
}

fn after_first_line_break(bytes: &[u8]) -> &[u8] {
    let line_break = bytes.iter().position(|&byte| byte == b'\n');
    line_break
        .and_then(|at| bytes.get(at + 1..))
        .unwrap_or_default()
}

/// `projects/<the job's project path with "/" as "%2F">/jobs/<n>/trace` for the page `<origin><path>/-/jobs/<n>`:
/// `<path>` without the sub-path GitLab is installed under when it starts with it. `None` when `page` is no job page
/// or its origin is not the project's. A fork's pipeline names the fork.
pub(crate) fn trace_route(project: &Project, page: &WebPage) -> Option<String> {
    let (before, job) = page.job_parts()?;
    let path = before.strip_prefix(project.web_origin.as_deref()?)?;
    if !is_web_path(path) {
        return None;
    }
    let in_project = path
        .strip_prefix(sub_path(project))
        .filter(|rest| rest.starts_with('/'))
        .unwrap_or(path);
    let project_path = in_project.strip_prefix('/')?;
    let escaped = project_path.replace('/', ESCAPED_SLASH);
    Some(format!("projects/{escaped}/jobs/{job}/trace"))
}

/// What GitLab is installed under: the project's web path without `/<full_path>`; empty when not under one.
fn sub_path(project: &Project) -> &str {
    let web_path = project.web_path.strip_suffix(project.full_path.as_str());
    web_path
        .and_then(|rest| rest.strip_suffix('/'))
        .unwrap_or_default()
}

/// The reply's kind, as the log names it: never the log's text.
fn outcome(reply: &JobLogReply) -> &'static str {
    match reply {
        JobLogReply::Log { .. } => "log",
        JobLogReply::NotOffered => "notOffered",
        JobLogReply::NoLog => "noLog",
        JobLogReply::GlabMissing => "glabMissing",
        JobLogReply::NotLoggedIn { .. } => "notLoggedIn",
        JobLogReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGIN: &str = "https://gitlab.example";

    fn project(web_path: &str) -> Project {
        Project {
            full_path: "taskboard/taskboard".to_owned(),
            web_path: web_path.to_owned(),
            web_origin: Some(ORIGIN.to_owned()),
        }
    }

    fn route(project: &Project, page: &str) -> Option<String> {
        trace_route(project, &WebPage(page.to_owned()))
    }

    /// `head`, then `x` up to `len` bytes.
    fn log_of(head: &str, len: usize) -> Vec<u8> {
        let mut bytes = head.as_bytes().to_vec();
        bytes.resize(len, b'x');
        bytes
    }

    fn text_after(head: &str, bytes: &[u8]) -> String {
        String::from_utf8(bytes[head.len()..].to_vec()).unwrap()
    }

    #[test]
    fn a_log_of_exactly_500_kib_is_whole() {
        let bytes = log_of("first\n", MAX_LOG_BYTES);

        let log = tail(&bytes);

        assert_eq!(log.text.as_bytes(), bytes);
        assert!(!log.cut);
    }

    #[test]
    fn a_longer_log_keeps_its_tail_from_the_next_line_start() {
        let head = "dropped\n";
        let bytes = log_of(&format!("{head}kept\n"), MAX_LOG_BYTES + 3);

        let log = tail(&bytes);

        assert_eq!(log.text, text_after(head, &bytes));
        assert!(log.text.starts_with("kept\n"));
        assert!(log.cut);
    }

    #[test]
    fn a_cut_drops_the_line_it_lands_in_even_a_whole_one() {
        let on_a_line_start = log_of("a\nwhole\nnext\n", MAX_LOG_BYTES + 2);
        let on_a_line_break = log_of("ab\nnext\n", MAX_LOG_BYTES + 2);

        let whole_line = tail(&on_a_line_start);
        let at_its_break = tail(&on_a_line_break);

        assert_eq!(whole_line.text, text_after("a\nwhole\n", &on_a_line_start));
        assert_eq!(at_its_break.text, text_after("ab\n", &on_a_line_break));
        assert!(whole_line.cut && at_its_break.cut);
    }

    #[test]
    fn a_cut_tail_without_a_line_break_is_empty_and_cut() {
        let bytes = log_of("line\n", MAX_LOG_BYTES + 6);

        let log = tail(&bytes);

        assert_eq!(
            log,
            JobLog {
                text: String::new(),
                cut: true
            }
        );
    }

    #[test]
    fn bytes_that_are_not_utf8_read_as_replacement_characters() {
        let log = tail(b"ok \xff\xfe \xe2\x82 end\n");

        assert_eq!(log.text, "ok \u{FFFD}\u{FFFD} \u{FFFD} end\n");
        assert!(!log.cut);
    }

    const OWN: Option<&str> = Some("projects/taskboard%2Ftaskboard/jobs/302/trace");
    const FORK: Option<&str> = Some("projects/sam%2Ftaskboard/jobs/310/trace");
    /// Pages on `ORIGIN` by their path, and their routes for the project at `/taskboard/taskboard`.
    const PLAIN_ROUTES: [(&str, Option<&str>); 7] = [
        ("/taskboard/taskboard/-/jobs/302", OWN),
        ("/sam/taskboard/-/jobs/310", FORK),
        ("/a/b/c/-/jobs/7", Some("projects/a%2Fb%2Fc/jobs/7/trace")),
        ("/taskboard/taskboard/-/merge_requests/71", None),
        ("/taskboard/taskboard/-/jobs/x", None),
        ("/a%2F..%2Fb/-/jobs/1", None),
        ("/-/jobs/1", None),
    ];
    /// As `PLAIN_ROUTES`, for the project at `/gitlab/taskboard/taskboard`.
    const SUB_PATH_ROUTES: [(&str, Option<&str>); 3] = [
        ("/gitlab/sam/taskboard/-/jobs/310", FORK),
        ("/sam/taskboard/-/jobs/310", FORK),
        (
            "/gitlabber/x/-/jobs/1",
            Some("projects/gitlabber%2Fx/jobs/1/trace"),
        ),
    ];
    const ELSEWHERE: [&str; 3] = [
        "https://other.example/taskboard/taskboard/-/jobs/302",
        "https://gitlab.example.evil/taskboard/-/jobs/302",
        "https://gitlab.example:8443/taskboard/-/jobs/302",
    ];

    #[test]
    fn the_trace_route_names_the_jobs_own_project() {
        let plain = project("/taskboard/taskboard");
        let under_gitlab = project("/gitlab/taskboard/taskboard");
        let projects = [
            (&plain, PLAIN_ROUTES.as_slice()),
            (&under_gitlab, &SUB_PATH_ROUTES),
        ];
        for (project, routes) in projects {
            for (path, expected) in routes {
                let page = format!("{ORIGIN}{path}");
                assert_eq!(route(project, &page).as_deref(), *expected, "{page}");
            }
        }
        for page in ELSEWHERE {
            assert_eq!(route(&plain, page), None, "{page}");
        }
        let off_https = Project {
            web_origin: None,
            ..project("")
        };
        assert_eq!(route(&off_https, "https://gitlab.example/a/-/jobs/1"), None);
    }

    #[test]
    fn a_404_is_no_log_and_other_failures_keep_glabs_words() {
        let missing = "glab: 404 Not Found (HTTP 404)".to_owned();
        let forbidden = "glab: 403 Forbidden (HTTP 403)".to_owned();
        let timed_out = yamt_gitio::TIMED_OUT.to_owned();

        assert_eq!(failure_reply(missing), JobLogReply::NoLog);
        for message in [forbidden, timed_out] {
            let failed = JobLogReply::Failed {
                message: message.clone(),
            };
            assert_eq!(failure_reply(message), failed);
        }
    }

    #[test]
    fn an_empty_trace_is_no_log_and_any_other_a_log() {
        assert_eq!(log_reply(b""), JobLogReply::NoLog);
        let log = JobLog {
            text: "\n".to_owned(),
            cut: false,
        };
        assert_eq!(log_reply(b"\n"), JobLogReply::Log { log });
    }

    #[test]
    fn the_log_names_each_outcome_by_its_kind() {
        let replies = [
            JobLogReply::Log { log: tail(b"") },
            JobLogReply::NotOffered,
            JobLogReply::NoLog,
            JobLogReply::GlabMissing,
            JobLogReply::NotLoggedIn {
                detail: String::new(),
            },
            JobLogReply::Failed {
                message: String::new(),
            },
        ];
        for reply in replies {
            let serialized = serde_json::to_value(&reply).unwrap();
            assert_eq!(serialized["kind"], outcome(&reply));
        }
    }
}
