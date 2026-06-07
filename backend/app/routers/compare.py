"""跨报告指标对比接口。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
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


def _direction_for_report(report: Report, metric: str) -> str:
    mapping = report.template.column_mapping if report.template else {}
    direction = (mapping.get("metric_directions") or {}).get(metric, "higher_better")
    if direction not in {"higher_better", "lower_better"}:
        return "higher_better"
    return direction


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

    value_rows = db.execute(
        select(MetricPoint.report_id, func.avg(MetricPoint.metric_value))
        .where(MetricPoint.report_id.in_(ids), MetricPoint.metric_name == metric)
        .group_by(MetricPoint.report_id)
    ).all()
    values_by_report_id = {int(report_id): float(value) for report_id, value in value_rows}

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
        direction = "higher_better"
        return CompareOut(
            metric=metric,
            direction=direction,
            trend=CompareTrend(x=[], y=[]),
            table=[],
            highlight=CompareHighlight(max_report_id=None, min_report_id=None),
        )

    direction = "higher_better"
    for row in table_rows:
        direction = _direction_for_report(reports_by_id[row.report_id], metric)
        if direction:
            break

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
