use std::collections::BTreeMap;
use std::sync::{Condvar, Mutex, MutexGuard, PoisonError};

use tauri::http::header::{CONTENT_TYPE, HeaderValue, X_CONTENT_TYPE_OPTIONS};
use tauri::http::{Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime, UriSchemeResponder};
use yamt_merge_requests::{
    Glab, OfferedPicture, OfferedUpload, Picture, PictureAddress, UploadKey, fetch_picture,
};

use super::MergeRequestState;

/// The scheme the window asks pictures by: `yamt-picture://localhost/<username>` for an uploaded profile picture,
/// `yamt-picture://localhost/upload~<32 lowercase hex digits>` for an upload a description named.
pub(crate) const PICTURE_SCHEME: &str = "yamt-picture";
/// glab runs for pictures at once.
const PICTURE_FETCHES: usize = 4;
const NO_SNIFFING: &str = "nosniff";

/// The pictures lists, replies and descriptions offered and those fetched (plan §2 #152), and the turns of the askers
/// waiting for a fetch to end; the shelf is never locked together with another `Mutex` and never held across a glab
/// run.
#[derive(Default)]
pub(crate) struct Pictures {
    shelf: Mutex<PictureShelf>,
    turns: Condvar,
}

/// What this run offered and what fetching each brought; `running` counts the glab runs under way, at most
/// `PICTURE_FETCHES`.
#[derive(Default)]
struct PictureShelf {
    /// Each username's or upload key's picture address, the latest offer's.
    offered: BTreeMap<String, PictureAddress>,
    fetched: BTreeMap<PictureAddress, Fetch>,
    running: usize,
}

enum Fetch {
    Running,
    /// The picture, or `None` when glab or the picture failed: asked once per run.
    Done(Option<Picture>),
}

/// What a caller does next for a name's picture.
enum Turn {
    Answer(Option<Picture>),
    Fetch(PictureAddress),
}

impl Pictures {
    fn shelf(&self) -> MutexGuard<'_, PictureShelf> {
        self.shelf.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Remembers the uploaded pictures a list page, a discussions reply, a search or a change offered, each
    /// username's latest address winning.
    pub(crate) fn offer(&self, pictures: Vec<OfferedPicture>) {
        let mut held = self.shelf();
        for picture in pictures {
            held.offered.insert(picture.username, picture.address);
        }
    }

    /// Remembers the uploads a description offered, by key; a key's latest address wins.
    pub(crate) fn offer_uploads(&self, uploads: Vec<OfferedUpload>) {
        let mut held = self.shelf();
        for upload in uploads {
            held.offered
                .insert(upload.key.as_str().to_owned(), upload.address);
        }
    }

    /// Waits until the named picture is fetched or this caller may fetch it; `None` when nothing offered it.
    fn turn(&self, name: &str) -> Option<Turn> {
        let mut held = self.shelf();
        loop {
            let address = held.offered.get(name)?.clone();
            match held.fetched.get(&address) {
                Some(Fetch::Done(picture)) => return Some(Turn::Answer(picture.clone())),
                None if held.running < PICTURE_FETCHES => {
                    held.running += 1;
                    held.fetched.insert(address.clone(), Fetch::Running);
                    return Some(Turn::Fetch(address));
                }
                Some(Fetch::Running) | None => {}
            }
            held = self
                .turns
                .wait(held)
                .unwrap_or_else(PoisonError::into_inner);
        }
    }

    /// Ends this caller's fetch of `address` and wakes the askers waiting for it or for a free fetch.
    fn done(&self, address: PictureAddress, fetched: Option<Picture>) {
        let mut held = self.shelf();
        held.running -= 1;
        held.fetched.insert(address, Fetch::Done(fetched));
        drop(held);
        self.turns.notify_all();
    }
}

/// Answers `GET <scheme>://localhost/<name>` on a worker thread, so the webview never waits.
pub(crate) fn answer_picture<R: Runtime>(
    app: AppHandle<R>,
    path: String,
    responder: UriSchemeResponder,
) {
    tauri::async_runtime::spawn_blocking(move || {
        let answer = match app.try_state::<MergeRequestState>() {
            Some(state) => picture_answer(&state, Glab::find().as_ref(), &path),
            None => not_found(),
        };
        responder.respond(answer);
    });
}

/// The picture `path` names (`/<username>` or `/upload~<secret>`), when this run offered it and glab fetched it; else
/// 404 with an empty body.
pub(crate) fn picture_answer(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    path: &str,
) -> Response<Vec<u8>> {
    let name = path.strip_prefix('/').filter(|name| is_picture_name(name));
    let (Some(name), Some(glab), Some(repository)) = (name, glab, &state.gitlab) else {
        return not_found();
    };
    let address = match state.pictures.turn(name) {
        None | Some(Turn::Answer(None)) => return not_found(),
        Some(Turn::Answer(Some(picture))) => return found(picture),
        Some(Turn::Fetch(address)) => address,
    };
    let fetched = fetch_picture(glab, repository.root(), &address)
        .inspect_err(|message| tracing::warn!(%message, "a picture was not fetched"))
        .ok();
    state.pictures.done(address, fetched.clone());
    fetched.map_or_else(not_found, found)
}

/// A username, or an upload key: only an offered name is ever served.
fn is_picture_name(name: &str) -> bool {
    is_username(name) || UploadKey::is_key(name)
}

fn is_username(name: &str) -> bool {
    let is_username_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-');
    !name.is_empty() && name.chars().all(is_username_char)
}

fn found(picture: Picture) -> Response<Vec<u8>> {
    let mut response = Response::new(picture.bytes);
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static(picture.kind.mime()));
    headers.insert(
        X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static(NO_SNIFFING),
    );
    response
}

fn not_found() -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = StatusCode::NOT_FOUND;
    response
}
