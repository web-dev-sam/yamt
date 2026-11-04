pub(crate) mod lookup;
pub(crate) mod target;

use std::collections::BTreeMap;

use serde::Serialize;
use specta::Type;
use yamt_gitio::Glab;

use crate::description::{described_on, fetch_description};
use crate::project::Project;
use crate::query::links_args;
use crate::{GitLabRepository, MergeRequestIid, WebPage};

use lookup::{Fetch, Part, Shown, calls, looked_up};
use target::{Namespace, Server, Target, reference, target_of};

/// How reading the epics, issues and commits a merge request's description links to ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LinksReply {
    /// The description's links, looked up.
    Read {
        /// The links.
        links: DescriptionLinks,
    },
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn {
        /// glab's first line, which names the instance.
        detail: String,
    },
    /// glab's or GitLab's words, `page.rs` `NO_MERGE_REQUEST` or `NO_PROJECT`.
    Failed {
        /// What went wrong.
        message: String,
    },
}

/// Every epic, issue and commit the description links to, each once, each group in the order of first mention.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionLinks {
    /// The epics.
    pub epics: Vec<LinkedEpic>,
    /// The issues, tasks, incidents and other work items that are not epics.
    pub issues: Vec<LinkedIssue>,
    /// The commits and commit ranges.
    pub commits: Vec<LinkedCommit>,
}

/// An epic the description links to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LinkedEpic {
    /// As GitLab writes it from the merge request's project: `&3`, `group/sub&3`.
    pub reference: String,
    /// Its first mention's address, as the description resolved it.
    pub page: WebPage,
    /// None: GitLab did not show it to this user ("Not found or no access").
    pub shown: Option<ShownEpic>,
}

/// What GitLab shows of an epic.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ShownEpic {
    /// Its title.
    pub title: String,
    /// Whether it is closed.
    pub closed: bool,
}

/// An issue the description links to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LinkedIssue {
    /// As GitLab writes it from the merge request's project: `#12`, `web#12`, `other/lib#12`.
    pub reference: String,
    /// Its first mention's address, as the description resolved it.
    pub page: WebPage,
    /// None: GitLab did not show it to this user ("Not found or no access").
    pub shown: Option<ShownIssue>,
}

/// What GitLab shows of an issue. `parent`: the direct parent (an epic, or the issue above a task) when GitLab names
/// one on the project's server.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ShownIssue {
    /// Its title.
    pub title: String,
    /// Whether it is closed.
    pub closed: bool,
    /// Its direct parent.
    pub parent: Option<LinkedParent>,
}

/// An issue's direct parent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LinkedParent {
    /// As GitLab writes it from the merge request's project.
    pub reference: String,
    /// Its title.
    pub title: String,
    /// GitLab's address of it.
    pub page: WebPage,
}

/// A commit or a commit range the description links to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LinkedCommit {
    /// `fa3335f3`, `web@fa3335f3`, `other/lib@fa3335f3`, `a1b2c3d4…e5f6a7b8`.
    pub reference: String,
    /// Its first mention's address, as the description resolved it.
    pub page: WebPage,
    /// GitLab's `title` on its reference link (a commit's first message line; a range's "Commits … through …");
    /// None: GitLab made no reference of it for this user ("Not found or no access").
    pub title: Option<String>,
}

/// Not IPC: what the shell offers before it replies: every line's page and every parent's page, each once.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadLinks {
    /// The reply the window gets.
    pub reply: LinksReply,
    /// The pages its lines and parents open, once each.
    pub pages: Vec<WebPage>,
}

/// A thing the description links to, at its first mention's page.
struct Mention {
    target: Target,
    page: WebPage,
}

/// The links, and what the log line counts besides them.
struct Read {
    links: DescriptionLinks,
    calls: u32,
    score: Option<u32>,
}

