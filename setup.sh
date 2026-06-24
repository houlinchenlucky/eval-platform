#!/bin/bash
# 首次安装脚本（只需运行一次）
# 安装完成后，每次启动只需运行：./start.sh
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "======================================================"
echo "  评测报告平台 — 初始化安装"
echo "======================================================"
echo ""

# ── 检查 Python 版本 ──────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    VER=$("$cmd" -c 'import sys; print(sys.version_info >= (3, 9))' 2>/dev/null)
    if [ "$VER" = "True" ]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ 需要 Python 3.9 或更高版本"
  echo "   下载地址：https://www.python.org/downloads/"
  exit 1
fi
echo "✅ Python 版本检查通过 ($($PYTHON --version))"

# ── 创建 Python 虚拟环境 ──────────────────────────────────────────────────────
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "⚙️  创建 Python 虚拟环境..."
  "$PYTHON" -m venv .venv
fi
source .venv/bin/activate
echo "⚙️  安装 Python 依赖（首次可能需要几分钟）..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✅ Python 依赖安装完成"

# ── 构建前端（可选，若已有 dist/ 则跳过）────────────────────────────────────
cd "$ROOT"
if [ -d "frontend/dist" ]; then
  echo "✅ 前端构建文件已存在，跳过构建"
else
  if command -v npm &>/dev/null; then
    echo "⚙️  构建前端（首次需要下载依赖）..."
    cd "$ROOT/frontend"
    npm install -q
    npm run build
    cd "$ROOT"
    echo "✅ 前端构建完成"
  else
    echo "⚠️  未找到 Node.js，跳过前端构建"
    echo "   （如需自行构建前端，请安装 Node.js 后运行：cd frontend && npm install && npm run build）"
  fi
fi

echo ""
echo "======================================================"
echo "  ✅ 安装完成！"
echo ""
echo "  启动平台：./start.sh"
echo "  默认地址：http://localhost:8000"
echo "======================================================"
