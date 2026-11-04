use serde_json::{Value, json};

use super::lookup::{LOOKUP_BUDGET, MAX_IIDS_PER_PART, PART_SCORE};
use super::*;

const ORIGIN: &str = "https://gitlab.example";
const PROJECT: &str = "taskboard/taskboard";
const FULL_SHA: &str = "fa3335f304f9482273040a55bc9386ddffc6a59f";
const MR_SHA: &str = "6ea97d8c0123456789abcdef0123456789abcdef";

fn project() -> Project {
    Project {
        full_path: PROJECT.to_owned(),
        web_path: format!("/{PROJECT}"),
        web_origin: Some(ORIGIN.to_owned()),
    }
}

fn server() -> Server {
    Server::of(&project()).unwrap()
}

fn at(path: &str) -> WebPage {
    WebPage(format!("{ORIGIN}{path}"))
}

fn in_project(path: &str, iid: u64) -> Target {
    Target::Item {
        namespace: Namespace::Project(path.to_owned()),
        iid,
    }
}

fn in_group(path: &str, iid: u64) -> Target {
    Target::Item {
        namespace: Namespace::Group(path.to_owned()),
        iid,
    }
}

fn commit(project: &str, sha: &str) -> Target {
    Target::Commit {
        project: project.to_owned(),
        sha: sha.to_owned(),
    }
}

/// A description linking each of `hrefs`, in order.
fn linking(hrefs: &[&str]) -> String {
    let links: Vec<String> = hrefs
        .iter()
        .map(|href| format!("<a href=\"{href}\">link</a>"))
        .collect();
    format!("<p>{}</p>", links.join(" "))
}

fn work_item(iid: u64, kind: &str, title: &str, state: &str, parent: &Value) -> Value {
    json!({
        "iid": iid.to_string(), "title": title, "state": state,
        "webUrl": format!("{ORIGIN}/x/-/work_items/{iid}"), "workItemType": { "name": kind },
        "widgets": [{}, { "parent": parent }, {}],
    })
}

fn issue(iid: u64, title: &str) -> Value {
    work_item(iid, "Issue", title, "OPEN", &Value::Null)
}

fn parent(kind: &str, title: &str, url: &str) -> Value {
    json!({ "iid": "1", "title": title, "webUrl": url, "workItemType": { "name": kind } })
}

/// A GraphQL answer holding `parts` (`part<k>` → its nodes, or null).
fn answer(parts: &[Option<Vec<Value>>]) -> Vec<u8> {
    let mut data = json!({ "queryComplexity": { "score": 50, "limit": 250 } });
    for (k, nodes) in parts.iter().enumerate() {
        data[format!("part{k}")] = match nodes {
            Some(nodes) => json!({ "workItems": { "nodes": nodes } }),
            None => Value::Null,
        };
    }
    json!({ "data": data }).to_string().into_bytes()
}

/// The links of `html` on `project`, each lookup call answered `answered` and recorded in `asked`.
fn read_with(
    project: &Project,
    html: &str,
    answered: &[Option<Vec<Value>>],
    asked: &mut Vec<Vec<Part>>,
) -> Result<Read, String> {
    let mut fetch = |call: &[Part]| {
        asked.push(call.to_vec());
        Ok(answer(answered))
    };
    links_of(project, MergeRequestIid(62), html, &mut fetch)
}

fn links(html: &str, answered: &[Option<Vec<Value>>]) -> DescriptionLinks {
    read_with(&project(), html, answered, &mut Vec::new())
        .unwrap()
        .links
}

fn shown_issue(title: &str, parent: Option<LinkedParent>) -> ShownIssue {
    ShownIssue {
        title: title.to_owned(),
        closed: false,
        parent,
    }
}

