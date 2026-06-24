#!/bin/bash
# 启动评测报告平台（单进程，生产模式）
# 用法：./start.sh [端口，默认 8000]
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
PORT="${1:-8000}"

# ── 检查 venv ─────────────────────────────────────────────────────────────────
if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "❌ 未找到 Python 环境，请先运行：./setup.sh"
  exit 1
fi

# ── 检查前端构建产物 ──────────────────────────────────────────────────────────
if [ ! -d "$ROOT/frontend/dist" ]; then
  echo "⚙️  未找到前端构建文件，正在构建..."
  cd "$ROOT/frontend"
  if ! command -v npm &>/dev/null; then
    echo "❌ 需要 Node.js 来构建前端，请先安装 Node.js 或运行 ./setup.sh"
    exit 1
  fi
  npm install -q && npm run build
  cd "$ROOT"
fi

# ── 启动后端（兼顾 API + 静态前端）──────────────────────────────────────────
source "$ROOT/backend/.venv/bin/activate"

echo ""
echo "======================================================"
echo "  启动评测报告平台..."
echo "  地址：http://localhost:$PORT"
echo "  按 Ctrl+C 停止"
echo "======================================================"
echo ""

# 稍等一秒再打开浏览器，等服务器就绪
(sleep 1.5 && open "http://localhost:$PORT" 2>/dev/null || true) &

cd "$ROOT/backend"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
