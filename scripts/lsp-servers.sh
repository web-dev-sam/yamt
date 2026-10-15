#!/usr/bin/env bash
# Usage: scripts/lsp-servers.sh [--path]
# Installs the pinned language servers below for yamt's real-app check, each once into
# ${XDG_CACHE_HOME:-~/.cache}/yamt/<tool>-<version> (the network is needed the first time), and fills
# <cache>/yamt/servers-path with links to the programs a developer would have on PATH: typescript-language-server,
# intelephense, pyright (and pyright-langserver), gopls, rust-analyzer and, when a static PHP build runs here, php,
# phpactor and composer. Then prints the PATH line to launch yamt with. --path prints only that folder.
# Also installs, for scripts/lsp-repo.sh to link or copy into its projects: Biome, @vue/typescript-plugin, and with
# PHP, PHPStan and phpcs (composer.phar, with its home and cache inside <cache>/yamt). install_python_tools makes a
# project's .venv with ruff, ty and basedpyright (uv). yamt itself installs nothing (docs/plan.md §2 #70); nothing
# here writes ~/go/bin, ~/.cargo/bin, ~/.local/bin, a toolchain or a settings file.
# rust-analyzer is the release binary, not rustup's proxy (`rustup component add` changes the toolchain).
# PHP: static-php-cli's prebuilt CLI (https://dl.static-php.dev/static-php-cli/common/); Phpactor needs PHP 8.2
# (https://phpactor.readthedocs.io/en/master/usage/standalone.html). Sourced by scripts/lsp-repo.sh for its versions
# and folders; it calls install_servers with --servers.
set -euo pipefail
# shellcheck source=scripts/git-sandbox.sh
source "$(dirname "${BASH_SOURCE[0]}")/git-sandbox.sh"

tsls_version=6.0.2
intelephense_version=1.18.5
pyright_version=1.1.414
biome_version=2.5.15
vue_plugin_version=3.3.13
gopls_version=v0.23.0
rust_analyzer_version=2026-10-12
php_version=8.4.23
phpactor_version=2026.10.07.0
composer_version=2.10.3
phpstan_version=2.3.1
phpcs_version=4.0.4
ruff_version=0.17.0
ty_version=0.0.88
basedpyright_version=1.40.2

cache="${XDG_CACHE_HOME:-$HOME/.cache}/yamt"
servers_path="$cache/servers-path"
tsls_home="$cache/typescript-language-server-$tsls_version"
intelephense_home="$cache/intelephense-$intelephense_version"
pyright_home="$cache/pyright-$pyright_version"
biome_home="$cache/biome-$biome_version"
vue_plugin_home="$cache/vue-typescript-plugin-$vue_plugin_version"
gopls_home="$cache/gopls-$gopls_version"
rust_analyzer_home="$cache/rust-analyzer-$rust_analyzer_version"
php_home="$cache/php-$php_version"
phpactor_home="$cache/phpactor-$phpactor_version"
composer_home="$cache/composer-$composer_version"
php_tools_home="$cache/php-tools-phpstan-$phpstan_version-phpcs-$phpcs_version"
php_runs=false

# $1: the folder to install into, $2: the npm package, $3: its version.
install_npm() {
    [ -e "$1/node_modules/$2/package.json" ] && return
    command -v npm >/dev/null || die "npm is needed to install $2"
    mkdir -p "$1"
    npm install --prefix "$1" --no-save --no-audit --no-fund --loglevel=error "$2@$3" >/dev/null ||
        die "could not install $2 $3 into $1"
}

install_gopls() {
    [ -x "$gopls_home/bin/gopls" ] && return
    command -v go >/dev/null || die "go is needed to install gopls"
    GOBIN="$gopls_home/bin" go install "golang.org/x/tools/gopls@$gopls_version" ||
        die "could not install gopls $gopls_version into $gopls_home"
}

install_rust_analyzer() {
    local url="https://github.com/rust-lang/rust-analyzer/releases/download/$rust_analyzer_version/rust-analyzer-x86_64-unknown-linux-gnu.gz"
    [ -x "$rust_analyzer_home/rust-analyzer" ] && return
    mkdir -p "$rust_analyzer_home"
    curl -fsSL "$url" | gunzip >"$rust_analyzer_home/rust-analyzer.part" ||
        die "could not download rust-analyzer $rust_analyzer_version from $url"
    chmod +x "$rust_analyzer_home/rust-analyzer.part"
    mv "$rust_analyzer_home/rust-analyzer.part" "$rust_analyzer_home/rust-analyzer"
}

# $1: URL, $2: file. Downloads once; returns non-zero when the download fails.
download() {
    [ -e "$2" ] && return
    mkdir -p "$(dirname "$2")"
    curl -fsSL "$1" -o "$2.part" || return 1
    mv "$2.part" "$2"
}

# $1: the step that failed. PHP is best effort: without it the other servers are still installed.
leave_php_out() {
    php_runs=false
    echo "lsp-servers: PHP could not run ($1); Phpactor, PHPStan and phpcs are left out"
}

