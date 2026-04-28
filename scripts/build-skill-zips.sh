#!/usr/bin/env bash
# AKKODiS Claude Skills の ZIP を作る。
# 使い方:
#   ./scripts/build-skill-zips.sh
# 出力先: dist/skills/akkodis-{pptx,xlsx,docx}.zip

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/skills"
OUT="$ROOT/dist/skills"

if [[ ! -d "$SRC" ]]; then
  echo "[error] skills directory not found: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT"

for skill in akkodis-pptx akkodis-xlsx akkodis-docx; do
  if [[ ! -d "$SRC/$skill" ]]; then
    echo "[warn] skipping missing skill: $skill" >&2
    continue
  fi
  zip_path="$OUT/$skill.zip"
  rm -f "$zip_path"
  ( cd "$SRC" && zip -r -q "$zip_path" "$skill" \
      -x "*/.DS_Store" "*/__pycache__/*" "*.pyc" )
  size=$(du -h "$zip_path" | awk '{print $1}')
  echo "[ok] $zip_path ($size)"
done

echo ""
echo "次の手順:"
echo "  1. claude.ai → Settings → Capabilities → Skills → Upload skill"
echo "  2. または: unzip -o $OUT/akkodis-pptx.zip -d ~/.claude/skills/"
