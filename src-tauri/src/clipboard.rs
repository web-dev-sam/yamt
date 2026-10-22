use std::sync::mpsc::Receiver;

use tauri::{AppHandle, Runtime};

#[derive(Clone, Copy, Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ClipboardSelection {
    Clipboard,
    Primary,
}

type TextAnswer = Receiver<Option<String>>;

/// The selection's text, or `None` when it cannot be read; on Linux through GTK's text request,
/// which never asks for the format list that `WebKitGTK` 2.54 crashes on (plan §2 #99).
#[tauri::command]
#[specta::specta]
pub(crate) async fn read_clipboard<R: Runtime>(
    app: AppHandle<R>,
    selection: ClipboardSelection,
) -> Option<String> {
    let answer = requested_text(&app, selection)?;
    text_from(answer).await
}

async fn text_from(answer: TextAnswer) -> Option<String> {
    let waiting = tauri::async_runtime::spawn_blocking(move || answer.recv().ok().flatten());
    waiting.await.unwrap_or_else(|error| {
        tracing::error!(%error, "yamt's clipboard wait stopped");
        None
    })
}

#[cfg(target_os = "linux")]
fn requested_text<R: Runtime>(
    app: &AppHandle<R>,
    selection: ClipboardSelection,
) -> Option<TextAnswer> {
    let (sender, answer) = std::sync::mpsc::channel();
    let started = app.run_on_main_thread(move || {
        gtk::Clipboard::get(&selection_atom(selection)).request_text(move |_, text| {
            let _ = sender.send(text.map(str::to_owned));
        });
    });
    match started {
        Ok(()) => Some(answer),
        Err(error) => {
            tracing::warn!(%error, "the clipboard cannot be read: the main thread is gone");
            None
        }
    }
}

#[cfg(target_os = "linux")]
fn selection_atom(selection: ClipboardSelection) -> gtk::gdk::Atom {
    match selection {
        ClipboardSelection::Clipboard => gtk::gdk::SELECTION_CLIPBOARD,
        ClipboardSelection::Primary => gtk::gdk::SELECTION_PRIMARY,
    }
}

#[cfg(not(target_os = "linux"))]
fn requested_text<R: Runtime>(
    _app: &AppHandle<R>,
    _selection: ClipboardSelection,
) -> Option<TextAnswer> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text_read_from(answer: TextAnswer) -> Option<String> {
        tauri::async_runtime::block_on(text_from(answer))
    }

    #[test]
    fn sent_text_comes_back_as_written() {
        let (sender, answer) = std::sync::mpsc::channel();
        sender.send(Some("one\ntwo\n".to_owned())).unwrap();
        assert_eq!(text_read_from(answer), Some("one\ntwo\n".to_owned()));
    }

    #[test]
    fn no_text_from_gtk_reads_as_none() {
        let (sender, answer) = std::sync::mpsc::channel();
        sender.send(None).unwrap();
        assert_eq!(text_read_from(answer), None);
    }

    #[test]
    fn a_request_dropped_before_gtk_answers_reads_as_none() {
        let (sender, answer) = std::sync::mpsc::channel::<Option<String>>();
        drop(sender);
        assert_eq!(text_read_from(answer), None);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn each_selection_reads_its_own_gdk_selection() {
        assert!(selection_atom(ClipboardSelection::Clipboard) == gtk::gdk::SELECTION_CLIPBOARD);
        assert!(selection_atom(ClipboardSelection::Primary) == gtk::gdk::SELECTION_PRIMARY);
    }
}
