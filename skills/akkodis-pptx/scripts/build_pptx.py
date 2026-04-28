#!/usr/bin/env python3
"""AKKODiS ブランド準拠 PPTX を生成する。

設計方針:
- テンプレ（external/internal × dark/white）の slide_layouts のグラフィック
  （Wave Landscape / Mesh / Eye Akkodis 等）を**そのまま**活かす
- スライド種別ごとに最適な layout を自動選択：
  - 表紙           → Wave Landscape（フルデコレーション）
  - 本文/アジェンダ/KPI → Mesh grey（IMG_Back を XML 削除して clean canvas）
  - クロージング   → Eye Akkodis（フルイメージ背景）
- ロゴ・「@Akkodis」フッターはマスターに既に入っているので追加配置しない
- 半透明オーバーレイは使わない（謎の白マットを排除）
- フォントは Noto Sans JP / 本文 18pt / タイトル 28-32pt
- 全テキストに表記補正 (notation.correct) を適用
- 用途デフォルトは external（社内向け＝社外秘テンプレは明示指定時のみ）

入力 (Markdown ライク):
    # タイトル: ...
    # サブタイトル: ...   （任意）
    # 用途: external | internal      （省略時 external）
    # トーン: dark | white            （省略時 white）
    # 作成: ...           （任意）

    ## アジェンダ                                ← 明示で自動アジェンダ抑制
    ## セクション名                              ← 通常スライド
    - 箇条書き
    > 発表者ノート

    ## KPI: 指標A=120% | 指標B=95% | 指標C=80%   ← KPI スライド
    ## まとめ                                    ← クロージング

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


# ── レイアウト選定 ──────────────────────────────────────────


def _by_name(prs: Presentation, *keywords: str):
    """テンプレ内の slide_layout を名前のキーワード一致で探す。"""
    for L in prs.slide_layouts:
        for kw in keywords:
            if kw.lower() in L.name.lower():
                return L
    return None


def _strip_full_background_pictures(layout) -> None:
    """layout の全面背景 Picture と Filter Shape を XML レベルで削除する。

    `IMG_Back`、`Image*`、`Blue Filter`、`Fond bleu dyn` 等を除去して、
    マスター上のロゴ/オレンジライン/AKKODiS 文字だけを残した clean canvas にする。
    """
    to_remove = []
    for sh in layout.shapes:
        kind = type(sh).__name__
        name = sh.name or ""
        # 大背景 Picture（IMG_Back, Image 9 等）
        if kind == "Picture":
            try:
                w_in = sh.width / 914400
                h_in = sh.height / 914400
            except Exception:
                w_in, h_in = 0, 0
            # 3 inch を超える Picture は背景扱いとして除去（ロゴ等は小さいので残る）
            if w_in > 6 or h_in > 4 or "IMG_" in name or "Image " in name:
                to_remove.append(sh)
        elif kind == "Shape":
            # Blue Filter / Fond bleu dyn などのフルカバー Shape
            lname = name.lower()
            if any(k in lname for k in ("filter", "fond bleu", "fond ", "img_")):
                to_remove.append(sh)
    for sh in to_remove:
        sp = sh._element
        sp.getparent().remove(sp)


def _select_layouts(prs: Presentation):
    """スライド種別ごとに最適 layout を返す。content_layout は clean 化済。"""
    # 表紙: 一番デザインが効いた layout
    title_layout = (
        _by_name(prs, "Wave Landscape", "Mesh Yellow", "Mesh & Blue")
        or prs.slide_layouts[0]
    )
    # クロージング: フルイメージ背景の Eye Akkodis
    closing_layout = _by_name(prs, "Eye Akkodis", "Eye") or title_layout

    # 本文用: Mesh grey > Full picture to insert > Wave in the corners > Mesh
    content_layout = (
        _by_name(prs, "Mesh grey", "Full picture", "Wave in the corners", "Mesh")
        or prs.slide_layouts[1]
        if len(prs.slide_layouts) > 1
        else prs.slide_layouts[0]
    )
    # 本文 layout は clean 化（IMG_Back, Filter, etc. を除去）
    _strip_full_background_pictures(content_layout)

    return title_layout, content_layout, closing_layout


# ── テキスト描画ヘルパ ──────────────────────────────────────


def _hide_shape(shape) -> None:
    sp = shape._element
    sp.getparent().remove(sp)


def _get_placeholder(slide, idx: int):
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == idx:
            return ph
    return None


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
        # Gold dash + 本文（同一段落内、別ラン）
        run_dash = p.add_run()
        run_dash.text = "—  "
        run_dash.font.size = Pt(size_pt)
        run_dash.font.name = "Noto Sans JP"
        run_dash.font.bold = True
        run_dash.font.color.rgb = GOLD
        run_body = p.add_run()
        run_body.text = correct(b)
        run_body.font.size = Pt(size_pt)
        run_body.font.name = "Noto Sans JP"
        run_body.font.color.rgb = color


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


def _set_placeholder_text(slide, idx, text, *, size_pt, bold=False, color=NAVY, font="Noto Sans JP"):
    ph = _get_placeholder(slide, idx)
    if ph is None:
        return None
    tf = ph.text_frame
    tf.text = ""
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = correct(text)
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.name = font
    run.font.color.rgb = color
    return ph


# ── スライドビルダー ───────────────────────────────────────


def build_title_slide(prs: Presentation, deck: Deck, layout, num: int, total: int) -> None:
    slide = prs.slides.add_slide(layout)
    dark = deck.tone == "dark"
    title_color = GOLD if dark else NAVY
    sub_color = WHITE if dark else NAVY

    _set_placeholder_text(slide, 0, deck.title, size_pt=40, bold=True, color=title_color)

    sub_text = deck.subtitle or (
        "社外向けプレゼンテーション" if deck.audience.startswith("ext") else "社内ドキュメント"
    )
    _set_placeholder_text(slide, 10, sub_text, size_pt=20, color=sub_color)

    from datetime import date
    author_part = f"  /  {deck.author}" if deck.author else ""
    _set_placeholder_text(
        slide, 11, f"{date.today().strftime('%Y.%m.%d')}{author_part}",
        size_pt=11, color=GRAY,
    )


def _move_title_to_top(slide, *, dark: bool, title_text: str) -> None:
    title_ph = _get_placeholder(slide, 0)
    if title_ph is not None:
        title_ph.left = Inches(0.6)
        title_ph.top = Inches(0.5)
        title_ph.width = Inches(12.13)
        title_ph.height = Inches(0.9)
        tf = title_ph.text_frame
        tf.text = ""
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = correct(title_text)
        run.font.size = Pt(28)
        run.font.bold = True
        run.font.color.rgb = GOLD if dark else NAVY
        run.font.name = "Noto Sans JP"
    # Subtitle / Date placeholder は本文では消す
    for idx in (10, 11):
        ph = _get_placeholder(slide, idx)
        if ph is not None:
            _hide_shape(ph)


def _add_title_underline(slide):
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.45), Inches(0.6), Inches(0.06)
    )
    line.line.fill.background()
    line.fill.solid()
    line.fill.fore_color.rgb = GOLD


def build_section_slide(
    prs: Presentation, deck: Deck, layout, section: Section, num: int, total: int
) -> None:
    slide = prs.slides.add_slide(layout)
    dark = deck.tone == "dark"

    _move_title_to_top(slide, dark=dark, title_text=section.title)
    _add_title_underline(slide)

    body_box = slide.shapes.add_textbox(
        Inches(0.6), Inches(1.8), Inches(12.13), Inches(5.0)
    )
    bullets = section.bullets if section.bullets else ["（内容を追加してください）"]
    _add_bullets(body_box.text_frame, bullets, dark=dark, size_pt=18)

    _set_speaker_notes(slide, section.notes)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_agenda_slide(
    prs: Presentation, deck: Deck, layout, num: int, total: int, items: list[str]
) -> None:
    slide = prs.slides.add_slide(layout)
    dark = deck.tone == "dark"
    _move_title_to_top(slide, dark=dark, title_text="アジェンダ")
    _add_title_underline(slide)

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
    prs: Presentation, deck: Deck, layout, section: Section, num: int, total: int
) -> None:
    slide = prs.slides.add_slide(layout)
    dark = deck.tone == "dark"
    _move_title_to_top(slide, dark=dark, title_text=section.title or "KPI ハイライト")
    _add_title_underline(slide)

    n = max(1, len(section.kpis))
    cell_w = (prs.slide_width - Inches(1.2)) // n
    cell_top = Inches(2.4)
    for i, (label, value) in enumerate(section.kpis):
        cell_left = Inches(0.6) + cell_w * i
        val_box = slide.shapes.add_textbox(cell_left, cell_top, cell_w, Inches(1.8))
        val_tf = val_box.text_frame
        val_tf.word_wrap = True
        val_tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        _set_text(
            val_tf, value, size_pt=60, bold=True, color=GOLD,
            align=PP_ALIGN.CENTER, font="Inter",
        )
        lbl_box = slide.shapes.add_textbox(
            cell_left, cell_top + Inches(2.0), cell_w, Inches(0.6)
        )
        _set_text(
            lbl_box.text_frame, label, size_pt=14,
            color=WHITE if dark else NAVY, align=PP_ALIGN.CENTER,
        )
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
            sep.fill.fore_color.rgb = (
                RGBColor(0xE0, 0xE4, 0xE8) if not dark else RGBColor(0x55, 0x66, 0x77)
            )

    if section.bullets:
        note_box = slide.shapes.add_textbox(
            Inches(0.6), Inches(5.6), Inches(12.13), Inches(1.4)
        )
        _add_bullets(note_box.text_frame, section.bullets, dark=dark, size_pt=14)

    _set_speaker_notes(slide, section.notes)
    _add_page_number(slide, prs, num, total, dark=dark)


def build_closing_slide(
    prs: Presentation, deck: Deck, layout, section: Section, num: int, total: int
) -> None:
    """Eye Akkodis layout（フルイメージ背景）に Thank you + まとめを placeholder で流し込む。"""
    slide = prs.slides.add_slide(layout)

    # placeholder にタイトル / サブタイトルを流し込む（layout の image はそのまま）
    _set_placeholder_text(slide, 0, section.title or "Thank you", size_pt=40, bold=True, color=GOLD)

    if section.bullets:
        sub_text = " / ".join(correct(b) for b in section.bullets)
    else:
        sub_text = "AKKODiS — Engineering future, together."
    _set_placeholder_text(slide, 10, sub_text, size_pt=16, color=WHITE)

    _set_placeholder_text(slide, 11, "Thank you. — AKKODiS", size_pt=11, color=GOLD)

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

    title_layout, content_layout, closing_layout = _select_layouts(prs)

    has_agenda = any(s.kind == "agenda" for s in deck.sections)
    insert_agenda = (not has_agenda) and len(
        [s for s in deck.sections if s.kind != "agenda"]
    ) >= 2

    total = 1 + (1 if insert_agenda else 0) + len(deck.sections)
    num = 1
    build_title_slide(prs, deck, title_layout, num, total)
    num += 1

    if insert_agenda:
        agenda_items = [s.title for s in deck.sections if s.kind != "agenda"]
        build_agenda_slide(prs, deck, content_layout, num, total, agenda_items)
        num += 1

    for sec in deck.sections:
        if sec.kind == "agenda":
            items = sec.bullets if sec.bullets else [
                s.title for s in deck.sections if s != sec and s.kind != "agenda"
            ]
            build_agenda_slide(prs, deck, content_layout, num, total, items)
        elif sec.kind == "kpi":
            build_kpi_slide(prs, deck, content_layout, sec, num, total)
        elif sec.kind == "closing":
            build_closing_slide(prs, deck, closing_layout, sec, num, total)
        else:
            build_section_slide(prs, deck, content_layout, sec, num, total)
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
