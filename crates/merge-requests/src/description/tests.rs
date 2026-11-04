use std::collections::{BTreeMap, BTreeSet};

use serde_json::{Value, json};
use url::Url;

use super::address::{image_of, link_of};
use super::html::{MAX_NESTING, described};
use super::size::{ImageLength, image_length};
use super::*;
use crate::PictureAddress;

mod corpus;

const BASE: &str = "https://gitlab.com/taskboard/taskboard/-/merge_requests/52";
const MERGE_REQUESTS: &str = "https://gitlab.com/taskboard/taskboard/-/merge_requests/";
const SUB_PATH_BASE: &str = "https://gitlab.example/gitlab/taskboard/taskboard/-/merge_requests/52";
const SELF_MANAGED_BASE: &str = "https://gitlab.example/taskboard/taskboard/-/merge_requests/52";
const ORIGIN: &str = "https://gitlab.com";
const HEX_A: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const HEX_B: &str = "f9e8d7c6b5a4938271605f4e3d2c1b0a";
const RICH: &str =
    include_str!("../../../../tests/glab/mr-description/graphql-description-52.json");
const PLANTED: &str =
    include_str!("../../../../tests/glab/mr-description/graphql-description-50.json");

/// Every field name of the Contract's types, as serialised.
const CONTRACT_KEYS: [&str; 28] = [
    "kind",
    "description",
    "blocks",
    "inlines",
    "level",
    "language",
    "text",
    "numbering",
    "start",
    "items",
    "task",
    "head",
    "body",
    "cells",
    "header",
    "align",
    "open",
    "summary",
    "link",
    "page",
    "address",
    "image",
    "caption",
    "key",
    "size",
    "width",
    "height",
    "value",
];

fn base() -> Url {
    Url::parse(BASE).unwrap()
}

fn read(html: &str) -> Described {
    described(html, Some(&WebPage(BASE.to_owned())))
}

fn blocks(html: &str) -> Vec<DescriptionBlock> {
    read(html).description.blocks
}

/// The `descriptionHtml` of a recorded answer.
fn html_in(answer: &str) -> String {
    let answer: Value = serde_json::from_str(answer).unwrap();
    let html = &answer["data"]["project"]["mergeRequest"]["descriptionHtml"];
    html.as_str().unwrap().to_owned()
}

fn text(text: &str) -> DescriptionInline {
    DescriptionInline::Text {
        text: text.to_owned(),
    }
}

fn paragraph(inlines: Vec<DescriptionInline>) -> DescriptionBlock {
    DescriptionBlock::Paragraph { inlines }
}

fn said(words: &str) -> DescriptionBlock {
    paragraph(vec![text(words)])
}

fn page(address: &str) -> DescriptionLink {
    DescriptionLink::Page {
        page: WebPage(address.to_owned()),
    }
}

fn refused(address: &str) -> DescriptionLink {
    DescriptionLink::Refused {
        address: address.to_owned(),
    }
}

fn web(address: &str) -> DescriptionImage {
    DescriptionImage::Web {
        address: address.to_owned(),
    }
}

/// An uploaded image of `secret`, its key made by the one maker, `image_of`.
fn uploaded(secret: &str) -> DescriptionImage {
    let src = format!("/-/project/7/uploads/{secret}/any.png");
    let (image, _) = image_of(Some(&base()), &src);
    assert_eq!(
        serde_json::to_value(&image).unwrap(),
        json!({ "kind": "uploaded", "key": format!("upload~{secret}") })
    );
    image
}

fn image(image: DescriptionImage, caption: &str, size: Option<ImageSize>) -> DescriptionInline {
    DescriptionInline::Image {
        image,
        caption: caption.to_owned(),
        size,
    }
}

fn item(task: TaskBox, blocks: Vec<DescriptionBlock>) -> DescriptionItem {
    DescriptionItem { task, blocks }
}

fn cell(header: bool, align: CellAlign, words: &str) -> DescriptionCell {
    DescriptionCell {
        header,
        align,
        inlines: vec![text(words)],
    }
}

fn upload(route: &str, web: &str) -> PictureAddress {
    PictureAddress::upload(route.to_owned(), web.to_owned())
}

fn list_parts(block: &DescriptionBlock) -> (ListNumbering, &[DescriptionItem]) {
    let DescriptionBlock::List { numbering, items } = block else {
        panic!("not a list: {block:?}");
    };
    (*numbering, items)
}

/// Every object key in `value`, and every string, at any depth.
fn keys_and_strings(value: &Value, keys: &mut BTreeSet<String>, strings: &mut Vec<String>) {
    match value {
        Value::Object(fields) => {
            for (key, field) in fields {
                keys.insert(key.clone());
                keys_and_strings(field, keys, strings);
            }
        }
        Value::Array(values) => {
            for each in values {
                keys_and_strings(each, keys, strings);
            }
        }
        Value::String(string) => strings.push(string.clone()),
        Value::Null | Value::Bool(_) | Value::Number(_) => {}
    }
}

