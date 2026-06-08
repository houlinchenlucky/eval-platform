"""海外搜索评测报告解析器（待实现）。

对应业务线：海外搜索
注册方式：在 parsers/__init__.py 的 _PARSERS 中取消注释
  "海外搜索": "overseas_search",

实现说明：
  - parse(markdown) 接收 pdf_to_markdown() 转出的 Markdown 文本
  - 用正则或 pandas 从表格中提取指标，返回标准格式的 dict 列表
  - 一维指标：{"name", "value", "direction", "group", "prev_value"}
  - 交叉表格子：以上字段 + {"cross_row", "cross_col"}
"""
from __future__ import annotations

from typing import Any


def parse(pdf_path: str) -> list[dict[str, Any]]:
    # TODO: 实现海外搜索报告的脚本解析逻辑
    raise NotImplementedError("海外搜索解析器尚未实现")
