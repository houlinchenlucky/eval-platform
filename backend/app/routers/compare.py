"""跨报告指标对比接口。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MetricPoint, Report
from app.schemas import CompareHighlight, CompareOut, CompareTableRow, CompareTrend

router = APIRouter(prefix="/api", tags=["compare"])


def _parse_report_ids(raw: str) -> list[int]:
    ids: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="report_ids 必须是逗号分隔的整数") from exc
    if not ids:
        raise HTTPException(status_code=400, detail="report_ids 不能为空")
    return ids


def _direction_from_template(report: Report, metric: str) -> str | None:
    """旧流程回退：从模板配置读方向；新流程报告没有模板，返回 None。"""
    mapping = report.template.column_mapping if report.template else {}
    direction = (mapping.get("metric_directions") or {}).get(metric)
    if direction in {"higher_better", "lower_better"}:
        return direction
    return None


@router.get("/compare", response_model=CompareOut)
def compare_reports(
    report_ids: str = Query(...),
    metric: str = Query(...),
    db: Session = Depends(get_db),
) -> CompareOut:
    ids = _parse_report_ids(report_ids)
    reports = db.execute(select(Report).where(Report.id.in_(ids))).scalars().all()
    reports_by_id = {report.id: report for report in reports}
    missing = [str(report_id) for report_id in ids if report_id not in reports_by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"报告不存在: {', '.join(missing)}")

    pts = db.execute(
        select(MetricPoint)
        .where(MetricPoint.report_id.in_(ids), MetricPoint.metric_name == metric)
        .order_by(MetricPoint.row_index)
    ).scalars().all()

    # 一维指标值与方向都取自 MetricPoint.dimensions；交叉格与一维指标共用
    # metric_name，必须跳过，否则取值/方向都会被污染
    values_by_report_id: dict[int, float] = {}
    direction: str | None = None
    for pt in pts:
        dims = pt.dimensions or {}
        if dims.get("cross_row") or dims.get("cross_col"):
            continue
        if pt.report_id not in values_by_report_id:
            values_by_report_id[pt.report_id] = float(pt.metric_value)
        if direction is None and dims.get("direction") in {"higher_better", "lower_better"}:
            direction = dims["direction"]

    table_rows: list[CompareTableRow] = []
    for report_id in ids:
        report = reports_by_id[report_id]
        if report_id not in values_by_report_id:
            continue
        table_rows.append(
            CompareTableRow(
                report_id=report.id,
                report_name=report.name,
                report_date=report.report_date.isoformat() if report.report_date else None,
                value=values_by_report_id[report_id],
            )
        )

    table_rows.sort(key=lambda row: (row.report_date or "", row.report_name, row.report_id))
    if not table_rows:
        return CompareOut(
            metric=metric,
            direction=direction or "higher_better",
            trend=CompareTrend(x=[], y=[]),
            table=[],
            highlight=CompareHighlight(max_report_id=None, min_report_id=None),
        )

    if direction is None:
        for row in table_rows:
            direction = _direction_from_template(reports_by_id[row.report_id], metric)
            if direction:
                break
    direction = direction or "higher_better"

    max_row = max(table_rows, key=lambda row: row.value)
    min_row = min(table_rows, key=lambda row: row.value)
    x_values = [row.report_date or row.report_name for row in table_rows]
    y_values = [row.value for row in table_rows]

    return CompareOut(
        metric=metric,
        direction=direction,
        trend=CompareTrend(x=x_values, y=y_values),
        table=table_rows,
        highlight=CompareHighlight(
            max_report_id=max_row.report_id,
            min_report_id=min_row.report_id,
        ),
    )
