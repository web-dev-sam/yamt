use std::path::Path;

use serde::Deserialize;
use yamt_gitio::{FETCH_TIMEOUT, Glab, Oid, Repo};
use yamt_range::{MergeRequestNames, PairLock, RangeSpec, Resolved};

use crate::page::{NO_PROJECT, graphql_data, is_from_fork};
use crate::query::details_args;
use crate::remote::remote_for;
use crate::{GitLabRepository, MergeRequestIid, OpenReply, RangeToOpen};

pub(crate) const OPENED: &str = "opened";
const SHORT_ID_CHARS: usize = 7;
const REFSPEC_SEPARATOR: char = ':';
const HIDDEN_FORK: &str = "(fork) ";

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
    title: String,
    source_branch: String,
    target_branch: String,
    source_project_id: Option<i64>,
    target_project_id: i64,
    source_project: Option<SourceProject>,
    diff_refs: Option<DiffRefs>,
}

#[derive(Deserialize)]
struct SourceProject {
    namespace: Option<SourceNamespace>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceNamespace {
    full_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffRefs {
    base_sha: String,
    head_sha: String,
}

/// An open merge request's diff as GitLab has it now: its title and branches, and its two commits.
struct OpenDiff {
    names: MergeRequestNames,
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
    let full_path = repository.logged_in_project(glab)?.full_path;
    let diff = open_diff(repository, glab, &full_path, iid)?;
    fetch_unless_local(repository, &full_path, iid, &diff)?;
    let spec = format!("{}..{}", diff.base.as_str(), diff.head.as_str());
    let resolved = resolved(repository.root(), &spec)?;
    require_not_shown(range_dir, &resolved)?;
    Ok(RangeToOpen {
        root: resolved.root().to_owned(),
        spec,
        project: full_path,
        iid,
        names: diff.names,
    })
}

/// The merge request's names and diff refs as GitLab has them now; the call's failure, GraphQL's errors and
/// `NO_PROJECT` through `refusal`.
fn open_diff(
    repository: &GitLabRepository,
    glab: &Glab,
    full_path: &str,
    iid: MergeRequestIid,
) -> Result<OpenDiff, OpenReply> {
    let refused = |message| OpenReply::from(repository.refusal(glab, message));
    let args = details_args(full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let json = glab.get(repository.root(), &args).map_err(refused)?;
    let data: DetailsData = graphql_data(&json).map_err(refused)?;
    let project = data.project.ok_or_else(|| refused(NO_PROJECT.to_owned()))?;
    let Some(details) = project.merge_request else {
        return Err(OpenReply::NotOpen);
    };
    if details.state != OPENED {
        return Err(OpenReply::NotOpen);
    }
    let source = shown_source(&details);
    let names = MergeRequestNames {
        title: details.title,
        source,
        target: details.target_branch,
    };
    let Some(diff_refs) = details.diff_refs else {
        return Err(OpenReply::Preparing);
    };
    Ok(OpenDiff {
        names,
        base: commit_id(&diff_refs.base_sha)?,
        head: commit_id(&diff_refs.head_sha)?,
    })
}

/// The source branch as GitLab's merge-request page names it: a fork's as `<namespace full path>:<branch>`
/// (`app/presenters/merge_request_presenter.rb:118-126`, v19.3.2-ee); a fork whose `sourceProject` GitLab does not
/// send is marked as a fork, never shown as a branch of the target's project.
fn shown_source(details: &Details) -> String {
    if !is_from_fork(details.source_project_id, details.target_project_id) {
        return details.source_branch.clone();
    }
    let namespace = details
        .source_project
        .as_ref()
        .and_then(|project| project.namespace.as_ref());
    match namespace {
        Some(namespace) => format!("{}:{}", namespace.full_path, details.source_branch),
        None => format!("{HIDDEN_FORK}{}", details.source_branch),
    }
}

fn commit_id(sent: &str) -> Result<Oid, OpenReply> {
    Oid::parse(sent).map_err(|_| failed(format!("GitLab sent {sent:?} as a commit id")))
}

/// A branch name a fetch refspec can carry: one with a colon names a ref to write (git-fetch(1) "<refspec>"), and
/// git refuses one in a branch name.
pub(crate) fn require_branch_name(sent: &str) -> Result<(), String> {
    if sent.contains(REFSPEC_SEPARATOR) {
        return Err(format!("GitLab sent {sent:?} as a branch name"));
    }
    Ok(())
}

pub(crate) fn branch_ref(branch: &str) -> Result<String, String> {
    require_branch_name(branch)?;
    Ok(format!("refs/heads/{branch}"))
}

pub(crate) fn head_ref(iid: MergeRequestIid) -> String {
    format!("refs/merge-requests/{}/head", iid.0)
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
    let target_ref = branch_ref(&diff.names.target).map_err(failed)?;
    let head_ref = head_ref(iid);
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
