#![cfg(test)]

mod stored_threads;

use yamt_conflict_repo::TempDir;
use yamt_range::{Range, RangeFileId};
use yamt_review::{Error, MessageId, Posting, ThreadId, ThreadList, ThreadStore};

use stored_threads::{
    EVERY_KIND, added_line, ai_answer, bodies, json_on_disk, local_range, note, on_disk,
    only_thread, range, refused, repo, store_with_one_thread, stored,
};

fn queued(text: &str) -> Posting {
    Posting::Queued {
        text: text.to_owned(),
    }
}

fn reopened_list(folder: &TempDir, range: &Range) -> ThreadList {
    ThreadStore::open(folder.path()).unwrap().list(range)
}

#[test]
fn editing_a_note_replaces_its_text_and_a_waiting_note_waits_with_the_new_text() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    store.queue(&range, MessageId(6), "u for GitLab").unwrap();
    let before = store.list(&range);

    let not_queued = store
        .edit_note(&range, MessageId(1), "Why 300 ms?")
        .unwrap();
    let edited = &not_queued.threads[0].messages[0];
    assert_eq!(edited.body, note("Why 300 ms?"));
    assert_eq!(edited.posting, Posting::NotQueued);
    assert_eq!(
        (edited.id, edited.written),
        (MessageId(1), before.threads[0].messages[0].written)
    );
    assert_eq!(reopened_list(&folder, &range), not_queued);

    let refused = store.edit_note(&range, MessageId(3), "t, fixed").unwrap();
    let edited = &refused.threads[1].messages[0];
    assert_eq!(edited.body, note("t, fixed"));
    assert_eq!(edited.posting, queued("t, fixed"));
    assert_eq!(reopened_list(&folder, &range), refused);

    let queued_note = store.edit_note(&range, MessageId(6), "u, again").unwrap();
    let edited = &queued_note.threads[3].messages[0];
    assert_eq!(edited.body, note("u, again"));
    assert_eq!(edited.posting, queued("u, again"));
    assert_eq!(reopened_list(&folder, &range), queued_note);
    assert_eq!(
        queued_note.threads[0].messages[1],
        before.threads[0].messages[1]
    );
    assert_eq!(queued_note.threads[2], before.threads[2]);
}

#[test]
fn deleting_a_note_takes_it_out_of_its_thread_and_the_thread_keeps_its_session() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let before = store.list(&range);

    let list = store.delete_message(&range, MessageId(1)).unwrap();

    let thread = &list.threads[0];
    assert_eq!(thread.id, ThreadId(1));
    assert_eq!(thread.messages, before.threads[0].messages[1..]);
    assert_eq!(thread.session.as_deref(), Some("omp-session-1"));
    assert_eq!(list.threads[1..], before.threads[1..]);
    assert_eq!(reopened_list(&folder, &range), list);
}

#[test]
fn deleting_a_queued_or_refused_note_takes_it_out_of_the_queue() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    store.queue(&range, MessageId(6), "u for GitLab").unwrap();

    store.delete_message(&range, MessageId(6)).unwrap();
    let list = store.delete_message(&range, MessageId(3)).unwrap();

    let mut waiting = Vec::new();
    for thread in &list.threads {
        for message in &thread.messages {
            if matches!(
                message.posting,
                Posting::Queued { .. } | Posting::Refused { .. }
            ) {
                waiting.push(message.id);
            }
        }
    }
    assert_eq!(waiting, [MessageId(2)]);
    assert_eq!(reopened_list(&folder, &range), list);
}

#[test]
fn a_thread_loses_its_last_message_and_goes_while_its_neighbours_keep_order_and_ids() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let before = store.list(&range);

    let list = store.delete_message(&range, MessageId(3)).unwrap();

    let ids: Vec<(u32, u32)> = list.threads.iter().map(|t| (t.id.0, t.file.0)).collect();
    assert_eq!(ids, [(1, 0), (3, 2), (4, 2)]);
    assert_eq!(list.threads[0], before.threads[0]);
    assert_eq!(list.threads[1..], before.threads[2..]);
    let written = json_on_disk(&folder);
    assert_eq!(written["threads"].as_array().unwrap().len(), 3);
    assert_eq!(written["nextThread"], 5);
    assert_eq!(written["nextMessage"], 7);
    assert_eq!(reopened_list(&folder, &range), list);
}

