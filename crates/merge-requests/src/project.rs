use std::path::Path;

use serde::Deserialize;
use yamt_gitio::Glab;

use crate::web_page::HTTPS;

/// glab fills `:fullpath` with the project of the folder's remotes (glab docs, `glab api`).
const PROJECT_ROUTE: &str = "projects/:fullpath";

/// The GitLab project of the repository's remotes.
pub(crate) struct Project {
    pub full_path: String,
    /// `https://<host[:port]>` of its web page; `None` when GitLab is not on https.
    pub web_origin: Option<String>,
}

#[derive(Deserialize)]
struct ProjectAnswer {
    path_with_namespace: String,
    web_url: String,
}

pub(crate) fn project(glab: &Glab, root: &Path) -> Result<Project, String> {
    let json = glab.get(root, &["api", PROJECT_ROUTE])?;
    project_from(&json)
}

fn project_from(json: &[u8]) -> Result<Project, String> {
    let answer: ProjectAnswer = serde_json::from_slice(json)
        .map_err(|error| format!("GitLab's project answer is not what yamt expects: {error}"))?;
    Ok(Project {
        full_path: answer.path_with_namespace,
        web_origin: web_origin(&answer.web_url),
    })
}

fn web_origin(web_url: &str) -> Option<String> {
    let authority = web_url.strip_prefix(HTTPS)?.split('/').next()?;
    Some(format!("{HTTPS}{authority}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_full_path_and_the_https_origin_come_from_the_project() {
        let json = br#"{"id":7,"path_with_namespace":"taskboard/taskboard","web_url":"https://gitlab.example:8443/taskboard/taskboard"}"#;

        let project = project_from(json).unwrap();

        assert_eq!(project.full_path, "taskboard/taskboard");
        assert_eq!(
            project.web_origin.as_deref(),
            Some("https://gitlab.example:8443")
        );
    }

    #[test]
    fn a_gitlab_on_http_has_no_origin_and_a_strange_answer_is_an_error() {
        assert_eq!(
            web_origin("http://gitlab.example/taskboard/taskboard"),
            None
        );
        let refused = project_from(br#"{"message":"404 Project Not Found"}"#);
        assert!(refused.is_err());
    }
}
