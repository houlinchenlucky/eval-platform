"""内容理解 Session 满意度评测报告解析器。

对应业务线：内容理解
注册方式：在 parsers/__init__.py 的 _PARSERS 中：
  "内容理解": "content_understanding",

实现说明：
  - parse(pdf_path) 先用 pdf_to_markdown() 把 PDF 转成 Markdown，再从其中的
    管道表格（| a | b | c |）按"首列标签"识别每张表，提取标准指标。
  - 输出 4 类指标，分别喂给前端不同界面：
      整体指标        → 看板首页卡片 + 详情页大数字（goodcase率/badcase率/满意度…）
      打分分布/问题归因/复杂度/理解场景/行业分布 → 详情页横条图 + 对比页矩阵/趋势
      0/1分场景×问题  → 对比页交叉热力图（带 cross_row / cross_col）
  - 一维指标：{"name","value","direction","group","prev_value"}
    交叉格子：以上字段 + {"cross_row","cross_col"}
"""
from __future__ import annotations

import re
from typing import Any, Optional

from app.pdf_utils import pdf_to_markdown

# ── 业务常量：各表的标签集合（用首列标签识别表格，不依赖表头是否存在）──────────

GROUP_OVERALL = "整体指标"
GROUP_SCORE = "打分分布"
GROUP_PROBLEM = "问题归因"
GROUP_COMPLEXITY = "内容复杂度"
GROUP_SCENE = "理解场景"
GROUP_INDUSTRY = "行业分布"
GROUP_CROSS = "0/1分场景×问题"

PROBLEM_LABELS = {
    "语义理解偏移", "实体/关系识别错误", "结构化抽取缺失",
    "上下文指代错误", "多模态要素漏识别", "低质/噪声误判",
}
SCENE_LABELS = {
    "图文主题理解", "实体关系抽取", "观点/情绪识别", "步骤/攻略理解",
    "安全与合规理解", "跨语言内容理解", "低质/噪声识别",
}
INDUSTRY_LABELS = {
    "美妆个护", "本地生活", "兴趣技能", "母婴健康", "食品饮料",
    "旅行户外", "消费电子", "娱乐内容", "家居生活",
}
CROSS_ROW_LABELS = {
    "图文主题理解", "实体关系抽取", "观点/情绪识别",
    "步骤/攻略理解", "跨语言内容理解", "低质/噪声识别",
}
# 交叉表中间 6 列的固定顺序（与报告列序一致）
CROSS_COLS = ["语义偏移", "实体关系", "抽取缺失", "指代错误", "多模态漏识别", "噪声误判"]


# ── 文本/数字解析小工具 ───────────────────────────────────────────────────────

def _first_num(cell: str) -> Optional[float]:
    """取单元格里第一个数字（含正负号），自动忽略 pt/%/个 等后缀。"""
    m = re.search(r"[-+]?\d+(?:\.\d+)?", cell or "")
    return float(m.group()) if m else None


