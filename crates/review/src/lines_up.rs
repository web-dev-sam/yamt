use yamt_gitio::Oid;
use yamt_range::Compared;

use crate::gitlab::{DiffRefs, Listed, MergeRequest};
use crate::{LookedAt, MergeRequestRef, NotLinedUp};

const MAX_MERGE_REQUESTS_CHECKED: usize = 5;
/// git's default abbreviation.
const SHORT_ID_CHARS: usize = 7;

/// The merge requests whose details were fetched, and what they were looked up by.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Found {
    pub(crate) looked_at: LookedAt,
    pub(crate) merge_requests: Vec<MergeRequest>,
}

/// The merge request whose diff is the window's, with the commits a position names.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LinedUp {
    pub(crate) merge_request: MergeRequest,
    pub(crate) diff_refs: DiffRefs,
}

/// The merge requests worth fetching: from a branch, every listed one (GitLab filtered them); for a commit, the
/// open ones whose head is `right`.
pub(crate) fn candidates(listed: Vec<Listed>, looked_at: &LookedAt, right: &Oid) -> Vec<Listed> {
    let mut kept: Vec<Listed> = match looked_at {
        LookedAt::Branch { .. } => listed,
        LookedAt::Commit { .. } => listed
            .into_iter()
            .filter(|request| request.is_open && request.head == right.as_str())
            .collect(),
    };
    kept.truncate(MAX_MERGE_REQUESTS_CHECKED);
    kept
}

/// One lines up when GitLab's diff goes from the left commit to the right one; `start_sha` is not compared.
pub(crate) fn lines_up(compared: &Compared, found: Found) -> Result<LinedUp, NotLinedUp> {
    for request in &found.merge_requests {
        if let Some(diff_refs) = &request.diff_refs
            && diff_refs.base_sha == compared.left.as_str()
            && diff_refs.head_sha == compared.right.as_str()
        {
            return Ok(LinedUp {
                merge_request: request.clone(),
                diff_refs: diff_refs.clone(),
            });
        }
    }
    let Found {
        looked_at,
        merge_requests,
    } = found;
    match merge_requests.as_slice() {
        [] => Err(NotLinedUp::NoMergeRequest { looked_at }),
        [only] => Err(why_it_does_not(compared, only)),
        several => Err(NotLinedUp::Several {
            looked_at,
            references: several
                .iter()
                .map(|request| request.named.reference.clone())
                .collect(),
        }),
    }
}

fn why_it_does_not(compared: &Compared, request: &MergeRequest) -> NotLinedUp {
    let merge_request: MergeRequestRef = request.named.clone();
    let Some(diff_refs) = &request.diff_refs else {
        return NotLinedUp::Preparing { merge_request };
    };
    if diff_refs.head_sha != compared.right.as_str() {
        return NotLinedUp::Moved {
            merge_request,
            gitlab_head: short_id(&diff_refs.head_sha),
            shown_head: short_id(compared.right.as_str()),
        };
    }
    NotLinedUp::OtherBase {
        merge_request,
        gitlab_base: short_id(&diff_refs.base_sha),
        shown_base: short_id(compared.left.as_str()),
    }
}

pub(crate) fn short_id(sha: &str) -> String {
    sha.get(..SHORT_ID_CHARS).unwrap_or(sha).to_owned()
}

#[cfg(test)]
mod tests {
    use yamt_range::RangeSideLabel;

    use super::*;
    use crate::gitlab::{listed_from, merge_request_from};

    const MERGE_BASE: &str = "531ea52dfb892e20206010fb6cd6161d9c88964a";
    const MAIN: &str = "437805506eab02eaba409bdeffd00e0383476e35";
    const FEATURE: &str = "9c1ba3fc606a3776061d23006b83e2af2a357112";

    fn compared(left: &str, right: &str) -> Compared {
        Compared {
            left: Oid::parse(left).unwrap(),
            right: Oid::parse(right).unwrap(),
            right_label: RangeSideLabel::Named {
                name: "feature".to_owned(),
            },
        }
    }

    fn branch() -> LookedAt {
        LookedAt::Branch {
            name: "feature".to_owned(),
        }
    }

    fn recorded(scenario: &str, file: &str) -> Vec<u8> {
        let path = format!(
            "{}/../../tests/glab/{scenario}/{file}",
            env!("CARGO_MANIFEST_DIR")
        );
        std::fs::read(path).unwrap()
    }

    fn merge_request(scenario: &str, file: &str) -> MergeRequest {
        merge_request_from(&recorded(scenario, file)).unwrap()
    }

    fn found(looked_at: LookedAt, merge_requests: Vec<MergeRequest>) -> Found {
        Found {
            looked_at,
            merge_requests,
        }
    }

    fn checked(compared: &Compared, scenario: &str) -> Result<LinedUp, NotLinedUp> {
        let request = merge_request(scenario, "merge-request.json");
        lines_up(compared, found(branch(), vec![request]))
    }

    fn named(scenario: &str, file: &str) -> MergeRequestRef {
        merge_request(scenario, file).named
    }

    #[test]
    fn three_dots_lines_up_when_base_and_head_are_the_two_commits() {
        let request = merge_request("lined-up", "merge-request.json");
        let lined_up = checked(&compared(MERGE_BASE, FEATURE), "lined-up");
        assert_eq!(
            lined_up,
            Ok(LinedUp {
                diff_refs: DiffRefs {
                    base_sha: MERGE_BASE.to_owned(),
                    start_sha: MAIN.to_owned(),
                    head_sha: FEATURE.to_owned(),
                },
                merge_request: request,
            })
        );
        assert_eq!(
            checked(&compared(MAIN, FEATURE), "lined-up").map(|_| ()),
            Err(NotLinedUp::OtherBase {
                merge_request: named("lined-up", "merge-request.json"),
                gitlab_base: "531ea52".to_owned(),
                shown_base: "4378055".to_owned(),
            })
        );
    }

