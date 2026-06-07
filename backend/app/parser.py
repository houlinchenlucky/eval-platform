"""文件读取与解析工具（pandas）。支持 .xlsx/.xls/.csv。"""
from __future__ import annotations

import os
import re
from datetime import date, datetime
from typing import Any, Optional

import pandas as pd


def read_dataframe(file_path: str) -> pd.DataFrame:
    """根据扩展名读取为 DataFrame，列名转为字符串并去空白。"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        # 尝试常见编码，避免中文乱码
        try:
            df = pd.read_csv(file_path)
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="gbk")
    elif ext in (".xlsx", ".xlsm"):
        df = pd.read_excel(file_path, engine="openpyxl")
    elif ext == ".xls":
        df = pd.read_excel(file_path, engine="xlrd")
    else:
        raise ValueError(f"不支持的文件类型: {ext}")

    df.columns = [str(c).strip() for c in df.columns]
    return df


def json_safe(value: Any) -> Any:
    """把单元格值转成 JSON 可序列化的形式。"""
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    # numpy 标量
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:  # noqa: BLE001
            return str(value)
    return value


def build_preview(df: pd.DataFrame, n: int = 5) -> list[dict[str, Any]]:
    """返回前 n 行的可序列化预览。"""
    head = df.head(n)
    records: list[dict[str, Any]] = []
    for _, row in head.iterrows():
        records.append({col: json_safe(row[col]) for col in df.columns})
    return records


_DATE_PATTERNS = [
    (re.compile(r"(\d{4})[-_/年](\d{1,2})[-_/月](\d{1,2})"), "%Y-%m-%d"),
    (re.compile(r"(\d{4})[-_/](\d{1,2})"), "%Y-%m"),
    (re.compile(r"(\d{4})(\d{2})(\d{2})"), "%Y%m%d"),
]


def extract_date_from_filename(file_path: str) -> Optional[str]:
    """尝试从文件名提取日期，返回 ISO 字符串（YYYY-MM-DD）。"""
    name = os.path.basename(file_path)
    m = re.search(r"(\d{4})[-_/年](\d{1,2})[-_/月](\d{1,2})", name)
    if m:
        y, mo, d = m.groups()
        try:
            return datetime(int(y), int(mo), int(d)).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"(\d{8})", name)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y%m%d").strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"(\d{4})[-_/年](\d{1,2})", name)
    if m:
        y, mo = m.groups()
        try:
            return datetime(int(y), int(mo), 1).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def normalize_date_value(value: Any) -> Optional[str]:
    """把日期列单元格归一化为字符串。"""
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return None

    candidates = [
        ("%Y-%m-%d", text),
        ("%Y/%m/%d", text),
        ("%Y.%m.%d", text),
        ("%Y%m%d", text),
        ("%Y-%m", text),
        ("%Y/%m", text),
    ]
    for fmt, raw in candidates:
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return text
    return parsed.strftime("%Y-%m-%d")


def parse_report_date(value: Optional[str]) -> Optional[date]:
    """把 API 或推断出的报告日期转换为 date。"""
    if not value:
        return None
    normalized = normalize_date_value(value)
    if not normalized:
        return None
    try:
        return datetime.strptime(normalized[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def infer_report_date(
    df: pd.DataFrame, file_path: str, date_column: Optional[str], fallback_iso: str
) -> str:
    """报告日期：优先文件名，其次内容日期列，最后回退（uploaded_at）。"""
    from_name = extract_date_from_filename(file_path)
    if from_name:
        return from_name

    if date_column and date_column in df.columns:
        series = df[date_column].dropna()
        if not series.empty:
            normalized = normalize_date_value(series.iloc[0])
            if normalized:
                return normalized

    return fallback_iso
