use crate::JobPage;

const HTTPS: &str = "https://";
const JOBS_SEGMENT: &str = "/-/jobs/";
const PARENT_SEGMENT: &str = "..";

impl JobPage {
    /// The job log page `web_path` names on the GitLab at `origin` (`https://<host[:port]>`); `None` for any other
    /// origin or path, so a page never leaves the project's GitLab.
    pub(crate) fn built(origin: &str, web_path: &str) -> Option<JobPage> {
        let authority = origin.strip_prefix(HTTPS)?;
        let (project, job) = web_path.rsplit_once(JOBS_SEGMENT)?;
        let is_page = is_authority(authority) && is_project_path(project) && is_number(job);
        is_page.then(|| JobPage(format!("{origin}{web_path}")))
    }

    /// The page's address.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

fn is_authority(authority: &str) -> bool {
    let is_host_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':');
    !authority.is_empty() && authority.chars().all(is_host_char)
}

/// `/<group>/<project>`: URL path characters only, no empty or `..` segment.
fn is_project_path(path: &str) -> bool {
    let Some(segments) = path.strip_prefix('/') else {
        return false;
    };
    let is_path_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '~' | '-');
    let is_segment = |segment: &str| {
        !segment.is_empty() && segment != PARENT_SEGMENT && segment.chars().all(is_path_char)
    };
    segments.split('/').all(is_segment)
}

fn is_number(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGIN: &str = "https://gitlab.example";

    fn built(origin: &str, web_path: &str) -> Option<String> {
        JobPage::built(origin, web_path).map(|page| page.as_str().to_owned())
    }

    #[test]
    fn a_job_path_on_an_https_gitlab_is_its_page() {
        let page = built(ORIGIN, "/taskboard/taskboard/-/jobs/301");
        assert_eq!(
            page.as_deref(),
            Some("https://gitlab.example/taskboard/taskboard/-/jobs/301")
        );
        let with_port = built("https://gitlab-2.example:8443", "/a/b.c_d~e-f/-/jobs/7");
        assert_eq!(
            with_port.as_deref(),
            Some("https://gitlab-2.example:8443/a/b.c_d~e-f/-/jobs/7")
        );
    }

    #[test]
    fn another_origin_or_an_odd_path_is_no_page() {
        let origins = [
            "http://gitlab.example",
            "https://",
            "https://sam@gitlab.example",
            "https://gitlab.example/",
        ];
        for origin in origins {
            assert_eq!(built(origin, "/a/b/-/jobs/1"), None, "{origin}");
        }
        let paths = [
            "//evil.example/a/-/jobs/1",
            "/a/../../b/-/jobs/1",
            "/a/-/jobs/1?x=1",
            "/a/-/jobs/1#log",
            "/a/-/jobs/",
            "/a/-/jobs/-1",
            "/a/-/pipelines/1",
            "a/-/jobs/1",
            "https://evil.example/a/-/jobs/1",
            "/-/jobs/1",
            "/a b/-/jobs/1",
        ];
        for path in paths {
            assert_eq!(built(ORIGIN, path), None, "{path}");
        }
    }
}
