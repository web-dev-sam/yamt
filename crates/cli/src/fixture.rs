use std::path::Path;

use yamt_session::{DEFAULT_MARKER_SIZE, DiskVersion, MarkerStyle, merge_data};

use crate::case::Case;
use crate::{Result, print};

pub(crate) fn fixture(case_dir: &Path) -> Result<()> {
    let case = Case::load(case_dir)?;
    let path = format!("{}.{}", case.name, case.extension);
    let data = merge_data(
        &path,
        &case.base,
        &case.local,
        &case.remote,
        None,
        &MarkerStyle::fallback(DEFAULT_MARKER_SIZE),
        DiskVersion(0),
    );
    print(&(serde_json::to_string_pretty(&data)? + "\n"))
}