#[test]
fn every_element_of_rule_3_becomes_its_block_or_inline() {
    let html = "<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>\n\
        <p><em>e</em><i>i</i><strong>s</strong><b>b</b><del>d</del><s>s</s><strike>k</strike><code>c</code><br>\
        <a href=\"/x\">a</a><img src=\"https://images.example/cat.png\" alt=\"cat\"></p>\n\
        <pre><code>plain\n</code></pre>\n<ul><li>bullet</li></ul>\n<ol><li>number</li></ol>\n\
        <blockquote><p>quoted</p></blockquote>\n<hr>\n\
        <table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table>\n\
        <details><summary>more</summary><p>hidden</p></details>";

    let heading = |level: &str, words: &str| json!({ "kind": "heading", "level": level, "inlines": [{ "kind": "text", "text": words }] });
    let wrapped = |kind: &str, words: &str| json!({ "kind": kind, "inlines": [{ "kind": "text", "text": words }] });
    let only = |words: &str| json!([{ "kind": "paragraph", "inlines": [{ "kind": "text", "text": words }] }]);
    let item = |words: &str| json!({ "task": "none", "blocks": only(words) });
    let cell = |header: bool, words: &str| json!({ "cells": [{ "header": header, "align": "start", "inlines": [{ "kind": "text", "text": words }] }] });
    let expected = json!([
        heading("h1", "One"), heading("h2", "Two"), heading("h3", "Three"),
        heading("h4", "Four"), heading("h5", "Five"), heading("h6", "Six"),
        { "kind": "paragraph", "inlines": [
            wrapped("emphasis", "e"), wrapped("emphasis", "i"), wrapped("strong", "s"), wrapped("strong", "b"),
            wrapped("strike", "d"), wrapped("strike", "s"), wrapped("strike", "k"),
            { "kind": "code", "text": "c" }, { "kind": "lineBreak" },
            { "kind": "link", "link": { "kind": "page", "page": "https://gitlab.com/x" },
              "inlines": [{ "kind": "text", "text": "a" }] },
            { "kind": "image", "image": { "kind": "web", "address": "https://images.example/cat.png" },
              "caption": "cat", "size": null },
        ] },
        { "kind": "code", "language": null, "text": "plain" },
        { "kind": "list", "numbering": { "kind": "bullets" }, "items": [item("bullet")] },
        { "kind": "list", "numbering": { "kind": "numbers", "start": 1 }, "items": [item("number")] },
        { "kind": "quote", "blocks": only("quoted") },
        { "kind": "rule" },
        { "kind": "table", "head": [cell(true, "h")], "body": [cell(false, "d")] },
        { "kind": "details", "open": false, "summary": [{ "kind": "text", "text": "more" }],
          "blocks": only("hidden") },
    ]);
    assert_eq!(serde_json::to_value(blocks(html)).unwrap(), expected);
}

#[test]
fn gitlabs_code_block_keeps_its_language_and_text_without_the_colour_spans() {
    let measured = "<div class=\"gl-relative markdown-code-block js-markdown-code\"><pre data-sourcepos=\"46:4-49:6\" \
        data-canonical-lang=\"ruby\" class=\"code highlight js-syntax-highlight language-ruby\" v-pre=\"true\"><code>\
        <span id=\"LC1\" class=\"line\" data-lang=\"ruby\"><span class=\"no\">Feature</span><span class=\"p\">.</span>\
        <span class=\"nf\">enable</span><span class=\"p\">(</span><span class=\"ss\">:rate_limit</span>\
        <span class=\"p\">)</span></span>&#x000A;<span id=\"LC2\" class=\"line\" data-lang=\"ruby\">\
        <span class=\"nb\">puts</span> <span class=\"s2\">\"&lt;done&gt;\"</span></span></code></pre><copy-code>\
        </copy-code><insert-code-snippet></insert-code-snippet></div>";
    let code = |language: Option<&str>, text: &str| DescriptionBlock::Code {
        language: language.map(str::to_owned),
        text: text.to_owned(),
    };

    let ruby = code(Some("ruby"), "Feature.enable(:rate_limit)\nputs \"<done>\"");
    assert_eq!(blocks(measured), [ruby]);
    let older = "<pre lang=\"js\"><code>a\n\n</code></pre><pre data-canonical-lang=\"\"><code>b</code></pre>\
        <pre data-canonical-lang=\"mermaid\" lang=\"x\"><code class=\"js-render-mermaid\">graph TD;\nA--&gt;B\n</code></pre>";
    let expected = [
        code(Some("js"), "a\n"),
        code(None, "b"),
        code(Some("mermaid"), "graph TD;\nA-->B"),
    ];
    assert_eq!(blocks(older), expected);
}

#[test]
fn a_lazy_image_is_read_from_data_src_and_its_link_is_dropped() {
    let path = format!("/-/project/278964/uploads/{HEX_A}/Screenshot_2025-08-01_at_4.25.21_pm.png");
    let measured = format!(
        "<p><a class=\"no-attachment-icon gfm\" href=\"{path}\" target=\"_blank\" rel=\"noopener noreferrer\" \
         data-canonical-src=\"/uploads/{HEX_A}/Screenshot_2025-08-01_at_4.25.21_pm.png\" data-link=\"true\">\
         <img data-sourcepos=\"21:5-21:125\" src=\"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==\" \
         alt=\"Screenshot_2025-08-01_at_4.25.21_pm\" decoding=\"async\" class=\"lazy gfm\" data-src=\"{path}\" \
         data-canonical-src=\"/uploads/{HEX_A}/Screenshot_2025-08-01_at_4.25.21_pm.png\"></a></p>"
    );

    let read = read(&measured);

    let shot = image(uploaded(HEX_A), "Screenshot_2025-08-01_at_4.25.21_pm", None);
    assert_eq!(read.description.blocks, [paragraph(vec![shot])]);
    assert_eq!(read.pages, Vec::<WebPage>::new());
    let route = format!("projects/278964/uploads/{HEX_A}/Screenshot_2025-08-01_at_4.25.21_pm.png");
    assert_eq!(
        read.uploads[0].address,
        upload(&route, &format!("{ORIGIN}{path}"))
    );

    let worded = "<p><a href=\"https://docs.example/x\">see <strong>the <img src=\"https://images.example/cat.png\" \
        alt=\"cat\"></strong></a></p>";
    let read = described(worded, Some(&WebPage(BASE.to_owned())));
    let link = DescriptionInline::Link {
        link: page("https://docs.example/x"),
        inlines: vec![
            text("see "),
            DescriptionInline::Strong {
                inlines: vec![text("the ")],
            },
        ],
    };
    let cat = image(web("https://images.example/cat.png"), "cat", None);
    assert_eq!(read.description.blocks, [paragraph(vec![link, cat])]);
    assert_eq!(read.web_images, 1);
}

