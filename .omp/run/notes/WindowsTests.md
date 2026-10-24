# WindowsTests (board "Windows CI" row 1) - round 1

- Patch committed as the commit after 35cae89 (four test files, no src).
- opening.rs files_in: the lock file by name, its listed length asserted 0, empty bytes; every other file byte for byte.
- commands.rs OsStr, run.rs OUTPUT_DRAIN/DRAIN_SLACK, operations.rs conflict_repo/Error moved into their only cfg(unix) tests.
- Evidence: Windows-target clippy -D warnings exit 0; Linux clippy, fmt; nextest 228 passed; two throwaway edits (orphan removed, lock written) fail the locked test, reverted.
- Deviation: the ownership hook refused a throwaway edit in store.rs; the throwaway edits were in the test instead.
- Open: no Windows run here; CI windows-2025 is the proof.
