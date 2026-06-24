"""报告接口：PDF上传/AI抽取/确认入库/查询/趋势/Overview。"""
from __future__ import annotations

import os
import re
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MetricPoint, Report, ReportTemplate
from app.parser import (
    build_preview,
    infer_report_date,
    json_safe,
    parse_report_date,
    read_dataframe,
)
from app.pdf_utils import pdf_to_markdown
from app.llm import extract_metrics
from app.schemas import (
    BizLatestCard,
    ColumnMapping,
    ConfirmRequest,
    CrossCell,
    CrossCellMulti,
    CrossGroup,
    CrossMatrixOut,
    CrossTableMulti,
    DeleteOut,
    ExtractOut,
    ExtractRequest,
    MatrixOut,
    MatrixRow,
    MetricGroup,
    MetricItem,
    MetricWithTrend,
    OverviewOut,
    ParseRequest,
    PdfUploadOut,
    ReportDetailOut,
    ReportListItem,
    ReportListOut,
    ReportOut,
    ReportPeriod,
    TrendOut,
    TrendPoint,
    UploadPreview,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".xlsm", ".csv"}
ALLOWED_PDF = {".pdf"}


def _model_dump(model: Any) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _is_within_upload_dir(path: str) -> bool:
    """校验路径是否落在 UPLOAD_DIR 内，防止路径穿越/任意文件读取。"""
    if not path:
        return False
    upload_root = os.path.realpath(UPLOAD_DIR)
    target = os.path.realpath(path)
    return target == upload_root or target.startswith(upload_root + os.sep)


def _validate_pdf_path(path: str | None) -> str | None:
    """确认入库/抽取时校验客户端传入的 pdf_path；非法则拒绝。"""
    if path is None or path == "":
        return None
    if not _is_within_upload_dir(path):
        raise HTTPException(status_code=400, detail="非法的 pdf_path")
    return path


def _safe_filename(filename: str) -> str:
    basename = os.path.basename(filename or "report")
    name, ext = os.path.splitext(basename)
    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name).strip("._") or "report"
    return f"{safe_name}_{uuid.uuid4().hex[:12]}{ext.lower()}"


def _report_list_item(report: Report) -> ReportListItem:
    d = report.to_dict()
    return ReportListItem(
        id=d["id"], name=d["name"], business_tag=d["business_tag"],
        report_date=d["report_date"], uploaded_at=d["uploaded_at"],
        row_count=d["row_count"], status=d.get("status", "confirmed"),
        pdf_path=d.get("pdf_path"),
    )


