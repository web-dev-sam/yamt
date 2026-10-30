use std::path::Path;

use yamt_gitio::{PUSH_TIMEOUT, Repo};

use crate::{PushOffer, PushReply};

/// A plain push of the offered branch to the remote it came from: never forced, never prompting.
#[must_use]
pub fn push(root: &Path, offer: &PushOffer) -> PushReply {
    let pushed = Repo::discover(root)
        .map_err(|error| error.to_string())
        .and_then(|repo| repo.push_branch(&offer.remote, &offer.branch, PUSH_TIMEOUT));
    match pushed {
        Ok(()) => PushReply::Pushed,
        Err(message) => PushReply::Failed { message },
    }
}
