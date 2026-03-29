"""
Vercel Python Serverless Function: PPTX生成（python-pptx add_slide方式）
テンプレートのslide_layoutを使い、テキスト + ネイティブチャート + テーブル + フロー図形を生成。
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import io
import base64
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.chart.data import CategoryChartData

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'apps', 'slide-maker', 'templates')

LAYOUT_NAMES = {
    'cover': 'Wave in the corners',
    'chapter': 'Chapter - Mesh Gold',
    'agenda': 'Agenda - Computer',
    'content': 'Title, Subtitle and one Paragrah',
    'two-column': 'Two Paragraphs with Blue Line',
    'content-with-image': 'Title, Subtitle and one Paragrah',
    'content-with-chart': 'Title, Subtitle and one Paragrah',
    'content-with-flow': 'Title, Subtitle and one Paragrah',
    'sixbox': 'Six Text Boxes',
    'comparison': 'Title, Subtitle and one Paragrah',
    'quote': '1_Quote Content with animation',
    'closing': 'Thank you',
}

NAVY = RGBColor(0x00, 0x1F, 0x33)
GOLD = RGBColor(0xFF, 0xB8, 0x1C)
CYAN = RGBColor(0x00, 0xBF, 0xD6)
GRAY = RGBColor(0x8A, 0x9B, 0xB0)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CHART_COLORS = [NAVY, GOLD, CYAN, GRAY, RGBColor(0x4A, 0x55, 0x68), RGBColor(0xE6, 0x7E, 0x22)]


def _set(ph_map, idx, text):
    if idx in ph_map:
        try:
            ph_map[idx].text = str(text) if text else ''
        except Exception:
            pass


def add_chart(slide, chart_data):
    """スライドにネイティブPPTXチャートを追加"""
    ctype = chart_data.get('type', 'bar')
    chart_type_map = {
        'bar': XL_CHART_TYPE.COLUMN_CLUSTERED,
        'line': XL_CHART_TYPE.LINE_MARKERS,
        'pie': XL_CHART_TYPE.PIE,
    }
    xl_type = chart_type_map.get(ctype, XL_CHART_TYPE.COLUMN_CLUSTERED)

    cd = CategoryChartData()
    cd.categories = chart_data.get('labels', [])
    values = chart_data.get('data', [])
    # 数値変換
    num_values = []
    for v in values:
        try:
            num_values.append(float(v))
        except (ValueError, TypeError):
            num_values.append(0)
    cd.add_series(chart_data.get('title', ''), num_values)

    # チャート位置: スライド下半分
    x, y = Inches(0.8), Inches(2.8)
    cx, cy = Inches(8.4), Inches(4.0)
    chart_frame = slide.shapes.add_chart(xl_type, x, y, cx, cy, cd)
    chart = chart_frame.chart

    # スタイリング
    chart.has_legend = (ctype == 'pie')
    if chart.series:
        series = chart.series[0]
        if ctype != 'pie':
            series.format.fill.solid()
            series.format.fill.fore_color.rgb = NAVY
        else:
            for i, point in enumerate(series.points):
                point.format.fill.solid()
                point.format.fill.fore_color.rgb = CHART_COLORS[i % len(CHART_COLORS)]

    # 単位ラベル
    unit = chart_data.get('unit', '')
    if unit and hasattr(chart, 'value_axis'):
        chart.value_axis.axis_title.text_frame.text = unit


def add_table(slide, table_data):
    """スライドにネイティブPPTXテーブルを追加"""
    headers = table_data.get('headers', [])
    rows_data = table_data.get('rows', [])
    if not headers:
        return

    cols = len(headers)
    row_count = 1 + len(rows_data)
    x, y = Inches(0.8), Inches(2.5)
    cx, cy = Inches(8.4), Inches(0.5 * row_count)
    table_shape = slide.shapes.add_table(row_count, cols, x, y, cx, cy)
    table = table_shape.table

    # ヘッダー行
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = str(h)
        for para in cell.text_frame.paragraphs:
            para.font.size = Pt(11)
            para.font.bold = True
            para.font.color.rgb = WHITE
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY

    # データ行
    for i, row in enumerate(rows_data):
        for j, val in enumerate(row):
            if j < cols:
                cell = table.cell(i + 1, j)
                cell.text = str(val)
                for para in cell.text_frame.paragraphs:
                    para.font.size = Pt(10)
                    para.font.color.rgb = NAVY


def add_flow(slide, steps):
    """スライドにフロー図形（矢形＋矢印）を追加"""
    if not steps:
        return
    n = len(steps)
    total_w = Inches(8.4)
    box_w = int(total_w / n * 0.7)
    gap = int(total_w / n * 0.3)
    box_h = Inches(0.9)
    start_x = Inches(0.8)
    y = Inches(4.0)

    for i, step in enumerate(steps):
        x = start_x + i * (box_w + gap)
        # ボックス
        shape = slide.shapes.add_shape(1, x, y, box_w, box_h)  # 1 = rectangle
        shape.fill.solid()
        shape.fill.fore_color.rgb = NAVY
        shape.line.fill.background()
        tf = shape.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = str(step)
        p.font.size = Pt(10)
        p.font.color.rgb = WHITE
        p.font.bold = True
        p.alignment = PP_ALIGN.CENTER

        # 矢印（最後以外）
        if i < n - 1:
            ax = x + box_w
            arrow = slide.shapes.add_shape(13, ax, y + box_h // 3, gap, box_h // 3)  # 13 = right arrow
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = GOLD
            arrow.line.fill.background()


def apply_data(slide, layout, data):
    ph_map = {ph.placeholder_format.idx: ph for ph in slide.placeholders}

    if layout == 'cover':
        _set(ph_map, 0, data.get('title', ''))
        _set(ph_map, 10, data.get('subtitle', ''))
        _set(ph_map, 11, data.get('date', ''))

    elif layout == 'chapter':
        _set(ph_map, 12, data.get('title', ''))
        _set(ph_map, 13, data.get('number', ''))

    elif layout == 'agenda':
        items = data.get('items', [])
        _set(ph_map, 24, data.get('title', 'Agenda'))
        for j in range(6):
            _set(ph_map, 12 + j * 2, items[j] if j < len(items) else '')
            _set(ph_map, 13 + j * 2, str(j + 1) if j < len(items) else '')

    elif layout == 'content':
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, '')
        _set(ph_map, 32, data.get('body', ''))

    elif layout == 'two-column':
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, data.get('leftBody', ''))
        _set(ph_map, 32, data.get('rightBody', ''))
        _set(ph_map, 33, '')

    elif layout in ('content-with-image', 'content-with-chart'):
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, '')
        body = data.get('body', '')
        _set(ph_map, 32, body)
        # ネイティブチャート追加
        chart = data.get('chart')
        if chart and chart.get('labels') and chart.get('data'):
            add_chart(slide, chart)

    elif layout == 'content-with-flow':
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, '')
        _set(ph_map, 32, data.get('body', ''))
        # フロー図形追加
        flow = data.get('flow')
        if flow and flow.get('steps'):
            add_flow(slide, flow['steps'])

    elif layout == 'sixbox':
        _set(ph_map, 30, data.get('title', ''))
        _set(ph_map, 31, '')
        boxes = data.get('boxes', [])
        for b in range(6):
            box = boxes[b] if b < len(boxes) else {}
            head_idx = (10 + b) if b < 3 else (11 + b)
            _set(ph_map, head_idx, box.get('heading', ''))
            _set(ph_map, 17 + b, box.get('body', ''))
            _set(ph_map, 23 + b, str(b + 1) if box.get('heading') else '')

    elif layout == 'comparison':
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, '')
        _set(ph_map, 32, '')
        # ネイティブテーブル追加
        table = data.get('table')
        if table and table.get('headers'):
            add_table(slide, table)

    elif layout == 'quote':
        speaker = data.get('speaker', '')
        _set(ph_map, 30, f'- {speaker}' if speaker else '')
        _set(ph_map, 31, data.get('body', ''))

    elif layout == 'closing':
        pass


def build_layout_map(prs):
    layout_map = {}
    for master in prs.slide_masters:
        for sl in master.slide_layouts:
            layout_map[sl.name] = sl
    return layout_map


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length))

            slides_data = body.get('slides', [])
            template_id = body.get('template', 'external-white')

            if not slides_data:
                self._error(400, 'slides is required')
                return

            tpl_path = os.path.join(TEMPLATE_DIR, f'{template_id}.pptx')
            if not os.path.exists(tpl_path):
                self._error(400, f'Template not found: {template_id}')
                return

            prs = Presentation(tpl_path)
            layout_map = build_layout_map(prs)

            # 既存スライドを全削除
            sldIdLst = prs.slides._sldIdLst
            for sldId in list(sldIdLst):
                rId = sldId.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                if rId:
                    prs.part.drop_rel(rId)
                sldIdLst.remove(sldId)

            for sd in slides_data:
                ly = sd.get('layout', 'content')
                layout_name = LAYOUT_NAMES.get(ly, 'Title, Subtitle and one Paragrah')
                layout = layout_map.get(layout_name)
                if not layout:
                    layout = layout_map.get('Title, Subtitle and one Paragrah')
                if not layout:
                    continue

                slide = prs.slides.add_slide(layout)
                apply_data(slide, ly, sd)

            buffer = io.BytesIO()
            prs.save(buffer)
            pptx_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'pptx': pptx_b64,
                'slides': len(slides_data),
            }).encode())

        except Exception as e:
            self._error(500, str(e))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _error(self, code, msg):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'error': msg}).encode())
