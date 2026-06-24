"""脚本解析器入口。

每个业务线对应一个解析器文件，实现 parse(markdown: str) -> list[dict]。
在这里按 business_tag 分发；没有匹配的解析器时返回空列表。

新增业务线步骤：
  1. 在 parsers/ 下新建文件，如 overseas_search.py
  2. 实现 parse(markdown: str) -> list[dict] 函数
  3. 在下方 _PARSERS 里注册 business_tag → 模块名 的映射
"""
from __future__ import annotations

import importlib
from typing import Any

# ── 注册表：业务线 → 解析器模块名（相对于 parsers 包）────────────────────────
# 示例：{"海外搜索": "overseas_search"}
_PARSERS: dict[str, str] = {
    "内容理解": "content_understanding",
    # "海外搜索": "overseas_search",
}


def extract_metrics(pdf_path: str, business_tag: str | None = None) -> list[dict[str, Any]]:
    """
    根据 business_tag 分发到对应的脚本解析器。

    返回格式（每个元素）：
      {
        "name": str,
        "value": float,
        "direction": "higher_better" | "lower_better",
        "group": str,
        "prev_value": float | None,
        # 交叉表格子额外有：
        "cross_row": str,
        "cross_col": str,
      }

    如果该业务线还没有解析器，或解析器抛异常，返回空列表。
    """
    module_name = _PARSERS.get(business_tag or "")
    if not module_name:
        return []

    try:
        mod = importlib.import_module(f"app.parsers.{module_name}")
        return mod.parse(pdf_path)
    except Exception as exc:
        # 解析器出错不影响主流程，记录后返回空
        import logging
        logging.getLogger(__name__).warning("解析器 %s 失败: %s", module_name, exc)
        return []
