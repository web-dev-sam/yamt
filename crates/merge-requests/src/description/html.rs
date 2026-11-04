use std::collections::BTreeMap;
use std::mem;

use dom_query::{Document, NodeRef};
use url::Url;

use super::address::{image_of, link_of};
use super::element::{align, code, commit_title, heading_level, numbers, task_box};
use super::size::image_size;
use super::{
    Description, DescriptionBlock, DescriptionCell, DescriptionImage, DescriptionInline,
    DescriptionItem, DescriptionLink, DescriptionRow, ListNumbering, OfferedUpload,
};
use crate::WebPage;

/// The deepest element of a description yamt shows; deeper content is left out, so a planted nesting cannot
/// exhaust the walk's stack.
pub(crate) const MAX_NESTING: usize = 32;

/// Elements left out with their text: what runs, loads, submits or takes input, and what only a page's head holds
/// (rule 6, RK66). The task box `input` is read by its list item.
const LEFT_OUT: [&str; 27] = [
    "script", "style", "template", "noscript", "iframe", "frame", "frameset", "object", "embed",
    "applet", "video", "audio", "source", "track", "canvas", "svg", "math", "link", "meta", "base",
    "head", "title", "button", "select", "textarea", "option", "input",
];
const CAPTION_ATTRIBUTES: [&str; 2] = ["alt", "title"];

/// What a description's HTML gives: the tree, and every page and upload it names.
pub(crate) struct Described {
    pub description: Description,
    pub pages: Vec<WebPage>,
    /// GitLab's non-empty `title` on each link it made from a commit or a commit range (`data-reference-type`
    /// `commit` or `commit_range`), by the link's page; no other link's `title` is kept.
    pub commit_titles: BTreeMap<WebPage, String>,
    pub uploads: Vec<OfferedUpload>,
    /// Its images from other sites, for the log.
    pub web_images: usize,
}

/// A node the walk looks at: text, or an element neither left out nor too deep, with its name and depth.
enum Child<'a> {
    Text(String),
    Element {
        node: NodeRef<'a>,
        name: String,
        depth: usize,
    },
}

/// The walk's findings so far.
struct Walk {
    base: Option<Url>,
    pages: Vec<WebPage>,
    commit_titles: BTreeMap<WebPage, String>,
    uploads: Vec<OfferedUpload>,
    web_images: usize,
    /// Inside a link, images go to `lifted` and follow the link.
    in_link: bool,
    lifted: Vec<DescriptionInline>,
    too_deep: bool,
}

/// `base`: the merge request's GitLab page (`WebPage::merge_request`), None off https.
pub(crate) fn described(html: &str, base: Option<&WebPage>) -> Described {
    let mut walk = Walk {
        base: base.and_then(|page| Url::parse(page.as_str()).ok()),
        pages: Vec::new(),
        commit_titles: BTreeMap::new(),
        uploads: Vec::new(),
        web_images: 0,
        in_link: false,
        lifted: Vec::new(),
        too_deep: false,
    };
    let document = Document::fragment(html);
    let top = document.root().first_element_child();
    let blocks = top.map_or_else(Vec::new, |top| walk.blocks(&top, 0));
    if walk.too_deep {
        tracing::warn!(
            MAX_NESTING,
            "a description nests deeper than yamt shows; the deeper part is left out"
        );
    }
    Described {
        description: Description { blocks },
        pages: walk.pages,
        commit_titles: walk.commit_titles,
        uploads: walk.uploads,
        web_images: walk.web_images,
    }
}