#[test]
fn an_images_caption_is_its_alt_else_its_title_else_its_address() {
    let html = "<p><img src=\"https://images.example/a.png\" alt=\"alt\" title=\"title\">\
        <img src=\"https://images.example/b.png\" alt=\"\" title=\"title\">\
        <img src=\"https://images.example/c.png\"><img alt=\"\"></p>";

    let expected = paragraph(vec![
        image(web("https://images.example/a.png"), "alt", None),
        image(web("https://images.example/b.png"), "title", None),
        image(
            web("https://images.example/c.png"),
            "https://images.example/c.png",
            None,
        ),
        image(DescriptionImage::Refused, "", None),
    ]);
    assert_eq!(blocks(html), [expected]);
}

fn pixels(value: u16) -> ImageLength {
    ImageLength::Pixels { value }
}

fn percent(value: u16) -> ImageLength {
    ImageLength::Percent { value }
}

fn cat(size: Option<ImageSize>) -> DescriptionInline {
    image(web("https://images.example/cat.png"), "cat", size)
}

#[test]
fn a_bare_number_is_pixels_and_px_and_percent_are_kept() {
    let cases = [
        ("12", pixels(12)),
        ("12px", pixels(12)),
        ("40%", percent(40)),
        ("0", pixels(0)),
        ("9999px", pixels(9999)),
        ("9999%", percent(9999)),
    ];
    for (written, length) in cases {
        assert_eq!(image_length(written), Some(length), "{written}");
    }
}

#[test]
fn a_size_outside_gitlabs_form_is_ignored() {
    let outside = [
        "abc", "12345", "1.5", " 12", "12 ", "-3", "+3", "12em", "12PX", "", "%", "px", "12px%",
        "12%px", "٣",
    ];
    for written in outside {
        assert_eq!(image_length(written), None, "{written:?}");
        let sized = format!(
            "<p><img src=\"https://images.example/cat.png\" alt=\"cat\" width=\"{written}\" \
             height=\"{written}\"></p>"
        );
        assert_eq!(blocks(&sized), [paragraph(vec![cat(None)])], "{written:?}");
    }
}

#[test]
fn an_image_without_size_has_none() {
    let html = "<p><img src=\"https://images.example/cat.png\" alt=\"cat\"></p>";

    assert_eq!(blocks(html), [paragraph(vec![cat(None)])]);
}

#[test]
fn width_and_height_together_are_both() {
    let html = "<p><img src=\"https://images.example/cat.png\" alt=\"cat\" width=\"200\" height=\"50%\">\
        <img src=\"https://images.example/cat.png\" alt=\"cat\" width=\"200px\" height=\"abc\"></p>";

    let both = ImageSize::Both {
        width: pixels(200),
        height: percent(50),
    };
    let width = ImageSize::Width { width: pixels(200) };
    assert_eq!(
        blocks(html),
        [paragraph(vec![cat(Some(both)), cat(Some(width))])]
    );
}

#[test]
fn height_alone_is_height() {
    let html = "<p><img src=\"https://images.example/cat.png\" alt=\"cat\" height=\"80px\">\
        <img src=\"https://images.example/cat.png\" alt=\"cat\" width=\"12em\" height=\"80\"></p>";

    let height = ImageSize::Height { height: pixels(80) };
    assert_eq!(
        blocks(html),
        [paragraph(vec![cat(Some(height)), cat(Some(height))])]
    );
}

#[test]
fn a_lazy_images_size_is_read_beside_its_data_src() {
    let address = "https://user-content.gitlab-static.net/0a1b2c3d/_user.png";
    let measured = format!(
        "<p><img src=\"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==\" \
         alt=\"profile link\" width=\"12\" decoding=\"async\" class=\"lazy\" data-src=\"{address}\"></p>"
    );

    let width = ImageSize::Width { width: pixels(12) };
    let profile = image(web(address), "profile link", Some(width));
    assert_eq!(blocks(&measured), [paragraph(vec![profile])]);
}

#[test]
fn an_image_lifted_out_of_a_link_keeps_its_size() {
    let html = "<p><a href=\"https://docs.example/x\">see <img src=\"https://images.example/cat.png\" alt=\"cat\" \
        width=\"40%\"></a></p>";

    let link = DescriptionInline::Link {
        link: page("https://docs.example/x"),
        inlines: vec![text("see ")],
    };
    let width = ImageSize::Width { width: percent(40) };
    assert_eq!(blocks(html), [paragraph(vec![link, cat(Some(width))])]);
}

