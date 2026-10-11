use std::path::Path;

use yamt_session::merge_data;

use crate::case::Case;
use crate::{Result, print};

pub(crate) fn fixture(case_dir: &Path) -> Result<()> {
    let case = Case::load(case_dir)?;
    let path = format!("{}.{}", case.name, case.extension);
    let data = merge_data(&path, &case.base, &case.local, &case.remote, None);
    print(&(serde_json::to_string_pretty(&data)? + "\n"))
}
