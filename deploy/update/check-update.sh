#!/usr/bin/env bash
set -euo pipefail

readonly app_user="pi-flashcards"
readonly repository="/opt/pi-flashcards/app"
readonly deployment_marker="/var/lib/pi-flashcards/last-deployed-sha"

if (( EUID != 0 )); then
    echo "Run this script as root." >&2
    exit 1
fi

remote_line="$(timeout 45s runuser -u "$app_user" -- git -C "$repository" ls-remote --exit-code origin refs/heads/deploy)"
remote_sha="${remote_line%%[[:space:]]*}"
if [[ ! "$remote_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "GitHub returned an invalid deploy commit: $remote_sha" >&2
    exit 1
fi

deployed_sha=""
if [[ -f "$deployment_marker" ]]; then
    read -r deployed_sha <"$deployment_marker"
fi
if [[ "$remote_sha" == "$deployed_sha" ]]; then
    exit 0
fi

echo "A new successful Pi Flashcards build is ready: $remote_sha"
/bin/bash "${repository}/deploy.sh"
