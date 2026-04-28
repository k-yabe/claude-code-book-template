#!/usr/bin/env python3
"""AKKODiS ブランド準拠 PPTX を生成する。

入力 (Markdown ライク):
    # タイトル: ...
    # 用途: external | internal
    # トーン: dark | white
    # サブタイトル: ...   （任意）
    # 作成: ...           （任意）

    ## セクション名             ← 通常スライド
    - 箇条書き
    - 箇条書き
    > 発表者ノート（任意）

    ## KPI: 指標A=120% | 指標B=95% | 指標C=80%   ← KPI スライド
    指標Aは前年比 +20%、指標Bは横ばい...

    ## アジェンダ              ← 自動生成（明示しなくても先頭に挿入）
    （省略すると自動でアジェンダスライドが入る）

    ## まとめ                  ← 自動生成
    - 結論1
    - 結論2

使い方:
    python build_pptx.py --template templates/external-white.pptx \
        --input input.md --output out.pptx
    # template 省略時は 用途×トーン から自動選択

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
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

# ローカル import（同ディレクトリの notation.py）
sys.path.insert(0, str(Path(__file__).resolve().parent))
from notation import correct  # noqa: E402

NAVY = RGBColor(0x00, 0x1F, 0x33)
GOLD = RGBColor(0xFF, 0xB8, 0x1C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x00, 0x00, 0x00)
GRAY = RGBColor(0x5A, 0x64, 0x70)


@dataclass
class Section:
    title: str
    bullets: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    kind: str = "content"  # content | kpi | closing
    kpis: list[tuple[str, str]] = field(default_factory=list)  # [(label, value)]


@dataclass
class Deck:
    title: str = "Untitled"
    subtitle: str = ""
    audience: str = "external"
    tone: str = "white"
    author: str = ""
    sections: list[Section] = field(default_factory=list)


def parse_input(text: str) -> Deck:
    deck = Deck()
    current: Section | None = None
    meta_re = {
        r"^#\s*(?:タイトル|title)\s*[:：]\s*(.+)$": "title",
        r"^#\s*(?:サブタイトル|subtitle)\s*[:：]\s*(.+)$": "subtitle",
        r"^#\s*(?:用途|audience)\s*[:：]\s*(\S+)": "audience",
        r"^#\s*(?:トーン|tone)\s*[:：]\s*(\S+)": "tone",
        r"^#\s*(?:作成|author)\s*[:：]\s*(.+)$": "author",
    }

    def parse_kpi_header(line: str) -> list[tuple[str, str]] | None:
        m = re.match(r"^##\s*KPI\s*[:：]\s*(.+)$", line, re.IGNORECASE)
        if not m:
            return None
        items = []
        for chunk in m.group(1).split("|"):
            if "=" in chunk:
                k, v = chunk.split("=", 1)
                items.append((k.strip(), v.strip()))
        return items

    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() and current is None:
            continue
        # メタデータ
        if current is None:
            matched = False
            for pattern, attr in meta_re.items():
                m = re.match(pattern, line, re.IGNORECASE)
                if m:
                    val = m.group(1).strip()
                    setattr(deck, attr, val.lower() if attr in ("audience", "tone") else val)
                    matched = True
                    break
            if matched:
                continue
        # KPI スライドヘッダ
        kpis = parse_kpi_header(line)
        if kpis is not None:
            current = Section(title="KPI", kind="kpi", kpis=kpis)
            deck.sections.append(current)
            continue
        # 通常セクション
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            title = m.group(1).strip()
            kind = "closing" if title in ("まとめ", "結論", "Conclusion", "Closing") else "content"
            current = Section(title=title, kind=kind)
            deck.sections.append(current)
            continue
        # 発表者ノート
        m = re.match(r"^\s*>\s+(.+)$", line)
        if m and current is not None:
            current.notes.append(m.group(1).strip())
            continue
        # 箇条書き
        m = re.match(r"^\s*[-*0-9]+\.?\s+(.+)$", line)
        if m and current is not None:
            current.bullets.append(m.group(1).strip())
            continue
        if current is not None and line.strip():
            current.bullets.append(line.strip())
    return deck


def _is_dark(deck: Deck) -> bool:
    return deck.tone == "dark"


def _set_text(
    frame,
    text,
    *,
    size_pt,
    bold=False,
    color: RGBColor | None = None,
    align=None,
    font="Noto Sans JP",
):
    frame.text = ""
    p = frame.paragraphs[0]
    if align is not None:
        p.alignment = align
    run = p.add_run()
    run.text = correct(text)
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.name = font
    if color is not None:
        run.font.color.rgb = color


def _add_bullets(frame, bullets, *, dark: bool, size_pt: int = 20):
    frame.text = ""
    color = WHITE if dark else BLACK
    frame.word_wrap = True
    for i, b in enumerate(bullets):
        if i == 0:
            p = frame.paragraphs[0]
        else:
            p = frame.add_paragraph()
        p.level = 0
        p.space_after = Pt(8)
        run = p.add_run()
        run.text = "・" + correct(b)
        run.font.size = Pt(size_pt)
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = color


def _paint_background(slide, dark: bool):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = NAVY if dark else WHITE


def _add_footer_band(slide, prs):
    width = prs.slide_width
    height = Inches(0.04)
    top = prs.slide_height - height - Inches(0.4)
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, top, width, height)
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = GOLD


def _add_logo(slide, prs, *, on_dark: bool):
    """各スライド左下にロゴを配置する。"""
    logo_dir = Path(__file__).resolve().parent.parent / "brand"
    # SVG は python-pptx で直接埋めにくいため、PNG 等価品があればそれを使う
    # ここでは SVG をそのまま参照（PowerPoint は SVG を表示できる）
    logo_name = "AKKODIS_Logo_RGB_WHITE.svg" if on_dark else "AKKODIS_Logo_RGB_BLUE.svg"
    logo_path = logo_dir / logo_name
    if not logo_path.exists():
        return
    height = Inches(0.35)
    top = prs.slide_height - height - Inches(0.5)
    left = Inches(0.4)
    try:
        slide.shapes.add_picture(str(logo_path), left, top, height=height)
    except Exception:
        # SVG 非対応の環境ではスキップ
        pass


def _add_page_number(slide, prs, num: int, total: int, *, dark: bool):
    height = Inches(0.3)
    top = prs.slide_height - height - Inches(0.45)
    width = Inches(1.5)
    left = prs.slide_width - width - Inches(0.4)
    box = slide.shapes.add_textbox(left, top, width, height)
    color = WHITE if dark else GRAY
    _set_text(
        box.text_frame,
        f"{num} / {total}",
        size_pt=10,
        color=color,
        align=PP_ALIGN.RIGHT,
    )


def _set_speaker_notes(slide, notes: list[str]) -> None:
    if not notes:
        return
    text = "\n".join(correct(n) for n in notes)
    notes_slide = slide.notes_slide
    notes_slide.notes_text_frame.text = text


def build_title_slide(prs: Presentation, deck: Deck, num: int, total: int) -> None:
    layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    _paint_background(slide, dark=True)

    width = prs.slide_width
    height = prs.slide_height

    # Title
    title_box = slide.shapes.add_textbox(
        Inches(0.6), height / 2 - Inches(1.0), width - Inches(1.2), Inches(1.4)
    )
    _set_text(title_box.text_frame, deck.title, size_pt=40, bold=True, color=GOLD)

    # Subtitle
    if deck.subtitle:
        sub_box = slide.shapes.add_textbox(
            Inches(0.6), height / 2 + Inches(0.3), width - Inches(1.2), Inches(0.6)
        )
        _set_text(sub_box.text_frame, deck.subtitle, size_pt=20, color=WHITE)

    # Audience tag + author
    label = "External" if deck.audience.startswith("ext") else "Internal"
    tag_text = f"AKKODiS — {label}"
    if deck.author:
        tag_text += f"  /  {deck.author}"
    tag_box = slide.shapes.add_textbox(
        Inches(0.6), height - Inches(1.5), width - Inches(1.2), Inches(0.5)
    )
    _set_text(tag_box.text_frame, tag_text, size_pt=14, color=GOLD)

    _add_footer_band(slide, prs)
    _add_logo(slide, prs, on_dark=True)
    _add_page_number(slide, prs, num, total, dark=True)


def build_agenda_slide(prs: Presentation, deck: Deck, num: int, total: int) -> None:
    layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    _paint_background(slide, dark=dark)

    width = prs.slide_width
    title_color = GOLD if dark else NAVY
    title_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.5), width - Inches(1.2), Inches(0.9))
    _set_text(title_box.text_frame, "アジェンダ", size_pt=32, bold=True, color=title_color)

    # 番号付きの章立て
    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.7), width - Inches(1.2), Inches(5.0)
    )
    items = []
    for i, sec in enumerate(deck.sections, start=1):
        if sec.kind == "kpi":
            items.append(f"{i:02}.  KPI ハイライト")
        else:
            items.append(f"{i:02}.  {sec.title}")
    _add_bullets(body_box.text_frame, items, dark=dark, size_pt=22)

    _add_footer_band(slide, prs)
    _add_logo(slide, prs, on_dark=dark)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_section_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    _paint_background(slide, dark=dark)

    width = prs.slide_width
    title_color = GOLD if dark else NAVY

    # Navy 帯（タイトル背景）
    band = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Inches(0.45), width, Inches(0.05))
    band.line.fill.background()
    band.fill.solid()
    band.fill.fore_color.rgb = GOLD if dark else NAVY

    title_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(0.65), width - Inches(1.2), Inches(0.9)
    )
    _set_text(title_box.text_frame, section.title, size_pt=30, bold=True, color=title_color)

    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.8), width - Inches(1.2), Inches(5.0)
    )
    bullets = section.bullets if section.bullets else ["（内容を追加してください）"]
    _add_bullets(body_box.text_frame, bullets, dark=dark, size_pt=20)

    _set_speaker_notes(slide, section.notes)
    _add_footer_band(slide, prs)
    _add_logo(slide, prs, on_dark=dark)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_kpi_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    _paint_background(slide, dark=dark)

    width = prs.slide_width
    title_color = GOLD if dark else NAVY

    title_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.5), width - Inches(1.2), Inches(0.9))
    _set_text(title_box.text_frame, "KPI ハイライト", size_pt=30, bold=True, color=title_color)

    n = max(1, len(section.kpis))
    cell_w = (width - Inches(1.2)) // n
    cell_top = Inches(2.0)
    for i, (label, value) in enumerate(section.kpis):
        cell_left = Inches(0.6) + cell_w * i
        # Value (大きく Gold)
        val_box = slide.shapes.add_textbox(cell_left, cell_top, cell_w, Inches(2.0))
        _set_text(val_box.text_frame, value, size_pt=64, bold=True, color=GOLD, align=PP_ALIGN.CENTER)
        # Label (小さく)
        lbl_box = slide.shapes.add_textbox(
            cell_left, cell_top + Inches(2.2), cell_w, Inches(0.6)
        )
        _set_text(
            lbl_box.text_frame,
            label,
            size_pt=16,
            color=WHITE if dark else NAVY,
            align=PP_ALIGN.CENTER,
        )

    # 補足テキスト（KPI セクションの bullets を下部に）
    if section.bullets:
        note_box = slide.shapes.add_textbox(
            Inches(0.6), Inches(5.4), width - Inches(1.2), Inches(1.2)
        )
        _add_bullets(note_box.text_frame, section.bullets, dark=dark, size_pt=14)

    _set_speaker_notes(slide, section.notes)
    _add_footer_band(slide, prs)
    _add_logo(slide, prs, on_dark=dark)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_closing_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(layout)
    _paint_background(slide, dark=True)
    width = prs.slide_width

    title_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(0.6), width - Inches(1.2), Inches(0.9)
    )
    _set_text(title_box.text_frame, section.title, size_pt=32, bold=True, color=GOLD)

    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.9), width - Inches(1.2), Inches(4.6)
    )
    _add_bullets(body_box.text_frame, section.bullets, dark=True, size_pt=22)

    # Thank you サインオフ
    sign_box = slide.shapes.add_textbox(
        Inches(0.6), prs.slide_height - Inches(1.3), width - Inches(1.2), Inches(0.5)
    )
    _set_text(sign_box.text_frame, "Thank you. — AKKODiS", size_pt=14, color=GOLD)

    _set_speaker_notes(slide, section.notes)
    _add_footer_band(slide, prs)
    _add_logo(slide, prs, on_dark=True)
    _add_page_number(slide, prs, num, total, dark=True)


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

    # アジェンダを自動挿入（明示されていない場合）
    has_agenda = any(s.title in ("アジェンダ", "Agenda", "目次") for s in deck.sections)
    insert_agenda = (not has_agenda) and len(deck.sections) >= 2

    # 総スライド数
    total = 1 + (1 if insert_agenda else 0) + len(deck.sections)

    num = 1
    build_title_slide(prs, deck, num, total)
    num += 1
    if insert_agenda:
        build_agenda_slide(prs, deck, num, total)
        num += 1
    for sec in deck.sections:
        if sec.kind == "kpi":
            build_kpi_slide(prs, deck, sec, num, total)
        elif sec.kind == "closing":
            build_closing_slide(prs, deck, sec, num, total)
        else:
            build_section_slide(prs, deck, sec, num, total)
        num += 1
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
    print(f"[ok] {args.output}  ({len(prs.slides)} slides)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
