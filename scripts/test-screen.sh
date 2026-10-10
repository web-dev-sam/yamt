#!/usr/bin/env bash
# Test windows (the WebKit test browser; the app's test build, whose window class or title contains
# `yamt-test`) open on the owner's Samsung screen and never on the ASUS one (owner, 2026-10-10).
# KDE Plasma on Wayland places them through KWin window rules. KWin 6.7 places a new Wayland window
# on the active screen and ignores a forced screen there (xdgshellwindow.cpp initialize() reads only
# the position rule), so the rules force a position inside the Samsung screen: one rule matches the
# window class, one the title (probed: a title rule places the window at creation). Screen layout and
# order change when screens are added or removed, so `place` re-points the rules before every run.
#   scripts/test-screen.sh place   # 0: rules ready; 3: no Samsung screen (use the private display)
#   scripts/test-screen.sh check   # 0: every open test window is on the Samsung screen
set -euo pipefail

readonly CLASS_RULE=yamt-test-windows
readonly TITLE_RULE=yamt-test-titles
readonly CLASSES='(?i)minibrowser|yamt-test'
readonly TITLES='(?i)yamt-test'
readonly JS_TEST_WINDOW='(w) => /minibrowser|yamt-test/i.test(w.resourceClass) || /yamt-test/i.test(w.caption)'
readonly MAKER=Samsung
readonly MARGIN_PX=40

# Runs one JavaScript expression inside KWin and prints its value. KWin scripts can only print to
# KWin's log, so the value is read back from the journal by a one-off token.
kwin_eval() {
    local token file id value=""
    token="yamt-probe-$(date +%s%N)"
    file=$(mktemp --suffix=.js)
    printf 'print("%s=" + (%s));\n' "$token" "$1" >"$file"
    id=$(qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$file" "$token")
    qdbus org.kde.KWin "/Scripting/Script$id" org.kde.kwin.Script.run >/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        value=$(journalctl --user -b --since=-1min -o cat | grep -F "$token=" | tail -n 1 || true)
        [ -n "$value" ] && break
        sleep 0.2
    done
    qdbus org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "$token" >/dev/null
    rm -f "$file"
    [ -n "$value" ] || { echo "test-screen: no answer from KWin" >&2; return 1; }
    printf '%s\n' "${value#*"$token="}"
}

# Prints "<KWin screen index> <output name> <x> <y>" of the Samsung screen, or nothing.
samsung_screen() {
    kwin_eval "(function () { const i = workspace.screens.findIndex((s) => s.manufacturer.indexOf('$MAKER') !== -1); if (i < 0) return ''; const s = workspace.screens[i]; return [i, s.name, s.geometry.x, s.geometry.y].join(' '); })()"
}

# Writes one rule group that forces test windows to a position, and lists it in [General].
# $1 group, $2 match key (wmclass | title), $3 regex, $4 KWin screen index, $5 "x,y".
write_rule() {
    local group=$1 key=$2 regex=$3 index=$4 position=$5 rules
    kwriteconfig6 --file kwinrulesrc --group "$group" --key Description "yamt test windows on the $MAKER screen ($key)"
    kwriteconfig6 --file kwinrulesrc --group "$group" --key "$key" "$regex"
    kwriteconfig6 --file kwinrulesrc --group "$group" --key "${key}match" 3
    if [ "$key" = wmclass ]; then
        kwriteconfig6 --file kwinrulesrc --group "$group" --key wmclasscomplete false
    fi
    kwriteconfig6 --file kwinrulesrc --group "$group" --key position "$position"
    kwriteconfig6 --file kwinrulesrc --group "$group" --key positionrule 2
    kwriteconfig6 --file kwinrulesrc --group "$group" --key screen "$index"
    kwriteconfig6 --file kwinrulesrc --group "$group" --key screenrule 2
    rules=$(kreadconfig6 --file kwinrulesrc --group General --key rules)
    case ",$rules," in
    *",$group,"*) ;;
    *)
        rules=${rules:+$rules,}$group
        kwriteconfig6 --file kwinrulesrc --group General --key rules "$rules"
        kwriteconfig6 --file kwinrulesrc --group General --key count "$(tr ',' '\n' <<<"$rules" | grep -c .)"
        ;;
    esac
}

place() {
    local found index name x y position
    found=$(samsung_screen)
    if [ -z "$found" ]; then
        echo "test-screen: no $MAKER screen connected" >&2
        exit 3
    fi
    read -r index name x y <<<"$found"
    position="$((x + MARGIN_PX)),$((y + MARGIN_PX))"
    write_rule "$CLASS_RULE" wmclass "$CLASSES" "$index" "$position"
    write_rule "$TITLE_RULE" title "$TITLES" "$index" "$position"
    qdbus org.kde.KWin /KWin reconfigure >/dev/null
    echo "test-screen: test windows go to $MAKER ($name, KWin screen $index, at $position)"
}

check() {
    local found name windows misplaced
    found=$(samsung_screen)
    read -r _ name _ <<<"$found"
    windows=$(kwin_eval "workspace.windowList().filter($JS_TEST_WINDOW).map((w) => w.resourceClass + '@' + w.output.name).join(' ')")
    if [ -z "$windows" ]; then
        echo "test-screen: no test window open"
        return 0
    fi
    echo "test-screen: $windows"
    misplaced=$(tr ' ' '\n' <<<"$windows" | grep -v "@$name\$" || true)
    if [ -z "$found" ] || [ -n "$misplaced" ]; then
        echo "test-screen: test window not on the $MAKER screen: ${misplaced:-$windows}" >&2
        return 1
    fi
}

case "${1:-}" in
place) place ;;
check) check ;;
*)
    echo "usage: $0 place|check" >&2
    exit 2
    ;;
esac
