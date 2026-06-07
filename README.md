# 评测报告可视化与回溯平台

本地部署的轻量 Web 工具：上传 Excel/CSV 评测报告 → 自动可视化 → 按时间回溯对比。
界面采用 **Linear 暗色设计风格**（详见 [`设计规范.md`](设计规范.md)）。

## 它能做什么

1. **上传报告**：拖入 Excel/CSV，第一次配置一次「字段映射」（哪列是日期、哪些是指标），存成模板，之后同类报告自动套用。
2. **单份可视化**：每份报告自动生成指标柱状图 + 原始数据表。
3. **时间回溯**：勾选多份报告，按时间看任意指标的趋势折线，并横向对比（自动高亮最优/最差）。

## 架构（混合型）

- **上层模板映射**：套用模板识别报告结构，省心接入各种格式。
- **底层时序存储**：把每份报告打散成 `(时间, 指标, 数值, 维度)` 记录，所以能跨报告拉出任意指标的历史曲线。

```
eval-platform/
├── backend/                FastAPI + SQLite + pandas
│   ├── app/                核心：模型 / 解析 / 路由
│   ├── scripts/            示例数据生成脚本
│   ├── sample_data/        已生成的示例评测报告（4 周 × Excel/CSV）
│   └── requirements.txt
├── frontend/               React + TS + Vite + Ant Design 5 + ECharts
│   └── src/
│       ├── theme/          设计规范落地（暗色主题 + 图表配色）
│       ├── pages/          总览 / 上传 / 详情 / 对比
│       └── components/     统计卡 / 柱状图 / 趋势图
├── 设计规范.md             UI 设计唯一依据（Linear 暗色风格）
└── start.sh                一键启动
```

## 快速开始

```bash
# 一键启动（自动建 venv、装依赖、起前后端）
./start.sh
```

启动后访问 **http://localhost:3000**（后端接口文档在 http://localhost:8000/docs）。

### 手动启动

```bash
# 后端
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端（另开一个终端）
cd frontend
npm install
npm run dev
```

## 试用示例数据

`backend/sample_data/` 下已有 4 周的示例报告（点击率/转化率/综合分逐周上升、错误率逐周下降），可直接用来体验：

1. 在「上传报告」页依次上传这 4 份 `评测报告_2026-05-*.xlsx`
2. 首次上传时新建模板：
   - 日期列 → `日期`
   - 指标列 → `点击率`、`转化率`、`综合分`、`错误率`
   - 维度列 → `广告位`；备注列 → `备注`
   - 给 `错误率` 设为「越低越好」，其余「越高越好」
3. 到「时间对比」页勾选 4 份报告，切换指标看趋势

> 如需重新生成示例数据：`cd backend && python scripts/gen_sample_reports.py`

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 · TypeScript · Vite · Ant Design 5（暗色）· ECharts |
| 后端 | FastAPI · SQLAlchemy · SQLite · pandas |
| 字体 | Inter + JetBrains Mono |
