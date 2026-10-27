use std::path::Path;

use yamt_gitio::{Glab, GlabRun};

use crate::gitlab::{draft_id_from, error_message_from};

pub(crate) const TIMED_OUT: &str = "glab timed out";
const NO_HTTP_ANSWER: &str = "glab printed no HTTP answer";

/// What one message's post came to.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Drafted(u64),
    Refused(String),
    Stop(String),
}

/// What `glab api --include` printed: the HTTP status and the body after the headers.
#[derive(Clone, Debug, PartialEq, Eq)]
struct HttpAnswer {
    status: u16,
    body: Vec<u8>,
}

/// A 2xx is a draft; another 4xx a refusal of this message; anything else stops the send.
pub(crate) fn posted(run: std::result::Result<GlabRun, String>) -> Outcome {
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
    let reason = || {
        error_message_from(&answer.body)
            .or_else(|| last_line(&stderr))
            .unwrap_or_else(|| format!("HTTP {}", answer.status))
    };
    match answer.status {
        200..=299 => match draft_id_from(&answer.body) {
            Ok(id) => Outcome::Drafted(id),
            Err(reason) => Outcome::Stop(reason),
        },
        // 401, 403 and 429 are about the user or the rate, not the message: the rest would fail the same way.
        401 | 403 | 429 => Outcome::Stop(reason()),
        400..=499 => Outcome::Refused(reason()),
        _ => Outcome::Stop(reason()),
    }
}

/// The status line and body `glab api --include` prints: `HTTP/2.0 201 Created`, headers, an empty line, each
/// ending in CRLF, then the body (glab 1.124.0, measured in `tests/glab/README.md`).
fn http_answer_from(stdout: &[u8]) -> Option<HttpAnswer> {
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

/// What a GET printed; `Err` holds what went wrong, glab's own line when it printed one.
pub(crate) fn answer(
    glab: &Glab,
    root: &Path,
    args: &[String],
) -> std::result::Result<Vec<u8>, String> {
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
pub(crate) fn run(
    glab: &Glab,
    root: &Path,
    args: &[String],
    stdin: Option<Vec<u8>>,
) -> std::result::Result<GlabRun, String> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    glab.run(root, &args, stdin)
        .map_err(|error| error.to_string())
}

pub(crate) fn first_line(output: &[u8]) -> Option<String> {
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
    fn a_refusal_keeps_gitlab_s_words_and_a_failure_of_user_or_server_stops() {
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
        for status in ["400 Bad Request", "404 Not Found", "499 Client Closed"] {
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
        let accepted = b"HTTP/2.0 299 Fine\r\n\r\n{\"id\":8}".to_vec();
        assert_eq!(
            posted(Ok(GlabRun::Printed { stdout: accepted })),
            Outcome::Drafted(8)
        );
    }

    #[test]
    fn no_http_answer_a_timeout_or_glab_gone_stops_in_glab_s_words() {
        let stop = |words: &str| Outcome::Stop(words.to_owned());
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
