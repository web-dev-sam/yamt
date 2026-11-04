use url::{Origin, Url};

use crate::WebPage;
use crate::project::Project;
use crate::web_page::{is_lower_hex, is_number, is_path_segment};

/// GitLab's routes put `/-/` between the owner's path and the page (`config/routes/project.rb`, `group.rb`).
const ROUTE_SEPARATOR: &str = "/-/";
const GROUPS_SEGMENT: &str = "groups";
const COMMIT_ID_FIELD: &str = "commit_id";
/// GitLab's shortest commit reference (`Commit::MIN_SHA_LENGTH`) and a full SHA-1 id.
const MIN_SHA_LENGTH: usize = 7;
const FULL_SHA_LENGTH: usize = 40;
/// GitLab shows a commit by its first 8 characters (`Commit#short_id`).
const SHORT_SHA_LENGTH: usize = 8;
/// A compare of two commits, `a...b` or `a..b`, longest first.
const RANGE_DOTS: [&str; 2] = ["...", ".."];
const RANGE_ELLIPSIS: char = '…';

/// A project or a group, by its full path.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum Namespace {
    Project(String),
    Group(String),
}

/// A thing on the project's GitLab a description links to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Target {
    /// An issue, a work item or an epic.
    Item { namespace: Namespace, iid: u64 },
    /// `sha`: lowercase hex as written, 7–40 characters.
    Commit { project: String, sha: String },
    Range {
        project: String,
        from: String,
        to: String,
    },
}

/// The project's GitLab: `https://host[:port]` and the sub-path GitLab is installed under (`""` on gitlab.com).
pub(crate) struct Server {
    origin: Origin,
    sub_path: String,
}

impl Namespace {
    pub(crate) fn path(&self) -> &str {
        match self {
            Namespace::Project(path) | Namespace::Group(path) => path,
        }
    }
}

impl Target {
    /// One thing however written: a commit whose id starts the other's in the same project is that commit.
    pub(crate) fn is_same(&self, other: &Target) -> bool {
        if let (
            Target::Commit { project, sha },
            Target::Commit {
                project: other_project,
                sha: other_sha,
            },
        ) = (self, other)
        {
            return project == other_project
                && (sha.starts_with(other_sha.as_str()) || other_sha.starts_with(sha.as_str()));
        }
        self == other
    }
}

impl Server {
    /// None when GitLab is not on https, or the project's web path does not end with its full path.
    pub(crate) fn of(project: &Project) -> Option<Server> {
        let origin = Url::parse(project.web_origin.as_deref()?).ok()?.origin();
        let sub_path = project
            .web_path
            .strip_suffix(project.full_path.as_str())?
            .strip_suffix('/')?;
        Some(Server {
            origin,
            sub_path: sub_path.to_owned(),
        })
    }
}

/// `page` as a thing on the project's server: https, the project's origin, under its sub-path; None for any other.
pub(crate) fn target_of(server: &Server, page: &WebPage) -> Option<Target> {
    let url = Url::parse(page.as_str()).ok()?;
    if url.origin() != server.origin {
        return None;
    }
    let path = url
        .path()
        .strip_prefix(&server.sub_path)?
        .strip_prefix('/')?;
    if !path.split('/').all(is_path_segment) {
        return None;
    }
    let (owner, route) = path.split_once(ROUTE_SEPARATOR)?;
    let route: Vec<&str> = route.split('/').collect();
    match owner.split_once('/') {
        Some((GROUPS_SEGMENT, group)) => group_target(group, &route),
        _ if owner == GROUPS_SEGMENT => None,
        _ => project_target(owner, &route, &url),
    }
}

fn group_target(group: &str, route: &[&str]) -> Option<Target> {
    match route {
        ["epics" | "work_items", iid] => item(Namespace::Group(group.to_owned()), iid),
        _ => None,
    }
}

fn project_target(project: &str, route: &[&str], url: &Url) -> Option<Target> {
    let commit = |sha: &str| Target::Commit {
        project: project.to_owned(),
        sha: sha.to_owned(),
    };
    match route {
        ["issues" | "work_items", iid] | ["issues", "incident", iid] => {
            item(Namespace::Project(project.to_owned()), iid)
        }
        ["commit", sha] => is_sha(sha).then(|| commit(sha)),
        ["merge_requests", iid, "diffs"] if is_number(iid) => {
            let sha = commit_id(url)?;
            (sha.len() == FULL_SHA_LENGTH && is_sha(&sha)).then(|| commit(&sha))
        }
        ["compare", range] => {
            let (from, to) = RANGE_DOTS.iter().find_map(|dots| range.split_once(dots))?;
            let is_range = is_sha(from) && is_sha(to);
            is_range.then(|| Target::Range {
                project: project.to_owned(),
                from: from.to_owned(),
                to: to.to_owned(),
            })
        }
        _ => None,
    }
}

fn item(namespace: Namespace, iid: &str) -> Option<Target> {
    let iid = iid_of(iid)?;
    Some(Target::Item { namespace, iid })
}

/// Digits only, as GitLab writes an iid, within `u64`.
pub(crate) fn iid_of(text: &str) -> Option<u64> {
    is_number(text).then(|| text.parse().ok()).flatten()
}

fn commit_id(url: &Url) -> Option<String> {
    let mut fields = url.query_pairs();
    let (_, sha) = fields.find(|(name, _)| name == COMMIT_ID_FIELD)?;
    Some(sha.into_owned())
}

/// 7–40 lowercase hex digits.
fn is_sha(text: &str) -> bool {
    (MIN_SHA_LENGTH..=FULL_SHA_LENGTH).contains(&text.len()) && text.chars().all(is_lower_hex)
}

/// `target` as GitLab writes it on `project`'s pages (`Project#to_reference_base`); `is_epic` picks the epic rule
/// for a group's item.
pub(crate) fn reference(target: &Target, is_epic: bool, project: &str) -> String {
    match target {
        Target::Item {
            namespace: Namespace::Project(path),
            iid,
        } => format!("{}#{iid}", project_prefix(path, project)),
        Target::Item {
            namespace: Namespace::Group(group),
            iid,
        } => {
            if !is_epic {
                format!("{group}#{iid}")
            } else if namespace_of(project) == Some(group.as_str()) {
                format!("&{iid}")
            } else {
                format!("{group}&{iid}")
            }
        }
        Target::Commit { project: path, sha } => {
            commit_reference(project_prefix(path, project), short(sha))
        }
        Target::Range {
            project: path,
            from,
            to,
        } => {
            let range = format!("{}{RANGE_ELLIPSIS}{}", short(from), short(to));
            commit_reference(project_prefix(path, project), &range)
        }
    }
}

/// How `path` is written before a reference from `project`: nothing for itself, its last segment beside it in the
/// same namespace, else in full.
fn project_prefix<'a>(path: &'a str, project: &str) -> &'a str {
    if path == project {
        ""
    } else if namespace_of(path) == namespace_of(project) {
        path.rsplit_once('/').map_or(path, |(_, last)| last)
    } else {
        path
    }
}

fn namespace_of(path: &str) -> Option<&str> {
    path.rsplit_once('/').map(|(namespace, _)| namespace)
}

fn commit_reference(prefix: &str, commit: &str) -> String {
    if prefix.is_empty() {
        commit.to_owned()
    } else {
        format!("{prefix}@{commit}")
    }
}

fn short(sha: &str) -> &str {
    sha.get(..SHORT_SHA_LENGTH).unwrap_or(sha)
}
