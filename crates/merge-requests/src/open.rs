use std::path::Path;

use serde::Deserialize;
use yamt_gitio::{AuthStatus, FETCH_TIMEOUT, Glab, Oid, Repo};
use yamt_range::{PairLock, RangeSpec, Resolved};

use crate::page::{NO_PROJECT, graphql_data};
use crate::project::project;
use crate::query::details_args;
use crate::remote::remote_for;
use crate::{GitLabRepository, MergeRequestIid, OpenReply, RangeToOpen};

const OPENED: &str = "opened";
const SHORT_ID_CHARS: usize = 7;
const REFSPEC_SEPARATOR: char = ':';

#[derive(Deserialize)]
struct DetailsData {
    project: Option<DetailsProject>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetailsProject {
    merge_request: Option<Details>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Details {
    state: String,
    target_branch: String,
    diff_refs: Option<DiffRefs>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffRefs {
    base_sha: String,
    head_sha: String,
}

/// An open merge request's diff as GitLab has it now: the branch it goes into and its two commits.
struct OpenDiff {
    target_branch: String,
    base: Oid,
    head: Oid,
}

/// Merge request `iid`'s changes as the range `<base_sha>..<head_sha>` a new window opens, its commits fetched
/// first when the repository lacks them; `Err` is the answer the window shows instead. The pair's lock is only
/// tried, so a window already showing it answers `AlreadyOpen`.
pub fn prepare_open(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    range_dir: &Path,
) -> Result<RangeToOpen, OpenReply> {
    let Some(glab) = glab else {
        return Err(OpenReply::GlabMissing);
    };
    let root = repository.root();
    match glab.auth_status(root) {
        AuthStatus::LoggedIn => {}
        AuthStatus::LoggedOut { detail } => return Err(OpenReply::NotLoggedIn { detail }),
        AuthStatus::Failed { message } => return Err(OpenReply::Failed { message }),
    }
    let full_path = project(glab, root).map_err(failed)?.full_path;
    let diff = open_diff(glab, root, &full_path, iid)?;
    fetch_unless_local(repository, &full_path, iid, &diff)?;
    let spec = format!("{}..{}", diff.base.as_str(), diff.head.as_str());
    let resolved = resolved(root, &spec)?;
    require_not_shown(range_dir, &resolved)?;
    Ok(RangeToOpen {
        root: resolved.root().to_owned(),
        spec,
    })
}

fn open_diff(
    glab: &Glab,
    root: &Path,
    full_path: &str,
    iid: MergeRequestIid,
) -> Result<OpenDiff, OpenReply> {
    let args = details_args(full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let json = glab.get(root, &args).map_err(failed)?;
    let data: DetailsData = graphql_data(&json).map_err(failed)?;
    let project = data.project.ok_or_else(|| failed(NO_PROJECT.to_owned()))?;
    let Some(details) = project.merge_request else {
        return Err(OpenReply::NotOpen);
    };
    if details.state != OPENED {
        return Err(OpenReply::NotOpen);
    }
    let Some(diff_refs) = details.diff_refs else {
        return Err(OpenReply::Preparing);
    };
    Ok(OpenDiff {
        target_branch: details.target_branch,
        base: commit_id(&diff_refs.base_sha)?,
        head: commit_id(&diff_refs.head_sha)?,
    })
}

fn commit_id(sent: &str) -> Result<Oid, OpenReply> {
    Oid::parse(sent).map_err(|_| failed(format!("GitLab sent {sent:?} as a commit id")))
}

/// Fetches the merge request's head and its target branch from the project's remote, unless both commits are
/// already in the repository.
fn fetch_unless_local(
    repository: &GitLabRepository,
    full_path: &str,
    iid: MergeRequestIid,
    diff: &OpenDiff,
) -> Result<(), OpenReply> {
    let repo = repository.repo();
    if has_commit(repo, &diff.base)? && has_commit(repo, &diff.head)? {
        return Ok(());
    }
    let Some(remote) = remote_for(repository.gitlab_remotes(), full_path) else {
        return Err(OpenReply::NoRemote {
            project: full_path.to_owned(),
        });
    };
    // A refspec with a colon names a ref to write (git-fetch(1) "<refspec>"); git refuses one in a branch name.
    if diff.target_branch.contains(REFSPEC_SEPARATOR) {
        let target = &diff.target_branch;
        return Err(failed(format!("GitLab sent {target:?} as a branch name")));
    }
    let head_ref = format!("refs/merge-requests/{}/head", iid.0);
    let target_ref = format!("refs/heads/{}", diff.target_branch);
    let refspecs = [head_ref.as_str(), target_ref.as_str()];
    repo.fetch_without_refs(&remote.name, &refspecs, FETCH_TIMEOUT)
        .map_err(|message| OpenReply::FetchFailed { message })
}

fn has_commit(repo: &Repo, id: &Oid) -> Result<bool, OpenReply> {
    let found = repo.commit_named(id.as_str());
    found
        .map(|commit| commit.is_some())
        .map_err(|error| failed(error.to_string()))
}

fn resolved(root: &Path, spec: &str) -> Result<Resolved, OpenReply> {
    let spec = RangeSpec::parse(spec).map_err(|error| failed(error.to_string()))?;
    match Resolved::resolve(root, &spec) {
        Ok(resolved) => Ok(resolved),
        Err(yamt_range::Error::UnknownName { name }) => Err(OpenReply::MissingCommit {
            short_id: name.chars().take(SHORT_ID_CHARS).collect(),
        }),
        Err(error) => Err(failed(error.to_string())),
    }
}

/// The pair's lock taken and let go at once: held, another window shows these two commits.
fn require_not_shown(range_dir: &Path, resolved: &Resolved) -> Result<(), OpenReply> {
    match PairLock::take(range_dir, resolved) {
        Ok(_lock) => Ok(()),
        Err(yamt_range::Error::Locked { .. }) => Err(OpenReply::AlreadyOpen),
        Err(error) => Err(failed(error.to_string())),
    }
}

fn failed(message: String) -> OpenReply {
    OpenReply::Failed { message }
}
