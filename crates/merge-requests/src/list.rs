use std::collections::{BTreeMap, BTreeSet};

use yamt_gitio::Glab;

use crate::check::{ConflictCheck, RowToCheck};
use crate::page::{ParsedPage, parsed};
use crate::people::warn_unknown_review_state;
use crate::query::list_args;
use crate::{
    GitLabRepository, ListEnd, MAX_MERGE_REQUESTS, MergeRequestPage, PAGE_SIZE, PictureAddress,
};

const MAX_PAGES: u32 = MAX_MERGE_REQUESTS / PAGE_SIZE;

/// How a load ended, and the rows it sent, for the local check.
pub struct Listed {
    /// How the load ended.
    pub end: ListEnd,
    /// `None` when no project was reached (no glab, logged out, no project); else every row of every page sent.
    pub to_check: Option<ConflictCheck>,
}

/// One person's uploaded picture a list offered: the window asks for it by username.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfferedPicture {
    /// Whose picture it is.
    pub username: String,
    /// Where it is on the project's GitLab.
    pub address: PictureAddress,
}

/// One page of the list as the shell gets it: what the window sees, and the uploaded pictures it offers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ListedPage {
    /// What the window sees.
    pub page: MergeRequestPage,
    /// The uploaded pictures of the page's people, one per username.
    pub pictures: Vec<OfferedPicture>,
}

/// The project's open merge requests, newest created first: each page goes to `on_page` as it arrives, one glab call
/// (and one deadline) per page, at most `MAX_MERGE_REQUESTS`.
pub fn list_merge_requests(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    on_page: &dyn Fn(ListedPage),
) -> Listed {
    let unreached = |end| Listed {
        end,
        to_check: None,
    };
    let Some(glab) = glab else {
        return unreached(ListEnd::GlabMissing);
    };
    let root = repository.root();
    let project = match repository.logged_in_project(glab) {
        Ok(project) => project,
        Err(refused) => return unreached(refused.into()),
    };
    let mut fetch = |after: Option<&str>| {
        let args = list_args(&project.full_path, after);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let json = glab.get(root, &args)?;
        parsed(&json, &project)
    };
    let (mut end, rows) = pages(&mut fetch, on_page);
    if let ListEnd::Failed { message } = end {
        end = repository.refusal(glab, message).into();
    }
    let to_check = ConflictCheck {
        full_path: project.full_path,
        rows,
    };
    Listed {
        end,
        to_check: Some(to_check),
    }
}

/// Fetches page after page, each after the cursor the one before ended at; the pages sent stay whatever comes next.
/// Returns the end and the check inputs of every row sent.
fn pages(
    fetch: &mut dyn FnMut(Option<&str>) -> Result<ParsedPage, String>,
    on_page: &dyn Fn(ListedPage),
) -> (ListEnd, Vec<RowToCheck>) {
    let mut to_check = Vec::new();
    let mut warned_states = BTreeSet::new();
    let mut after: Option<String> = None;
    for number in 1..=MAX_PAGES {
        let page = match fetch(after.as_deref()) {
            Ok(page) => page,
            Err(message) => return (ListEnd::Failed { message }, to_check),
        };
        if let (1, Some(complexity)) = (number, page.complexity) {
            tracing::info!(
                score = complexity.score,
                limit = complexity.limit,
                "GitLab's complexity of the merge-request query"
            );
        }
        for state in newly_seen(&mut warned_states, page.unknown_review_states) {
            warn_unknown_review_state(&state);
        }
        on_page(ListedPage {
            page: MergeRequestPage {
                me: page.me,
                rows: page.rows,
            },
            pictures: one_per_username(page.pictures),
        });
        to_check.extend(page.to_check);
        match page.next {
            Some(cursor) => after = Some(cursor),
            None => return (ListEnd::Loaded, to_check),
        }
    }
    let end = ListEnd::Cut {
        limit: MAX_MERGE_REQUESTS,
    };
    (end, to_check)
}

/// The pictures by username, the last one of each.
pub(crate) fn one_per_username(pictures: Vec<OfferedPicture>) -> Vec<OfferedPicture> {
    let mut addresses = BTreeMap::new();
    for picture in pictures {
        addresses.insert(picture.username, picture.address);
    }
    let pictures = addresses.into_iter();
    pictures
        .map(|(username, address)| OfferedPicture { username, address })
        .collect()
}

