use std::path::Path;

use yamt_gitio::{RemoteUrl, Repo};

use crate::GitLabProject;

const GITLAB_LABEL_START: &str = "gitlab";
const SCHEME_END: &str = "://";
const FILE_SCHEME: &str = "file";
/// glab's own variables naming a self-managed GitLab (glab docs, "Environment variables").
const GLAB_HOST_VARIABLES: [&str; 2] = ["GITLAB_HOST", "GL_HOST"];

/// A repository with a remote on a GitLab server, found without the network.
pub struct GitLabRepository {
    repo: Repo,
    repository: String,
    gitlab_remotes: Vec<Remote>,
}

/// A remote's name and URL: lossy UTF-8 of git's bytes.
pub(crate) struct Remote {
    pub name: String,
    pub url: String,
}

/// The repository holding `folder` when one of its remotes is on a GitLab server; `None` otherwise.
#[must_use]
pub fn gitlab_repository(folder: &Path) -> Option<GitLabRepository> {
    let repo = Repo::discover(folder)
        .inspect_err(|error| tracing::info!(%error, "no git repository, so no merge requests"))
        .ok()?;
    let urls = repo
        .remote_urls()
        .inspect_err(|error| tracing::warn!(%error, "cannot read the remotes"))
        .ok()?;
    let common_dir = repo
        .common_dir()
        .inspect_err(|error| tracing::warn!(%error, "cannot find the common git dir"))
        .ok()?;
    let remotes = urls.into_iter().map(Remote::from).collect();
    let gitlab_remotes = gitlab_remotes(remotes, glab_host().as_deref());
    let first = gitlab_remotes.first()?;
    tracing::info!(remote = %first.name, "a remote on GitLab");
    Some(GitLabRepository {
        repo,
        repository: common_dir.to_string_lossy().into_owned(),
        gitlab_remotes,
    })
}

/// The remotes on a GitLab server, in config order.
pub(crate) fn gitlab_remotes(remotes: Vec<Remote>, glab_host: Option<&str>) -> Vec<Remote> {
    let is_on_gitlab = |remote: &Remote| {
        remote_host(&remote.url).is_some_and(|host| is_gitlab_host(&host, glab_host))
    };
    remotes.into_iter().filter(is_on_gitlab).collect()
}

impl GitLabRepository {
    /// What the window is told at start.
    #[must_use]
    pub fn project(&self) -> GitLabProject {
        GitLabProject::Found {
            repository: self.repository.clone(),
        }
    }

    /// The repository's root: glab and git run there.
    #[must_use]
    pub fn root(&self) -> &Path {
        self.repo().root()
    }

    /// Its remotes on a GitLab server, in config order.
    pub(crate) fn gitlab_remotes(&self) -> &[Remote] {
        &self.gitlab_remotes
    }

    pub(crate) fn repo(&self) -> &Repo {
        &self.repo
    }
}

impl From<RemoteUrl> for Remote {
    fn from(remote: RemoteUrl) -> Remote {
        Remote {
            name: String::from_utf8_lossy(&remote.name).into_owned(),
            url: String::from_utf8_lossy(&remote.url).into_owned(),
        }
    }
}

/// The host in `GITLAB_HOST`, else `GL_HOST`: a host, `host:port` or a URL.
fn glab_host() -> Option<String> {
    let set = |name: &&str| std::env::var(name).ok().filter(|value| !value.is_empty());
    let value = GLAB_HOST_VARIABLES.iter().find_map(set)?;
    Some(remote_host(&value).unwrap_or_else(|| value.to_ascii_lowercase()))
}

/// The server a remote URL names (git-clone(1) "GIT URLS"), lowercase; `None` for a local path or `file://`.
fn remote_host(url: &str) -> Option<String> {
    let authority = match url.split_once(SCHEME_END) {
        Some((scheme, _)) if scheme.eq_ignore_ascii_case(FILE_SCHEME) => return None,
        Some((_, rest)) => rest.split('/').next()?,
        None => scp_authority(url)?,
    };
    let host_and_port = authority
        .rsplit_once('@')
        .map_or(authority, |(_, host)| host);
    let host = host_and_port.split(':').next()?;
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

/// git reads `[user@]host:path` as scp-like when the colon comes before any slash; a single letter before it is a
/// Windows drive (git-clone(1) "GIT URLS").
fn scp_authority(url: &str) -> Option<&str> {
    let (before, _) = url.split_once(':')?;
    let is_path = before.contains(['/', '\\']) || before.len() == 1;
    (!is_path).then_some(before)
}

/// A host is GitLab's when one of its dot-separated labels starts with "gitlab" (gitlab.com included), or when glab
/// is set up for it (`GITLAB_HOST`).
fn is_gitlab_host(host: &str, glab_host: Option<&str>) -> bool {
    let named_gitlab = host
        .split('.')
        .any(|label| label.starts_with(GITLAB_LABEL_START));
    named_gitlab || glab_host == Some(host)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_host_comes_from_scp_like_ssh_and_https_urls_without_user_or_port() {
        let hosts = [
            (
                "git@gitlab.example:taskboard/taskboard.git",
                "gitlab.example",
            ),
            (
                "ssh://git@GitLab.Example:2222/taskboard/taskboard",
                "gitlab.example",
            ),
            (
                "https://sam:token@gitlab.com/taskboard/taskboard.git",
                "gitlab.com",
            ),
            ("https://gitlab.example:8443", "gitlab.example"),
            ("gitlab.example:taskboard", "gitlab.example"),
        ];
        for (url, host) in hosts {
            assert_eq!(remote_host(url).as_deref(), Some(host), "{url}");
        }
    }

    #[test]
    fn a_local_path_a_file_url_or_a_drive_letter_has_no_host() {
        let local = [
            "/srv/git/taskboard.git",
            "../taskboard",
            "./with:colon",
            "file:///srv/git/taskboard.git",
            "FILE://gitlab.example/x",
            r"C:\repo",
            "C:/repo",
            r"..\x:y",
            "https:///no-host",
            "git@:path",
        ];
        for url in local {
            assert_eq!(remote_host(url), None, "{url}");
        }
    }

    #[test]
    fn gitlab_hosts_are_gitlab_com_a_label_starting_with_gitlab_or_glab_s_host() {
        for host in ["gitlab.com", "gitlab.example", "code.gitlab-int.corp"] {
            assert!(is_gitlab_host(host, None), "{host}");
        }
        for host in ["github.com", "my-gitlab.com", "notgitlab.example"] {
            assert!(!is_gitlab_host(host, None), "{host}");
        }
        assert!(is_gitlab_host("git.corp.example", Some("git.corp.example")));
        assert!(!is_gitlab_host(
            "git.corp.example",
            Some("git.other.example")
        ));
    }
}
