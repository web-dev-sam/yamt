use std::path::Path;

use serde_json::json;
use yamt_range::{RangeHeading, RangeSpec, Resolved};

use crate::{Result, print};

pub(crate) fn range(repo: &Path, spec: &RangeSpec) -> Result<()> {
    let range = Resolved::resolve(repo, spec)?.list()?;
    let start = range.start(RangeHeading::Typed);
    let mut files = Vec::with_capacity(start.files.len());
    for entry in &start.files {
        files.push(range.load(entry.id)?);
    }
    let case =
        json!({ "start": serde_json::to_value(start)?, "files": serde_json::to_value(files)? });
    print(&(serde_json::to_string_pretty(&case)? + "\n"))
}
