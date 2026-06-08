# 评测报告可视化平台 — 进度看板

> 最后更新：2026-06-08

---

## 一、项目定位

**PDF 评测报告 → 脚本提取指标 → 跨期指标回溯看板**

运营上传真实评测 PDF → 后端按业务线调用对应脚本解析器提取结构化指标 → 运营核对入库 → 平台做跨期趋势、多维对比、交叉热力图回溯。

---

## 二、技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5（darkAlgorithm）+ ECharts |
| 后端 | FastAPI + SQLAlchemy + SQLite |
| PDF 解析 | pdfplumber（直接读 PDF，解析器拿到 pdf_path） |
| 指标提取 | 各业务线脚本解析器（`backend/app/parsers/`） |
| Python 环境 | 3.13，venv 在 `backend/.venv` |

---

## 三、数据库结构

### 表 `reports`
| 字段 | 说明 |
|---|---|
| id, name, business_tag | 基本信息 |
| report_date | 期次（用于时间回溯） |
| pdf_path | 原始 PDF 存档路径 |
| markdown_content | PDF 转换后的 Markdown 全文（调试用） |
| status | `confirmed`（已入库）/ `draft`（草稿，预留） |
| row_count | 指标数量 |

### 表 `metric_points`
| 字段 | 说明 |
|---|---|
| report_id, metric_name, metric_value | 指标名 + 本期值 |
| dimensions（JSON） | `{"group": "整体指标", "direction": "higher_better", "report_prev_value": 73.33}` |
| dimensions（交叉格额外字段） | `{"cross_row": "问题经验", "cross_col": "相关性", ...}` |
| row_index | 指标排序 |

> **上期值动态计算**：查询时按 `business_tag + report_date < 当前` 找上一期同名指标，环比 = 本期 − 上期。`dimensions.report_prev_value` 仅作报告原文参考，不参与计算。

---

## 四、后端接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/reports/upload-pdf` | 存 PDF + 转 Markdown（Markdown 仅作调试存档） |
| POST | `/api/reports/extract` | 调脚本解析器返回指标列表（传 pdf_path） |
| POST | `/api/reports/confirm` | 核对后入库（pdf_path/markdown 可选，支持手动录入） |
| GET | `/api/reports/overview` | 各业务线最新一期摘要 + 核心指标环比 |
| GET | `/api/reports/matrix?business_tag=` | 指标 × 期次矩阵（全量，delta 存储相邻期） |
| GET | `/api/reports/cross-matrix?business_tag=` | 交叉表 × 跨期（用于热力图） |
| GET | `/api/reports/trend?business_tag=&metric=` | 单指标跨期趋势点 |
| GET | `/api/reports` | 报告列表（分页、按业务线筛选） |
| GET | `/api/reports/{id}` | 报告详情（一维分组指标 + 交叉分组） |
| GET | `/api/reports/{id}/pdf` | 原始 PDF 文件下载 |
| GET | `/api/reports/{id}/markdown` | Markdown 全文 |
| DELETE | `/api/reports/{id}` | 删除报告（级联删 metric_points） |

> **路由顺序铁律**：`/overview`、`/matrix`、`/cross-matrix`、`/trend`、`/upload-pdf`、`/extract`、`/confirm` 必须在 `/{report_id}` 之前注册，FastAPI 按顺序匹配。

---

## 五、前端页面

### 评测看板（`/`）
- 顶部 3 张 StatCard：报告总数 / 业务线数 / 最新期次
- 业务线摘要卡片：最新一期核心指标 + 环比 delta（绿=改善 红=恶化）
- Segmented tab 按业务线筛选报告列表

### 上传报告（`/upload`）
- **Tab 1 - PDF 上传**：上传后自动调脚本提取指标，直接进入核对表（无手动触发步骤）
- **Tab 2 - 手动录入**：直接填写指标，用于补录历史数据或无 PDF 的场景

### 报告详情（`/report/:id`）
- 整体指标：StatCard 大数字展示
- 其他分组：横条图（GroupBarChart），本期值 + 上期对比色
- 「多维回溯」按钮跳转 Compare 页
- 可折叠 Markdown 全文（调试用）

