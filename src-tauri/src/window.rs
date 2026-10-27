use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

use tauri::path::PathResolver;
use tauri::window::Color;
use tauri::{
    App, AppHandle, Manager, RunEvent, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};
use yamt_session::MergeSession;
use yamt_settings::{StoredSettings, Theme};

use crate::args::Ai;
use crate::commands::{with_commands, with_session};
use crate::compare;
use crate::merge::MergeState;
use crate::outcome::{Ending, Exit, ending_when_git_is_done};
use crate::servers::{self, HostState};
use crate::settings;
use crate::start_script::start_script;

const WINDOW_LABEL: &str = "main";
const COMPARE_TITLE: &str = "Compare — yamt";
const APP_FOLDER: &str = "yamt";
const WIDTH: f64 = 1600.0;
const HEIGHT: f64 = 1000.0;
const MIN_WIDTH: f64 = 900.0;
const MIN_HEIGHT: f64 = 600.0;
// `--color-window` of each theme's block: frontend/src/style.css (`@theme static`) for Dark,
// frontend/src/themes/<name>.css for the others.
const BACKGROUND_DARK: Color = Color(0x27, 0x25, 0x2e, 0xff);
const BACKGROUND_LIGHT: Color = Color(0xe9, 0xea, 0xee, 0xff);
const BACKGROUND_WEBSTORM_DARK: Color = Color(0x26, 0x28, 0x2c, 0xff);
const BACKGROUND_WEBSTORM_LIGHT: Color = Color(0xe9, 0xea, 0xee, 0xff);
const BACKGROUND_VSCODE_DARK: Color = Color(0x19, 0x1a, 0x1b, 0xff);
const BACKGROUND_VSCODE_LIGHT: Color = Color(0xfa, 0xfa, 0xfd, 0xff);
const BACKGROUND_ZED_DARK: Color = Color(0x3b, 0x41, 0x4d, 0xff);
const BACKGROUND_ZED_LIGHT: Color = Color(0xdc, 0xdc, 0xdd, 0xff);
const BACKGROUND_ATOM_DARK: Color = Color(0x21, 0x25, 0x2b, 0xff);
const BACKGROUND_ATOM_LIGHT: Color = Color(0xea, 0xea, 0xeb, 0xff);
const UNANSWERED_CLOSE_GRACE: Duration = Duration::from_secs(1);
const UNANSWERED_CLOSE_TIMEOUT: Duration = Duration::from_secs(3);
const PAGE_PING: &str = "true";
const PAGE_ANSWER: &str = "true";

/// Which page the window shows: `<html data-window>` before the first frame (plan §2 #94).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WindowKind {
    Merge,
    Compare,
    Range,
}

impl WindowKind {
    pub(crate) fn name(self) -> &'static str {
        match self {
            WindowKind::Merge => "merge",
            WindowKind::Compare => "compare",
            WindowKind::Range => "range",
        }
    }
}