#[test]
fn the_ipc_form_names_kind_and_value() {
    let size = ImageSize::Both {
        width: pixels(200),
        height: percent(50),
    };

    let expected = json!({
        "kind": "both",
        "width": { "kind": "pixels", "value": 200 },
        "height": { "kind": "percent", "value": 50 },
    });
    assert_eq!(serde_json::to_value(size).unwrap(), expected);
}

#[test]
fn a_heading_anchor_link_leaves_nothing() {
    let measured = "<h2 id=\"user-content-what-does-this-mr-do-and-why\" data-sourcepos=\"1:1-1:32\" dir=\"auto\">\
        What does this MR do and why?<a href=\"#what-does-this-mr-do-and-why\" aria-label=\"Link to heading 'What \
        does this MR do and why?'\" data-heading-content=\"What does this MR do and why?\" class=\"anchor\"></a></h2>";

    let read = read(measured);

    let heading = DescriptionBlock::Heading {
        level: HeadingLevel::H2,
        inlines: vec![text("What does this MR do and why?")],
    };
    assert_eq!(read.description.blocks, [heading]);
    assert_eq!(read.pages, Vec::<WebPage>::new());
    let spaced = blocks("<p><a href=\"/x\"> \n </a>text</p>");
    assert_eq!(spaced, [paragraph(vec![text("text")])]);
}

#[test]
fn task_boxes_are_done_open_inapplicable_or_none() {
    let measured = "<ul class=\"task-list\" dir=\"auto\">\n\
        <li class=\"task-list-item\" data-sourcepos=\"33:1-33:79\"><input type=\"checkbox\" \
        data-checkbox-sourcepos=\"33:4-33:4\" class=\"task-list-item-checkbox\" checked=\"\" disabled=\"\" \
        aria-label=\"Check option: Changelog entry\"> Changelog entry</li>\n\
        <li class=\"task-list-item\"><input type=\"checkbox\" class=\"task-list-item-checkbox\" disabled=\"\"> open</li>\n\
        <li class=\"task-list-item inapplicable\"><input type=\"checkbox\" class=\"task-list-item-checkbox\" \
        data-inapplicable=\"\" checked=\"\" disabled=\"\"> <s>dropped</s></li>\n\
        <li>plain</li>\n<li><input type=\"checkbox\" checked=\"\"> not GitLab's box</li>\n\
        <li>after text <input type=\"checkbox\" class=\"task-list-item-checkbox\" checked=\"\"></li>\n\
        </ul>\n<ul class=\"task-list\"><li class=\"task-list-item\"><p><input type=\"checkbox\" \
        class=\"task-list-item-checkbox\" checked=\"\"> loose</p></li>\n<li>\n  <!-- c --> <input type=\"checkbox\" \
        class=\"task-list-item-checkbox\"> spaced</li></ul>";

    let lists = blocks(measured);

    let tasks: Vec<Vec<TaskBox>> = lists
        .iter()
        .map(|list| list_parts(list).1.iter().map(|item| item.task).collect())
        .collect();
    let (done, open, inapplicable, none) = (
        TaskBox::Done,
        TaskBox::Open,
        TaskBox::Inapplicable,
        TaskBox::None,
    );
    assert_eq!(
        tasks,
        [
            vec![done, open, inapplicable, none, none, none],
            vec![done, open]
        ]
    );
    let DescriptionBlock::List { items, .. } = &lists[0] else {
        panic!("not a list");
    };
    assert_eq!(items[0].blocks, [said(" Changelog entry")]);
    let struck = DescriptionInline::Strike {
        inlines: vec![text("dropped")],
    };
    assert_eq!(items[2].blocks, [paragraph(vec![text(" "), struck])]);
}

#[test]
fn table_cells_keep_gitlabs_alignment_and_header() {
    let html = "<table>\n<thead>\n<tr>\n<th style=\"text-align: left\">L</th>\n<th style=\"text-align: center\">C</th>\n\
        <th style=\"text-align: right\">R</th>\n<th>N</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n\
        <td style=\"text-align: left\">1</td>\n<td style=\"text-align: center\">2</td>\n\
        <td style=\"text-align: right\">3</td>\n<td style=\"text-align:right; color: red\">4</td>\n</tr>\n</tbody>\n\
        <tfoot><tr><td>f</td></tr></tfoot></table><table><tr><td>bare</td></tr></table>";
    let row = |cells| DescriptionRow { cells };

    let expected = [
        DescriptionBlock::Table {
            head: vec![row(vec![
                cell(true, CellAlign::Start, "L"),
                cell(true, CellAlign::Center, "C"),
                cell(true, CellAlign::End, "R"),
                cell(true, CellAlign::Start, "N"),
            ])],
            body: vec![
                row(vec![
                    cell(false, CellAlign::Start, "1"),
                    cell(false, CellAlign::Center, "2"),
                    cell(false, CellAlign::End, "3"),
                    cell(false, CellAlign::Start, "4"),
                ]),
                row(vec![cell(false, CellAlign::Start, "f")]),
            ],
        },
        DescriptionBlock::Table {
            head: Vec::new(),
            body: vec![row(vec![cell(false, CellAlign::Start, "bare")])],
        },
    ];
    assert_eq!(blocks(html), expected);
}

