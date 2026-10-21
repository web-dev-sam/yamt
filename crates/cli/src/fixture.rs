use std::path::Path;

use yamt_session::{
    DEFAULT_MARKER_SIZE, DiskVersion, MarkerStyle, Orientation, merge_data, remembered_data,
};

use crate::case::Case;
use crate::{Result, print, read_text};

/// A showcase case of a file git rerere filled in: its `remembered.<ext>` and `git-output.<ext>`.
struct Remembered {
    text: String,
    git_output: String,
}

pub(crate) fn fixture(case_dir: &Path) -> Result<()> {
    let case = Case::load(case_dir)?;
    let path = format!("{}.{}", case.name, case.extension);
    let data = match remembered(&case)? {
        Some(remembered) => remembered_data(
            &path,
            &case.base,
            &case.local,
            &case.remote,
            &remembered.text,
            &remembered.git_output,
        ),
        None => merge_data(
            &path,
            &case.base,
            &case.local,
            &case.remote,
            None,
            &MarkerStyle::fallback(DEFAULT_MARKER_SIZE, Orientation::NO_OPERATION),
            DiskVersion(0),
        ),
    };
    print(&(serde_json::to_string_pretty(&data)? + "\n"))
}

fn remembered(case: &Case) -> Result<Option<Remembered>> {
    let text = case.dir.join(format!("remembered.{}", case.extension));
    if !text.is_file() {
        return Ok(None);
    }
    let git_output = case.dir.join(format!("git-output.{}", case.extension));
    Ok(Some(Remembered {
        text: read_text(&text)?,
        git_output: read_text(&git_output)?,
    }))
}
