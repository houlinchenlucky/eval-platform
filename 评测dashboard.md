# 评测报告可视化平台 — 进度看板

> 最后更新：2026-06-04

---

## 一、项目定位（已转向）

~~上传 Excel/CSV → 可视化~~（已废弃）

**当前定位：PDF 评测报告 → AI 抽取指标 → 跨期指标回溯看板**

运营上传真实评测 PDF（如"海外搜索 Session 满意度评测报告"）→ 后端用 pdfplumber 转 Markdown → 调 DeepSeek AI 抽取结构化指标 → 运营核对入库 → 平台做跨期趋势、多维对比。

---

## 二、技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5（darkAlgorithm）+ ECharts |
| 后端 | FastAPI + SQLAlchemy + SQLite |
| PDF 解析 | pdfplumber（文字 + 表格 → Markdown） |
| AI 抽取 | openai SDK（DeepSeek OpenAI 兼容接口） |
| Python 环境 | 3.13，venv 在 `backend/.venv` |

---

## 三、数据库结构

### 表 `reports`
| 字段 | 说明 |
|---|---|
| id, name, business_tag | 基本信息 |
| report_date | 期次（用于时间回溯） |
| pdf_path | 原始 PDF 存档路径 |
| markdown_content | PDF 转换后的 Markdown 全文 |
| status | `confirmed`（已入库） / `draft`（草稿，预留） |
| row_count | 指标数量 |

### 表 `metric_points`
| 字段 | 说明 |
|---|---|
| report_id, metric_name, metric_value | 指标名 + 本期值 |
| dimensions（JSON） | `{"group": "整体指标", "direction": "higher_better", "report_prev_value": 73.33}` |
| row_index | 指标排序 |

> **上期值不落库，查询时动态算**：对每个指标，取同 business_tag、report_date < 当前、status=confirmed 的最近一期同名指标值作为平台口径上期值，环比 = 本期 − 上期。

---

## 四、后端接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/reports/upload-pdf` | 存 PDF + 转 Markdown |
| POST | `/api/reports/extract` | 调 DeepSeek 返回指标列表 |
| POST | `/api/reports/confirm` | 核对后入库（pdf_path/markdown 可选，支持手动录入） |
| GET | `/api/reports/overview` | 各业务线最新一期摘要 + 核心指标环比 |
| GET | `/api/reports/matrix?business_tag=` | 指标 × 期次矩阵（行=指标，列=报告） |
| GET | `/api/reports/trend?business_tag=&metric=` | 单指标跨期趋势点 |
| GET | `/api/reports` | 报告列表（分页、按业务线筛选） |
| GET | `/api/reports/{id}` | 报告详情（按分组的指标 + 环比） |
| GET | `/api/reports/{id}/pdf` | 原始 PDF 文件下载 |
| GET | `/api/reports/{id}/markdown` | Markdown 全文 |
| DELETE | `/api/reports/{id}` | 删除报告 |

> **路由顺序铁律**：`/overview`、`/matrix`、`/trend`、`/upload-pdf`、`/extract`、`/confirm` 必须在 `/{report_id}` 之前注册，FastAPI 按顺序匹配。

---

## 五、前端页面

### 评测看板（`/`）
- 顶部 3 张 StatCard：报告总数 / 业务线数 / 最新期次
- 业务线摘要卡片：最新一期核心指标 + 环比 delta（绿=改善 红=恶化）
- Segmented tab pill 按业务线筛选报告列表
- 报告列表表格：支持删除（Popconfirm 二次确认）

### 上传报告（`/upload`）
- **Tab 1 - PDF 上传**：3 步流程（上传 → AI 识别 → 核对入库）
- **Tab 2 - 手动录入**：直接填写指标，用于补录历史数据或无 PDF 的场景

### 报告详情（`/report/:id`）
- 指标按分组展示为卡片，显示本期值 + 环比 delta
- 「查看原始 PDF」按钮 + 「删除」按钮（确认后跳回看板）
- 可折叠 Markdown 全文