/// Each epic's and issue's line as `<group> <reference> <title, or "-" when not shown>[ closed]`.
fn lines(links: &DescriptionLinks) -> Vec<String> {
    let written = |group: &str, reference: &str, shown: Option<(&str, bool)>| {
        let shown = match shown {
            Some((title, true)) => format!("{title} closed"),
            Some((title, false)) => title.to_owned(),
            None => "-".to_owned(),
        };
        format!("{group} {reference} {shown}")
    };
    let mut summary = Vec::new();
    for epic in &links.epics {
        let shown = epic
            .shown
            .as_ref()
            .map(|shown| (shown.title.as_str(), shown.closed));
        summary.push(written("epic", &epic.reference, shown));
    }
    for issue in &links.issues {
        let shown = issue
            .shown
            .as_ref()
            .map(|shown| (shown.title.as_str(), shown.closed));
        summary.push(written("issue", &issue.reference, shown));
    }
    summary
}

/// Fields a CE server or GitLab Free refuses, or that a work item lacks at 15.6 (RK69).
const PREMIUM_ONLY: [&str; 7] = [
    "epic(",
    "epics",
    "hasEpic",
    "hasParent",
    "onlyTypes",
    "reference",
    "namespace",
];

const LOOKUP_QUERY: &str = "query=query MergeRequestLinks($path0: ID!, $iids0: [String!], $first0: Int!, \
     $path1: ID!, $iids1: [String!], $first1: Int!) { queryComplexity { score limit } part0: project(fullPath: \
     $path0) { workItems(iids: $iids0, first: $first0) { nodes { ...linked } } } part1: group(fullPath: $path1) { \
     workItems(iids: $iids1, first: $first1) { nodes { ...linked } } } } fragment linked on WorkItem { iid title \
     state webUrl workItemType { name } widgets { ... on WorkItemWidgetHierarchy { parent { iid title webUrl \
     workItemType { name } } } } }";

const LOOKUP_ARGS: [&str; 16] = [
    "api",
    "graphql",
    "-f",
    LOOKUP_QUERY,
    "-f",
    "path0=taskboard/taskboard",
    "-F",
    "iids0=[\"12\",\"13\"]",
    "-F",
    "first0=2",
    "-f",
    "path1=taskboard",
    "-F",
    "iids1=[\"3\"]",
    "-F",
    "first1=1",
];

/// Addresses on the project's server that are no epic, issue or commit of it: a merge request, a label, a
/// milestone, a person, snippets, designs, longer or shorter paths, a compare of branches, ids that are no commit,
/// a `groups` project, a group's issue route, a diff without a commit, another host or port, http.
const NOT_COUNTED: [&str; 27] = [
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/7",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests?label_name=frontend",
    "https://gitlab.example/taskboard/taskboard/-/milestones/1",
    "https://gitlab.example/anna",
    "https://gitlab.example/taskboard/taskboard/-/snippets/3",
    "https://gitlab.example/-/snippets/3",
    "https://gitlab.example/taskboard/taskboard/-/issues/12/designs",
    "https://gitlab.example/taskboard/taskboard/-/issues/12/",
    "https://gitlab.example/taskboard/taskboard/-/issues/x12",
    "https://gitlab.example/taskboard/taskboard/-/issues",
    "https://gitlab.example/taskboard/taskboard/-/compare/main...feature",
    "https://gitlab.example/taskboard/taskboard/-/compare/a1b2c3d4...feature",
    "https://gitlab.example/taskboard/taskboard/-/commit/FA3335F3",
    "https://gitlab.example/taskboard/taskboard/-/commit/fa3335",
    "https://gitlab.example/taskboard/taskboard/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f0",
    "https://gitlab.example/taskboard/taskboard/-/commit/main",
    "https://gitlab.example/groups/-/issues/1",
    "https://gitlab.example/groups/taskboard/-/issues/1",
    "https://gitlab.example/groups/taskboard/-/epics/3/designs",
    "https://gitlab.example/-/issues/1",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/62/diffs",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/62/diffs?commit_id=6ea97d8c",
    "https://gitlab.example/taskboard/taskboard/-/merge_requests/x/diffs?commit_id=6ea97d8c0123456789abcdef0123456789abcdef",
    "https://gitlab.other/taskboard/taskboard/-/issues/1",
    "https://gitlab.example:8443/taskboard/taskboard/-/issues/1",
    "http://gitlab.example/taskboard/taskboard/-/issues/1",
    "https://docs.example/taskboard/taskboard/-/issues/1",
];

