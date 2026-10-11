use std::path::Path;
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

use tauri::window::Color;
use tauri::{
    AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use yamt_session::MergeSession;

use crate::commands::{SessionState, lock, with_session};
use crate::outcome::{Ending, ending_on_close};

const WINDOW_LABEL: &str = "main";
const WIDTH: f64 = 1600.0;
const HEIGHT: f64 = 1000.0;
const MIN_WIDTH: f64 = 900.0;
const MIN_HEIGHT: f64 = 600.0;
// `--color-window` in frontend/src/style.css.
const BACKGROUND: Color = Color(0x2b, 0x2d, 0x30, 0xff);
const UNANSWERED_CLOSE_GRACE: Duration = Duration::from_secs(1);
const UNANSWERED_CLOSE_TIMEOUT: Duration = Duration::from_secs(3);
const PAGE_PING: &str = "true";

pub(crate) fn run(session: MergeSession) -> Ending {
    let title = window_title(session.root());
    match open_and_wait(&title, session) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

fn open_and_wait(title: &str, session: MergeSession) -> tauri::Result<Ending> {
    let app = with_session(tauri::Builder::default(), session).build(tauri::generate_context!())?;
    WebviewWindowBuilder::new(&app, WINDOW_LABEL, WebviewUrl::default())
        .title(title)
        .inner_size(WIDTH, HEIGHT)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .background_color(BACKGROUND)
        .build()?;
    let handle = app.handle().clone();
    let mut close_watch = CloseWatch::new();
    app.run_return(move |app, event| close_watch.on_run_event(app, &event));
    Ok(ending_on_close(&lock(&handle.state::<SessionState>())))
}

fn window_title(root: &Path) -> String {
    let folder = root.file_name().unwrap_or(root.as_os_str());
    format!("{} — yamt", folder.to_string_lossy())
}

// Tauri holds a native close while the page listens for close requests (tauri 2.12
// manager/window.rs `on_window_event`), so a gone page would keep the window open forever.
struct CloseWatch {
    unanswered_since: Option<Instant>,
    answer_sender: Sender<()>,
    answers: Receiver<()>,
}

impl CloseWatch {
    fn new() -> CloseWatch {
        let (answer_sender, answers) = mpsc::channel();
        CloseWatch {
            unanswered_since: None,
            answer_sender,
            answers,
        }
    }

    fn on_run_event(&mut self, app: &AppHandle, event: &RunEvent) {
        if let RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { .. },
            ..
        } = event
            && let Some(window) = app.get_webview_window(label)
            && let Err(error) = self.on_close_request(&window)
        {
            tracing::warn!(%error, "close request not handled");
        }
    }

    fn on_close_request(&mut self, window: &WebviewWindow) -> tauri::Result<()> {
        if self.record_close_request(Instant::now()) {
            tracing::warn!("closing without the page: it did not answer the last close request");
            return window.destroy();
        }
        let answer_sender = self.answer_sender.clone();
        window.eval_with_callback(PAGE_PING, move |result| {
            if answered(&result) {
                answer_sender.send(()).ok();
            }
        })
    }

    fn record_close_request(&mut self, at: Instant) -> bool {
        if self.answers.try_iter().count() > 0 {
            self.unanswered_since = None;
        }
        let gone = page_gone(self.unanswered_since, at);
        let within_grace = self
            .unanswered_since
            .is_some_and(|since| at.duration_since(since) < UNANSWERED_CLOSE_GRACE);
        if !within_grace {
            self.unanswered_since = Some(at);
        }
        gone
    }
}

fn page_gone(unanswered_since: Option<Instant>, request_at: Instant) -> bool {
    unanswered_since.is_some_and(|since| {
        let unanswered_for = request_at.duration_since(since);
        (UNANSWERED_CLOSE_GRACE..=UNANSWERED_CLOSE_TIMEOUT).contains(&unanswered_for)
    })
}

// wry 0.57 passes "" to the callback when the script cannot run: webkitgtk/mod.rs:799-805
// (`unwrap_or_default`), wkwebview/mod.rs:740-754 (a null value); otherwise the result as JSON.
fn answered(result: &str) -> bool {
    result == PAGE_PING
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_names_the_repository_folder() {
        assert_eq!(
            window_title(Path::new("/tmp/yamt-test-merge")),
            "yamt-test-merge — yamt"
        );
        assert_eq!(window_title(Path::new("/")), "/ — yamt");
    }

    #[test]
    fn only_the_ping_answer_counts_as_answered() {
        assert!(answered(PAGE_PING));
        assert!(!answered(""));
    }

    #[test]
    fn a_close_without_an_earlier_unanswered_one_never_finds_the_page_gone() {
        assert!(!page_gone(None, Instant::now()));
    }

    #[test]
    fn the_page_is_gone_only_between_grace_and_timeout_after_the_unanswered_request() {
        let asked = Instant::now();
        let millisecond = Duration::from_millis(1);
        let gone_after = |delay: Duration| page_gone(Some(asked), asked + delay);
        assert!(!gone_after(
            UNANSWERED_CLOSE_GRACE.saturating_sub(millisecond)
        ));
        assert!(gone_after(UNANSWERED_CLOSE_GRACE));
        assert!(gone_after(UNANSWERED_CLOSE_TIMEOUT));
        assert!(!gone_after(UNANSWERED_CLOSE_TIMEOUT + millisecond));
    }

    #[test]
    fn a_double_click_inside_the_grace_keeps_counting_from_the_first_request() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        assert!(!watch.record_close_request(asked));
        assert!(!watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE / 2));
        assert!(watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE));
    }

    #[test]
    fn a_late_second_close_asks_the_page_again() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        assert!(!watch.record_close_request(asked));
        let late = asked + UNANSWERED_CLOSE_TIMEOUT + Duration::from_millis(1);
        assert!(!watch.record_close_request(late));
        assert!(watch.record_close_request(late + UNANSWERED_CLOSE_GRACE));
    }

    #[test]
    fn an_answered_close_request_never_finds_the_page_gone() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        assert!(!watch.record_close_request(asked));
        watch.answer_sender.send(()).unwrap();
        assert!(!watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE));
    }
}