/// The states not in `seen`, now added to it: each unknown review state is warned of once per load.
fn newly_seen(seen: &mut BTreeSet<String>, states: BTreeSet<String>) -> Vec<String> {
    let mut new = Vec::new();
    for state in states {
        if !seen.contains(&state) {
            seen.insert(state.clone());
            new.push(state);
        }
    }
    new
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;

    use super::*;
    use crate::picture::{AvatarSource, avatar_source};
    use crate::readiness::GitLabMerge;
    use crate::{MergeRequestIid, MergeRequestRow, Readiness};

    fn row(iid: u32) -> MergeRequestRow {
        MergeRequestRow {
            iid: MergeRequestIid(iid),
            title: format!("MR {iid}"),
            has_description: false,
            created_at: "2026-10-30T00:00:00Z".to_owned(),
            draft: false,
            author: None,
            assignees: Vec::new(),
            reviewers: Vec::new(),
            labels: Vec::new(),
            open_discussions: 0,
            approved_by: Vec::new(),
            may_rerequest: false,
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
        let to_check = RowToCheck {
            iid: MergeRequestIid(number),
            target_branch: "main".to_owned(),
            head: None,
            gitlab: GitLabMerge::read(None, false, false),
        };
        Ok(ParsedPage {
            me: Some("sam".to_owned()),
            rows: vec![row(number)],
            to_check: vec![to_check],
            pictures: Vec::new(),
            unknown_review_states: BTreeSet::new(),
            next: (number < last).then(|| format!("cursor-{}", number + 1)),
            complexity: None,
        })
    }

    /// The end, each cursor asked with, and the merge requests sent, page by page; checks that the rows to check are
    /// exactly the rows sent.
    fn listed(last: u32, fails_at: Option<u32>) -> (ListEnd, Vec<Option<String>>, Vec<Vec<u32>>) {
        let mut asked = Vec::new();
        let (sender, sent) = mpsc::channel();
        let mut fetch = |after: Option<&str>| {
            asked.push(after.map(str::to_owned));
            answer(after, last, fails_at)
        };
        let on_page = |listed: ListedPage| {
            let iids = listed.page.rows.iter().map(|row| row.iid.0).collect();
            sender.send(iids).unwrap();
        };
        let (end, to_check) = pages(&mut fetch, &on_page);
        let sent: Vec<Vec<u32>> = sent.try_iter().collect();
        let checked: Vec<u32> = to_check.iter().map(|row| row.iid.0).collect();
        assert_eq!(checked, sent.concat());
        (end, asked, sent)
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

    fn offered(username: &str, number: u32) -> OfferedPicture {
        let path = format!("/uploads/-/system/user/avatar/{number}/avatar.png");
        let source = avatar_source(Some("https://gitlab.example"), Some(&path));
        let AvatarSource::Uploaded(address) = source else {
            panic!("{path} is no uploaded avatar");
        };
        OfferedPicture {
            username: username.to_owned(),
            address,
        }
    }

    #[test]
    fn a_page_offers_one_picture_per_username_the_last_one_named() {
        let mut page = answer(None, 1, None).unwrap();
        page.pictures = vec![offered("sam", 1), offered("anna", 2), offered("sam", 3)];
        let mut once = Some(page);
        let (sender, sent) = mpsc::channel();

        let on_page = |listed: ListedPage| sender.send(listed.pictures).unwrap();
        pages(&mut |_| Ok(once.take().unwrap()), &on_page);

        let sent: Vec<Vec<OfferedPicture>> = sent.try_iter().collect();
        assert_eq!(sent, [vec![offered("anna", 2), offered("sam", 3)]]);
    }

    #[test]
    fn each_unknown_review_state_is_new_once_per_load() {
        let mut seen = BTreeSet::new();
        let states = |names: &[&str]| names.iter().map(|name| (*name).to_owned()).collect();

        assert_eq!(newly_seen(&mut seen, states(&["B", "A"])), ["A", "B"]);
        assert_eq!(newly_seen(&mut seen, states(&["A", "C"])), ["C"]);
        assert_eq!(newly_seen(&mut seen, states(&["C"])), Vec::<String>::new());
    }
}
