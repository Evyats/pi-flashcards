#!/usr/bin/env bash
set -euo pipefail

readonly database="/var/lib/pi-flashcards/flashcards.db"
readonly backup_directory="/var/backups/pi-flashcards"
readonly timestamp="$(date --utc +%Y-%m-%dT%H-%M-%SZ)"
readonly destination="${backup_directory}/flashcards-${timestamp}.db"

umask 077

if [[ ! -f "$database" ]]; then
    echo "Database not found: $database" >&2
    exit 1
fi

mkdir -p "$backup_directory"
sqlite3 "$database" ".backup '$destination'"

backup_number=0
while IFS= read -r -d '' backup; do
    ((backup_number += 1))
    if (( backup_number > 7 )); then
        rm -- "$backup"
    fi
done < <(
    find "$backup_directory" -maxdepth 1 -type f -name 'flashcards-*.db' -print0 |
        sort --zero-terminated --reverse
)

echo "Created backup: $destination"

