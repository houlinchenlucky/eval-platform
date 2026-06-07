#!/bin/bash
# 一键启动评测报告可视化平台（前端 :3000 + 后端 :8000）
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "▶ 准备后端..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
echo "▶ 启动后端 (http://localhost:8000)"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "▶ 准备前端..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "▶ 启动前端 (http://localhost:3000)"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================================"
echo "  ✅ 后端 API : http://localhost:8000   (接口文档 /docs)"
echo "  ✅ 前端界面 : http://localhost:3000"
echo "  按 Ctrl+C 停止全部服务"
echo "======================================================"

trap "echo; echo '正在停止...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
