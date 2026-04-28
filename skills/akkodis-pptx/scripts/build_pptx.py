#!/usr/bin/env python3
"""AKKODiS ブランド準拠 PPTX を生成する。

入力 (Markdown ライク):
    # タイトル: ...
    # 用途: external | internal
    # トーン: dark | white

    ## セクション名
    - 箇条書き
    - 箇条書き

使い方:
    python build_pptx.py --template templates/external-white.pptx \\
        --input input.md --output out.pptx

依存: python-pptx
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

NAVY = RGBColor(0x00, 0x1F, 0x33)
GOLD = RGBColor(0xFF, 0xB8, 0x1C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x00, 0x00, 0x00)


@dataclass
class Section:
    title: str
    bullets: list[str] = field(default_factory=list)


@dataclass
class Deck:
    title: str = "Untitled"
    audience: str = "external"  # external | internal
    tone: str = "white"  # dark | white
    sections: list[Section] = field(default_factory=list)


def parse_input(text: str) -> Deck:
    deck = Deck()
    current: Section | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        m = re.match(r"^#\s*(タイトル|title)\s*[:：]\s*(.+)$", line, re.IGNORECASE)
        if m:
            deck.title = m.group(2).strip()
            continue
        m = re.match(r"^#\s*(用途|audience)\s*[:：]\s*(\S+)", line, re.IGNORECASE)
        if m:
            deck.audience = m.group(2).strip().lower()
            continue
        m = re.match(r"^#\s*(トーン|tone)\s*[:：]\s*(\S+)", line, re.IGNORECASE)
        if m:
            deck.tone = m.group(2).strip().lower()
            continue
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            current = Section(title=m.group(1).strip())
            deck.sections.append(current)
            continue
        m = re.match(r"^\s*[-*0-9]+\.?\s+(.+)$", line)
        if m and current is not None:
            current.bullets.append(m.group(1).strip())
            continue
        if current is not None:
            current.bullets.append(line.strip())
    return deck


def _is_dark(deck: Deck) -> bool:
    return deck.tone == "dark"


def _set_text(frame, text, *, size_pt, bold=False, color: RGBColor | None = None):
    frame.text = ""
    p = frame.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.name = "Noto Sans JP"
    if color is not None:
        run.font.color.rgb = color


def _add_bullets(frame, bullets, *, dark: bool):
    frame.text = ""
    color = WHITE if dark else BLACK
    for i, b in enumerate(bullets):
        if i == 0:
            p = frame.paragraphs[0]
        else:
            p = frame.add_paragraph()
        p.level = 0
        run = p.add_run()
        run.text = "・" + b
        run.font.size = Pt(20)
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = color


def _paint_background(slide, dark: bool):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = NAVY if dark else WHITE


def _add_footer_band(slide, prs):
    from pptx.shapes.autoshape import Shape  # noqa: F401
    from pptx.enum.shapes import MSO_SHAPE

    width = prs.slide_width
    height = Inches(0.04)
    top = prs.slide_height - height - Inches(0.4)
    left = 0
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = GOLD


def build_title_slide(prs: Presentation, deck: Deck) -> None:
    layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    _paint_background(slide, dark=True)  # title is always dark
    width = prs.slide_width
    height = prs.slide_height

    title_box = slide.shapes.add_textbox(
        Inches(0.6), height / 2 - Inches(0.6), width - Inches(1.2), Inches(1.2)
    )
    _set_text(title_box.text_frame, deck.title, size_pt=40, bold=True, color=GOLD)

    subtitle_box = slide.shapes.add_textbox(
        Inches(0.6), height / 2 + Inches(0.6), width - Inches(1.2), Inches(0.6)
    )
    label = "External" if deck.audience.startswith("ext") else "Internal"
    _set_text(subtitle_box.text_frame, f"AKKODiS — {label}", size_pt=18, color=WHITE)
    _add_footer_band(slide, prs)


def build_section_slide(prs: Presentation, deck: Deck, section: Section) -> None:
    layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    _paint_background(slide, dark=dark)

    width = prs.slide_width
    title_color = GOLD if dark else NAVY
    title_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.5), width - Inches(1.2), Inches(0.8))
    _set_text(title_box.text_frame, section.title, size_pt=32, bold=True, color=title_color)

    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.6), width - Inches(1.2), Inches(5.2)
    )
    _add_bullets(body_box.text_frame, section.bullets or ["（内容を追加してください）"], dark=dark)
    _add_footer_band(slide, prs)


def build(deck: Deck, template: Path) -> Presentation:
    prs = Presentation(str(template))
    # 既存テンプレに含まれるサンプルスライドを除去（参照と part を両方）
    xml_slides = prs.slides._sldIdLst  # type: ignore[attr-defined]
    slides_part = prs.part
    for sld in list(xml_slides):
        rId = sld.get(qn("r:id"))
        if rId:
            slides_part.drop_rel(rId)
        xml_slides.remove(sld)

    build_title_slide(prs, deck)
    for sec in deck.sections:
        build_section_slide(prs, deck, sec)
    return prs


def resolve_template(template: Path | None, deck: Deck) -> Path:
    if template is not None:
        return template
    here = Path(__file__).resolve().parent.parent
    aud = "external" if deck.audience.startswith("ext") else "internal"
    tone = "dark" if deck.tone == "dark" else "white"
    return here / "templates" / f"{aud}-{tone}.pptx"


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="AKKODiS ブランド準拠 PPTX 生成")
    ap.add_argument("--template", type=Path, default=None, help="ベース .pptx（省略時は入力から自動選択）")
    ap.add_argument("--input", type=Path, required=True, help="Markdown ライク入力ファイル")
    ap.add_argument("--output", type=Path, required=True, help="出力 .pptx")
    args = ap.parse_args(argv)

    text = args.input.read_text(encoding="utf-8")
    deck = parse_input(text)
    template = resolve_template(args.template, deck)
    if not template.exists():
        print(f"[error] テンプレートが見つかりません: {template}", file=sys.stderr)
        return 1
    prs = build(deck, template)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(args.output))
    print(f"[ok] {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
