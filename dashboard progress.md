# 评测报告可视化平台 — 进度看板

> 最后更新：2026-06-24

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
- **Tab 1 - PDF 上传**：上传仅做 PDF → Markdown 转换，进入 Step 2 后用户填写业务线、点击「自动识别指标」按钮触发脚本，识别结果进入核对表
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
├── __init__.py                  # 注册表 + 分发（_PARSERS 字典）
├── content_understanding.py     # 内容理解解析器（已实现，71 个指标）
└── overseas_search.py           # 海外搜索解析器（待实现）
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

### 决策 2：解析器经由 Markdown 中间层，不直接读 pdfplumber 表格
**原始设计**：PDF → Markdown → 解析器读字符串。
**实际实现**：解析器调用 `pdf_to_markdown(pdf_path)` 得到 Markdown 字符串，再按管道表格（`| a | b |`）分块、按首列标签识别各表并用正则提取数值。
**选择原因**：`pdf_to_markdown()` 已对表格做了去重、对齐处理，比直接用 `extract_tables()` 拿原始二维数组更稳定；且 Markdown 字符串便于调试（存入 `markdown_content` 字段可直接在页面查看）。
**接口不变**：`parse(pdf_path: str) -> list[dict]`，路径传给 `pdf_to_markdown` 使用。

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
- `.gitignore` 覆盖：`*.db`、`backend/uploads/`、`backend/sample_data/`、`backend/scripts/`、`.env`

### 决策 8：内容理解解析器的指标分组设计
**文件**：`parsers/content_understanding.py`，业务线注册名 `"内容理解"`。
**共 71 个指标，分 7 组：**

| 分组 | 指标数 | 前端展示位置 |
|---|---|---|
| 整体指标 | 4 | 看板首页业务线卡片 + 详情页大数字（goodcase率 / badcase率 / 0/1分率 / 满意度） |
| 打分分布 | 4 | 详情页横条图（0分占比 / 1分占比 / 2分占比 / 3分占比） |
| 问题归因 | 6 | 详情页横条图（语义偏移 / 实体关系错误 / 抽取缺失 / 指代错误 / 多模态漏识别 / 噪声误判） |
| 内容复杂度 | 5 | 详情页横条图（1-2/3-4/5-6/7+信息块数量 + 平均信息块） |
| 理解场景 | 7 | 详情页横条图 + 对比页结构变化 |
| 行业分布 | 9 | 详情页横条图 + 对比页结构变化 |
| 0/1分场景×问题 | 36 | 对比页交叉热力图（6场景 × 6问题类型） |

**上期值来源**：打分分布/问题归因/复杂度直接从报告表格的"上期"列解析；场景/行业从"数量（变化）"列的第二个数字反推（本期 − 变化 = 上期）；整体指标从打分数量重算得出。
**跨期 delta 计算**：一维指标和交叉格子均在后端查询时动态计算（`上一期同业务线同名指标值`），与 `report_prev_value`（报告原文参考值）独立存储。

### 决策 9：上传流程拆分为两步，解耦上传与识别
**原设计**：拖入 PDF → 自动触发脚本识别 → 进入核对表。
**问题**：Ant Design Dragger 的 `customRequest` 在文件选中瞬间触发，此时 React 状态中的 `bizTag` 还是空字符串（用户尚未填写），导致脚本以空路径调用，解析器报 `No such file or directory: ''`，返回 0 个指标。
**修法**：
- 上传只做 PDF → Markdown 转换，完成后进入 Step 2
- Step 2 用户填写业务线后点击「自动识别指标」按钮，此时才调 `/extract` 接口
- 识别完成后显示"已识别 N 个指标"，支持重新识别（覆盖）
- 彻底消除时序问题，用户操作顺序不再影响结果

### 决策 10：生成 reportlab Mock PDF 用于端到端测试
为避免用真实评测报告做测试（含公司内部数据），新增 `scripts/gen_mock_pdf.py`，用 reportlab 生成与真实报告表格结构一致的 Mock PDF。该 PDF 经 pdfplumber 可干净抽取，用于验证完整链路：PDF → Markdown → 解析脚本 → 指标入库 → 各界面展示。

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

