use std::ops::Range as Span;
use std::path::Path;
use std::sync::{Mutex, MutexGuard, PoisonError};

use yamt_gitio::{Glab, GlabRun, Repo};
use yamt_range::Range;

use crate::gitlab::{
    DraftNote, draft_id_from, draft_notes, draft_notes_from, error_message_from, listed_from,
    merge_request_details, merge_request_from, merge_requests_from_branch,
    merge_requests_of_commit, post_draft_note,
};
use crate::lines_up::{Found, LinedUp, candidates, lines_up, short_id};
use crate::position::{PostBody, line_place, same_draft};
use crate::right_branch::right_branch;
use crate::thread_store::QueuedMessage;
use crate::{
    Error, GitLabCheck, LookedAt, NotLinedUp, Posting, Result, SendProgress, SendReply, ThreadList,
    ThreadStore,
};

const TIMED_OUT: &str = "glab timed out";
const NO_HTTP_ANSWER: &str = "glab printed no HTTP answer";
const DIFFS_PAGE: &str = "/diffs";
const ACCEPTED: Span<u16> = 200..300;
const CLIENT_ERRORS: Span<u16> = 400..500;
/// 401, 403 and 429 are about the user or the rate, not the message: the rest would fail the same way.
const STOPPING_CLIENT_ERRORS: [u16; 3] = [401, 403, 429];

/// Whether GitLab's diff of the merge request for the range's right side is exactly the window's (plan §2 #119).
#[must_use]
pub fn check_gitlab(range: &Range, glab: Option<&Glab>) -> GitLabCheck {
    let checked = match glab {
        None => Err(NotLinedUp::GlabMissing),
        Some(glab) => lined_up(glab, range),
    };
    match checked {
        Ok(lined_up) => GitLabCheck::LinedUp {
            merge_request: lined_up.merge_request.named,
        },
        Err(why) => GitLabCheck::NotLinedUp { why },
    }
}

/// Checks again, then posts every queued message as a draft note, one at a time in thread order, recording
/// each result in `threads` (locked only between glab calls) and reporting progress after each (plan §2 #118).
pub fn send_queue(
    range: &Range,
    glab: Option<&Glab>,
    threads: &Mutex<ThreadStore>,
    progress: &dyn Fn(SendProgress),
) -> Result<SendReply> {
    let Some(glab) = glab else {
        let why = NotLinedUp::GlabMissing;
        return Ok(SendReply::NotLinedUp { why });
    };
    match lined_up(glab, range) {
        Ok(target) => post_queue(glab, range, &target, threads, progress),
        Err(why) => Ok(SendReply::NotLinedUp { why }),
    }
}

fn post_queue(
    glab: &Glab,
    range: &Range,
    target: &LinedUp,
    threads: &Mutex<ThreadStore>,
    progress: &dyn Fn(SendProgress),
) -> Result<SendReply> {
    let queued = locked(threads).queued(range);
    let mut tally = Tally {
        done: 0,
        of: u32::try_from(queued.len()).unwrap_or(u32::MAX),
        sent: 0,
        refused: 0,
    };
    let drafts = answer(glab, range.root(), &draft_notes(&target.merge_request))
        .and_then(|json| draft_notes_from(&json));
    let mut drafts = match drafts {
        Ok(drafts) => drafts,
        Err(reason) => return Ok(tally.stopped(locked(threads).list(range), reason)),
    };
    for message in queued {
        let posting = match outcome(glab, range, target, &mut drafts, &message)? {
            Outcome::Drafted(draft_note) => {
                tally.sent += 1;
                pending(target, message.text, draft_note)
            }
            Outcome::Refused(reason) => {
                tally.refused += 1;
                let text = message.text;
                Posting::Refused { text, reason }
            }
            Outcome::Stop(reason) => return Ok(tally.stopped(locked(threads).list(range), reason)),
        };
        locked(threads).record(message.message, posting)?;
        tally.done += 1;
        progress(SendProgress {
            done: tally.done,
            of: tally.of,
        });
    }
    Ok(tally.sent(locked(threads).list(range)))
}

/// What one message's post came to.
#[derive(Debug, PartialEq, Eq)]
enum Outcome {
    Drafted(u64),
    Refused(String),
    Stop(String),
}

/// What `glab api --include` printed: the HTTP status and the body after the headers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct HttpAnswer {
    pub(crate) status: u16,
    pub(crate) body: Vec<u8>,
}

struct Tally {
    done: u32,
    of: u32,
    sent: u32,
    refused: u32,
}

impl Tally {
    fn sent(&self, list: ThreadList) -> SendReply {
        SendReply::Sent {
            list,
            sent: self.sent,
            refused: self.refused,
        }
    }

    fn stopped(&self, list: ThreadList, reason: String) -> SendReply {
        SendReply::Stopped {
            list,
            sent: self.sent,
            refused: self.refused,
            reason,
        }
    }
}

