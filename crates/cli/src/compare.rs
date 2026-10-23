use std::path::Path;

use serde_json::json;

use crate::{Result, print, read_text};

const LEFT_FILE: &str = "left.txt";
const RIGHT_FILE: &str = "right.txt";

pub(crate) fn compare(case_dir: &Path) -> Result<()> {
    let left = read_text(&case_dir.join(LEFT_FILE))?;
    let right = read_text(&case_dir.join(RIGHT_FILE))?;
    let differences = serde_json::to_value(yamt_merge_core::compare(&left, &right))?;
    let comparison = json!({ "left": left, "right": right, "differences": differences });
    print(&(serde_json::to_string_pretty(&comparison)? + "\n"))
}