## 九、已完成 / 待完成

### 已完成（2026-06-24）
| 项目 | 说明 |
|---|---|
| 内容理解解析器 | `parsers/content_understanding.py`，71 个指标，7 分组，含交叉表 |
| Mock PDF 生成 | `scripts/gen_mock_pdf.py`，用 reportlab 生成与真实报告结构一致的测试 PDF |
| 上传流程修复 | 上传与识别彻底拆开，bizTag 由用户在 Step 2 填写后手动触发识别 |
| 两期数据入库 | 上期（2026-05-28）+ 本期（2026-06-24）均已入库，看板首页环比 delta 正确显示 |

### 待完成（后续业务线扩展）
| 项目 | 说明 |
|---|---|
| 海外搜索解析器 | `parsers/overseas_search.py` 实现 `parse(pdf_path)` |
| 其他业务线解析器 | 按需在 `_PARSERS` 注册并实现 |

---

## 十、现状缺口与改进方向（评测 PM 视角）

> 背景：与组内沟通后发现平台未真正解决评测 PM 的日常工作需求。
> 真实用户 = 评测产品经理，以下按"PM 一轮评测的完整工作流"对照定位缺口。

**评测 PM 的一轮工作 vs 平台覆盖度**

| 阶段 | PM 实际在做的事 | 现在靠什么 | 平台是否覆盖 |
|---|---|---|---|
| ① 定方案 | 这版测哪些指标、好坏判定标准（rubric） | 脑子 / 文档 | ❌ 无 |
| ② 攒数据 | 拿模型输出、组织标注/打分 | Excel、标注工具 | ❌ 无 |
| ③ **找问题** | **翻 badcase、找规律、定位哪类场景挂了** | 肉眼翻表格 | ❌ 核心痛点，未覆盖 |
| ④ 看趋势 | 这版比上版好了还是退了 | Excel 画图 | ✅ 仅此段已做 |
| ⑤ 给反馈 | 告诉算法"该改这几类"、向上汇报 | 手写文档 | ❌ 无 |

**核心问题**：平台只做了 ④，而 PM 最烧时间、最体现价值的是 ③。它帮的恰好是 Excel 也能干的那段。

**具体缺口**

1. **只有汇总数字，没有背后的 case（最致命）**
   `metric_points` 只存算好的总数（如 badcase率 12%），没有任何一条原始 case。
   PM 看到"badcase率涨了 5 个点"，下一句一定是"哪些 case 变差了、模型输出了啥"，平台答不了。
   → 要补 case 级存储，属于动数据模型的"改地基"。

2. **没有下钻能力**
   理想：点"badcase率↑" → 弹出本期所有 badcase → 看出规律 → 生成给算法的反馈。现全断。

3. **没有"评测方案"概念**
   PM 最值钱的资产是评测标准（测什么指标、打分规则、覆盖场景），平台里完全没有这层。
   所谓"指标"只是脚本从 PDF 里碰巧抠出的字段。

4. **和算法 pipeline 零对接**
   `llm.py` 是空壳，`requirements.txt` 里的 openai 一行没用。无任何调用算法接口/自动拉评测数据的能力。
   数据全靠人工先做成 PDF、再被脆弱脚本抠回来——凭空多两道手工活。

5. **每条业务线都要程序员写解析器**
   目前仅"内容理解"可用，"海外搜索"是 TODO 空架子。PM 想自助加业务线做不到，得改 `parsers/` 代码。

6. **产物无法对外汇报/沉淀**
   本地工具，生成不了可直接发出去的结论摘要，也分享不了链接。

**改进方向（优先级待定，尚未拍板）**
- 方向 A：case 级下钻诊断（改数据模型，价值最高）
- 方向 B：PM 自助配置指标/方案（摆脱硬编码解析器）
- 方向 C：一键生成汇报/分享产物
- 方向 D：与算法 pipeline 自动对接（API 接入、自动拉数、自动打分）