pub(crate) fn run(session: Box<MergeSession>) -> Ending {
    let title = window_title(session.root());
    match open_merge(&title, session) {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

pub(crate) fn run_compare() -> Ending {
    match open_compare() {
        Ok(ending) => ending,
        Err(error) => Ending::failure(error.to_string()),
    }
}

fn context() -> tauri::Context<tauri::Wry> {
    tauri::generate_context!()
}

fn open_merge(title: &str, session: Box<MergeSession>) -> tauri::Result<Ending> {
    let app = with_session(tauri::Builder::default(), session).build(context())?;
    let handle = open_and_wait(app, title, WindowKind::Merge, Ai::Off)?;
    servers::lock(&handle.state::<HostState>()).stop_all();
    Ok(ending_when_git_is_done(&handle.state::<MergeState>()))
}

fn open_compare() -> tauri::Result<Ending> {
    let manage = compare::manage_store_in;
    open_with_data_folder(COMPARE_TITLE, WindowKind::Compare, Ai::Off, manage, |_| {})
}

/// Builds a window whose state `manage` sets up in `<data_dir>/yamt` before the window opens;
/// its refusal is the one line the run ends with, a closed window is exit 0 after `at_exit`.
pub(crate) fn open_with_data_folder(
    title: &str,
    kind: WindowKind,
    ai: Ai,
    manage: impl FnOnce(&App, &Path) -> Result<(), String>,
    at_exit: impl FnOnce(&AppHandle),
) -> tauri::Result<Ending> {
    let app = with_commands(tauri::Builder::default()).build(context())?;
    let managed = app
        .path()
        .data_dir()
        .map_err(|error| format!("no data folder: {error}"))
        .and_then(|data_dir| manage(&app, &app_folder(&data_dir)));
    if let Err(problem) = managed {
        return Ok(Ending::failure(problem));
    }
    let handle = open_and_wait(app, title, kind, ai)?;
    at_exit(&handle);
    Ok(Ending {
        exit: Exit::Success,
        message: None,
    })
}

/// yamt's own folder in the user's data folder: the compare tabs and the range locks live under it.
pub(crate) fn app_folder(data_dir: &Path) -> PathBuf {
    data_dir.join(APP_FOLDER)
}

fn open_and_wait(app: App, title: &str, kind: WindowKind, ai: Ai) -> tauri::Result<AppHandle> {
    let stored = start_settings(app.path());
    // WebKitGTK fixes its surfaces' subpixel layout when the webview is built (plan §2 #60).
    #[cfg(target_os = "linux")]
    crate::font_rendering::apply(stored.antialiasing);
    let theme = stored.theme;
    WebviewWindowBuilder::new(&app, WINDOW_LABEL, WebviewUrl::default())
        .title(title)
        .inner_size(WIDTH, HEIGHT)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .background_color(background(theme))
        .initialization_script(start_script(theme, kind, ai))
        .build()?;
    let handle = app.handle().clone();
    let mut close_watch = CloseWatch::new();
    app.run_return(move |app, event| close_watch.on_run_event(app, &event));
    Ok(handle)
}

fn start_settings(paths: &PathResolver<tauri::Wry>) -> StoredSettings {
    match settings::places(paths) {
        Ok(places) => yamt_settings::stored_at_start(&places),
        Err(error) => {
            tracing::warn!(
                ?error,
                "no config folder: the window starts with the defaults"
            );
            StoredSettings::default()
        }
    }
}

pub(crate) fn show_theme<R: Runtime>(window: &WebviewWindow<R>, theme: Theme) {
    if let Err(error) = window.set_background_color(Some(background(theme))) {
        tracing::warn!(%error, "window background not changed");
    }
}

fn background(theme: Theme) -> Color {
    match theme {
        Theme::Dark => BACKGROUND_DARK,
        Theme::Light => BACKGROUND_LIGHT,
        Theme::WebstormDark => BACKGROUND_WEBSTORM_DARK,
        Theme::WebstormLight => BACKGROUND_WEBSTORM_LIGHT,
        Theme::VscodeDark => BACKGROUND_VSCODE_DARK,
        Theme::VscodeLight => BACKGROUND_VSCODE_LIGHT,
        Theme::ZedDark => BACKGROUND_ZED_DARK,
        Theme::ZedLight => BACKGROUND_ZED_LIGHT,
        Theme::AtomDark => BACKGROUND_ATOM_DARK,
        Theme::AtomLight => BACKGROUND_ATOM_LIGHT,
    }
}

pub(crate) fn window_title(root: &Path) -> String {
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

#[derive(Debug, PartialEq, Eq)]
enum CloseRequest {
    PageGone,
    AskPage,
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
        match self.record_close_request(Instant::now()) {
            CloseRequest::PageGone => {
                tracing::warn!(
                    "closing without the page: it did not answer the last close request"
                );
                window.destroy()
            }
            CloseRequest::AskPage => {
                let answer_sender = self.answer_sender.clone();
                window.eval_with_callback(PAGE_PING, move |result| {
                    if answered(&result) {
                        answer_sender.send(()).ok();
                    }
                })
            }
        }
    }

    fn record_close_request(&mut self, at: Instant) -> CloseRequest {
        if self.answers.try_iter().count() > 0 {
            self.unanswered_since = None;
        }
        let unanswered_for = self.unanswered_since.map(|since| at.duration_since(since));
        match unanswered_for {
            Some(age) if age < UNANSWERED_CLOSE_GRACE => CloseRequest::AskPage,
            Some(age) if age <= UNANSWERED_CLOSE_TIMEOUT => CloseRequest::PageGone,
            Some(_) | None => {
                self.unanswered_since = Some(at);
                CloseRequest::AskPage
            }
        }
    }
}

// wry 0.57 passes "" to the callback when the script cannot run: webkitgtk/mod.rs:799-805
// (`unwrap_or_default`), wkwebview/mod.rs:740-754 (a null value); otherwise the result as JSON.
fn answered(result: &str) -> bool {
    result == PAGE_ANSWER
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
        assert!(answered("true"));
        assert!(!answered(""));
        assert!(!answered("false"));
        assert!(!answered("null"));
    }

    fn second_request_after(delay: Duration) -> CloseRequest {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        assert_eq!(watch.record_close_request(asked), CloseRequest::AskPage);
        watch.record_close_request(asked + delay)
    }

    #[test]
    fn a_close_without_an_earlier_unanswered_one_asks_the_page() {
        let mut watch = CloseWatch::new();
        assert_eq!(
            watch.record_close_request(Instant::now()),
            CloseRequest::AskPage
        );
    }

    #[test]
    fn the_page_is_gone_only_between_grace_and_timeout_after_the_unanswered_request() {
        let millisecond = Duration::from_millis(1);
        assert_eq!(
            second_request_after(UNANSWERED_CLOSE_GRACE.saturating_sub(millisecond)),
            CloseRequest::AskPage
        );
        assert_eq!(
            second_request_after(UNANSWERED_CLOSE_GRACE),
            CloseRequest::PageGone
        );
        assert_eq!(
            second_request_after(UNANSWERED_CLOSE_TIMEOUT),
            CloseRequest::PageGone
        );
        assert_eq!(
            second_request_after(UNANSWERED_CLOSE_TIMEOUT + millisecond),
            CloseRequest::AskPage
        );
    }

    #[test]
    fn a_double_click_inside_the_grace_keeps_counting_from_the_first_request() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        watch.record_close_request(asked);
        assert_eq!(
            watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE / 2),
            CloseRequest::AskPage
        );
        assert_eq!(
            watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE),
            CloseRequest::PageGone
        );
    }

    #[test]
    fn a_late_second_close_asks_the_page_again() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        watch.record_close_request(asked);
        let late = asked + UNANSWERED_CLOSE_TIMEOUT + Duration::from_millis(1);
        assert_eq!(watch.record_close_request(late), CloseRequest::AskPage);
        assert_eq!(
            watch.record_close_request(late + UNANSWERED_CLOSE_GRACE),
            CloseRequest::PageGone
        );
    }

    #[test]
    fn an_answered_close_request_never_finds_the_page_gone() {
        let asked = Instant::now();
        let mut watch = CloseWatch::new();
        watch.record_close_request(asked);
        watch.answer_sender.send(()).unwrap();
        assert_eq!(
            watch.record_close_request(asked + UNANSWERED_CLOSE_GRACE),
            CloseRequest::AskPage
        );
    }
}