#[test]
fn details_keep_their_summary_and_open_state() {
    let html = "<details open><summary>Logs <code>x</code></summary><pre>a</pre>text</details>\
        <details><p>no summary</p></details>";

    let expected = [
        DescriptionBlock::Details {
            open: true,
            summary: vec![
                text("Logs "),
                DescriptionInline::Code {
                    text: "x".to_owned(),
                },
            ],
            blocks: vec![
                DescriptionBlock::Code {
                    language: None,
                    text: "a".to_owned(),
                },
                said("text"),
            ],
        },
        DescriptionBlock::Details {
            open: false,
            summary: Vec::new(),
            blocks: vec![said("no summary")],
        },
    ];
    assert_eq!(blocks(html), expected);
}

#[test]
fn an_ordered_list_keeps_its_start() {
    let html = "<ol start=\"3\"><li>c</li></ol><ol><li>a</li></ol><ol start=\"x\"><li>b</li></ol>\
        <ol start=\"0\"><li>z</li></ol><ol start=\"-2\"><li>m</li></ol>";

    let starts: Vec<ListNumbering> = blocks(html).iter().map(|list| list_parts(list).0).collect();
    let numbers = |start| ListNumbering::Numbers { start };
    assert_eq!(
        starts,
        [numbers(3), numbers(1), numbers(1), numbers(0), numbers(1)]
    );
}

#[test]
fn inline_runs_beside_blocks_become_paragraphs_and_white_space_between_blocks_vanishes() {
    let html = "<blockquote>\n  before <em>x</em>\n<p>para</p>\n  \n<ul><li>i</li></ul> after</blockquote>\n\
        <div>a</div><div>b</div>\n<section>in <span>a</span> <gl-emoji title=\"robot\" data-name=\"robot\">🤖</gl-emoji>\
        <p>block</p></section>";

    let expected = [
        DescriptionBlock::Quote {
            blocks: vec![
                paragraph(vec![
                    text("\n  before "),
                    DescriptionInline::Emphasis {
                        inlines: vec![text("x")],
                    },
                    text("\n"),
                ]),
                said("para"),
                DescriptionBlock::List {
                    numbering: ListNumbering::Bullets,
                    items: vec![item(TaskBox::None, vec![said("i")])],
                },
                said(" after"),
            ],
        },
        said("a"),
        said("b"),
        paragraph(vec![
            text("\n"),
            text("in "),
            text("a"),
            text(" "),
            text("🤖"),
        ]),
        said("block"),
    ];
    assert_eq!(blocks(html), expected);
}

#[test]
fn an_empty_or_comment_only_description_has_no_blocks() {
    for html in [
        "",
        "<!-- only a comment -->",
        "\n \n",
        "<p> </p>",
        "&#x000A;<!-- a -->&#x000A;",
    ] {
        assert_eq!(blocks(html), [], "{html:?}");
    }
}

#[test]
fn planted_script_style_frame_object_media_and_form_leave_nothing() {
    let read = read(&html_in(PLANTED));

    let tree = serde_json::to_string(&read.description).unwrap();
    let planted = [
        "yamtPlanted",
        "evil.example",
        "frame text",
        "display",
        "planted value",
        "Go planted",
        "svg text",
        "object text",
        "embed",
        "video text",
        "audio text",
        "noscript text",
        "template text",
        "textarea text",
        "option text",
        "title text",
        "deepest",
    ];
    for words in planted {
        assert!(!tree.contains(words), "{words} in {tree}");
    }
    let blocks = &read.description.blocks;
    let starts = [
        said("before"),
        paragraph(vec![image(web(&format!("{MERGE_REQUESTS}x")), "x", None)]),
        paragraph(vec![DescriptionInline::Link {
            link: page(&format!("{MERGE_REQUESTS}relative")),
            inlines: vec![text("relative link")],
        }]),
        said("text"),
    ];
    assert_eq!(blocks[..4], starts);
    assert_eq!(blocks.last(), Some(&said("after")));
    assert_eq!(read.uploads, Vec::<OfferedUpload>::new());
}

#[test]
fn no_key_but_the_contracts_crosses() {
    for answer in [PLANTED, RICH] {
        let read = read(&html_in(answer));
        let reply = DescriptionReply::Read {
            description: read.description,
        };
        let mut keys = BTreeSet::new();
        let mut strings = Vec::new();
        keys_and_strings(
            &serde_json::to_value(&reply).unwrap(),
            &mut keys,
            &mut strings,
        );

        let contract: BTreeSet<String> =
            CONTRACT_KEYS.iter().map(|key| (*key).to_owned()).collect();
        assert!(keys.is_subset(&contract), "{keys:?}");
        for string in strings {
            for planted in ["onerror", "onclick", "onload", "display:none", "color:red"] {
                assert!(!string.contains(planted), "{string}");
            }
        }
    }
}

#[test]
fn a_base_or_meta_element_changes_no_address() {
    let html = "<base href=\"https://evil.example/\"><meta http-equiv=\"refresh\" content=\"0;url=https://evil.example/\">\
        <p><a href=\"x\">x</a><img src=\"y.png\" alt=\"y\"></p>";

    let read = read(html);

    let link = DescriptionInline::Link {
        link: page(&format!("{MERGE_REQUESTS}x")),
        inlines: vec![text("x")],
    };
    let y = image(web(&format!("{MERGE_REQUESTS}y.png")), "y", None);
    assert_eq!(read.description.blocks, [paragraph(vec![link, y])]);
    assert_eq!(read.pages, [WebPage(format!("{MERGE_REQUESTS}x"))]);
}

