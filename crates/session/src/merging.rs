use yamt_gitio::Repo;

use crate::session::LOG_TARGET;
use crate::side_names::MERGE_HEAD;

pub(crate) fn is_merging(repo: &Repo) -> bool {
    match merge_in_progress(repo) {
        Ok(merging) => merging,
        Err(error) => {
            tracing::warn!(target: LOG_TARGET, event = "merge_state_unread", %error, "no merge to abort is assumed");
            false
        }
    }
}

// A `git rebase -r` stopped on a merge commit's conflict writes MERGE_HEAD too; `git merge --abort` there would leave the rebase half done.
fn merge_in_progress(repo: &Repo) -> yamt_gitio::Result<bool> {
    if repo.commit_named(MERGE_HEAD)?.is_none() {
        return Ok(false);
    }
    Ok(!repo.rebase_in_progress()?)
}
