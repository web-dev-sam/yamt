use yamt_gitio::Glab;

use crate::page::{ParsedPage, parsed};
use crate::project::logged_in_project;
use crate::query::list_args;
use crate::{GitLabRepository, ListEnd, MAX_MERGE_REQUESTS, MergeRequestPage, PAGE_SIZE};

const MAX_PAGES: u32 = MAX_MERGE_REQUESTS / PAGE_SIZE;

/// The project's open merge requests, newest created first: each page goes to `on_page` as it arrives, one glab call
/// (and one deadline) per page, at most `MAX_MERGE_REQUESTS`.
pub fn list_merge_requests(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    on_page: &dyn Fn(MergeRequestPage),
) -> ListEnd {
    let Some(glab) = glab else {
        return ListEnd::GlabMissing;
    };
    let root = repository.root();
    let project = match logged_in_project(glab, root) {
        Ok(project) => project,
        Err(refused) => return refused.into(),
    };
    let mut fetch = |after: Option<&str>| {
        let args = list_args(&project.full_path, after);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let json = glab.get(root, &args)?;
        parsed(&json, &project)
    };
    pages(&mut fetch, on_page)
}

/// Fetches page after page, each after the cursor the one before ended at; the pages sent stay whatever comes next.
fn pages(
    fetch: &mut dyn FnMut(Option<&str>) -> Result<ParsedPage, String>,
    on_page: &dyn Fn(MergeRequestPage),
) -> ListEnd {
    let mut after: Option<String> = None;
    for number in 1..=MAX_PAGES {
        let page = match fetch(after.as_deref()) {
            Ok(page) => page,
            Err(message) => return ListEnd::Failed { message },
        };
        if let (1, Some(complexity)) = (number, page.complexity) {
            tracing::info!(
                score = complexity.score,
                limit = complexity.limit,
                "GitLab's complexity of the merge-request query"
            );
        }
        on_page(MergeRequestPage {
            me: page.me,
            rows: page.rows,
        });
        match page.next {
            Some(cursor) => after = Some(cursor),
            None => return ListEnd::Loaded,
        }
    }
    ListEnd::Cut {
        limit: MAX_MERGE_REQUESTS,
    }
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;

    use super::*;
    use crate::{MergeRequestIid, MergeRequestRow, Readiness};

    fn row(iid: u32) -> MergeRequestRow {
        MergeRequestRow {
            iid: MergeRequestIid(iid),
            title: format!("MR {iid}"),
            created_at: "2026-10-30T00:00:00Z".to_owned(),
            draft: false,
            assignees: Vec::new(),
            reviewers: Vec::new(),
            labels: Vec::new(),
            open_discussions: 0,
            approvals: 0,
            pipeline: None,
            page: None,
            size: None,
            readiness: Readiness::Ready,
            from_fork: false,
        }
    }

    /// Page `n` (from 1) holds the merge request numbered `n`, and names `cursor-<n+1>` as the next while `n` is
    /// below `last`; page `fails_at` fails.
    fn answer(after: Option<&str>, last: u32, fails_at: Option<u32>) -> Result<ParsedPage, String> {
        let number = after.map_or(1, |cursor| cursor["cursor-".len()..].parse().unwrap());
        if fails_at == Some(number) {
            return Err(format!("page {number} failed"));
        }
        Ok(ParsedPage {
            me: Some("sam".to_owned()),
            rows: vec![row(number)],
            next: (number < last).then(|| format!("cursor-{}", number + 1)),
            complexity: None,
        })
    }

    /// The end, each cursor asked with, and the merge requests sent, page by page.
    fn listed(last: u32, fails_at: Option<u32>) -> (ListEnd, Vec<Option<String>>, Vec<Vec<u32>>) {
        let mut asked = Vec::new();
        let (sender, sent) = mpsc::channel();
        let mut fetch = |after: Option<&str>| {
            asked.push(after.map(str::to_owned));
            answer(after, last, fails_at)
        };
        let on_page = |page: MergeRequestPage| {
            let iids = page.rows.iter().map(|row| row.iid.0).collect();
            sender.send(iids).unwrap();
        };
        let end = pages(&mut fetch, &on_page);
        (end, asked, sent.try_iter().collect())
    }

    #[test]
    fn each_page_is_asked_after_the_cursor_the_one_before_ended_at() {
        let (end, asked, sent) = listed(2, None);

        assert_eq!(end, ListEnd::Loaded);
        assert_eq!(asked, [None, Some("cursor-2".to_owned())]);
        assert_eq!(sent, [[1], [2]]);
    }

    #[test]
    fn five_full_pages_with_more_to_come_are_cut_at_500_without_a_sixth_call() {
        let (end, asked, sent) = listed(6, None);

        assert_eq!(end, ListEnd::Cut { limit: 500 });
        assert_eq!(asked.len(), 5);
        assert_eq!(sent, [[1], [2], [3], [4], [5]]);
        let (exactly_five, _, _) = listed(5, None);
        assert_eq!(exactly_five, ListEnd::Loaded);
    }

    #[test]
    fn a_failing_page_ends_the_list_and_the_pages_sent_before_stay_sent() {
        let (end, asked, sent) = listed(4, Some(3));

        let message = "page 3 failed".to_owned();
        assert_eq!(end, ListEnd::Failed { message });
        assert_eq!(asked.len(), 3);
        assert_eq!(sent, [[1], [2]]);
    }
}
