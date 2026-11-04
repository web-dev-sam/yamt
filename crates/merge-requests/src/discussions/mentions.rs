use dom_query::Document;
use serde::Serialize;
use specta::Type;

/// GitLab's link to a user (`UserReferenceFilter#link_to_user`); a group's link carries `data-group` and `@all`'s
/// `data-project` instead of `data-user` (`lib/banzai/filter/references/user_reference_filter.rb`).
const USER_LINK: &str =
    r#"a[data-reference-type="user"][data-user]:not([data-group]):not([data-project])"#;

/// A user GitLab linked as a mention in a note: `a[data-reference-type="user"][data-user]` of its `bodyHtml`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    /// The `href`'s last path segment, when it is `[A-Za-z0-9_.-]+` (else the link is not a mention).
    pub username: String,
    /// The link's `title` (GitLab's name of the user), else the username.
    pub name: String,
}

/// Pure: the mentions of one note's HTML, in document order, each username once; never a link with `data-group`
/// or `data-project` (a group, `@all`), never text (code spans render as `<code>`, no link, design §1.2).
pub(crate) fn mentions_in(html: &str) -> Vec<Mention> {
    let document = Document::fragment(html);
    let mut mentions: Vec<Mention> = Vec::new();
    let Some(links) = document.try_select(USER_LINK) else {
        return mentions;
    };
    for link in links.nodes() {
        let Some(username) = link.attr("href").and_then(|href| username_of(&href)) else {
            continue;
        };
        if mentions.iter().any(|mention| mention.username == username) {
            continue;
        }
        let title = link.attr("title").filter(|title| !title.is_empty());
        let name = title.map_or_else(|| username.clone(), |title| title.to_string());
        mentions.push(Mention { username, name });
    }
    mentions
}

/// The last path segment of GitLab's `user_url(username)`, relative (`/sam`) or absolute (`https://gitlab.com/sam`).
fn username_of(href: &str) -> Option<String> {
    let segment = href.rsplit('/').next()?;
    let is_username_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-');
    let is_username = !segment.is_empty() && segment.chars().all(is_username_char);
    is_username.then(|| segment.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_a_user_link_with_data_user_is_a_mention() {
        let html = concat!(
            r#"<p><a href="/sam" data-reference-type="user" data-user="1" title="Sam Weller">@sam</a> "#,
            r#"<a href="/taskboard" data-reference-type="user" data-group="9" title="Taskboard">@taskboard</a> "#,
            r#"<a href="/taskboard/taskboard" data-reference-type="user" data-project="7" data-author="4" "#,
            r#"title="All Project and Group Members">@all</a> "#,
            r#"<a href="/team" data-reference-type="user" data-user="8" data-group="9" title="T">@team</a> "#,
            r#"<a href="/crew" data-reference-type="user" data-user="8" data-project="7" title="C">@crew</a> "#,
            "<code>@ben</code> and @ben in text ",
            r#"<a href="https://gitlab.com/anna" data-reference-type="user" data-user="2" title="Anna Berg">@anna</a> "#,
            r#"<a href="/sam" data-reference-type="user" data-user="1" title="Sam again">@sam</a> "#,
            r#"<a href="/bad%20name" data-reference-type="user" data-user="3" title="Bad">@bad</a> "#,
            r#"<a href="/" data-reference-type="user" data-user="3" title="Root">@root</a> "#,
            r#"<a href="/ben" data-user="3" title="Ben">@ben</a> "#,
            r#"<a href="/chiara" data-reference-type="user" title="Chiara">@chiara</a> "#,
            r#"<a data-reference-type="user" data-user="4" title="No href">@nohref</a> "#,
            r#"<a href="/dmitri.v-2_x" data-reference-type="user" data-user="5" title="">@dmitri</a></p>"#,
        );

        let mentions = mentions_in(html);

        let mention = |username: &str, name: &str| Mention {
            username: username.to_owned(),
            name: name.to_owned(),
        };
        let expected = [
            mention("sam", "Sam Weller"),
            mention("anna", "Anna Berg"),
            mention("dmitri.v-2_x", "dmitri.v-2_x"),
        ];
        assert_eq!(mentions, expected);
        assert_eq!(mentions_in("<p>@sam</p>"), []);
    }
}
