use std::path::Path;

use yamt_gitio::{Glab, HttpCall};

use crate::gitlab::draft_id_from;

/// What one message's post came to.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Drafted(u64),
    Refused(String),
    Stop(String),
}

/// A 2xx is a draft; another 4xx a refusal of this message; anything else stops the send.
pub(crate) fn posted(call: HttpCall) -> Outcome {
    let answer = match call {
        HttpCall::NotAnswered(reason) => return Outcome::Stop(reason),
        HttpCall::Answered(answer) => answer,
    };
    match answer.status {
        200..=299 => match draft_id_from(&answer.body) {
            Ok(id) => Outcome::Drafted(id),
            Err(reason) => Outcome::Stop(reason),
        },
        // 401, 403 and 429 are about the user or the rate, not the message: the rest would fail the same way.
        401 | 403 | 429 => Outcome::Stop(answer.reason()),
        400..=499 => Outcome::Refused(answer.reason()),
        _ => Outcome::Stop(answer.reason()),
    }
}

/// What a GET printed; `Err` holds what went wrong, glab's own line when it printed one.
pub(crate) fn answer(
    glab: &Glab,
    root: &Path,
    args: &[String],
) -> std::result::Result<Vec<u8>, String> {
    glab.get(root, &as_strs(args))
}

/// `glab <args>` with `body` on stdin, read as an HTTP answer.
pub(crate) fn sent(glab: &Glab, root: &Path, args: &[String], body: Vec<u8>) -> HttpCall {
    glab.send(root, &as_strs(args), Some(body))
}

fn as_strs(args: &[String]) -> Vec<&str> {
    args.iter().map(String::as_str).collect()
}

#[cfg(test)]
mod tests {
    use yamt_gitio::{GlabRun, TIMED_OUT, http_call};

    use super::*;

    fn posted_run(run: std::result::Result<GlabRun, String>) -> Outcome {
        posted(http_call(run))
    }

    #[test]
    fn a_refusal_keeps_gitlab_s_words_and_a_failure_of_user_or_server_stops() {
        let answered = |status: &str| {
            let stdout = format!("HTTP/2.0 {status}\r\n\r\n{{\"message\":\"{status}\"}}");
            let stdout = stdout.into_bytes();
            let stderr = Vec::new();
            posted_run(Ok(GlabRun::Failed {
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
            posted_run(Ok(GlabRun::Printed { stdout: created })),
            Outcome::Drafted(7)
        );
        let accepted = b"HTTP/2.0 299 Fine\r\n\r\n{\"id\":8}".to_vec();
        assert_eq!(
            posted_run(Ok(GlabRun::Printed { stdout: accepted })),
            Outcome::Drafted(8)
        );
        let no_id = b"HTTP/2.0 201 Created\r\n\r\n{\"id\":-1}".to_vec();
        assert_eq!(
            posted_run(Ok(GlabRun::Printed { stdout: no_id })),
            stop("unexpected answer from GitLab: `id` is not a number")
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
        assert_eq!(posted_run(Ok(with_notice)), stop("glab: no route"));
        assert_eq!(
            posted_run(Ok(no_answer(b""))),
            stop("glab printed no HTTP answer")
        );
        assert_eq!(posted_run(Ok(GlabRun::TimedOut)), stop(TIMED_OUT));
        assert_eq!(posted_run(Err("gone".to_owned())), stop("gone"));
    }
}