fn locked(threads: &Mutex<ThreadStore>) -> MutexGuard<'_, ThreadStore> {
    threads.lock().unwrap_or_else(PoisonError::into_inner)
}

fn pending(target: &LinedUp, text: String, draft_note: u64) -> Posting {
    let named = &target.merge_request.named;
    Posting::Pending {
        text,
        draft_note,
        merge_request: named.reference.clone(),
        link: format!("{}{DIFFS_PAGE}", named.web_url),
    }
}

/// A draft GitLab already holds for the message is taken (once) instead of posting it again.
fn outcome(
    glab: &Glab,
    range: &Range,
    target: &LinedUp,
    drafts: &mut Vec<DraftNote>,
    message: &QueuedMessage,
) -> Result<Outcome> {
    let file = message.file;
    let entry = range.entry(file).ok_or(Error::UnknownFile { file })?;
    let place = match line_place(entry, message.line) {
        Ok(place) => place,
        Err(reason) => return Ok(Outcome::Refused(reason.to_owned())),
    };
    let body = PostBody {
        note: message.text.clone(),
        diff_refs: target.diff_refs.clone(),
        place,
    };
    if let Some(index) = drafts.iter().position(|draft| same_draft(&body, draft)) {
        return Ok(Outcome::Drafted(drafts.swap_remove(index).id));
    }
    let args = post_draft_note(&target.merge_request);
    Ok(posted(run(glab, range.root(), &args, Some(body.json()))))
}

/// A 2xx is a draft; another 4xx a refusal of this message; anything else stops the send.
fn posted(run: std::result::Result<GlabRun, String>) -> Outcome {
    let (stdout, stderr) = match run {
        Err(reason) => return Outcome::Stop(reason),
        Ok(GlabRun::TimedOut) => return Outcome::Stop(TIMED_OUT.to_owned()),
        Ok(GlabRun::Printed { stdout }) => (stdout, Vec::new()),
        Ok(GlabRun::Failed { stdout, stderr, .. }) => (stdout, stderr),
    };
    let Some(answer) = http_answer_from(&stdout) else {
        let reason = last_line(&stderr).unwrap_or_else(|| NO_HTTP_ANSWER.to_owned());
        return Outcome::Stop(reason);
    };
    if ACCEPTED.contains(&answer.status) {
        return match draft_id_from(&answer.body) {
            Ok(id) => Outcome::Drafted(id),
            Err(reason) => Outcome::Stop(reason),
        };
    }
    let reason = error_message_from(&answer.body)
        .or_else(|| last_line(&stderr))
        .unwrap_or_else(|| format!("HTTP {}", answer.status));
    let refused =
        CLIENT_ERRORS.contains(&answer.status) && !STOPPING_CLIENT_ERRORS.contains(&answer.status);
    if refused {
        Outcome::Refused(reason)
    } else {
        Outcome::Stop(reason)
    }
}

/// The status line and body `glab api --include` prints: `HTTP/2.0 201 Created`, headers, an empty line, each
/// ending in CRLF, then the body (glab 1.124.0, measured in `tests/glab/README.md`).
pub(crate) fn http_answer_from(stdout: &[u8]) -> Option<HttpAnswer> {
    const HEADERS_END: &[u8] = b"\r\n\r\n";
    let status_line = stdout.split(|byte| *byte == b'\n').next()?;
    let status_line = std::str::from_utf8(status_line).ok()?;
    let mut words = status_line.split_whitespace();
    if !words.next()?.starts_with("HTTP/") {
        return None;
    }
    let status = words.next()?.parse().ok()?;
    let body = stdout
        .windows(HEADERS_END.len())
        .position(|window| window == HEADERS_END)
        .map_or(&[][..], |end| &stdout[end + HEADERS_END.len()..]);
    Some(HttpAnswer {
        status,
        body: body.to_vec(),
    })
}

fn lined_up(glab: &Glab, range: &Range) -> std::result::Result<LinedUp, NotLinedUp> {
    let root = range.root();
    require_logged_in(glab, root)?;
    let compared = range.compared();
    let repo = Repo::discover(root).map_err(|error| failed(error.to_string()))?;
    let branch =
        right_branch(&repo, &compared.right_label).map_err(|error| failed(error.to_string()))?;
    let (looked_at, args) = lookup(branch, compared.right.as_str());
    let listed = answer(glab, root, &args)
        .and_then(|json| listed_from(&json))
        .map_err(failed)?;
    let mut merge_requests = Vec::new();
    for listed in candidates(listed, &looked_at, &compared.right) {
        let request = answer(glab, root, &merge_request_details(&listed))
            .and_then(|json| merge_request_from(&json))
            .map_err(failed)?;
        merge_requests.push(request);
    }
    let found = Found {
        looked_at,
        merge_requests,
    };
    lines_up(&compared, found)
}

