use crate::detect::Remote;

const GIT_SUFFIX: &str = ".git";

/// The first remote, in config order, whose URL names the project `full_path` (`group/project`): it ends in
/// `/<full_path>` or, scp-like, `:<full_path>`, with or without `.git` and a final `/`, in any case.
pub(crate) fn remote_for<'a>(remotes: &'a [Remote], full_path: &str) -> Option<&'a Remote> {
    let project = full_path.to_ascii_lowercase();
    remotes
        .iter()
        .find(|remote| names_project(&remote.url, &project))
}

fn names_project(url: &str, project: &str) -> bool {
    let url = url.trim_end_matches('/').to_ascii_lowercase();
    let url = url.strip_suffix(GIT_SUFFIX).unwrap_or(&url);
    url.strip_suffix(project)
        .is_some_and(|before| before.ends_with('/') || before.ends_with(':'))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROJECT: &str = "taskboard/taskboard";

    fn remote(name: &str, url: &str) -> Remote {
        Remote {
            name: name.to_owned(),
            url: url.to_owned(),
        }
    }

    fn found(remotes: &[Remote], full_path: &str) -> Option<String> {
        remote_for(remotes, full_path).map(|remote| remote.name.clone())
    }

    #[test]
    fn scp_like_https_and_ssh_urls_name_the_project_with_or_without_git_and_a_slash() {
        let urls = [
            "git@gitlab.example:taskboard/taskboard.git",
            "git@gitlab.example:taskboard/taskboard",
            "https://gitlab.example/taskboard/taskboard.git",
            "https://gitlab.example/taskboard/taskboard/",
            "https://gitlab.example/taskboard/taskboard.git/",
            "ssh://git@gitlab.example:2222/taskboard/taskboard.git",
            "https://gitlab.example/TaskBoard/TaskBoard.GIT",
        ];
        for url in urls {
            assert_eq!(
                found(&[remote("origin", url)], PROJECT).as_deref(),
                Some("origin"),
                "{url}"
            );
        }
        let upper = [remote(
            "origin",
            "https://gitlab.example/taskboard/taskboard",
        )];
        assert_eq!(
            found(&upper, "TaskBoard/TaskBoard").as_deref(),
            Some("origin")
        );
    }

    #[test]
    fn another_project_is_not_the_project() {
        let urls = [
            "https://gitlab.example/taskboard/taskboard-fork.git",
            "https://gitlab.example/my-taskboard/taskboard.git",
            "https://gitlab.example/group/taskboard/taskboard-x",
            "gitlab.example:mytaskboard/taskboard",
        ];
        for url in urls {
            assert_eq!(found(&[remote("origin", url)], PROJECT), None, "{url}");
        }
    }

    #[test]
    fn the_first_matching_remote_in_config_order_is_chosen() {
        let remotes = [
            remote("fork", "https://gitlab.example/sam/taskboard.git"),
            remote("upstream", "https://gitlab.example/taskboard/taskboard.git"),
            remote("mirror", "git@gitlab.example:taskboard/taskboard.git"),
        ];
        assert_eq!(found(&remotes, PROJECT).as_deref(), Some("upstream"));
    }
}
