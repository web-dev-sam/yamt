use std::collections::BTreeMap;
use std::sync::{MutexGuard, PoisonError};

use tauri::http::header::{CONTENT_TYPE, HeaderValue, X_CONTENT_TYPE_OPTIONS};
use tauri::http::{Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime, UriSchemeResponder};
use yamt_merge_requests::{Glab, OfferedPicture, Picture, PictureAddress, fetch_picture};

use super::MergeRequestState;

/// The scheme the window asks uploaded profile pictures by: `yamt-picture://localhost/<username>`.
pub(crate) const PICTURE_SCHEME: &str = "yamt-picture";
/// glab runs for pictures at once.
const PICTURE_FETCHES: usize = 4;
const NO_SNIFFING: &str = "nosniff";

/// The uploaded pictures the lists of this run offered and what fetching each brought; `running` counts the glab
/// runs under way, at most `PICTURE_FETCHES`.
#[derive(Default)]
pub(crate) struct PictureShelf {
    /// Each username's picture address, the latest list's.
    offered: BTreeMap<String, PictureAddress>,
    fetched: BTreeMap<PictureAddress, Fetch>,
    running: usize,
}

enum Fetch {
    Running,
    /// The picture, or `None` when glab or the picture failed: asked once per run.
    Done(Option<Picture>),
}

/// What a caller does next for a username's picture.
enum Turn {
    Answer(Option<Picture>),
    Fetch(PictureAddress),
}

pub(crate) fn shelf(state: &MergeRequestState) -> MutexGuard<'_, PictureShelf> {
    state
        .pictures
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

/// Remembers the pictures a list page offered, each username's latest address winning.
pub(crate) fn offer(state: &MergeRequestState, pictures: Vec<OfferedPicture>) {
    let mut shelf = shelf(state);
    for picture in pictures {
        shelf.offered.insert(picture.username, picture.address);
    }
}

/// Answers `GET <scheme>://localhost/<username>` on a worker thread, so the webview never waits.
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

/// The picture of the username `path` names (`/<username>`), when a list of this run offered it and glab fetched it;
/// else 404 with an empty body.
pub(crate) fn picture_answer(
    state: &MergeRequestState,
    glab: Option<&Glab>,
    path: &str,
) -> Response<Vec<u8>> {
    let username = path.strip_prefix('/').filter(|name| is_username(name));
    let (Some(username), Some(glab), Some(repository)) = (username, glab, &state.gitlab) else {
        return not_found();
    };
    let address = match turn(state, username) {
        None | Some(Turn::Answer(None)) => return not_found(),
        Some(Turn::Answer(Some(picture))) => return found(picture),
        Some(Turn::Fetch(address)) => address,
    };
    let fetched = fetch_picture(glab, repository.root(), &address)
        .inspect_err(|message| tracing::warn!(%message, "a profile picture was not fetched"))
        .ok();
    let mut shelf = shelf(state);
    shelf.running -= 1;
    shelf.fetched.insert(address, Fetch::Done(fetched.clone()));
    drop(shelf);
    state.picture_turns.notify_all();
    fetched.map_or_else(not_found, found)
}

/// Waits until the username's picture is fetched or this caller may fetch it; `None` when no list offered it.
fn turn(state: &MergeRequestState, username: &str) -> Option<Turn> {
    let mut shelf = shelf(state);
    loop {
        let address = shelf.offered.get(username)?.clone();
        match shelf.fetched.get(&address) {
            Some(Fetch::Done(picture)) => return Some(Turn::Answer(picture.clone())),
            None if shelf.running < PICTURE_FETCHES => {
                shelf.running += 1;
                shelf.fetched.insert(address.clone(), Fetch::Running);
                return Some(Turn::Fetch(address));
            }
            Some(Fetch::Running) | None => {}
        }
        shelf = state
            .picture_turns
            .wait(shelf)
            .unwrap_or_else(PoisonError::into_inner);
    }
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