#[test]
fn nesting_past_32_levels_is_left_out() {
    let quotes = format!(
        "{}<p>deepest</p>{}",
        "<blockquote>".repeat(40),
        "</blockquote>".repeat(40)
    );
    let ems = format!("<p>{}deep{}</p>", "<em>".repeat(40), "</em>".repeat(40));
    let html = format!("{quotes}{ems}<p>after</p>");

    let blocks = blocks(&html);

    let mut levels = 0;
    let mut inside = &blocks[..1];
    while let [DescriptionBlock::Quote { blocks }] = inside {
        levels += 1;
        inside = blocks;
    }
    assert_eq!((levels, inside), (MAX_NESTING, &[][..]));
    let DescriptionBlock::Paragraph { inlines } = &blocks[1] else {
        panic!("not a paragraph: {:?}", blocks[1]);
    };
    let mut levels = 0;
    let mut inside = &inlines[..];
    while let [DescriptionInline::Emphasis { inlines }] = inside {
        levels += 1;
        inside = inlines;
    }
    assert_eq!((levels, inside), (MAX_NESTING - 1, &[][..]));
    assert_eq!(blocks[2..], [said("after")]);
    assert_eq!(MAX_NESTING, 32);
}

#[test]
fn an_https_or_http_link_is_a_page() {
    let base = base();
    for (href, expected) in [
        ("https://docs.example/x", "https://docs.example/x"),
        ("http://plain.example/", "http://plain.example/"),
        (
            "HTTPS://Docs.Example/X?a=1#b",
            "https://docs.example/X?a=1#b",
        ),
        ("//other.example/y", "https://other.example/y"),
    ] {
        assert_eq!(link_of(Some(&base), href), page(expected), "{href}");
    }
    assert_eq!(
        link_of(None, "https://docs.example/x"),
        page("https://docs.example/x")
    );
}

#[test]
fn a_relative_link_resolves_on_the_merge_requests_gitlab_page() {
    let base = base();
    let sub_path = Url::parse(SUB_PATH_BASE).unwrap();
    let cases = [
        (&base, "/x", "https://gitlab.com/x"),
        (
            &base,
            "x",
            "https://gitlab.com/taskboard/taskboard/-/merge_requests/x",
        ),
        (
            &base,
            "#frag",
            "https://gitlab.com/taskboard/taskboard/-/merge_requests/52#frag",
        ),
        (
            &base,
            "/taskboard/taskboard/-/issues/12",
            "https://gitlab.com/taskboard/taskboard/-/issues/12",
        ),
        (
            &sub_path,
            "/gitlab/anna",
            "https://gitlab.example/gitlab/anna",
        ),
        (
            &sub_path,
            "../../-/issues/12",
            "https://gitlab.example/gitlab/taskboard/taskboard/-/issues/12",
        ),
        (
            &sub_path,
            "#frag",
            "https://gitlab.example/gitlab/taskboard/taskboard/-/merge_requests/52#frag",
        ),
    ];
    for (base, href, expected) in cases {
        assert_eq!(link_of(Some(base), href), page(expected), "{href}");
    }
}

#[test]
fn mailto_file_javascript_data_and_unreadable_links_are_refused_with_their_address() {
    let base = base();
    let refused_hrefs = [
        "mailto:anna@example.com",
        "file:///etc/passwd",
        "javascript:alert(1)",
        " JaVaScRiPt:alert(1)",
        "java\tscript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vscode://open",
        "http://[::1",
        "https://exa mple.example/",
    ];
    for href in refused_hrefs {
        assert_eq!(link_of(Some(&base), href), refused(href), "{href}");
    }
}

#[test]
fn a_described_page_has_no_space_quote_or_control_character() {
    let base = base();
    let hrefs = [
        "https://docs.example/a b\"c<d>e\tf\u{7}g'h`i",
        "a b\"c<d>e\u{7}f",
        "https://docs.example/?q=a b\"<\u{7}#x y\"",
    ];
    for href in hrefs {
        let DescriptionLink::Page { page } = link_of(Some(&base), href) else {
            panic!("refused: {href:?}");
        };
        let quoting = |c: char| c.is_whitespace() || c.is_control() || matches!(c, '"' | '<' | '>');
        assert!(!page.as_str().contains(quoting), "{page:?}");
    }
}

#[test]
fn without_an_https_origin_a_relative_link_is_refused() {
    for href in ["/x", "x", "#frag"] {
        assert_eq!(link_of(None, href), refused(href));
    }
    let html = "<p><a href=\"/x\">x</a><a href=\"https://docs.example/\">d</a>\
        <img src=\"/-/project/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/a.png\" alt=\"a\"></p>";
    let read = described(html, None);
    let expected = paragraph(vec![
        DescriptionInline::Link {
            link: refused("/x"),
            inlines: vec![text("x")],
        },
        DescriptionInline::Link {
            link: page("https://docs.example/"),
            inlines: vec![text("d")],
        },
        image(DescriptionImage::Refused, "a", None),
    ]);
    assert_eq!(read.description.blocks, [expected]);
    assert_eq!(read.pages, [WebPage("https://docs.example/".to_owned())]);
    let absolute = format!("{ORIGIN}/-/project/7/uploads/{HEX_A}/a.png");
    assert_eq!(image_of(None, &absolute), (web(&absolute), None));
}

