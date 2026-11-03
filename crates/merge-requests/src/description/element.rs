use dom_query::NodeRef;

use super::{CellAlign, DescriptionBlock, HeadingLevel, ListNumbering, TaskBox};

const TASK_BOX_CLASS: &str = "task-list-item-checkbox";
const LANGUAGE_ATTRIBUTES: [&str; 2] = ["data-canonical-lang", "lang"];

/// A `<pre>`'s code block: its language from GitLab's `data-canonical-lang`, else `lang`; its text, one final "\n"
/// removed.
pub(super) fn code(text: &str, pre: &NodeRef) -> DescriptionBlock {
    let language = LANGUAGE_ATTRIBUTES
        .iter()
        .find_map(|name| pre.attr(name).filter(|value| !value.is_empty()));
    DescriptionBlock::Code {
        language: language.map(|language| language.to_string()),
        text: text.strip_suffix('\n').unwrap_or(text).to_owned(),
    }
}

/// `<ol start>`, else 1.
pub(super) fn numbers(list: &NodeRef) -> ListNumbering {
    let start = list
        .attr("start")
        .and_then(|start| start.trim().parse().ok());
    ListNumbering::Numbers {
        start: start.unwrap_or(1),
    }
}

pub(super) fn heading_level(name: &str) -> Option<HeadingLevel> {
    match name {
        "h1" => Some(HeadingLevel::H1),
        "h2" => Some(HeadingLevel::H2),
        "h3" => Some(HeadingLevel::H3),
        "h4" => Some(HeadingLevel::H4),
        "h5" => Some(HeadingLevel::H5),
        "h6" => Some(HeadingLevel::H6),
        _ => None,
    }
}

/// GitLab's task box: the item's first element or text (or its first paragraph's, in a loose list) when it is
/// `input.task-list-item-checkbox`.
pub(super) fn task_box(item: &NodeRef) -> TaskBox {
    let input = match first_content(item) {
        Some(paragraph) if paragraph.has_name("p") => first_content(&paragraph),
        first => first,
    };
    let Some(input) =
        input.filter(|input| input.has_name("input") && input.has_class(TASK_BOX_CLASS))
    else {
        return TaskBox::None;
    };
    if input.has_attr("data-inapplicable") {
        TaskBox::Inapplicable
    } else if input.has_attr("checked") {
        TaskBox::Done
    } else {
        TaskBox::Open
    }
}

/// The first element or text that is not only white space among `parent`'s children.
fn first_content<'a>(parent: &NodeRef<'a>) -> Option<NodeRef<'a>> {
    let is_content =
        |node: &NodeRef| node.is_element() || (node.is_text() && !node.text().trim().is_empty());
    parent.children().into_iter().find(is_content)
}

/// The only style GitLab keeps on a cell (`sanitization_filter.rb` `TABLE_ALIGNMENT_PATTERN`).
pub(super) fn align(cell: &NodeRef) -> CellAlign {
    match cell.attr("style").as_deref() {
        Some("text-align: center") => CellAlign::Center,
        Some("text-align: right") => CellAlign::End,
        _ => CellAlign::Start,
    }
}
