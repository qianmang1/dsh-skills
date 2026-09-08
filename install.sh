#!/usr/bin/env sh
# dsh-skills 一键安装脚本（user-dsh，rank 400：<dshHome>/skills）
# 用法：curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install.sh | sh
#       或本地执行：sh install.sh [技能名]   # 默认 dsh-hermes-plugin
set -e

SKILL="${1:-dsh-hermes-plugin}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
DEST="$DSH_HOME/skills/$SKILL"
DEST_DIR="$(dirname "$DEST")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[dsh-skills] 目标：$DEST"

mkdir -p "$DEST_DIR"
if [ -e "$DEST" ]; then
  BACKUP="$DEST.bak-$(date +%Y%m%d%H%M%S)"
  mv "$DEST" "$BACKUP"
  echo "[dsh-skills] 已存在，旧版本备份至 $BACKUP"
fi

echo "[dsh-skills] 下载 main 分支压缩包…"
curl -fsSL "https://github.com/qianmang1/dsh-skills/archive/refs/heads/main.tar.gz" \
  -o "$TMP/repo.tar.gz"

echo "[dsh-skills] 解压…"
tar -xzf "$TMP/repo.tar.gz" -C "$DEST_DIR" --strip-components=2 "dsh-skills-main/skills/$SKILL"

echo "[dsh-skills] 完成，已安装到：$DEST"
ls -1 "$DSH_HOME/skills"