### 多维回溯（`/compare`）
三个视图（Segmented 切换）：
- **横向对比表**：行=指标，列=期次，格子 = 值 + 环比箭头，整体指标行 surface-2 高亮
- **多指标趋势**：左侧勾选任意指标，右侧多折线同框对比
- **结构变化**：选分组，组内所有细项折线 + 最新期 delta 卡片

---

## 六、关键决策记录

### 决策 1：从 Excel 流转向 PDF + AI
**原方案**：运营上传 badcase 汇总 Excel，手动映射列。
**转向原因**：真实评测报告是富文本 PDF（图文 + 多张结构各异的表格），根本没有可直接解析的结构化列。强行适配 Excel 流要求运营额外整理数据，没有价值。
**新方案**：pdfplumber 提取文字 + 表格 → Markdown，喂给 AI 直接理解语义，运营只核对不手填。

### 决策 2：指标一维化存储，不入库二维交叉表
PDF 里存在"意图 × 问题"二维交叉表，语义无法直接做跨期趋势。
决策：只把可量化的一维指标（名称 → 数值）落库参与趋势；二维交叉表保留在 Markdown 全文里，在详情页展示，不进时序。

### 决策 3：上期值动态计算，不存储
不在 metric_points 里存 prev_value 字段。查询时按 `business_tag + report_date < 当前` 找上一期。
好处：历史数据变更（删报告/改值）后环比自动修正，不存在数据不一致。
报告自带的上期值只存在 `dimensions.report_prev_value`，仅作核对参考。

### 决策 4：DeepSeek key 未配时走 seed 数据
`llm.py` 检测 `DEEPSEEK_API_KEY` 环境变量，未配置时返回硬编码的"海外搜索"种子指标，使开发/演示不依赖外部 API。key 配好后自动切换真实调用。

### 决策 5：matrix 接口独立于 trend
趋势图（`/trend`）每次只返回一个指标的时间序列，适合单指标折线。
横向对比表需要所有指标 × 所有期次，单独设计 `/matrix` 接口一次返回完整二维数据，前端直接渲染表格和多指标折线，避免 N 次并发请求。

### 决策 6：设计规范违规点及修复
对照 `设计规范.md` 发现并修复的问题：
- lavender（#5e6ad2）被用作表格行背景色 → 改为 surface-2
- 步骤标签用 AntD `<Tag color="blue">` → 换成手写圆圈 `StepBadge`，用 token 颜色
- Card 默认 box-shadow → `antdTheme.ts` 加 `boxShadow: 'none'`
- Dashboard 缺顶部 StatCard 行 → 补「报告总数/业务线数/最新期次」三张卡
- Dashboard 缺业务线 tab 筛选 → 加 Segmented pill tabs

---

## 七、DeepSeek 配置（待运营提供）

在 `backend/.env` 里填写：

```env
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1   # 或内网网关地址
DEEPSEEK_MODEL=deepseek-chat                     # 或具体版本
```

配置前平台用种子数据演示，配置后自动切真实 AI 识别。

---

## 八、测试数据

`backend/scripts/seed_metric_reports.py` 写入 3 期"海外搜索"数据：

| 期次 | Session 满意度 | goodcase 率 | 0/1分 badcase 率 |
|---|---|---|---|
| 2026-04-28 | 73.33 | 56.00 | 26.00 |
| 2026-05-26 | 76.00 | 60.00 | 24.00 |
| 2026-06-02 | 78.50 | 63.00 | 21.50 |

"非英文问题"从 8 → 11 → 13 持续恶化（越低越好），可在多维回溯"结构变化"视图里看到红色标记。

---

## 九、启动方式

```bash
# 后端（需在 backend/ 目录）
.venv/bin/uvicorn app.main:app --port 8000 --reload

# 前端（需在 frontend/ 目录）
npm run dev
```

- 前端：http://localhost:3000
- 后端接口文档：http://localhost:8000/docs
