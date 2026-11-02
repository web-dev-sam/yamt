use yamt_gitio::MergeOutcome;

use crate::{BlockedReason, Readiness};

/// What GitLab says of a merge request's merge, read once per row.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct GitLabMerge {
    status: MergeStatus,
    conflicts: bool,
    draft: bool,
}

/// GitLab's `DetailedMergeStatus` (GraphQL reference) in five.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum MergeStatus {
    Mergeable,
    Conflict,
    NeedsRebase,
    /// GitLab has not decided yet: `CHECKING`, `UNCHECKED`, `PREPARING`, `APPROVALS_SYNCING`, or no status.
    Unchecked,
    Blocked(BlockedReason),
}

impl GitLabMerge {
    /// A row's merge status, `conflicts` flag and draft flag as GitLab sent them; an unknown status blocks, in
    /// GitLab's word, with a warning.
    pub(crate) fn read(status: Option<&str>, conflicts: bool, draft: bool) -> GitLabMerge {
        GitLabMerge {
            status: status.map_or(MergeStatus::Unchecked, merge_status),
            conflicts,
            draft,
        }
    }

    /// GitLab's answer alone: its merge status, unless the merge request conflicts (its `conflicts` flag or a
    /// `CONFLICT` status). A conflict comes first, with what else blocks the merge (request rule 2, #1998).
    pub(crate) fn readiness(&self) -> Readiness {
        if self.conflicts {
            return self.conflicting();
        }
        match &self.status {
            MergeStatus::Mergeable => Readiness::Ready,
            MergeStatus::Conflict => self.conflicting(),
            MergeStatus::NeedsRebase => Readiness::NeedsRebase,
            MergeStatus::Unchecked => Readiness::Checking,
            MergeStatus::Blocked(reason) => Readiness::Blocked {
                reason: reason.clone(),
            },
        }
    }

    /// The readiness once yamt merged GitLab's two commits itself (request rules 2 and 3): its own merge decides
    /// the conflict, GitLab's `conflicts` flag is not read, and GitLab's status keeps the other blockers. A clean
    /// merge GitLab calls conflicting or has not checked is `MergesCleanly`, never `Ready`.
    pub(crate) fn readiness_after(&self, merged: MergeOutcome) -> Readiness {
        match merged {
            MergeOutcome::Conflicts => self.conflicting(),
            MergeOutcome::Clean => match &self.status {
                MergeStatus::Mergeable => Readiness::Ready,
                MergeStatus::Conflict | MergeStatus::Unchecked => Readiness::MergesCleanly,
                MergeStatus::NeedsRebase => Readiness::NeedsRebase,
                MergeStatus::Blocked(reason) => Readiness::Blocked {
                    reason: reason.clone(),
                },
            },
        }
    }

    /// A conflict with the status's blocked reason, then `Draft` for a draft: GitLab never merges one, whatever its
    /// status says.
    fn conflicting(&self) -> Readiness {
        let mut also = match &self.status {
            MergeStatus::Blocked(reason) => vec![reason.clone()],
            MergeStatus::Mergeable
            | MergeStatus::Conflict
            | MergeStatus::NeedsRebase
            | MergeStatus::Unchecked => Vec::new(),
        };
        if self.draft && !also.contains(&BlockedReason::Draft) {
            also.push(BlockedReason::Draft);
        }
        Readiness::Conflicts { also }
    }
}

fn merge_status(status: &str) -> MergeStatus {
    match status {
        "MERGEABLE" => MergeStatus::Mergeable,
        "CONFLICT" => MergeStatus::Conflict,
        "NEED_REBASE" => MergeStatus::NeedsRebase,
        "CHECKING" | "UNCHECKED" | "PREPARING" | "APPROVALS_SYNCING" => MergeStatus::Unchecked,
        blocking => MergeStatus::Blocked(blocked_reason(blocking)),
    }
}

