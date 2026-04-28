#!/usr/bin/env python3
"""AKKODiS ブランド準拠 XLSX を生成する。

入力 (Markdown ライク):
    # タイトル: ...
    ## シート名
    | 列1 | 列2 |
    | --- | --- |
    | 値  | 値  |

依存: openpyxl
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

NAVY = "FF001F33"
GOLD = "FFFFB81C"
WHITE = "FFFFFFFF"
ZEBRA = "FFF4F6F8"
WARN = "FFF4C7C3"
GRID = "FFE0E4E8"

HEADER_FILL = PatternFill("solid", fgColor=NAVY)
HEADER_FONT = Font(name="Noto Sans JP", size=11, bold=True, color=WHITE)
BODY_FONT = Font(name="Noto Sans JP", size=11, color="FF000000")
TITLE_FONT = Font(name="Noto Sans JP", size=16, bold=True, color=NAVY)
ZEBRA_FILL = PatternFill("solid", fgColor=ZEBRA)
GOLD_FILL = PatternFill("solid", fgColor=GOLD)
WARN_FILL = PatternFill("solid", fgColor=WARN)

THIN = Side(border_style="thin", color=GRID)
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


@dataclass
class Sheet:
    name: str
    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)


@dataclass
class Book:
    title: str = "Untitled"
    sheets: list[Sheet] = field(default_factory=list)


def parse_input(text: str) -> Book:
    book = Book()
    current: Sheet | None = None
    table_buffer: list[str] = []
    in_table = False

    def flush_table():
        nonlocal table_buffer, in_table, current
        if not table_buffer or current is None:
            table_buffer = []
            in_table = False
            return
        # parse markdown table
        rows = [row for row in table_buffer if row.strip()]
        table_buffer = []
        in_table = False
        if len(rows) < 2:
            return
        # split cells
        def split_cells(line: str) -> list[str]:
            line = line.strip()
            if line.startswith("|"):
                line = line[1:]
            if line.endswith("|"):
                line = line[:-1]
            return [c.strip() for c in line.split("|")]

        header = split_cells(rows[0])
        # rows[1] is the separator row like | --- | --- |
        body_rows = rows[2:] if re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", rows[1]) else rows[1:]
        current.header = header
        current.rows = [split_cells(r) for r in body_rows]

    for raw in text.splitlines():
        line = raw.rstrip()
        m = re.match(r"^#\s*(タイトル|title)\s*[:：]\s*(.+)$", line, re.IGNORECASE)
        if m:
            book.title = m.group(2).strip()
            continue
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            flush_table()
            current = Sheet(name=m.group(1).strip()[:31])
            book.sheets.append(current)
            continue
        if line.lstrip().startswith("|"):
            in_table = True
            table_buffer.append(line)
            continue
        if in_table and not line.strip():
            flush_table()
            continue
        # ignore other lines
    flush_table()
    return book


def _is_number(v: str) -> bool:
    if v is None:
        return False
    s = v.replace(",", "").replace("¥", "").replace("円", "").strip()
    if s.endswith("%"):
        s = s[:-1]
    try:
        float(s)
        return True
    except ValueError:
        return False


def _to_number(v: str) -> float:
    s = v.replace(",", "").replace("¥", "").replace("円", "").strip()
    if s.endswith("%"):
        return float(s[:-1]) / 100.0
    return float(s)


def write_sheet(ws, sheet: Sheet, *, is_first: bool, title: str) -> None:
    start_row = 1
    if is_first and title:
        ws.cell(row=1, column=1, value=title).font = TITLE_FONT
        ws.row_dimensions[1].height = 24
        start_row = 3

    # header
    for c, h in enumerate(sheet.header, start=1):
        cell = ws.cell(row=start_row, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER
    ws.row_dimensions[start_row].height = 24

    # body
    pct_cols = {i for i, h in enumerate(sheet.header, start=1) if "率" in h or "%" in h}
    for r_offset, row in enumerate(sheet.rows):
        r = start_row + 1 + r_offset
        for c, v in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.font = BODY_FONT
            cell.border = BORDER
            if _is_number(v):
                cell.value = _to_number(v)
                if v.strip().endswith("%") or c in pct_cols:
                    cell.number_format = "0%"
                    if cell.value is not None and cell.value >= 1.0:
                        cell.fill = GOLD_FILL
                    elif cell.value is not None and cell.value < 0.8:
                        cell.fill = WARN_FILL
                else:
                    cell.number_format = "#,##0"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            if r_offset % 2 == 1 and cell.fill.fgColor.rgb in (None, "00000000"):
                cell.fill = ZEBRA_FILL

    # column widths
    for c, h in enumerate(sheet.header, start=1):
        max_len = len(str(h))
        for row in sheet.rows:
            if c - 1 < len(row):
                max_len = max(max_len, len(str(row[c - 1])))
        ws.column_dimensions[get_column_letter(c)].width = min(40, max(12, max_len + 2))

    # freeze header + first column
    ws.freeze_panes = ws.cell(row=start_row + 1, column=2)
    ws.sheet_properties.tabColor = NAVY[2:]


def build(book: Book) -> Workbook:
    wb = Workbook()
    wb.remove(wb.active)
    for i, sheet in enumerate(book.sheets):
        ws = wb.create_sheet(title=sheet.name)
        write_sheet(ws, sheet, is_first=(i == 0), title=book.title)
    if not book.sheets:
        ws = wb.create_sheet(title="Summary")
        ws["A1"] = book.title
        ws["A1"].font = TITLE_FONT
    return wb


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="AKKODiS ブランド準拠 XLSX 生成")
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args(argv)
    book = parse_input(args.input.read_text(encoding="utf-8"))
    wb = build(book)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(args.output))
    print(f"[ok] {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
