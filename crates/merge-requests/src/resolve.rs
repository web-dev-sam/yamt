use serde::Deserialize;
use yamt_gitio::Glab;

use crate::open::{OPENED, require_branch_name};
use crate::page::{NO_PROJECT, graphql_data, is_from_fork};
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
    let full_path = repository.logged_in_project(glab)?.full_path;
    let branches = branches(repository, glab, &full_path, iid)?;
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
        root: repository.root().to_owned(),
        iid,
        remote: remote.name.clone(),
        branch: branches.source_branch,
        target: branches.target_branch,
    })
}

/// The merge request's branches as GitLab has them now; no such merge request is `NotOpen`; the call's failure,
/// GraphQL's errors and `NO_PROJECT` through `refusal`.
fn branches(
    repository: &GitLabRepository,
    glab: &Glab,
    full_path: &str,
    iid: MergeRequestIid,
) -> Result<Branches, ResolveRefusal> {
    let refused = |message| ResolveRefusal::from(repository.refusal(glab, message));
    let args = branches_args(full_path, iid);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let json = glab.get(repository.root(), &args).map_err(refused)?;
    let data: BranchesData = graphql_data(&json).map_err(refused)?;
    let project = data.project.ok_or_else(|| refused(NO_PROJECT.to_owned()))?;
    project.merge_request.ok_or(ResolveRefusal::NotOpen)
}

fn failed(message: String) -> ResolveRefusal {
    ResolveRefusal::Failed { message }
}
