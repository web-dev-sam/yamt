use serde_json::Value;

use super::{GlabRun, TIMED_OUT, last_line};

const NO_HTTP_ANSWER: &str = "glab printed no HTTP answer";
const HEADERS_END: &[u8] = b"\r\n\r\n";

/// What `glab api --include` printed: the HTTP status and the body after the headers, and glab's last stderr line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HttpAnswer {
    pub status: u16,
    pub body: Vec<u8>,
    /// glab's last non-empty stderr line (`glab: 403 Forbidden (HTTP 403)`), when it printed one.
    pub glab_line: Option<String>,
}

/// How one `glab api --include` call ended.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HttpCall {
    /// GitLab answered (any status).
    Answered(HttpAnswer),
    /// No HTTP answer: glab could not run, timed out, or printed no status line; glab's or gitio's words.
    NotAnswered(String),
}

impl HttpAnswer {
    /// GitLab's words in an error body: its string `message`; a non-string `message` as JSON text; else its string
    /// `error`; else None.
    #[must_use]
    pub fn gitlab_message(&self) -> Option<String> {
        let value = serde_json::from_slice::<Value>(&self.body).ok()?;
        match value.get("message") {
            Some(Value::String(message)) => Some(message.clone()),
            Some(Value::Null) | None => value.get("error")?.as_str().map(str::to_owned),
            Some(message) => Some(message.to_string()),
        }
    }

    /// `gitlab_message`, else `glab_line`, else `HTTP <status>`.
    #[must_use]
    pub fn reason(&self) -> String {
        self.gitlab_message()
            .or_else(|| self.glab_line.clone())
            .unwrap_or_else(|| format!("HTTP {}", self.status))
    }

    #[must_use]
    pub fn is_success(&self) -> bool {
        (200..=299).contains(&self.status)
    }
}

/// What a run of `glab api --include …` came to: an answer when stdout starts with a status line.
#[must_use]
pub fn http_call(run: std::result::Result<GlabRun, String>) -> HttpCall {
    let (stdout, stderr) = match run {
        Err(reason) => return HttpCall::NotAnswered(reason),
        Ok(GlabRun::TimedOut) => return HttpCall::NotAnswered(TIMED_OUT.to_owned()),
        Ok(GlabRun::Printed { stdout }) => (stdout, Vec::new()),
        Ok(GlabRun::Failed { stdout, stderr, .. }) => (stdout, stderr),
    };
    let glab_line = last_line(&stderr);
    let Some(status) = status_of(&stdout) else {
        return HttpCall::NotAnswered(glab_line.unwrap_or_else(|| NO_HTTP_ANSWER.to_owned()));
    };
    HttpCall::Answered(HttpAnswer {
        status,
        body: body_after_headers(stdout),
        glab_line,
    })
}

/// The code of the status line `glab api --include` prints first: `HTTP/2.0 201 Created`, then the headers and an
/// empty line, each ending in CRLF, then the body (glab 1.124.0, measured in `tests/glab/README.md`).
fn status_of(stdout: &[u8]) -> Option<u16> {
    let status_line = stdout.split(|byte| *byte == b'\n').next()?;
    let status_line = std::str::from_utf8(status_line).ok()?;
    let mut words = status_line.split_whitespace();
    if !words.next()?.starts_with("HTTP/") {
        return None;
    }
    words.next()?.parse().ok()
}

/// What follows the first empty line; nothing when the headers never end.
fn body_after_headers(mut stdout: Vec<u8>) -> Vec<u8> {
    let headers = stdout
        .windows(HEADERS_END.len())
        .position(|window| window == HEADERS_END)
        .map_or(stdout.len(), |end| end + HEADERS_END.len());
    stdout.drain(..headers);
    stdout
}

#[cfg(test)]
mod tests {
    use super::*;

    fn printed(stdout: &[u8]) -> HttpCall {
        http_call(Ok(GlabRun::Printed {
            stdout: stdout.to_vec(),
        }))
    }

    fn failed(stdout: &[u8], stderr: &[u8]) -> HttpCall {
        http_call(Ok(GlabRun::Failed {
            status: Some(1),
            stdout: stdout.to_vec(),
            stderr: stderr.to_vec(),
        }))
    }