/// glab missing → `GlabMissing`; the remembered project; `fetch_description`; `described`; the lookup calls when an
/// issue or epic is linked; the description's or the lookup's failure through `refusal`. `pages` empty unless `Read`.
/// One `tracing::info!`: iid, outcome kind, epics, issues, commits, not shown, calls, the highest `queryComplexity`
/// score; never a title, reference or address.
#[must_use]
pub fn read_links(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> ReadLinks {
    let (reply, pages, calls, score) = match read(repository, glab, iid) {
        Ok(read) => {
            let pages = pages_of(&read.links);
            let links = read.links;
            (LinksReply::Read { links }, pages, read.calls, read.score)
        }
        Err(reply) => (reply, Vec::new(), 0, None),
    };
    log_read(iid, &reply, calls, score);
    ReadLinks { reply, pages }
}

fn read(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
) -> Result<Read, LinksReply> {
    let Some(glab) = glab else {
        return Err(LinksReply::GlabMissing);
    };
    let root = repository.root();
    let project = repository.logged_in_project(glab)?;
    let refused = |message| repository.refusal(glab, message);
    let html = fetch_description(glab, root, &project, iid).map_err(refused)?;
    let mut fetch = |call: &[Part]| {
        let args = links_args(call);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        glab.get(root, &args)
    };
    let read = links_of(&project, iid, &html, &mut fetch).map_err(refused)?;
    Ok(read)
}

/// The links of merge request `iid`'s description `html`, looked up through `fetch` when an issue or epic is
/// linked; nothing counts off https.
fn links_of(
    project: &Project,
    iid: MergeRequestIid,
    html: &str,
    fetch: &mut Fetch,
) -> Result<Read, String> {
    let Some(server) = Server::of(project) else {
        return Ok(Read {
            links: DescriptionLinks::default(),
            calls: 0,
            score: None,
        });
    };
    let described = described_on(project, iid, html);
    let mentions = mentioned(&server, &described.pages);
    let calls = calls(parts_of(&mentions));
    let looked = looked_up(&calls, &server, &project.full_path, fetch)?;
    let links = grouped(
        mentions,
        looked.shown,
        &described.commit_titles,
        &project.full_path,
    );
    Ok(Read {
        links,
        calls: looked.calls,
        score: looked.score,
    })
}

/// Each mention in its group, in order: an item shown as an epic → Epics, as anything else → Issues; one not shown
/// → Epics for a group's, Issues for a project's; commits and ranges → Commits, titled from `commit_titles`.
fn grouped(
    mentions: Vec<Mention>,
    mut shown: BTreeMap<(Namespace, u64), Shown>,
    commit_titles: &BTreeMap<WebPage, String>,
    project: &str,
) -> DescriptionLinks {
    let mut links = DescriptionLinks::default();
    for Mention { target, page } in mentions {
        let (namespace, iid) = match &target {
            Target::Item { namespace, iid } => (namespace, *iid),
            Target::Commit { .. } | Target::Range { .. } => {
                links.commits.push(LinkedCommit {
                    reference: reference(&target, false, project),
                    title: commit_titles.get(&page).cloned(),
                    page,
                });
                continue;
            }
        };
        let epic = |shown| LinkedEpic {
            reference: reference(&target, true, project),
            page: page.clone(),
            shown,
        };
        let issue = |shown| LinkedIssue {
            reference: reference(&target, false, project),
            page: page.clone(),
            shown,
        };
        match (shown.remove(&(namespace.clone(), iid)), namespace) {
            (Some(Shown::Epic(found)), _) => links.epics.push(epic(Some(found))),
            (Some(Shown::Issue(found)), _) => links.issues.push(issue(Some(found))),
            (None, Namespace::Group(_)) => links.epics.push(epic(None)),
            (None, Namespace::Project(_)) => links.issues.push(issue(None)),
        }
    }
    links
}

/// Each thing `pages` name on the server, once, at its first page.
fn mentioned(server: &Server, pages: &[WebPage]) -> Vec<Mention> {
    let mut mentions: Vec<Mention> = Vec::new();
    for page in pages {
        let Some(target) = target_of(server, page) else {
            continue;
        };
        if !mentions
            .iter()
            .any(|mention| mention.target.is_same(&target))
        {
            mentions.push(Mention {
                target,
                page: page.clone(),
            });
        }
    }
    mentions
}

/// The items' iids by namespace, each in order of first mention.
fn parts_of(mentions: &[Mention]) -> Vec<Part> {
    let mut parts: Vec<Part> = Vec::new();
    for mention in mentions {
        let Target::Item { namespace, iid } = &mention.target else {
            continue;
        };
        match parts.iter_mut().find(|part| part.namespace == *namespace) {
            Some(part) => part.iids.push(*iid),
            None => parts.push(Part {
                namespace: namespace.clone(),
                iids: vec![*iid],
            }),
        }
    }
    parts
}

/// Every line's page, then each issue's parent's after its line, once each.
fn pages_of(links: &DescriptionLinks) -> Vec<WebPage> {
    let mut pages = Vec::new();
    let mut offer = |page: &WebPage| {
        if !pages.contains(page) {
            pages.push(page.clone());
        }
    };
    for epic in &links.epics {
        offer(&epic.page);
    }
    for issue in &links.issues {
        offer(&issue.page);
        if let Some(parent) = issue.shown.as_ref().and_then(|shown| shown.parent.as_ref()) {
            offer(&parent.page);
        }
    }
    for commit in &links.commits {
        offer(&commit.page);
    }
    pages
}

/// Counts and GitLab's score only: never a title, a reference or an address.
fn log_read(iid: MergeRequestIid, reply: &LinksReply, calls: u32, score: Option<u32>) {
    let [epics, issues, commits, not_shown] = counts(reply);
    tracing::info!(
        iid = iid.0,
        outcome = outcome(reply),
        epics,
        issues,
        commits,
        not_shown,
        calls,
        score,
        "read a merge request's links"
    );
}

/// The reply's epics, issues, commits and lines GitLab did not show; all 0 unless `Read`.
fn counts(reply: &LinksReply) -> [usize; 4] {
    match reply {
        LinksReply::Read { links } => {
            let epics = links.epics.iter().filter(|epic| epic.shown.is_none());
            let issues = links.issues.iter().filter(|issue| issue.shown.is_none());
            let commits = links.commits.iter().filter(|commit| commit.title.is_none());
            let not_shown = epics.count() + issues.count() + commits.count();
            [
                links.epics.len(),
                links.issues.len(),
                links.commits.len(),
                not_shown,
            ]
        }
        LinksReply::GlabMissing | LinksReply::NotLoggedIn { .. } | LinksReply::Failed { .. } => {
            [0; 4]
        }
    }
}

/// The reply's kind, as the log names it.
fn outcome(reply: &LinksReply) -> &'static str {
    match reply {
        LinksReply::Read { .. } => "read",
        LinksReply::GlabMissing => "glabMissing",
        LinksReply::NotLoggedIn { .. } => "notLoggedIn",
        LinksReply::Failed { .. } => "failed",
    }
}

#[cfg(test)]
mod tests;
