use std::path::Path;

use serde::Deserialize;
use yamt_gitio::Glab;

use crate::open::{OPENED, require_branch_name};
use crate::page::{NO_PROJECT, graphql_data, is_from_fork};
use crate::project::logged_in_project;
use crate::query::branches_args;
use crate::remote::remote_for;
use crate::{GitLabRepository, MergeRequestIid, ResolveRefusal, ResolveTarget};

#[derive(Deserialize)]
struct BranchesData {
    project: Option<BranchesProject>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BranchesProject {
    merge_request: Option<Branches>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Branches {
    state: String,
    source_branch: String,
    target_branch: String,
    source_project_id: Option<i64>,
    target_project_id: i64,
}

/// What resolving merge request `iid`'s conflicts in this repository needs: its two branches, asked afresh, and
/// the remote naming its project; `Err` is the answer the window shows instead. Nothing is fetched or written.
pub fn prepare_resolve(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> Result<ResolveTarget, ResolveRefusal> {
    let Some(glab) = glab else {
        return Err(ResolveRefusal::GlabMissing);
    };
    let root = repository.root();
    let full_path = logged_in_project(glab, root)?.full_path;
    let branches = branches(glab, root, &full_path, iid)?;
    if branches.state != OPENED {
        return Err(ResolveRefusal::NotOpen);
    }
    if is_from_fork(branches.source_project_id, branches.target_project_id) {
        return Err(ResolveRefusal::FromFork);
    }
    require_branch_name(&branches.source_branch).map_err(failed)?;
    require_branch_name(&branches.target_branch).map_err(failed)?;
    let Some(remote) = remote_for(repository.gitlab_remotes(), &full_path) else {
        return Err(ResolveRefusal::NoRemote { project: full_path });
    };
    Ok(ResolveTarget {
        root: root.to_owned(),
        iid,
        remote: remote.name.clone(),
        branch: branches.source_branch,
        target: branches.target_branch,
    })
}

/// The merge request's branches as GitLab has them now; no such merge request is `NotOpen`.
fn branches(
    glab: &Glab,
    root: &Path,
    full_path: &str,
    iid: MergeRequestIid,
) -> Result<Branches, ResolveRefusal> {
    let args = branches_args(full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let json = glab.get(root, &args).map_err(failed)?;
    let data: BranchesData = graphql_data(&json).map_err(failed)?;
    let project = data.project.ok_or_else(|| failed(NO_PROJECT.to_owned()))?;
    project.merge_request.ok_or(ResolveRefusal::NotOpen)
}

fn failed(message: String) -> ResolveRefusal {
    ResolveRefusal::Failed { message }
}