fn blocked_reason(status: &str) -> BlockedReason {
    match status {
        "DRAFT_STATUS" => BlockedReason::Draft,
        "DISCUSSIONS_NOT_RESOLVED" => BlockedReason::Discussions,
        "NOT_APPROVED" => BlockedReason::Approvals,
        "CI_MUST_PASS" => BlockedReason::PipelineMustPass,
        "CI_STILL_RUNNING" => BlockedReason::PipelineRunning,
        "REQUESTED_CHANGES" => BlockedReason::ChangesRequested,
        "BLOCKED_STATUS" => BlockedReason::Dependencies,
        "EXTERNAL_STATUS_CHECKS" => BlockedReason::StatusChecks,
        "JIRA_ASSOCIATION" => BlockedReason::JiraIssue,
        "LOCKED_LFS_FILES" => BlockedReason::LockedFiles,
        "LOCKED_PATHS" => BlockedReason::LockedPaths,
        "MERGE_TIME" => BlockedReason::MergeTime,
        "NOT_OPEN" => BlockedReason::NotOpen,
        "COMMITS_STATUS" => BlockedReason::SourceBranch,
        "SECURITY_POLICIES_VIOLATIONS" => BlockedReason::SecurityPolicies,
        "SECURITY_POLICY_PIPELINE_CHECK" => BlockedReason::SecurityPipelines,
        "TITLE_NOT_MATCHING" => BlockedReason::TitleRule,
        unknown => {
            tracing::warn!(status = unknown, "unknown merge status, shown as blocked");
            BlockedReason::Other {
                status: unknown.to_owned(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use BlockedReason::{Discussions, Draft};
    use MergeOutcome::{Clean, Conflicts};

    fn merge(status: MergeStatus, conflicts: bool, draft: bool) -> GitLabMerge {
        GitLabMerge {
            status,
            conflicts,
            draft,
        }
    }

    fn conflicts(also: &[BlockedReason]) -> Readiness {
        Readiness::Conflicts {
            also: also.to_vec(),
        }
    }

    fn blocked(reason: BlockedReason) -> Readiness {
        Readiness::Blocked { reason }
    }

    /// Design §2.1's table: each status, then what a local conflict and a local clean merge give, for a row that is
    /// not a draft.
    fn after_table() -> [(MergeStatus, Readiness, Readiness); 5] {
        [
            (MergeStatus::Mergeable, conflicts(&[]), Readiness::Ready),
            (
                MergeStatus::Conflict,
                conflicts(&[]),
                Readiness::MergesCleanly,
            ),
            (
                MergeStatus::NeedsRebase,
                conflicts(&[]),
                Readiness::NeedsRebase,
            ),
            (
                MergeStatus::Unchecked,
                conflicts(&[]),
                Readiness::MergesCleanly,
            ),
            (
                MergeStatus::Blocked(Discussions),
                conflicts(&[Discussions]),
                blocked(Discussions),
            ),
        ]
    }

    #[test]
    fn the_local_merge_decides_the_conflict_and_gitlab_s_status_the_rest_whatever_its_conflicts_flag()
     {
        for (status, on_conflicts, on_clean) in after_table() {
            for flag in [false, true] {
                let merge = merge(status.clone(), flag, false);
                assert_eq!(merge.readiness_after(Conflicts), on_conflicts, "{merge:?}");
                assert_eq!(merge.readiness_after(Clean), on_clean, "{merge:?}");
            }
        }
    }

    #[test]
    fn a_draft_s_local_conflict_ends_in_draft_once_and_a_clean_draft_keeps_gitlab_s_answer() {
        let statuses = [
            (
                MergeStatus::Mergeable,
                conflicts(&[Draft]),
                Readiness::Ready,
            ),
            (
                MergeStatus::Conflict,
                conflicts(&[Draft]),
                Readiness::MergesCleanly,
            ),
            (
                MergeStatus::NeedsRebase,
                conflicts(&[Draft]),
                Readiness::NeedsRebase,
            ),
            (
                MergeStatus::Unchecked,
                conflicts(&[Draft]),
                Readiness::MergesCleanly,
            ),
            (
                MergeStatus::Blocked(Discussions),
                conflicts(&[Discussions, Draft]),
                blocked(Discussions),
            ),
            (
                MergeStatus::Blocked(Draft),
                conflicts(&[Draft]),
                blocked(Draft),
            ),
        ];
        for (status, on_conflicts, on_clean) in statuses {
            for flag in [false, true] {
                let merge = merge(status.clone(), flag, true);
                assert_eq!(merge.readiness_after(Conflicts), on_conflicts, "{merge:?}");
                assert_eq!(merge.readiness_after(Clean), on_clean, "{merge:?}");
            }
        }
    }

    #[test]
    fn a_missing_status_is_unchecked_and_an_unknown_one_blocks_in_gitlab_s_word() {
        assert_eq!(
            GitLabMerge::read(None, false, true).status,
            MergeStatus::Unchecked
        );
        let unknown = GitLabMerge::read(Some("MERGE_TRAIN_STUCK"), true, false);
        let other = BlockedReason::Other {
            status: "MERGE_TRAIN_STUCK".to_owned(),
        };
        assert_eq!(unknown, merge(MergeStatus::Blocked(other), true, false));
    }
}
