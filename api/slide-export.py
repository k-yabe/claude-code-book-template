"""
Vercel Python Serverless Function: PPTX生成（python-pptx add_slide方式）
スライドJSONを受け取り、テンプレートのslide_layoutを使って新しいスライドを追加。
テンプレートデザインが正しく適用される。
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import io
import base64
from pptx import Presentation

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'apps', 'slide-maker', 'templates')

# 用途 → テンプレートのslide_layout名
LAYOUT_NAMES = {
    'cover': 'Wave in the corners',
    'chapter': 'Chapter - Mesh Gold',
    'agenda': 'Agenda - Computer',
    'content': 'Title, Subtitle and one Paragrah',
    'two-column': 'Two Paragraphs with Blue Line',
    'content-with-image': 'Text left - Picture Right',
    'content-with-chart': 'Text left - Picture Right',
    'content-with-flow': 'Text left - Picture Right',
    'sixbox': 'Six Text Boxes',
    'comparison': 'Title and SubTitle one Mesh',
    'quote': '1_Quote Content with animation',
    'closing': 'Thank you',
}


def _set(ph_map, idx, text):
    if idx in ph_map:
        try:
            ph_map[idx].text = str(text) if text else ''
        except Exception:
            pass


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

    elif layout in ('content-with-image', 'content-with-chart', 'content-with-flow'):
        _set(ph_map, 29, data.get('title', ''))
        _set(ph_map, 30, '')
        _set(ph_map, 32, data.get('body', ''))

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
        _set(ph_map, 30, data.get('title', ''))
        _set(ph_map, 31, '')
        # テーブルデータはcomparison layoutでは30,31のみ
        # テーブルをテキストとして表示
        table = data.get('table', {})
        headers = table.get('headers', [])
        rows = table.get('rows', [])
        table_text = ' | '.join(headers) + '\n'
        for row in rows:
            table_text += ' | '.join(str(c) for c in row) + '\n'
        _set(ph_map, 31, table_text.strip())

    elif layout == 'quote':
        speaker = data.get('speaker', '')
        _set(ph_map, 30, f'- {speaker}' if speaker else '')
        _set(ph_map, 31, data.get('body', ''))

    elif layout == 'closing':
        pass  # Thank you レイアウトにはplaceholderがない


def build_layout_map(prs):
    """全slide_masterからlayout名→layoutオブジェクトのマップを構築"""
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

            # 新しいスライドを追加
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

            # PPTXをbase64エンコードして返す
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
