"""PDF → Markdown 转换工具（pdfplumber）。"""
from __future__ import annotations

from typing import Any


def _clean(cell: Any) -> str:
    if cell is None:
        return ""
    return str(cell).replace("\n", " ").strip()


def _table_to_md(table: list[list[Any]]) -> str:
    if not table or not table[0]:
        return ""
    header = [_clean(c) for c in table[0]]
    col_count = len(header)
    lines = ["| " + " | ".join(header) + " |"]
    lines.append("| " + " | ".join(["---"] * col_count) + " |")
    for row in table[1:]:
        cells = [_clean(c) for c in row]
        while len(cells) < col_count:
            cells.append("")
        lines.append("| " + " | ".join(cells[:col_count]) + " |")
    return "\n".join(lines)


def pdf_to_markdown(pdf_path: str) -> str:
    """把 PDF 转成 Markdown 字符串（文字段落 + 表格）。"""
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            parts.append(f"\n\n<!-- 第 {i + 1} 页 -->")

            # 先提取表格的 bbox，避免文字和表格重复
            tables = page.find_tables()
            table_bboxes = [t.bbox for t in tables]

            # 过滤掉落在表格区域内的文字
            words = page.extract_words()
            filtered_chars: list[Any] = []
            for word in words:
                wx0, wy0, wx1, wy1 = word["x0"], word["top"], word["x1"], word["bottom"]
                in_table = any(
                    bx0 <= wx0 and wy0 >= by0 and wx1 <= bx1 and wy1 <= by1
                    for bx0, by0, bx1, by1 in table_bboxes
                )
                if not in_table:
                    filtered_chars.append(word["text"])

            if filtered_chars:
                parts.append(" ".join(filtered_chars))

            # 表格转 Markdown
            for table in page.extract_tables():
                md = _table_to_md(table)
                if md:
                    parts.append("\n" + md)

    return "\n".join(parts).strip()