/// Every route of an epic or an issue, with the item it names.
fn counted_items() -> [(&'static str, Target); 8] {
    [
        ("/groups/taskboard/-/epics/3", in_group("taskboard", 3)),
        (
            "/groups/taskboard/sub/-/work_items/4",
            in_group("taskboard/sub", 4),
        ),
        ("/taskboard/taskboard/-/issues/12", in_project(PROJECT, 12)),
        (
            "/taskboard/taskboard/-/issues/12#note_7",
            in_project(PROJECT, 12),
        ),
        (
            "/taskboard/taskboard/-/issues/12?x=1",
            in_project(PROJECT, 12),
        ),
        (
            "/taskboard/taskboard/-/issues/incident/7",
            in_project(PROJECT, 7),
        ),
        (
            "/taskboard/taskboard/-/work_items/13",
            in_project(PROJECT, 13),
        ),
        ("/other/lib/sub/-/issues/5", in_project("other/lib/sub", 5)),
    ]
}

/// Every route of a commit or a range, with the commit or range it names.
fn counted_commits() -> [(String, Target); 4] {
    let range = Target::Range {
        project: PROJECT.to_owned(),
        from: "a1b2c3d4".to_owned(),
        to: "e5f6a7b8".to_owned(),
    };
    [
        (
            format!("/{PROJECT}/-/commit/fa3335f"),
            commit(PROJECT, "fa3335f"),
        ),
        (
            format!("/{PROJECT}/-/commit/{FULL_SHA}"),
            commit(PROJECT, FULL_SHA),
        ),
        (
            format!("/{PROJECT}/-/compare/a1b2c3d4...e5f6a7b8"),
            range.clone(),
        ),
        (format!("/{PROJECT}/-/compare/a1b2c3d4..e5f6a7b8"), range),
    ]
}

#[test]
fn only_issue_epic_and_commit_addresses_on_the_projects_server_count() {
    let server = server();

    for (path, expected) in counted_items() {
        assert_eq!(target_of(&server, &at(path)), Some(expected), "{path}");
    }
    for (path, expected) in counted_commits() {
        assert_eq!(target_of(&server, &at(&path)), Some(expected), "{path}");
    }
    for address in NOT_COUNTED {
        let page = WebPage(address.to_owned());
        assert_eq!(target_of(&server, &page), None, "{address}");
    }
}

#[test]
fn a_sub_path_install_reads_its_addresses_under_the_sub_path() {
    let project = Project {
        full_path: PROJECT.to_owned(),
        web_path: format!("/gitlab/{PROJECT}"),
        web_origin: Some("https://host.example".to_owned()),
    };
    let server = Server::of(&project).unwrap();
    let page = |address: &str| WebPage(format!("https://host.example{address}"));

    let issue = page("/gitlab/taskboard/taskboard/-/issues/12");
    assert_eq!(target_of(&server, &issue), Some(in_project(PROJECT, 12)));
    let epic = page("/gitlab/groups/taskboard/-/epics/3");
    assert_eq!(target_of(&server, &epic), Some(in_group("taskboard", 3)));
    for outside in [
        "/taskboard/taskboard/-/issues/12",
        "/groups/taskboard/-/epics/3",
        "/gitlabx/taskboard/taskboard/-/issues/12",
        "/other/taskboard/taskboard/-/issues/12",
    ] {
        assert_eq!(target_of(&server, &page(outside)), None, "{outside}");
    }
    let odd = Project {
        web_path: "/gitlab/other/project".to_owned(),
        ..project
    };
    assert!(Server::of(&odd).is_none());
}

#[test]
fn a_merge_requests_own_commit_link_is_that_commit() {
    let server = server();
    for query in [
        format!("commit_id={MR_SHA}"),
        format!("diff_id=4&commit_id={MR_SHA}#note_1"),
    ] {
        let page = at(&format!("/{PROJECT}/-/merge_requests/62/diffs?{query}"));
        assert_eq!(
            target_of(&server, &page),
            Some(commit(PROJECT, MR_SHA)),
            "{query}"
        );
    }
    let html = linking(&[
        &format!("/{PROJECT}/-/merge_requests/62/diffs?commit_id={MR_SHA}"),
        &format!("/{PROJECT}/-/commit/6ea97d8c"),
    ]);

    let commits = links(&html, &[]).commits;

    let expected = LinkedCommit {
        reference: "6ea97d8c".to_owned(),
        page: at(&format!(
            "/{PROJECT}/-/merge_requests/62/diffs?commit_id={MR_SHA}"
        )),
        title: None,
    };
    assert_eq!(commits, [expected]);
}

#[test]
fn references_read_as_gitlab_writes_them_from_the_project() {
    let range = |project: &str| Target::Range {
        project: project.to_owned(),
        from: FULL_SHA.to_owned(),
        to: "e5f6a7b8".to_owned(),
    };
    let cases = [
        (in_project(PROJECT, 12), false, "#12"),
        (in_project("taskboard/web", 6), false, "web#6"),
        (in_project("other/lib", 5), false, "other/lib#5"),
        (
            in_project("taskboard/web/sub", 6),
            false,
            "taskboard/web/sub#6",
        ),
        (in_group("taskboard", 3), true, "&3"),
        (in_group("design", 2), true, "design&2"),
        (in_group("taskboard/sub", 2), true, "taskboard/sub&2"),
        (in_group("taskboard", 4), false, "taskboard#4"),
        (in_project(PROJECT, 9), true, "#9"),
        (commit(PROJECT, FULL_SHA), false, "fa3335f3"),
        (commit(PROJECT, "fa3335f"), false, "fa3335f"),
        (commit("taskboard/web", FULL_SHA), false, "web@fa3335f3"),
        (commit("other/lib", FULL_SHA), false, "other/lib@fa3335f3"),
        (range(PROJECT), false, "fa3335f3…e5f6a7b8"),
        (range("other/lib"), false, "other/lib@fa3335f3…e5f6a7b8"),
    ];
    for (target, is_epic, expected) in cases {
        assert_eq!(reference(&target, is_epic, PROJECT), expected, "{target:?}");
    }
}

#[test]
fn one_thing_written_three_ways_is_one_line_at_its_first_mention() {
    let html = linking(&[
        "/taskboard/taskboard/-/work_items/12",
        "https://gitlab.example/taskboard/taskboard/-/issues/12#note_7",
        "/taskboard/taskboard/-/issues/12",
        "/groups/taskboard/-/epics/3",
        "/groups/taskboard/-/work_items/3",
    ]);
    let mut asked = Vec::new();

    let read = read_with(
        &project(),
        &html,
        &[Some(vec![issue(12, "Snooze")]), Some(Vec::new())],
        &mut asked,
    )
    .unwrap();

    let expected = LinkedIssue {
        reference: "#12".to_owned(),
        page: at("/taskboard/taskboard/-/work_items/12"),
        shown: Some(shown_issue("Snooze", None)),
    };
    assert_eq!(read.links.issues, [expected]);
    let epic_pages: Vec<&WebPage> = read.links.epics.iter().map(|epic| &epic.page).collect();
    assert_eq!(epic_pages, [&at("/groups/taskboard/-/epics/3")]);
    let iids: Vec<&[u64]> = asked[0].iter().map(|part| part.iids.as_slice()).collect();
    assert_eq!(iids, [&[12][..], &[3][..]]);
}

#[test]
fn a_short_commit_id_is_the_commit_it_starts() {
    let short = format!("/{PROJECT}/-/commit/fa3335f3");
    let full = format!("/{PROJECT}/-/commit/{FULL_SHA}");
    let elsewhere = "/other/lib/-/commit/fa3335f3";
    let html = linking(&[
        &short,
        &full,
        elsewhere,
        &full,
        "/taskboard/taskboard/-/commit/fa3335f4",
    ]);

    let commits = links(&html, &[]).commits;

    let references: Vec<(&str, &str)> = commits
        .iter()
        .map(|commit| (commit.reference.as_str(), commit.page.as_str()))
        .collect();
    let expected = [
        ("fa3335f3", at(&short)),
        ("other/lib@fa3335f3", at(elsewhere)),
        ("fa3335f4", at("/taskboard/taskboard/-/commit/fa3335f4")),
    ];
    let expected: Vec<(&str, &str)> = expected
        .iter()
        .map(|(reference, page)| (*reference, page.as_str()))
        .collect();
    assert_eq!(references, expected);
    let full_first = links(&linking(&[&full, &short]), &[]).commits;
    assert_eq!(full_first.len(), 1);
    assert_eq!(full_first[0].page, at(&full));
}

#[test]
fn a_work_item_goes_to_epics_only_when_gitlab_types_it_epic() {
    let html = linking(&[
        "/taskboard/taskboard/-/work_items/13",
        "/groups/taskboard/-/work_items/4",
        "/groups/taskboard/-/work_items/5",
        "/groups/taskboard/-/work_items/6",
        "/taskboard/taskboard/-/work_items/14",
        "/taskboard/taskboard/-/issues/15",
    ]);
    let project_items = vec![
        work_item(13, "Task", "A task", "OPEN", &Value::Null),
        work_item(15, "Epic", "A project epic", "OPEN", &Value::Null),
    ];
    let group_items = vec![
        work_item(4, "Epic", "Old board", "CLOSED", &Value::Null),
        work_item(5, "Issue", "A group issue", "OPEN", &Value::Null),
    ];

    let links = links(&html, &[Some(project_items), Some(group_items)]);

    let expected = [
        "epic &4 Old board closed",
        "epic &6 -",
        "epic #15 A project epic",
        "issue #13 A task",
        "issue taskboard#5 A group issue",
        "issue #14 -",
    ];
    assert_eq!(lines(&links), expected);
}

#[test]
fn an_unseen_namespace_or_a_missing_iid_is_not_shown_without_error() {
    let html = linking(&[
        "/taskboard/taskboard/-/issues/12",
        "/taskboard/taskboard/-/issues/99",
        "/secret/vault/-/issues/9",
        "/groups/secret/-/epics/1",
    ]);
    let mut asked = Vec::new();

    let read = read_with(
        &project(),
        &html,
        &[Some(vec![issue(12, "Seen")]), None, None],
        &mut asked,
    )
    .unwrap();

    let shown: Vec<bool> = read
        .links
        .issues
        .iter()
        .map(|issue| issue.shown.is_some())
        .collect();
    assert_eq!(shown, [true, false, false]);
    assert_eq!(read.links.epics.len(), 1);
    assert_eq!(read.links.epics[0].shown, None);
    assert_eq!(asked.len(), 1);
    let failing = |_: &[Part]| Err("glab: a deadline line".to_owned());
    let failed = links_of(&project(), MergeRequestIid(62), &html, &mut { failing });
    assert_eq!(failed.err().as_deref(), Some("glab: a deadline line"));
}

#[test]
fn a_parent_on_another_host_gets_no_button() {
    let html = linking(&[
        "/taskboard/taskboard/-/issues/1",
        "/taskboard/taskboard/-/issues/2",
        "/taskboard/taskboard/-/issues/3",
        "/taskboard/taskboard/-/issues/4",
        "/taskboard/taskboard/-/issues/5",
    ]);
    let with_parent = |iid, url: &str| {
        let parent = parent("Epic", "Board redesign", url);
        work_item(iid, "Issue", "Child", "OPEN", &parent)
    };
    let nodes = vec![
        with_parent(1, "https://evil.example/groups/x/-/work_items/1"),
        with_parent(2, "http://gitlab.example/groups/taskboard/-/work_items/3"),
        with_parent(
            3,
            "https://gitlab.example/taskboard/taskboard/-/merge_requests/3",
        ),
        with_parent(4, "not an address"),
        with_parent(5, "https://gitlab.example/groups/taskboard/-/work_items/3"),
    ];

    let links = links(&html, &[Some(nodes)]);

    let parents: Vec<Option<&LinkedParent>> = links
        .issues
        .iter()
        .map(|issue| issue.shown.as_ref().and_then(|shown| shown.parent.as_ref()))
        .collect();
    let board = LinkedParent {
        reference: "&3".to_owned(),
        title: "Board redesign".to_owned(),
        page: at("/groups/taskboard/-/work_items/3"),
    };
    assert_eq!(parents, [None, None, None, None, Some(&board)]);
}

#[test]
fn an_epics_own_parent_is_dropped() {
    let html = linking(&["/groups/taskboard/-/epics/3"]);
    let grand = parent(
        "Epic",
        "Grand plan",
        "https://gitlab.example/groups/taskboard/-/work_items/1",
    );
    let epic = work_item(3, "Epic", "Board redesign", "OPEN", &grand);

    let links = links(&html, &[Some(vec![epic])]);

    let expected = LinkedEpic {
        reference: "&3".to_owned(),
        page: at("/groups/taskboard/-/epics/3"),
        shown: Some(ShownEpic {
            title: "Board redesign".to_owned(),
            closed: false,
        }),
    };
    assert_eq!(links.epics, [expected]);
    assert_eq!(pages_of(&links), [at("/groups/taskboard/-/epics/3")]);
}

#[test]
fn a_long_list_is_cut_into_calls_under_the_budget() {
    let mut parts = vec![Part {
        namespace: Namespace::Project(PROJECT.to_owned()),
        iids: (1..=300).collect(),
    }];
    for n in 0..7 {
        parts.push(Part {
            namespace: Namespace::Group(format!("group{n}")),
            iids: vec![n, n + 100],
        });
    }
    let asked: Vec<(Namespace, u64)> = parts
        .iter()
        .flat_map(|part| part.iids.iter().map(|&iid| (part.namespace.clone(), iid)))
        .collect();

    let calls = calls(parts);

    for call in &calls {
        let iids: usize = call.iter().map(|part| part.iids.len()).sum();
        let estimate =
            PART_SCORE * u32::try_from(call.len()).unwrap() + u32::try_from(iids).unwrap();
        assert!(estimate <= LOOKUP_BUDGET, "{estimate}");
        assert!(call.iter().all(|part| part.iids.len() <= MAX_IIDS_PER_PART));
    }
    let sent: Vec<(Namespace, u64)> = calls
        .iter()
        .flatten()
        .flat_map(|part| part.iids.iter().map(|&iid| (part.namespace.clone(), iid)))
        .collect();
    assert_eq!(sent, asked);
    let sizes: Vec<Vec<usize>> = calls
        .iter()
        .map(|call| call.iter().map(|part| part.iids.len()).collect())
        .collect();
    assert_eq!(
        sizes,
        [vec![100], vec![100], vec![100, 2, 2], vec![2, 2, 2, 2, 2]]
    );
}

#[test]
fn the_lookup_names_no_premium_only_field() {
    let call = [
        Part {
            namespace: Namespace::Project(PROJECT.to_owned()),
            iids: vec![12, 13],
        },
        Part {
            namespace: Namespace::Group("taskboard".to_owned()),
            iids: vec![3],
        },
    ];

    let args = links_args(&call);

    assert_eq!(args, LOOKUP_ARGS);
    for premium in PREMIUM_ONLY {
        assert!(!args[3].contains(premium), "{premium}");
    }
    assert!(args[3].contains("widgets { ... on WorkItemWidgetHierarchy"));
}

#[test]
fn every_line_and_parent_page_is_in_pages_once() {
    let html = linking(&[
        "/groups/taskboard/-/epics/3",
        "/taskboard/taskboard/-/work_items/12",
        "/taskboard/taskboard/-/work_items/13",
        &format!("/{PROJECT}/-/commit/{FULL_SHA}"),
    ]);
    let epic_parent = parent(
        "Epic",
        "Board redesign",
        "https://gitlab.example/groups/taskboard/-/work_items/3",
    );
    let issue_parent = parent(
        "Issue",
        "Snooze",
        "https://gitlab.example/taskboard/taskboard/-/work_items/12",
    );
    let nodes = vec![
        work_item(12, "Issue", "Snooze", "OPEN", &epic_parent),
        work_item(13, "Task", "Test", "OPEN", &issue_parent),
    ];
    let epics = vec![work_item(3, "Epic", "Board redesign", "OPEN", &Value::Null)];

    let links = links(&html, &[Some(epics), Some(nodes)]);

    let expected = [
        at("/groups/taskboard/-/epics/3"),
        at("/taskboard/taskboard/-/work_items/12"),
        at("/groups/taskboard/-/work_items/3"),
        at("/taskboard/taskboard/-/work_items/13"),
        at(&format!("/{PROJECT}/-/commit/{FULL_SHA}")),
    ];
    assert_eq!(pages_of(&links), expected);
}

#[test]
fn no_https_origin_lists_nothing_and_asks_nothing() {
    let off_https = Project {
        web_path: String::new(),
        web_origin: None,
        ..project()
    };
    let html = linking(&[
        "https://gitlab.example/taskboard/taskboard/-/issues/12",
        "/taskboard/taskboard/-/issues/13",
    ]);
    let mut asked = Vec::new();

    let read = read_with(&off_https, &html, &[], &mut asked).unwrap();

    assert_eq!(read.links, DescriptionLinks::default());
    assert_eq!((read.calls, read.score), (0, None));
    assert_eq!(asked, Vec::<Vec<Part>>::new());
    let commits_alone = linking(&[&format!("/{PROJECT}/-/commit/{FULL_SHA}")]);
    let read = read_with(&project(), &commits_alone, &[], &mut asked).unwrap();
    assert_eq!(read.links.commits.len(), 1);
    assert_eq!(asked, Vec::<Vec<Part>>::new());
}

#[test]
fn each_call_is_counted_the_highest_score_kept_and_a_failure_ends_the_lookup() {
    let part = |iid| Part {
        namespace: Namespace::Project(PROJECT.to_owned()),
        iids: vec![iid],
    };
    let calls = [vec![part(1)], vec![part(2)], vec![part(3)]];
    let mut scores = [30, 70, 40].into_iter();
    let mut answered = |_: &[Part]| {
        let mut answer: Value = serde_json::from_slice(&answer(&[None])).unwrap();
        answer["data"]["queryComplexity"]["score"] = json!(scores.next());
        Ok(answer.to_string().into_bytes())
    };

    let looked = looked_up(&calls, &server(), PROJECT, &mut answered).unwrap();

    assert_eq!((looked.calls, looked.score), (3, Some(70)));
    let mut asked = 0;
    let mut failing = |_: &[Part]| {
        asked += 1;
        Err("glab: a deadline line".to_owned())
    };
    let failed = looked_up(&calls, &server(), PROJECT, &mut failing);
    assert_eq!(failed.err().as_deref(), Some("glab: a deadline line"));
    assert_eq!(asked, 1);
}

#[test]
fn the_log_counts_each_group_and_what_gitlab_did_not_show() {
    let items = linking(&[
        "/groups/taskboard/-/epics/3",
        "/groups/taskboard/-/epics/4",
        "/taskboard/taskboard/-/issues/12",
        "/taskboard/taskboard/-/issues/13",
        "/taskboard/taskboard/-/issues/14",
    ]);
    let commits = format!(
        "<p><a href=\"/{PROJECT}/-/commit/{FULL_SHA}\" data-reference-type=\"commit\" title=\"Backfill\">c</a>\
         <a href=\"/{PROJECT}/-/commit/0badc0de\">unseen</a></p>"
    );
    let epics = vec![work_item(3, "Epic", "Board", "OPEN", &Value::Null)];
    let answered = [Some(epics), Some(vec![issue(12, "Seen")])];
    let links = links(&format!("{items}{commits}"), &answered);

    let read = LinksReply::Read { links };

    assert_eq!(counts(&read), [2, 3, 2, 4]);
    assert_eq!(counts(&LinksReply::GlabMissing), [0; 4]);
}

#[test]
fn the_log_names_each_replys_kind_as_the_window_does() {
    let replies = [
        LinksReply::Read {
            links: DescriptionLinks::default(),
        },
        LinksReply::GlabMissing,
        LinksReply::NotLoggedIn {
            detail: "gitlab.com".to_owned(),
        },
        LinksReply::Failed {
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
