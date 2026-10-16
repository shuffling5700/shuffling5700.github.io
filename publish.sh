#!/bin/sh
# Copy the browser games from games_wiki/play into this site repo, commit, push.
# Only these game folders are published; READMEs stay behind (they hold local paths).
# Usage: ./publish.sh            copy, commit, push
#        ./publish.sh --no-push  copy and commit only
set -eu
SRC="$HOME/Documents/games_wiki/play"
SITE="$(cd "$(dirname "$0")" && pwd)"
GAMES="hunde-eventyr memory-match"

for g in $GAMES; do
  rsync -a --delete --exclude README.md --exclude .DS_Store "$SRC/$g/" "$SITE/$g/"
done

# Family saves: every saves/*.json (exported from the game) goes into one
# array the title screen can fetch. saves/ itself is git-ignored.
{
  printf '['
  sep=''
  for f in "$SITE"/saves/*.json; do
    [ -e "$f" ] || continue
    printf '%s' "$sep"
    cat "$f"
    sep=','
  done
  printf ']\n'
} > "$SITE/hunde-eventyr/family-saves.json"

cd "$SITE"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed."
  exit 0
fi
git commit -q -m "Update games from games_wiki $(git -C "$SRC" rev-parse --short HEAD)"
[ "${1:-}" = "--no-push" ] || git push -u origin main
