//! The list the window asks for, for tests at a stop git has not left.

use yamt_session::{MergeSession, Refreshed, StopList};

pub fn listed(session: &mut MergeSession) -> StopList {
    match session.refresh_stop().unwrap() {
        Refreshed::Files(list) => list,
        Refreshed::MovedOn => panic!("moved on"),
    }
}
