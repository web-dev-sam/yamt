use std::fs;
use std::io;
use std::path::Path;

use yamt_merge_core::{Options, compute_chunks};

use crate::case::{Case, EXPECTED_FILE};
use crate::classify::chunks_json;
use crate::{Error, Result, print_lines, read_error};

pub(crate) fn run(dir: &Path) -> Result<()> {
    let cases = load_cases(dir)?;
    let mut report = Vec::with_capacity(cases.len());
    let mut failed = 0;
    for case in &cases {
        match mismatch(case)? {
            None => report.push(format!("ok {}", case.name)),
            Some(hint) => {
                failed += 1;
                report.push(format!("DIFF {}: {hint}", case.name));
            }
        }
    }
    print_lines(&report)?;
    if failed == 0 {
        Ok(())
    } else {
        Err(Error::GoldenFailed {
            failed,
            total: cases.len(),
        })
    }
}

pub(crate) fn update(dir: &Path) -> Result<()> {
    let cases = load_cases(dir)?;
    let mut report = Vec::with_capacity(cases.len());
    for case in &cases {
        let path = case.expected_path();
        fs::write(&path, computed_json(case)?).map_err(|source| Error::Write {
            path: path.display().to_string(),
            source,
        })?;
        report.push(format!("wrote {}", case.name));
    }
    print_lines(&report)
}

fn load_cases(dir: &Path) -> Result<Vec<Case>> {
    let mut case_dirs = Vec::new();
    for entry in fs::read_dir(dir).map_err(|source| read_error(dir, source))? {
        let entry = entry.map_err(|source| read_error(dir, source))?;
        let file_type = entry
            .file_type()
            .map_err(|source| read_error(dir, source))?;
        if file_type.is_dir() {
            case_dirs.push(entry.path());
        }
    }
    if case_dirs.is_empty() {
        return Err(Error::NoCases {
            dir: dir.display().to_string(),
        });
    }
    case_dirs.sort();
    case_dirs
        .iter()
        .map(|case_dir| Case::load(case_dir))
        .collect()
}

fn computed_json(case: &Case) -> Result<String> {
    let chunks = compute_chunks(&case.base, &case.local, &case.remote, &Options::default());
    chunks_json(&chunks)
}

fn mismatch(case: &Case) -> Result<Option<String>> {
    let actual = computed_json(case)?;
    let path = case.expected_path();
    let expected = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(source) if source.kind() == io::ErrorKind::NotFound => {
            return Ok(Some(format!("{EXPECTED_FILE} is missing")));
        }
        Err(source) => return Err(read_error(&path, source)),
    };
    if expected == actual.as_bytes() {
        Ok(None)
    } else {
        let expected = String::from_utf8_lossy(&expected);
        Ok(Some(first_difference(&expected, &actual)))
    }
}

fn first_difference(expected: &str, actual: &str) -> String {
    if expected.ends_with('\n') != actual.ends_with('\n') {
        return "trailing newline differs".to_owned();
    }
    for (number, (expected_line, actual_line)) in (1..).zip(expected.lines().zip(actual.lines())) {
        if expected_line != actual_line {
            return format!(
                "line {number}: expected `{}`, got `{}`",
                expected_line.trim(),
                actual_line.trim()
            );
        }
    }
    let expected_count = expected.lines().count();
    let actual_count = actual.lines().count();
    if expected_count == actual_count {
        "same lines, different line endings".to_owned()
    } else {
        format!("expected {expected_count} lines, got {actual_count}")
    }
}