def _all_nums(cell: str) -> list[float]:
    """取单元格里所有数字（用于 "34 +6pt" 这种值+变化合并的格子）。"""
    return [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", cell or "")]


def _is_total_row(label: str) -> bool:
    return label.strip() in {"合计", "总计", "平均"}


def _table_blocks(markdown: str) -> list[list[list[str]]]:
    """把 Markdown 切成若干表格块；每块是 rows，每行是 cell 列表（已去掉分隔行）。"""
    blocks: list[list[list[str]]] = []
    current: list[list[str]] = []
    for raw in markdown.splitlines():
        line = raw.strip()
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            # 跳过 |---|---| 分隔行
            if all(set(c) <= {"-", ":", ""} for c in cells):
                continue
            current.append(cells)
        else:
            if current:
                blocks.append(current)
                current = []
    if current:
        blocks.append(current)
    return blocks


def _classify(block: list[list[str]]) -> Optional[str]:
    """根据块内首列标签 + 列数，判断这是哪张表。"""
    labels = [row[0].strip() for row in block if row]
    ncols = max((len(r) for r in block), default=0)

    score_hits = sum(1 for l in labels if re.match(r"^[0-3]\s*分", l))
    if score_hits >= 3:
        return GROUP_SCORE
    # 交叉表：列很宽（场景 + 6 问题 + 合计）且首列含场景标签
    if ncols >= 7 and any(l in CROSS_ROW_LABELS for l in labels):
        return GROUP_CROSS
    if any(l in PROBLEM_LABELS for l in labels):
        return GROUP_PROBLEM
    if any(re.match(r"^\d\s*-\s*\d", l) for l in labels):
        return GROUP_COMPLEXITY
    if any(l in SCENE_LABELS for l in labels):
        return GROUP_SCENE
    if any(l in INDUSTRY_LABELS for l in labels):
        return GROUP_INDUSTRY
    return None


# ── 各表解析 ─────────────────────────────────────────────────────────────────

def _parse_score(block: list[list[str]]) -> list[dict[str, Any]]:
    """1.1 打分分布 → 占比 4 项 + 整体指标 4 项（goodcase/badcase/满意度…）。

    列：分数 | 数量 | 占比 | 上期(数量) | 变化
    """
    cur: dict[int, int] = {}   # 分数 → 本期数量
    prev: dict[int, int] = {}  # 分数 → 上期数量
    cur_pct: dict[int, float] = {}
    for row in block:
        label = row[0].strip()
        m = re.match(r"^([0-3])\s*分", label)
        if not m:
            continue
        s = int(m.group(1))
        if len(row) >= 2 and _first_num(row[1]) is not None:
            cur[s] = int(_first_num(row[1]))
        if len(row) >= 3 and _first_num(row[2]) is not None:
            cur_pct[s] = _first_num(row[2])
        if len(row) >= 4 and _first_num(row[3]) is not None:
            prev[s] = int(_first_num(row[3]))

    metrics: list[dict[str, Any]] = []
    # 占比分布（详情页横条 + 对比矩阵）
    total = sum(cur.values()) or 1
    ptotal = sum(prev.values()) or 1
    for s in (3, 2, 1, 0):
        if s not in cur:
            continue
        metrics.append({
            "name": f"{s}分占比",
            "value": cur_pct.get(s, round(cur[s] / total * 100, 1)),
            "direction": "higher_better" if s == 3 else "lower_better",
            "group": GROUP_SCORE,
            "prev_value": round(prev.get(s, 0) / ptotal * 100, 2) if prev else None,
        })

    # 整体指标（看板卡片 + 详情大数字）：从数量重算，口径与报告满意度公式一致
    def rate(d: dict[int, int], keys, tot) -> float:
        return round(sum(d.get(k, 0) for k in keys) / tot * 100, 2)

    def satisfaction(d: dict[int, int], tot) -> float:
        return round((3 * d.get(3, 0) + 2 * d.get(2, 0) + 1 * d.get(1, 0)) / (3 * tot) * 100, 2)

    overall = [
        ("goodcase率(3分)", rate(cur, [3], total), rate(prev, [3], ptotal) if prev else None, "higher_better"),
        ("badcase率(0/1/2分)", rate(cur, [0, 1, 2], total), rate(prev, [0, 1, 2], ptotal) if prev else None, "lower_better"),
        ("0/1分badcase率", rate(cur, [0, 1], total), rate(prev, [0, 1], ptotal) if prev else None, "lower_better"),
        ("内容理解满意度", satisfaction(cur, total), satisfaction(prev, ptotal) if prev else None, "higher_better"),
    ]
    for name, val, pv, direction in overall:
        metrics.append({
            "name": name, "value": val, "direction": direction,
            "group": GROUP_OVERALL, "prev_value": pv,
        })
    return metrics


def _parse_problem(block: list[list[str]]) -> list[dict[str, Any]]:
    """1.2 问题归因 → 主因数量（越少越好）。列：主因 | 本期数量 | 占比 | 上期 | 变化。"""
    out: list[dict[str, Any]] = []
    for row in block:
        label = row[0].strip()
        if label not in PROBLEM_LABELS:
            continue
        val = _first_num(row[1]) if len(row) > 1 else None
        prev = _first_num(row[3]) if len(row) > 3 else None
        if val is None:
            continue
        out.append({
            "name": label, "value": val, "direction": "lower_better",
            "group": GROUP_PROBLEM, "prev_value": prev,
        })
    return out


def _parse_complexity(block: list[list[str]]) -> list[dict[str, Any]]:
    """1.3 内容复杂度 → 信息块分桶数量 + 平均信息块。列：信息块数量 | 数量 | 上期 | 变化。"""
    out: list[dict[str, Any]] = []
    for row in block:
        label = row[0].strip()
        if re.match(r"^\d\s*-\s*\d", label) or label.endswith("及以上") or "及以上" in label:
            val = _first_num(row[1]) if len(row) > 1 else None
            prev = _first_num(row[2]) if len(row) > 2 else None
            if val is None:
                continue
            out.append({
                "name": f"{label}信息块", "value": val, "direction": "higher_better",
                "group": GROUP_COMPLEXITY, "prev_value": prev,
            })
        elif label == "平均":
            val = _first_num(row[1]) if len(row) > 1 else None
            prev = _first_num(row[2]) if len(row) > 2 else None
            if val is not None:
                out.append({
                    "name": "平均信息块", "value": val, "direction": "higher_better",
                    "group": GROUP_COMPLEXITY, "prev_value": prev,
                })
    return out


def _parse_count_change(block: list[list[str]], label_set: set[str], group: str) -> list[dict[str, Any]]:
    """2.1 场景 / 2.2 行业 → 数量。值列形如 "34 +6pt"，拆成本期值与变化推出上期。"""
    out: list[dict[str, Any]] = []
    for row in block:
        label = row[0].strip()
        if label not in label_set:
            continue
        nums = _all_nums(row[1]) if len(row) > 1 else []
        if not nums:
            continue
        val = nums[0]
        prev = round(val - nums[1], 2) if len(nums) > 1 else None
        out.append({
            "name": label, "value": val, "direction": "higher_better",
            "group": group, "prev_value": prev,
        })
    return out


def _parse_cross(block: list[list[str]]) -> list[dict[str, Any]]:
    """3.2 场景×问题交叉表 → 每个格子一条 badcase 数（含 0），方向越少越好。"""
    out: list[dict[str, Any]] = []
    for row in block:
        label = row[0].strip()
        if label not in CROSS_ROW_LABELS:
            continue
        # row = [场景, n1..n6, 合计]；只取中间 6 列
        for i, col in enumerate(CROSS_COLS):
            idx = i + 1
            if idx >= len(row):
                break
            val = _first_num(row[idx])
            if val is None:
                continue
            out.append({
                "name": "badcase数", "value": val, "direction": "lower_better",
                "group": GROUP_CROSS, "prev_value": None,
                "cross_row": label, "cross_col": col,
            })
    return out


# ── 入口 ─────────────────────────────────────────────────────────────────────

def parse(pdf_path: str) -> list[dict[str, Any]]:
    """解析内容理解评测报告 PDF，返回标准指标列表。"""
    markdown = pdf_to_markdown(pdf_path)
    metrics: list[dict[str, Any]] = []
    for block in _table_blocks(markdown):
        kind = _classify(block)
        if kind == GROUP_SCORE:
            metrics += _parse_score(block)
        elif kind == GROUP_PROBLEM:
            metrics += _parse_problem(block)
        elif kind == GROUP_COMPLEXITY:
            metrics += _parse_complexity(block)
        elif kind == GROUP_SCENE:
            metrics += _parse_count_change(block, SCENE_LABELS, GROUP_SCENE)
        elif kind == GROUP_INDUSTRY:
            metrics += _parse_count_change(block, INDUSTRY_LABELS, GROUP_INDUSTRY)
        elif kind == GROUP_CROSS:
            metrics += _parse_cross(block)
    return metrics
