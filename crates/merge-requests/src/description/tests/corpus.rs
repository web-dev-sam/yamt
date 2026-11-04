use std::collections::BTreeSet;

use serde::Deserialize;
use serde_json::Value;

use super::super::html::described;

const FIXTURE: &str = include_str!("../../../../../frontend/fixtures/markdown/gitlab-preview.json");

const RECORDED: [&str; 62] = [
    "paragraph",
    "two_paragraphs",
    "soft_break",
    "hard_break_spaces",
    "hard_break_backslash",
    "emphasis_star",
    "emphasis_underscore",
    "intraword_underscore",
    "strong",
    "strong_em",
    "strike",
    "inline_code",
    "inline_code_backticks",
    "fenced_plain",
    "fenced_rust",
    "fenced_ts",
    "fenced_tilde",
    "fenced_mermaid",
    "indented_code",
    "bullet_dash",
    "bullet_star",
    "ordered",
    "ordered_start",
    "ordered_paren",
    "nested_list",
    "loose_list",
    "list_with_para",
    "h1",
    "h2_h6",
    "heading_formatting",
    "heading_duplicate",
    "setext",
    "quote",
    "quote_nested",
    "quote_with_list",
    "table",
    "table_align",
    "table_inline",
    "rule_dash",
    "rule_star",
    "rule_underscore",
    "ampersand",
    "entity",
    "percent_number",
    "hash_no_ref",
    "hex_short",
    "hex_word_plain",
    "colon_words",
    "exclaim",
    "unicode",
    "smart_quotes",
    "trailing_spaces_para",
    "mixed_doc",
    "ref_issue",
    "mention",
    "emoji",
    "url",
    "link",
    "task",
    "html",
    "math_inline",
    "dollar_word",
];

const EXTRAS: [&str; 25] = [
    "code_hides_refs",
    "fence_hides_refs",
    "heading_closing_hashes",
    "heading_then_text",
    "mixed_bullets",
    "table_short_row",
    "table_after_paragraph",
    "quote_lazy",
    "quote_two_paragraphs",
    "list_lazy",
    "nested_ordered",
    "ordered_para_items",
    "ordered_zero_start",
    "emphasis_punct",
    "emphasis_nested",
    "fence_blank_edges",
    "unicode_plain",
    "ampersand_no_angle",
    "hard_break_three_spaces",
    "rule_after_list",
    "star_rule",
    "strike_single_tilde",
    "code_language_upper",
    "fence_info_words",
    "quick_action",
];

/// GitLab's preview answers (`frontend/fixtures/markdown/gitlab-preview.json`).
#[derive(Deserialize)]
struct Corpus {
    recorded: String,
    entries: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    name: String,
    text: String,
    html: String,
    local: bool,
    blocks: Value,
}

fn corpus() -> Corpus {
    serde_json::from_str(FIXTURE).unwrap()
}

/// Whether `value` holds, at any depth, a part the local preview never builds: a link, an image, a details block or
/// a task box.
fn holds_remote_part(value: &Value) -> bool {
    match value {
        Value::Object(fields) => {
            let kind = fields.get("kind").and_then(Value::as_str);
            let task = fields.get("task").and_then(Value::as_str);
            matches!(kind, Some("link" | "image" | "details"))
                || task.is_some_and(|task| task != "none")
                || fields.values().any(holds_remote_part)
        }
        Value::Array(items) => items.iter().any(holds_remote_part),
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => false,
    }
}

#[test]
fn every_recorded_answer_reduces_to_its_blocks() {
    for entry in corpus().entries {
        let reduced =
            serde_json::to_value(described(&entry.html, None).description.blocks).unwrap();

        assert_eq!(reduced, entry.blocks, "{}", entry.name);
    }
}

#[test]
fn a_local_entry_holds_no_link_image_details_or_task_box() {
    let holding: Vec<String> = corpus()
        .entries
        .into_iter()
        .filter(|entry| entry.local && holds_remote_part(&entry.blocks))
        .map(|entry| entry.name)
        .collect();

    assert_eq!(holding, Vec::<String>::new());
}

#[test]
fn the_corpus_holds_each_name_once_and_every_recorded_name() {
    let corpus = corpus();
    let names: Vec<&str> = corpus
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    let unique: BTreeSet<&str> = names.iter().copied().collect();
    let blank: Vec<&str> = corpus
        .entries
        .iter()
        .filter(|entry| entry.text.trim().is_empty())
        .map(|entry| entry.name.as_str())
        .collect();

    assert_eq!(names, [RECORDED.as_slice(), EXTRAS.as_slice()].concat());
    assert_eq!(unique.len(), names.len());
    assert_ne!(corpus.recorded.trim(), "");
    assert_eq!(blank, Vec::<&str>::new());
}
