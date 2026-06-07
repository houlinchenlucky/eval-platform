# 评测报告可视化与回溯平台后端

这是 FastAPI 后端服务，提供模板管理、报告上传解析、单报告图表数据和跨报告指标回溯比较接口。

## 创建虚拟环境

```bash
cd /Users/chen/eval-platform/backend
python3 -m venv .venv
source .venv/bin/activate
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

服务启动时会自动在 `backend/eval_platform.db` 创建 SQLite 数据表。上传文件会保存在 `backend/uploads/`。

## API 前缀

所有接口均使用 `/api` 前缀，前端可从 `http://localhost:3000` 或 `http://localhost:5173` 访问。