impl Walk {
    /// `parent`'s children the walk looks at; `depth` is `parent`'s, the top's 0. Comments, left-out elements and
    /// elements deeper than `MAX_NESTING` are not among them.
    fn children<'a>(&mut self, parent: &NodeRef<'a>, depth: usize) -> Vec<Child<'a>> {
        let mut children = Vec::new();
        for node in parent.children() {
            if node.is_text() {
                children.push(Child::Text(node.text().to_string()));
                continue;
            }
            let Some(name) = node.node_name() else {
                continue;
            };
            let name = name.to_string();
            if LEFT_OUT.contains(&name.as_str()) {
                continue;
            }
            if depth >= MAX_NESTING {
                self.too_deep = true;
                continue;
            }
            children.push(Child::Element {
                node,
                name,
                depth: depth + 1,
            });
        }
        children
    }

    fn blocks(&mut self, parent: &NodeRef, depth: usize) -> Vec<DescriptionBlock> {
        let mut blocks = Vec::new();
        let mut run = Vec::new();
        self.blocks_into(parent, depth, &mut blocks, &mut run);
        push_paragraph(&mut blocks, run);
        blocks
    }

    /// `parent`'s blocks into `blocks`; inline content gathers in `run` until a block ends it as a paragraph. An
    /// element neither block nor inline gives its content in place.
    fn blocks_into(
        &mut self,
        parent: &NodeRef,
        depth: usize,
        blocks: &mut Vec<DescriptionBlock>,
        run: &mut Vec<DescriptionInline>,
    ) {
        for child in self.children(parent, depth) {
            let (node, name, depth) = match child {
                Child::Text(text) => {
                    run.push(DescriptionInline::Text { text });
                    continue;
                }
                Child::Element { node, name, depth } => (node, name, depth),
            };
            if let Some(inlines) = self.inline(&node, &name, depth) {
                run.extend(inlines);
            } else if let Some(found) = self.block(&node, &name, depth) {
                push_paragraph(blocks, mem::take(run));
                blocks.extend(found);
            } else {
                self.blocks_into(&node, depth, blocks, run);
            }
        }
    }

    /// The blocks a block element makes; None for any other element.
    fn block(&mut self, node: &NodeRef, name: &str, depth: usize) -> Option<Vec<DescriptionBlock>> {
        let block = match name {
            "p" => {
                let mut paragraph = Vec::new();
                push_paragraph(&mut paragraph, self.inlines(node, depth));
                return Some(paragraph);
            }
            "div" => return Some(self.blocks(node, depth)),
            "summary" => return Some(Vec::new()),
            "pre" => code(&self.plain_text(node, depth), node),
            "ul" => self.list(node, ListNumbering::Bullets, depth),
            "ol" => self.list(node, numbers(node), depth),
            "blockquote" => DescriptionBlock::Quote {
                blocks: self.blocks(node, depth),
            },
            "hr" => DescriptionBlock::Rule,
            "table" => self.table(node, depth),
            "details" => self.details(node, depth),
            _ => {
                let level = heading_level(name)?;
                let inlines = self.inlines(node, depth);
                DescriptionBlock::Heading { level, inlines }
            }
        };
        Some(vec![block])
    }

    /// `parent`'s inline content; a block element in it gives its content.
    fn inlines(&mut self, parent: &NodeRef, depth: usize) -> Vec<DescriptionInline> {
        let mut inlines = Vec::new();
        for child in self.children(parent, depth) {
            match child {
                Child::Text(text) => inlines.push(DescriptionInline::Text { text }),
                Child::Element { node, name, depth } => match self.inline(&node, &name, depth) {
                    Some(found) => inlines.extend(found),
                    None => inlines.extend(self.inlines(&node, depth)),
                },
            }
        }
        inlines
    }

    /// What an inline element makes; None for any other element.
    fn inline(
        &mut self,
        node: &NodeRef,
        name: &str,
        depth: usize,
    ) -> Option<Vec<DescriptionInline>> {
        let inline = match name {
            "em" | "i" => DescriptionInline::Emphasis {
                inlines: self.inlines(node, depth),
            },
            "strong" | "b" => DescriptionInline::Strong {
                inlines: self.inlines(node, depth),
            },
            "del" | "s" | "strike" => DescriptionInline::Strike {
                inlines: self.inlines(node, depth),
            },
            "code" => DescriptionInline::Code {
                text: self.plain_text(node, depth),
            },
            "br" => DescriptionInline::LineBreak,
            "a" => return Some(self.link(node, depth)),
            "img" => return Some(self.image(node)),
            _ => return None,
        };
        Some(vec![inline])
    }

    /// The link, then the images lifted out of it; a link with an empty content, without `href` or inside another
    /// link gives its content only.
    fn link(&mut self, node: &NodeRef, depth: usize) -> Vec<DescriptionInline> {
        let href = node.attr("href").filter(|_| !self.in_link);
        let Some(href) = href else {
            return self.inlines(node, depth);
        };
        self.in_link = true;
        let inlines = self.inlines(node, depth);
        self.in_link = false;
        let mut found = Vec::new();
        if !is_blank(&inlines) {
            let link = link_of(self.base.as_ref(), &href);
            if let DescriptionLink::Page { page } = &link {
                self.keep_page(page, commit_title(node));
            }
            found.push(DescriptionInline::Link { link, inlines });
        }
        found.append(&mut self.lifted);
        found
    }

    /// `page` once among the pages; a commit's `title`, the first one per page.
    fn keep_page(&mut self, page: &WebPage, commit_title: Option<String>) {
        if !self.pages.contains(page) {
            self.pages.push(page.clone());
        }
        if let Some(title) = commit_title {
            self.commit_titles.entry(page.clone()).or_insert(title);
        }
    }

    /// The image from `data-src` (GitLab's lazy images), else `src`; inside a link it waits in `lifted`.
    fn image(&mut self, node: &NodeRef) -> Vec<DescriptionInline> {
        let address = node.attr("data-src").or_else(|| node.attr("src"));
        let written = address.as_deref().unwrap_or_default();
        let (image, upload) = image_of(self.base.as_ref(), written);
        if let Some(upload) = upload
            && !self.uploads.iter().any(|offered| offered.key == upload.key)
        {
            self.uploads.push(upload);
        }
        if let DescriptionImage::Web { .. } = image {
            self.web_images += 1;
        }
        let caption = CAPTION_ATTRIBUTES
            .iter()
            .find_map(|name| node.attr(name).filter(|value| !value.is_empty()))
            .map_or_else(|| written.to_owned(), |caption| caption.to_string());
        let image = DescriptionInline::Image {
            image,
            caption,
            size: image_size(node),
        };
        if self.in_link {
            self.lifted.push(image);
            return Vec::new();
        }
        vec![image]
    }

    /// The text of `parent`'s children, elements' text included.
    fn plain_text(&mut self, parent: &NodeRef, depth: usize) -> String {
        let mut text = String::new();
        for child in self.children(parent, depth) {
            match child {
                Child::Text(piece) => text.push_str(&piece),
                Child::Element { node, depth, .. } => text.push_str(&self.plain_text(&node, depth)),
            }
        }
        text
    }

    /// `parent`'s child elements named one of `names`, each with its name and depth.
    fn elements<'a>(
        &mut self,
        parent: &NodeRef<'a>,
        depth: usize,
        names: &[&str],
    ) -> Vec<(NodeRef<'a>, String, usize)> {
        let mut elements = Vec::new();
        for child in self.children(parent, depth) {
            if let Child::Element { node, name, depth } = child
                && names.contains(&name.as_str())
            {
                elements.push((node, name, depth));
            }
        }
        elements
    }

    /// Its `li` children as items; anything else in a list is left out.
    fn list(&mut self, node: &NodeRef, numbering: ListNumbering, depth: usize) -> DescriptionBlock {
        let mut items = Vec::new();
        for (item, _, depth) in self.elements(node, depth, &["li"]) {
            let task = task_box(&item);
            let blocks = self.blocks(&item, depth);
            items.push(DescriptionItem { task, blocks });
        }
        DescriptionBlock::List { numbering, items }
    }

    /// `thead`'s rows as the head, `tbody`'s and `tfoot`'s as the body (the parser puts every bare `tr` in a
    /// `tbody`).
    fn table(&mut self, node: &NodeRef, depth: usize) -> DescriptionBlock {
        let mut head = Vec::new();
        let mut body = Vec::new();
        for (section, name, depth) in self.elements(node, depth, &["thead", "tbody", "tfoot"]) {
            let rows = self.rows(&section, depth);
            if name == "thead" {
                head.extend(rows);
            } else {
                body.extend(rows);
            }
        }
        DescriptionBlock::Table { head, body }
    }

    fn rows(&mut self, section: &NodeRef, depth: usize) -> Vec<DescriptionRow> {
        let mut rows = Vec::new();
        for (row, _, depth) in self.elements(section, depth, &["tr"]) {
            let cells = self.cells(&row, depth);
            rows.push(DescriptionRow { cells });
        }
        rows
    }

    fn cells(&mut self, row: &NodeRef, depth: usize) -> Vec<DescriptionCell> {
        let mut cells = Vec::new();
        for (cell, name, depth) in self.elements(row, depth, &["th", "td"]) {
            let inlines = self.inlines(&cell, depth);
            let align = align(&cell);
            cells.push(DescriptionCell {
                header: name == "th",
                align,
                inlines,
            });
        }
        cells
    }

    /// Its first `summary` child as the summary, the rest as its blocks.
    fn details(&mut self, node: &NodeRef, depth: usize) -> DescriptionBlock {
        let summaries = self.elements(node, depth, &["summary"]);
        let summary = match summaries.first() {
            Some((summary, _, inner)) => self.inlines(summary, *inner),
            None => Vec::new(),
        };
        DescriptionBlock::Details {
            open: node.has_attr("open"),
            summary,
            blocks: self.blocks(node, depth),
        }
    }
}

/// A paragraph of `inlines` at the end of `blocks`, unless they are only white space.
fn push_paragraph(blocks: &mut Vec<DescriptionBlock>, inlines: Vec<DescriptionInline>) {
    if !is_blank(&inlines) {
        blocks.push(DescriptionBlock::Paragraph { inlines });
    }
}

/// Nothing, or only white-space text.
fn is_blank(inlines: &[DescriptionInline]) -> bool {
    inlines
        .iter()
        .all(|inline| matches!(inline, DescriptionInline::Text { text } if text.trim().is_empty()))
}