#[test]
fn ids_stay_fresh_after_a_delete() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);
    store.add_note(&range, ThreadId(1), "And 400?").unwrap();

    store.delete_message(&range, MessageId(2)).unwrap();
    let noted = store.add_note(&range, ThreadId(1), "And 500?").unwrap();
    let ids: Vec<u32> = only_thread(&noted)
        .messages
        .iter()
        .map(|m| m.id.0)
        .collect();
    assert_eq!(ids, [1, 3]);

    store.delete_message(&range, MessageId(1)).unwrap();
    let emptied = store.delete_message(&range, MessageId(3)).unwrap();
    assert_eq!(emptied.threads, []);
    let mut reopened = ThreadStore::open(folder.path()).unwrap();
    let added = reopened
        .add_thread(&range, RangeFileId(0), added_line(), "Again")
        .unwrap();
    assert_eq!(added.thread, ThreadId(2));
    assert_eq!(only_thread(&added.list).messages[0].id, MessageId(4));
}

#[test]
fn deleting_a_note_before_an_answer_leaves_the_turn_numbering_as_it_was() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let mut store = store_with_one_thread(&folder, &range);
    store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();
    store.add_note(&range, ThreadId(1), "And 400?").unwrap();

    store.delete_message(&range, MessageId(1)).unwrap();
    let list = store.add_ai_answer(&range, ThreadId(1), "omp-1").unwrap();

    let expected = [
        ai_answer("omp-1", 0),
        note("And 400?"),
        ai_answer("omp-1", 1),
    ];
    assert_eq!(bodies(&list), expected);
    assert_eq!(reopened_list(&folder, &range), list);
}

#[test]
fn edit_and_delete_refuse_in_the_order_unknown_ai_answer_pending_blank_and_write_nothing() {
    let repo = repo();
    let local = local_range(&repo);
    let remote = range(repo.path(), "main..remote");
    let folder = tempfile::tempdir().unwrap();
    stored(&folder, EVERY_KIND);
    let mut store = ThreadStore::open(folder.path()).unwrap();
    let list = store.list(&local);

    let unknown = "no review message has the id 5";
    assert_eq!(refused(store.edit_note(&local, MessageId(5), " ")), unknown);
    assert_eq!(refused(store.delete_message(&local, MessageId(5))), unknown);
    let hidden = "no review message has the id 1";
    assert_eq!(refused(store.edit_note(&remote, MessageId(1), "a")), hidden);
    assert_eq!(refused(store.delete_message(&remote, MessageId(1))), hidden);
    let answer = "the message 2 is an AI answer, not a note";
    assert_eq!(refused(store.edit_note(&local, MessageId(2), " ")), answer);
    assert_eq!(refused(store.delete_message(&local, MessageId(2))), answer);
    let pending = "the message 4 is pending on GitLab";
    assert_eq!(refused(store.edit_note(&local, MessageId(4), " ")), pending);
    assert_eq!(refused(store.delete_message(&local, MessageId(4))), pending);
    let blank = store.edit_note(&local, MessageId(1), " \n");
    assert!(matches!(blank, Err(Error::EmptyMessage)), "{blank:?}");

    assert_eq!(on_disk(&folder), EVERY_KIND.as_bytes());
    assert_eq!(store.list(&local), list);
}

#[test]
fn an_ai_answer_is_not_a_note_even_when_pending() {
    let repo = repo();
    let range = local_range(&repo);
    let folder = tempfile::tempdir().unwrap();
    let json = r#"{"format":1,"nextThread":2,"nextMessage":2,"threads":[{"id":1,"path":"a.txt","line":{"kind":"added","right":0},"session":"omp-1","messages":[
        {"id":1,"body":{"kind":"aiAnswer","session":"omp-1","turn":0},"written":0,
         "posting":{"kind":"pending","text":"p","draft_note":1,"merge_request":"!12","link":"https://gitlab.example/g/p/-/merge_requests/12/diffs"}}]}]}"#;
    stored(&folder, json);
    let mut store = ThreadStore::open(folder.path()).unwrap();

    let edit = store.edit_note(&range, MessageId(1), "a");
    assert!(
        matches!(
            edit,
            Err(Error::NotANote {
                message: MessageId(1)
            })
        ),
        "{edit:?}"
    );
    let delete = store.delete_message(&range, MessageId(1));
    assert!(
        matches!(
            delete,
            Err(Error::NotANote {
                message: MessageId(1)
            })
        ),
        "{delete:?}"
    );
    assert_eq!(on_disk(&folder), json.as_bytes());
}
