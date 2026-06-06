#!/usr/bin/env bash

# rollback-file.sh
# Phase 3 · 安全契约:从备份目录还原被 AI 修改过的文件。
# 用法:
#   bash scripts/rollback-file.sh <文件路径>          # 还原到最近一次备份
#   bash scripts/rollback-file.sh <文件路径> --list   # 列出该文件的所有备份
#   bash scripts/rollback-file.sh --list-all          # 列出所有备份

set -euo pipefail

BACKUP_DIR=".project-os/backups"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "没有找到备份目录 $BACKUP_DIR，暂无可还原的备份。"
  exit 0
fi

# 列出所有备份
if [ "${1:-}" = "--list-all" ]; then
  echo "📦 所有备份文件："
  ls -lt "$BACKUP_DIR"/*.bak 2>/dev/null | awk '{print "  " $6, $7, $8, "→", $9}' || echo "  （暂无备份）"
  exit 0
fi

target="${1:-}"
if [ -z "$target" ]; then
  echo "用法:"
  echo "  bash scripts/rollback-file.sh <文件路径>          # 还原最近备份"
  echo "  bash scripts/rollback-file.sh <文件路径> --list   # 列出该文件备份"
  echo "  bash scripts/rollback-file.sh --list-all          # 列出所有备份"
  exit 1
fi

# 把文件路径转成备份文件名前缀（和 check-protected-write.sh 保持一致）
safe_name="$(echo "$target" | tr '/' '_' | sed 's/^\.\///')"

# 列出该文件的备份
if [ "${2:-}" = "--list" ]; then
  echo "📦 $target 的备份记录："
  ls -lt "$BACKUP_DIR/${safe_name}".*.bak 2>/dev/null \
    | awk '{print "  " $6, $7, $8, "→", $9}' \
    || echo "  （暂无备份）"
  exit 0
fi

# 找最新备份
latest="$(ls -t "$BACKUP_DIR/${safe_name}".*.bak 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  echo "❌ 没有找到 $target 的备份文件。"
  echo "   备份目录：$BACKUP_DIR"
  echo "   期望文件名格式：${safe_name}.YYYYMMDD_HHMMSS.bak"
  exit 1
fi

echo "找到最近备份：$latest"
echo "当前文件：$target"
echo ""
read -p "确认还原？(y/N) " confirm
case "$confirm" in
  y|Y)
    cp "$latest" "$target"
    echo "✅ 已还原：$target ← $latest"
    ;;
  *)
    echo "取消还原。"
    ;;
esac
