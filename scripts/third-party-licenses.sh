#!/usr/bin/env bash
# Usage: scripts/third-party-licenses.sh
#        scripts/third-party-licenses.sh ubuntu-versions
# Without an argument: writes THIRD_PARTY_LICENSES.txt, the copyright lines and licence texts of every
# Rust crate the app builds on Linux, macOS and Windows (`cargo metadata`, no dev-dependencies), every production
# JS package (`pnpm licenses list --prod`) and the two icon sets, quoted from each package's licence files.
# A package without licence files gets the standard text of its declared licence with the holder from its
# metadata; when the script has no text for that licence it stops, naming the package.
# With `ubuntu-versions` (the Linux release job on Ubuntu 22.04, before bundling): appends the installed
# versions of the Ubuntu source packages listed for the AppImage, and the GNU GPL and LGPL texts from
# /usr/share/common-licenses (LGPLv3 §4(b) requires the GPL next to it).
# The release jobs run it on macOS too, whose bash is 3.2 and whose tools are BSD's, and on Windows under Git
# Bash, where a native jq.exe ends its lines with CRLF (jq manual, `--binary`) and paths use `\`.
set -euo pipefail
export LC_ALL=C

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/THIRD_PARTY_LICENSES.txt"
rust_targets=(x86_64-unknown-linux-gnu aarch64-apple-darwin x86_64-apple-darwin x86_64-pc-windows-msvc)
icon_sets=(lucide vscode-icons)
ubuntu_lgpl_sources=(
    webkit2gtk gtk+3.0 glib2.0 glib-networking libsoup3 pango1.0 gdk-pixbuf atk1.0 at-spi2-atk
    at-spi2-core cairo gstreamer1.0 gst-plugins-base1.0 libsecret enchant-2 libmanette json-glib libgudev
    libproxy libgcrypt20 gnutls28 nettle libtasn1-6 libidn2 libunistring avahi colord libthai libdatrie
    librsvg systemd util-linux libseccomp hyphen elfutils
)
gnu_licences=(GPL-3 LGPL-2 LGPL-2.1 LGPL-3)
field=$'\x1f'

# The crates reachable from the app over normal and build dependencies, outside the workspace.
# shellcheck disable=SC2016
rust_crates_jq='
def reachable($edges): . as $seen
  | ($seen + [$seen[] | $edges[.][]] | unique) as $next
  | if $next == $seen then $seen else $next | reachable($edges) end;
(.resolve.nodes
  | map({key: .id, value: [.deps[] | select(any(.dep_kinds[]; .kind != "dev")) | .pkg]})
  | from_entries) as $edges