    fn answered(status: u16, body: &[u8], glab_line: Option<&str>) -> HttpCall {
        HttpCall::Answered(HttpAnswer {
            status,
            body: body.to_vec(),
            glab_line: glab_line.map(str::to_owned),
        })
    }

    fn with_body(status: u16, body: &[u8], glab_line: Option<&str>) -> HttpAnswer {
        HttpAnswer {
            status,
            body: body.to_vec(),
            glab_line: glab_line.map(str::to_owned),
        }
    }

    fn not_answered(words: &str) -> HttpCall {
        HttpCall::NotAnswered(words.to_owned())
    }

    #[test]
    fn a_status_line_and_body_are_read_after_the_headers() {
        let headers = b"HTTP/2.0 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{\"a\":\"\r\n\r\n\"}";
        let line = "glab: 400 Bad Request (HTTP 400)";
        assert_eq!(
            failed(
                headers,
                b"What's new\n  glab: 400 Bad Request (HTTP 400)  \n\n"
            ),
            answered(400, b"{\"a\":\"\r\n\r\n\"}", Some(line))
        );
        let created = b"HTTP/2.0 201 Created\r\n\r\n{\"id\":7}";
        assert_eq!(printed(created), answered(201, b"{\"id\":7}", None));
    }

    #[test]
    fn an_answer_without_headers_end_has_an_empty_body() {
        assert_eq!(
            printed(b"HTTP/1.1 204 No Content\r\n"),
            answered(204, b"", None)
        );
        assert_eq!(printed(b"HTTP/1.1 204"), answered(204, b"", None));
    }

    #[test]
    fn no_status_line_is_not_answered_with_glabs_last_line() {
        assert_eq!(
            failed(b"", b"What's new\n  glab: no route  \n\n"),
            not_answered("glab: no route")
        );
        assert_eq!(failed(b"", b""), not_answered(NO_HTTP_ANSWER));
        assert_eq!(printed(b"{\"id\":1}"), not_answered(NO_HTTP_ANSWER));
        assert_eq!(
            printed(b"HTTP/2.0 OK\r\n\r\n"),
            not_answered(NO_HTTP_ANSWER)
        );
        assert_eq!(printed(b"HTTPS 200\r\n\r\n"), not_answered(NO_HTTP_ANSWER));
        assert_eq!(printed(b"\xff 200\r\n\r\n"), not_answered(NO_HTTP_ANSWER));
        assert_eq!(printed(b"HTTP/2.0\r\n\r\n"), not_answered(NO_HTTP_ANSWER));
        assert_eq!(printed(b""), not_answered(NO_HTTP_ANSWER));
    }

    #[test]
    fn a_timeout_is_not_answered() {
        assert_eq!(http_call(Ok(GlabRun::TimedOut)), not_answered(TIMED_OUT));
        assert_eq!(http_call(Err("gone".to_owned())), not_answered("gone"));
    }

    #[test]
    fn gitlabs_message_then_error_then_glabs_line_then_the_code_is_the_reason() {
        let line = Some("glab: 403 Forbidden (HTTP 403)");
        let reason = |body: &[u8], glab_line| with_body(403, body, glab_line).reason();
        assert_eq!(
            reason(br#"{"message":"403 Forbidden","error":"e"}"#, line),
            "403 Forbidden"
        );
        assert_eq!(
            reason(br#"{"message":null,"error":"invalid_token"}"#, line),
            "invalid_token"
        );
        assert_eq!(
            reason(br#"{"error":"invalid_token"}"#, line),
            "invalid_token"
        );
        assert_eq!(
            reason(br#"{"error":7}"#, line),
            "glab: 403 Forbidden (HTTP 403)"
        );
        assert_eq!(
            reason(b"Bad Gateway", line),
            "glab: 403 Forbidden (HTTP 403)"
        );
        assert_eq!(reason(b"{}", None), "HTTP 403");
    }

    #[test]
    fn a_non_string_message_is_its_json_text() {
        let answer = with_body(400, br#"{"message":{"note":["is too long"]}}"#, None);
        assert_eq!(
            answer.gitlab_message().as_deref(),
            Some(r#"{"note":["is too long"]}"#)
        );
    }

    #[test]
    fn only_a_2xx_is_a_success() {
        let success = |status| with_body(status, b"", None).is_success();
        assert!(success(200) && success(201) && success(299));
        assert!(!success(199) && !success(300) && !success(404));
    }
}
