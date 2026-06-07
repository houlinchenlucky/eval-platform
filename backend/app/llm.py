"""指标抽取入口（脚本解析模式）。

抽取逻辑全部由 app/parsers/ 下的业务线脚本实现。
此文件只做转发，保持调用方接口不变。
"""
from __future__ import annotations

from typing import Any

from app.parsers import extract_metrics as _dispatch


def extract_metrics(markdown: str, business_tag: str | None = None) -> list[dict[str, Any]]:
    """分发到 parsers/ 下对应的业务线解析器。"""
    return _dispatch(markdown, business_tag)
