#!/usr/bin/env python3
"""AKKODiS ブランド準拠 DOCX を生成する。

入力 (Markdown ライク):
    # 種別: proposal | minutes | memo | report
    # タイトル: ...
    # 宛先: ...
    # 作成: ...

    ## 見出し1
    本文 / 箇条書き

依存: python-docx
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Cm, Pt, RGBColor

NAVY = RGBColor(0x00, 0x1F, 0x33)
GOLD = RGBColor(0xFF, 0xB8, 0x1C)
BLACK = RGBColor(0x00, 0x00, 0x00)
LIGHT_GRAY = RGBColor(0x5A, 0x64, 0x70)


@dataclass
class Section:
    title: str
    body: list[str] = field(default_factory=list)


@dataclass
class Doc:
    kind: str = "proposal"
    title: str = "Untitled"
    audience: str = ""
    author: str = ""
    sections: list[Section] = field(default_factory=list)


def parse_input(text: str) -> Doc:
    doc = Doc()
    current: Section | None = None
    meta_re = {
        "種別": "kind",
        "kind": "kind",
        "タイトル": "title",
        "title": "title",
        "宛先": "audience",
        "audience": "audience",
        "作成": "author",
        "author": "author",
    }
    for raw in text.splitlines():
        line = raw.rstrip()
        m = re.match(r"^#\s*([^\s:：]+)\s*[:：]\s*(.+)$", line)
        if m and current is None:
            key = m.group(1).strip()
            val = m.group(2).strip()
            attr = meta_re.get(key)
            if attr:
                setattr(doc, attr, val.lower() if attr == "kind" else val)
                continue
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            current = Section(title=m.group(1).strip())
            doc.sections.append(current)
            continue
        if current is not None and line.strip():
            current.body.append(line)
    return doc


def _set_run(run, *, size_pt, bold=False, color: RGBColor | None = None, font="Noto Sans JP"):
    run.font.name = font
    run.font.size = Pt(size_pt)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    rFonts.set(qn("w:eastAsia"), font)


def _shading(elem, hex_rgb: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_rgb)
    elem.append(shd)


def add_cover(document: Document, doc: Doc) -> None:
    # title block on first page
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pPr = p._p.get_or_add_pPr()
    _shading(pPr, "001F33")
    run = p.add_run(" ")
    _set_run(run, size_pt=8, color=NAVY)

    p = document.add_paragraph()
    run = p.add_run(doc.title)
    _set_run(run, size_pt=32, bold=True, color=GOLD)

    if doc.audience:
        p = document.add_paragraph()
        run = p.add_run(doc.audience)
        _set_run(run, size_pt=14, color=BLACK)

    if doc.author:
        p = document.add_paragraph()
        run = p.add_run(f"作成: {doc.author}")
        _set_run(run, size_pt=11, color=LIGHT_GRAY)

    p = document.add_paragraph()
    run = p.add_run(f"日付: {date.today().strftime('%Y年%-m月%-d日')}")
    _set_run(run, size_pt=11, color=LIGHT_GRAY)

    document.add_page_break()


def add_section(document: Document, section: Section) -> None:
    h = document.add_paragraph()
    run = h.add_run(section.title)
    _set_run(run, size_pt=18, bold=True, color=NAVY)

    bullet_re = re.compile(r"^\s*[-*]\s+(.+)$")
    num_re = re.compile(r"^\s*([0-9]+)\.\s+(.+)$")
    for raw in section.body:
        m = bullet_re.match(raw)
        if m:
            p = document.add_paragraph(style=None)
            run = p.add_run("・" + m.group(1))
            _set_run(run, size_pt=11, color=BLACK)
            continue
        m = num_re.match(raw)
        if m:
            p = document.add_paragraph(style=None)
            run = p.add_run(f"{m.group(1)}. {m.group(2)}")
            _set_run(run, size_pt=11, color=BLACK)
            continue
        p = document.add_paragraph()
        run = p.add_run(raw.strip())
        _set_run(run, size_pt=11, color=BLACK)


def configure_page(document: Document) -> None:
    for section in document.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.2)
        section.right_margin = Cm(2.2)
        # header
        header = section.header
        if header.paragraphs:
            hp = header.paragraphs[0]
        else:
            hp = header.add_paragraph()
        hp.text = ""
        run = hp.add_run(document_title_for_header(document))
        _set_run(run, size_pt=9, color=NAVY)
        # footer
        footer = section.footer
        if footer.paragraphs:
            fp = footer.paragraphs[0]
        else:
            fp = footer.add_paragraph()
        fp.text = ""
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = fp.add_run("AKKODiS Internal Use")
        _set_run(run, size_pt=9, color=LIGHT_GRAY)


def document_title_for_header(document: Document) -> str:
    return getattr(document, "_akkodis_title", "AKKODiS")


def build(doc: Doc) -> Document:
    document = Document()
    document._akkodis_title = doc.title  # type: ignore[attr-defined]
    configure_page(document)
    add_cover(document, doc)
    for s in doc.sections:
        add_section(document, s)
    return document


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="AKKODiS ブランド準拠 DOCX 生成")
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args(argv)
    doc = parse_input(args.input.read_text(encoding="utf-8"))
    document = build(doc)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(args.output))
    print(f"[ok] {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