| ([.resolve.root] | reachable($edges)) as $ids
| .packages[]
| select(.source != null and (.id as $id | $ids | index($id)))
| [.name, .version, (.license // ""), (.manifest_path | gsub("\\\\"; "/") | rtrimstr("/Cargo.toml")),
   (.authors | join(", ")),
   (.repository // "")]
| join("\u001f")'

# shellcheck disable=SC2016
js_packages_jq='
to_entries[] | .key as $licence | .value[] | . as $package | range(0; .paths | length)
| [$package.name, $package.versions[.], $licence, ($package.paths[.] | gsub("\\\\"; "/")), ($package.author // "")]
| join("\u001f")'

die() {
    echo "third-party-licenses: $*" >&2
    exit 1
}

# $@: jq's arguments after `-r`. Prints jq's raw output with LF line ends.
jq_lines() {
    jq -r "$@" | tr -d '\r'
}

# Prints one line per crate: name, version, licence, directory, authors, repository (separated by $field).
rust_crates() {
    local target
    for target in "${rust_targets[@]}"; do
        cargo metadata --format-version 1 --locked --manifest-path "$root/src-tauri/Cargo.toml" \
            --filter-platform "$target" | jq_lines "$rust_crates_jq"
    done | sort -u
}

# Prints one line per production JS package: name, version, licence, directory, author (separated by $field).
js_packages() {
    pnpm -C "$root/frontend" licenses list --prod --json | jq_lines "$js_packages_jq" | sort -u
}

# $1: licence expression. Prints its licence ids and operators separated by spaces, without parentheses; the
# old crates.io form `MIT/Apache-2.0` becomes `MIT OR Apache-2.0`.
licence_words() {
    local words=${1//[()]/}
    echo "${words//\// OR }"
}

# $1: package directory, $2: licence expression. Prints the licence files to quote, one per line. When MIT
# is one choice of an OR expression and the package has an MIT file, the other choices' files are left out.
licence_files() {
    local files expression
    expression=$(licence_words "$2")
    files=$(find "$1" -maxdepth 1 -type f \( -iname 'licen[cs]e*' -o -iname 'copying*' \
        -o -iname 'unlicense*' -o -iname 'notice*' -o -iname 'copyright*' \) ! -iname '*.spdx' | sort)
    if [[ " $expression " == *" MIT "* && $expression != *AND* && $expression != *WITH* ]] &&
        grep -qi 'mit[^/]*$' <<<"$files"; then
        grep -viE '(apache|zlib|unlicense)[^/]*$' <<<"$files" || true
    else
        echo "$files"
    fi
}

# Prints the MPL-2.0 text shipped by the first crate licensed under exactly MPL-2.0.
mpl_text() {
    local name version licence dir rest files file
    while IFS=$field read -r name version licence dir rest; do
        [ "$licence" = MPL-2.0 ] || continue
        files=$(licence_files "$dir" "$licence")
        if [ -n "$files" ]; then
            while read -r file; do cat "$file"; done <<<"$files"
            return
        fi
    done <<<"$rust_rows"
    return 1
}

# $1: licence expression, $2: holder. Prints the standard text of the first licence in the expression the
# script knows; fails for an unknown licence or an AND/WITH expression.
standard_text() {
    local id
    [[ $1 != *AND* && $1 != *WITH* ]] || return 1
    for id in $(licence_words "$1"); do
        case $id in
            MIT)
                cat <<EOF
Copyright (c) $2

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
                return
                ;;
            ISC)
                cat <<EOF
Copyright (c) $2

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
EOF
                return
                ;;
            BSD-2-Clause)
                cat <<EOF
Copyright (c) $2

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
EOF
                return
                ;;
            BSD-3-Clause)
                cat <<EOF
Copyright (c) $2

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
EOF
                return
                ;;
            MPL-2.0)
                mpl_text
                return
                ;;
        esac
    done
    return 1
}

# $1: name, $2: version, $3: licence expression, $4: package directory, $5: holder for the standard text.
entry() {
    local files file
    printf '\n---- %s %s (%s) ----\n' "$1" "$2" "${3:-no licence declared}"
    files=$(licence_files "$4" "$3")
    if [ -n "$files" ]; then
        while read -r file; do
            printf '\n[%s]\n' "${file##*/}"
            cat "$file"
            echo
        done <<<"$files"
    else
        printf '\nThe package ships no licence file; the standard text of its declared licence, holder from its metadata:\n\n'
        standard_text "$3" "$5" || die "no licence text for $1 $2 (${3:-no licence declared})"
    fi
}

# The icon sets are build-time packages: the build copies the SVGs the app uses into its code, so `--prod`
# leaves them out. Their holder and licence come from each package's info.json.
icon_entries() {
    local set dir
    for set in "${icon_sets[@]}"; do
        dir="$root/frontend/node_modules/@iconify-json/$set"
        [ -f "$dir/info.json" ] || die "missing $dir/info.json (run pnpm -C frontend install)"
        entry "$set icons" "$(jq_lines .version "$dir/package.json")" "$(jq_lines .license.spdx "$dir/info.json")" \
            "$dir" "$(jq_lines .author.name "$dir/info.json")"
    done
    printf '\nSome Lucide icons are derived from Feather (lucide LICENSE, hand-checked):\n\n'
    standard_text MIT "2013-present Cole Bemis"
}

ubuntu_section() {
    printf '\n==== System libraries in the Linux AppImage ====\n\n'
    printf 'The Linux AppImage carries GTK, WebKitGTK and the libraries they use, copied from the Ubuntu 22.04\n'
    printf 'build machine; the .deb and the macOS app use the system'"'"'s copies. Its LGPL libraries come from\n'
    printf 'these Ubuntu source packages (source code: https://launchpad.net/ubuntu/jammy/+source/<package>):\n\n'
    printf '%s\n' "${ubuntu_lgpl_sources[@]}"
}

generate() {
    local name version licence dir authors repository
    rust_rows=$(rust_crates)
    js_rows=$(js_packages)
    tmp=$(mktemp)
    trap 'rm -f "$tmp"' EXIT
    {
        printf 'Third-party licences of yamt\n\n'
        printf 'Written by scripts/third-party-licenses.sh; THIRD_PARTY_NOTICES.md is the short summary.\n'
        printf '\n==== Rust crates (%s) ====\n' "$(grep -c . <<<"$rust_rows")"
        while IFS=$field read -r name version licence dir authors repository; do
            entry "$name" "$version" "$licence" "$dir" "${authors:-the $name authors${repository:+ ($repository)}}"
        done <<<"$rust_rows"
        printf '\n==== JavaScript packages (%s) ====\n' "$(grep -c . <<<"$js_rows")"
        while IFS=$field read -r name version licence dir authors; do
            entry "$name" "$version" "$licence" "$dir" "${authors:-the $name authors}"
        done <<<"$js_rows"
        printf '\n==== Icons (%s sets) ====\n' "${#icon_sets[@]}"
        icon_entries
        ubuntu_section
    } >"$tmp"
    chmod 644 "$tmp"
    mv "$tmp" "$out"
    echo "third-party-licenses: $(grep -c . <<<"$rust_rows") Rust crates, $(grep -c . <<<"$js_rows") JS packages," \
        "${#icon_sets[@]} icon sets -> ${out#"$root"/} ($(wc -c <"$out") bytes)"
}

# Prints the GNU licence texts the AppImage's LGPL libraries need, from Ubuntu's common-licenses.
gnu_licence_texts() {
    local licence
    for licence in "${gnu_licences[@]}"; do
        printf '\n---- %s ----\n\n' "$licence"
        cat "/usr/share/common-licenses/$licence"
    done
}

append_ubuntu_versions() {
    local installed source lines
    [ -f "$out" ] || die "missing $out"
    installed=$(dpkg-query -W -f='${source:Package} ${source:Version}\n' | sort -u)
    {
        printf '\nInstalled versions on the build machine (dpkg-query):\n\n'
        for source in "${ubuntu_lgpl_sources[@]}"; do
            lines=$(awk -v source="$source" '$1 == source' <<<"$installed")
            [ -n "$lines" ] || die "Ubuntu source package $source is not installed"
            echo "$lines"
        done
        gnu_licence_texts
    } >>"$out"
    echo "third-party-licenses: appended ${#ubuntu_lgpl_sources[@]} Ubuntu source packages to ${out#"$root"/}"
}

case ${1-} in
    "") generate ;;
    ubuntu-versions) append_ubuntu_versions ;;
    *) die "usage: $0 [ubuntu-versions]" ;;
esac