    #[test]
    fn two_dots_lines_up_only_when_the_left_is_the_merge_base() {
        let from_the_merge_base = checked(&compared(MERGE_BASE, FEATURE), "two-dots");
        assert!(from_the_merge_base.is_ok());
        assert_eq!(
            checked(&compared(MAIN, FEATURE), "two-dots").map(|_| ()),
            Err(NotLinedUp::OtherBase {
                merge_request: named("two-dots", "merge-request.json"),
                gitlab_base: "531ea52".to_owned(),
                shown_base: "4378055".to_owned(),
            })
        );
    }

    #[test]
    fn a_moved_head_names_both_short_ids() {
        assert_eq!(
            checked(&compared(MERGE_BASE, FEATURE), "moved").map(|_| ()),
            Err(NotLinedUp::Moved {
                merge_request: named("moved", "merge-request.json"),
                gitlab_head: "d1e2f3a".to_owned(),
                shown_head: "9c1ba3f".to_owned(),
            })
        );
        assert_eq!(
            checked(&compared(MAIN, FEATURE), "moved").map(|_| ()),
            Err(NotLinedUp::Moved {
                merge_request: named("moved", "merge-request.json"),
                gitlab_head: "d1e2f3a".to_owned(),
                shown_head: "9c1ba3f".to_owned(),
            })
        );
    }

    #[test]
    fn another_base_names_both_short_ids() {
        assert_eq!(
            checked(&compared(MERGE_BASE, FEATURE), "other-base").map(|_| ()),
            Err(NotLinedUp::OtherBase {
                merge_request: named("other-base", "merge-request.json"),
                gitlab_base: "5f9d381".to_owned(),
                shown_base: "531ea52".to_owned(),
            })
        );
    }

    #[test]
    fn no_open_merge_request_from_the_branch() {
        let listed = listed_from(&recorded("no-merge-request", "merge-requests.json")).unwrap();
        let right = Oid::parse(FEATURE).unwrap();
        assert_eq!(candidates(listed, &branch(), &right), Vec::new());
        assert_eq!(
            lines_up(&compared(MERGE_BASE, FEATURE), found(branch(), Vec::new())).map(|_| ()),
            Err(NotLinedUp::NoMergeRequest {
                looked_at: branch()
            })
        );
    }

    #[test]
    fn several_open_merge_requests_take_the_one_that_lines_up() {
        let listed = listed_from(&recorded("several", "merge-requests.json")).unwrap();
        let right = Oid::parse(FEATURE).unwrap();
        let iids: Vec<u64> = candidates(listed, &branch(), &right)
            .iter()
            .map(|request| request.iid)
            .collect();
        assert_eq!(iids, [12, 14]);
        let twelve = merge_request("several", "merge-request.json");
        let fourteen = merge_request("several", "merge-request-14.json");
        let both = found(branch(), vec![twelve.clone(), fourteen.clone()]);
        let lined_up = lines_up(&compared(MERGE_BASE, FEATURE), both);
        assert_eq!(
            lined_up.map(|lined_up| lined_up.merge_request),
            Ok(fourteen.clone())
        );

        let preparing = MergeRequest {
            diff_refs: None,
            ..fourteen
        };
        let neither = found(branch(), vec![twelve, preparing]);
        assert_eq!(
            lines_up(&compared(MERGE_BASE, FEATURE), neither).map(|_| ()),
            Err(NotLinedUp::Several {
                looked_at: branch(),
                references: vec!["!12".to_owned(), "!14".to_owned()],
            })
        );
    }

    #[test]
    fn a_commit_id_side_uses_the_merge_request_ending_at_it() {
        let listed = listed_from(&recorded("commit-route", "merge-requests.json")).unwrap();
        let right = Oid::parse(FEATURE).unwrap();
        let commit = LookedAt::Commit {
            short_id: "9c1ba3f".to_owned(),
        };
        let kept = candidates(listed.clone(), &commit, &right);
        let iids: Vec<u64> = kept.iter().map(|request| request.iid).collect();
        assert_eq!(iids, [12]);
        assert_eq!(candidates(listed, &branch(), &right).len(), 3);
        let request = merge_request("commit-route", "merge-request.json");
        let lined_up = lines_up(
            &compared(MERGE_BASE, FEATURE),
            found(commit, vec![request.clone()]),
        );
        assert_eq!(lined_up.map(|lined_up| lined_up.merge_request), Ok(request));
    }

    #[test]
    fn at_most_five_merge_requests_are_checked() {
        let listed: Vec<Listed> = (1..=7)
            .map(|iid| Listed {
                project_id: 7,
                iid,
                is_open: true,
                head: FEATURE.to_owned(),
            })
            .collect();
        let right = Oid::parse(FEATURE).unwrap();
        assert_eq!(candidates(listed, &branch(), &right).len(), 5);
    }

    #[test]
    fn null_diff_refs_is_preparing() {
        assert_eq!(
            checked(&compared(MERGE_BASE, FEATURE), "preparing").map(|_| ()),
            Err(NotLinedUp::Preparing {
                merge_request: named("preparing", "merge-request.json"),
            })
        );
    }
}
