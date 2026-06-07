"""模板相关接口。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReportTemplate
from app.schemas import TemplateCreate, TemplateOut

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _model_dump(model) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db)) -> list[TemplateOut]:
    rows = db.execute(
        select(ReportTemplate).order_by(ReportTemplate.created_at.desc())
    ).scalars().all()
    return [TemplateOut(**row.to_dict()) for row in rows]


@router.post("", response_model=TemplateOut)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db)) -> TemplateOut:
    template = ReportTemplate(
        name=payload.name,
        business_tag=payload.business_tag,
        column_mapping=_model_dump(payload.column_mapping),
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return TemplateOut(**template.to_dict())


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)) -> TemplateOut:
    template = db.get(ReportTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="模板不存在")
    return TemplateOut(**template.to_dict())