def _get_prev_value(db: Session, report: Report, metric_name: str) -> float | None:
    """取同业务线、同指标、上一期（按 report_date）的 metric_value。"""
    if not report.report_date or not report.business_tag:
        return None
    prev_report = db.execute(
        select(Report)
        .where(
            Report.business_tag == report.business_tag,
            Report.report_date < report.report_date,
            Report.status == "confirmed",
            Report.id != report.id,
        )
        .order_by(Report.report_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    if prev_report is None:
        return None
    pts = db.execute(
        select(MetricPoint)
        .where(MetricPoint.report_id == prev_report.id, MetricPoint.metric_name == metric_name)
        .order_by(MetricPoint.row_index)
    ).scalars().all()
    # 只取一维指标的上期值，跳过交叉表格子（与一维指标共用 metric_name）
    for pt in pts:
        dims = pt.dimensions or {}
        if dims.get("cross_row") or dims.get("cross_col"):
            continue
        return float(pt.metric_value)
    return None


def _get_prev_cross_value(
    db: Session, report: Report, metric_name: str, cross_row: str, cross_col: str
) -> float | None:
    """取同业务线交叉格（metric_name + cross_row + cross_col）的上一期值。"""
    if not report.report_date or not report.business_tag:
        return None
    prev_report = db.execute(
        select(Report)
        .where(
            Report.business_tag == report.business_tag,
            Report.report_date < report.report_date,
            Report.status == "confirmed",
            Report.id != report.id,
        )
        .order_by(Report.report_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    if prev_report is None:
        return None
    pts = db.execute(
        select(MetricPoint)
        .where(MetricPoint.report_id == prev_report.id, MetricPoint.metric_name == metric_name)
    ).scalars().all()
    for pt in pts:
        dims = pt.dimensions or {}
        if dims.get("cross_row") == cross_row and dims.get("cross_col") == cross_col:
            return float(pt.metric_value)
    return None


# ── PDF 上传 → Markdown ──────────────────────────────────────────────────────

@router.post("/upload-pdf", response_model=PdfUploadOut)
async def upload_pdf(file: UploadFile = File(...)) -> PdfUploadOut:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_PDF:
        raise HTTPException(status_code=400, detail="只支持 PDF 文件")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored = _safe_filename(file.filename or "report.pdf")
    pdf_path = os.path.join(UPLOAD_DIR, stored)
    async with aiofiles.open(pdf_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            await out.write(chunk)
    try:
        markdown = pdf_to_markdown(pdf_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF 解析失败: {exc}") from exc
    return PdfUploadOut(pdf_path=pdf_path, markdown=markdown)


# ── AI 抽取指标 ───────────────────────────────────────────────────────────────

@router.post("/extract", response_model=ExtractOut)
def extract_report_metrics(payload: ExtractRequest) -> ExtractOut:
    _validate_pdf_path(payload.pdf_path)
    try:
        metrics = extract_metrics(payload.pdf_path, payload.business_tag)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 抽取失败: {exc}") from exc
    items = [
        MetricItem(
            name=m.get("name", ""),
            value=float(m.get("value", 0)),
            direction=m.get("direction", "higher_better"),
            group=m.get("group", "整体指标"),
            prev_value=m.get("prev_value"),
            cross_row=m.get("cross_row"),
            cross_col=m.get("cross_col"),
        )
        for m in metrics
        if m.get("name")
    ]
    return ExtractOut(metrics=items)


# ── 确认入库 ─────────────────────────────────────────────────────────────────

@router.post("/confirm", response_model=ReportOut)
def confirm_report(payload: ConfirmRequest, db: Session = Depends(get_db)) -> ReportOut:
    uploaded_at = datetime.now()
    report_date = parse_report_date(payload.report_date) if payload.report_date else uploaded_at.date()
    pdf_path = _validate_pdf_path(payload.pdf_path)

    report = Report(
        name=payload.name,
        business_tag=payload.business_tag,
        pdf_path=pdf_path,
        markdown_content=payload.markdown,
        status="confirmed",
        report_date=report_date,
        uploaded_at=uploaded_at,
        row_count=len(payload.metrics),
    )
    db.add(report)
    db.flush()

    for idx, m in enumerate(payload.metrics):
        dims: dict = {
            "group": m.group,
            "direction": m.direction,
            "report_prev_value": m.prev_value,
        }
        if m.cross_row is not None:
            dims["cross_row"] = m.cross_row
        if m.cross_col is not None:
            dims["cross_col"] = m.cross_col
        db.add(MetricPoint(
            report_id=report.id,
            metric_name=m.name,
            metric_value=m.value,
            dimensions=dims,
            row_index=idx,
        ))

    db.commit()
    db.refresh(report)
    d = report.to_dict()
    return ReportOut(
        id=d["id"], name=d["name"], business_tag=d["business_tag"],
        template_id=d["template_id"], report_date=d["report_date"],
        uploaded_at=d["uploaded_at"], row_count=d["row_count"],
        status=d["status"], pdf_path=d["pdf_path"],
    )


# ── 单指标跨期趋势（必须在 /{report_id} 之前注册） ────────────────────────────

@router.get("/trend", response_model=TrendOut)
def get_trend(
    business_tag: str = Query(...),
    metric: str = Query(...),
    db: Session = Depends(get_db),
) -> TrendOut:
    rows = db.execute(
        select(Report.id, Report.name, Report.report_date, MetricPoint.metric_value, MetricPoint.dimensions)
        .join(MetricPoint, MetricPoint.report_id == Report.id)
        .where(
            Report.business_tag == business_tag,
            Report.status == "confirmed",
            MetricPoint.metric_name == metric,
        )
        .order_by(Report.report_date.asc())
    ).all()

    direction = "higher_better"
    points: list[TrendPoint] = []
    for rid, name, rdate, val, dims in rows:
        dims = dims or {}
        # 跳过交叉表格子，避免一份报告出现多个同名点污染趋势
        if dims.get("cross_row") or dims.get("cross_col"):
            continue
        direction = dims.get("direction", direction)
        points.append(TrendPoint(
            report_id=rid, report_name=name,
            report_date=rdate.isoformat() if rdate else None,
            value=float(val),
        ))
    return TrendOut(metric=metric, direction=direction, business_tag=business_tag, points=points)


# ── 多期矩阵：行=指标 × 列=期次 ──────────────────────────────────────────────

@router.get("/matrix", response_model=MatrixOut)
def get_matrix(
    business_tag: str = Query(...),
    db: Session = Depends(get_db),
) -> MatrixOut:
    reports = db.execute(
        select(Report)
        .where(Report.business_tag == business_tag, Report.status == "confirmed")
        .order_by(Report.report_date.asc(), Report.uploaded_at.asc())
    ).scalars().all()

    if not reports:
        return MatrixOut(business_tag=business_tag, reports=[], rows=[])

    report_ids = [r.id for r in reports]

    pts = db.execute(
        select(MetricPoint)
        .where(MetricPoint.report_id.in_(report_ids))
        .order_by(MetricPoint.row_index)
    ).scalars().all()

    # 保留指标顺序，每个 report_id 只取一个值（第一次出现）
    metric_meta: dict[str, dict] = {}
    metric_values: dict[str, dict[int, float]] = defaultdict(dict)

    for pt in pts:
        dims = pt.dimensions or {}
        # 交叉格不进一维矩阵
        if dims.get("cross_row") or dims.get("cross_col"):
            continue
        name = pt.metric_name
        if name not in metric_meta:
            metric_meta[name] = {
                "group": dims.get("group", "其他"),
                "direction": dims.get("direction", "higher_better"),
            }
        if pt.report_id not in metric_values[name]:
            metric_values[name][pt.report_id] = float(pt.metric_value)

    rows: list[MatrixRow] = []
    for name, meta in metric_meta.items():
        vals = metric_values[name]
        values: dict[int, float | None] = {rid: vals.get(rid) for rid in report_ids}
        deltas: dict[int, float | None] = {}
        for i, rid in enumerate(report_ids):
            if i == 0:
                deltas[rid] = None
            else:
                prev_rid = report_ids[i - 1]
                v_cur = values.get(rid)
                v_pre = values.get(prev_rid)
                deltas[rid] = round(v_cur - v_pre, 4) if v_cur is not None and v_pre is not None else None
        rows.append(MatrixRow(
            metric=name, group=meta["group"], direction=meta["direction"],
            values=values, deltas=deltas,
        ))

    return MatrixOut(
        business_tag=business_tag,
        reports=[
            ReportPeriod(
                id=r.id, name=r.name,
                date=r.report_date.isoformat() if r.report_date else None,
            )
            for r in reports
        ],
        rows=rows,
    )


# ── 交叉矩阵：所有交叉表 × 跨期 ──────────────────────────────────────────────

@router.get("/cross-matrix", response_model=CrossMatrixOut)
def get_cross_matrix(
    business_tag: str = Query(...),
    db: Session = Depends(get_db),
) -> CrossMatrixOut:
    reports = db.execute(
        select(Report)
        .where(Report.business_tag == business_tag, Report.status == "confirmed")
        .order_by(Report.report_date.asc(), Report.uploaded_at.asc())
    ).scalars().all()

    if not reports:
        return CrossMatrixOut(business_tag=business_tag, reports=[], tables=[])

    report_ids = [r.id for r in reports]
    report_map = {r.id: r for r in reports}

    pts = db.execute(
        select(MetricPoint)
        .where(
            MetricPoint.report_id.in_(report_ids),
        )
        .order_by(MetricPoint.row_index)
    ).scalars().all()

    # group → {(cross_row, cross_col) → {report_id: value}}
    tables_raw: dict[str, dict] = defaultdict(lambda: {
        "metric_name": None, "direction": "lower_better",
        "row_order": [], "col_order": [],
        "cells": defaultdict(dict),
    })

    for pt in pts:
        dims = pt.dimensions or {}
        cross_row = dims.get("cross_row")
        cross_col = dims.get("cross_col")
        if not cross_row or not cross_col:
            continue
        group = dims.get("group", "交叉表")
        tbl = tables_raw[group]
        tbl["metric_name"] = tbl["metric_name"] or pt.metric_name
        tbl["direction"] = dims.get("direction", "lower_better")
        if cross_row not in tbl["row_order"]:
            tbl["row_order"].append(cross_row)
        if cross_col not in tbl["col_order"]:
            tbl["col_order"].append(cross_col)
        tbl["cells"][(cross_row, cross_col)][pt.report_id] = float(pt.metric_value)

    tables: list[CrossTableMulti] = []
    for group, tbl in tables_raw.items():
        cells: list[CrossCellMulti] = []
        for (crow, ccol), rid_vals in tbl["cells"].items():
            values = {rid: rid_vals.get(rid) for rid in report_ids}
            deltas: dict[int, float | None] = {}
            for i, rid in enumerate(report_ids):
                if i == 0:
                    deltas[rid] = None
                else:
                    prev_rid = report_ids[i - 1]
                    v_cur = values.get(rid)
                    v_pre = values.get(prev_rid)
                    deltas[rid] = round(v_cur - v_pre, 4) if v_cur is not None and v_pre is not None else None
            cells.append(CrossCellMulti(
                cross_row=crow, cross_col=ccol,
                values=values, deltas=deltas,
            ))
        tables.append(CrossTableMulti(
            group=group,
            metric_name=tbl["metric_name"] or "值",
            direction=tbl["direction"],
            row_vals=tbl["row_order"],
            col_vals=tbl["col_order"],
            cells=cells,
        ))

    return CrossMatrixOut(
        business_tag=business_tag,
        reports=[
            ReportPeriod(id=r.id, name=r.name,
                         date=r.report_date.isoformat() if r.report_date else None)
            for r in reports
        ],
        tables=tables,
    )


# ── 列表 ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=ReportListOut)
def list_reports(
    business_tag: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> ReportListOut:
    stmt = select(Report)
    count_stmt = select(func.count(Report.id))
    if business_tag:
        stmt = stmt.where(Report.business_tag == business_tag)
        count_stmt = count_stmt.where(Report.business_tag == business_tag)
    total = db.execute(count_stmt).scalar_one()
    rows = db.execute(
        stmt.order_by(Report.report_date.desc(), Report.uploaded_at.desc())
        .offset((page - 1) * limit).limit(limit)
    ).scalars().all()
    return ReportListOut(total=total, items=[_report_list_item(r) for r in rows])


# ── Overview（首页按业务线分组） ──────────────────────────────────────────────

@router.get("/overview", response_model=OverviewOut)
def get_overview(db: Session = Depends(get_db)) -> OverviewOut:
    reports = db.execute(
        select(Report).where(Report.status == "confirmed")
        .order_by(Report.business_tag, Report.report_date.desc())
    ).scalars().all()

    total = len(reports)
    # 按业务线分组，每组取最新一期
    biz_latest: dict[str, Report] = {}
    biz_counts: dict[str, int] = defaultdict(int)
    for r in reports:
        tag = r.business_tag or "未分类"
        biz_counts[tag] += 1
        if tag not in biz_latest:
            biz_latest[tag] = r

    cards: list[BizLatestCard] = []
    for tag, report in biz_latest.items():
        pts = db.execute(
            select(MetricPoint).where(MetricPoint.report_id == report.id)
            .order_by(MetricPoint.row_index)
        ).scalars().all()

        key_metrics: list[MetricWithTrend] = []
        for pt in pts:
            dims = pt.dimensions or {}
            if dims.get("group") not in ("整体指标", "key"):
                continue
            prev = _get_prev_value(db, report, pt.metric_name)
            delta = round(pt.metric_value - prev, 4) if prev is not None else None
            key_metrics.append(MetricWithTrend(
                name=pt.metric_name, value=pt.metric_value,
                direction=dims.get("direction", "higher_better"),
                group=dims.get("group", "整体指标"),
                prev_value=dims.get("report_prev_value"),
                platform_prev_value=prev, delta=delta,
            ))

        cards.append(BizLatestCard(
            business_tag=tag,
            latest_date=report.report_date.isoformat() if report.report_date else None,
            report_id=report.id,
            report_name=report.name,
            report_count=biz_counts[tag],
            key_metrics=key_metrics,
        ))

    return OverviewOut(biz_cards=cards, total_reports=total)


# ── 报告详情（带环比） ────────────────────────────────────────────────────────

@router.get("/{report_id}", response_model=ReportDetailOut)
def get_report(report_id: int, db: Session = Depends(get_db)) -> ReportDetailOut:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")

    pts = db.execute(
        select(MetricPoint).where(MetricPoint.report_id == report_id)
        .order_by(MetricPoint.row_index)
    ).scalars().all()

    grouped: dict[str, list[MetricWithTrend]] = defaultdict(list)
    # cross_data[group][(cross_row, cross_col)] = CrossCell
    cross_data: dict[str, dict] = defaultdict(dict)
    cross_meta: dict[str, dict] = {}  # group → {metric_name, direction}

    for pt in pts:
        dims = pt.dimensions or {}
        group = dims.get("group", "其他")
        cross_row = dims.get("cross_row")
        cross_col = dims.get("cross_col")

        if cross_row and cross_col:
            prev = _get_prev_cross_value(db, report, pt.metric_name, cross_row, cross_col)
            delta = round(pt.metric_value - prev, 4) if prev is not None else None
            cross_data[group][(cross_row, cross_col)] = CrossCell(
                cross_row=cross_row, cross_col=cross_col,
                value=pt.metric_value, delta=delta,
            )
            if group not in cross_meta:
                cross_meta[group] = {
                    "metric_name": pt.metric_name,
                    "direction": dims.get("direction", "higher_better"),
                    "row_order": [],
                    "col_order": [],
                }
            meta = cross_meta[group]
            if cross_row not in meta["row_order"]:
                meta["row_order"].append(cross_row)
            if cross_col not in meta["col_order"]:
                meta["col_order"].append(cross_col)
        else:
            prev = _get_prev_value(db, report, pt.metric_name)
            delta = round(pt.metric_value - prev, 4) if prev is not None else None
            grouped[group].append(MetricWithTrend(
                name=pt.metric_name, value=pt.metric_value,
                direction=dims.get("direction", "higher_better"),
                group=group,
                prev_value=dims.get("report_prev_value"),
                platform_prev_value=prev, delta=delta,
            ))

    cross_groups = [
        CrossGroup(
            group=g,
            metric_name=cross_meta[g]["metric_name"],
            direction=cross_meta[g]["direction"],
            row_vals=cross_meta[g]["row_order"],
            col_vals=cross_meta[g]["col_order"],
            cells=list(cross_data[g].values()),
        )
        for g in cross_data
    ]

    d = report.to_dict()
    return ReportDetailOut(
        id=d["id"], name=d["name"], business_tag=d["business_tag"],
        template_id=d["template_id"], report_date=d["report_date"],
        uploaded_at=d["uploaded_at"], row_count=d["row_count"],
        status=d["status"], pdf_path=d["pdf_path"],
        has_markdown=bool(report.markdown_content),
        groups=[MetricGroup(group=g, metrics=ms) for g, ms in grouped.items()],
        cross_groups=cross_groups,
    )


# ── PDF 原文下载 ──────────────────────────────────────────────────────────────

@router.get("/{report_id}/pdf")
def get_pdf(report_id: int, db: Session = Depends(get_db)) -> FileResponse:
    report = db.get(Report, report_id)
    if (
        report is None
        or not report.pdf_path
        or not _is_within_upload_dir(report.pdf_path)
        or not os.path.exists(report.pdf_path)
    ):
        raise HTTPException(status_code=404, detail="PDF 文件不存在")
    return FileResponse(report.pdf_path, media_type="application/pdf",
                        filename=os.path.basename(report.pdf_path))


# ── Markdown 全文 ─────────────────────────────────────────────────────────────

@router.get("/{report_id}/markdown")
def get_markdown(report_id: int, db: Session = Depends(get_db)) -> dict:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return {"markdown": report.markdown_content or ""}


# ── 删除 ─────────────────────────────────────────────────────────────────────

@router.delete("/{report_id}", response_model=DeleteOut)
def delete_report(report_id: int, db: Session = Depends(get_db)) -> DeleteOut:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    db.delete(report)
    db.commit()
    return DeleteOut(ok=True)
