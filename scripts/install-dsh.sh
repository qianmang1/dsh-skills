#!/usr/bin/env sh
# dsh-skills 一键安装脚本（user-dsh，rank 400：<dshHome>/skills）
# 用法：curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.sh | sh
#       或本地执行：sh install-dsh.sh [技能名]   # 技能名省略时全量安装
# DSH_HOME 未设置时回退到 ~/.dsh
# 安全顺序：先下载解压到临时暂存区，校验成功后才替换；内容一致时跳过（不堆积备份）
set -e

SKILL="${1:-}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
SKILLS_DIR="$DSH_HOME/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ADDED=0; UPDATED=0; SKIPPED=0

install_one() {
  SRC="$1"; DEST="$2"; NAME="$(basename "$DEST")"
  if [ -d "$DEST" ] && diff -rq "$SRC" "$DEST" >/dev/null 2>&1; then
    echo "[dsh-skills] 内容一致，跳过：$NAME"
    SKIPPED=$((SKIPPED+1)); return
  fi
  if [ -e "$DEST" ]; then
    BACKUP="$DEST.bak-$(date +%Y%m%d%H%M%S)"
    mv "$DEST" "$BACKUP"
    echo "[dsh-skills] 有变化，旧版备份至 $BACKUP，已更新：$NAME"
    UPDATED=$((UPDATED+1))
  else
    echo "[dsh-skills] 新增：$NAME"
    ADDED=$((ADDED+1))
  fi
  mv "$SRC" "$DEST"
}

echo "[dsh-skills] 目标根：$SKILLS_DIR（$(if [ -n "$SKILL" ]; then echo "单装 $SKILL"; else echo "全量安装"; fi)）"

mkdir -p "$SKILLS_DIR" "$TMP"

echo "[dsh-skills] 下载 main 分支压缩包…"
curl -fsSL "https://github.com/qianmang1/dsh-skills/archive/refs/heads/main.tar.gz" \
  -o "$TMP/repo.tar.gz"

echo "[dsh-skills] 解压到暂存区…"
if [ -n "$SKILL" ]; then
  tar -xzf "$TMP/repo.tar.gz" -C "$TMP" --strip-components=2 "dsh-skills-main/skills/$SKILL"
  if [ ! -f "$TMP/$SKILL/SKILL.md" ]; then
    echo "[dsh-skills] 错误：暂存区未找到 $SKILL/SKILL.md，压缩包内容异常" >&2
    exit 1
  fi
  install_one "$TMP/$SKILL" "$SKILLS_DIR/$SKILL"
else
  tar -xzf "$TMP/repo.tar.gz" -C "$TMP" --strip-components=1 "dsh-skills-main/skills"
  if [ ! -d "$TMP/skills" ] || [ -z "$(ls -A "$TMP/skills" 2>/dev/null)" ]; then
    echo "[dsh-skills] 错误：压缩包内未找到任何技能目录" >&2
    exit 1
  fi
  for SRC in "$TMP/skills"/*; do
    NAME="$(basename "$SRC")"
    if [ ! -f "$SRC/SKILL.md" ]; then
      echo "[dsh-skills] 警告：$NAME 缺少 SKILL.md，已跳过"
      continue
    fi
    install_one "$SRC" "$SKILLS_DIR/$NAME"
  done
fi

echo "[dsh-skills] 摘要：新增 $ADDED，更新 $UPDATED，跳过 $SKIPPED"
