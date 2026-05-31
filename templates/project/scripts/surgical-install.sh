#!/usr/bin/env bash

# surgical-install.sh
# 作用：提供极致精确的逐文件交互安装。
# 逻辑：遍历所有可选资产，对每一项进行角色解释并询问用户意图。

TARGET_DIR="${1:-}"
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_ROOT="$SOURCE_ROOT/templates/project"

if [ -z "$TARGET_DIR" ]; then
  echo "❌ 错误: 请指定目标项目路径。用法: bash scripts/surgical-install.sh <path>"
  exit 1
fi

mkdir -p "$TARGET_DIR"
TARGET_ABS="$(cd "$TARGET_DIR" && pwd)"

echo "🎯 开始外科手术式安装流程 (Target: $TARGET_ABS)"
echo "------------------------------------------------"

# 定义资产清单及其角色描述
# 格式: 文件路径|角色描述
ASSETS=(
  "AGENTS.md|AI 的核心运行规则入口，定义了 AI 的行为边界"
  "PROJECT.md|项目的实时状态和定位，AI 进场的第一阅读位"
  "HANDOFF.md|短期任务记忆，记录当前在做什么和下一步计划"
  "kit|统一 CLI 中控台入口，一键运行体检和反思"
  "scripts/check-ai-project.sh|全量工程体检引擎，生成评分和报告"
  "scripts/sync-ai-rules.sh|SSOT 规则同步引擎，自动维护 .ai/rules 软链接"
  "scripts/auto-reflect.sh|自动反思引擎，将代码差异沉淀为教训"
  "scripts/check-frontend.sh|前端规范专属检查脚本"
  "scripts/check-backend.sh|后端规范专属检查脚本"
  "scripts/check-testing.sh|测试与 QA 巡检脚本"
  "scripts/check-design.sh|设计 Token 与 UI 检查脚本"
  "docs/ARCHITECTURE.md|项目架构与模块职责说明模板"
  "docs/ENVIRONMENT.md|环境变量与启动依赖配置说明模板"
  "docs/TESTING.md|测试策略与验收标准说明模板"
  "docs/NAMING.md|文档与代码命名规范模板"
  "docs/LESSONS.md|错题本，用于记录并同步 AI 教训"
)

install_item() {
  local rel_path="${1%|*}"
  local desc="${1#*|}"
  local src_file="$TEMPLATE_ROOT/$rel_path"
  local dest_file="$TARGET_ABS/$rel_path"

  echo -e "\n📦 资产: \033[1;34m$rel_path\033[0m"
  echo "   角色: $desc"

  if [ -e "$dest_file" ]; then
    echo -e "   ⚠️ \033[1;33m冲突\033[0m: 目标位置已存在同名文件。"
    read -p "      请选择操作 [o:覆盖并备份, s:跳过, c:自定义关联(软链)]: " act
  else
    read -p "      是否安装此资产? [y:安装, n:跳过]: " act
  fi

  case $act in
    y|Y)
      mkdir -p "$(dirname "$dest_file")"
      cp "$src_file" "$dest_file"
      echo "      ✅ 已写入 $rel_path"
      ;;
    o|O)
      backup_dir="$TARGET_ABS/.project-os/backups/manual_$(date +%Y%m%d)"
      mkdir -p "$backup_dir/$(dirname "$rel_path")"
      cp -R "$dest_file" "$backup_dir/$rel_path"
      mkdir -p "$(dirname "$dest_file")"
      cp "$src_file" "$dest_file"
      echo "      ✅ 已备份旧文件并覆盖写入"
      ;;
    c|C)
      read -p "      请输入你项目中现有的对应文件路径 (相对于项目根目录): " existing_path
      if [ -f "$TARGET_ABS/$existing_path" ]; then
        mkdir -p "$TARGET_ABS/.ai/rules"
        # 建立软链接映射到 .ai/rules
        ln -sf "../../$existing_path" "$TARGET_ABS/.ai/rules/$(basename "$rel_path" | tr '[:upper:]' '[:lower:]')"
        echo "      🔗 已建立映射: .ai/rules/ -> $existing_path"
      else
        echo "      ❌ 找不到路径 $existing_path，跳过映射。"
      fi
      ;;
    *)
      echo "      ⏭️ 已跳过"
      ;;
  esac
}

# 专门处理目录资产 (如 .ai 基础结构)
install_dir_basic() {
  if [ ! -d "$TARGET_ABS/.ai" ]; then
     echo -e "\n📁 \033[1;34m.ai/\033[0m 基础目录"
     read -p "   是否安装 AI 统一资产目录结构? [y/n]: " d_act
     if [[ "$d_act" =~ ^[Yy]$ ]]; then
        cp -R "$TEMPLATE_ROOT/.ai" "$TARGET_ABS/"
        echo "   ✅ 已建立 .ai/ 基础结构"
     fi
  fi
}

install_dir_basic

for item in "${ASSETS[@]}"; do
  install_item "$item"
done

# 最后触发一次目标项目的同步
if [ -f "$TARGET_ABS/scripts/sync-ai-rules.sh" ]; then
  echo -e "\n🔄 正在完成最后的规则映射同步..."
  bash "$TARGET_ABS/scripts/sync-ai-rules.sh" "$TARGET_ABS" > /dev/null 2>&1
fi

echo -e "\n✨ 外科手术式安装完成! 建议在目标目录运行 \033[1;32m./kit\033[0m 进行首轮体检。"