/// What the merge requests are looked up by, and the glab call that lists them.
fn lookup(branch: Option<String>, right: &str) -> (LookedAt, Vec<String>) {
    if let Some(name) = branch {
        let args = merge_requests_from_branch(&name);
        return (LookedAt::Branch { name }, args);
    }
    let short_id = short_id(right);
    (
        LookedAt::Commit { short_id },
        merge_requests_of_commit(right),
    )
}

fn require_logged_in(glab: &Glab, root: &Path) -> std::result::Result<(), NotLinedUp> {
    let args = ["auth".to_owned(), "status".to_owned()];
    match run(glab, root, &args, None).map_err(failed)? {
        GlabRun::Printed { .. } => Ok(()),
        GlabRun::Failed { stdout, stderr, .. } => {
            let detail = first_line(&stderr).or_else(|| first_line(&stdout));
            Err(NotLinedUp::NotLoggedIn {
                detail: detail.unwrap_or_default(),
            })
        }
        GlabRun::TimedOut => Err(failed(TIMED_OUT.to_owned())),
    }
}

fn failed(message: String) -> NotLinedUp {
    NotLinedUp::Failed { message }
}

/// What a GET printed; `Err` holds what went wrong, glab's own line when it printed one.
fn answer(glab: &Glab, root: &Path, args: &[String]) -> std::result::Result<Vec<u8>, String> {
    match run(glab, root, args, None)? {
        GlabRun::Printed { stdout } => Ok(stdout),
        GlabRun::Failed { status, stderr, .. } => {
            Err(last_line(&stderr).unwrap_or_else(|| exit_words(status)))
        }
        GlabRun::TimedOut => Err(TIMED_OUT.to_owned()),
    }
}

fn exit_words(status: Option<i32>) -> String {
    match status {
        Some(code) => format!("glab exited with status {code}"),
        None => "glab was stopped by a signal".to_owned(),
    }
}

/// `Err` when glab could not run at all, in gitio's words.
fn run(
    glab: &Glab,
    root: &Path,
    args: &[String],
    stdin: Option<Vec<u8>>,
) -> std::result::Result<GlabRun, String> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    glab.run(root, &args, stdin)
        .map_err(|error| error.to_string())
}

fn first_line(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let line = text.lines().map(str::trim).find(|line| !line.is_empty());
    line.map(str::to_owned)
}

/// glab prints its error last, after any notice such as a first run's "What's new".
fn last_line(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let line = text.lines().map(str::trim).rfind(|line| !line.is_empty());
    line.map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_http_status_and_body_come_from_the_included_headers() {
        let read = |printed: &[u8]| http_answer_from(printed).map(|got| (got.status, got.body));
        let headers = b"HTTP/2.0 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{}";
        assert_eq!(read(headers), Some((400, b"{}".to_vec())));
        assert_eq!(
            read(b"HTTP/1.1 204 No Content\r\n"),
            Some((204, Vec::new()))
        );
        assert_eq!(read(b"{\"id\":1}"), None);
        assert_eq!(read(b"HTTP/2.0 OK\r\n\r\n"), None);
        assert_eq!(read(b""), None);
    }

    #[test]
    fn a_refusal_keeps_gitlab_s_words_and_a_failure_of_user_server_or_glab_stops() {
        let answered = |status: &str| {
            let stdout = format!("HTTP/2.0 {status}\r\n\r\n{{\"message\":\"{status}\"}}");
            let stdout = stdout.into_bytes();
            let stderr = Vec::new();
            posted(Ok(GlabRun::Failed {
                status: Some(1),
                stdout,
                stderr,
            }))
        };
        let stop = |words: &str| Outcome::Stop(words.to_owned());
        for status in ["400 Bad Request", "404 Not Found"] {
            assert_eq!(answered(status), Outcome::Refused(status.to_owned()));
        }
        for status in [
            "401 Unauthorized",
            "403 Forbidden",
            "429 Too Many",
            "500 Error",
            "302 Found",
        ] {
            assert_eq!(answered(status), stop(status));
        }
        let created = b"HTTP/2.0 201 Created\r\n\r\n{\"id\":7}".to_vec();
        assert_eq!(
            posted(Ok(GlabRun::Printed { stdout: created })),
            Outcome::Drafted(7)
        );
        let no_answer = |stderr: &[u8]| GlabRun::Failed {
            status: Some(1),
            stdout: Vec::new(),
            stderr: stderr.to_vec(),
        };
        let with_notice = no_answer(b"What's new\n  glab: no route  \n\n");
        assert_eq!(posted(Ok(with_notice)), stop("glab: no route"));
        assert_eq!(posted(Ok(no_answer(b""))), stop(NO_HTTP_ANSWER));
        assert_eq!(posted(Ok(GlabRun::TimedOut)), stop(TIMED_OUT));
        assert_eq!(posted(Err("gone".to_owned())), stop("gone"));
        assert_eq!(exit_words(Some(2)), "glab exited with status 2");
        assert_eq!(exit_words(None), "glab was stopped by a signal");
    }
}
