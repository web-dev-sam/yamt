#!/usr/bin/env bash
# Turns a failed step's log into error annotations: they are public through the checks API, job logs need a token.
# GitHub keeps at most 10 error annotations per step, so the lines go into two multi-line ones; a message escapes
# % CR LF as %25 %0D %0A (docs.github.com, "Workflow commands for GitHub Actions").
# $1: the log file, $2: the annotations' title (no ':' or ',', they would need escaping too).
set -euo pipefail

log=$1
title=$2
readonly MAX_FAILING_LINES=40
readonly TAIL_LINES=80
readonly FAILING='^[[:space:]]*(FAIL|SIGSEGV|SIGABRT|TIMEOUT) \[|error(\[E[0-9]+\])?:|Caused by|exit code|exited with code'

# $1: the title, $2: the message lines.
annotate() {
  local message=$2
  message=${message//'%'/%25}
  message=${message//$'\r'/%0D}
  message=${message//$'\n'/%0A}
  echo "::error title=$1::$message"
}

if [[ ! -f $log ]]; then
  annotate "$title" "no log at $log"
  exit 0
fi

escape=$'\e'
plain=$(sed "s/${escape}\[[0-9;]*m//g" "$log")
failing=$(grep -E "$FAILING" <<<"$plain" | awk '!seen[$0]++' | head -n "$MAX_FAILING_LINES" || true)
if [[ -n $failing ]]; then
  annotate "$title (failing lines)" "$failing"
fi
annotate "$title (last $TAIL_LINES lines)" "$(tail -n "$TAIL_LINES" <<<"$plain")"
