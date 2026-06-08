"""Pydantic 请求/响应模型。"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ── 旧上传流程（保留兼容）─────────────────────────────────────────────────────

class ColumnMapping(BaseModel):
    date_column: Optional[str] = None
    metric_columns: list[str] = Field(default_factory=list)
    dimension_columns: list[str] = Field(default_factory=list)
    label_column: Optional[str] = None
    metric_directions: dict[str, str] = Field(default_factory=dict)
    badcase_metric: Optional[str] = None
    problem_column: Optional[str] = None
    model_column: Optional[str] = None
    scene_column: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    business_tag: Optional[str] = None
    column_mapping: ColumnMapping


class TemplateOut(BaseModel):
    id: int
    name: str
    business_tag: Optional[str] = None
    column_mapping: dict[str, Any]
    created_at: Optional[str] = None


class UploadPreview(BaseModel):
    file_path: str
    columns: list[str]
    preview: list[dict[str, Any]]


class ParseRequest(BaseModel):
    file_path: str
    name: str
    business_tag: Optional[str] = None
    report_date: Optional[str] = None
    template_id: Optional[int] = None
    column_mapping: Optional[ColumnMapping] = None


class ReportOut(BaseModel):
    id: int
    name: str
    business_tag: Optional[str] = None
    template_id: Optional[int] = None
    report_date: Optional[str] = None
    uploaded_at: Optional[str] = None
    row_count: int
    status: str = "confirmed"
    pdf_path: Optional[str] = None


class ReportListItem(BaseModel):
    id: int
    name: str
    business_tag: Optional[str] = None
    report_date: Optional[str] = None
    uploaded_at: Optional[str] = None
    row_count: int
    status: str = "confirmed"
    pdf_path: Optional[str] = None


class ReportListOut(BaseModel):
    total: int
    items: list[ReportListItem]


class DeleteOut(BaseModel):
    ok: bool


# ── PDF 上传 + AI 抽取流程 ──────────────────────────────────────────────────

class PdfUploadOut(BaseModel):
    """PDF 上传后返回 markdown，供前端预览和传入 extract。"""
    pdf_path: str
    markdown: str


class MetricItem(BaseModel):
    """单个指标（AI 返回 / 运营核对后提交）。"""
    name: str
    value: float
    direction: str = "higher_better"   # higher_better | lower_better
    group: str = "整体指标"
    prev_value: Optional[float] = None  # 报告自带上期值（核对参考）
    cross_row: Optional[str] = None    # 交叉表行维度值（无则为普通一维指标）
    cross_col: Optional[str] = None    # 交叉表列维度值


class ExtractRequest(BaseModel):
    pdf_path: str
    business_tag: Optional[str] = None


class ExtractOut(BaseModel):
    metrics: list[MetricItem]


class ConfirmRequest(BaseModel):
    """运营核对完、确认入库。pdf_path/markdown 手动录入时可为空。"""
    pdf_path: Optional[str] = None
    markdown: Optional[str] = None
    name: str
    business_tag: Optional[str] = None
    report_date: Optional[str] = None
    metrics: list[MetricItem]


# ── 报告详情（含跨期环比） ───────────────────────────────────────────────────

class MetricWithTrend(BaseModel):
    name: str
    value: float
    direction: str
    group: str
    prev_value: Optional[float] = None
    platform_prev_value: Optional[float] = None
    delta: Optional[float] = None
    cross_row: Optional[str] = None
    cross_col: Optional[str] = None

class MetricGroup(BaseModel):
    group: str
    metrics: list[MetricWithTrend]


# ── 交叉表（热力图）─────────────────────────────────────────────────────────────

class CrossCell(BaseModel):
    cross_row: str
    cross_col: str
    value: float
    delta: Optional[float] = None

class CrossGroup(BaseModel):
    group: str
    metric_name: str
    direction: str
    row_vals: list[str]
    col_vals: list[str]
    cells: list[CrossCell]

class CrossCellMulti(BaseModel):
    """跨期交叉格：values/deltas key 为 str(report_id)。"""
    cross_row: str
    cross_col: str
    values: dict[int, Optional[float]]
    deltas: dict[int, Optional[float]]

class CrossTableMulti(BaseModel):
    group: str
    metric_name: str
    direction: str
    row_vals: list[str]
    col_vals: list[str]
    cells: list[CrossCellMulti]

class CrossMatrixOut(BaseModel):
    business_tag: str
    reports: list[ReportPeriod]
    tables: list[CrossTableMulti]


class ReportDetailOut(BaseModel):
    id: int
    name: str
    business_tag: Optional[str] = None
    template_id: Optional[int] = None
    report_date: Optional[str] = None
    uploaded_at: Optional[str] = None
    row_count: int
    status: str
    pdf_path: Optional[str] = None
    has_markdown: bool = False
    groups: list[MetricGroup]
    cross_groups: list[CrossGroup] = []


# ── Overview（首页汇总） ─────────────────────────────────────────────────────

class BizLatestCard(BaseModel):
    business_tag: str
    latest_date: Optional[str] = None
    report_id: Optional[int] = None
    report_name: Optional[str] = None
    report_count: int
    key_metrics: list[MetricWithTrend]   # 该业务线核心指标最新值


class OverviewOut(BaseModel):
    biz_cards: list[BizLatestCard]
    total_reports: int


# ── 多期矩阵（横向对比） ──────────────────────────────────────────────────────

class ReportPeriod(BaseModel):
    id: int
    name: str
    date: Optional[str] = None


class MatrixRow(BaseModel):
    metric: str
    group: str
    direction: str
    values: dict[int, Optional[float]]   # report_id → 本期值
    deltas: dict[int, Optional[float]]   # report_id → 环比


class MatrixOut(BaseModel):
    business_tag: str
    reports: list[ReportPeriod]
    rows: list[MatrixRow]


# ── 对比/趋势 ────────────────────────────────────────────────────────────────

class TrendPoint(BaseModel):
    report_id: int
    report_name: str
    report_date: Optional[str] = None
    value: float


class TrendOut(BaseModel):
    metric: str
    direction: str
    business_tag: str
    points: list[TrendPoint]


# ── 旧对比接口（保留兼容） ────────────────────────────────────────────────────

class CompareTrend(BaseModel):
    x: list[str]
    y: list[float]


class CompareTableRow(BaseModel):
    report_id: int
    report_name: str
    report_date: Optional[str] = None
    value: float


class CompareHighlight(BaseModel):
    max_report_id: Optional[int] = None
    min_report_id: Optional[int] = None


class CompareOut(BaseModel):
    metric: str
    direction: str
    trend: CompareTrend
    table: list[CompareTableRow]
    highlight: CompareHighlight


class ReportOverviewItem(BaseModel):
    id: int
    name: str
    business_tag: Optional[str] = None
    report_date: Optional[str] = None
    uploaded_at: Optional[str] = None
    row_count: int
    badcase_total: float
    problem_type_count: int
    scenes: list[str]