### 多维回溯（`/compare`）
- 左侧：报告期次列表，点击选中/取消，支持自由组合跨期对比
- 右侧：4 个视图（Segmented 切换）
  - **横向对比表**：行=指标，列=选中期次，delta 按选中列顺序动态计算
  - **多指标趋势**：左侧勾选指标，右侧多折线同框对比
  - **结构变化**：选分组，组内细项折线 + 最新期 delta 卡片
  - **交叉热力图**：选交叉表 + 期次，ECharts heatmap 色阶可视化

---

## 六、脚本解析器架构

```
backend/app/parsers/
├── __init__.py          # 注册表 + 分发（_PARSERS 字典）
└── overseas_search.py   # 海外搜索解析器（待实现）
```

**新增业务线解析器步骤：**
1. 在 `parsers/` 下新建文件，实现 `parse(pdf_path: str) -> list[dict]`
2. 在 `__init__.py` 的 `_PARSERS` 字典里注册：`"业务线名": "模块名"`

**返回格式（每个指标）：**
```python
# 一维指标
{"name": str, "value": float, "direction": "higher_better"|"lower_better",
 "group": str, "prev_value": float|None}

# 交叉表格子（额外字段）
{..., "cross_row": str, "cross_col": str}
```

没有匹配解析器时返回空列表，用户在核对页手动填写。

---

## 七、关键决策记录

### 决策 1：从 AI 抽取转向脚本解析
**原方案**：pdfplumber 转 Markdown → DeepSeek AI 语义理解 → 抽取指标。
**转向原因**：指标数据属于公司内部敏感信息，不能发送到外部 API；同时评测报告格式相对固定，脚本可精确解析，不需要 AI 的语义理解能力。
**新方案**：每个业务线写一个解析脚本，直接用 pdfplumber 读 PDF 表格，按固定格式提取指标。

### 决策 2：解析器直接读 PDF，不经过 Markdown
**原始设计**：PDF → Markdown → 解析器读字符串。
**改动原因**：pdfplumber 的 `page.extract_tables()` 能直接拿到结构化的行列数组，比从 Markdown 字符串里正则匹配表格更稳定，不受转换格式影响。
**结论**：解析器接口改为 `parse(pdf_path: str)`，Markdown 仅保留为调试存档，不作为解析输入。

### 决策 3：交叉表格子复用 dimensions 存储，不建新表
PDF 里的二维交叉表（如「意图 × 问题类型」）用 `dimensions.cross_row` / `dimensions.cross_col` 区分，与一维指标同表存储。查询时按有无 `cross_row` 字段拆分，分别走不同接口（`/matrix` vs `/cross-matrix`）。好处是不需要改库表结构。

### 决策 4：delta 在前端按选中列动态计算
matrix 接口返回的 delta 是按 DB 里相邻两期算的。多维回溯页选 4月+6月（跳过5月）时，若直接用 DB delta，6月显示的是「6月-5月」而非「6月-4月」。
**修法**：前端渲染表格列时，根据 `visibleReports` 的实际顺序重新算：第 i 列 delta = 当前值 - `visibleReports[i-1]` 的值。

### 决策 5：上期值动态计算，不存储
不在 `metric_points` 里存 `prev_value`。查询时按 `business_tag + report_date < 当前` 找上一期同名指标。好处：删报告或改数据后环比自动修正，不存在不一致问题。

### 决策 6：热力图放多维回溯，不放报告详情
报告详情只展示单期数据，交叉热力图的意义在于跨期对比（看哪个格子变好/变坏）。把热力图放在多维回溯的「交叉热力图」tab，用户可以选期次查看任意一期的交叉分布。

### 决策 7：敏感数据隔离
- 海外搜索历史指标数据（种子脚本）已删除，不进 git
- `.gitignore` 覆盖：`*.db`、`backend/uploads/`、`backend/sample_data/`、`backend/scripts/`、`.env`

---

## 八、启动方式

```bash
# 一键启动（推荐）
./start.sh

# 或分别启动
# 后端（在 backend/ 目录）
.venv/bin/uvicorn app.main:app --port 8000 --reload

# 前端（在 frontend/ 目录）
npm run dev
```

- 前端：http://localhost:3000
- 后端接口文档：http://localhost:8000/docs

---

## 九、待完成

| 项目 | 说明 |
|---|---|
| 海外搜索解析器 | `parsers/overseas_search.py` 实现 `parse(pdf_path)` |
| 其他业务线解析器 | 按需在 `_PARSERS` 注册并实现 |
| 上传页文案优化 | 业务线输入提前到上传前，提示文案去除 AI 相关措辞 |
