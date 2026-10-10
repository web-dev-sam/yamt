use std::path::Path;

use tauri::window::Color;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
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
    app.run_return(|_, _| {});
    Ok(ending_on_close(&lock(&handle.state::<SessionState>())))
}

fn window_title(root: &Path) -> String {
    let folder = root.file_name().unwrap_or(root.as_os_str());
    format!("{} — yamt", folder.to_string_lossy())
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
}
