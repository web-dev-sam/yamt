use std::path::Path;

use yamt_session::{
    DEFAULT_MARKER_SIZE, DiskVersion, MarkerStyle, Orientation, Replayed, merge_data,
    remembered_data,
};

use crate::case::Case;
use crate::{Error, Result, print, read_text};

pub(crate) fn fixture(case_dir: &Path) -> Result<()> {
    let case = Case::load(case_dir)?;
    let path = format!("{}.{}", case.name, case.extension);
    let style = MarkerStyle::fallback(DEFAULT_MARKER_SIZE, Orientation::NO_OPERATION);
    let version = DiskVersion(0);
    let data = match replayed(&case)? {
        Some(replayed) => {
            let data = remembered_data(
                &path,
                &case.base,
                &case.local,
                &case.remote,
                &replayed,
                &style,
                version,
            );
            data.ok_or_else(|| Error::MalformedCase {
                case: case.name.clone(),
                problem: format!(
                    "git-output.{} was not made from these sides",
                    case.extension
                ),
            })?
        }
        None => merge_data(
            &path,
            &case.base,
            &case.local,
            &case.remote,
            None,
            &style,
            version,
        ),
    };
    print(&(serde_json::to_string_pretty(&data)? + "\n"))
}

/// A case of a file git rerere filled in: its `remembered.<ext>` and `git-output.<ext>`.
fn replayed(case: &Case) -> Result<Option<Replayed>> {
    let resolution = case.dir.join(format!("remembered.{}", case.extension));
    if !resolution.is_file() {
        return Ok(None);
    }
    let git_output = case.dir.join(format!("git-output.{}", case.extension));
    Ok(Some(Replayed {
        git_output: read_text(&git_output)?,
        resolution: read_text(&resolution)?,
    }))
}
