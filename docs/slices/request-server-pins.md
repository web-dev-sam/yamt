# Request — found language servers can be switched off; the header groups them, pins show chosen ones (GitHub issue 3)

Settled (orchestrator as owner, OR13 and #876: "orient yourself on the vision of a clean user experience"); a design
may refine a detail it names, never reopen a rule.

## Owner's words

- GitHub issue 3 (2026-10-19), "Ability to remove found language servers from the list": "Not a bug, but in
  monorepos, language server instances are a lot, so there needs to be a way to group them visually".
- Chat (2026-10-19): "Ability to deactivate found language servers from the setting so they dont show in the editor.
  Also grouping of language servers and pinning so that a long list (example in monorepos) doesnt clutter everything.
  By default no language server is pinned and everything is hidden in that group (dropdown and there I can pin with an
  icon only button)".

## Rules

1. **Off switch.** Settings → Language servers → "Found in this repository": every found server's row gets a switch,
   on at first. Off: the server stops at once if it runs (as Stop does today: its problems leave the Result), is never
   started while off (not by the start question's "Start", not on window focus, not at the next start of yamt), and
   shows nowhere outside Settings (no header button, not in the group). On again: it starts when this repository's
   answer is Start, as a found server does today. The switches show and change also while the answer is "Don't start"
   or not given (they decide what starts once it is Start).
2. **Off is remembered** per repository across restarts, in the settings file next to this repository's answer
   (plan §2 #67: what runs in a repository is decided there). A server keeps its switch when its shown name gains or
   loses a project suffix ("oxlint" ↔ "oxlint (frontend)", #71) because a second project appears or goes. A server
   not found any more keeps its entry (as answers of repositories not opened again stay).
3. **Servers added by hand** are unchanged (Remove is their off); they are shown and pinned like found ones.
4. **Header.** Where the status area shows one button per server today (left of the gear in all three header rows,
   #71), it shows: the problem counts and the format note as today, then the pinned servers' buttons (today's look and
   menu, in the group's order), then **one group button** for every shown server, pinned ones included: a state dot,
   the word "Servers", a chevron-down; title and accessible name "Language servers". Its dot is the most urgent of its
   servers' dots: problem, then warning, then busy, then running (any server running), else stopped. No server shown
   (none found or added, or every found one off and none added) → no status area, as today with no servers.
5. **Drop-down.** The group button opens a drop-down under it: one row per shown server (today's order: found, then
   added), each with its state dot, its name (hover: today's state line) and, at the row's right end, an icon-only pin
   button (lucide `pin`; pressed state while pinned, `aria-pressed`; titles "Pin to the header" / "Unpin from the
   header"). The pin toggles at once: the header gains or loses that button while the drop-down stays open. Choosing
   the row itself opens that server's menu (today's `ServerMenu`, contents unchanged) in place of the drop-down.
   Opening, closing and keyboard as yamt's other drop-downs (`useDropdownMenu.ts`, `menuKeys.ts`): Escape, a press
   outside, window blur close it and the keyboard returns to the opener; the keyboard reaches every row and every pin.
6. **Pins**: none at first; remembered per repository across restarts in the window's own storage (plan §2 #58: what
   the header shows is a window choice, `storedValue`), keyed like rule 2. A pinned server switched off leaves the
   header; switched on again it is pinned again.
7. **Unchanged**: detection, the once-per-repository question, Start/Stop/Restart/Show log, the log view, formatting
   on Save, the counts and the format note, Settings' other parts.

## Acceptance

In WebKit (fixture page) and in the real app on `scripts/lsp-repo.sh --servers` (a project per ecosystem: many found
servers): at first the header shows only the group button (no server pinned); its drop-down lists every server with
its state; pinning two shows exactly those two buttons left of the group in every header row (toolbar, read-only file,
choice file), their menus work; unpinning removes one; pins survive a restart; the keyboard opens the
drop-down, moves through rows and pins, pins one, opens a server's menu, and Escape returns it to the opener. Settings:
switching a found server off stops it (its log says so, the Result loses its problems), removes it from the header and
the drop-down; it is still off after a restart and never started then; on again starts it and its pin is back. A
found server whose name gains a project suffix keeps its switch and pin. `just check` passes; dark and light.

## Non-goals

Switching off servers added by hand; grouping by project inside the drop-down; reordering; pins shared across
repositories; a key for the drop-down; renaming servers; any change to what a server does while it runs.
