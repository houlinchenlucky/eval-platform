"""ORM 模型：3 张表（report_templates / reports / metric_points）。"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReportTemplate(Base):
    """模板配置（保留兼容旧上传流程）。"""

    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    column_mapping: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    reports: Mapped[list["Report"]] = relationship(back_populates="template")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "business_tag": self.business_tag,
            "column_mapping": self.column_mapping or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Report(Base):
    """一份评测报告（支持 PDF 存档 + AI 抽取指标）。"""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True
    )
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    markdown_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # draft = AI 预填未确认；confirmed = 运营核对完成
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="confirmed")
    report_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped[Optional["ReportTemplate"]] = relationship(back_populates="reports")
    metric_points: Mapped[list["MetricPoint"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "business_tag": self.business_tag,
            "template_id": self.template_id,
            "file_path": self.file_path,
            "pdf_path": self.pdf_path,
            "status": self.status,
            "report_date": self.report_date.isoformat() if self.report_date else None,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "row_count": self.row_count,
        }


class MetricPoint(Base):
    """核心指标点：每个指标一条记录，dimensions 存分组/方向/报告自带上期值。"""

    __tablename__ = "metric_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    time_value: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    # dimensions 扩展字段：
    #   group: str           指标分组（如"整体指标"/"badcase归因"）
    #   direction: str       higher_better | lower_better
    #   report_prev_value: float | null   报告里自带的上期值（核对参考）
    dimensions: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    report: Mapped["Report"] = relationship(back_populates="metric_points")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "report_id": self.report_id,
            "time_value": self.time_value,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
            "dimensions": self.dimensions or {},
            "row_index": self.row_index,
        }
