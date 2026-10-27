//! Starts a program and pipes its framed messages both ways, one framing per run; never reads a message.
#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod frame;
mod program;
mod run;

pub use crate::frame::{Framing, MAX_MESSAGE_BYTES};
pub use crate::program::{Found, ProgramFolders, ProgramFound, ProgramPlace, find, plain_name};
pub use crate::run::{HostEvent, Running};