#[test]
fn an_upload_on_the_projects_origin_is_uploaded_in_both_path_forms() {
    let base = base();
    let by_id = format!("{ORIGIN}/-/project/7/uploads/{HEX_A}/shot.png");
    let cases = [
        (
            &base,
            format!("/-/project/7/uploads/{HEX_A}/shot.png"),
            HEX_A,
            format!("projects/7/uploads/{HEX_A}/shot.png"),
            by_id.clone(),
        ),
        (
            &base,
            format!("{by_id}?w=1#x"),
            HEX_A,
            format!("projects/7/uploads/{HEX_A}/shot.png"),
            by_id.clone(),
        ),
        (
            &base,
            format!("/taskboard/taskboard/uploads/{HEX_B}/old a+b~c%20d.png"),
            HEX_B,
            format!("projects/taskboard%2Ftaskboard/uploads/{HEX_B}/old%20a+b~c%20d.png"),
            format!("{ORIGIN}/taskboard/taskboard/uploads/{HEX_B}/old%20a+b~c%20d.png"),
        ),
    ];
    for (base, src, secret, route, address) in cases {
        let (image, offered) = image_of(Some(base), &src);
        assert_eq!(image, uploaded(secret), "{src}");
        let offered = offered.unwrap();
        assert_eq!(offered.address, upload(&route, &address), "{src}");
        assert_eq!(offered.address.as_str(), address);
    }
}

#[test]
fn an_upload_shaped_address_that_breaks_a_rule_is_a_web_image() {
    let base = base();
    let on_origin_but_no_upload = [
        format!("/gitlab/-/project/7/uploads/{HEX_A}/a.png"),
        format!("/-/project/x7/uploads/{HEX_A}/a.png"),
        format!("/-/project//uploads/{HEX_A}/a.png"),
        format!("/-/project/7/uploads/{}/a.png", HEX_A.to_uppercase()),
        format!("/-/project/7/uploads/{}/a.png", &HEX_A[1..]),
        format!("/-/project/7/uploads/{HEX_A}0/a.png"),
        format!("/-/project/7/uploads/{HEX_A}/a/b.png"),
        format!("/-/project/7/uploads/{HEX_A}/"),
        format!("/-/project/7/uploads/{HEX_A}/a!.png"),
        format!("/x$/-/project/7/uploads/{HEX_A}/a.png"),
        format!("/-/group/7/uploads/{HEX_A}/a.png"),
        format!("/other/project/uploads/{HEX_A}/a.png"),
        format!("/taskboard/uploads/{HEX_A}/a.png"),
        format!("/-/project/7/files/{HEX_A}/a.png"),
    ];
    for src in on_origin_but_no_upload {
        let (image, offered) = image_of(Some(&base), &src);
        assert!(
            matches!(image, DescriptionImage::Web { .. }),
            "{src}: {image:?}"
        );
        assert_eq!(offered, None, "{src}");
    }
}

#[test]
fn an_upload_path_on_another_host_is_another_sites_image() {
    let base = base();
    for src in [
        format!("https://evil.example/-/project/7/uploads/{HEX_A}/x.png"),
        format!("https://gitlab.com:8443/-/project/7/uploads/{HEX_A}/x.png"),
        format!("https://evil.example/taskboard/taskboard/uploads/{HEX_A}/x.png"),
    ] {
        assert_eq!(image_of(Some(&base), &src), (web(&src), None), "{src}");
    }
}

#[test]
fn an_upload_on_a_self_managed_origin_is_a_web_image_with_its_absolute_address() {
    let self_managed = Url::parse(SELF_MANAGED_BASE).unwrap();
    let sub_path = Url::parse(SUB_PATH_BASE).unwrap();
    let cases = [
        (
            &self_managed,
            format!("/-/project/7/uploads/{HEX_A}/shot.png"),
            format!("https://gitlab.example/-/project/7/uploads/{HEX_A}/shot.png"),
        ),
        (
            &self_managed,
            format!("/taskboard/taskboard/uploads/{HEX_B}/old.png"),
            format!("https://gitlab.example/taskboard/taskboard/uploads/{HEX_B}/old.png"),
        ),
        (
            &sub_path,
            format!("/gitlab/-/project/7/uploads/{HEX_A}/shot.png"),
            format!("https://gitlab.example/gitlab/-/project/7/uploads/{HEX_A}/shot.png"),
        ),
    ];
    for (base, src, address) in cases {
        assert_eq!(image_of(Some(base), &src), (web(&address), None), "{src}");
    }
    let html = format!("<p><img src=\"/-/project/7/uploads/{HEX_A}/shot.png\" alt=\"shot\"></p>");
    let read = described(&html, Some(&WebPage(SELF_MANAGED_BASE.to_owned())));
    assert_eq!(read.uploads, Vec::<OfferedUpload>::new());
    assert_eq!(read.web_images, 1);
}

#[test]
fn http_data_and_file_images_are_refused() {
    let base = base();
    let http_upload = format!("http://gitlab.com/-/project/7/uploads/{HEX_A}/x.png");
    let refused_srcs = [
        "http://plain.example/p.png",
        http_upload.as_str(),
        "data:image/png;base64,iVBORw0KGgo=",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://[::1",
        "",
        "  ",
    ];
    for src in refused_srcs {
        assert_eq!(
            image_of(Some(&base), src),
            (DescriptionImage::Refused, None),
            "{src:?}"
        );
    }
}

#[test]
fn an_upload_key_is_never_a_username() {
    let (image, offered) = image_of(
        Some(&base()),
        &format!("/-/project/7/uploads/{HEX_A}/a.png"),
    );
    let key = offered.unwrap().key;

    assert_eq!(key.as_str(), format!("upload~{HEX_A}"));
    assert!(key.as_str().contains('~'), "GitLab usernames hold no ~");
    assert_eq!(
        serde_json::to_value(&image).unwrap(),
        json!({ "kind": "uploaded", "key": key.as_str() })
    );
}

