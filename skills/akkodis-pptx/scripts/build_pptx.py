#!/usr/bin/env python3
"""AKKODiS ブランド準拠 PPTX を生成する。

入力 (Markdown ライク):
    # タイトル: ...
    # サブタイトル: ...   （任意）
    # 用途: external | internal
    # トーン: dark | white
    # 作成: ...           （任意）

    ## アジェンダ              （明示すれば自動アジェンダは抑制される）
    ## セクション名             ← 通常スライド
    - 箇条書き
    > 発表者ノート（任意）

    ## KPI: 指標A=120% | 指標B=95% | 指標C=80%   ← KPI スライド

    ## まとめ                  ← クロージング

設計方針:
- テンプレ（external/internal × dark/white）の slide_layouts のグラフィック
  （Wave Landscape / Mesh / Eye Akkodis 等）を活かす
- 表紙は layout 0 を使い placeholder にタイトル/サブタイトルを流し込む
- 本文スライドは layout 1（Mesh grey 系）を使い、IMG_Back の大背景は
  そのまま残しつつ、タイトル placeholder を上部に再配置し本文 box を下に追加
- ロゴ・「@Akkodis」フッターはマスターに既に入っているので追加配置しない
- フォントは Noto Sans JP / 本文 18pt / タイトル 28-32pt
- 全テキストに表記補正 (notation.correct) を適用

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
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

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
    kind: str = "content"  # content | kpi | closing | agenda
    kpis: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class Deck:
    title: str = "Untitled"
    subtitle: str = ""
    audience: str = "external"
    tone: str = "white"
    author: str = ""
    sections: list[Section] = field(default_factory=list)


# ── パース ──────────────────────────────────────────────────


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
        kpis = parse_kpi_header(line)
        if kpis is not None:
            current = Section(title="KPI ハイライト", kind="kpi", kpis=kpis)
            deck.sections.append(current)
            continue
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            title = m.group(1).strip()
            if title in ("アジェンダ", "Agenda", "目次"):
                kind = "agenda"
            elif title in ("まとめ", "結論", "Conclusion", "Closing", "Thank you"):
                kind = "closing"
            else:
                kind = "content"
            current = Section(title=title, kind=kind)
            deck.sections.append(current)
            continue
        m = re.match(r"^\s*>\s+(.+)$", line)
        if m and current is not None:
            current.notes.append(m.group(1).strip())
            continue
        m = re.match(r"^\s*[-*0-9]+\.?\s+(.+)$", line)
        if m and current is not None:
            current.bullets.append(m.group(1).strip())
            continue
        if current is not None and line.strip():
            current.bullets.append(line.strip())
    return deck


# ── レイアウト・テンプレ操作 ────────────────────────────────


def _is_dark(deck: Deck) -> bool:
    return deck.tone == "dark"


def _layout_for(prs: Presentation, *, title_layout: bool) -> "pptx.slide.SlideLayout":
    """表紙用 / 本文用のレイアウトを選ぶ。"""
    if title_layout:
        # 表紙: Wave Landscape (layout 0) — 一番デザインが効いている
        return prs.slide_layouts[0]
    # 本文: Mesh grey 系（layout 1）
    if len(prs.slide_layouts) > 1:
        return prs.slide_layouts[1]
    return prs.slide_layouts[0]


def _hide_shape(shape) -> None:
    """シェイプを slide から削除する。"""
    sp = shape._element
    sp.getparent().remove(sp)


def _get_placeholder(slide, idx: int):
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == idx:
            return ph
    return None


def _strip_layout_background(slide) -> None:
    """本文スライド用にレイアウトの大背景画像 IMG_Back を slide から取り除く。

    placeholder ではなく picture シェイプとしてレイアウトに含まれる IMG_Back を
    inherit 解除し、上部にタイトル + 下部に本文を配置できる空間を確保する。
    """
    # slide 自体に IMG_Back 相当のシェイプは無いが、レイアウトのものが透けて見えている。
    # 本文を IMG_Back 上に重ねるため、半透明の白オーバーレイをスライドに差し込む。
    from pptx.util import Emu

    prs = slide.part.package.presentation_part.presentation
    width = prs.slide_width
    height = prs.slide_height
    # スライド全体に半透明の白マットを敷く（背景デザインを薄く残すため）
    overlay = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, width, height)
    overlay.line.fill.background()
    overlay.fill.solid()
    overlay.fill.fore_color.rgb = WHITE
    # 透過率 25%（PowerPoint XML 直接編集）
    sp_pr = overlay.fill._xPr
    solid = sp_pr.find(qn("a:solidFill"))
    if solid is not None:
        srgb = solid.find(qn("a:srgbClr"))
        if srgb is not None:
            from lxml import etree
            alpha = etree.SubElement(srgb, qn("a:alpha"))
            alpha.set("val", "82000")  # 82% 不透明 = 18% 透過
    # この overlay を最背面に配置する（zorder で他要素より下に）
    spTree = overlay._element.getparent()
    spTree.remove(overlay._element)
    # IMG_Back を覆って、その上にタイトル/本文を置けるよう、最背面ではなく
    # 「IMG_Back の直後（その上）かつ placeholder/text の前」に挿入する。
    # 簡単のため、spTree の最初の子に近い位置に置く。
    # nvGrpSpPr / grpSpPr は先頭にあるのでそれをスキップして第3要素として挿入。
    insert_idx = 2
    children = list(spTree)
    if len(children) > insert_idx:
        spTree.insert(insert_idx, overlay._element)
    else:
        spTree.append(overlay._element)


def _strip_layout_background_dark(slide) -> None:
    """ダーク用: Navy の半透明オーバーレイを敷く。"""
    from pptx.util import Emu

    prs = slide.part.package.presentation_part.presentation
    width = prs.slide_width
    height = prs.slide_height
    overlay = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, width, height)
    overlay.line.fill.background()
    overlay.fill.solid()
    overlay.fill.fore_color.rgb = NAVY
    sp_pr = overlay.fill._xPr
    solid = sp_pr.find(qn("a:solidFill"))
    if solid is not None:
        srgb = solid.find(qn("a:srgbClr"))
        if srgb is not None:
            from lxml import etree
            alpha = etree.SubElement(srgb, qn("a:alpha"))
            alpha.set("val", "85000")
    spTree = overlay._element.getparent()
    spTree.remove(overlay._element)
    insert_idx = 2
    children = list(spTree)
    if len(children) > insert_idx:
        spTree.insert(insert_idx, overlay._element)
    else:
        spTree.append(overlay._element)


def _move_title_to_top(slide, *, dark: bool) -> None:
    """既存タイトル placeholder を上部に移動 + Gold 下線を追加。"""
    title_ph = _get_placeholder(slide, 0)
    if title_ph is None:
        return
    title_ph.left = Inches(0.6)
    title_ph.top = Inches(0.5)
    title_ph.width = Inches(12.13)
    title_ph.height = Inches(0.9)
    # フォント
    tf = title_ph.text_frame
    if tf.paragraphs and tf.paragraphs[0].runs:
        for run in tf.paragraphs[0].runs:
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = GOLD if dark else NAVY
            run.font.name = "Noto Sans JP"
    # SubTitle / Date placeholder は本文スライドでは非表示
    for idx in (10, 11):
        ph = _get_placeholder(slide, idx)
        if ph is not None:
            _hide_shape(ph)


def _add_title_underline(slide, *, dark: bool) -> None:
    """タイトル下に Gold アクセント線。"""
    prs = slide.part.package.presentation_part.presentation
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.45), Inches(0.6), Inches(0.06)
    )
    line.line.fill.background()
    line.fill.solid()
    line.fill.fore_color.rgb = GOLD


# ── テキスト描画 ────────────────────────────────────────────


def _set_text(
    frame,
    text,
    *,
    size_pt,
    bold=False,
    color=None,
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


def _add_bullets(frame, bullets, *, dark: bool, size_pt: int = 18):
    frame.text = ""
    frame.word_wrap = True
    color = WHITE if dark else BLACK
    for i, b in enumerate(bullets):
        if i == 0:
            p = frame.paragraphs[0]
        else:
            p = frame.add_paragraph()
        p.level = 0
        p.space_before = Pt(4)
        p.space_after = Pt(10)
        run = p.add_run()
        run.text = "—  " + correct(b)
        run.font.size = Pt(size_pt)
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = color
        # 最初のダッシュだけ Gold 強調
        if len(p.runs) > 0:
            p.runs[0].text = "—  " + correct(b)


def _set_speaker_notes(slide, notes: list[str]) -> None:
    if not notes:
        return
    text = "\n".join(correct(n) for n in notes)
    notes_slide = slide.notes_slide
    notes_slide.notes_text_frame.text = text


def _add_page_number(slide, prs, num: int, total: int, *, dark: bool):
    box = slide.shapes.add_textbox(
        prs.slide_width - Inches(1.4), prs.slide_height - Inches(0.5),
        Inches(1.0), Inches(0.3),
    )
    color = GRAY if not dark else RGBColor(0xC0, 0xC4, 0xCC)
    _set_text(box.text_frame, f"{num} / {total}", size_pt=10, color=color, align=PP_ALIGN.RIGHT)


# ── スライドビルダー ───────────────────────────────────────


def build_title_slide(prs: Presentation, deck: Deck, num: int, total: int) -> None:
    layout = _layout_for(prs, title_layout=True)
    slide = prs.slides.add_slide(layout)

    # placeholder にタイトル / サブタイトル / 日付を流し込む
    title_ph = _get_placeholder(slide, 0)
    if title_ph is not None:
        tf = title_ph.text_frame
        tf.text = ""
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = correct(deck.title)
        run.font.size = Pt(40)
        run.font.bold = True
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = NAVY  # 表紙は白背景なら Navy

    sub_ph = _get_placeholder(slide, 10)
    if sub_ph is not None:
        tf = sub_ph.text_frame
        tf.text = ""
        p = tf.paragraphs[0]
        run = p.add_run()
        sub_text = deck.subtitle or ("AKKODiS — External" if deck.audience.startswith("ext") else "AKKODiS — Internal")
        run.text = correct(sub_text)
        run.font.size = Pt(20)
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = NAVY

    date_ph = _get_placeholder(slide, 11)
    if date_ph is not None:
        from datetime import date
        tf = date_ph.text_frame
        tf.text = ""
        p = tf.paragraphs[0]
        run = p.add_run()
        author_part = f"  /  {deck.author}" if deck.author else ""
        run.text = f"{date.today().strftime('%Y.%m.%d')}{author_part}"
        run.font.size = Pt(11)
        run.font.name = "Noto Sans JP"
        run.font.color.rgb = GRAY


def build_section_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    layout = _layout_for(prs, title_layout=False)
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)

    # 背景は半透明オーバーレイで落ち着かせる
    if dark:
        _strip_layout_background_dark(slide)
    else:
        _strip_layout_background(slide)

    # タイトルを上部に移動
    _move_title_to_top(slide, dark=dark)
    title_ph = _get_placeholder(slide, 0)
    if title_ph is not None:
        title_ph.text_frame.text = correct(section.title)
        for run in title_ph.text_frame.paragraphs[0].runs:
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = GOLD if dark else NAVY
            run.font.name = "Noto Sans JP"

    # Gold 下線
    _add_title_underline(slide, dark=dark)

    # 本文ボディ
    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.8), Inches(12.13), Inches(5.0)
    )
    bullets = section.bullets if section.bullets else ["（内容を追加してください）"]
    _add_bullets(body_box.text_frame, bullets, dark=dark, size_pt=18)

    _set_speaker_notes(slide, section.notes)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_agenda_slide(prs: Presentation, deck: Deck, num: int, total: int, items: list[str]) -> None:
    layout = _layout_for(prs, title_layout=False)
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    if dark:
        _strip_layout_background_dark(slide)
    else:
        _strip_layout_background(slide)

    _move_title_to_top(slide, dark=dark)
    title_ph = _get_placeholder(slide, 0)
    if title_ph is not None:
        title_ph.text_frame.text = "アジェンダ"
        for run in title_ph.text_frame.paragraphs[0].runs:
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = GOLD if dark else NAVY
            run.font.name = "Noto Sans JP"
    _add_title_underline(slide, dark=dark)

    body_box = slide.shapes.add_textbox(
        Inches(1.0), Inches(2.0), Inches(11.5), Inches(4.5)
    )
    tf = body_box.text_frame
    tf.text = ""
    tf.word_wrap = True
    color = WHITE if dark else BLACK
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.space_after = Pt(14)
        # 番号 (Gold) + 区切り + テキスト
        num_run = p.add_run()
        num_run.text = f"{i+1:02}    "
        num_run.font.size = Pt(28)
        num_run.font.bold = True
        num_run.font.color.rgb = GOLD
        num_run.font.name = "Inter"
        text_run = p.add_run()
        text_run.text = correct(item)
        text_run.font.size = Pt(22)
        text_run.font.name = "Noto Sans JP"
        text_run.font.color.rgb = color

    _add_page_number(slide, prs, num, total, dark=dark)


def build_kpi_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    layout = _layout_for(prs, title_layout=False)
    slide = prs.slides.add_slide(layout)
    dark = _is_dark(deck)
    if dark:
        _strip_layout_background_dark(slide)
    else:
        _strip_layout_background(slide)

    _move_title_to_top(slide, dark=dark)
    title_ph = _get_placeholder(slide, 0)
    if title_ph is not None:
        title_ph.text_frame.text = correct(section.title) or "KPI ハイライト"
        for run in title_ph.text_frame.paragraphs[0].runs:
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = GOLD if dark else NAVY
            run.font.name = "Noto Sans JP"
    _add_title_underline(slide, dark=dark)

    n = max(1, len(section.kpis))
    cell_w = (prs.slide_width - Inches(1.2)) // n
    cell_top = Inches(2.4)
    for i, (label, value) in enumerate(section.kpis):
        cell_left = Inches(0.6) + cell_w * i
        # 値（大 Gold）
        val_box = slide.shapes.add_textbox(cell_left, cell_top, cell_w, Inches(1.8))
        val_tf = val_box.text_frame
        val_tf.word_wrap = True
        val_tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        _set_text(val_tf, value, size_pt=60, bold=True, color=GOLD, align=PP_ALIGN.CENTER, font="Inter")
        # ラベル
        lbl_box = slide.shapes.add_textbox(
            cell_left, cell_top + Inches(2.0), cell_w, Inches(0.6)
        )
        _set_text(
            lbl_box.text_frame,
            label,
            size_pt=14,
            color=WHITE if dark else NAVY,
            align=PP_ALIGN.CENTER,
        )
        # 区切り線（最後以外）
        if i < n - 1:
            sep = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                cell_left + cell_w - Inches(0.01),
                cell_top + Inches(0.4),
                Inches(0.01),
                Inches(1.6),
            )
            sep.line.fill.background()
            sep.fill.solid()
            sep.fill.fore_color.rgb = RGBColor(0xE0, 0xE4, 0xE8) if not dark else RGBColor(0x55, 0x66, 0x77)

    # 補足
    if section.bullets:
        note_box = slide.shapes.add_textbox(
            Inches(0.6), Inches(5.6), Inches(12.13), Inches(1.4)
        )
        _add_bullets(note_box.text_frame, section.bullets, dark=dark, size_pt=14)

    _set_speaker_notes(slide, section.notes)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_closing_slide(
    prs: Presentation, deck: Deck, section: Section, num: int, total: int
) -> None:
    # クロージングは layout 0（Wave Landscape）に Navy オーバーレイ
    layout = _layout_for(prs, title_layout=True)
    slide = prs.slides.add_slide(layout)

    # Navy 半透明オーバーレイ（白背景でも Navy ベタに）
    prs_obj = slide.part.package.presentation_part.presentation
    overlay = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs_obj.slide_width, prs_obj.slide_height
    )
    overlay.line.fill.background()
    overlay.fill.solid()
    overlay.fill.fore_color.rgb = NAVY
    spTree = overlay._element.getparent()
    spTree.remove(overlay._element)
    spTree.insert(2, overlay._element)

    # 既存 placeholder を全部隠す
    for idx in (0, 10, 11):
        ph = _get_placeholder(slide, idx)
        if ph is not None:
            _hide_shape(ph)

    # 大タイトル
    title_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(2.0), Inches(12.13), Inches(1.4)
    )
    _set_text(
        title_box.text_frame,
        correct(section.title),
        size_pt=44,
        bold=True,
        color=GOLD,
        align=PP_ALIGN.LEFT,
    )

    # まとめ箇条書き
    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(3.5), Inches(12.13), Inches(2.5)
    )
    if section.bullets:
        _add_bullets(body_box.text_frame, section.bullets, dark=True, size_pt=20)

    # サインオフ
    sign_box = slide.shapes.add_textbox(
        Inches(0.6), prs_obj.slide_height - Inches(1.0), Inches(12.13), Inches(0.5)
    )
    _set_text(
        sign_box.text_frame,
        "Thank you. — AKKODiS",
        size_pt=14,
        color=GOLD,
        align=PP_ALIGN.RIGHT,
    )

    _set_speaker_notes(slide, section.notes)


# ── ビルド本体 ──────────────────────────────────────────────


def build(deck: Deck, template: Path) -> Presentation:
    prs = Presentation(str(template))
    xml_slides = prs.slides._sldIdLst
    slides_part = prs.part
    for sld in list(xml_slides):
        rId = sld.get(qn("r:id"))
        if rId:
            slides_part.drop_rel(rId)
        xml_slides.remove(sld)

    # アジェンダを自動挿入（明示が無く、本文 2 つ以上ある場合）
    has_agenda = any(s.kind == "agenda" for s in deck.sections)
    insert_agenda = (not has_agenda) and len([s for s in deck.sections if s.kind != "agenda"]) >= 2

    total = 1 + (1 if insert_agenda else 0) + len(deck.sections)
    num = 1
    build_title_slide(prs, deck, num, total)
    num += 1

    if insert_agenda:
        agenda_items = [s.title for s in deck.sections if s.kind != "agenda"]
        build_agenda_slide(prs, deck, num, total, agenda_items)
        num += 1

    for sec in deck.sections:
        if sec.kind == "agenda":
            items = sec.bullets if sec.bullets else [s.title for s in deck.sections if s != sec and s.kind != "agenda"]
            build_agenda_slide(prs, deck, num, total, items)
        elif sec.kind == "kpi":
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
    ap.add_argument("--template", type=Path, default=None)
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
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
