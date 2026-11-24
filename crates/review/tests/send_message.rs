#![cfg(test)]
#![cfg(unix)]

mod support;

use std::sync::mpsc;

use serde_json::Value;
use yamt_gitio::Glab;
use yamt_review::{
    Error, MessageId, NotLinedUp, Posting, SendProgress, SendReply, ThreadList, send_message,
};

use support::{
    ADDED_TEXT, Fake, REFUSAL, REMOVED_TEXT, RENAMED_TEXT, Review, SHORT_TIMEOUT, merge_request_12,
    note_of, pending, postings, progress, queued,
};

impl Review {
    /// `send_message` of `message` alone.
    fn send_only(&self, glab: Option<&Glab>, message: MessageId) -> (SendReply, Vec<SendProgress>) {
        let (sender, receiver) = mpsc::channel();
        let report = |step: SendProgress| sender.send(step).unwrap();
        let reply = send_message(&self.range, glab, &self.threads, message, &report).unwrap();
        (reply, receiver.try_iter().collect())
    }
}

fn sent(reply: SendReply) -> (ThreadList, u32, u32) {
    let SendReply::Sent {
        list,
        sent,
        refused,
    } = reply
    else {
        panic!("not sent: {reply:?}");
    };
    (list, sent, refused)
}

#[test]
fn send_message_posts_only_the_named_message_and_the_others_stay_queued() {
    let review = Review::new();
    let fake = Fake::new("lined-up");

    let (reply, steps) = review.send_only(Some(&fake.glab), review.first_message(1));

    let expected = vec![
        queued(ADDED_TEXT),
        pending(RENAMED_TEXT, 101),
        queued(REMOVED_TEXT),
    ];
    let (list, sent, refused) = sent(reply);
    assert_eq!((sent, refused), (1, 0));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1], 1));
    let notes: Vec<String> = fake
        .bodies()
        .iter()
        .map(|body| note_of(body).to_owned())
        .collect();
    assert_eq!(notes, [RENAMED_TEXT]);
}

#[test]
fn send_message_keeps_a_refused_message_queued_with_its_reason() {
    let review = Review::new();
    let fake = Fake::new("refusal");
    review.send_only(Some(&fake.glab), review.first_message(0));

    let (reply, steps) = review.send_only(Some(&fake.glab), review.first_message(1));

    let refused = Posting::Refused {
        text: RENAMED_TEXT.to_owned(),
        reason: REFUSAL.to_owned(),
    };
    let expected = vec![pending(ADDED_TEXT, 101), refused, queued(REMOVED_TEXT)];
    let (list, sent, refused) = sent(reply);
    assert_eq!((sent, refused), (0, 1));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1], 1));
}

#[test]
fn send_message_stopped_by_a_timeout_leaves_the_message_queued() {
    let review = Review::new();
    let fake = Fake::new("timeout");
    let glab = Glab::at(fake.dir.path().join("glab")).with_timeout(SHORT_TIMEOUT);
    review.send_only(Some(&glab), review.first_message(0));

    let (reply, steps) = review.send_only(Some(&glab), review.first_message(1));

    let expected = vec![
        pending(ADDED_TEXT, 101),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    let SendReply::Stopped {
        list,
        sent,
        refused,
        reason,
    } = reply
    else {
        panic!("not stopped: {reply:?}");
    };
    assert_eq!((sent, refused, reason.as_str()), (0, 0, "glab timed out"));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, []);
}

#[test]
fn send_message_takes_the_unowned_draft_with_its_text_instead_of_posting_again() {
    let review = Review::new();
    let fake = Fake::new("drafted");

    let (reply, steps) = review.send_only(Some(&fake.glab), review.first_message(0));

    let expected = vec![
        pending(ADDED_TEXT, 301),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    let (list, sent, refused) = sent(reply);
    assert_eq!((sent, refused), (1, 0));
    assert_eq!(postings(&list), expected);
    assert_eq!(review.postings_on_disk(), expected);
    assert_eq!(steps, progress(&[1], 1));
    assert_eq!(fake.bodies(), Vec::<Value>::new());
}

#[test]
fn send_message_without_glab_or_lined_up_merge_request_is_not_lined_up() {
    let review = Review::new();
    let fake = Fake::new("moved");
    let message = review.first_message(0);

    let (without, _) = review.send_only(None, message);
    let (moved, steps) = review.send_only(Some(&fake.glab), message);

    let why = NotLinedUp::GlabMissing;
    assert_eq!(without, SendReply::NotLinedUp { why });
    let why = NotLinedUp::Moved {
        merge_request: merge_request_12(),
        gitlab_head: "d1e2f3a".to_owned(),
        shown_head: "9c1ba3f".to_owned(),
    };
    assert_eq!(moved, SendReply::NotLinedUp { why });
    assert_eq!(steps, []);
    assert!(!fake.log().contains("draft_notes"), "{}", fake.log());
    let unchanged = vec![
        queued(ADDED_TEXT),
        queued(RENAMED_TEXT),
        queued(REMOVED_TEXT),
    ];
    assert_eq!(review.postings_on_disk(), unchanged);
}

#[test]
fn send_message_on_an_unknown_id_is_the_store_s_error_before_any_glab_call() {
    let review = Review::new();
    let fake = Fake::new("lined-up");
    let unknown = MessageId(99);
    let no_progress = |_: SendProgress| panic!("progress for an unknown message");

    let sent = send_message(
        &review.range,
        Some(&fake.glab),
        &review.threads,
        unknown,
        &no_progress,
    );

    let Err(Error::UnknownMessage { message }) = sent else {
        panic!("not unknown: {sent:?}");
    };
    assert_eq!(message, unknown);
    assert_eq!(fake.log(), "");
}

#[test]
fn send_message_on_a_message_that_does_not_wait_sends_nothing() {
    let review = Review::new();
    let fake = Fake::new("lined-up");
    let first = review.first_message(0);
    review.send_only(Some(&fake.glab), first);
    let thread = review.threads.lock().unwrap().list(&review.range).threads[1].id;
    let list = {
        let mut store = review.threads.lock().unwrap();
        store
            .add_note(&review.range, thread, "Only for me")
            .unwrap()
    };
    let note = list.threads[1].messages[1].id;
    let calls_before = fake.argv().len();

    let (not_queued, steps) = review.send_only(Some(&fake.glab), note);
    let (pending_again, _) = review.send_only(Some(&fake.glab), first);

    assert_eq!(
        not_queued,
        SendReply::Sent {
            list: list.clone(),
            sent: 0,
            refused: 0
        }
    );
    assert_eq!(
        pending_again,
        SendReply::Sent {
            list,
            sent: 0,
            refused: 0
        }
    );
    assert_eq!(steps, []);
    let after_the_check = fake.argv().split_off(calls_before);
    let drafts = after_the_check
        .iter()
        .filter(|argv| argv.contains("draft_notes"));
    assert_eq!(drafts.count(), 0, "{}", fake.log());
    assert_eq!(fake.bodies().len(), 1);
}