# Sets php_runs to true when the static PHP build runs here.
install_php() {
    local archive="php-$php_version-cli-linux-x86_64.tar.gz"
    local url="https://dl.static-php.dev/static-php-cli/common/$archive"
    if [ ! -x "$php_home/php" ]; then
        download "$url" "$php_home/$archive" || { leave_php_out "could not download $url"; return; }
        if ! tar -xzf "$php_home/$archive" -C "$php_home" php; then
            rm -f "$php_home/$archive"
            leave_php_out "$php_home/$archive holds no php"
            return
        fi
    fi
    if "$php_home/php" -r 'exit(0);' >/dev/null 2>&1; then
        php_runs=true
    else
        leave_php_out "$php_home/php does not start"
    fi
}

install_php_programs() {
    local phpactor_url="https://github.com/phpactor/phpactor/releases/download/$phpactor_version/phpactor.phar"
    local composer_url="https://getcomposer.org/download/$composer_version/composer.phar"
    download "$phpactor_url" "$phpactor_home/phpactor.phar" ||
        { leave_php_out "could not download $phpactor_url"; return; }
    download "$composer_url" "$composer_home/composer.phar" ||
        { leave_php_out "could not download $composer_url"; return; }
    chmod +x "$phpactor_home/phpactor.phar" "$composer_home/composer.phar"
    if [ ! -x "$php_tools_home/vendor/bin/phpstan" ] || [ ! -x "$php_tools_home/vendor/bin/phpcs" ]; then
        mkdir -p "$php_tools_home"
        cat >"$php_tools_home/composer.json" <<EOF
{
    "require-dev": {
        "phpstan/phpstan": "$phpstan_version",
        "squizlabs/php_codesniffer": "$phpcs_version"
    }
}
EOF
        COMPOSER_HOME="$composer_home/home" COMPOSER_CACHE_DIR="$composer_home/cache" \
            "$php_home/php" "$composer_home/composer.phar" install --quiet --no-interaction \
            --working-dir="$php_tools_home" || die "could not install PHPStan and phpcs into $php_tools_home"
    fi
    # A static PHP cannot load extensions ("Dynamic loading not supported"), and PHPStan's TurboExtensionSelector
    # restarts with turbo-ext/<platform>/phpstan_turbo-*.so whenever that file exists: the failed load prints a
    # startup warning on stdout, ahead of the JSON Phpactor reads.
    rm -rf "$php_tools_home/vendor/phpstan/phpstan/turbo-ext"
}

# $1: link name in servers-path, $2: the program.
put_on_path() {
    ln -s "$2" "$servers_path/$1"
}

fill_servers_path() {
    rm -rf "$servers_path"
    mkdir -p "$servers_path"
    put_on_path typescript-language-server "$tsls_home/node_modules/.bin/typescript-language-server"
    put_on_path intelephense "$intelephense_home/node_modules/.bin/intelephense"
    put_on_path pyright "$pyright_home/node_modules/.bin/pyright"
    put_on_path pyright-langserver "$pyright_home/node_modules/.bin/pyright-langserver"
    put_on_path gopls "$gopls_home/bin/gopls"
    put_on_path rust-analyzer "$rust_analyzer_home/rust-analyzer"
    if $php_runs; then
        put_on_path php "$php_home/php"
        put_on_path phpactor "$phpactor_home/phpactor.phar"
        put_on_path composer "$composer_home/composer.phar"
    fi
}

install_servers() {
    [ "$(uname -sm)" = "Linux x86_64" ] || die "the pinned rust-analyzer and PHP builds are for Linux x86_64"
    install_npm "$tsls_home" typescript-language-server "$tsls_version"
    install_npm "$intelephense_home" intelephense "$intelephense_version"
    install_npm "$pyright_home" pyright "$pyright_version"
    install_npm "$biome_home" @biomejs/biome "$biome_version"
    install_npm "$vue_plugin_home" @vue/typescript-plugin "$vue_plugin_version"
    install_gopls
    install_rust_analyzer
    install_php
    if $php_runs; then
        install_php_programs
    fi
    fill_servers_path
    echo "lsp-servers: typescript-language-server $tsls_version, intelephense $intelephense_version," \
        "pyright $pyright_version, biome $biome_version, @vue/typescript-plugin $vue_plugin_version," \
        "gopls $gopls_version, rust-analyzer $rust_analyzer_version, php $php_version (runs: $php_runs)," \
        "phpactor $phpactor_version, composer $composer_version, phpstan $phpstan_version, phpcs $phpcs_version;" \
        "in project venvs: ruff $ruff_version, ty $ty_version, basedpyright $basedpyright_version"
    echo "lsp-servers: launch yamt with PATH=$servers_path:\$PATH"
}

# $1: the virtual environment's folder. Makes it with ruff, ty and basedpyright.
install_python_tools() {
    uv venv --quiet "$1" || die "could not make a Python virtual environment in $1"
    uv pip install --quiet --python "$1/bin/python" "ruff==$ruff_version" "ty==$ty_version" \
        "basedpyright==$basedpyright_version" || die "could not install ruff, ty and basedpyright into $1"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    if [ "${1:-}" = "--path" ]; then
        echo "$servers_path"
    else
        [ $# -eq 0 ] || die "usage: $0 [--path]"
        install_servers
    fi
fi
