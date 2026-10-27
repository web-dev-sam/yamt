use yamt_gitio::Repo;
use yamt_range::RangeSideLabel;

const HEADS: &str = "refs/heads/";
const REMOTES: &str = "refs/remotes/";

/// The branch the right side names: `refs/heads/x` and `refs/remotes/<remote>/x` give `x`; a commit id, a tag,
/// `HEAD~2` or a detached `HEAD` give `None`. An empty side reaches here as `HEAD`, the current branch.
pub(crate) fn right_branch(
    repo: &Repo,
    right_label: &RangeSideLabel,
) -> yamt_gitio::Result<Option<String>> {
    let name = match right_label {
        RangeSideLabel::Named { name } => name,
        RangeSideLabel::MergeBase { right, .. } => right,
    };
    let Some(full_name) = repo.symbolic_full_name(name)? else {
        return Ok(None);
    };
    let Ok(full_name) = String::from_utf8(full_name) else {
        return Ok(None);
    };
    if let Some(branch) = full_name.strip_prefix(HEADS) {
        return Ok(Some(branch.to_owned()));
    }
    let Some(remote_and_branch) = full_name.strip_prefix(REMOTES) else {
        return Ok(None);
    };
    Ok(branch_after_remote(
        remote_and_branch,
        &repo.remote_names()?,
    ))
}

/// `origin/x` gives `x`; the longest remote name wins, as a remote's name may hold a slash.
fn branch_after_remote(remote_and_branch: &str, remotes: &[Vec<u8>]) -> Option<String> {
    let remote = remotes
        .iter()
        .filter_map(|remote| std::str::from_utf8(remote).ok())
        .filter(|remote| remote_and_branch.starts_with(&format!("{remote}/")))
        .max_by_key(|remote| remote.len())?;
    let branch = remote_and_branch.strip_prefix(remote)?.strip_prefix('/')?;
    Some(branch.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remotes(names: &[&str]) -> Vec<Vec<u8>> {
        names.iter().map(|name| name.as_bytes().to_vec()).collect()
    }

    #[test]
    fn a_remote_tracking_name_drops_the_longest_remote() {
        let names = remotes(&["origin", "my", "my/fork"]);
        assert_eq!(
            branch_after_remote("my/fork/dev", &names),
            Some("dev".to_owned())
        );
        assert_eq!(
            branch_after_remote("origin/feature/x", &names),
            Some("feature/x".to_owned())
        );
        assert_eq!(branch_after_remote("gone/dev", &names), None);
        assert_eq!(branch_after_remote("origindev", &names), None);
    }
}
