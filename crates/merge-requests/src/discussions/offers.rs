use crate::description::Described;
use crate::{Description, OfferedUpload, WebPage};

/// The pages and uploads a read names for the shell to offer, each once, in the order first named.
pub(crate) struct Offers {
    pub(crate) pages: Vec<WebPage>,
    pub(crate) uploads: Vec<OfferedUpload>,
}

impl Offers {
    pub(crate) fn new() -> Self {
        Offers {
            pages: Vec::new(),
            uploads: Vec::new(),
        }
    }

    /// Adds `page` unless it is already there.
    pub(crate) fn page(&mut self, page: WebPage) {
        if !self.pages.contains(&page) {
            self.pages.push(page);
        }
    }

    /// Adds `described`'s pages and uploads (an upload once per key) and gives back its description.
    pub(crate) fn described(&mut self, described: Described) -> Description {
        for page in described.pages {
            self.page(page);
        }
        for upload in described.uploads {
            if !self.uploads.iter().any(|offered| offered.key == upload.key) {
                self.uploads.push(upload);
            }
        }
        described.description
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MergeRequestIid;
    use crate::description::described_on;
    use crate::discussions::sample::on_gitlab_com;

    const SECRET_A: &str = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
    const SECRET_B: &str = "f9e8d7c6b5a4938271605f4e3d2c1b0a";

    fn described(html: &str) -> Described {
        described_on(&on_gitlab_com(), MergeRequestIid(1), html)
    }

    fn link(page: &str) -> String {
        format!(r#"<a href="{page}">{page}</a>"#)
    }

    fn upload(secret: &str) -> String {
        format!(r#"<img src="/-/project/7/uploads/{secret}/shot.png">"#)
    }

    #[test]
    fn offers_keep_each_page_and_upload_once_in_order() {
        let a = "https://docs.example/a";
        let b = "https://docs.example/b";
        let c = "https://docs.example/c";
        let first = format!("<p>{}{}{}</p>", link(b), link(a), upload(SECRET_A));
        let second = format!(
            "<p>{}{}{}{}</p>",
            link(a),
            link(c),
            upload(SECRET_B),
            upload(SECRET_A)
        );
        let mut offers = Offers::new();

        offers.page(WebPage(a.to_owned()));
        let description = offers.described(described(&first));
        offers.described(described(&second));
        offers.page(WebPage(c.to_owned()));

        let pages: Vec<&str> = offers.pages.iter().map(WebPage::as_str).collect();
        assert_eq!(pages, [a, b, c]);
        let keys: Vec<&str> = offers
            .uploads
            .iter()
            .map(|upload| upload.key.as_str())
            .collect();
        assert_eq!(
            keys,
            [format!("upload~{SECRET_A}"), format!("upload~{SECRET_B}")]
        );
        assert_eq!(description, described(&first).description);
    }
}