#[test]
fn an_upload_key_is_upload_tilde_and_32_lowercase_hex_digits() {
    assert!(UploadKey::is_key(&format!("upload~{HEX_A}")));
    let not_keys = [
        format!("upload~{}", &HEX_A[1..]),
        format!("upload~{HEX_A}0"),
        format!("upload~{}", HEX_A.to_uppercase()),
        HEX_A.to_owned(),
        format!("upload{HEX_A}"),
        "anna".to_owned(),
        "upload~".to_owned(),
    ];
    for name in not_keys {
        assert!(!UploadKey::is_key(&name), "{name}");
    }
}

#[test]
fn pages_and_uploads_are_collected_once_each_in_order() {
    let a = format!("/-/project/7/uploads/{HEX_A}/a.png");
    let b = format!("/-/project/7/uploads/{HEX_B}/b.png");
    let html = format!(
        "<p><a href=\"https://docs.example/a\">a</a><img src=\"{b}\"><a href=\"/b\">b</a>\
         <a href=\"https://docs.example/a\">a again</a><a href=\"mailto:x@example.com\">m</a><a href=\"/empty\"></a>\
         <img src=\"{a}\"><img src=\"{b}\"><img src=\"https://images.example/c.png\"><a href=\"/c\">c</a></p>"
    );

    let read = read(&html);

    let pages = [
        "https://docs.example/a",
        "https://gitlab.com/b",
        "https://gitlab.com/c",
    ];
    let expected: Vec<WebPage> = pages
        .iter()
        .map(|page| WebPage((*page).to_owned()))
        .collect();
    assert_eq!(read.pages, expected);
    let keys: Vec<&str> = read
        .uploads
        .iter()
        .map(|offered| offered.key.as_str())
        .collect();
    assert_eq!(keys, [format!("upload~{HEX_B}"), format!("upload~{HEX_A}")]);
    assert_eq!(read.web_images, 1);
}

#[test]
fn a_commit_reference_keeps_gitlabs_title_and_no_other_link_does() {
    let commit = "/taskboard/taskboard/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f";
    let range = "/taskboard/taskboard/-/compare/a1b2c3d4...e5f6a7b8";
    let html = format!(
        "<p><a href=\"{commit}\" data-reference-type=\"commit\" title=\"Backfill due dates\">fa3335f3</a>\
         <a href=\"{range}\" data-reference-type=\"commit_range\" title=\"Commits a1b2c3d4 through e5f6a7b8\">r</a>\
         <a href=\"{commit}\" data-reference-type=\"commit\" title=\"A later title\">again</a>\
         <a href=\"/x/-/issues/1\" data-reference-type=\"issue\" title=\"An issue\">#1</a>\
         <a href=\"/x/-/commit/0badc0de\" data-reference-type=\"commit\" title=\"\">empty</a>\
         <a href=\"/x/-/commit/1badc0de\" title=\"A plain link's title\">plain</a>\
         <a href=\"/x/-/commit/2badc0de\" data-reference-type=\"commit\">untitled</a></p>"
    );

    let read = read(&html);

    let at = |path: &str| WebPage(format!("https://gitlab.com{path}"));
    let expected = BTreeMap::from([
        (at(commit), "Backfill due dates".to_owned()),
        (at(range), "Commits a1b2c3d4 through e5f6a7b8".to_owned()),
    ]);
    assert_eq!(read.commit_titles, expected);
    assert_eq!(read.pages.len(), 6);
}

#[test]
fn glabs_or_gitlabs_failure_is_the_reply_and_no_html_is_empty() {
    let failed = |message: &str| Err(message.to_owned());
    let answer = |data: Value| Ok(json!({ "data": data }).to_string().into_bytes());
    let refused =
        json!({ "data": null, "errors": [{ "message": "Field 'descriptionHtml' doesn't exist" }] });

    assert_eq!(
        html_of(Err("glab: a deadline line".to_owned())),
        failed("glab: a deadline line")
    );
    assert_eq!(
        html_of(Ok(refused.to_string().into_bytes())),
        failed("Field 'descriptionHtml' doesn't exist")
    );
    assert_eq!(
        html_of(answer(json!({ "project": null }))),
        failed(NO_PROJECT)
    );
    let no_merge_request = json!({ "project": { "mergeRequest": null } });
    assert_eq!(html_of(answer(no_merge_request)), failed(NO_MERGE_REQUEST));
    let no_html = json!({ "project": { "mergeRequest": { "descriptionHtml": null } } });
    assert_eq!(html_of(answer(no_html)), Ok(String::new()));
    let html = json!({ "project": { "mergeRequest": { "descriptionHtml": "<p>x</p>" } } });
    assert_eq!(html_of(answer(html)), Ok("<p>x</p>".to_owned()));
}

#[test]
fn the_log_names_each_replys_kind_as_the_window_does() {
    let replies = [
        DescriptionReply::Read {
            description: Description { blocks: Vec::new() },
        },
        DescriptionReply::GlabMissing,
        DescriptionReply::NotLoggedIn {
            detail: "gitlab.com".to_owned(),
        },
        DescriptionReply::Failed {
            message: "glab: a deadline line".to_owned(),
        },
    ];
    for reply in replies {
        assert_eq!(
            json!(outcome(&reply)),
            serde_json::to_value(&reply).unwrap()["kind"]
        );
    }
}
